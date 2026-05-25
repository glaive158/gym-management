import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import { performCheckIn, manualCheckIn, listRecentCheckIns } from "@/lib/server-actions/checkin";
import { Role, SubscriptionStatus, TenantStatus, UserStatus, CheckInStatus } from "@prisma/client";

vi.mock("@/lib/pusher-server", () => ({
  pusherTrigger: vi.fn(),
  pusherAuthorize: vi.fn(),
}));

const DAKAR = { lat: 14.6928, lng: -17.4467 };
const FAR = { lat: 14.8, lng: -17.4467 };

async function seedTGM(opts: { gymLat?: number; gymLng?: number } = {}) {
  const tenant = await testPrisma.tenant.create({
    data: { name: "T", slug: `t${Date.now()}${Math.random()}`, ownerEmail: "o@x.com", ownerPhone: "1", city: "Dakar", status: TenantStatus.ACTIVE },
  });
  const gym = await testPrisma.gym.create({
    data: { tenantId: tenant.id, name: "G", address: "a", city: "Dakar", phone: "1", latitude: opts.gymLat ?? DAKAR.lat, longitude: opts.gymLng ?? DAKAR.lng },
  });
  const member = await testPrisma.user.create({
    data: { name: "M", email: `m${Date.now()}${Math.random()}@x.com`, passwordHash: "x", avatar: "/a.jpg", role: Role.MEMBER, status: UserStatus.ACTIVE, tenantId: tenant.id },
  });
  return { tenant, gym, member };
}

async function seedActiveSub(tenantId: string, gymId: string, memberId: string) {
  const plan = await testPrisma.plan.create({
    data: { tenantId, gymId, name: "M", durationDays: 30, price: 1000, currency: "XOF" },
  });
  return testPrisma.subscription.create({
    data: {
      tenantId, memberId, planId: plan.id,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 86400000),
      status: SubscriptionStatus.ACTIVE,
    },
  });
}

describe("performCheckIn", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("VALID when sub active + geo within 100m", async () => {
    const { gym, member } = await seedTGM();
    await seedActiveSub(member.tenantId!, gym.id, member.id);
    const r = await performCheckIn({ memberId: member.id, qrToken: gym.qrToken, latitude: DAKAR.lat, longitude: DAKAR.lng, prisma: testPrisma });
    expect(r.status).toBe(CheckInStatus.VALID);
    const rows = await testPrisma.checkIn.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe(CheckInStatus.VALID);
  });

  it("GEO_REJECTED when >100m", async () => {
    const { gym, member } = await seedTGM();
    await seedActiveSub(member.tenantId!, gym.id, member.id);
    const r = await performCheckIn({ memberId: member.id, qrToken: gym.qrToken, latitude: FAR.lat, longitude: FAR.lng, prisma: testPrisma });
    expect(r.status).toBe(CheckInStatus.GEO_REJECTED);
    expect(r.distanceMeters).toBeGreaterThan(100);
  });

  it("NO_SUBSCRIPTION when no active sub", async () => {
    const { gym, member } = await seedTGM();
    const r = await performCheckIn({ memberId: member.id, qrToken: gym.qrToken, latitude: DAKAR.lat, longitude: DAKAR.lng, prisma: testPrisma });
    expect(r.status).toBe(CheckInStatus.NO_SUBSCRIPTION);
  });

  it("EXPIRED when sub end past", async () => {
    const { tenant, gym, member } = await seedTGM();
    const plan = await testPrisma.plan.create({ data: { tenantId: tenant.id, gymId: gym.id, name: "M", durationDays: 30, price: 1000, currency: "XOF" } });
    await testPrisma.subscription.create({
      data: { tenantId: tenant.id, memberId: member.id, planId: plan.id, startDate: new Date(Date.now() - 60 * 86400000), endDate: new Date(Date.now() - 86400000), status: SubscriptionStatus.EXPIRED },
    });
    const r = await performCheckIn({ memberId: member.id, qrToken: gym.qrToken, latitude: DAKAR.lat, longitude: DAKAR.lng, prisma: testPrisma });
    expect(r.status).toBe(CheckInStatus.EXPIRED);
  });

  it("DUPLICATE when already VALID today", async () => {
    const { gym, member } = await seedTGM();
    await seedActiveSub(member.tenantId!, gym.id, member.id);
    const r1 = await performCheckIn({ memberId: member.id, qrToken: gym.qrToken, latitude: DAKAR.lat, longitude: DAKAR.lng, prisma: testPrisma });
    expect(r1.status).toBe(CheckInStatus.VALID);
    const r2 = await performCheckIn({ memberId: member.id, qrToken: gym.qrToken, latitude: DAKAR.lat, longitude: DAKAR.lng, prisma: testPrisma });
    expect(r2.status).toBe(CheckInStatus.DUPLICATE);
  });

  it("WRONG_TENANT when member tenant differs from gym tenant", async () => {
    const a = await seedTGM();
    const b = await seedTGM();
    const r = await performCheckIn({ memberId: a.member.id, qrToken: b.gym.qrToken, latitude: DAKAR.lat, longitude: DAKAR.lng, prisma: testPrisma });
    expect(r.error).toBe("WRONG_TENANT");
  });

  it("INVALID_QR when qrToken unknown", async () => {
    const { member } = await seedTGM();
    const r = await performCheckIn({ memberId: member.id, qrToken: "nope", latitude: DAKAR.lat, longitude: DAKAR.lng, prisma: testPrisma });
    expect(r.error).toBe("INVALID_QR");
  });
});

describe("manualCheckIn", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("creates CheckIn with source=MANUAL and no geoloc", async () => {
    const { gym, member } = await seedTGM();
    await seedActiveSub(member.tenantId!, gym.id, member.id);
    const r = await manualCheckIn({ gymId: gym.id, memberId: member.id, prisma: testPrisma });
    expect(r.status).toBe(CheckInStatus.VALID);
    const row = await testPrisma.checkIn.findFirstOrThrow();
    expect(row.source).toBe("MANUAL");
    expect(row.latitude).toBeNull();
  });

  it("manual VALID still hits DUPLICATE rule", async () => {
    const { gym, member } = await seedTGM();
    await seedActiveSub(member.tenantId!, gym.id, member.id);
    await manualCheckIn({ gymId: gym.id, memberId: member.id, prisma: testPrisma });
    const r = await manualCheckIn({ gymId: gym.id, memberId: member.id, prisma: testPrisma });
    expect(r.status).toBe(CheckInStatus.DUPLICATE);
  });
});

describe("listRecentCheckIns", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("returns most recent first, limited", async () => {
    const { gym, member } = await seedTGM();
    await seedActiveSub(member.tenantId!, gym.id, member.id);
    await manualCheckIn({ gymId: gym.id, memberId: member.id, prisma: testPrisma });
    const list = await listRecentCheckIns({ gymId: gym.id, limit: 10, prisma: testPrisma });
    expect(list).toHaveLength(1);
    expect(list[0].member.name).toBe("M");
  });
});
