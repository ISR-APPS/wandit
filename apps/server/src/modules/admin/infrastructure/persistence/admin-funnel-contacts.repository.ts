import { Inject, Injectable } from "@nestjs/common";
import { eq } from "@wandit/db";
import { adminFunnelContacts } from "@wandit/db/schema/admin-funnel-contacts";
import { user } from "@wandit/db/schema/auth";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type AdminFunnelContactRow = {
	contactedAt: Date;
	contactedBy: { id: string; name: string };
};

@Injectable()
export class AdminFunnelContactsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async set(userId: string, contactedByUserId: string): Promise<void> {
		const now = new Date();

		await this.db
			.insert(adminFunnelContacts)
			.values({
				userId,
				contactedByUserId,
				contactedAt: now,
			})
			// Last-write-wins: repeated marks reattribute the contact to the latest admin.
			.onConflictDoUpdate({
				target: adminFunnelContacts.userId,
				set: {
					contactedByUserId,
					contactedAt: now,
					updatedAt: now,
				},
			});
	}

	async clear(userId: string): Promise<void> {
		await this.db
			.delete(adminFunnelContacts)
			.where(eq(adminFunnelContacts.userId, userId));
	}

	async get(userId: string): Promise<AdminFunnelContactRow | null> {
		const [row] = await this.db
			.select({
				contactedAt: adminFunnelContacts.contactedAt,
				contactedByUserId: user.id,
				contactedByName: user.name,
			})
			.from(adminFunnelContacts)
			.innerJoin(user, eq(user.id, adminFunnelContacts.contactedByUserId))
			.where(eq(adminFunnelContacts.userId, userId))
			.limit(1);

		return row
			? {
					contactedAt: row.contactedAt,
					contactedBy: {
						id: row.contactedByUserId,
						name: row.contactedByName,
					},
				}
			: null;
	}
}
