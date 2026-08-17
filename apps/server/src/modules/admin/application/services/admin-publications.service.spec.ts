import { adminListPublicationsResponseSchema } from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { describe, expect, it, vi } from "vitest";
import type {
	AdminPublicationRow,
	AdminRepository,
} from "../../infrastructure/persistence/admin.repository";
import { AdminPublicationsService } from "./admin-publications.service";

const QUERY = { page: 1, pageSize: 20 };

const PUBLISHED_AT = new Date("2026-08-07T11:30:00.000Z");

function publicationRow(
	overrides: Partial<AdminPublicationRow> = {},
): AdminPublicationRow {
	return {
		deploymentId: "33333333-3333-4333-8333-333333333333",
		status: "active",
		slug: "launch",
		deploymentCreatedAt: PUBLISHED_AT,
		projectId: "11111111-1111-4111-8111-111111111111",
		projectName: "Launch page",
		organizationId: null,
		userId: "user-1",
		userName: "Ada Lovelace",
		userEmail: "ada@example.com",
		userImage: null,
		primaryDomainName: "launch.example",
		...overrides,
	};
}

function setup(row: AdminPublicationRow) {
	const adminRepository = {
		listPublications: vi.fn().mockResolvedValue({
			items: [row],
			page: QUERY.page,
			pageSize: QUERY.pageSize,
			total: 1,
		}),
	};
	const service = new AdminPublicationsService(
		adminRepository as unknown as AdminRepository,
	);

	return { adminRepository, service };
}

describe("AdminPublicationsService", () => {
	it("maps an active publication with a primary domain to both URLs", async () => {
		const { adminRepository, service } = setup(publicationRow());

		const result = await service.listPublications(QUERY);

		expect(adminRepository.listPublications).toHaveBeenCalledWith(QUERY);
		expect(adminListPublicationsResponseSchema.parse(result)).toEqual(result);
		expect(result.items[0]).toEqual({
			id: "33333333-3333-4333-8333-333333333333",
			status: "active",
			slug: "launch",
			liveUrl: `https://launch.${env.SITES_DOMAIN}`,
			publicUrl: "https://www.launch.example",
			publishedAt: "2026-08-07T11:30:00.000Z",
			project: {
				id: "11111111-1111-4111-8111-111111111111",
				name: "Launch page",
				organizationId: null,
			},
			user: {
				id: "user-1",
				name: "Ada Lovelace",
				email: "ada@example.com",
				image: null,
			},
		});
	});

	it("keeps only the subdomain URL for an active publication without a primary domain", async () => {
		const { service } = setup(publicationRow({ primaryDomainName: null }));

		const result = await service.listPublications(QUERY);

		expect(result.items[0]).toMatchObject({
			liveUrl: `https://launch.${env.SITES_DOMAIN}`,
			publicUrl: null,
		});
	});

	// A freed slug can be re-claimed by another project, so historical rows
	// must not link anywhere — even when a primary domain row still exists.
	it.each([
		"superseded",
		"unpublished",
	] as const)("nulls both URLs on a %s historical row", async (status) => {
		const { service } = setup(publicationRow({ status }));

		const result = await service.listPublications(QUERY);

		expect(adminListPublicationsResponseSchema.parse(result)).toEqual(result);
		expect(result.items[0]).toMatchObject({
			status,
			liveUrl: null,
			publicUrl: null,
		});
	});
});
