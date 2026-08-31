import { describe, expect, it, vi } from "vitest";

import type { AnalyticsService } from "../../../../infrastructure/analytics/analytics.service";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import type {
	ConnectorGenerationAttemptRow,
	ConnectorGenerationsRepository,
} from "../../infrastructure/persistence/connector-generations.repository";
import { ConnectorGenerationRecoveryService } from "./connector-generation-recovery.service";

const BASE_ROW: ConnectorGenerationAttemptRow = {
	args: { count: 3 },
	completedAt: null,
	connectorSlug: "higgsfield",
	createdAt: new Date("2026-08-01T00:00:00.000Z"),
	error: null,
	failureKind: null,
	failureProvider: null,
	failureProviderMessage: null,
	failureRequestId: null,
	failureSource: null,
	id: "attempt-1",
	media: [
		{ kind: "image", url: "https://assets.test/one.webp" },
		{ kind: "image", url: "https://assets.test/two.webp" },
	],
	organizationId: null,
	status: "running",
	sentryEventId: null,
	toolName: "generate_image",
	userId: "user-1",
};

function event(input: {
	id: string;
	operation: "connector" | "image";
	parentEventId?: string;
	reservedCredits: number;
}) {
	return {
		attemptRef: BASE_ROW.id,
		cacheReadTokens: null,
		cacheWriteTokens: null,
		chatId: null,
		createdAt: new Date(),
		estimatedCostUsdMicros: null,
		finalCredits: null,
		id: input.id,
		idempotencyKey: `${input.operation}:${BASE_ROW.id}`,
		inputTokens: null,
		messageId: null,
		model: null,
		operation: input.operation,
		outputTokens: null,
		parentEventId: input.parentEventId ?? null,
		pricingSnapshot: {
			creditsPerUnit: input.operation === "connector" ? 500 : 300,
			mode: "fixed",
			operation: input.operation,
			source: "operation_registry_reservation",
		},
		provider: null,
		rawUsage: null,
		reconciledAt: null,
		reconciledCostUsdMicros: null,
		reservedCredits: input.reservedCredits,
		settledAt: null,
		status: "reserved" as const,
		userId: BASE_ROW.userId,
		executionLeaseToken: null,
		executionLeaseExpiresAt: null,
		reconcileAttempts: 0,
		nextReconcileAttemptAt: null,
	};
}

function setup(options: { withEvents?: boolean } = {}) {
	const connectorEvent = event({
		id: "event-parent",
		operation: "connector",
		reservedCredits: 500,
	});
	const imageEvent = event({
		id: "event-child",
		operation: "image",
		parentEventId: connectorEvent.id,
		reservedCredits: 900,
	});
	const events = new Map(
		options.withEvents === false
			? []
			: ([
					[connectorEvent.idempotencyKey, connectorEvent],
					[imageEvent.idempotencyKey, imageEvent],
				] as const),
	);
	const repository = {
		listRunningCompletionCheckpoints: vi.fn().mockResolvedValue([BASE_ROW]),
		markRunningAttemptSucceeded: vi.fn().mockResolvedValue(true),
	};
	const meteringService = {
		captureGeneration: vi.fn(),
		findByIdempotencyKey: vi.fn(
			async (idempotencyKey: string) => events.get(idempotencyKey) ?? null,
		),
		refund: vi.fn(),
		reserveWithReplay: vi.fn(),
		settle: vi.fn(),
		settleDirectPairWithFixedEvidence: vi.fn().mockResolvedValue({
			child: imageEvent,
			parent: connectorEvent,
		}),
		upgradeFixedGenerationUnits: vi.fn(),
	};
	const analytics = { capture: vi.fn() };
	const service = new ConnectorGenerationRecoveryService(
		repository as unknown as ConnectorGenerationsRepository,
		meteringService as unknown as MeteringService,
		analytics as unknown as AnalyticsService,
	);

	return { analytics, meteringService, repository, service };
}

describe("ConnectorGenerationRecoveryService", () => {
	it("settles the checkpointed provider units before publishing success", async () => {
		const { analytics, meteringService, repository, service } = setup();

		await expect(service.recoverCheckpoint(BASE_ROW)).resolves.toBe(true);

		expect(
			meteringService.settleDirectPairWithFixedEvidence,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				eventId: "event-parent",
				settlement: expect.objectContaining({ finalCredits: 500 }),
			}),
			expect.objectContaining({
				eventId: "event-child",
				settlement: expect.objectContaining({
					finalCredits: 600,
					pricingSnapshot: expect.objectContaining({ units: 2 }),
				}),
			}),
			{ completedUnits: 2, eventId: "event-child" },
		);
		expect(
			meteringService.settleDirectPairWithFixedEvidence.mock
				.invocationCallOrder[0],
		).toBeLessThan(
			repository.markRunningAttemptSucceeded.mock.invocationCallOrder[0] ??
				Number.MAX_SAFE_INTEGER,
		);
		expect(analytics.capture).toHaveBeenCalledWith(
			BASE_ROW.userId,
			"generation_completed",
			{
				generationId: BASE_ROW.id,
				kind: "connector",
				projectId: null,
			},
		);
	});

	it("settles a legacy image hold when a checkpointed reframe now classifies as video", async () => {
		const { meteringService, repository, service } = setup();
		const row: ConnectorGenerationAttemptRow = {
			...BASE_ROW,
			args: { aspect_ratio: "16:9" },
			media: [{ kind: "video", url: "https://assets.test/reframed.mp4" }],
			toolName: "reframe",
		};

		await expect(service.recoverCheckpoint(row)).resolves.toBe(true);

		expect(meteringService.findByIdempotencyKey).toHaveBeenNthCalledWith(
			2,
			`video:${row.id}`,
			{ actorUserId: row.userId },
		);
		expect(meteringService.findByIdempotencyKey).toHaveBeenNthCalledWith(
			3,
			`image:${row.id}`,
			{ actorUserId: row.userId },
		);
		expect(
			meteringService.settleDirectPairWithFixedEvidence,
		).toHaveBeenCalledWith(
			expect.objectContaining({ eventId: "event-parent" }),
			expect.objectContaining({
				eventId: "event-child",
				settlement: expect.objectContaining({
					pricingSnapshot: expect.objectContaining({ operation: "image" }),
				}),
			}),
			{ completedUnits: 1, eventId: "event-child" },
		);
		expect(repository.markRunningAttemptSucceeded).toHaveBeenCalledWith(row.id);
	});

	it("publishes a billing-off checkpoint without inventing usage events", async () => {
		const { meteringService, repository, service } = setup({
			withEvents: false,
		});

		await expect(service.recoverCheckpoint(BASE_ROW)).resolves.toBe(true);
		expect(
			meteringService.settleDirectPairWithFixedEvidence,
		).not.toHaveBeenCalled();
		expect(repository.markRunningAttemptSucceeded).toHaveBeenCalledWith(
			BASE_ROW.id,
		);
	});

	it("keeps a checkpoint retryable when billing recovery fails", async () => {
		const { meteringService, repository, service } = setup();
		meteringService.settleDirectPairWithFixedEvidence.mockRejectedValueOnce(
			new Error("database unavailable"),
		);

		await expect(service.recoverCompletionCheckpoints()).resolves.toEqual({
			failed: 1,
			recovered: 0,
			scanned: 1,
		});
		expect(repository.markRunningAttemptSucceeded).not.toHaveBeenCalled();
	});
});
