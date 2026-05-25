import { PrismaClient, SubscriptionStatus, CheckInStatus } from "@prisma/client";

function monthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

export interface ManagerReport {
  revenueXof: number;
  paymentsCount: number;
  checkInsCount: number;
  activeSubscriptions: number;
  newMembers: number;
}

export async function getManagerReport(input: {
  tenantId: string;
  gymId: string;
  year: number;
  month: number;
  prisma: PrismaClient;
}): Promise<ManagerReport> {
  const { start, end } = monthRange(input.year, input.month);

  const [payments, checkInsCount, activeSubscriptions, newMembers] = await Promise.all([
    input.prisma.payment.aggregate({
      where: { tenantId: input.tenantId, gymId: input.gymId, paidAt: { gte: start, lte: end } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    input.prisma.checkIn.count({
      where: {
        tenantId: input.tenantId,
        gymId: input.gymId,
        status: CheckInStatus.VALID,
        createdAt: { gte: start, lte: end },
      },
    }),
    input.prisma.subscription.count({
      where: { tenantId: input.tenantId, status: SubscriptionStatus.ACTIVE },
    }),
    input.prisma.user.count({
      where: {
        tenantId: input.tenantId,
        gymId: input.gymId,
        role: "MEMBER",
        createdAt: { gte: start, lte: end },
      },
    }),
  ]);

  return {
    revenueXof: payments._sum.amount ?? 0,
    paymentsCount: payments._count._all,
    checkInsCount,
    activeSubscriptions,
    newMembers,
  };
}

export interface TenantReportGymRow {
  gymId: string;
  gymName: string;
  revenueXof: number;
  paymentsCount: number;
  checkInsCount: number;
  membersCount: number;
}

export interface TenantReport {
  revenueXof: number;
  paymentsCount: number;
  checkInsCount: number;
  membersCount: number;
  byGym: TenantReportGymRow[];
}

export async function getTenantReport(input: {
  tenantId: string;
  year: number;
  month: number;
  prisma: PrismaClient;
}): Promise<TenantReport> {
  const { start, end } = monthRange(input.year, input.month);

  const gyms = await input.prisma.gym.findMany({
    where: { tenantId: input.tenantId },
    select: { id: true, name: true },
  });

  const byGym: TenantReportGymRow[] = [];
  let totalRevenue = 0,
    totalPayments = 0,
    totalCheckIns = 0,
    totalMembers = 0;
  for (const g of gyms) {
    const [pay, checks, members] = await Promise.all([
      input.prisma.payment.aggregate({
        where: { tenantId: input.tenantId, gymId: g.id, paidAt: { gte: start, lte: end } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      input.prisma.checkIn.count({
        where: {
          tenantId: input.tenantId,
          gymId: g.id,
          status: CheckInStatus.VALID,
          createdAt: { gte: start, lte: end },
        },
      }),
      input.prisma.user.count({
        where: { tenantId: input.tenantId, gymId: g.id, role: "MEMBER" },
      }),
    ]);
    const revenue = pay._sum.amount ?? 0;
    const payCount = pay._count._all;
    byGym.push({
      gymId: g.id,
      gymName: g.name,
      revenueXof: revenue,
      paymentsCount: payCount,
      checkInsCount: checks,
      membersCount: members,
    });
    totalRevenue += revenue;
    totalPayments += payCount;
    totalCheckIns += checks;
    totalMembers += members;
  }

  byGym.sort((a, b) => b.revenueXof - a.revenueXof);

  return {
    revenueXof: totalRevenue,
    paymentsCount: totalPayments,
    checkInsCount: totalCheckIns,
    membersCount: totalMembers,
    byGym,
  };
}
