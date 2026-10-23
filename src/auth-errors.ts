export function authErrorMessage(error: unknown): string {
  const value = error as {
    code?: string;
    message?: string;
    status?: number;
  } | null;
  const code = value?.code;
  if (code === "invalid_credentials")
    return "The email or password is incorrect. Try again or request a password reset.";
  if (code === "email_not_confirmed")
    return "Confirm your email before signing in. Check your inbox and spam folder, or use Resend confirmation email below.";
  if (
    code === "email_address_not_authorized" ||
    /email address.*not authorized/i.test(value?.message || "")
  )
    return "Email delivery is not ready for this address. Please contact support; the app's email service needs to be configured.";
  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    value?.status === 429
  )
    return "Too many requests. Please try later and check your inbox before requesting another email.";
  if (code === "weak_password")
    return "Choose a stronger password with at least 8 characters.";
  if (code === "same_password")
    return "Choose a password different from your current password.";
  if (
    code === "otp_expired" ||
    code === "session_not_found" ||
    code === "refresh_token_not_found"
  )
    return "This sign-in or reset link has expired. Request a new email and open the latest link.";
  if (code === "unexpected_failure" || code === "email_send_failed")
    return "The account service could not complete this request. Please try later or contact support.";
  if (
    /failed to fetch|network request failed|networkerror|fetch failed/i.test(
      value?.message || "",
    )
  )
    return "Could not connect to the account service. Check your connection and try again.";
  return value?.message || "Something went wrong. Please try again.";
}

export function validateNewPassword(password: string, confirmation: string) {
  if (password.length < 8)
    throw new Error("Use at least 8 characters for your password.");
  if (password !== confirmation)
    throw new Error("Your passwords do not match.");
}
