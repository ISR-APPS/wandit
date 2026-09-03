import {
	projectAssetsRoutes,
	type WorkspaceAssetsResponse,
} from "@wandit/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({
	apiClient: {
		get: vi.fn(),
	},
}));

import { apiClient } from "@/lib/api-client";
import { listWorkspaceAssets } from "./workspace-assets.services";

const RESPONSE: WorkspaceAssetsResponse = {
	assets: [
		{
			createdAt: "2026-08-02T10:00:00.000Z",
			id: "33333333-3333-4333-8333-333333333333:1",
			key: "images/p1/a1/img-1.png",
			kind: "image",
			mediaType: "image/png",
			name: "Photo produit",
			projectId: "11111111-1111-4111-8111-111111111111",
			projectName: "Sahara Serum",
			sizeBytes: null,
			source: "image-generation",
			url: "https://assets.example.com/images/p1/a1/img-1.png",
		},
	],
	truncated: false,
};

describe("listWorkspaceAssets", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("hits the flat workspace route and parses assets with their projects", async () => {
		vi.mocked(apiClient.get).mockResolvedValueOnce(RESPONSE);

		const result = await listWorkspaceAssets();

		expect(result.truncated).toBe(false);
		expect(result.assets[0]?.projectName).toBe("Sahara Serum");
		expect(apiClient.get).toHaveBeenCalledWith(
			projectAssetsRoutes.listForWorkspace,
		);
	});

	it("fails loudly on a drifted asset row", async () => {
		// Valid envelope on purpose — the rejection must provably come from the
		// per-asset schema, not from a missing `truncated`.
		vi.mocked(apiClient.get).mockResolvedValueOnce({
			assets: [{}],
			truncated: false,
		});

		await expect(listWorkspaceAssets()).rejects.toThrowError();
	});
});
