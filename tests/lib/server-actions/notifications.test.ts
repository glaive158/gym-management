import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import { sendExpirationNotifications } from "@/lib/server-actions/notifications";
import { Role, SubscriptionStatus, TenantStatus, UserStatus, NotificationType, NotificationChannel } from "@prisma/client";

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(),
  buildActivationEmail: vi.fn(),
  buildRejectionEmail: vi.fn(),
}));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsApp: vi.fn(),
}));

async function seedMemberSub(daysToExpire: number) {
  const tenant = await testPrisma.tenant.create({
    data: { name: "T", slug: `t${Date.now()}${Math.random()}`, ownerEmail: "o@x.com", ownerPhone: "1", city: "Dakar", status: TenantStatus.ACTIVE },
  });
  const gym = await testPrisma.gym.create({
    data: { tenantId: tenant.id, name: "G", address: "a", city: "Dakar", phone: "1", latitude: 14.7, longitude: -17.4 },
  });
  const member = await testPrisma.user.create({
    data: {
      name: "M", email: `m${Date.now()}${Math.random()}@x.com`, passwordHash: "x",
      phone: "+221771111111", role: Role.MEMBER, status: UserStatus.ACTIVE, tenantId: tenant.id,
    },
  });
  const plan = await testPrisma.plan.create({
    data: { tenantId: tenant.id, gymId: gym.id, name: "M", durationDays: 30, price: 1000, currency: "XOF" },
  });
  const end = new Date();
  end.setHours(12, 0, 0, 0);
  end.setDate(end.getDate() + daysToExpire);
  const sub = await testPrisma.subscription.create({
    data: {
      tenantId: tenant.id, memberId: member.id, planId: plan.id,
      startDate: new Date(), endDate: end, status: SubscriptionStatus.ACTIVE,
    },
  });
  return { tenant, gym, member, sub };
}

describe("sendExpirationNotifications", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("sends J-7 notif to sub ending in ~7 days", async () => {
    const { sub } = await seedMemberSub(7);
    const r = await sendExpirationNotifications({ prisma: testPrisma });
    expect(r.sent).toBeGreaterThanOrEqual(2);
    const logs = await testPrisma.notificationLog.findMany({ where: { subscriptionId: sub.id } });
    expect(logs.some((l) => l.type === NotificationType.EXPIRATION_J7)).toBe(true);
  });

  it("sends J-3 notif to sub ending in ~3 days", async () => {
    await seedMemberSub(3);
    const r = await sendExpirationNotifications({ prisma: testPrisma });
    expect(r.sent).toBeGreaterThan(0);
    const logs = await testPrisma.notificationLog.findMany();
    expect(logs.some((l) => l.type === NotificationType.EXPIRATION_J3)).toBe(true);
  });

  it("sends J-0 notif to sub ending today", async () => {
    await seedMemberSub(0);
    const r = await sendExpirationNotifications({ prisma: testPrisma });
    expect(r.sent).toBeGreaterThan(0);
    const logs = await testPrisma.notificationLog.findMany();
    expect(logs.some((l) => l.type === NotificationType.EXPIRATION_J0)).toBe(true);
  });

  it("skips already-notified (anti-spam unique)", async () => {
    await seedMemberSub(7);
    await sendExpirationNotifications({ prisma: testPrisma });
    const before = await testPrisma.notificationLog.count();
    await sendExpirationNotifications({ prisma: testPrisma });
    const after = await testPrisma.notificationLog.count();
    expect(after).toBe(before);
  });

  it("skips non-ACTIVE subs", async () => {
    const { sub } = await seedMemberSub(7);
    await testPrisma.subscription.update({ where: { id: sub.id }, data: { status: SubscriptionStatus.CANCELLED } });
    const r = await sendExpirationNotifications({ prisma: testPrisma });
    expect(r.sent).toBe(0);
  });

  it("skips when member has no phone (WhatsApp only)", async () => {
    const { member } = await seedMemberSub(7);
    await testPrisma.user.update({ where: { id: member.id }, data: { phone: null } });
    await sendExpirationNotifications({ prisma: testPrisma });
    const logs = await testPrisma.notificationLog.findMany();
    const channels = logs.map((l) => l.channel);
    expect(channels).toContain(NotificationChannel.EMAIL);
    expect(channels).not.toContain(NotificationChannel.WHATSAPP);
  });
});
