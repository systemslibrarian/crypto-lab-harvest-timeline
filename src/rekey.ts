/**
 * Exhibit 6's engine: a real, tiny RSA-KEM, a real factoring attack against it,
 * and a real symmetric re-key.
 *
 * WHY THIS EXISTS
 * The rest of this lab projects *when* assets cross the line. It never showed
 * what "migrate" does to bytes, and that gap hides the single most useful
 * distinction in HNDL planning: migration is a fix for the data you still hold,
 * and no fix at all for the data that already left. Exhibit 6 makes the learner
 * perform both and then measures the difference under one attack.
 *
 * SCALE, STATED PLAINLY
 * The RSA modulus here is two 32-bit primes — a 64-bit n. RSA-2048 is 2048 bits.
 * A 64-bit modulus is chosen so Pollard's rho finishes in a browser tab while
 * you watch; it is not an argument that RSA-2048 is weak today. It is a stand-in
 * for what a CRQC does to RSA-2048 via Shor, which is not factoring by search at
 * all. Everything else on this page is production shape: RSA-KEM as in
 * ISO 18033-2 (KDF = SHA-256 over the recovered integer), and AES-256-GCM.
 */

export const TOY_PRIME_BITS = 32;

export interface ToyRsaKey {
  n: bigint;
  e: bigint;
  d: bigint;
  p: bigint;
  q: bigint;
  /** Bit length of n, so the page can quote its own parameter rather than a constant. */
  modulusBits: number;
}

function randomBigInt(bits: number): bigint {
  const bytes = crypto.getRandomValues(new Uint8Array(Math.ceil(bits / 8)));
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  // Force the top bit (so the prime really is `bits` long) and the low bit (odd).
  value |= 1n << BigInt(bits - 1);
  return value | 1n;
}

export function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = 1n;
  let b = base % modulus;
  let e = exponent;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % modulus;
    b = (b * b) % modulus;
    e >>= 1n;
  }
  return result;
}

const MR_BASES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];

export function isProbablePrime(n: bigint): boolean {
  if (n < 2n) return false;
  for (const small of MR_BASES) {
    if (n === small) return true;
    if (n % small === 0n) return false;
  }
  let d = n - 1n;
  let r = 0n;
  while (d % 2n === 0n) {
    d /= 2n;
    r += 1n;
  }
  witness: for (const a of MR_BASES) {
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    for (let i = 1n; i < r; i += 1n) {
      x = (x * x) % n;
      if (x === n - 1n) continue witness;
    }
    return false;
  }
  return true;
}

export function randomPrime(bits: number): bigint {
  for (;;) {
    const candidate = randomBigInt(bits);
    if (isProbablePrime(candidate)) return candidate;
  }
}

function egcd(a: bigint, b: bigint): { g: bigint; x: bigint; y: bigint } {
  if (b === 0n) return { g: a, x: 1n, y: 0n };
  const inner = egcd(b, a % b);
  return { g: inner.g, x: inner.y, y: inner.x - (a / b) * inner.y };
}

export function modInverse(a: bigint, m: bigint): bigint {
  const { g, x } = egcd(((a % m) + m) % m, m);
  if (g !== 1n) throw new Error('No modular inverse — e and phi are not coprime.');
  return ((x % m) + m) % m;
}

export const RSA_E = 65537n;

export function generateToyRsaKey(primeBits: number = TOY_PRIME_BITS): ToyRsaKey {
  for (;;) {
    const p = randomPrime(primeBits);
    const q = randomPrime(primeBits);
    if (p === q) continue;
    const n = p * q;
    const phi = (p - 1n) * (q - 1n);
    if (phi % RSA_E === 0n) continue;
    return { n, e: RSA_E, d: modInverse(RSA_E, phi), p, q, modulusBits: n.toString(2).length };
  }
}

export interface FactorResult {
  p: bigint;
  q: bigint;
  iterations: number;
  elapsedMs: number;
}

function absBig(v: bigint): bigint {
  return v < 0n ? -v : v;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = absBig(a);
  let y = absBig(b);
  while (y) {
    [x, y] = [y, x % y];
  }
  return x;
}

/**
 * Pollard's rho with Floyd cycle detection — a genuine factoring algorithm, run
 * on a genuinely small modulus. The iteration count it reports is the real work
 * it did; it is roughly n^(1/4), which is exactly why 2048-bit moduli are out of
 * reach classically and why Shor's polynomial-time period finding is the thing
 * that changes the picture.
 */
export function factorPollardRho(n: bigint): FactorResult {
  const started = performance.now();
  let iterations = 0;
  if (n % 2n === 0n) {
    return { p: 2n, q: n / 2n, iterations, elapsedMs: performance.now() - started };
  }
  for (let c = 1n; ; c += 1n) {
    let x = 2n;
    let y = 2n;
    let divisor = 1n;
    while (divisor === 1n) {
      iterations += 1;
      x = (x * x + c) % n;
      y = (y * y + c) % n;
      y = (y * y + c) % n;
      divisor = gcd(absBig(x - y), n);
    }
    if (divisor !== n) {
      const other = n / divisor;
      const [p, q] = divisor < other ? [divisor, other] : [other, divisor];
      return { p, q, iterations, elapsedMs: performance.now() - started };
    }
    // Cycle collapsed onto n itself — retry with a different polynomial.
  }
}

export type Holding = 'archive' | 'captured';
export type Protection = 'rsa-kem' | 'aes-local';

/** Exactly what sits on disk (or in the adversary's store). No plaintext here. */
export interface StoredRecord {
  id: string;
  label: string;
  holding: Holding;
  protection: Protection;
  /** RSA-KEM wrapper c = m^e mod n, as a decimal string. Null once re-keyed. */
  wrapper: string | null;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

export interface ProtectedItem {
  record: StoredRecord;
  /** Owner-side ground truth. Never given to the attack function. */
  plaintext: string;
}

function bigIntTo8Bytes(value: bigint): Uint8Array {
  const out = new Uint8Array(8);
  let v = value;
  for (let i = 7; i >= 0; i -= 1) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

async function aesKeyFromBytes(bytes: Uint8Array): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

async function aesKeyFromRaw(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw as BufferSource, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

async function gcmEncrypt(key: CryptoKey, plaintext: string): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      new TextEncoder().encode(plaintext) as BufferSource,
    ),
  );
  return { iv, ciphertext };
}

async function gcmDecrypt(key: CryptoKey, iv: Uint8Array, ciphertext: Uint8Array): Promise<string> {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ciphertext as BufferSource,
  );
  return new TextDecoder().decode(plain);
}

/**
 * RSA-KEM: draw a random integer m < n, ship c = m^e mod n, and use SHA-256(m)
 * as the data-encryption key. This is the shape real hybrid encryption has —
 * public key wraps a symmetric key, symmetric key does the work.
 */
export async function protectWithRsaKem(
  key: ToyRsaKey,
  id: string,
  label: string,
  holding: Holding,
  plaintext: string,
): Promise<ProtectedItem> {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let m = 0n;
  for (const byte of bytes) m = (m << 8n) | BigInt(byte);
  m = (m % (key.n - 3n)) + 2n;
  const wrapper = modPow(m, key.e, key.n);
  const dek = await aesKeyFromBytes(bigIntTo8Bytes(m));
  const { iv, ciphertext } = await gcmEncrypt(dek, plaintext);
  return {
    record: {
      id,
      label,
      holding,
      protection: 'rsa-kem',
      wrapper: wrapper.toString(),
      iv,
      ciphertext,
    },
    plaintext,
  };
}

/**
 * The migration itself: unwrap with the private key you hold, then re-encrypt
 * under a locally held AES-256 key and throw the RSA wrapper away. Symmetric-only
 * protection for data at rest is quantum-safe today — Grover halves AES-256 to
 * 128-bit work, which is not a threat. Nothing about this operation can reach a
 * copy someone else already made, which is the point of the exhibit.
 */
export async function migrateToLocalAes(
  item: ProtectedItem,
  rsaKey: ToyRsaKey,
  localKeyRaw: Uint8Array,
): Promise<ProtectedItem> {
  if (item.record.protection !== 'rsa-kem' || item.record.wrapper === null) return item;
  const m = modPow(BigInt(item.record.wrapper), rsaKey.d, rsaKey.n);
  const oldKey = await aesKeyFromBytes(bigIntTo8Bytes(m));
  const plaintext = await gcmDecrypt(oldKey, item.record.iv, item.record.ciphertext);
  const newKey = await aesKeyFromRaw(localKeyRaw);
  const { iv, ciphertext } = await gcmEncrypt(newKey, plaintext);
  return {
    record: { ...item.record, protection: 'aes-local', wrapper: null, iv, ciphertext },
    plaintext,
  };
}

export interface AttackOutcome {
  id: string;
  recovered: boolean;
  plaintext: string | null;
  method: string;
}

/**
 * The CRQC moment, run against stored records only. The attacker is handed the
 * public modulus, its factorization, and the bytes — never a plaintext, never a
 * locally held key.
 */
export async function attackRecord(
  record: StoredRecord,
  n: bigint,
  e: bigint,
  factors: FactorResult,
): Promise<AttackOutcome> {
  const phi = (factors.p - 1n) * (factors.q - 1n);
  const d = modInverse(e, phi);

  if (record.protection === 'rsa-kem' && record.wrapper !== null) {
    const m = modPow(BigInt(record.wrapper), d, n);
    const dek = await aesKeyFromBytes(bigIntTo8Bytes(m));
    try {
      return {
        id: record.id,
        recovered: true,
        plaintext: await gcmDecrypt(dek, record.iv, record.ciphertext),
        method: 'Factored the modulus, recovered d, unwrapped the RSA-KEM secret, decrypted.',
      };
    } catch {
      return {
        id: record.id,
        recovered: false,
        plaintext: null,
        method: 'Unwrapped the RSA-KEM secret but AES-GCM rejected the derived key.',
      };
    }
  }

  // No wrapper to unwrap. The attacker still tries: it derives a key from the
  // private exponent it just recovered — the only secret it holds — and lets
  // AES-GCM judge it. This is a real attempt with a real rejection, not a
  // narrated shrug.
  const guess = await aesKeyFromBytes(bigIntTo8Bytes(d & 0xffffffffffffffffn));
  try {
    return {
      id: record.id,
      recovered: true,
      plaintext: await gcmDecrypt(guess, record.iv, record.ciphertext),
      method: 'Key derived from the recovered private exponent happened to work.',
    };
  } catch {
    return {
      id: record.id,
      recovered: false,
      plaintext: null,
      method:
        'No RSA wrapper left to break. Tried a key derived from the recovered private exponent; AES-GCM rejected it.',
    };
  }
}
