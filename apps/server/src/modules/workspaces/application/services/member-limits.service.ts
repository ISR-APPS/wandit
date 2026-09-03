import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
	centiCreditsToCredits,
	creditsToCentiCredits,
	type PutWorkspaceMemberLimitsBody,
	type WorkspaceMemberLimitsResponse,
} from "@wandit/contracts";

import { WorkspaceMembersRepository } from "../../infrastructure/persistence/members.repository";
import { OrganizationLimitsRepository } from "../../infrastructure/persistence/organization-limits.repository";

@Injectable()
export class MemberLimitsService {
	constructor(
		@Inject(WorkspaceMembersRepository)
		private readonly members: WorkspaceMembersRepository,
		@Inject(OrganizationLimitsRepository)
		private readonly limits: OrganizationLimitsRepository,
	) {}

	async get(organizationId: string): Promise<WorkspaceMemberLimitsResponse> {
		const [memberRows, settings, limitRows] = await Promise.all([
			this.members.listMembersWithUsers(organizationId),
			this.limits.findSettings(organizationId),
			this.limits.listMemberLimits(organizationId),
		]);
		const limitByUser = new Map(
			limitRows.map((row) => [row.userId, row.monthlyCreditLimit]),
		);
		const now = new Date();
		const spentByUser = new Map<string, number>();

		// Member counts are workspace-scale (bounded by membershipLimit), and this
		// is an admin settings screen — sequential per-member sums keep the
		// repository simple; revisit with a grouped query if it ever shows up hot.
		for (const memberRow of memberRows) {
			spentByUser.set(
				memberRow.userId,
				await this.limits.sumMemberSpendThisMonth(
					organizationId,
					memberRow.userId,
					now,
				),
			);
		}

		// Stored limits and spend sums are internal centi-credits; the API
		// exposes limits in whole credits (stored x100) and spend as decimal
		// credits.
		const defaultLimit = settings?.defaultMemberMonthlyCreditLimit ?? null;

		return {
			defaultMemberMonthlyCreditLimit:
				defaultLimit === null ? null : centiCreditsToCredits(defaultLimit),
			members: memberRows.map((memberRow) => {
				const limit = limitByUser.get(memberRow.userId) ?? null;

				return {
					email: memberRow.email,
					monthlyCreditLimit:
						limit === null ? null : centiCreditsToCredits(limit),
					name: memberRow.name,
					spentThisMonth: centiCreditsToCredits(
						spentByUser.get(memberRow.userId) ?? 0,
					),
					userId: memberRow.userId,
				};
			}),
		};
	}

	async update(
		organizationId: string,
		body: PutWorkspaceMemberLimitsBody,
		actorUserId: string,
	): Promise<WorkspaceMemberLimitsResponse> {
		const memberRows = await this.members.listMembersWithUsers(organizationId);
		const memberIds = new Set(memberRows.map((row) => row.userId));

		for (const entry of body.members ?? []) {
			if (!memberIds.has(entry.userId)) {
				throw new BadRequestException(
					"Credit limits can only target current workspace members",
				);
			}
		}

		// The org credit lock serializes these writes against in-flight metering
		// reserves (which hold the same lock while they check the limit).
		// Limit inputs arrive in whole credits; storage (and the metering gate
		// that reads it) is centi-credits — multiply exactly once here.
		await this.limits.withOrgCreditLock(organizationId, async (tx) => {
			if (body.defaultMemberMonthlyCreditLimit !== undefined) {
				await this.limits.upsertSettings(
					organizationId,
					body.defaultMemberMonthlyCreditLimit === null
						? null
						: creditsToCentiCredits(body.defaultMemberMonthlyCreditLimit),
					actorUserId,
					tx,
				);
			}

			for (const entry of body.members ?? []) {
				if (entry.monthlyCreditLimit === null) {
					await this.limits.deleteMemberLimit(organizationId, entry.userId, tx);
				} else {
					await this.limits.upsertMemberLimit(
						organizationId,
						entry.userId,
						creditsToCentiCredits(entry.monthlyCreditLimit),
						actorUserId,
						tx,
					);
				}
			}
		});

		return this.get(organizationId);
	}
}
