/**
 * Reads the platform publish log for the admin Publications page.
 * `AdminPublicationsController` calls it; it reads through `AdminRepository`.
 * The mapper adds the live links and the take-down state of each row.
 */
import { Inject, Injectable } from "@nestjs/common";
import type {
	AdminListPublicationsQuery,
	AdminListPublicationsResponse,
	AdminPublication,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";

import { canonicalDomainHost } from "../../../domains/domain/domain-hosts";
import {
	type AdminPublicationRow,
	AdminRepository,
} from "../../infrastructure/persistence/admin.repository";

@Injectable()
export class AdminPublicationsService {
	constructor(
		@Inject(AdminRepository)
		private readonly adminRepository: AdminRepository,
	) {}

	async listPublications(
		query: AdminListPublicationsQuery,
	): Promise<AdminListPublicationsResponse> {
		const page = await this.adminRepository.listPublications(query);

		return {
			items: page.items.map(mapAdminPublication),
			page: page.page,
			pageSize: page.pageSize,
			total: page.total,
		};
	}
}

/** Maps one log row to the API shape. Links stay null on historical rows. */
export function mapAdminPublication(
	row: AdminPublicationRow,
): AdminPublication {
	// Links resolve only while the row is still the live deployment: an
	// unpublished slug can be re-claimed by another project, so historical rows
	// must not link anywhere.
	const live = row.status === "active";

	return {
		id: row.deploymentId,
		// The repository WHERE restricts rows to the publication statuses, so
		// pending/failed can never reach the mapper.
		status: row.status as AdminPublication["status"],
		kind: row.kind,
		slug: row.slug,
		liveUrl: live ? `https://${row.slug}.${env.SITES_DOMAIN}` : null,
		publicUrl:
			live && row.primaryDomainName !== null
				? `https://${canonicalDomainHost(row.primaryDomainName)}`
				: null,
		publishedAt: row.deploymentCreatedAt.toISOString(),
		// The check `projects_suspension_pair_ck` keeps both columns null or both set.
		suspension:
			row.suspendedAt !== null && row.suspendedReasonCode !== null
				? {
						reasonCode: row.suspendedReasonCode,
						suspendedAt: row.suspendedAt.toISOString(),
					}
				: null,
		project: {
			id: row.projectId,
			name: row.projectName,
			organizationId: row.organizationId,
		},
		user: {
			id: row.userId,
			name: row.userName,
			email: row.userEmail,
			image: row.userImage,
		},
	};
}
