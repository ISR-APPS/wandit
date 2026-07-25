/**
 * Raw HTTP service functions for the projects feature.
 *
 * Flow position:
 * - Project queries/mutations call these functions from the web app.
 * - createProject() is the important AI-chat entry point: PromptBox metadata
 *   reaches this layer through useCreateProjectWithPrompt().
 * - NestJS is the server-side Node framework handling these API routes.
 * - The NestJS API creates the project/chat pair, enqueues first generation,
 *   and returns { projectId, chatId } so the browser can navigate to workspace.
 *
 * Gotchas:
 * - Keep this file free of React state; caching belongs in query/mutation files.
 * - Every response is parsed here so contract drift fails near the network edge.
 */
// Raw async functions for this entity — NO React in here. Thin fetch wrappers
// over the shared api-client (src/lib/api-client), which unwraps the
// { data, meta } envelope; responses are parsed with @wandit/contracts schemas
// so a drift between server and client fails loudly here.

// Zod is the runtime validation library behind @wandit/contracts; parse()
// checks unknown API data before the rest of the app trusts its TypeScript type.
import {
	createProjectResponseSchema,
	listProjectsResponseSchema,
	projectByIdResponseSchema,
	projectsRoutes,
	updateProjectResponseSchema,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";
import type { CreateProjectBody, CreateProjectResponse, Project } from "./dto";

// TanStack Query is the client caching library that stores server responses
// under query keys; this service stays below that cache layer.
// Load the dashboard/project grid list. The query layer wraps this with
// TanStack Query caching; this function only performs the fetch and validation.
export async function listProjects(): Promise<Project[]> {
	const data = await apiClient.get<unknown>(projectsRoutes.list);
	// Parse unknown JSON into the shared Project[] shape before returning it.
	return listProjectsResponseSchema.parse(data);
}

// Load one project by id, usually for the workspace shell or detail views.
export async function getProject(id: string): Promise<Project> {
	const data = await apiClient.get<unknown>(projectsRoutes.byId(id));
	return projectByIdResponseSchema.parse(data);
}

// Create-with-prompt returns ids only ({ projectId, chatId }); the caller
// navigates to /p/{projectId} while the first generation streams into the chat.
// This is the handoff from the PromptBox/start screen into the AI generation
// pipeline. The server owns project/chat creation and job enqueueing.
export async function createProject(
	body: CreateProjectBody,
): Promise<CreateProjectResponse> {
	const data = await apiClient.post<unknown>(projectsRoutes.create, body);
	return createProjectResponseSchema.parse(data);
}

// Rename one project. The mutation layer updates cached list/detail data after
// this returns the full updated project from the API.
export async function renameProject(
	id: string,
	name: string,
): Promise<Project> {
	const data = await apiClient.patch<unknown>(projectsRoutes.update(id), {
		name,
	});
	return updateProjectResponseSchema.parse(data);
}

// Save the ad pixel ids injected into the published page at publish time.
// null clears a pixel; the server persists and echoes the full project.
export async function updateProjectPixels(
	id: string,
	pixels: { metaPixelId: string | null; tiktokPixelId: string | null },
): Promise<Project> {
	const data = await apiClient.patch<unknown>(
		projectsRoutes.update(id),
		pixels,
	);
	return updateProjectResponseSchema.parse(data);
}

// Delete one project. No body is expected back, so there is no schema parse here.
// The mutation layer handles optimistic removal and rollback.
export async function deleteProject(id: string): Promise<void> {
	await apiClient.delete(projectsRoutes.delete(id));
}
