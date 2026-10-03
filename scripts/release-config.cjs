function validateReleaseEnvironment(env) {
  const required = [
    "EXPO_PUBLIC_SUPABASE_URL",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  ];
  for (const name of required) {
    if (!env[name]?.trim())
      throw new Error(
        `Production release requires ${name}; demo fallback is forbidden.`,
      );
  }
  for (const name of [
    "EXPO_PUBLIC_PRIVACY_URL",
    "EXPO_PUBLIC_TERMS_URL",
    "EXPO_PUBLIC_SUPPORT_URL",
    "EXPO_PUBLIC_ACCOUNT_DELETION_URL",
  ]) {
    let value;
    try {
      value = new URL(env[name]);
    } catch {
      throw new Error(
        `Production release requires ${name} pointing to your published page.`,
      );
    }
    if (value.protocol !== "https:" || value.hostname === "example.com") {
      throw new Error(`${name} must use your published HTTPS page.`);
    }
  }
  let url;
  try {
    url = new URL(env.EXPO_PUBLIC_SUPABASE_URL);
  } catch {
    throw new Error("Production Supabase URL must be a valid HTTPS URL.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    ["localhost", "127.0.0.1", "example.com"].includes(url.hostname)
  ) {
    throw new Error(
      "Production Supabase URL must point to your hosted HTTPS backend.",
    );
  }
  const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (key.startsWith("sb_publishable_") && key.length > 20) return;
  try {
    const payload = JSON.parse(
      Buffer.from(key.split(".")[1], "base64url").toString(),
    );
    if (payload.role === "anon") return;
  } catch {}
  throw new Error(
    "Use a Supabase public anon or publishable key, never a service-role or secret key.",
  );
}
module.exports = { validateReleaseEnvironment };
