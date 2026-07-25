import { z } from "zod";
import {
	paginatedResultSchema,
	paginationQuerySchema,
} from "../http/pagination";
import { billingPlanIdSchema } from "./billing";
import { creditBucketSchema, creditKindSchema } from "./credits";
import { isoDateTimeSchema, uuidSchema } from "./shared/primitives";

// Admin contracts (consumed by apps/admin only). Every route below sits behind
// the AdminGuard: non-admin sessions get 404 (not 403) per docs/api-security.md.

export const adminUserRoles = ["user", "admin"] as const;

export const adminUserRoleSchema = z.enum(adminUserRoles);

export type AdminUserRole = z.infer<typeof adminUserRoleSchema>;

/**
 * Admin check for the stored `user.role` string.
 *
 * Better Auth persists multiple roles comma-joined ("user,admin"), so an exact
 * `role === "admin"` comparison would silently miss a real admin.
 */
export function isAdminRole(role: string | null | undefined): boolean {
	return (role ?? "")
		.split(",")
		.some((value) => value.trim().toLowerCase() === "admin");
}

// "free" is derived (no entitled subscription row), not stored.
export const adminUserPlanSchema = z.union([
	z.literal("free"),
	billingPlanIdSchema,
]);

export type AdminUserPlan = z.infer<typeof adminUserPlanSchema>;

export const adminUserSummarySchema = z.object({
	id: z.string(),
	name: z.string(),
	email: z.email(),
	emailVerified: z.boolean(),
	image: z.string().nullable(),
	role: adminUserRoleSchema,
	banned: z.boolean(),
	createdAt: isoDateTimeSchema,
	// Last authenticated request, refreshed at most every few minutes; null when
	// the user has never been seen since the column was introduced.
	lastSeenAt: isoDateTimeSchema.nullable(),
	plan: adminUserPlanSchema,
	creditsBalance: z.int(),
	projectsCount: z.int(),
});

export type AdminUserSummary = z.infer<typeof adminUserSummarySchema>;

export const adminListUsersSorts = [
	"newest",
	"oldest",
	"name",
	"email",
] as const;

export const adminListUsersQuerySchema = paginationQuerySchema.extend({
	q: z.string().trim().min(1).max(200).optional(),
	sort: z.enum(adminListUsersSorts).default("newest"),
});

export type AdminListUsersQuery = z.infer<typeof adminListUsersQuerySchema>;

export const adminListUsersResponseSchema = paginatedResultSchema(
	adminUserSummarySchema,
);

export type AdminListUsersResponse = z.infer<
	typeof adminListUsersResponseSchema
>;

export const adminUserSubscriptionSchema = z.object({
	plan: billingPlanIdSchema,
	status: z.string(),
	interval: z.enum(["month", "year"]),
	currentPeriodEnd: isoDateTimeSchema.nullable(),
	cancelAtPeriodEnd: z.boolean(),
});

export type AdminUserSubscription = z.infer<typeof adminUserSubscriptionSchema>;

export const adminUserProjectSchema = z.object({
	id: z.string(),
	name: z.string(),
	createdAt: isoDateTimeSchema,
});

export type AdminUserProject = z.infer<typeof adminUserProjectSchema>;

export const adminCreditLedgerEntrySchema = z.object({
	id: uuidSchema,
	delta: z.int(),
	kind: creditKindSchema,
	bucket: creditBucketSchema,
	meta: z.record(z.string(), z.unknown()).nullable(),
	createdAt: isoDateTimeSchema,
});

export type AdminCreditLedgerEntry = z.infer<
	typeof adminCreditLedgerEntrySchema
>;

export const adminUserDetailSchema = adminUserSummarySchema.extend({
	updatedAt: isoDateTimeSchema,
	banReason: z.string().nullable(),
	subscription: adminUserSubscriptionSchema.nullable(),
	projects: z.array(adminUserProjectSchema),
	creditLedger: z.array(adminCreditLedgerEntrySchema),
});

export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>;

export const adminGrantCreditsInputSchema = z.object({
	amount: z.int().positive().max(1_000_000),
	reason: z.string().trim().min(1).max(500).optional(),
	// Client-minted per-submission id. Required, not optional: it becomes the
	// credit ledger idempotency key, so a retried or double-submitted grant
	// must not credit twice.
	requestId: uuidSchema,
});

export type AdminGrantCreditsInput = z.infer<
	typeof adminGrantCreditsInputSchema
>;

export const adminSetRoleInputSchema = z.object({
	role: adminUserRoleSchema,
});

export type AdminSetRoleInput = z.infer<typeof adminSetRoleInputSchema>;

export const adminSetBannedInputSchema = z.object({
	banned: z.boolean(),
	reason: z.string().trim().min(1).max(500).optional(),
});

export type AdminSetBannedInput = z.infer<typeof adminSetBannedInputSchema>;

export const adminSignupStatsRanges = ["7d", "30d", "90d"] as const;

export const adminSignupStatsQuerySchema = z.object({
	range: z.enum(adminSignupStatsRanges).default("30d"),
});

export type AdminSignupStatsQuery = z.infer<typeof adminSignupStatsQuerySchema>;

// One point per UTC day, zero-filled so empty days still chart.
export const adminSignupPointSchema = z.object({
	date: z.iso.date(),
	count: z.int(),
});

export type AdminSignupPoint = z.infer<typeof adminSignupPointSchema>;

export const adminSignupStatsSchema = z.object({
	range: z.enum(adminSignupStatsRanges),
	total: z.int(),
	totalUsers: z.int(),
	points: z.array(adminSignupPointSchema),
});

export type AdminSignupStats = z.infer<typeof adminSignupStatsSchema>;

export const adminRoutes = {
	users: "/api/v1/admin/users",
	user: (userId: string) => `/api/v1/admin/users/${userId}`,
	grantCredits: (userId: string) => `/api/v1/admin/users/${userId}/credits`,
	setRole: (userId: string) => `/api/v1/admin/users/${userId}/role`,
	setBanned: (userId: string) => `/api/v1/admin/users/${userId}/banned`,
	signupStats: "/api/v1/admin/stats/signups",
} as const;
