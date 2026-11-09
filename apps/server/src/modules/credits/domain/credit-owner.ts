/**
 * Credit pool owners, their lock values, and the metering subject.
 * Credits, metering, billing, and the project scope helpers import these pure functions.
 */
import type { CreditPayer } from "@wandit/contracts";

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
	return owner.type === "user" ? owner.userId : `org:${owner.organizationId}`;
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
	/**
	 * Owner of the personal pool that pays when it is not the actor's own pool
	 * (a shared personal workspace). Null or absent: the actor's own pool.
	 */
	payerUserId?: string | null;
	actorIsLimitExempt?: boolean;
};

/** The paying pool: the org when set, else the personal pool of `payerUserId ?? actorUserId`. */
export function subjectPayer(subject: MeteringSubject): CreditOwner {
	return ownerFromIds(
		subject.payerUserId ?? subject.actorUserId,
		subject.organizationId ?? null,
	);
}

/**
 * The `payer_user_id` column of a row that `subject` writes. It is set only
 * when another user's personal pool pays, so a row that the actor's own pool
 * pays keeps its old shape. Usage events, connector attempts, and device
 * sessions store it.
 */
export function subjectPayerUserId(subject: MeteringSubject): string | null {
	const payer = subjectPayer(subject);

	return payer.type === "user" && payer.userId !== subject.actorUserId
		? payer.userId
		: null;
}

/**
 * The `payer` field of a 402, a member-limit 403, and the turn estimate.
 * `isActor` is true only when the pool is the actor's own personal pool.
 */
export function creditPayerOf(
	owner: CreditOwner,
	actorUserId: string,
): CreditPayer {
	return owner.type === "user"
		? {
				isActor: owner.userId === actorUserId,
				kind: "user",
				organizationId: null,
			}
		: { isActor: false, kind: "org", organizationId: owner.organizationId };
}
