import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, isNull, type SQL, sql } from "@wandit/db";
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
	/** Platform ids a successful ads write targeted or created; null when none. */
	targetEntityIds?: string[] | null;
	toolName: string;
	userId: string;
};

export type ConnectorOperationTargetInput = {
	connectorSlug: string;
	/** Scope: the organization when the actor has one, else the personal space. */
	organizationId: string | null;
	targetEntityIds: string[];
	userId: string;
};

@Injectable()
export class ConnectorOperationEventsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async insert(input: ConnectorOperationEventInput): Promise<void> {
		await this.buildInsert(input);
	}

	/**
	 * Most recent successful ads write (feature = ads_launch) made through the
	 * given connector against ANY of the platform entities, or null when
	 * Wandit never wrote to them. The rule is about the platform entity, not
	 * the actor: the lookup is scoped to the organization when the subject has
	 * one, else to the user's personal space. Feeds the 72-hour change-window
	 * guard.
	 */
	async findLatestWriteAt(
		input: ConnectorOperationTargetInput,
	): Promise<Date | null> {
		if (input.targetEntityIds.length === 0) {
			return null;
		}

		const scope: SQL | undefined =
			input.organizationId === null
				? and(
						eq(connectorOperationEvents.userId, input.userId),
						isNull(connectorOperationEvents.organizationId),
					)
				: eq(connectorOperationEvents.organizationId, input.organizationId);
		const ids = sql.join(
			input.targetEntityIds.map((id) => sql`${id}`),
			sql`, `,
		);

		const rows = await this.db
			.select({ createdAt: connectorOperationEvents.createdAt })
			.from(connectorOperationEvents)
			.where(
				and(
					scope,
					eq(connectorOperationEvents.connectorSlug, input.connectorSlug),
					eq(connectorOperationEvents.feature, "ads_launch"),
					eq(connectorOperationEvents.status, "succeeded"),
					sql`${connectorOperationEvents.targetEntityIds} && ARRAY[${ids}]::text[]`,
				),
			)
			.orderBy(desc(connectorOperationEvents.createdAt))
			.limit(1);

		return rows[0]?.createdAt ?? null;
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
			targetEntityIds:
				input.targetEntityIds && input.targetEntityIds.length > 0
					? input.targetEntityIds
					: null,
			toolName: input.toolName,
			userId: input.userId,
		});
	}
}
