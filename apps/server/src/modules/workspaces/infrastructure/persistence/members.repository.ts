import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq } from "@wandit/db";
import { user } from "@wandit/db/schema/auth";
import { member, organization } from "@wandit/db/schema/organizations";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type MemberRow = typeof member.$inferSelect;

export type MembershipWithOrganization = {
	member: MemberRow;
	organization: {
		id: string;
		name: string;
		slug: string;
		logo: string | null;
		createdAt: Date;
	};
};

@Injectable()
export class WorkspaceMembersRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async findMember(
		organizationId: string,
		userId: string,
	): Promise<MemberRow | null> {
		const rows = await this.db
			.select()
			.from(member)
			.where(
				and(
					eq(member.organizationId, organizationId),
					eq(member.userId, userId),
				),
			)
			.limit(1);

		return rows[0] ?? null;
	}

	async findOrganization(organizationId: string): Promise<{
		id: string;
		name: string;
		slug: string;
	} | null> {
		const [row] = await this.db
			.select({
				id: organization.id,
				name: organization.name,
				slug: organization.slug,
			})
			.from(organization)
			.where(eq(organization.id, organizationId))
			.limit(1);

		return row ?? null;
	}

	/**
	 * The org's earliest owner-role member — the affiliate-attribution human
	 * for the org's Stripe customer. Roles are comma-separated multi-values,
	 * so filtering happens after the ordered fetch.
	 */
	async findEarliestOwnerUserId(
		organizationId: string,
	): Promise<string | null> {
		const rows = await this.db
			.select({ createdAt: member.createdAt, role: member.role, userId: member.userId })
			.from(member)
			.where(eq(member.organizationId, organizationId))
			.orderBy(asc(member.createdAt), asc(member.id));

		for (const row of rows) {
			const roles = row.role.split(",").map((value) => value.trim());

			if (roles.includes("owner")) {
				return row.userId;
			}
		}

		return null;
	}

	async listMembersWithUsers(organizationId: string): Promise<
		{
			userId: string;
			name: string;
			email: string;
			role: string;
			joinedAt: Date;
		}[]
	> {
		return this.db
			.select({
				email: user.email,
				joinedAt: member.createdAt,
				name: user.name,
				role: member.role,
				userId: member.userId,
			})
			.from(member)
			.innerJoin(user, eq(user.id, member.userId))
			.where(eq(member.organizationId, organizationId))
			.orderBy(asc(member.createdAt));
	}

	async listUserMemberships(
		userId: string,
	): Promise<MembershipWithOrganization[]> {
		const rows = await this.db
			.select({
				member,
				organization: {
					createdAt: organization.createdAt,
					id: organization.id,
					logo: organization.logo,
					name: organization.name,
					slug: organization.slug,
				},
			})
			.from(member)
			.innerJoin(organization, eq(organization.id, member.organizationId))
			.where(eq(member.userId, userId))
			.orderBy(asc(organization.createdAt));

		return rows;
	}
}
