import { adminCreditGrantSchema } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import type { AdminCreditGrantRow } from "../../infrastructure/persistence/admin-credit-grants.repository";
import { mapAdminCreditGrant } from "./admin-credit-grants.service";

const GRANTED_AT = new Date("2026-09-20T08:30:00.000Z");

function grantRow(
	overrides: Partial<AdminCreditGrantRow> = {},
): AdminCreditGrantRow {
	return {
		id: "11111111-1111-4111-8111-111111111111",
		createdAt: GRANTED_AT,
		// Centi-credits: 12_550 = 125.5 credits.
		delta: 12_550,
		note: "Refund for a failed build",
		granterId: "support-1",
		granterName: "Sara Support",
		granterEmail: "sara@wandit.dev",
		granterRole: "support",
		userId: "user-1",
		userName: "Customer",
		userEmail: "customer@example.com",
		organizationId: null,
		organizationName: null,
		...overrides,
	};
}

describe("mapAdminCreditGrant", () => {
	it("maps a personal grant with its granter and converts centi-credits", () => {
		const grant = mapAdminCreditGrant(grantRow());

		expect(grant).toEqual({
			id: "11111111-1111-4111-8111-111111111111",
			createdAt: "2026-09-20T08:30:00.000Z",
			amount: 125.5,
			note: "Refund for a failed build",
			grantedBy: {
				id: "support-1",
				name: "Sara Support",
				email: "sara@wandit.dev",
				role: "support",
			},
			recipient: {
				kind: "user",
				id: "user-1",
				name: "Customer",
				email: "customer@example.com",
			},
		});
		expect(adminCreditGrantSchema.parse(grant)).toEqual(grant);
	});

	it("maps an organization pool grant", () => {
		const grant = mapAdminCreditGrant(
			grantRow({
				userId: null,
				userName: null,
				userEmail: null,
				organizationId: "org-1",
				organizationName: "Acme",
			}),
		);

		expect(grant.recipient).toEqual({
			kind: "organization",
			id: "org-1",
			name: "Acme",
		});
	});

	it("normalizes a comma-joined granter role to the highest role", () => {
		expect(
			mapAdminCreditGrant(grantRow({ granterRole: "user,admin" })).grantedBy
				?.role,
		).toBe("admin");
	});

	it("returns a null granter when the granter account row is gone", () => {
		expect(
			mapAdminCreditGrant(
				grantRow({ granterName: null, granterEmail: null, granterRole: null }),
			).grantedBy,
		).toBeNull();
	});

	it("returns a null granter when the ledger row has no grantedBy id", () => {
		expect(
			mapAdminCreditGrant(grantRow({ granterId: null })).grantedBy,
		).toBeNull();
	});

	it("keeps a missing note as null", () => {
		expect(mapAdminCreditGrant(grantRow({ note: null })).note).toBeNull();
	});

	it("throws with the ledger row id when no owner joined", () => {
		expect(() =>
			mapAdminCreditGrant(
				grantRow({ userId: null, userName: null, userEmail: null }),
			),
		).toThrow("credit_ledger row 11111111-1111-4111-8111-111111111111");
	});
});
