// Read side of connector generations: the attempt state the chat card reads
// after the Realtime run settles (or while polling as a fallback).
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
	type ConnectorGenerationAttempt,
	connectorGenerationMediaSchema,
} from "@wandit/contracts";
import { z } from "zod";

import {
	type ConnectorGenerationAttemptRow,
	ConnectorGenerationsRepository,
} from "../../infrastructure/persistence/connector-generations.repository";

const mediaListSchema = z.array(connectorGenerationMediaSchema);

@Injectable()
export class ConnectorGenerationsService {
	constructor(
		@Inject(ConnectorGenerationsRepository)
		private readonly connectorGenerationsRepository: ConnectorGenerationsRepository,
	) {}

	async attempt(
		userId: string,
		attemptId: string,
	): Promise<ConnectorGenerationAttempt> {
		const row = await this.connectorGenerationsRepository.findOwnedAttempt(
			userId,
			attemptId,
		);

		// Missing and not-owned both become 404 — never reveal which.
		if (!row) {
			throw new NotFoundException();
		}

		return mapAttemptRow(row);
	}
}

function mapAttemptRow(
	row: ConnectorGenerationAttemptRow,
): ConnectorGenerationAttempt {
	const media = mediaListSchema.safeParse(row.media);

	return {
		completedAt: row.completedAt?.toISOString() ?? null,
		connectorSlug: row.connectorSlug,
		createdAt: row.createdAt.toISOString(),
		error: row.error,
		id: row.id,
		media: media.success ? media.data : [],
		status: row.status,
		toolName: row.toolName,
	};
}
