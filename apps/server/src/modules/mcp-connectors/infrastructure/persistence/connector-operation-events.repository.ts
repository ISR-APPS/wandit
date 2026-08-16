import { Inject, Injectable } from "@nestjs/common";
import { sql } from "@wandit/db";
import { connectorOperationEvents } from "@wandit/db/schema/connector-operation-events";
import { aiUsageEvents } from "@wandit/db/schema/credits";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type ConnectorOperationEventInput = {
	connectorSlug: string;
	durationMs: number;
	errorCode: string | null;
	errorMessage: string | null;
	feature: "ads_analysis" | "ads_launch" | "other";
	organizationId: string | null;
	parentEventId?: string;
	status: "failed" | "succeeded";
	toolName: string;
	userId: string;
};

@Injectable()
export class ConnectorOperationEventsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async insert(input: ConnectorOperationEventInput): Promise<void> {
		await this.buildInsert(input);
	}

	private buildInsert(input: ConnectorOperationEventInput) {
		const parentChatId = input.parentEventId
			? sql<string | null>`(
					select ${aiUsageEvents.chatId}
					from ${aiUsageEvents}
					where ${aiUsageEvents.id} = ${input.parentEventId}
					limit 1
				)`
			: null;
		const parentMessageId = input.parentEventId
			? sql<string | null>`(
					select ${aiUsageEvents.messageId}
					from ${aiUsageEvents}
					where ${aiUsageEvents.id} = ${input.parentEventId}
					limit 1
				)`
			: null;

		return this.db.insert(connectorOperationEvents).values({
			chatId: parentChatId,
			connectorSlug: input.connectorSlug,
			durationMs: input.durationMs,
			errorCode: input.errorCode,
			errorMessage: input.errorMessage,
			feature: input.feature,
			messageId: parentMessageId,
			organizationId: input.organizationId,
			status: input.status,
			toolName: input.toolName,
			userId: input.userId,
		});
	}
}
