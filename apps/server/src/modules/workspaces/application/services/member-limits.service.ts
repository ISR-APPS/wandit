/**
 * Reads and writes the member credit limits of one workspace.
 * MemberLimitsController calls it for a team workspace and for the caller's own personal workspace.
 * It reads people through WorkspaceMembersRepository and limits through OrganizationLimitsRepository.
 */
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
	centiCreditsToCredits,
	creditsToCentiCredits,
	type PutWorkspaceMemberLimitsBody,
	type WorkspaceMemberLimitsResponse,
} from "@wandit/contracts";

import { orgOwner, userOwner } from "../../../credits/domain/credit-owner";
import {
	type WorkspaceMembership,
	WorkspaceMembersRepository,
} from "../../infrastructure/persistence/members.repository";
import { OrganizationLimitsRepository } from "../../infrastructure/persistence/organization-limits.repository";

/**
 * The workspace whose limits the route reads or writes. `personalOwnerUserId`
 * is set for a personal workspace: its limit rows bind the owner's personal pool.
 */
export type LimitsWorkspace = Pick<
	WorkspaceMembership,
	"organizationId" | "personalOwnerUserId"
>;

@Injectable()
export class MemberLimitsService {
	constructor(
		@Inject(WorkspaceMembersRepository)
		private readonly members: WorkspaceMembersRepository,
		@Inject(OrganizationLimitsRepository)
		private readonly limits: OrganizationLimitsRepository,
	) {}

	/** Members first, then external project collaborators: both spend the pool. */
	async get(
		workspace: LimitsWorkspace,
	): Promise<WorkspaceMemberLimitsResponse> {
		const [people, settings, limitRows] = await Promise.all([
			this.listLimitTargets(workspace),
			this.limits.findSettings(workspace.organizationId),
			this.limits.listMemberLimits(workspace.organizationId),
		]);
		const limitByUser = new Map(
			limitRows.map((row) => [row.userId, row.monthlyCreditLimit]),
		);
		const now = new Date();
		const spentByUser = new Map<string, number>();

		// Members are bounded by membershipLimit. No limit caps external
		// collaborators. This is a settings screen, so sequential sums are enough.
		// LIMIT: one spend query per person, members plus collaborators. Upgrade: one grouped sum query.
		for (const person of people) {
			spentByUser.set(
				person.userId,
				await this.spentThisMonth(workspace, person.userId, now),
			);
		}

		// Stored limits and spend sums are internal centi-credits; the API
		// exposes limits in whole credits (stored x100) and spend as decimal
		// credits.
		const defaultLimit = settings?.defaultMemberMonthlyCreditLimit ?? null;

		return {
			defaultMemberMonthlyCreditLimit:
				defaultLimit === null ? null : centiCreditsToCredits(defaultLimit),
			members: people.map((person) => {
				const limit = limitByUser.get(person.userId) ?? null;

				return {
					email: person.email,
					monthlyCreditLimit:
						limit === null ? null : centiCreditsToCredits(limit),
					name: person.name,
					spentThisMonth: centiCreditsToCredits(
						spentByUser.get(person.userId) ?? 0,
					),
					userId: person.userId,
				};
			}),
		};
	}

	/**
	 * Writes the default limit and per-person limits. 400 for a target that is
	 * not a member or a collaborator, and for a limit on the personal owner.
	 */
	async update(
		workspace: LimitsWorkspace,
		body: PutWorkspaceMemberLimitsBody,
		actorUserId: string,
	): Promise<WorkspaceMemberLimitsResponse> {
		const people = await this.listLimitTargets(workspace);
		const targetIds = new Set(people.map((person) => person.userId));

		for (const entry of body.members ?? []) {
			if (!targetIds.has(entry.userId)) {
				throw new BadRequestException(
					"Credit limits can only target current workspace members and project collaborators",
				);
			}

			// Product rule: the money of a personal workspace is the owner's, so
			// the owner has no limit. A null entry deletes nothing and stays allowed.
			if (
				entry.userId === workspace.personalOwnerUserId &&
				entry.monthlyCreditLimit !== null
			) {
				throw new BadRequestException(
					"The owner of a personal workspace cannot have a credit limit",
				);
			}
		}

		// The pool credit lock serializes these writes against in-flight
		// metering reserves (which hold the same lock while they check the
		// limit). A personal workspace locks the owner's personal pool.
		// Limit inputs arrive in whole credits; storage (and the metering gate
		// that reads it) is centi-credits — multiply exactly once here.
		const pool =
			workspace.personalOwnerUserId === null
				? orgOwner(workspace.organizationId)
				: userOwner(workspace.personalOwnerUserId);

		await this.limits.withPoolCreditLock(pool, async (tx) => {
			if (body.defaultMemberMonthlyCreditLimit !== undefined) {
				await this.limits.upsertSettings(
					workspace.organizationId,
					body.defaultMemberMonthlyCreditLimit === null
						? null
						: creditsToCentiCredits(body.defaultMemberMonthlyCreditLimit),
					actorUserId,
					tx,
				);
			}

			for (const entry of body.members ?? []) {
				if (entry.monthlyCreditLimit === null) {
					await this.limits.deleteMemberLimit(
						workspace.organizationId,
						entry.userId,
						tx,
					);
				} else {
					await this.limits.upsertMemberLimit(
						workspace.organizationId,
						entry.userId,
						creditsToCentiCredits(entry.monthlyCreditLimit),
						actorUserId,
						tx,
					);
				}
			}
		});

		return this.get(workspace);
	}

	private async listLimitTargets(
		workspace: LimitsWorkspace,
	): Promise<{ userId: string; name: string; email: string }[]> {
		const [memberRows, collaborators] = await Promise.all([
			this.members.listMembersWithUsers(workspace.organizationId),
			this.members.listExternalCollaborators(workspace),
		]);

		return [...memberRows, ...collaborators];
	}

	// A team workspace spends its org pool; a personal one spends the owner's pool.
	private spentThisMonth(
		workspace: LimitsWorkspace,
		userId: string,
		now: Date,
	): Promise<number> {
		return workspace.personalOwnerUserId === null
			? this.limits.sumMemberSpendThisMonth(
					workspace.organizationId,
					userId,
					now,
				)
			: this.limits.sumPersonalPoolMemberSpendThisMonth(
					workspace.personalOwnerUserId,
					userId,
					now,
				);
	}
}
