import { describe, expect, it } from 'vitest';
import {
  RSA_E,
  attackRecord,
  factorPollardRho,
  generateToyRsaKey,
  isProbablePrime,
  migrateToLocalAes,
  modInverse,
  modPow,
  protectWithRsaKem,
  randomPrime,
} from '../src/rekey';

const localKey = (): Uint8Array => crypto.getRandomValues(new Uint8Array(32));

describe('toy RSA key material', () => {
  it('agrees with a known-answer primality check', () => {
    expect(isProbablePrime(2n)).toBe(true);
    expect(isProbablePrime(97n)).toBe(true);
    expect(isProbablePrime(4294967291n)).toBe(true); // largest 32-bit prime
    expect(isProbablePrime(4294967295n)).toBe(false);
    expect(isProbablePrime(1n)).toBe(false);
  });

  it('generates primes of the requested bit length', () => {
    const p = randomPrime(32);
    expect(p.toString(2).length).toBe(32);
    expect(isProbablePrime(p)).toBe(true);
  });

  it('produces a key where d really is the inverse of e', () => {
    const key = generateToyRsaKey();
    const phi = (key.p - 1n) * (key.q - 1n);
    expect((key.d * key.e) % phi).toBe(1n);
    expect(key.p * key.q).toBe(key.n);
    expect(key.modulusBits).toBeGreaterThanOrEqual(63);
  });

  it('round-trips an integer through encrypt/decrypt', () => {
    const key = generateToyRsaKey();
    const m = 1234567891011n % key.n;
    expect(modPow(modPow(m, key.e, key.n), key.d, key.n)).toBe(m);
  });

  it('inverts modulo a prime', () => {
    expect((modInverse(RSA_E, 1000003n) * RSA_E) % 1000003n).toBe(1n);
  });
});

describe('factoring the toy modulus', () => {
  it('recovers exactly the primes that were generated', () => {
    for (let run = 0; run < 5; run += 1) {
      const key = generateToyRsaKey();
      const factors = factorPollardRho(key.n);
      expect(factors.p * factors.q).toBe(key.n);
      const generated = [key.p, key.q].sort((a, b) => (a < b ? -1 : 1));
      expect([factors.p, factors.q]).toEqual(generated);
      expect(factors.iterations).toBeGreaterThan(0);
    }
  });
});

describe('the attack, and what migration changes about it', () => {
  it('recovers an RSA-KEM protected record byte-for-byte', async () => {
    const key = generateToyRsaKey();
    const text = 'patient EHR row 88213';
    const item = await protectWithRsaKem(key, 'a1', 'EHR', 'archive', text);
    const outcome = await attackRecord(item.record, key.n, key.e, factorPollardRho(key.n));
    expect(outcome.recovered).toBe(true);
    expect(outcome.plaintext).toBe(text);
  });

  it('keeps the plaintext out of the stored record', async () => {
    const key = generateToyRsaKey();
    const item = await protectWithRsaKem(key, 'a1', 'EHR', 'archive', 'unique-marker-9182');
    const serialized = JSON.stringify(item.record, (_k, v) =>
      ArrayBuffer.isView(v) ? Array.from(v as Uint8Array) : v,
    );
    expect(serialized).not.toContain('unique-marker-9182');
  });

  it('fails on a record that has been re-keyed to a locally held AES key', async () => {
    const key = generateToyRsaKey();
    const text = 'patient EHR row 88213';
    const original = await protectWithRsaKem(key, 'a1', 'EHR', 'archive', text);
    const migrated = await migrateToLocalAes(original, key, localKey());

    expect(migrated.record.protection).toBe('aes-local');
    expect(migrated.record.wrapper).toBeNull();
    // Re-keying preserved the data for its owner...
    expect(migrated.plaintext).toBe(text);

    // ...and removed the attacker's path to it.
    const outcome = await attackRecord(migrated.record, key.n, key.e, factorPollardRho(key.n));
    expect(outcome.recovered).toBe(false);
    expect(outcome.plaintext).toBeNull();
    expect(outcome.method).toContain('No RSA wrapper left to break');
  });

  it('re-encrypts to different bytes under the new key', async () => {
    const key = generateToyRsaKey();
    const original = await protectWithRsaKem(key, 'a1', 'EHR', 'archive', 'same text');
    const migrated = await migrateToLocalAes(original, key, localKey());
    expect(Array.from(migrated.record.ciphertext)).not.toEqual(
      Array.from(original.record.ciphertext),
    );
  });

  it('cannot reach a copy that was already taken — the whole point', async () => {
    const key = generateToyRsaKey();
    const archived = await protectWithRsaKem(key, 'a1', 'archive row', 'archive', 'still held');
    const captured = await protectWithRsaKem(key, 'c1', 'wire session', 'captured', 'already gone');

    // The adversary's copy is taken here and never touched again.
    const adversaryCopy = { ...captured.record, iv: captured.record.iv.slice(), ciphertext: captured.record.ciphertext.slice() };

    // The owner migrates everything it can reach. It cannot reach adversaryCopy.
    const migratedArchive = await migrateToLocalAes(archived, key, localKey());
    await migrateToLocalAes(captured, key, localKey());

    const factors = factorPollardRho(key.n);
    const archiveOutcome = await attackRecord(migratedArchive.record, key.n, key.e, factors);
    const capturedOutcome = await attackRecord(adversaryCopy, key.n, key.e, factors);

    expect(archiveOutcome.recovered).toBe(false);
    expect(capturedOutcome.recovered).toBe(true);
    expect(capturedOutcome.plaintext).toBe('already gone');
  });

  it('loses everything when the attack lands before the migration', async () => {
    const key = generateToyRsaKey();
    const items = await Promise.all([
      protectWithRsaKem(key, 'a1', 'one', 'archive', 'one'),
      protectWithRsaKem(key, 'a2', 'two', 'archive', 'two'),
      protectWithRsaKem(key, 'c1', 'three', 'captured', 'three'),
    ]);
    const factors = factorPollardRho(key.n);
    const outcomes = await Promise.all(
      items.map((i) => attackRecord(i.record, key.n, key.e, factors)),
    );
    expect(outcomes.every((o) => o.recovered)).toBe(true);
    expect(outcomes.map((o) => o.plaintext)).toEqual(['one', 'two', 'three']);
  });
});
