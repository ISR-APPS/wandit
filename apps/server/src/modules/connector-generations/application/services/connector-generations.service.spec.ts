import { describe, expect, it, vi } from "vitest";

import type { ProjectScope } from "../../../projects/domain/project-scope";
import type {
	ConnectorGenerationAttemptRow,
	ConnectorGenerationsRepository,
} from "../../infrastructure/persistence/connector-generations.repository";
import type { ConnectorGenerationRecoveryService } from "./connector-generation-recovery.service";
import { ConnectorGenerationsService } from "./connector-generations.service";

const ATTEMPT_ID = "55555555-5555-4555-8555-555555555555";
const SCOPE: ProjectScope = { kind: "personal", userId: "user-1" };

const BASE_ROW: ConnectorGenerationAttemptRow = {
	args: { prompt: "a product shot" },
	completedAt: new Date("2026-08-30T10:01:00.000Z"),
	connectorSlug: "higgsfield",
	createdAt: new Date("2026-08-30T10:00:00.000Z"),
	error: "safe legacy sentence",
	failureKind: null,
	failureProvider: null,
	failureProviderMessage: null,
	failureRequestId: null,
	failureSource: null,
	id: ATTEMPT_ID,
	media: null,
	organizationId: null,
	sentryEventId: null,
	status: "failed",
	toolName: "generate_video",
	userId: "user-1",
};

function serviceFor(row: ConnectorGenerationAttemptRow) {
	const repository = {
		findAccessibleAttempt: vi.fn().mockResolvedValue(row),
	};
	const recovery = { recoverCheckpoint: vi.fn() };
	return new ConnectorGenerationsService(
		repository as unknown as ConnectorGenerationsRepository,
		recovery as unknown as ConnectorGenerationRecoveryService,
	);
}

describe("ConnectorGenerationsService failure mapping", () => {
	it("always emits null for legacy rows without normalized columns", async () => {
		await expect(
			serviceFor(BASE_ROW).attempt(SCOPE, ATTEMPT_ID),
		).resolves.toMatchObject({ failure: null });
	});

	it.each([
		{
			expected: {
				kind: "content_moderated",
				moderationStage: null,
				providerLabel: "Higgsfield",
				providerMessage: "Input or output was rejected by content moderation.",
				refunded: null,
				retryable: false,
				source: "higgsfield",
			},
			row: {
				failureKind: "content_moderated",
				failureProviderMessage:
					"Input or output was rejected by content moderation.",
			},
		},
		{
			expected: {
				kind: "connector_rejected",
				providerMessage:
					"Higgsfield could not read this YouTube video. Check that the link is a public, finished video, then try again.",
				refunded: null,
				retryable: false,
				source: "higgsfield",
			},
			row: {
				failureKind: "connector_rejected",
				failureProviderMessage:
					"Higgsfield could not read this YouTube video. Check that the link is a public, finished video, then try again.",
			},
		},
		{
			expected: {
				kind: "connector_rejected",
				providerMessage: null,
				refunded: null,
				retryable: false,
				source: "higgsfield",
			},
			row: {
				failureKind: "connector_rejected",
				failureProviderMessage: null,
			},
		},
		{
			expected: {
				kind: "timeout",
				providerMessage: null,
				refunded: null,
				retryable: false,
				source: "higgsfield",
			},
			row: { failureKind: "timeout", failureProviderMessage: null },
		},
	])("maps persisted $expected.kind semantics", async ({ expected, row }) => {
		const attempt = await serviceFor({
			...BASE_ROW,
			...row,
			failureProvider: "higgsfield",
			failureRequestId: "request-1",
			failureSource: "higgsfield",
		}).attempt(SCOPE, ATTEMPT_ID);

		expect(attempt.failure).toEqual(
			expect.objectContaining({ ...expected, requestId: "request-1" }),
		);
	});

	it("does not expose corrupt normalized column values", async () => {
		const attempt = await serviceFor({
			...BASE_ROW,
			failureKind: "provider-secret-kind",
			failureProviderMessage: "raw provider payload",
			failureSource: "higgsfield",
		}).attempt(SCOPE, ATTEMPT_ID);

		expect(attempt.failure).toBeNull();
	});

	it("re-sanitizes a persisted provider message before returning it", async () => {
		const attempt = await serviceFor({
			...BASE_ROW,
			failureKind: "connector_rejected",
			failureProvider: "higgsfield",
			failureProviderMessage:
				'{"access_token":"secret-provider-token","prompt":"private"}',
			failureSource: "higgsfield",
		}).attempt(SCOPE, ATTEMPT_ID);

		expect(attempt.failure).toMatchObject({
			kind: "connector_rejected",
			providerMessage: null,
		});
		expect(JSON.stringify(attempt.failure)).not.toContain(
			"secret-provider-token",
		);
	});
});
