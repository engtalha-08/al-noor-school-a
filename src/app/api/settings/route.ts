import { db } from "@/db";
import { eq } from "drizzle-orm";
import { schoolSettings } from "@/db/schema";
import { requireUser, requireCap, audit, errorResponse } from "@/lib/auth";

export async function GET() {
  try {
    await requireUser();
    const [row] = await db.select().from(schoolSettings).limit(1);
    const providers = {
      email: Boolean(process.env.SMTP_HOST),
      sms: Boolean(process.env.SMS_API_KEY),
      whatsapp: Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID),
    };
    return Response.json({ settings: row ?? null, providers });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireCap("settings.manage");
    const body = (await req.json()) as Record<string, unknown>;
    const allowed = [
      "name",
      "principalName",
      "principalPhone",
      "domain",
      "address",
      "email",
      "timings",
      "logoUrl",
      "signatory",
      "senderName",
      "lateFeePerDay",
      "notificationsEnabled",
      "testMode",
      "gradingRules",
    ];
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of allowed) if (k in body) patch[k] = body[k];
    const [existing] = await db.select().from(schoolSettings).limit(1);
    if (existing) {
      await db.update(schoolSettings).set(patch).where(eq(schoolSettings.id, existing.id));
    } else {
      await db.insert(schoolSettings).values(patch);
    }
    await audit(user, "settings_update", "school_settings", existing?.id ?? null, Object.keys(patch).join(","));
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
