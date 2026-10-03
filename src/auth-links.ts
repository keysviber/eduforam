export function parseAuthLink(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "educationforum:" ||
    url.hostname !== "auth" ||
    url.pathname !== "/callback"
  )
    return null;
  const params = new URLSearchParams(url.hash.slice(1));
  if (params.get("error") || url.searchParams.get("error")) {
    throw new Error(
      "This authentication link has expired or is invalid. Request a new email.",
    );
  }
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return null;
  return {
    access_token,
    refresh_token,
    recovery: params.get("type") === "recovery",
  };
}
