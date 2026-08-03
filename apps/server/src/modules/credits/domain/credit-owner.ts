/**
 * The paying entity for a credit pool: a user (personal workspace) or an
 * organization. Actor identity is always carried separately — an org
 * consumption row records the acting member, but the POOL belongs to the org.
 * (docs/features/teams-workspaces.md §3)
 */
export type CreditOwner =
	| { type: "user"; userId: string }
	| { type: "org"; organizationId: string };

export function userOwner(userId: string): CreditOwner {
	return { type: "user", userId };
}

export function orgOwner(organizationId: string): CreditOwner {
	return { organizationId, type: "org" };
}

/** Payer derivation for rows that store both columns: org wins. */
export function ownerFromIds(
	userId: string | null,
	organizationId: string | null | undefined,
): CreditOwner {
	if (organizationId) {
		return orgOwner(organizationId);
	}

	if (!userId) {
		throw new Error("Credit row has neither a user nor an organization owner");
	}

	return userOwner(userId);
}

/**
 * Advisory-lock value for the owner's balance lock.
 *
 * COMPATIBILITY INVARIANT: personal locks stay the RAW user id — five
 * repositories share `hashtext(userId)` byte-for-byte and pre-teams deploys
 * still lock that way. Org locks use the `org:` prefix, a namespace no Better
 * Auth user id can collide with. Never derive lock values any other way.
 */
export function creditOwnerLockValue(owner: CreditOwner): string {
	return owner.type === "user"
		? owner.userId
		: `org:${owner.organizationId}`;
}

/** Stable log/meta key for an owner ("<userId>" or "org:<orgId>"). */
export function creditOwnerKey(owner: CreditOwner): string {
	return creditOwnerLockValue(owner);
}

/**
 * Column values for a POOL-OWNED row (ledger grant, plan hold, hold pool):
 * personal → userId set / org NULL; org → organizationId set / userId NULL.
 * Consumption rows override userId with the acting member for provenance.
 */
export function ownerColumns(owner: CreditOwner): {
	organizationId: string | null;
	userId: string | null;
} {
	return owner.type === "user"
		? { organizationId: null, userId: owner.userId }
		: { organizationId: owner.organizationId, userId: null };
}

export function sameCreditOwner(a: CreditOwner, b: CreditOwner): boolean {
	if (a.type === "user" && b.type === "user") {
		return a.userId === b.userId;
	}

	if (a.type === "org" && b.type === "org") {
		return a.organizationId === b.organizationId;
	}

	return false;
}

/**
 * The metering subject: who acted, and which pool pays. `actorIsLimitExempt`
 * marks owners/admins, who bypass the org's DEFAULT member limit (an explicit
 * per-member row still binds them).
 */
export type MeteringSubject = {
	actorUserId: string;
	organizationId?: string | null;
	actorIsLimitExempt?: boolean;
};

export function subjectPayer(subject: MeteringSubject): CreditOwner {
	return ownerFromIds(subject.actorUserId, subject.organizationId ?? null);
}
