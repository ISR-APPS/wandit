/**
 * Sends a V2 project from `/p/$projectId` to `/app/$projectId` before the
 * V1 workspace loads. The `/p/$projectId` route loader calls it. Reads the
 * project through the projects feature query and throws the router redirect.
 */

import { redirect } from "@tanstack/react-router";
import type { Project } from "@wandit/contracts";

import { projectQuery } from "@/features/projects";
import { isApiClientError } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";

/**
 * Throws the redirect to `/app/$projectId` when the project engine is
 * `v2_app`. The `/p/$projectId` route loader calls it. `load` is the test
 * seam; production reads the shared query cache.
 */
export async function redirectV2Project(
	projectId: string,
	load: (projectId: string) => Promise<Pick<Project, "engine">> = (id) =>
		queryClient.ensureQueryData(projectQuery(id)),
): Promise<void> {
	let project: Pick<Project, "engine">;
	try {
		project = await load(projectId);
	} catch (error) {
		// A missing project is the V1 not-found screen, not a router error.
		if (isApiClientError(error) && error.statusCode === 404) return;
		throw error;
	}
	// A project never changes engine after creation (contracts D11), so the
	// redirect is stable across reloads.
	if (project.engine === "v2_app") {
		throw redirect({
			to: "/app/$projectId",
			params: { projectId },
			replace: true,
		});
	}
}
