import { Role } from "@prisma/client";

export { Role };

export const isPlatformOwner = (role: Role): boolean => role === Role.PLATFORM_OWNER;
export const isTenantAdmin = (role: Role): boolean => role === Role.TENANT_ADMIN;
export const isManager = (role: Role): boolean => role === Role.MANAGER;
export const isMember = (role: Role): boolean => role === Role.MEMBER;

export const TENANT_SCOPED_ROLES: Role[] = [Role.TENANT_ADMIN, Role.MANAGER, Role.MEMBER];

export const requiresTenant = (role: Role): boolean => TENANT_SCOPED_ROLES.includes(role);
