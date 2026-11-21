import { describe, expect, it, vi } from "vitest";

import { canBuyForPayer } from "./billing-modal-provider";

vi.mock("@/features/auth", () => ({
	useAuthModal: () => ({ open: vi.fn() }),
	useSession: () => ({ data: null }),
}));

vi.mock("@/features/workspaces/lib/workspace-provider", () => ({
	useWorkspace: () => ({ actorCanManageBilling: true, isPersonal: true }),
}));

vi.mock("../lib/billing-error-dispatch", () => ({
	subscribeToBillingErrors: () => () => undefined,
}));

vi.mock(
	"@/features/workspaces/components/workspace-billing-notice-dialog",
	async () => {
		const { createElement } = await import("react");

		return {
			WorkspaceBillingNoticeDialog: () => createElement("div"),
		};
	},
);

describe("canBuyForPayer", () => {
	const ownPool = {
		kind: "user",
		isActor: true,
		organizationId: null,
	} as const;
	const otherPersonalPool = {
		kind: "user",
		isActor: false,
		organizationId: null,
	} as const;
	const teamPool = {
		kind: "org",
		isActor: false,
		organizationId: "org-1",
	} as const;

	it.each([
		// Older API: the old rule on the active workspace.
		{
			payer: undefined,
			active: "org-1",
			isPersonal: false,
			billing: true,
			expected: true,
		},
		{
			payer: undefined,
			active: "org-1",
			isPersonal: false,
			billing: false,
			expected: false,
		},
		{
			payer: ownPool,
			active: "personal",
			isPersonal: true,
			billing: true,
			expected: true,
		},
		// A turn of a shared project spent another user's pool.
		{
			payer: otherPersonalPool,
			active: "personal",
			isPersonal: true,
			billing: true,
			expected: false,
		},
		// The own pool paid, but a purchase now credits the active team.
		{
			payer: ownPool,
			active: "org-1",
			isPersonal: false,
			billing: true,
			expected: false,
		},
		{
			payer: teamPool,
			active: "org-1",
			isPersonal: false,
			billing: true,
			expected: true,
		},
		{
			payer: teamPool,
			active: "org-1",
			isPersonal: false,
			billing: false,
			expected: false,
		},
		// A team project opened from the personal workspace.
		{
			payer: teamPool,
			active: "personal",
			isPersonal: true,
			billing: true,
			expected: false,
		},
	])("payer $payer.kind in $active, billing $billing: $expected", (row) => {
		expect(
			canBuyForPayer({
				payer: row.payer,
				activeWorkspaceId: row.active,
				isPersonal: row.isPersonal,
				actorCanManageBilling: row.billing,
			}),
		).toBe(row.expected);
	});
});
