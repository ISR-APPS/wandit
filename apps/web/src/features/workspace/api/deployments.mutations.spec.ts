import { QueryClient } from "@tanstack/react-query";
import type { DeploymentCurrent } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import { applyDeploymentCurrent } from "./deployments.mutations";
import { deploymentKeys } from "./deployments.queries";

const previous: DeploymentCurrent = {
	activeDeploymentId: "11111111-1111-4111-8111-111111111111",
	error: null,
	liveUrl: "https://old-name.wandit.app",
	pendingVersionId: null,
	publishedAt: "2026-08-11T10:00:00.000Z",
	publishedVersionId: "22222222-2222-4222-8222-222222222222",
	slug: "old-name",
	uiState: "published",
};

const renamed: DeploymentCurrent = {
	...previous,
	liveUrl: "https://new-name.wandit.app",
	publishedAt: "2026-08-11T10:01:00.000Z",
	slug: "new-name",
};

describe("applyDeploymentCurrent", () => {
	it("seeds the renamed deployment before scheduling refetches", () => {
		const projectId = "project-1";
		const queryClient = new QueryClient();
		queryClient.setQueryData(deploymentKeys.current(projectId), previous);
		const setQueryData = vi.spyOn(queryClient, "setQueryData");
		const invalidateQueries = vi
			.spyOn(queryClient, "invalidateQueries")
			.mockResolvedValue();

		applyDeploymentCurrent(queryClient, projectId, renamed);

		expect(queryClient.getQueryData(deploymentKeys.current(projectId))).toEqual(
			renamed,
		);
		expect(setQueryData).toHaveBeenCalledWith(
			deploymentKeys.current(projectId),
			renamed,
		);
		expect(setQueryData.mock.invocationCallOrder[0]).toBeLessThan(
			invalidateQueries.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
		);
		expect(invalidateQueries).toHaveBeenCalledWith({
			queryKey: deploymentKeys.slugs(projectId),
		});
	});
});
