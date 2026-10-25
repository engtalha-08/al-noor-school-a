import { db } from "@/db";
import { desc, eq, ilike, or } from "drizzle-orm";
import { users } from "@/db/schema";
import { requireCap, hashPassword, audit, errorResponse, HttpError } from "@/lib/auth";
import { ROLES } from "@/lib/rbac";

export async function GET(req: Request) {
  try {
    await requireCap("users.manage");
    const q = new URL(req.url).searchParams.get("q")?.trim();
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(q ? or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`)) : undefined)
      .orderBy(desc(users.id))
      .limit(200);
    return Response.json({ rows });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireCap("users.manage");
    const body = (await req.json()) as { name: string; email: string; password: string; role: string; phone?: string };
    if (!body.name || !body.email || !body.password) throw new HttpError(422, "Name, email and password are required");
    if (body.password.length < 8) throw new HttpError(422, "Password must be at least 8 characters");
    if (!ROLES.some((r) => r.value === body.role)) throw new HttpError(422, "Invalid role");
    const email = body.email.toLowerCase().trim();
    const existing = await db.select().from(users).where(eq(users.email, email));
    if (existing.length) throw new HttpError(409, "An account with this email already exists");
    const [row] = await db
      .insert(users)
      .values({ name: body.name, email, phone: body.phone ?? null, role: body.role, passwordHash: await hashPassword(body.password) })
      .returning({ id: users.id, name: users.name, email: users.email, role: users.role, isActive: users.isActive });
    await audit(admin, "user_create", "users", row.id, `role=${row.role}`);
    return Response.json({ row }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = await requireCap("users.manage");
    const body = (await req.json()) as { id: number; role?: string; isActive?: boolean; password?: string; name?: string };
    if (!body.id) throw new HttpError(422, "User id is required");
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (body.role) {
      if (!ROLES.some((r) => r.value === body.role)) throw new HttpError(422, "Invalid role");
      patch.role = body.role;
    }
    if (body.name) patch.name = body.name;
    if (typeof body.isActive === "boolean") {
      if (body.id === admin.id && !body.isActive) throw new HttpError(422, "You cannot deactivate your own account");
      patch.isActive = body.isActive;
    }
    if (body.password) {
      if (body.password.length < 8) throw new HttpError(422, "Password must be at least 8 characters");
      patch.passwordHash = await hashPassword(body.password);
    }
    const [row] = await db.update(users).set(patch).where(eq(users.id, body.id)).returning({ id: users.id });
    if (!row) throw new HttpError(404, "User not found");
    await audit(admin, "user_update", "users", body.id, Object.keys(patch).join(","));
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
