import { type LeadsResponse, leadsRoutes } from "@wandit/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({
	apiClient: {
		get: vi.fn(),
		patch: vi.fn(),
	},
}));

import { apiClient } from "@/lib/api-client";
import { listAllLeads } from "./leads.services";

function response(id: string, nextCursor: string | null): LeadsResponse {
	return {
		leads: [
			{
				campaign: null,
				commune: null,
				createdAt: "2026-08-02T10:00:00.000Z",
				extras: { bundle: id },
				id,
				name: `Lead ${id}`,
				phone: "+213550000000",
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
			q: "amina",
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
					cursor: undefined,
					pageSize: 100,
					q: "amina",
					status: "confirmed",
				},
			},
		);
		expect(apiClient.get).toHaveBeenNthCalledWith(
			2,
			leadsRoutes.listByProject("project-1"),
			{
				query: {
					cursor: "next-page",
					pageSize: 100,
					q: "amina",
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

		await expect(listAllLeads("project-1", {})).rejects.toThrow(
			"repeated cursor",
		);
	});
});
