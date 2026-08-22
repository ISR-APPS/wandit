import { leadsRoutes, type WorkspaceLeadsResponse } from "@wandit/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({
	apiClient: {
		get: vi.fn(),
	},
}));

import { apiClient } from "@/lib/api-client";
import { listWorkspaceLeads } from "./workspace-leads.services";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

const RESPONSE: WorkspaceLeadsResponse = {
	leads: [
		{
			archivedAt: null,
			campaign: "summer-launch",
			commune: null,
			createdAt: "2026-08-02T10:00:00.000Z",
			extras: null,
			id: "00000000-0000-4000-8000-000000000001",
			name: "Amina",
			phone: "+213550000000",
			productSku: null,
			projectId: PROJECT_ID,
			projectName: "Sahara Serum",
			source: "facebook",
			status: "to_confirm",
			wilaya: "Alger",
		},
	],
	nextCursor: null,
	total: 1,
};

describe("listWorkspaceLeads", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("hits the flat workspace route with every filter and parses the page", async () => {
		vi.mocked(apiClient.get).mockResolvedValueOnce(RESPONSE);

		const page = await listWorkspaceLeads({
			archived: "only",
			cursor: "cursor-1",
			createdFrom: "2026-07-01",
			createdTo: "2026-07-31",
			pageSize: 20,
			projectId: PROJECT_ID,
			q: "amina",
			source: "facebook",
			status: "to_confirm",
		});

		expect(page.leads[0]?.projectName).toBe("Sahara Serum");
		expect(apiClient.get).toHaveBeenCalledWith(leadsRoutes.listForWorkspace, {
			query: {
				archived: "only",
				cursor: "cursor-1",
				createdFrom: "2026-07-01",
				createdTo: "2026-07-31",
				pageSize: 20,
				projectId: PROJECT_ID,
				q: "amina",
				source: "facebook",
				status: "to_confirm",
			},
		});
	});

	it("fails loudly on a drifted payload", async () => {
		vi.mocked(apiClient.get).mockResolvedValueOnce({
			leads: [{ nope: true }],
			nextCursor: null,
			total: 1,
		});

		await expect(
			listWorkspaceLeads({ archived: "exclude", pageSize: 20 }),
		).rejects.toThrowError();
	});
});
