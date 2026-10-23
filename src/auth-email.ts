const requests = new Map<string, number>();

export function getAuthRedirect(
  platform: string,
  configured?: string,
  origin?: string,
) {
  if (platform !== "web") return "educationforum://auth/callback";
  for (const value of [configured, origin]) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (
        url.protocol === "https:" &&
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      )
        return url.href;
    } catch {
      /* Ignore invalid configuration. */
    }
  }
  return "educationforum://auth/callback";
}

// Shared across signup, confirmation resend and recovery; never automatically resend.
export async function emailRequest<
  T extends {
    error: { message: string; status?: number; code?: string } | null;
  },
>(email: string, send: () => Promise<T>): Promise<T> {
  const key = email.trim().toLowerCase();
  const remaining = (requests.get(key) || 0) - Date.now();
  if (remaining > 0)
    throw new Error(
      `Please wait ${Math.ceil(remaining / 1000)} seconds before requesting another email. Check your inbox and spam folder.`,
    );
  requests.set(key, Date.now() + 60000);
  const result = await send();
  if (
    result.error &&
    (result.error.status === 429 ||
      /rate.limit|over_email_send_rate_limit/i.test(
        `${result.error.code} ${result.error.message}`,
      ))
  ) {
    throw new Error(
      "The email service has reached its sending limit. Please try later. If this continues, contact support so the email delivery configuration can be checked.",
    );
  }
  return result;
}
