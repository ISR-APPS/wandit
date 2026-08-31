// Read side of connector generations: the attempt state the chat card reads
// after the Realtime run settles (or while polling as a fallback).
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
	aiErrorKindSchema,
	aiErrorSourceSchema,
	type ConnectorGenerationAttempt,
	connectorGenerationMediaSchema,
} from "@wandit/contracts";
import { z } from "zod";

import {
	type NormalizedAiError,
	sanitizeProviderText,
	toClientAiError,
} from "../../../ai-errors/domain";
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
		failure: mapPersistedFailure(row),
		id: row.id,
		media: row.status === "succeeded" && media.success ? media.data : [],
		status: row.status,
		toolName: row.toolName,
	};
}

function mapPersistedFailure(
	row: ConnectorGenerationAttemptRow,
): ConnectorGenerationAttempt["failure"] {
	const kind = aiErrorKindSchema.safeParse(row.failureKind);
	const source = aiErrorSourceSchema.safeParse(row.failureSource);
	if (!kind.success || !source.success) return null;

	const refunded = persistedConnectorRefunded(kind.data, source.data);
	const providerLabel = connectorProviderLabel(row.failureProvider);
	const providerMessage = row.failureProviderMessage
		? sanitizeProviderText(row.failureProviderMessage, {
				connectorSlug: row.connectorSlug,
				kind: kind.data,
				provider: row.failureProvider,
			})
		: null;
	const normalized: NormalizedAiError = {
		gatewayGenerationId: null,
		kind: kind.data,
		model: null,
		moderationStage: null,
		openrouterGenerationId: null,
		provider: row.failureProvider,
		providerLabel,
		providerMessage,
		raw: {
			cause: null,
			message: "Persisted connector generation failure",
			name: null,
			providerAttempts: null,
			responseBody: null,
		},
		refunded,
		requestId: row.failureRequestId,
		retryable: persistedConnectorRetryable(
			kind.data,
			providerMessage,
			refunded,
			source.data,
		),
		sentryEventId: row.sentryEventId,
		source: source.data,
		statusCode: null,
		terminal: true,
		userMessage: {
			key: `errors.ai.${kind.data}`,
			params: {
				...(providerLabel ? { provider: providerLabel } : {}),
				...(providerMessage ? { text: providerMessage } : {}),
			},
		},
	};

	return toClientAiError(normalized);
}

function persistedConnectorRefunded(
	_kind: NormalizedAiError["kind"],
	_source: NormalizedAiError["source"],
): boolean | null {
	// The attempt row does not persist the refund result. Do not infer a
	// successful credit return from a failure kind: the explicit refund can
	// fail, and provider evidence can make the correct outcome a settlement.
	return null;
}

function persistedConnectorRetryable(
	kind: NormalizedAiError["kind"],
	providerMessage: string | null,
	refunded: boolean | null,
	source: NormalizedAiError["source"],
): boolean {
	if (kind === "timeout" && source === "higgsfield") return false;
	if (kind === "connector_rejected") {
		return providerMessage === null && refunded === true;
	}
	return (
		kind === "internal" ||
		kind === "rate_limited" ||
		kind === "capacity" ||
		kind === "provider_error" ||
		kind === "timeout" ||
		kind === "network" ||
		kind === "unknown"
	);
}

function connectorProviderLabel(provider: string | null): string | null {
	if (!provider) return null;
	if (provider === "higgsfield") return "Higgsfield";
	return provider
		.split(/[-_]+/u)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ")
		.slice(0, 40);
}
