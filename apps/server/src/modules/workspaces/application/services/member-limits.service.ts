import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type {
	PutWorkspaceMemberLimitsBody,
	WorkspaceMemberLimitsResponse,
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

		return {
			defaultMemberMonthlyCreditLimit:
				settings?.defaultMemberMonthlyCreditLimit ?? null,
			members: memberRows.map((memberRow) => ({
				email: memberRow.email,
				monthlyCreditLimit: limitByUser.get(memberRow.userId) ?? null,
				name: memberRow.name,
				spentThisMonth: spentByUser.get(memberRow.userId) ?? 0,
				userId: memberRow.userId,
			})),
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
		await this.limits.withOrgCreditLock(organizationId, async (tx) => {
			if (body.defaultMemberMonthlyCreditLimit !== undefined) {
				await this.limits.upsertSettings(
					organizationId,
					body.defaultMemberMonthlyCreditLimit,
					actorUserId,
					tx,
				);
			}

			for (const entry of body.members ?? []) {
				if (entry.monthlyCreditLimit === null) {
					await this.limits.deleteMemberLimit(
						organizationId,
						entry.userId,
						tx,
					);
				} else {
					await this.limits.upsertMemberLimit(
						organizationId,
						entry.userId,
						entry.monthlyCreditLimit,
						actorUserId,
						tx,
					);
				}
			}
		});

		return this.get(organizationId);
	}
}
