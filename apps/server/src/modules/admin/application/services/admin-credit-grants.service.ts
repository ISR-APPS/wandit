/**
 * Builds the admin credit grant log: who granted credits to whom.
 * AdminCreditGrantsController calls it. It reads rows from
 * AdminCreditGrantsRepository and maps them to the API contract.
 */
import { Inject, Injectable } from "@nestjs/common";
import {
	type AdminCreditGrant,
	type AdminListCreditGrantsQuery,
	type AdminListCreditGrantsResponse,
	centiCreditsToCredits,
	normalizeStoredRole,
} from "@wandit/contracts";

import {
	type AdminCreditGrantRow,
	AdminCreditGrantsRepository,
} from "../../infrastructure/persistence/admin-credit-grants.repository";

/** Read-only. The grant endpoints in the users and organizations services write the rows. */
@Injectable()
export class AdminCreditGrantsService {
	constructor(
		@Inject(AdminCreditGrantsRepository)
		private readonly repository: AdminCreditGrantsRepository,
	) {}

	/** One page of manual grants for users and organizations, newest first. */
	async listCreditGrants(
		query: AdminListCreditGrantsQuery,
	): Promise<AdminListCreditGrantsResponse> {
		const page = await this.repository.listCreditGrants(query);

		return { ...page, items: page.items.map(mapAdminCreditGrant) };
	}
}

/**
 * Maps one `admin_grant` ledger row to the API shape.
 * Throws when the row has no joined owner, which the ledger constraints prevent.
 */
export function mapAdminCreditGrant(
	row: AdminCreditGrantRow,
): AdminCreditGrant {
	return {
		id: row.id,
		createdAt: row.createdAt.toISOString(),
		// The ledger stores centi-credits. The API sends decimal credits.
		amount: centiCreditsToCredits(row.delta),
		// adminGrantCreditsInputSchema trims the note and rejects an empty one.
		note: row.note,
		grantedBy:
			row.granterId !== null &&
			row.granterName !== null &&
			row.granterEmail !== null
				? {
						id: row.granterId,
						name: row.granterName,
						email: row.granterEmail,
						role: normalizeStoredRole(row.granterRole),
					}
				: null,
		recipient: mapRecipient(row),
	};
}

function mapRecipient(row: AdminCreditGrantRow): AdminCreditGrant["recipient"] {
	if (row.organizationId !== null && row.organizationName !== null) {
		return {
			kind: "organization",
			id: row.organizationId,
			name: row.organizationName,
		};
	}

	if (row.userId !== null && row.userName !== null && row.userEmail !== null) {
		return {
			kind: "user",
			id: row.userId,
			name: row.userName,
			email: row.userEmail,
		};
	}

	// credit_ledger_owner_present_ck sets one owner on every row, and both owner
	// foreign keys restrict deletes. A row without a joined owner is corrupt data.
	throw new Error(`credit_ledger row ${row.id} has no joined owner`);
}
