import type { WorkspaceLeadsResponse } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({
	apiClient: {
		get: vi.fn(),
	},
}));

import { apiClient } from "@/lib/api-client";
import {
	listAllWorkspaceLeads,
	listWorkspaceLeads,
} from "./workspace-leads.services";

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

describe("listAllWorkspaceLeads", () => {
	it("throws when the API repeats a cursor, so the export cannot loop forever", async () => {
		vi.mocked(apiClient.get)
			.mockResolvedValueOnce({ ...RESPONSE, nextCursor: "cursor-1" })
			.mockResolvedValueOnce({ ...RESPONSE, nextCursor: "cursor-1" });

		await expect(
			listAllWorkspaceLeads({ archived: "include" }),
		).rejects.toThrowError("repeated cursor");
	});
});
