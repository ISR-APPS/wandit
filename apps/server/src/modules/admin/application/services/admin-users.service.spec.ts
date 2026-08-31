import {
	type AdminUserPagesQuery,
	type AdminUserProjectsQuery,
	adminUserPagesResponseSchema,
	adminUserProjectsResponseSchema,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { describe, expect, it, vi } from "vitest";
import type { CreditsService } from "../../../credits/application/services/credits.service";
import type {
	AdminProjectRow,
	AdminRepository,
	AdminUserDetailRow,
	AdminUserPageRow,
} from "../../infrastructure/persistence/admin.repository";
import type { AdminOrganizationsRepository } from "../../infrastructure/persistence/admin-organizations.repository";
import { AdminUsersService } from "./admin-users.service";

const QUERY = {
	page: 1,
	pageSize: 10,
	sort: "recently_updated",
} satisfies AdminUserPagesQuery;

const PROJECT_CREATED_AT = new Date("2026-07-01T10:00:00.000Z");
const PROJECT_UPDATED_AT = new Date("2026-08-07T12:00:00.000Z");
const VERSION_CREATED_AT = new Date("2026-08-07T11:00:00.000Z");
const GENERATION_CREATED_AT = new Date("2026-08-07T10:55:00.000Z");
const GENERATION_COMPLETED_AT = new Date("2026-08-07T11:00:00.000Z");
const PUBLISHED_AT = new Date("2026-08-07T11:30:00.000Z");

function pageRow(overrides: Partial<AdminUserPageRow> = {}): AdminUserPageRow {
	return {
		projectId: "11111111-1111-4111-8111-111111111111",
		projectName: "Launch page",
		organizationId: null,
		previewImageUrl: "https://assets.example/preview.png",
		projectCreatedAt: PROJECT_CREATED_AT,
		projectUpdatedAt: PROJECT_UPDATED_AT,
		activeVersionId: "22222222-2222-4222-8222-222222222222",
		activeVersionNumber: 3,
		activeVersionCreatedAt: VERSION_CREATED_AT,
		latestGenerationStatus: "succeeded",
		latestGenerationCreatedAt: GENERATION_CREATED_AT,
		latestGenerationCompletedAt: GENERATION_COMPLETED_AT,
		activeDeploymentSlug: "launch",
		activeDeploymentUpdatedAt: PUBLISHED_AT,
		latestDeploymentStatus: "active",
		primaryDomainName: "launch.example",
		primaryDomainStatus: "active",
		...overrides,
	};
}

function setup(row: AdminUserPageRow) {
	const adminRepository = {
		listUserPages: vi.fn().mockResolvedValue({
			items: [row],
			page: QUERY.page,
			pageSize: QUERY.pageSize,
			total: 1,
		}),
	};
	const service = new AdminUsersService(
		adminRepository as unknown as AdminRepository,
		{} as AdminOrganizationsRepository,
		{} as CreditsService,
	);

	return { adminRepository, service };
}

function setupProjects() {
	const row: AdminProjectRow = {
		id: "project-1",
		name: "Launch page",
		createdAt: PROJECT_CREATED_AT,
	};
	const adminRepository = {
		listUserProjects: vi.fn().mockResolvedValue([row]),
		countUserProjects: vi.fn().mockResolvedValue(243),
	};
	const service = new AdminUsersService(
		adminRepository as unknown as AdminRepository,
		{} as AdminOrganizationsRepository,
		{} as CreditsService,
	);

	return { adminRepository, service };
}

describe("AdminUsersService.listUserProjects", () => {
	it("maps newest pagination to a descending repository window", async () => {
		const query = {
			page: 3,
			pageSize: 10,
			sort: "newest",
		} satisfies AdminUserProjectsQuery;
		const { adminRepository, service } = setupProjects();

		const result = await service.listUserProjects("user-1", query);

		expect(adminRepository.listUserProjects).toHaveBeenCalledWith("user-1", {
			limit: 10,
			offset: 20,
			order: "desc",
		});
		expect(adminRepository.countUserProjects).toHaveBeenCalledWith("user-1");
		expect(result).toEqual({
			items: [
				{
					id: "project-1",
					name: "Launch page",
					createdAt: PROJECT_CREATED_AT.toISOString(),
				},
			],
			page: 3,
			pageSize: 10,
			total: 243,
		});
		expect(() => adminUserProjectsResponseSchema.parse(result)).not.toThrow();
	});

	it("maps oldest pagination to an ascending repository window", async () => {
		const query = {
			page: 2,
			pageSize: 25,
			sort: "oldest",
		} satisfies AdminUserProjectsQuery;
		const { adminRepository, service } = setupProjects();

		await service.listUserProjects("user-1", query);

		expect(adminRepository.listUserProjects).toHaveBeenCalledWith("user-1", {
			limit: 25,
			offset: 25,
			order: "asc",
		});
	});
});

describe("AdminUsersService.listUserPages", () => {
	it("derives the canonical live URL and prefers the www custom domain for a published page", async () => {
		const { adminRepository, service } = setup(pageRow());

		const result = await service.listUserPages("user-1", QUERY);

		expect(adminRepository.listUserPages).toHaveBeenCalledWith("user-1", QUERY);
		expect(result.items[0]).toMatchObject({
			project: {
				updatedAt: PROJECT_UPDATED_AT.toISOString(),
			},
			deployment: {
				published: true,
				latestStatus: "active",
				slug: "launch",
				liveUrl: `https://launch.${env.SITES_DOMAIN}`,
				publicUrl: "https://www.launch.example",
				publishedAt: PUBLISHED_AT.toISOString(),
			},
			primaryDomain: {
				name: "launch.example",
				status: "active",
			},
		});
		expect(() => adminUserPagesResponseSchema.parse(result)).not.toThrow();
	});

	it("normalizes a string activity timestamp returned for the raw SQL expression", async () => {
		const { service } = setup(
			pageRow({ projectUpdatedAt: "2026-08-07 12:00:00+00" }),
		);

		const result = await service.listUserPages("user-1", QUERY);

		expect(result.items[0]?.project.updatedAt).toBe(
			PROJECT_UPDATED_AT.toISOString(),
		);
		expect(() => adminUserPagesResponseSchema.parse(result)).not.toThrow();
	});

	it("returns null publication fields and published=false when no active deployment exists", async () => {
		const { service } = setup(
			pageRow({
				activeDeploymentSlug: null,
				activeDeploymentUpdatedAt: null,
				latestDeploymentStatus: null,
				primaryDomainName: null,
				primaryDomainStatus: null,
			}),
		);

		const result = await service.listUserPages("user-1", QUERY);

		expect(result.items[0]?.deployment).toEqual({
			published: false,
			latestStatus: null,
			slug: null,
			liveUrl: null,
			publicUrl: null,
			publishedAt: null,
		});
		expect(result.items[0]?.primaryDomain).toBeNull();
		expect(() => adminUserPagesResponseSchema.parse(result)).not.toThrow();
	});

	it("surfaces a failed newest deployment without treating the page as published", async () => {
		const { service } = setup(
			pageRow({
				activeDeploymentSlug: null,
				activeDeploymentUpdatedAt: null,
				latestDeploymentStatus: "failed",
				primaryDomainName: null,
				primaryDomainStatus: null,
			}),
		);

		const result = await service.listUserPages("user-1", QUERY);

		expect(result.items[0]?.deployment).toMatchObject({
			published: false,
			latestStatus: "failed",
			liveUrl: null,
			publicUrl: null,
		});
		expect(() => adminUserPagesResponseSchema.parse(result)).not.toThrow();
	});
});

describe("AdminUsersService.getUserDetail", () => {
	const USER_ID = "user_1";
	const TX = { kind: "repeatable-read-tx" };

	function setupDetail(detailRow: AdminUserDetailRow | null) {
		const adminRepository = {
			findLatestSubscription: vi.fn().mockResolvedValue(null),
			findUserDetail: vi.fn().mockResolvedValue(detailRow),
			listRecentCreditLedger: vi.fn().mockResolvedValue([]),
			listRecentProjects: vi.fn().mockResolvedValue([]),
			readTransaction: vi.fn(async (fn: (tx: typeof TX) => Promise<unknown>) =>
				fn(TX),
			),
			sumAiSpendForUser: vi
				.fn()
				.mockResolvedValue({ meteredOperations: 0, totalCostUsdMicros: 0 }),
		};
		const adminOrganizationsRepository = {
			listUserMemberships: vi.fn().mockResolvedValue([]),
		};
		const service = new AdminUsersService(
			adminRepository as unknown as AdminRepository,
			adminOrganizationsRepository as unknown as AdminOrganizationsRepository,
			{} as CreditsService,
		);

		return { adminOrganizationsRepository, adminRepository, service };
	}

	it("runs every read inside ONE read transaction and hands each the tx client", async () => {
		const { adminOrganizationsRepository, adminRepository, service } =
			setupDetail({
				banReason: null,
				banned: false,
				createdAt: PROJECT_CREATED_AT,
				creditsBalance: 1_250,
				creditsConsumed: 300,
				countryCode: null,
				email: "zack@example.com",
				emailVerified: true,
				id: USER_ID,
				image: null,
				lastSeenAt: null,
				name: "Zack",
				phone: null,
				plan: null,
				projectsCount: 2,
				role: "user",
				updatedAt: PROJECT_UPDATED_AT,
			});

		const detail = await service.getUserDetail(USER_ID);

		expect(detail).toMatchObject({ creditsBalance: 12.5, id: USER_ID });
		expect(adminRepository.readTransaction).toHaveBeenCalledTimes(1);
		expect(adminRepository.findUserDetail).toHaveBeenCalledWith(USER_ID, TX);
		expect(adminRepository.findLatestSubscription).toHaveBeenCalledWith(
			USER_ID,
			TX,
		);
		expect(adminRepository.listRecentProjects).toHaveBeenCalledWith(
			USER_ID,
			expect.any(Number),
			TX,
		);
		expect(adminRepository.listRecentCreditLedger).toHaveBeenCalledWith(
			USER_ID,
			expect.any(Number),
			TX,
		);
		expect(adminRepository.sumAiSpendForUser).toHaveBeenCalledWith(USER_ID, TX);
		expect(
			adminOrganizationsRepository.listUserMemberships,
		).toHaveBeenCalledWith(USER_ID, TX);
	});

	it("404s inside the transaction before the dependent reads run", async () => {
		const { adminRepository, service } = setupDetail(null);

		await expect(service.getUserDetail(USER_ID)).rejects.toMatchObject({
			status: 404,
		});
		expect(adminRepository.findLatestSubscription).not.toHaveBeenCalled();
	});
});

describe("AdminUsersService.setBanned", () => {
	it.each([
		"support",
		"user,support",
		"admin",
	])("refuses to ban a staff account stored as %s", async (role) => {
		const adminRepository = {
			deleteUserSessions: vi.fn(),
			findUserAccess: vi.fn().mockResolvedValue({ id: "target-1", role }),
			setUserBanned: vi.fn(),
		};
		const service = new AdminUsersService(
			adminRepository as unknown as AdminRepository,
			{} as AdminOrganizationsRepository,
			{} as CreditsService,
		);

		await expect(
			service.setBanned("admin-1", "target-1", { banned: true }),
		).rejects.toThrow("Staff accounts cannot be banned");
		expect(adminRepository.setUserBanned).not.toHaveBeenCalled();
		expect(adminRepository.deleteUserSessions).not.toHaveBeenCalled();
	});
});
