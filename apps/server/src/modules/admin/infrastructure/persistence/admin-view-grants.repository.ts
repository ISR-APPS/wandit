import { Inject, Injectable } from "@nestjs/common";
import { type AdminView, adminViews } from "@wandit/auth/admin-permissions";
import { eq } from "@wandit/db";
import { adminViewGrants } from "@wandit/db/schema/admin-view-grants";
import { user } from "@wandit/db/schema/auth";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

type AdminViewGrantsClient = Pick<Database, "delete" | "insert" | "select">;

@Injectable()
export class AdminViewGrantsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async findSupportAccess(
		userId: string,
		client: AdminViewGrantsClient = this.db,
	): Promise<{ role: string; views: string[] | null } | null> {
		const [row] = await client
			.select({ role: user.role, views: adminViewGrants.views })
			.from(user)
			.leftJoin(adminViewGrants, eq(adminViewGrants.userId, user.id))
			.where(eq(user.id, userId))
			.limit(1);

		return row ?? null;
	}

	async findViews(
		userId: string,
		client: AdminViewGrantsClient = this.db,
	): Promise<string[] | null> {
		const [row] = await client
			.select({ views: adminViewGrants.views })
			.from(adminViewGrants)
			.where(eq(adminViewGrants.userId, userId))
			.limit(1);

		return row?.views ?? null;
	}

	async upsertViews(
		userId: string,
		views: readonly string[],
		updatedByUserId: string,
		client: AdminViewGrantsClient = this.db,
	): Promise<void> {
		const uniqueViews = [...new Set(views)];

		if (uniqueViews.length === 0) {
			throw new Error("admin view grants must contain at least one view");
		}

		const now = new Date();

		await client
			.insert(adminViewGrants)
			.values({
				updatedByUserId,
				userId,
				views: uniqueViews,
			})
			.onConflictDoUpdate({
				target: adminViewGrants.userId,
				set: {
					updatedAt: now,
					updatedByUserId,
					views: uniqueViews,
				},
			});
	}

	async deleteViews(
		userId: string,
		client: AdminViewGrantsClient = this.db,
	): Promise<void> {
		await client
			.delete(adminViewGrants)
			.where(eq(adminViewGrants.userId, userId));
	}
}

export function filterKnownAdminViews(
	views: readonly string[] | null,
): AdminView[] | null {
	if (views === null) return null;

	return [
		...new Set(
			views.filter((view): view is AdminView =>
				(adminViews as readonly string[]).includes(view),
			),
		),
	];
}
