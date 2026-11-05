// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { esc } from '../src/escape.ts';

describe('esc', () => {
  it('escapes every character that can end an attribute or open a tag', () => {
    expect(esc('&')).toBe('&amp;');
    expect(esc('<')).toBe('&lt;');
    expect(esc('>')).toBe('&gt;');
    // The two that were missing until 43058f6, and the reason seven alerts existed:
    // most of this lab's 36 call sites interpolate into title="…" or data-…="…".
    expect(esc('"')).toBe('&quot;');
    expect(esc("'")).toBe('&#39;');
  });

  it('escapes the ampersand first, so the other escapes survive intact', () => {
    expect(esc('<a>')).toBe('&lt;a&gt;');
    expect(esc('&lt;')).toBe('&amp;lt;');
  });

  it('leaves an attribute-breaking payload unable to close its attribute', () => {
    // This is the exact shape the fix was proved against: a value that would close
    // title="…" and start an attribute of its own.
    const payload = 'EHR" data-injected="yes';
    const escaped = esc(payload);
    expect(escaped).not.toContain('"');
    expect(escaped).toBe('EHR&quot; data-injected=&quot;yes');
    // Parsed as an attribute value, it is six words and no attribute.
    const probe = document.createElement('div');
    probe.innerHTML = `<span title="${escaped}">x</span>`;
    const span = probe.querySelector('span');
    expect(span?.getAttribute('title')).toBe(payload);
    expect(span?.hasAttribute('data-injected')).toBe(false);
  });

  it('leaves a tag-opening payload inert', () => {
    const escaped = esc('<img src=x onerror="document.title=\'xss\'">');
    expect(escaped).not.toMatch(/[<>"']/);
    const probe = document.createElement('div');
    probe.innerHTML = escaped;
    expect(probe.querySelectorAll('img')).toHaveLength(0);
    expect(probe.textContent).toContain('img src=x onerror=');
  });
});
