import { createClient } from "npm:@supabase/supabase-js@2";
export const service = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
export async function user(req: Request) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer /i, "");
  if (!token) throw new Error("Sign in first");
  const db = service();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new Error("Invalid session");
  const p = await db
    .from("profiles")
    .select("id,role,suspended")
    .eq("id", data.user.id)
    .single();
  if (p.error || p.data.suspended) throw new Error("Active account required");
  return p.data;
}
export function handler(fn: (r: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return json({ error: "POST required" }, 405);
    try {
      return await fn(req);
    } catch (e) {
      console.error(
        "Service action failed",
        e instanceof Error ? e.message : "Unknown error",
      );
      return json(
        {
          error:
            "The service could not complete this request. Check setup or retry.",
        },
        400,
      );
    }
  });
}
export function requireSecret(req: Request, name: string) {
  const secret = Deno.env.get(name);
  if (!secret || req.headers.get("Authorization") !== `Bearer ${secret}`)
    throw new Error("Unauthorized service caller");
}
export async function provider(url: string, options: RequestInit = {}) {
  const r = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`Provider request failed (${r.status})`);
  return r.json();
}
