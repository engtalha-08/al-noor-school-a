import { db } from "@/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  announcements,
  messageDeliveries,
  guardians,
  studentGuardians,
  students,
  staff,
  notifications,
  schoolSettings,
} from "@/db/schema";
import { requireCap, audit, errorResponse, HttpError } from "@/lib/auth";

type Recipient = { type: "guardian" | "staff" | "student"; id: number; name: string; ref: string; userId: number | null };

async function resolveRecipients(audience: string, classId: number | null): Promise<Recipient[]> {
  if (audience === "staff") {
    const rows = await db.select().from(staff).where(eq(staff.status, "active"));
    return rows.map((s) => ({ type: "staff", id: s.id, name: s.fullName, ref: maskPhone(s.phone), userId: s.userId }));
  }
  if (audience === "students") {
    const rows = await db.select().from(students).where(eq(students.status, "active"));
    return rows.map((s) => ({ type: "student", id: s.id, name: s.fullName, ref: s.admissionNo, userId: s.userId }));
  }
  // parents / class / all → guardians of matching students
  const rows = await db
    .select({ g: guardians, studentId: students.id })
    .from(studentGuardians)
    .innerJoin(guardians, eq(guardians.id, studentGuardians.guardianId))
    .innerJoin(students, eq(students.id, studentGuardians.studentId))
    .where(
      and(
        eq(students.status, "active"),
        eq(studentGuardians.verified, true),
        classId ? eq(students.classId, classId) : undefined,
      ),
    );
  const seen = new Set<number>();
  const out: Recipient[] = [];
  for (const r of rows) {
    if (seen.has(r.g.id)) continue;
    seen.add(r.g.id);
    out.push({ type: "guardian", id: r.g.id, name: r.g.fullName, ref: maskPhone(r.g.phone), userId: r.g.userId });
  }
  return out;
}

function maskPhone(p: string | null) {
  if (!p) return "—";
  return p.length > 4 ? `${p.slice(0, 4)}****${p.slice(-2)}` : "****";
}

export async function GET() {
  try {
    await requireCap("announcements.read");
    const rows = await db.select().from(announcements).orderBy(desc(announcements.id)).limit(100);
    const stats = await db
      .select({
        announcementId: messageDeliveries.announcementId,
        status: messageDeliveries.status,
        count: sql<number>`count(*)::int`,
      })
      .from(messageDeliveries)
      .groupBy(messageDeliveries.announcementId, messageDeliveries.status);
    return Response.json({ rows, stats });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireCap("announcements.write");
    const body = (await req.json()) as {
      action: "preview" | "send";
      title: string;
      body: string;
      category?: string;
      audience: string;
      classId?: number | null;
      channel: string;
    };
    const classId = body.classId ? Number(body.classId) : null;
    const recipients = await resolveRecipients(body.audience, body.audience === "class" ? classId : null);

    if (body.action === "preview") {
      return Response.json({
        recipientCount: recipients.length,
        sample: recipients.slice(0, 8).map((r) => ({ name: r.name, ref: r.ref, type: r.type })),
      });
    }

    if (!body.title?.trim() || !body.body?.trim()) throw new HttpError(422, "Title and message body are required");
    if (!recipients.length) throw new HttpError(422, "No recipients match the selected audience");

    const [settings] = await db.select().from(schoolSettings).limit(1);
    const channel = body.channel || "in-app";

    const providerConfigured: Record<string, boolean> = {
      "in-app": true,
      email: Boolean(process.env.SMTP_HOST && settings?.notificationsEnabled),
      sms: Boolean(process.env.SMS_API_KEY && settings?.notificationsEnabled),
      whatsapp: Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID && settings?.notificationsEnabled),
    };
    const configured = providerConfigured[channel] ?? false;
    const testMode = settings?.testMode ?? true;

    const [ann] = await db
      .insert(announcements)
      .values({
        title: body.title.trim(),
        body: body.body.trim(),
        category: body.category ?? "general",
        audience: body.audience,
        classId,
        channel,
        status: channel === "in-app" ? "sent" : configured && !testMode ? "queued" : "failed",
        sentAt: channel === "in-app" ? new Date() : null,
        createdBy: user.id,
      })
      .returning();

    const deliveryRows = recipients.map((r) => ({
      announcementId: ann.id,
      recipientType: r.type,
      recipientId: r.id,
      recipientRef: r.ref,
      channel,
      status: channel === "in-app" ? (r.userId ? "delivered" : "skipped") : configured && !testMode ? "pending" : "skipped",
      error:
        channel === "in-app"
          ? r.userId
            ? null
            : "Recipient has no portal account"
          : !configured
            ? `${channel.toUpperCase()} provider is not configured — nothing was sent`
            : testMode
              ? "School is in test mode — production messaging is disabled"
              : null,
    }));
    await db.insert(messageDeliveries).values(deliveryRows);

    // In-app notifications are genuinely delivered inside this system.
    const userIds = recipients.map((r) => r.userId).filter((x): x is number => Boolean(x));
    if (channel === "in-app" && userIds.length) {
      await db.insert(notifications).values(
        userIds.map((uid) => ({
          userId: uid,
          title: ann.title,
          body: ann.body,
          link: "/announcements",
        })),
      );
    }

    await audit(user, "announcement_send", "announcements", ann.id, `${channel} → ${recipients.length} recipients`);

    const delivered = deliveryRows.filter((d) => d.status === "delivered").length;
    const skipped = deliveryRows.filter((d) => d.status === "skipped").length;
    const pending = deliveryRows.filter((d) => d.status === "pending").length;
    return Response.json(
      {
        announcement: ann,
        delivered,
        skipped,
        pending,
        note:
          channel === "in-app"
            ? `${delivered} in-app notifications delivered, ${skipped} recipients have no portal account.`
            : configured && !testMode
              ? `${pending} messages queued with the configured ${channel} provider. Delivery will be confirmed by provider callbacks.`
              : `Nothing was sent. The ${channel} channel is not configured or the school is in test mode (see System Settings).`,
      },
      { status: 201 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
