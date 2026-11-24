import { timingSafeEqual } from "node:crypto";

/** Vercel Cron envía `Authorization: Bearer <CRON_SECRET>`. Sin secreto configurado, solo se permite en desarrollo. */
export function isCronAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}
