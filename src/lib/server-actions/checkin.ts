import { PrismaClient, CheckInStatus, SubscriptionStatus } from "@prisma/client";
import { haversineMeters } from "@/lib/geo";
import { pusherTrigger } from "@/lib/pusher-server";

const GEOFENCE_METERS = 100;

export interface PerformCheckInInput {
  memberId: string;
  qrToken: string;
  latitude: number;
  longitude: number;
  prisma: PrismaClient;
}

export interface CheckInResult {
  status?: CheckInStatus;
  error?: "INVALID_QR" | "WRONG_TENANT";
  memberName?: string;
  expiresAt?: Date | null;
  distanceMeters?: number;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function triggerLive(prisma: PrismaClient, checkInId: string): Promise<void> {
  const row = await prisma.checkIn.findUnique({
    where: { id: checkInId },
    include: { member: true, subscription: true },
  });
  if (!row) return;
  await pusherTrigger(`private-gym-${row.gymId}`, "checkin", {
    checkInId: row.id,
    memberId: row.memberId,
    memberName: row.member.name,
    memberAvatar: row.member.avatar,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.subscription?.endDate.toISOString() ?? null,
    source: row.source,
  });
}

export async function performCheckIn(input: PerformCheckInInput): Promise<CheckInResult> {
  const gym = await input.prisma.gym.findUnique({ where: { qrToken: input.qrToken } });
  if (!gym) return { error: "INVALID_QR" };

  const member = await input.prisma.user.findUnique({ where: { id: input.memberId } });
  if (!member || member.tenantId !== gym.tenantId) return { error: "WRONG_TENANT" };

  const distance = haversineMeters(input.latitude, input.longitude, gym.latitude, gym.longitude);

  if (distance > GEOFENCE_METERS) {
    const row = await input.prisma.checkIn.create({
      data: {
        tenantId: gym.tenantId, gymId: gym.id, memberId: member.id,
        status: CheckInStatus.GEO_REJECTED,
        latitude: input.latitude, longitude: input.longitude, distanceMeters: distance,
        source: "QR",
      },
    });
    return { status: row.status, distanceMeters: distance };
  }

  const today = startOfToday();
  const dup = await input.prisma.checkIn.findFirst({
    where: { memberId: member.id, status: CheckInStatus.VALID, createdAt: { gte: today } },
  });
  if (dup) {
    const row = await input.prisma.checkIn.create({
      data: {
        tenantId: gym.tenantId, gymId: gym.id, memberId: member.id,
        status: CheckInStatus.DUPLICATE,
        latitude: input.latitude, longitude: input.longitude, distanceMeters: distance,
        source: "QR",
      },
    });
    await triggerLive(input.prisma, row.id);
    return { status: row.status, memberName: member.name };
  }

  const sub = await input.prisma.subscription.findFirst({
    where: { memberId: member.id, status: SubscriptionStatus.ACTIVE, endDate: { gte: new Date() } },
    orderBy: { endDate: "desc" },
  });

  let status: CheckInStatus;
  if (!sub) {
    const anySub = await input.prisma.subscription.findFirst({
      where: { memberId: member.id },
      orderBy: { endDate: "desc" },
    });
    status = anySub ? CheckInStatus.EXPIRED : CheckInStatus.NO_SUBSCRIPTION;
  } else {
    status = CheckInStatus.VALID;
  }

  const row = await input.prisma.checkIn.create({
    data: {
      tenantId: gym.tenantId, gymId: gym.id, memberId: member.id, subscriptionId: sub?.id,
      status,
      latitude: input.latitude, longitude: input.longitude, distanceMeters: distance,
      source: "QR",
    },
  });
  await triggerLive(input.prisma, row.id);
  return { status, memberName: member.name, expiresAt: sub?.endDate ?? null };
}

export async function manualCheckIn(input: { gymId: string; memberId: string; prisma: PrismaClient }): Promise<CheckInResult> {
  const gym = await input.prisma.gym.findUnique({ where: { id: input.gymId } });
  if (!gym) return { error: "INVALID_QR" };
  const member = await input.prisma.user.findUnique({ where: { id: input.memberId } });
  if (!member || member.tenantId !== gym.tenantId) return { error: "WRONG_TENANT" };

  const today = startOfToday();
  const dup = await input.prisma.checkIn.findFirst({
    where: { memberId: member.id, status: CheckInStatus.VALID, createdAt: { gte: today } },
  });
  if (dup) {
    const row = await input.prisma.checkIn.create({
      data: { tenantId: gym.tenantId, gymId: gym.id, memberId: member.id, status: CheckInStatus.DUPLICATE, source: "MANUAL" },
    });
    await triggerLive(input.prisma, row.id);
    return { status: row.status, memberName: member.name };
  }

  const sub = await input.prisma.subscription.findFirst({
    where: { memberId: member.id, status: SubscriptionStatus.ACTIVE, endDate: { gte: new Date() } },
    orderBy: { endDate: "desc" },
  });
  let status: CheckInStatus;
  if (!sub) {
    const anySub = await input.prisma.subscription.findFirst({ where: { memberId: member.id }, orderBy: { endDate: "desc" } });
    status = anySub ? CheckInStatus.EXPIRED : CheckInStatus.NO_SUBSCRIPTION;
  } else {
    status = CheckInStatus.VALID;
  }

  const row = await input.prisma.checkIn.create({
    data: { tenantId: gym.tenantId, gymId: gym.id, memberId: member.id, subscriptionId: sub?.id, status, source: "MANUAL" },
  });
  await triggerLive(input.prisma, row.id);
  return { status, memberName: member.name, expiresAt: sub?.endDate ?? null };
}

export async function listRecentCheckIns(input: { gymId: string; limit: number; prisma: PrismaClient }) {
  return input.prisma.checkIn.findMany({
    where: { gymId: input.gymId },
    orderBy: { createdAt: "desc" },
    take: input.limit,
    include: { member: true, subscription: true },
  });
}
