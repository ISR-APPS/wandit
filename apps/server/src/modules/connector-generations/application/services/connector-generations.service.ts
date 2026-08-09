// Read side of connector generations: the attempt state the chat card reads
// after the Realtime run settles (or while polling as a fallback).
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
	type ConnectorGenerationAttempt,
	connectorGenerationMediaSchema,
} from "@wandit/contracts";
import { z } from "zod";

import type { ProjectScope } from "../../../projects/domain/project-scope";
import {
	type ConnectorGenerationAttemptRow,
	ConnectorGenerationsRepository,
} from "../../infrastructure/persistence/connector-generations.repository";
import { ConnectorGenerationRecoveryService } from "./connector-generation-recovery.service";

const mediaListSchema = z.array(connectorGenerationMediaSchema);

@Injectable()
export class ConnectorGenerationsService {
	constructor(
		@Inject(ConnectorGenerationsRepository)
		private readonly connectorGenerationsRepository: ConnectorGenerationsRepository,
		@Inject(ConnectorGenerationRecoveryService)
		private readonly connectorGenerationRecovery: ConnectorGenerationRecoveryService,
	) {}

	async attempt(
		scope: ProjectScope,
		attemptId: string,
	): Promise<ConnectorGenerationAttempt> {
		let row = await this.connectorGenerationsRepository.findAccessibleAttempt(
			scope,
			attemptId,
		);

		// Missing and out-of-scope both become 404 — never reveal which.
		if (!row) {
			throw new NotFoundException();
		}

		if (row.status === "running" && row.media !== null) {
			await this.connectorGenerationRecovery.recoverCheckpoint(row);
			row = await this.connectorGenerationsRepository.findAccessibleAttempt(
				scope,
				attemptId,
			);

			if (!row) {
				throw new NotFoundException();
			}
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
		media: row.status === "succeeded" && media.success ? media.data : [],
		status: row.status,
		toolName: row.toolName,
	};
}
