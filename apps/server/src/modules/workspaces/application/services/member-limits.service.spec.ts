import { BadRequestException } from "@nestjs/common";
import { db as realDb } from "@wandit/db";
import { describe, expect, it } from "vitest";

import {
	type CreditOwner,
	userOwner,
} from "../../../credits/domain/credit-owner";
import type { WorkspaceMembersRepository } from "../../infrastructure/persistence/members.repository";
import type { OrganizationLimitsRepository } from "../../infrastructure/persistence/organization-limits.repository";
import {
	type LimitsWorkspace,
	MemberLimitsService,
} from "./member-limits.service";

// The personal workspace of "user_1". "user_9" has a grant on one of its projects.
const PERSONAL: LimitsWorkspace = {
	organizationId: "personal_org_1",
	personalOwnerUserId: "user_1",
};

function setup() {
	const lockedPools: CreditOwner[] = [];
	const upsertedLimits: { userId: string; centiCredits: number }[] = [];
	const members: Pick<
		WorkspaceMembersRepository,
		"listExternalCollaborators" | "listMembersWithUsers"
	> = {
		listExternalCollaborators: async () => [
			{ email: "sam@example.com", name: "Sam", userId: "user_9" },
		],
		listMembersWithUsers: async () => [
			{
				email: "zack@example.com",
				joinedAt: new Date(0),
				name: "Zack",
				role: "owner",
				userId: "user_1",
			},
		],
	};
	const limits: Pick<
		OrganizationLimitsRepository,
		| "deleteMemberLimit"
		| "findSettings"
		| "listMemberLimits"
		| "sumMemberSpendThisMonth"
		| "sumPersonalPoolMemberSpendThisMonth"
		| "upsertMemberLimit"
		| "upsertSettings"
		| "withPoolCreditLock"
	> = {
		deleteMemberLimit: async () => {},
		findSettings: async () => null,
		listMemberLimits: async () => [],
		sumMemberSpendThisMonth: async () => 0,
		sumPersonalPoolMemberSpendThisMonth: async () => 0,
		upsertMemberLimit: async (_organizationId, userId, centiCredits) => {
			upsertedLimits.push({ centiCredits, userId });
		},
		upsertSettings: async () => {},
		// The fake writes ignore the transaction client, so the lazy real client is enough.
		withPoolCreditLock: async (pool, fn) => {
			lockedPools.push(pool);
			return fn(realDb);
		},
	};
	const service = new MemberLimitsService(
		// SAFETY: get and update call only the two methods above.
		members as WorkspaceMembersRepository,
		// SAFETY: get and update call only the eight methods above.
		limits as OrganizationLimitsRepository,
	);

	return { lockedPools, service, upsertedLimits };
}

describe("MemberLimitsService.update in a personal workspace", () => {
	it("refuses a credit limit on the personal owner and writes nothing", async () => {
		const { lockedPools, service, upsertedLimits } = setup();

		await expect(
			service.update(
				PERSONAL,
				{ members: [{ monthlyCreditLimit: 10, userId: "user_1" }] },
				"user_1",
			),
		).rejects.toBeInstanceOf(BadRequestException);
		expect(lockedPools).toEqual([]);
		expect(upsertedLimits).toEqual([]);
	});

	it("limits a project collaborator under the owner's personal pool lock", async () => {
		const { lockedPools, service, upsertedLimits } = setup();

		await service.update(
			PERSONAL,
			{ members: [{ monthlyCreditLimit: 25, userId: "user_9" }] },
			"user_1",
		);

		// The metering reserve of the owner's pool takes this same lock.
		expect(lockedPools).toEqual([userOwner("user_1")]);
		// 25 whole credits are stored as 2_500 centi-credits.
		expect(upsertedLimits).toEqual([{ centiCredits: 2_500, userId: "user_9" }]);
	});
});
