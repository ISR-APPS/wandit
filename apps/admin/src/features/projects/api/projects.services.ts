import { adminRoutes } from "@wandit/contracts";

import { apiGet } from "@/lib/api-client";

import type { AdminProjectDetail } from "./projects.dto";

export function getAdminProject(
	projectId: string,
): Promise<AdminProjectDetail> {
	return apiGet<AdminProjectDetail>(adminRoutes.project(projectId));
}
