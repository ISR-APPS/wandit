import { type LeadsResponse, leadsRoutes } from "@wandit/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({
	apiClient: {
		get: vi.fn(),
		patch: vi.fn(),
	},
}));

import { apiClient } from "@/lib/api-client";
import { listAllLeads, updateLeadArchive } from "./leads.services";

function response(id: string, nextCursor: string | null): LeadsResponse {
	return {
		leads: [
			{
				archivedAt: null,
				campaign: null,
				commune: null,
				createdAt: "2026-08-02T10:00:00.000Z",
				extras: { bundle: id },
				id,
				name: `Lead ${id}`,
				phone: "+213550000000",
				productSku: null,
				source: "direct",
				status: "confirmed",
				wilaya: null,
			},
		],
		nextCursor,
		total: 2,
		totals: {
			cancelled: 0,
			confirmed: 2,
			last7Days: 2,
			today: 2,
			total: 2,
		},
	};
}

describe("listAllLeads", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("walks every cursor page with the active server filters", async () => {
		vi.mocked(apiClient.get)
			.mockResolvedValueOnce(
				response("00000000-0000-4000-8000-000000000001", "next-page"),
			)
			.mockResolvedValueOnce(
				response("00000000-0000-4000-8000-000000000002", null),
			);

		const leads = await listAllLeads("project-1", {
			archived: "only",
			createdFrom: "2026-07-27",
			createdTo: "2026-08-02",
			q: "amina",
			source: "facebook",
			status: "confirmed",
		});

		expect(leads.map((lead) => lead.id)).toEqual([
			"00000000-0000-4000-8000-000000000001",
			"00000000-0000-4000-8000-000000000002",
		]);
		expect(apiClient.get).toHaveBeenNthCalledWith(
			1,
			leadsRoutes.listByProject("project-1"),
			{
				query: {
					archived: "only",
					cursor: undefined,
					createdFrom: "2026-07-27",
					createdTo: "2026-08-02",
					pageSize: 100,
					q: "amina",
					source: "facebook",
					status: "confirmed",
				},
			},
		);
		expect(apiClient.get).toHaveBeenNthCalledWith(
			2,
			leadsRoutes.listByProject("project-1"),
			{
				query: {
					archived: "only",
					cursor: "next-page",
					createdFrom: "2026-07-27",
					createdTo: "2026-08-02",
					pageSize: 100,
					q: "amina",
					source: "facebook",
					status: "confirmed",
				},
			},
		);
	});

	it("rejects a repeated cursor instead of returning a partial export", async () => {
		vi.mocked(apiClient.get)
			.mockResolvedValueOnce(
				response("00000000-0000-4000-8000-000000000001", "repeat"),
			)
			.mockResolvedValueOnce(
				response("00000000-0000-4000-8000-000000000002", "repeat"),
			);

		await expect(
			listAllLeads("project-1", { archived: "exclude" }),
		).rejects.toThrow("repeated cursor");
	});

	it("archives a lead through the project route", async () => {
		const lead = response("00000000-0000-4000-8000-000000000001", null)
			.leads[0];
		vi.mocked(apiClient.patch).mockResolvedValue({
			lead: {
				...lead,
				archivedAt: "2026-08-12T14:00:00.000Z",
			},
		});

		const archived = await updateLeadArchive(
			"project-1",
			"00000000-0000-4000-8000-000000000001",
			true,
		);

		expect(archived.archivedAt).toBe("2026-08-12T14:00:00.000Z");
		expect(apiClient.patch).toHaveBeenCalledWith(
			leadsRoutes.archive("project-1", "00000000-0000-4000-8000-000000000001"),
			{ archived: true },
		);
	});
});
