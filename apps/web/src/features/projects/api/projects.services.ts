// Raw async functions for this entity — NO React in here. Thin fetch wrappers
// over the shared api-client (src/lib/api-client), which unwraps the
// { data, meta } envelope; responses are parsed with @wandit/contracts schemas
// so a drift between server and client fails loudly here.

import {
	createProjectResponseSchema,
	listProjectsResponseSchema,
	projectByIdResponseSchema,
	projectsRoutes,
	updateProjectResponseSchema,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";
import type { CreateProjectBody, CreateProjectResponse, Project } from "./dto";

export async function listProjects(): Promise<Project[]> {
	const data = await apiClient.get<unknown>(projectsRoutes.list);
	return listProjectsResponseSchema.parse(data);
}

export async function getProject(id: string): Promise<Project> {
	const data = await apiClient.get<unknown>(projectsRoutes.byId(id));
	return projectByIdResponseSchema.parse(data);
}

// Create-with-prompt returns ids only ({ projectId, chatId }); the caller
// navigates to /p/{projectId} while the first generation streams into the chat.
export async function createProject(
	body: CreateProjectBody,
): Promise<CreateProjectResponse> {
	const data = await apiClient.post<unknown>(projectsRoutes.create, body);
	return createProjectResponseSchema.parse(data);
}

export async function renameProject(
	id: string,
	name: string,
): Promise<Project> {
	const data = await apiClient.patch<unknown>(projectsRoutes.update(id), {
		name,
	});
	return updateProjectResponseSchema.parse(data);
}

export async function deleteProject(id: string): Promise<void> {
	await apiClient.delete(projectsRoutes.delete(id));
}
