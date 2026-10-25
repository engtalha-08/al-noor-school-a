import { cookies } from "next/headers";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { can } from "@/lib/rbac";

const SECRET = process.env.AUTH_SECRET ?? "alnoor-dev-secret-change-in-production";
const COOKIE = "alnoor_session";
const MAX_AGE = 60 * 60 * 12;

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: string;
};

function sign(payload: string) {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function createToken(user: SessionUser) {
  const body = Buffer.from(
    JSON.stringify({ ...user, exp: Date.now() + MAX_AGE * 1000 }),
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyToken(token: string | undefined): (SessionUser & { exp: number }) | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if (sign(body) !== sig) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString());
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export async function setSession(user: SessionUser) {
  const jar = await cookies();
  jar.set(COOKIE, createToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const data = verifyToken(jar.get(COOKIE)?.value);
  if (!data) return null;
  return { id: data.id, name: data.name, email: data.email, role: data.role };
}

/** Throws a Response-friendly error when unauthenticated. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Authentication required");
  return user;
}

export async function requireCap(cap: string): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, cap)) throw new HttpError(403, "You are not authorised to perform this action");
  return user;
}

export async function verifyLogin(email: string, password: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
  if (!user || !user.isActive) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function audit(
  user: SessionUser | null,
  action: string,
  entity: string,
  entityId?: string | number | null,
  details?: string,
) {
  await db.insert(auditLogs).values({
    userId: user?.id ?? null,
    userName: user?.name ?? "system",
    role: user?.role ?? null,
    action,
    entity,
    entityId: entityId != null ? String(entityId) : null,
    details: details ?? null,
  });
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) {
    return Response.json({ error: e.message }, { status: e.status });
  }
  console.error(e);
  const message = e instanceof Error ? e.message : "Unexpected server error";
  return Response.json({ error: message }, { status: 400 });
}
