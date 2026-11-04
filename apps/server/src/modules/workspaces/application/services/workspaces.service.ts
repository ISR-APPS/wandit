/**
 * Lists the workspaces of a user and makes sure each user has a personal workspace.
 * WorkspacesController, WorkspaceSharingController, and the signup hook in AuthModule call it.
 * It reads and writes `organization` and `member` through WorkspaceMembersRepository.
 */
import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { PERSONAL_WORKSPACE_SLUG_PREFIX } from "@wandit/auth/workspace-membership-rules";
import {
	type ListWorkspaceCollaboratorsResponse,
	type ListWorkspacesResponse,
	type WorkspaceCollaborator,
	type WorkspaceRoleName,
	type WorkspaceSummary,
	workspaceRoleNames,
} from "@wandit/contracts";

import type { ProjectScope } from "../../../projects/domain/project-scope";
import { WorkspaceMembersRepository } from "../../infrastructure/persistence/members.repository";

/** Longest personal workspace name. Migration 0091 uses the same rule. */
const PERSONAL_WORKSPACE_NAME_MAX = 50;

const PERSONAL_WORKSPACE_NAME_SUFFIX = "'s workspace";

/** 8 random bytes give 16 hex characters, the same length as migration 0091. */
const PERSONAL_WORKSPACE_SLUG_RANDOM_BYTES = 8;

/** One insert, plus one retry with a new slug when the first slug is taken. */
const PERSONAL_WORKSPACE_INSERT_ATTEMPTS = 2;

@Injectable()
export class WorkspacesService {
	constructor(
		@Inject(WorkspaceMembersRepository)
		private readonly members: WorkspaceMembersRepository,
	) {}

	/**
	 * Every workspace of the user: the own personal workspace first (created
	 * here when it is missing), then every other membership by creation date.
	 */
	async listForUser(userId: string): Promise<ListWorkspacesResponse> {
		await this.ensurePersonalWorkspace(userId);
		const memberships = await this.members.listUserMemberships(userId);

		const workspaces = memberships.map(
			({ member, organization }): WorkspaceSummary => ({
				createdAt: organization.createdAt.toISOString(),
				id: organization.id,
				isOwnPersonal: organization.personalOwnerUserId === userId,
				kind: organization.personalOwnerUserId === null ? "team" : "personal",
				logo: organization.logo,
				name: organization.name,
				role: member.role,
				roles: parseKnownRoles(member.role),
				slug: organization.slug,
			}),
		);

		return {
			workspaces: [
				...workspaces.filter((workspace) => workspace.isOwnPersonal),
				...workspaces.filter((workspace) => !workspace.isOwnPersonal),
			],
		};
	}

	/**
	 * External collaborators of one workspace, each with the projects that the caller can open.
	 * The rows come sorted by user, so one pass groups them.
	 */
	async listCollaborators(input: {
		/** The caller's scope in this workspace; it applies the Restricted rule. */
		scope: ProjectScope;
		/** The workspace organization id. */
		organizationId: string;
	}): Promise<ListWorkspaceCollaboratorsResponse> {
		const grants = await this.members.listCollaboratorGrants(input);
		const collaborators: WorkspaceCollaborator[] = [];

		for (const grant of grants) {
			const last = collaborators.at(-1);
			const project = {
				projectId: grant.projectId,
				projectName: grant.projectName,
				role: grant.role,
			};
			if (last?.userId === grant.userId) {
				last.projects.push(project);
				continue;
			}
			collaborators.push({
				email: grant.email,
				image: grant.image,
				name: grant.name,
				projects: [project],
				userId: grant.userId,
			});
		}

		return { collaborators };
	}

	/**
	 * Creates the personal workspace with its owner member row when the
	 * workspace is missing, and returns the org id. It also adds the owner
	 * member row when only that row is missing. A second call is a no-op.
	 * Throws when the user does not exist, or when two random slugs are both taken.
	 */
	async ensurePersonalWorkspace(userId: string): Promise<string> {
		const existing = await this.members.findPersonalWorkspace(userId);

		if (existing) {
			// The guard and listForUser find the workspace through the owner
			// member row. Without it, the owner gets 404 on the own workspace.
			if (!existing.hasOwnerMember) {
				await this.members.insertPersonalOwnerMember(existing.id, userId);
			}

			return existing.id;
		}

		const owner = await this.members.findUserNameAndEmail(userId);

		if (!owner) {
			throw new Error(
				`Cannot create a personal workspace: user ${userId} does not exist`,
			);
		}

		const name = personalWorkspaceName(owner.name, owner.email);

		for (
			let attempt = 0;
			attempt < PERSONAL_WORKSPACE_INSERT_ATTEMPTS;
			attempt += 1
		) {
			const slug = `${PERSONAL_WORKSPACE_SLUG_PREFIX}${randomBytes(PERSONAL_WORKSPACE_SLUG_RANDOM_BYTES).toString("hex")}`;
			const createdId = await this.members.insertPersonalWorkspace({
				name,
				slug,
				userId,
			});

			if (createdId) {
				return createdId;
			}

			// No row: a parallel request created the workspace and its owner member
			// row in one transaction, or the slug is taken. Only a taken slug retries.
			const concurrent = await this.members.findPersonalWorkspace(userId);

			if (concurrent) {
				return concurrent.id;
			}
		}

		throw new Error(
			`Cannot create a personal workspace for user ${userId}: the random slugs were taken`,
		);
	}
}

/**
 * "<first word of the name>'s workspace". The email local part replaces an
 * empty name. Only the word is cut (to 38 characters), so the suffix always
 * stays and the full name has 50 characters at most.
 */
function personalWorkspaceName(userName: string, email: string): string {
	const word = userName.match(/\S+/)?.[0] ?? email.split("@")[0] ?? "";
	const wordMax =
		PERSONAL_WORKSPACE_NAME_MAX - PERSONAL_WORKSPACE_NAME_SUFFIX.length;

	// Array.from counts code points, like the SQL left() of migration 0091.
	return `${Array.from(word).slice(0, wordMax).join("")}${PERSONAL_WORKSPACE_NAME_SUFFIX}`;
}

function parseKnownRoles(roleValue: string): WorkspaceRoleName[] {
	const known = new Set<string>(workspaceRoleNames);

	return roleValue
		.split(",")
		.map((name) => name.trim())
		.filter((name): name is WorkspaceRoleName => known.has(name));
}
