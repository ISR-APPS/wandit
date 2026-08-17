import type { AuthUser } from "@wandit/auth";
import { describe, expect, it, vi } from "vitest";

import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import type {
	MembershipWithOrganization,
	WorkspaceMembersRepository,
} from "../../../../workspaces/infrastructure/persistence/members.repository";
import type {
	CreditsService,
	SettledCreditBalance,
} from "../../../application/services/credits.service";
import {
	type CreditOwner,
	orgOwner,
	userOwner,
} from "../../../domain/credit-owner";
import { CreditsController } from "./credits.controller";

const USER = { id: "user_1" } as AuthUser;

function membership(id: string, name: string): MembershipWithOrganization {
	return {
		member: {} as MembershipWithOrganization["member"],
		organization: {
			createdAt: new Date(0),
			id,
			logo: null,
			name,
			slug: id,
		},
	};
}

function setup(input: {
	balances?: Record<string, Partial<SettledCreditBalance>>;
	memberships?: MembershipWithOrganization[];
}) {
	const balances = input.balances ?? {};
	const creditsService = {
		getSettledBalance: vi.fn(async (owner: CreditOwner) => {
			const key = owner.type === "user" ? owner.userId : owner.organizationId;

			return {
				balance: 0,
				plan: 0,
				promo: 0,
				settledBalance: 0,
				topup: 0,
				...balances[key],
			} satisfies SettledCreditBalance;
		}),
	};
	const membersRepository = {
		listUserMemberships: vi.fn(async () => input.memberships ?? []),
	};
	const controller = new CreditsController(
		creditsService as unknown as CreditsService,
		membersRepository as unknown as WorkspaceMembersRepository,
	);

	return { controller, creditsService, membersRepository };
}

describe("CreditsController.getBalance", () => {
	it("converts centi-credits to decimal credits and reports the settled add-back", async () => {
		const { controller, creditsService } = setup({
			balances: {
				user_1: {
					balance: 1234,
					plan: 1000,
					promo: 200,
					settledBalance: 1284,
					topup: 34,
				},
			},
		});
		const workspace = { kind: "personal" } satisfies WorkspaceContext;

		expect(await controller.getBalance(USER, workspace)).toEqual({
			balance: 12.34,
			plan: 10,
			promo: 2,
			settledBalance: 12.84,
			topup: 0.34,
		});
		expect(creditsService.getSettledBalance).toHaveBeenCalledWith(
			userOwner("user_1"),
		);
	});

	it("resolves an org workspace to the org pool", async () => {
		const { controller, creditsService } = setup({});
		const workspace = {
			kind: "org",
			organizationId: "org_1",
			role: "member",
			roles: ["member"],
		} satisfies WorkspaceContext;

		await controller.getBalance(USER, workspace);

		expect(creditsService.getSettledBalance).toHaveBeenCalledWith(
			orgOwner("org_1"),
		);
	});
});

describe("CreditsController.listBalances", () => {
	it("lists the personal pool first, then each org membership, in decimal credits", async () => {
		const { controller, creditsService, membersRepository } = setup({
			balances: {
				org_1: { balance: 5000, settledBalance: 5250 },
				org_2: { balance: 10, settledBalance: 10 },
				user_1: { balance: 380, settledBalance: 500 },
			},
			memberships: [membership("org_1", "Acme"), membership("org_2", "Globex")],
		});

		expect(await controller.listBalances(USER)).toEqual({
			items: [
				{
					balance: 3.8,
					name: null,
					settledBalance: 5,
					workspaceId: "personal",
				},
				{
					balance: 50,
					name: "Acme",
					settledBalance: 52.5,
					workspaceId: "org_1",
				},
				{
					balance: 0.1,
					name: "Globex",
					settledBalance: 0.1,
					workspaceId: "org_2",
				},
			],
		});
		// The membership query IS the authorization: only the user's own orgs.
		expect(membersRepository.listUserMemberships).toHaveBeenCalledWith(
			"user_1",
		);
		expect(creditsService.getSettledBalance).toHaveBeenCalledWith(
			userOwner("user_1"),
		);
		expect(creditsService.getSettledBalance).toHaveBeenCalledWith(
			orgOwner("org_1"),
		);
		expect(creditsService.getSettledBalance).toHaveBeenCalledWith(
			orgOwner("org_2"),
		);
	});

	it("returns only the personal pool when the user has no memberships", async () => {
		const { controller, creditsService } = setup({
			balances: { user_1: { balance: 700, settledBalance: 700 } },
		});

		expect(await controller.listBalances(USER)).toEqual({
			items: [
				{ balance: 7, name: null, settledBalance: 7, workspaceId: "personal" },
			],
		});
		expect(creditsService.getSettledBalance).toHaveBeenCalledTimes(1);
	});
});
