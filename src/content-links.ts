const configured = process.env.EXPO_PUBLIC_SHARE_BASE_URL;
export function contentLink(kind: "join" | "video", id: string) {
  let base = "educationforum://open";
  if (configured) {
    try {
      const u = new URL(configured);
      if (u.protocol === "https:" && !/^(localhost|127\.)/.test(u.hostname))
        base = u.origin + u.pathname;
    } catch {}
  }
  return `${base}?${kind}=${encodeURIComponent(id)}`;
}
export function parseContentLink(value: string) {
  try {
    const u = new URL(value);
    if (
      u.protocol !== "educationforum:" &&
      u.protocol !== "https:" &&
      u.protocol !== "http:"
    )
      return null;
    const join = u.searchParams.get("join"),
      video = u.searchParams.get("video");
    if (join && /^[a-f0-9]{32}$/i.test(join))
      return { kind: "join" as const, id: join.toLowerCase() };
    if (video && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(video))
      return { kind: "video" as const, id: video };
    return null;
  } catch {
    return null;
  }
}
