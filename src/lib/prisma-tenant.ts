import { PrismaClient } from "@prisma/client";

const TENANT_SCOPED_MODELS = new Set(["Gym", "User", "Plan", "Subscription"]);

export function tenantPrisma(base: PrismaClient, tenantId: string) {
  return base.$extends({
    name: "tenantScope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_SCOPED_MODELS.has(model)) {
            return query(args);
          }

          const a = args as Record<string, any>;

          switch (operation) {
            case "findUnique":
            case "findUniqueOrThrow":
            case "findFirst":
            case "findFirstOrThrow":
            case "findMany":
            case "count":
            case "aggregate":
            case "groupBy": {
              a.where = { ...(a.where ?? {}), tenantId };
              break;
            }
            case "update":
            case "updateMany":
            case "delete":
            case "deleteMany": {
              a.where = { ...(a.where ?? {}), tenantId };
              break;
            }
            case "create": {
              a.data = { ...(a.data ?? {}), tenantId };
              break;
            }
            case "createMany": {
              if (Array.isArray(a.data)) {
                a.data = a.data.map((row: Record<string, any>) => ({ ...row, tenantId }));
              } else {
                a.data = { ...a.data, tenantId };
              }
              break;
            }
            case "upsert": {
              a.where = { ...(a.where ?? {}), tenantId };
              a.create = { ...(a.create ?? {}), tenantId };
              break;
            }
            default:
              break;
          }

          return query(a);
        },
      },
    },
  });
}

export function platformPrisma(base: PrismaClient) {
  return base;
}

export type TenantPrismaClient = ReturnType<typeof tenantPrisma>;
