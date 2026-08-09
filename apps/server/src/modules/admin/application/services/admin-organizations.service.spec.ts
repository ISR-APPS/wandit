import { NotFoundException } from "@nestjs/common";
import type { CreditBucket } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import type { CreditsService } from "../../../credits/application/services/credits.service";
import type { CreditOwner } from "../../../credits/domain/credit-owner";
import type {
	AdminOrganizationMemberRow,
	AdminOrganizationsRepository,
	AdminOrganizationSummaryRow,
	AdminOrgLedgerRow,
	AdminOrgSubscriptionRow,
} from "../../infrastructure/persistence/admin-organizations.repository";
import { AdminOrganizationsService } from "./admin-organizations.service";

type Grant = {
	amount: number;
	bucket: CreditBucket;
	idempotencyKey: string | undefined;
	owner: CreditOwner;
};

const ORG_ID = "org_1";

function summaryRow(
	overrides: Partial<AdminOrganizationSummaryRow> = {},
): AdminOrganizationSummaryRow {
	return {
		id: ORG_ID,
		name: "Acme",
		slug: "acme-ab12",
		logo: null,
		createdAt: new Date("2026-07-01T00:00:00.000Z"),
		membersCount: 2,
		projectsCount: 3,
		plan: "business",
		creditsBalance: 750,
		...overrides,
	};
}

function memberRow(
	userId: string,
	role: string,
): AdminOrganizationMemberRow {
	return {
		userId,
		name: `name-${userId}`,
		email: `${userId}@example.com`,
		image: null,
		role,
		joinedAt: new Date("2026-07-02T00:00:00.000Z"),
	};
}

class InMemoryOrgsRepository {
	summaries = new Map<string, AdminOrganizationSummaryRow>([
		[ORG_ID, summaryRow()],
	]);
	members = new Map<string, AdminOrganizationMemberRow[]>([
		[ORG_ID, [memberRow("user_owner", "owner"), memberRow("user_b", "member")]],
	]);
	subscription: AdminOrgSubscriptionRow | null = {
		plan: "business",
		status: "active",
		interval: "month",
		currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
		cancelAtPeriodEnd: false,
		tierCredits: 500,
		purchasedByUserId: "user_owner",
	};
	ledger: AdminOrgLedgerRow[] = [];
	memberLimits = new Map<string, number>([["user_b", 100]]);
	spentByUser = new Map<string, number>([["user_b", 40]]);
	roleWrites: Array<{ organizationId: string; userId: string; role: string }> =
		[];

	async listOrganizations() {
		return {
			items: [...this.summaries.values()],
			page: 1,
			pageSize: 20,
			total: this.summaries.size,
		};
	}

	async findOrganizationSummary(organizationId: string) {
		return this.summaries.get(organizationId) ?? null;
	}

	async listMembersWithUsers(organizationId: string) {
		return this.members.get(organizationId) ?? [];
	}

	async findMember(organizationId: string, userId: string) {
		const row = (this.members.get(organizationId) ?? []).find(
			(entry) => entry.userId === userId,
		);

		return row ? { id: `member-${userId}`, role: row.role } : null;
	}

	async updateMemberRole(
		organizationId: string,
		userId: string,
		role: string,
	) {
		this.roleWrites.push({ organizationId, role, userId });
		const row = (this.members.get(organizationId) ?? []).find(
			(entry) => entry.userId === userId,
		);

		if (row) {
			row.role = role;
		}
	}

	async findLatestSubscription() {
		return this.subscription;
	}

	async listRecentLedger() {
		return this.ledger;
	}

	async countPendingInvitations() {
		return 1;
	}

	async findDefaultMemberLimit() {
		return 250;
	}

	async listMemberLimits() {
		return this.memberLimits;
	}

	async sumMemberSpendThisMonth() {
		return this.spentByUser;
	}

	async findAttributionUserId() {
		return "user_owner";
	}

	async sumAiSpend() {
		return { meteredOperations: 4, totalCostUsdMicros: 123_000 };
	}
}

class FakeCreditsService {
	grants: Grant[] = [];

	async getBalance() {
		return { plan: 500, promo: 250, topup: 0, balance: 750 };
	}

	async grant(
		owner: CreditOwner,
		amount: number,
		options: { bucket: CreditBucket; idempotencyKey?: string },
	) {
		this.grants.push({
			amount,
			bucket: options.bucket,
			idempotencyKey: options.idempotencyKey,
			owner,
		});

		return {} as never;
	}
}

function build() {
	const repository = new InMemoryOrgsRepository();
	const credits = new FakeCreditsService();
	const service = new AdminOrganizationsService(
		repository as unknown as AdminOrganizationsRepository,
		credits as unknown as CreditsService,
	);

	return { credits, repository, service };
}

describe("AdminOrganizationsService", () => {
	it("maps the detail with per-member limits, spend, and the org balance", async () => {
		const { service } = build();

		const detail = await service.getOrganizationDetail(ORG_ID);

		expect(detail.id).toBe(ORG_ID);
		expect(detail.plan).toBe("business");
		expect(detail.balance).toEqual({
			plan: 500,
			promo: 250,
			topup: 0,
			balance: 750,
		});
		expect(detail.pendingInvitationsCount).toBe(1);
		expect(detail.defaultMemberMonthlyCreditLimit).toBe(250);
		expect(detail.attributionUserId).toBe("user_owner");
		expect(detail.aiSpend).toEqual({
			meteredOperations: 4,
			totalCostUsdMicros: 123_000,
		});
		expect(detail.subscription).toMatchObject({
			plan: "business",
			tierCredits: 500,
			purchasedByUserId: "user_owner",
		});

		const memberB = detail.members.find(
			(entry) => entry.userId === "user_b",
		);
		expect(memberB).toMatchObject({
			monthlyCreditLimit: 100,
			spentThisMonth: 40,
		});
		const owner = detail.members.find(
			(entry) => entry.userId === "user_owner",
		);
		expect(owner).toMatchObject({
			monthlyCreditLimit: null,
			spentThisMonth: 0,
		});
	});

	it("404s a detail request for an unknown organization", async () => {
		const { service } = build();

		await expect(
			service.getOrganizationDetail("org_missing"),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("grants promo credits to the ORG pool under a namespaced idempotency key", async () => {
		const { credits, service } = build();

		await service.grantCredits("admin_1", ORG_ID, {
			amount: 300,
			requestId: "11111111-1111-4111-8111-111111111111",
		});

		expect(credits.grants).toEqual([
			{
				amount: 300,
				bucket: "promo",
				idempotencyKey: `admin-grant:org:${ORG_ID}:11111111-1111-4111-8111-111111111111`,
				owner: { organizationId: ORG_ID, type: "org" },
			},
		]);
	});

	it("404s a grant for an unknown organization without touching credits", async () => {
		const { credits, service } = build();

		await expect(
			service.grantCredits("admin_1", "org_missing", {
				amount: 300,
				requestId: "11111111-1111-4111-8111-111111111111",
			}),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(credits.grants).toEqual([]);
	});

	it("writes the member role directly and returns the refreshed detail", async () => {
		const { repository, service } = build();

		const detail = await service.setMemberRole(
			"admin_1",
			ORG_ID,
			"user_b",
			{ role: "admin" },
		);

		expect(repository.roleWrites).toEqual([
			{ organizationId: ORG_ID, role: "admin", userId: "user_b" },
		]);
		expect(
			detail.members.find((entry) => entry.userId === "user_b")?.role,
		).toBe("admin");
	});

	it("allows demoting the last owner (repair tool semantics)", async () => {
		const { repository, service } = build();

		const detail = await service.setMemberRole(
			"admin_1",
			ORG_ID,
			"user_owner",
			{ role: "member" },
		);

		expect(repository.roleWrites).toEqual([
			{ organizationId: ORG_ID, role: "member", userId: "user_owner" },
		]);
		expect(
			detail.members.every(
				(entry) => !entry.role.split(",").includes("owner"),
			),
		).toBe(true);
	});

	it("404s a role write for a non-member", async () => {
		const { repository, service } = build();

		await expect(
			service.setMemberRole("admin_1", ORG_ID, "user_stranger", {
				role: "admin",
			}),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(repository.roleWrites).toEqual([]);
	});
});
