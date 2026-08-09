import { Inject, Injectable } from "@nestjs/common";
import {
	type ListWorkspacesResponse,
	workspaceRoleNames,
	type WorkspaceRoleName,
} from "@wandit/contracts";

import { WorkspaceMembersRepository } from "../../infrastructure/persistence/members.repository";

@Injectable()
export class WorkspacesService {
	constructor(
		@Inject(WorkspaceMembersRepository)
		private readonly members: WorkspaceMembersRepository,
	) {}

	async listForUser(userId: string): Promise<ListWorkspacesResponse> {
		const memberships = await this.members.listUserMemberships(userId);

		return {
			workspaces: memberships.map(({ member, organization }) => ({
				createdAt: organization.createdAt.toISOString(),
				id: organization.id,
				logo: organization.logo,
				name: organization.name,
				role: member.role,
				roles: parseKnownRoles(member.role),
				slug: organization.slug,
			})),
		};
	}
}

function parseKnownRoles(roleValue: string): WorkspaceRoleName[] {
	const known = new Set<string>(workspaceRoleNames);

	return roleValue
		.split(",")
		.map((name) => name.trim())
		.filter((name): name is WorkspaceRoleName => known.has(name));
}
