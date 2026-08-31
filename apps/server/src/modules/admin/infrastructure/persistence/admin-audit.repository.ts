import { Inject, Injectable } from "@nestjs/common";
import { sql } from "@wandit/db";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

const CONVERSATION_VIEWED_ACTION = "admin.conversation.viewed";

export type AdminConversationViewAuditInput = {
	adminUserId: string;
	requestId: string | null;
	targetId: string;
	targetUserId: string | null;
};

@Injectable()
export class AdminAuditRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async insertConversationViewIfAbsent(
		input: AdminConversationViewAuditInput,
		since: Date,
	): Promise<void> {
		await this.db.execute(sql`
			insert into admin_audit_events (
				admin_user_id,
				action,
				target_user_id,
				target_id,
				request_id
			)
			select
				${input.adminUserId},
				${CONVERSATION_VIEWED_ACTION},
				${input.targetUserId},
				${input.targetId},
				${input.requestId}
			where not exists (
				select 1
				from admin_audit_events recent
				where recent.admin_user_id = ${input.adminUserId}
					and recent.action = ${CONVERSATION_VIEWED_ACTION}
					and recent.target_id = ${input.targetId}
					and recent.created_at >= ${since}
			)
		`);
	}
}
