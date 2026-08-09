import {
	type CreateProjectBody,
	type CreateProjectResponse,
	type ListProjectsResponse,
	type ProjectByIdResponse,
	createProjectBodySchema,
	createProjectResponseSchema,
	listProjectsResponseSchema,
	projectByIdResponseSchema,
	projectsRoutes,
} from "@wandit/contracts";

import { apiClient } from "@/shared/lib/api-client";

/**
 * projects.requests.ts — raw backend calls for projects.
 *
 * Each function sends one request through the shared apiClient, then validates
 * the unwrapped response against the shared @wandit/contracts schemas.
 */

// GET /api/v1/projects
export async function listProjects(): Promise<ListProjectsResponse> {
	const data = await apiClient.get<ListProjectsResponse>(projectsRoutes.list);
	return listProjectsResponseSchema.parse(data);
}

// GET /api/v1/projects/:projectId
export async function getProject(
	projectId: string,
): Promise<ProjectByIdResponse> {
	const data = await apiClient.get<ProjectByIdResponse>(
		projectsRoutes.byId(projectId),
	);
	return projectByIdResponseSchema.parse(data);
}

// POST /api/v1/projects
export async function createProject(
	input: CreateProjectBody,
): Promise<CreateProjectResponse> {
	const body = createProjectBodySchema.parse(input);
	const data = await apiClient.post<CreateProjectResponse, CreateProjectBody>(
		projectsRoutes.create,
		body,
	);
	return createProjectResponseSchema.parse(data);
}
