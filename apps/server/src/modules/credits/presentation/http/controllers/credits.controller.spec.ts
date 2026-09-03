import type { AuthUser } from "@wandit/auth";
import { creditActivityResponseSchema } from "@wandit/contracts";
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
import type { CreditActivityRow } from "../../../infrastructure/persistence/credits.repository";
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
	activity?: CreditActivityRow[];
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
				settledPlan: 0,
				settledPromo: 0,
				settledTopup: 0,
				topup: 0,
				...balances[key],
			} satisfies SettledCreditBalance;
		}),
		listActivity: vi.fn(
			async (
				_owner: CreditOwner,
				query: { page: number; pageSize: number },
			) => ({
				items: input.activity ?? [],
				page: query.page,
				pageSize: query.pageSize,
				total: input.activity?.length ?? 0,
			}),
		),
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
	it("converts centi-credits to decimal credits and reports the settled buckets", async () => {
		const { controller, creditsService } = setup({
			balances: {
				user_1: {
					balance: 1234,
					plan: 1000,
					promo: 200,
					settledBalance: 1284,
					// A 50 cc hold split 30 plan + 20 promo is added back per bucket.
					settledPlan: 1030,
					settledPromo: 220,
					settledTopup: 34,
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
			settledPlan: 10.3,
			settledPromo: 2.2,
			settledTopup: 0.34,
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

describe("CreditsController.listActivity", () => {
	const createdAt = new Date("2026-08-20T10:00:00.000Z");

	it("maps usage and ledger rows to the activity contract in decimal credits", async () => {
		const { controller, creditsService } = setup({
			activity: [
				{
					createdAt,
					finalCredits: null,
					finalizedAt: null,
					id: "3f1d2a36-2f9e-4d4b-9c2f-7c0d3f6a1e01",
					operation: "image",
					reservedCredits: 350,
					source: "usage",
					status: "reserved",
				},
				{
					createdAt,
					finalCredits: 39,
					finalizedAt: new Date("2026-08-20T10:02:00.000Z"),
					id: "3f1d2a36-2f9e-4d4b-9c2f-7c0d3f6a1e02",
					operation: "chat",
					reservedCredits: 100,
					source: "usage",
					status: "reconciled",
				},
				{
					bucket: "promo",
					createdAt,
					delta: 500,
					id: "3f1d2a36-2f9e-4d4b-9c2f-7c0d3f6a1e03",
					ledgerKind: "grant",
					reason: "signup_grant",
					source: "ledger",
				},
			],
		});
		const workspace = {
			kind: "org",
			organizationId: "org_1",
			role: "member",
			roles: ["member"],
		} satisfies WorkspaceContext;

		const response = await controller.listActivity(
			{ page: 1, pageSize: 20 },
			USER,
			workspace,
		);

		expect(creditActivityResponseSchema.parse(response)).toEqual(response);
		expect(response).toEqual({
			items: [
				{
					bucket: null,
					createdAt: "2026-08-20T10:00:00.000Z",
					credits: null,
					finalizedAt: null,
					id: "3f1d2a36-2f9e-4d4b-9c2f-7c0d3f6a1e01",
					kind: "usage",
					ledgerKind: null,
					operation: "image",
					reason: null,
					status: "in_progress",
				},
				{
					bucket: null,
					createdAt: "2026-08-20T10:00:00.000Z",
					credits: -0.39,
					finalizedAt: "2026-08-20T10:02:00.000Z",
					id: "3f1d2a36-2f9e-4d4b-9c2f-7c0d3f6a1e02",
					kind: "usage",
					ledgerKind: null,
					operation: "chat",
					reason: null,
					status: "settled",
				},
				{
					bucket: "promo",
					createdAt: "2026-08-20T10:00:00.000Z",
					credits: 5,
					finalizedAt: null,
					id: "3f1d2a36-2f9e-4d4b-9c2f-7c0d3f6a1e03",
					kind: "ledger",
					ledgerKind: "grant",
					operation: null,
					reason: "signup_grant",
					status: "settled",
				},
			],
			page: 1,
			pageSize: 20,
			total: 3,
		});
		expect(creditsService.listActivity).toHaveBeenCalledWith(
			orgOwner("org_1"),
			{
				page: 1,
				pageSize: 20,
			},
		);
	});

	it("resolves the personal workspace to the user's own pool", async () => {
		const { controller, creditsService } = setup({});

		await controller.listActivity({ page: 2, pageSize: 3 }, USER, {
			kind: "personal",
		});

		expect(creditsService.listActivity).toHaveBeenCalledWith(
			userOwner("user_1"),
			{ page: 2, pageSize: 3 },
		);
	});
});
