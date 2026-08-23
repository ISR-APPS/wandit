import {
	type CreateProjectBody,
	type CreateProjectResponse,
	createProjectBodySchema,
	createProjectResponseSchema,
	type ListProjectsPageResponse,
	type ListProjectsQuery,
	type ListProjectsResponse,
	listProjectsPageResponseSchema,
	listProjectsQuerySchema,
	listProjectsResponseSchema,
	type ProjectByIdResponse,
	projectByIdResponseSchema,
	projectsRoutes,
	type UpdateProjectBody,
	type UpdateProjectResponse,
	updateProjectBodySchema,
	updateProjectResponseSchema,
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

// GET /api/v1/projects/paged
export async function listProjectsPaged(
	query: ListProjectsQuery,
): Promise<ListProjectsPageResponse> {
	const parsedQuery = listProjectsQuerySchema.parse(query);
	const data = await apiClient.get<ListProjectsPageResponse>(
		projectsRoutes.paged,
		{ query: parsedQuery },
	);
	return listProjectsPageResponseSchema.parse(data);
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

// PATCH /api/v1/projects/:projectId
export async function updateProject(
	projectId: string,
	input: UpdateProjectBody,
): Promise<UpdateProjectResponse> {
	const body = updateProjectBodySchema.parse(input);
	const data = await apiClient.patch<UpdateProjectResponse, UpdateProjectBody>(
		projectsRoutes.update(projectId),
		body,
	);
	return updateProjectResponseSchema.parse(data);
}

// DELETE /api/v1/projects/:projectId (soft delete, empty response)
export async function deleteProject(projectId: string): Promise<void> {
	await apiClient.delete(projectsRoutes.delete(projectId));
}
