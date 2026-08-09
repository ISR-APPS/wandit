import { describe, expect, it } from "vitest";

import {
	creditOwnerLockValue,
	orgOwner,
	ownerColumns,
	ownerFromIds,
	sameCreditOwner,
	subjectPayer,
	userOwner,
} from "./credit-owner";

describe("credit owner", () => {
	it("keeps personal lock values as the RAW user id (byte-compat invariant)", () => {
		// Five repositories share hashtext(userId); pre-teams deploys and this
		// code MUST hash identical values for the same personal owner.
		expect(creditOwnerLockValue(userOwner("user_1"))).toBe("user_1");
	});

	it("namespaces org lock values so they cannot collide with user ids", () => {
		expect(creditOwnerLockValue(orgOwner("abc123"))).toBe("org:abc123");
	});

	it("derives the payer with org winning over user", () => {
		expect(ownerFromIds("user_1", null)).toEqual({
			type: "user",
			userId: "user_1",
		});
		expect(ownerFromIds("user_1", "org_1")).toEqual({
			organizationId: "org_1",
			type: "org",
		});
		expect(ownerFromIds(null, "org_1")).toEqual({
			organizationId: "org_1",
			type: "org",
		});
		expect(() => ownerFromIds(null, null)).toThrow(/neither/);
	});

	it("maps pool-owned row columns per owner type", () => {
		expect(ownerColumns(userOwner("user_1"))).toEqual({
			organizationId: null,
			userId: "user_1",
		});
		expect(ownerColumns(orgOwner("org_1"))).toEqual({
			organizationId: "org_1",
			userId: null,
		});
	});

	it("resolves the metering subject payer", () => {
		expect(subjectPayer({ actorUserId: "user_1" })).toEqual({
			type: "user",
			userId: "user_1",
		});
		expect(
			subjectPayer({ actorUserId: "user_1", organizationId: "org_1" }),
		).toEqual({ organizationId: "org_1", type: "org" });
	});

	it("compares owners by identity and type", () => {
		expect(sameCreditOwner(userOwner("a"), userOwner("a"))).toBe(true);
		expect(sameCreditOwner(userOwner("a"), userOwner("b"))).toBe(false);
		expect(sameCreditOwner(orgOwner("a"), orgOwner("a"))).toBe(true);
		// A user id equal to an org id is still a DIFFERENT owner.
		expect(sameCreditOwner(userOwner("a"), orgOwner("a"))).toBe(false);
	});
});
