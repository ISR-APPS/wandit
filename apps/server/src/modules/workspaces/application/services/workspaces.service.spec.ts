import { describe, expect, it } from "vitest";

import type { WorkspaceMembersRepository } from "../../infrastructure/persistence/members.repository";
import { WorkspacesService } from "./workspaces.service";

type PersonalWorkspace = { id: string; hasOwnerMember: boolean };

function setup(input: {
	/** Answers of insertPersonalWorkspace, in call order. Null: a unique constraint refused the org. */
	insertResults: (string | null)[];
	/** Answers of findPersonalWorkspace, in call order. Null when the list is empty. */
	findResults?: (PersonalWorkspace | null)[];
}) {
	const insertedSlugs: string[] = [];
	const repairedOwnerMembers: { organizationId: string; userId: string }[] = [];
	const repository: Pick<
		WorkspaceMembersRepository,
		| "findPersonalWorkspace"
		| "findUserNameAndEmail"
		| "insertPersonalOwnerMember"
		| "insertPersonalWorkspace"
	> = {
		findPersonalWorkspace: async () => input.findResults?.shift() ?? null,
		findUserNameAndEmail: async () => ({
			email: "zack@example.com",
			name: "Zack Doe",
		}),
		insertPersonalOwnerMember: async (organizationId, userId) => {
			repairedOwnerMembers.push({ organizationId, userId });
		},
		insertPersonalWorkspace: async ({ slug }) => {
			insertedSlugs.push(slug);
			return input.insertResults.shift() ?? null;
		},
	};

	return {
		insertedSlugs,
		repairedOwnerMembers,
		// SAFETY: ensurePersonalWorkspace calls only the four methods above.
		service: new WorkspacesService(repository as WorkspaceMembersRepository),
	};
}

describe("WorkspacesService.ensurePersonalWorkspace", () => {
	it("retries once with a new random slug when the first slug is taken", async () => {
		const { insertedSlugs, service } = setup({
			insertResults: [null, "org_personal"],
		});

		await expect(service.ensurePersonalWorkspace("user_1")).resolves.toBe(
			"org_personal",
		);
		expect(insertedSlugs).toHaveLength(2);
		expect(insertedSlugs[0]).not.toBe(insertedSlugs[1]);
		expect(
			insertedSlugs.every((slug) => /^personal-[0-9a-f]{16}$/.test(slug)),
		).toBe(true);
	});

	it("returns the org of a parallel request and does not insert again", async () => {
		const { insertedSlugs, service } = setup({
			findResults: [null, { hasOwnerMember: true, id: "org_1" }],
			insertResults: [null],
		});

		await expect(service.ensurePersonalWorkspace("user_1")).resolves.toBe(
			"org_1",
		);
		expect(insertedSlugs).toHaveLength(1);
	});

	it("adds the owner member row when the personal org exists without it", async () => {
		const { insertedSlugs, repairedOwnerMembers, service } = setup({
			findResults: [{ hasOwnerMember: false, id: "org_1" }],
			insertResults: [],
		});

		await expect(service.ensurePersonalWorkspace("user_1")).resolves.toBe(
			"org_1",
		);
		expect(repairedOwnerMembers).toEqual([
			{ organizationId: "org_1", userId: "user_1" },
		]);
		expect(insertedSlugs).toHaveLength(0);
	});
});
