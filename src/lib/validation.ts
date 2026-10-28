export const MIN_PASSWORD = 8;

export const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

/** Returns an error message, or null when the password is acceptable. */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Use both letters and numbers.';
  return null;
}

export type SignUpInput = { name: string; email: string; password: string; confirm: string };

/** First problem with a registration form, or null. */
export function signUpProblem({ name, email, password, confirm }: SignUpInput): string | null {
  if (name.trim().length < 1) return 'Enter your name.';
  if (name.trim().length > 60) return 'Name must be 60 characters or fewer.';
  if (!isValidEmail(email)) return 'Enter a valid email address.';
  const pw = passwordProblem(password);
  if (pw) return pw;
  if (password !== confirm) return 'Passwords do not match.';
  return null;
}
