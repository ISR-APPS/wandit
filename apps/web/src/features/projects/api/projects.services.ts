// Raw async functions for this entity — NO React in here. Currently mock
// implementations over lib/mock-projects.ts with realistic latency; they
// become thin fetch wrappers over the shared api-client (src/lib/api-client)
// once the NestJS backend lands, responses parsed by packages/contracts.

import {
	createMockProject,
	deleteMockProject,
	getMockProject,
	listMockProjects,
	renameMockProject,
} from "../lib/mock-projects";
import type { Project } from "./dto";

const latency = () =>
	new Promise<void>((resolve) =>
		setTimeout(resolve, 500 + Math.random() * 200),
	);

export async function listProjects(): Promise<Project[]> {
	await latency();
	return listMockProjects();
}

export async function getProject(id: string): Promise<Project> {
	await latency();
	const project = getMockProject(id);
	if (!project) throw new Error("Project not found");
	return project;
}

export async function createProject(prompt: string): Promise<Project> {
	await latency();
	return createMockProject(prompt);
}

export async function renameProject(
	id: string,
	name: string,
): Promise<Project> {
	await latency();
	return renameMockProject(id, name);
}

export async function deleteProject(id: string): Promise<void> {
	await latency();
	deleteMockProject(id);
}
