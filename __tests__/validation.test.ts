import { isValidEmail, passwordProblem, signUpProblem } from '../src/lib/validation';

describe('validation', () => {
  it('validates emails', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail(' jay@example.com ')).toBe(true);
    for (const bad of ['', 'abc', 'a@b', 'a b@c.com', '@c.com', 'a@.com']) expect(isValidEmail(bad)).toBe(false);
  });
  it('requires 8+ chars with letters and numbers', () => {
    expect(passwordProblem('short1')).toMatch(/at least 8/);
    expect(passwordProblem('onlyletters')).toMatch(/letters and numbers/);
    expect(passwordProblem('12345678')).toMatch(/letters and numbers/);
    expect(passwordProblem('lifting2026')).toBeNull();
  });
  it('reports the first sign-up problem in order', () => {
    const ok = { name: 'Jay', email: 'jay@example.com', password: 'lifting2026', confirm: 'lifting2026' };
    expect(signUpProblem(ok)).toBeNull();
    expect(signUpProblem({ ...ok, name: ' ' })).toMatch(/name/i);
    expect(signUpProblem({ ...ok, email: 'nope' })).toMatch(/email/i);
    expect(signUpProblem({ ...ok, password: 'abc', confirm: 'abc' })).toMatch(/at least 8/);
    expect(signUpProblem({ ...ok, confirm: 'different1' })).toMatch(/do not match/);
  });
});
