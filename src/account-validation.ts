export function validateAccountForm({
  email,
  password,
  confirmation,
  signup,
  grade,
}: {
  email: string;
  password: string;
  confirmation: string;
  signup: boolean;
  grade: string | null;
}) {
  const normalizedEmail = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail))
    throw new Error("Enter a valid email address.");
  if (!password) throw new Error("Enter your password.");
  if (signup) {
    if (password.length < 8)
      throw new Error("Use at least 8 characters for your password.");
    if (password !== confirmation)
      throw new Error("Your passwords do not match.");
    if (!grade) throw new Error("Choose your grade to create an account.");
  }
  return normalizedEmail;
}
