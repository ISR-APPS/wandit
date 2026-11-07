/**
 * Resolves the caller's access to one project from the project row, never from the workspace header.
 * ProjectAccessGuard calls it on every `:projectId` route; the sharing services can call it too.
 * It reads ProjectsRepository.findAccessFacts and applies the rules of `project-access.ts`.
 */
import { Inject, Injectable } from "@nestjs/common";

import {
	type ResolvedProjectAccess,
	resolveProjectAccess,
} from "../../domain/project-access";
import { ProjectsRepository } from "../../infrastructure/persistence/projects.repository";

@Injectable()
export class ProjectAccessService {
	constructor(
		@Inject(ProjectsRepository) private readonly projects: ProjectsRepository,
	) {}

	/**
	 * Access of `userId` to the live project `projectId` (design 3.3). Null for
	 * a missing or deleted project, and for no role: the caller answers 404.
	 */
	async resolve(
		userId: string,
		projectId: string,
	): Promise<ResolvedProjectAccess | null> {
		const facts = await this.projects.findAccessFacts(projectId, userId);

		return facts === null ? null : resolveProjectAccess(facts, userId);
	}
}
