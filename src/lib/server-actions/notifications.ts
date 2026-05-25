import { PrismaClient, NotificationType, NotificationChannel, SubscriptionStatus, Prisma } from "@prisma/client";
import { sendEmail } from "@/lib/email";
import { sendWhatsApp } from "@/lib/whatsapp";

interface SubWithMember {
  id: string;
  tenantId: string;
  endDate: Date;
  member: { id: string; name: string; email: string; phone: string | null };
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

async function findSubsExpiringInDays(prisma: PrismaClient, days: number): Promise<SubWithMember[]> {
  const target = new Date();
  target.setDate(target.getDate() + days);
  return prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.ACTIVE,
      endDate: { gte: startOfDay(target), lte: endOfDay(target) },
    },
    select: {
      id: true,
      tenantId: true,
      endDate: true,
      member: { select: { id: true, name: true, email: true, phone: true } },
    },
  });
}

function buildText(type: NotificationType, name: string, endDate: Date): string {
  const dateStr = endDate.toLocaleDateString("fr-FR");
  if (type === NotificationType.EXPIRATION_J7) return `Bonjour ${name}, votre abonnement expire le ${dateStr} (dans 7 jours). Pensez à renouveler.`;
  if (type === NotificationType.EXPIRATION_J3) return `Bonjour ${name}, votre abonnement expire dans 3 jours (${dateStr}). Renouvelez vite.`;
  return `Bonjour ${name}, votre abonnement expire AUJOURD'HUI (${dateStr}). Renouvelez pour continuer à accéder à la salle.`;
}

async function tryLogged(
  prisma: PrismaClient,
  tenantId: string,
  memberId: string,
  subscriptionId: string,
  type: NotificationType,
  channel: NotificationChannel,
  action: () => Promise<void>
): Promise<boolean> {
  try {
    await prisma.notificationLog.create({
      data: { tenantId, memberId, subscriptionId, type, channel, success: true },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
  try {
    await action();
  } catch (err) {
    await prisma.notificationLog.update({
      where: { subscriptionId_type_channel: { subscriptionId, type, channel } },
      data: { success: false, errorMessage: err instanceof Error ? err.message : String(err) },
    });
  }
  return true;
}

export async function sendExpirationNotifications(input: { prisma: PrismaClient }): Promise<{ sent: number }> {
  const tiers: Array<{ days: number; type: NotificationType }> = [
    { days: 7, type: NotificationType.EXPIRATION_J7 },
    { days: 3, type: NotificationType.EXPIRATION_J3 },
    { days: 0, type: NotificationType.EXPIRATION_J0 },
  ];

  let sent = 0;
  for (const t of tiers) {
    const subs = await findSubsExpiringInDays(input.prisma, t.days);
    for (const s of subs) {
      const text = buildText(t.type, s.member.name, s.endDate);

      const emailSent = await tryLogged(
        input.prisma,
        s.tenantId,
        s.member.id,
        s.id,
        t.type,
        NotificationChannel.EMAIL,
        () => sendEmail({ to: s.member.email, subject: "Expiration de votre abonnement", text, html: `<p>${text}</p>` })
      );
      if (emailSent) sent++;

      if (s.member.phone) {
        const waSent = await tryLogged(
          input.prisma,
          s.tenantId,
          s.member.id,
          s.id,
          t.type,
          NotificationChannel.WHATSAPP,
          () => sendWhatsApp({ to: s.member.phone!, body: text })
        );
        if (waSent) sent++;
      }
    }
  }
  return { sent };
}
