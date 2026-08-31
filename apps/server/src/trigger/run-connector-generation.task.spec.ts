import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const metadata = { set: vi.fn() };
	metadata.set.mockReturnValue(metadata);

	const billing = { refund: vi.fn() };
	const client = {
		callTool: vi.fn(),
		close: vi.fn(),
		listTools: vi.fn(),
	};

	return {
		billing,
		captureCompleted: vi.fn(),
		captureFailed: vi.fn(),
		captureResult: vi.fn(),
		client,
		connectorGatewayCaptures: vi.fn(),
		createBilling: vi.fn(() => billing),
		createDb: vi.fn(),
		createMCPClient: vi.fn(() => client),
		end: vi.fn(),
		finalizeBilling: vi.fn(),
		findConnector: vi.fn(),
		getAccessToken: vi.fn(),
		hasTerminalReplay: vi.fn(),
		logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
		metadata,
		recordReceipt: vi.fn(),
		sentryCaptureException: vi.fn(
			(_error: unknown, _context?: unknown) => "sentry-event-id",
		),
		sentryWarn: vi.fn(),
		task: vi.fn((definition: unknown) => definition),
		triggerAnalytics: { capture: vi.fn() },
	};
});

vi.mock("./undici-timeouts", () => ({}));

vi.mock("@ai-sdk/mcp", () => ({ createMCPClient: mocks.createMCPClient }));

vi.mock("@trigger.dev/sdk", () => ({
	logger: mocks.logger,
	metadata: mocks.metadata,
	task: mocks.task,
}));

vi.mock("@wandit/observability/node", () => ({
	Sentry: {
		captureException: mocks.sentryCaptureException,
		logger: { info: vi.fn(), warn: mocks.sentryWarn },
	},
}));

vi.mock("@wandit/db", () => ({
	and: vi.fn((...values: unknown[]) => values),
	createDb: mocks.createDb,
	eq: vi.fn((...values: unknown[]) => values),
	inArray: vi.fn((...values: unknown[]) => values),
}));

vi.mock("@wandit/db/schema/connector-generation-attempts", () => ({
	connectorGenerationAttempts: {
		completedAt: "completedAt",
		id: "id",
		media: "media",
		status: "status",
		triggerRunId: "triggerRunId",
	},
}));

vi.mock("../infrastructure/analytics/generation-events", () => ({
	captureGenerationCompleted: mocks.captureCompleted,
	captureGenerationFailed: mocks.captureFailed,
	machineFailureReason: vi.fn(() => "provider_rejected"),
}));

vi.mock(
	"../modules/mcp-connectors/application/services/connector-generation-billing",
	() => ({
		captureConnectorGenerationResult: mocks.captureResult,
		createConnectorGenerationBilling: mocks.createBilling,
		finalizeConnectorGenerationBilling: mocks.finalizeBilling,
		hasTerminalConnectorGenerationReplay: mocks.hasTerminalReplay,
		recordConnectorSubmitReceipt: mocks.recordReceipt,
	}),
);

vi.mock(
	"../modules/mcp-connectors/application/services/mcp-connections.service",
	() => ({
		McpConnectionsService: class McpConnectionsService {
			getValidAccessToken = mocks.getAccessToken;
		},
	}),
);

vi.mock(
	"../modules/mcp-connectors/domain/connector-generation-metering",
	() => ({ connectorGatewayCaptures: mocks.connectorGatewayCaptures }),
);

vi.mock(
	"../modules/mcp-connectors/infrastructure/oauth/mcp-dcr.client",
	() => ({ McpDcrClient: class McpDcrClient {} }),
);

vi.mock(
	"../modules/mcp-connectors/infrastructure/persistence/mcp-connections.repository",
	() => ({ McpConnectionsRepository: class McpConnectionsRepository {} }),
);

vi.mock(
	"../modules/mcp-connectors/infrastructure/persistence/mcp-connectors.repository",
	() => ({
		McpConnectorsRepository: class McpConnectorsRepository {
			findEnabledBySlug = mocks.findConnector;
		},
	}),
);

vi.mock("./init", () => ({ triggerAnalytics: mocks.triggerAnalytics }));
vi.mock("./metering.runtime", () => ({
	createTriggerMetering: vi.fn(() => ({})),
}));
vi.mock("./settled-completion-recovery", () => ({
	recoverSettledConnectorCompletion: vi.fn(),
}));

import type { RunConnectorGenerationPayload } from "./run-connector-generation.task";
import { runConnectorGenerationTask } from "./run-connector-generation.task";

const ATTEMPT_ID = "55555555-5555-4555-8555-555555555555";
const USER_ID = "user-1";
const CLIP_ROW_ID = "77777777-7777-4777-8777-777777777777";
const USER_MESSAGE =
	"Higgsfield could not read this YouTube video. Check that the link is a public, finished video, then try again.";
const UNFOLLOWABLE_MESSAGE =
	"Higgsfield accepted the clipping job but Wandit could not follow it. Check your Higgsfield account for the clips.";
const CONNECTOR_TIMEOUT_MESSAGE =
	"Higgsfield accepted the job but did not report a result in time. Check Higgsfield before you try again.";
const CONNECTOR_NO_REASON_MESSAGE =
	"Higgsfield failed without giving a reason.";
const INTERNAL_FAILURE_MESSAGE =
	"Something went wrong on our side. Please try again.";

const attempt = {
	args: { urls: ["https://www.youtube.com/watch?v=clip"] },
	connectorSlug: "higgsfield",
	id: ATTEMPT_ID,
	organizationId: null,
	status: "queued",
	toolName: "personal_clipper_create",
	userId: USER_ID,
};

const videoAttempt = {
	...attempt,
	args: { prompt: "a product reveal" },
	toolName: "generate_video",
};

const submitJobResult = {
	content: [
		{
			text: JSON.stringify({ job_id: "provider-job-1" }),
			type: "text",
		},
	],
};

const payload: RunConnectorGenerationPayload = {
	attemptId: ATTEMPT_ID,
	billing: {
		child: {
			credits: 1,
			eventId: "video-event",
			operation: "video",
			referenceId: ATTEMPT_ID,
			replay: "none",
			terms: {
				estimatedUnitUsdMicros: null,
				mode: "measured",
				unit: "video",
				usdMicrosPerCredit: 40_000,
			},
			units: 1,
		},
		connector: {
			credits: 1,
			eventId: "connector-event",
			operation: "connector",
			referenceId: ATTEMPT_ID,
			replay: "none",
			terms: {
				estimatedUnitUsdMicros: null,
				mode: "measured",
				unit: "operation",
				usdMicrosPerCredit: 40_000,
			},
			units: 1,
		},
	},
	billingMode: "enforce",
	userId: USER_ID,
};

type CapturedTask = {
	id: string;
	maxDuration: number;
	run(
		payload: RunConnectorGenerationPayload,
		context: { ctx: { run: { id: string } }; signal: AbortSignal },
	): Promise<unknown>;
};

const task = runConnectorGenerationTask as unknown as CapturedTask;

describe("runConnectorGenerationTask", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.billing.refund.mockReset();
		mocks.captureResult.mockReset();
		mocks.client.callTool.mockReset();
		mocks.client.close.mockReset();
		mocks.client.listTools.mockReset();
		mocks.connectorGatewayCaptures.mockReset();
		mocks.createDb.mockReset();
		mocks.end.mockReset();
		mocks.finalizeBilling.mockReset();
		mocks.findConnector.mockReset();
		mocks.getAccessToken.mockReset();
		mocks.hasTerminalReplay.mockReset();
		mocks.recordReceipt.mockReset();
		mocks.metadata.set.mockReturnValue(mocks.metadata);
		mocks.billing.refund.mockResolvedValue(undefined);
		mocks.captureResult.mockResolvedValue(false);
		mocks.client.close.mockResolvedValue(undefined);
		mocks.connectorGatewayCaptures.mockReturnValue([]);
		mocks.finalizeBilling.mockResolvedValue(undefined);
		mocks.findConnector.mockResolvedValue({
			mcpServerUrl: "https://mcp.higgsfield.test",
		});
		mocks.getAccessToken.mockResolvedValue("access-token");
		mocks.hasTerminalReplay.mockReturnValue(false);
		mocks.recordReceipt.mockResolvedValue(CLIP_ROW_ID);
	});

	it("uses the nested Clipper row_id even when the status schema omits it", async () => {
		const database = setupDatabase({
			selectRows: [[attempt]],
			updateRows: [
				[{ id: ATTEMPT_ID }],
				[{ id: ATTEMPT_ID }],
				[{ id: ATTEMPT_ID }],
			],
		});
		const signal = new AbortController().signal;
		const submitResult = {
			content: [
				{
					text: JSON.stringify({
						request_id: "request-that-must-not-win",
						row_id: CLIP_ROW_ID,
					}),
					type: "text",
				},
			],
		};
		const statusResult = {
			content: [
				{
					text: JSON.stringify({
						clips: ["https://media.example/clip.mp4"],
						status: "completed",
					}),
					type: "text",
				},
			],
		};
		mocks.client.callTool
			.mockResolvedValueOnce(submitResult)
			.mockResolvedValueOnce(statusResult);
		mocks.client.listTools.mockResolvedValue({
			tools: [
				{
					inputSchema: {
						properties: { request_id: {} },
					},
					name: "personal_clipper_status",
				},
			],
		});
		const setTimeoutSpy = vi
			.spyOn(globalThis, "setTimeout")
			.mockImplementation(((callback: () => void) => {
				queueMicrotask(callback);
				return 0;
			}) as unknown as typeof setTimeout);

		try {
			await expect(
				task.run(payload, { ctx: { run: { id: "run-1" } }, signal }),
			).resolves.toEqual({ mediaCount: 1 });
		} finally {
			setTimeoutSpy.mockRestore();
		}

		expect(task.maxDuration).toBe(3600);
		expect(mocks.client.callTool).toHaveBeenCalledTimes(2);
		expect(mocks.client.callTool).toHaveBeenNthCalledWith(2, {
			arguments: { row_id: CLIP_ROW_ID },
			name: "personal_clipper_status",
			options: { signal },
		});
		expect(mocks.recordReceipt).toHaveBeenCalledWith(
			mocks.billing,
			payload.billing,
			expect.objectContaining({ result: submitResult }),
		);
		expect(database.set).toHaveBeenNthCalledWith(2, {
			media: [{ kind: "video", url: "https://media.example/clip.mp4" }],
		});
		expect(mocks.finalizeBilling).toHaveBeenCalledOnce();
	});

	it("stringifies a numeric top-level Clipper row_id before following", async () => {
		setupDatabase({
			selectRows: [[attempt]],
			updateRows: [
				[{ id: ATTEMPT_ID }],
				[{ id: ATTEMPT_ID }],
				[{ id: ATTEMPT_ID }],
			],
		});
		const signal = new AbortController().signal;
		mocks.client.callTool
			.mockResolvedValueOnce({ row_id: 90210 })
			.mockResolvedValueOnce({
				content: [
					{
						text: JSON.stringify({
							clips: ["https://media.example/numeric.mp4"],
							status: "completed",
						}),
						type: "text",
					},
				],
			});
		mocks.client.listTools.mockResolvedValue({
			tools: [
				{
					inputSchema: { properties: {} },
					name: "personal_clipper_status",
				},
			],
		});
		const setTimeoutSpy = useImmediateTimers();

		try {
			await expect(
				task.run(payload, { ctx: { run: { id: "run-2" } }, signal }),
			).resolves.toEqual({ mediaCount: 1 });
		} finally {
			setTimeoutSpy.mockRestore();
		}

		expect(mocks.client.callTool).toHaveBeenNthCalledWith(2, {
			arguments: { row_id: "90210" },
			name: "personal_clipper_status",
			options: { signal },
		});
	});

	it("fails as a non-verdict when the Clipper status tool is unavailable", async () => {
		const database = setupDatabase({
			selectRows: [[attempt], [{ media: null, status: "running" }]],
			updateRows: [[{ id: ATTEMPT_ID }], [{ id: ATTEMPT_ID }]],
		});
		mocks.client.callTool.mockResolvedValue({ row_id: CLIP_ROW_ID });
		mocks.client.listTools.mockResolvedValue({ tools: [] });

		await expect(
			task.run(payload, {
				ctx: { run: { id: "run-3" } },
				signal: new AbortController().signal,
			}),
		).rejects.toThrow(UNFOLLOWABLE_MESSAGE);

		expect(database.set).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				error: CONNECTOR_TIMEOUT_MESSAGE,
				failureKind: "timeout",
				failureProvider: "higgsfield",
				failureProviderMessage: null,
				failureSource: "higgsfield",
				status: "failed",
			}),
		);
		expect(mocks.finalizeBilling).toHaveBeenCalledWith(
			mocks.billing,
			payload.billing,
			[],
			{ childUnits: 0 },
		);
		expect(mocks.billing.refund).not.toHaveBeenCalled();
		expect(mocks.sentryCaptureException).not.toHaveBeenCalled();
		expect(mocks.sentryWarn).toHaveBeenCalledWith(
			"ai.call.failed",
			expect.objectContaining({ errorKind: "timeout", refunded: false }),
		);
	});

	it("keeps polling Clipper while partial media is still processing", async () => {
		const database = setupDatabase({
			selectRows: [[attempt]],
			updateRows: [
				[{ id: ATTEMPT_ID }],
				[{ id: ATTEMPT_ID }],
				[{ id: ATTEMPT_ID }],
			],
		});
		const signal = new AbortController().signal;
		const submitResult = { row_id: CLIP_ROW_ID };
		const partialStatus = {
			content: [
				{
					text: JSON.stringify({
						clips: ["https://media.example/clip-1.mp4"],
						jobs: [{ status: "completed" }, { status: "processing" }],
					}),
					type: "text",
				},
			],
		};
		const completeStatus = {
			content: [
				{
					text: JSON.stringify({
						clips: [
							"https://media.example/clip-1.mp4",
							"https://media.example/clip-2.mp4",
						],
						jobs: [{ status: "completed" }, { status: "completed" }],
					}),
					type: "text",
				},
			],
		};
		mocks.client.callTool
			.mockResolvedValueOnce(submitResult)
			.mockResolvedValueOnce(partialStatus)
			.mockResolvedValueOnce(completeStatus);
		mocks.client.listTools.mockResolvedValue({
			tools: [
				{
					inputSchema: { properties: {} },
					name: "personal_clipper_status",
				},
			],
		});
		const setTimeoutSpy = useImmediateTimers();

		try {
			await expect(
				task.run(payload, { ctx: { run: { id: "run-4" } }, signal }),
			).resolves.toEqual({ mediaCount: 2 });
		} finally {
			setTimeoutSpy.mockRestore();
		}

		expect(mocks.client.callTool).toHaveBeenCalledTimes(3);
		expect(mocks.client.callTool).toHaveBeenNthCalledWith(3, {
			arguments: { row_id: CLIP_ROW_ID },
			name: "personal_clipper_status",
			options: { signal },
		});
		expect(database.set).toHaveBeenNthCalledWith(2, {
			media: [
				{ kind: "video", url: "https://media.example/clip-1.mp4" },
				{ kind: "video", url: "https://media.example/clip-2.mp4" },
			],
		});
	});

	it("accepts delivered media when a completed sibling accompanies a failed item", async () => {
		const database = setupDatabase({
			selectRows: [[videoAttempt]],
			updateRows: [
				[{ id: ATTEMPT_ID }],
				[{ id: ATTEMPT_ID }],
				[{ id: ATTEMPT_ID }],
			],
		});
		const signal = new AbortController().signal;
		const statusResult = {
			content: [
				{
					text: JSON.stringify({
						jobs: [{ state: "completed" }, { state: "failed" }],
						output_url: "https://media.example/final.mp4",
					}),
					type: "text",
				},
			],
		};
		mocks.client.callTool
			.mockResolvedValueOnce(submitJobResult)
			.mockResolvedValueOnce(statusResult);
		mockJobStatusDefinition();
		const timer = useImmediateTimers();

		try {
			await expect(
				task.run(payload, { ctx: { run: { id: "run-mixed-set" } }, signal }),
			).resolves.toEqual({ mediaCount: 1 });
		} finally {
			timer.mockRestore();
		}

		expect(database.set).toHaveBeenNthCalledWith(2, {
			media: [{ kind: "video", url: "https://media.example/final.mp4" }],
		});
		expect(mocks.billing.refund).not.toHaveBeenCalled();
	});

	it("captures gateway evidence before a classified submit rejection", async () => {
		const database = setupDatabase({
			selectRows: [[attempt], [{ media: null, status: "running" }]],
			updateRows: [[{ id: ATTEMPT_ID }], [{ id: ATTEMPT_ID }]],
		});
		const providerText =
			'Error starting generation: Validation error (422): {"error_type":"clipify_duration_unavailable","request_id":"req-secret"}';
		const errorResult = {
			content: [{ text: providerText, type: "text" }],
			isError: true,
			providerMetadata: {
				gateway: { generationId: "gateway-generation-1" },
			},
		};
		mocks.captureResult.mockResolvedValue(true);
		mocks.client.callTool.mockResolvedValue(errorResult);

		await expect(
			task.run(payload, {
				ctx: { run: { id: "run-5" } },
				signal: new AbortController().signal,
			}),
		).resolves.toEqual({
			mediaCount: 0,
			outcome: "provider_rejected",
			reason: `Higgsfield returned: ${USER_MESSAGE}`,
		});

		expect(database.set).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				error: `Higgsfield returned: ${USER_MESSAGE}`,
				failureKind: "connector_rejected",
				failureProvider: "higgsfield",
				failureProviderMessage: USER_MESSAGE,
				failureSource: "higgsfield",
				status: "failed",
			}),
		);
		expect(mocks.captureResult).toHaveBeenCalledWith(
			mocks.billing,
			payload.billing,
			errorResult,
		);
		expect(mocks.billing.refund).not.toHaveBeenCalled();
		expect(mocks.sentryWarn).toHaveBeenCalledWith(
			"ai.call.failed",
			expect.objectContaining({ refunded: false }),
		);
		expect(mocks.logger.warn).toHaveBeenCalledWith(
			"Connector generation submit was rejected by the provider",
			{ kind: "connector_rejected" },
		);
		expect(mocks.recordReceipt).not.toHaveBeenCalled();
	});

	it("captures unknown submit errors without throwing raw provider text", async () => {
		const database = setupDatabase({
			selectRows: [[attempt], [{ media: null, status: "running" }]],
			updateRows: [[{ id: ATTEMPT_ID }], [{ id: ATTEMPT_ID }]],
		});
		const providerText =
			"Unexpected provider failure at https://private.example/input with Bearer secret-token (Request ID: req-secret)";
		const errorResult = {
			content: [{ text: providerText, type: "text" }],
			isError: true,
		};
		mocks.client.callTool.mockResolvedValue(errorResult);

		const thrown = await task
			.run(payload, {
				ctx: { run: { id: "run-6" } },
				signal: new AbortController().signal,
			})
			.catch((error: unknown) => error);

		expect(thrown).toBeInstanceOf(Error);
		expect((thrown as Error).message).toBe(CONNECTOR_NO_REASON_MESSAGE);

		expect(database.set).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				error: CONNECTOR_NO_REASON_MESSAGE,
				failureKind: "connector_rejected",
				failureProviderMessage: null,
				failureSource: "higgsfield",
				status: "failed",
			}),
		);
		expect(mocks.captureResult).toHaveBeenCalledWith(
			mocks.billing,
			payload.billing,
			errorResult,
		);
		expect(mocks.billing.refund).toHaveBeenCalledOnce();
		expect(mocks.sentryCaptureException).not.toHaveBeenCalled();
		expect(mocks.sentryWarn).toHaveBeenCalledWith(
			"ai.call.failed",
			expect.objectContaining({
				errorKind: "connector_rejected",
				rawCause: expect.any(String),
				refunded: true,
			}),
		);
		const failedLog = mocks.sentryWarn.mock.calls[0]?.[1] as {
			rawCause: string;
		};
		expect(failedLog.rawCause).not.toMatch(/private\.example|secret-token/u);
		expect(mocks.recordReceipt).not.toHaveBeenCalled();
	});

	it("does not refund an unknown submit rejection with provider evidence", async () => {
		const database = setupDatabase({
			selectRows: [[attempt], [{ media: null, status: "running" }]],
			updateRows: [[{ id: ATTEMPT_ID }], [{ id: ATTEMPT_ID }]],
		});
		const providerText =
			"Unexpected provider failure at https://private.example/input with Bearer secret-token (Request ID: req-secret)";
		const errorResult = {
			content: [{ text: providerText, type: "text" }],
			isError: true,
		};
		mocks.captureResult.mockResolvedValue(true);
		mocks.client.callTool.mockResolvedValue(errorResult);

		const thrown = await task
			.run(payload, {
				ctx: { run: { id: "run-7" } },
				signal: new AbortController().signal,
			})
			.catch((error: unknown) => error);

		expect(thrown).toBeInstanceOf(Error);
		expect((thrown as Error).message).toBe(CONNECTOR_NO_REASON_MESSAGE);
		expect(database.set).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				error: CONNECTOR_NO_REASON_MESSAGE,
				failureKind: "connector_rejected",
				failureProviderMessage: null,
				status: "failed",
			}),
		);
		expect(mocks.captureResult).toHaveBeenCalledWith(
			mocks.billing,
			payload.billing,
			errorResult,
		);
		expect(mocks.billing.refund).not.toHaveBeenCalled();
		expect(mocks.recordReceipt).not.toHaveBeenCalled();
	});

	it("leaves both holds open when submit-result capture fails", async () => {
		const database = setupDatabase({
			selectRows: [[attempt], [{ media: null, status: "running" }]],
			updateRows: [[{ id: ATTEMPT_ID }], [{ id: ATTEMPT_ID }]],
		});
		const providerText =
			"Unexpected provider failure at https://private.example/input with Bearer secret-token (Request ID: req-secret)";
		const errorResult = {
			content: [{ text: providerText, type: "text" }],
			isError: true,
		};
		const captureError = new Error("capture unavailable");
		mocks.captureResult.mockRejectedValue(captureError);
		mocks.client.callTool.mockResolvedValue(errorResult);

		const thrown = await task
			.run(payload, {
				ctx: { run: { id: "run-8" } },
				signal: new AbortController().signal,
			})
			.catch((error: unknown) => error);

		expect(thrown).toBeInstanceOf(Error);
		expect((thrown as Error).message).toBe(
			"Connector submit-result capture failed",
		);
		expect(database.set).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				error: INTERNAL_FAILURE_MESSAGE,
				failureKind: "internal",
				failureProvider: null,
				failureProviderMessage: null,
				failureSource: "ours",
				sentryEventId: "sentry-event-id",
				status: "failed",
			}),
		);
		expect(mocks.billing.refund).not.toHaveBeenCalled();
		expect(mocks.logger.error).toHaveBeenCalledWith(
			`Connector submit-result capture failed for attempt ${ATTEMPT_ID}`,
			{ error: captureError },
		);
		const capturedError = mocks.sentryCaptureException.mock.calls[0]?.[0];
		expect(capturedError).toBeInstanceOf(Error);
		expect((capturedError as Error).message).toBe(
			"Connector submit-result capture failed",
		);
		expect((capturedError as Error).message).not.toContain(providerText);
		const captureOptions = mocks.sentryCaptureException.mock.calls[0]?.[1];
		expect(JSON.stringify(captureOptions)).not.toMatch(
			/private\.example|secret-token/u,
		);
		expect(mocks.recordReceipt).not.toHaveBeenCalled();
	});

	it("classifies an nsfw job verdict, persists only the fixed moderation sentence, and refunds", async () => {
		const database = setupDatabase({
			selectRows: [[videoAttempt], [{ media: null, status: "running" }]],
			updateRows: [[{ id: ATTEMPT_ID }], [{ id: ATTEMPT_ID }]],
		});
		const statusResult = {
			content: [
				{
					text: JSON.stringify({
						request_id: "higgsfield-request-1",
						status: "nsfw",
						task_status_msg: "raw moderation payload",
					}),
					type: "text",
				},
			],
		};
		mocks.client.callTool
			.mockResolvedValueOnce(submitJobResult)
			.mockResolvedValueOnce(statusResult);
		mockJobStatusDefinition();
		const timer = useImmediateTimers();

		try {
			await expect(
				task.run(payload, {
					ctx: { run: { id: "run-nsfw" } },
					signal: new AbortController().signal,
				}),
			).rejects.toThrow();
		} finally {
			timer.mockRestore();
		}

		expect(database.set).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				error:
					"Higgsfield declined this request because of its content rules. Change the prompt and try again.",
				failureKind: "content_moderated",
				failureProvider: "higgsfield",
				failureProviderMessage:
					"Input or output was rejected by content moderation.",
				failureRequestId: "higgsfield-request-1",
				failureSource: "higgsfield",
				status: "failed",
			}),
		);
		expect(mocks.billing.refund).toHaveBeenCalledOnce();
		expect(mocks.sentryCaptureException).not.toHaveBeenCalled();
		expect(mocks.sentryWarn).toHaveBeenCalledWith(
			"ai.call.failed",
			expect.objectContaining({
				errorKind: "content_moderated",
				refunded: true,
			}),
		);
	});

	it.each([
		{
			label: "without text",
			statusResult: { state: "failed" },
		},
		{
			label: "with a JSON blob",
			statusResult: {
				content: [
					{
						text: JSON.stringify({
							access_token: "secret-provider-token",
							prompt: "private prompt",
							status: "failed",
							url: "https://private.example/input.png",
						}),
						type: "text",
					},
				],
			},
		},
	])("stores the category sentence for a failed state $label", async ({
		statusResult,
	}) => {
		const database = setupDatabase({
			selectRows: [[videoAttempt], [{ media: null, status: "running" }]],
			updateRows: [[{ id: ATTEMPT_ID }], [{ id: ATTEMPT_ID }]],
		});
		mocks.client.callTool
			.mockResolvedValueOnce(submitJobResult)
			.mockResolvedValueOnce(statusResult);
		mockJobStatusDefinition();
		const timer = useImmediateTimers();

		try {
			await expect(
				task.run(payload, {
					ctx: { run: { id: "run-failed-state" } },
					signal: new AbortController().signal,
				}),
			).rejects.toThrow();
		} finally {
			timer.mockRestore();
		}

		expect(database.set).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				error: CONNECTOR_NO_REASON_MESSAGE,
				failureKind: "connector_rejected",
				failureProviderMessage: null,
				failureSource: "higgsfield",
				status: "failed",
			}),
		);
		expect(mocks.billing.refund).toHaveBeenCalledOnce();
		expect(JSON.stringify(database.set.mock.calls[1]?.[0])).not.toContain(
			"secret-provider-token",
		);
	});

	it("classifies submit-time account credits without creating a Sentry issue", async () => {
		const database = setupDatabase({
			selectRows: [[attempt], [{ media: null, status: "running" }]],
			updateRows: [[{ id: ATTEMPT_ID }], [{ id: ATTEMPT_ID }]],
		});
		mocks.client.callTool.mockResolvedValue({
			content: [{ text: "Higgsfield is out of credits", type: "text" }],
			isError: true,
		});

		await expect(
			task.run(payload, {
				ctx: { run: { id: "run-credits" } },
				signal: new AbortController().signal,
			}),
		).resolves.toMatchObject({ outcome: "provider_rejected" });

		expect(database.set).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				error:
					"Your Higgsfield workspace is out of credits. Update your Higgsfield account, then try again.",
				failureKind: "connector_account",
				failureProviderMessage: "Your Higgsfield workspace is out of credits.",
				failureSource: "higgsfield",
			}),
		);
		expect(mocks.billing.refund).toHaveBeenCalledOnce();
		expect(mocks.sentryCaptureException).not.toHaveBeenCalled();
		expect(mocks.sentryWarn).toHaveBeenCalledWith(
			"ai.call.failed",
			expect.objectContaining({ errorKind: "connector_account" }),
		);
	});

	it("classifies twelve consecutive status errors as a non-retryable zero-unit timeout", async () => {
		const database = setupDatabase({
			selectRows: [[videoAttempt], [{ media: null, status: "running" }]],
			updateRows: [[{ id: ATTEMPT_ID }], [{ id: ATTEMPT_ID }]],
		});
		const statusError = {
			content: [{ text: "provider status unavailable", type: "text" }],
			isError: true,
		};
		mocks.client.callTool
			.mockResolvedValueOnce(submitJobResult)
			.mockResolvedValue(statusError);
		mockJobStatusDefinition();
		const timer = useImmediateTimers();

		try {
			await expect(
				task.run(payload, {
					ctx: { run: { id: "run-status-errors" } },
					signal: new AbortController().signal,
				}),
			).rejects.toThrow(CONNECTOR_TIMEOUT_MESSAGE);
		} finally {
			timer.mockRestore();
		}

		expect(mocks.client.callTool).toHaveBeenCalledTimes(13);
		expect(database.set).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				error: CONNECTOR_TIMEOUT_MESSAGE,
				failureKind: "timeout",
				failureProviderMessage: null,
				failureSource: "higgsfield",
			}),
		);
		expect(mocks.finalizeBilling).toHaveBeenCalledWith(
			mocks.billing,
			payload.billing,
			[],
			{ childUnits: 0 },
		);
		expect(mocks.billing.refund).not.toHaveBeenCalled();
		expect(mocks.sentryWarn).toHaveBeenCalledWith(
			"ai.call.failed",
			expect.objectContaining({
				errorKind: "timeout",
				refunded: false,
			}),
		);
	});

	it("classifies the follow deadline as a non-retryable zero-unit timeout", async () => {
		const database = setupDatabase({
			selectRows: [[videoAttempt], [{ media: null, status: "running" }]],
			updateRows: [[{ id: ATTEMPT_ID }], [{ id: ATTEMPT_ID }]],
		});
		mocks.client.callTool.mockResolvedValueOnce(submitJobResult);
		mockJobStatusDefinition();
		const now = vi
			.spyOn(Date, "now")
			.mockReturnValueOnce(1)
			.mockReturnValue(1 + 25 * 60 * 1000);

		try {
			await expect(
				task.run(payload, {
					ctx: { run: { id: "run-deadline" } },
					signal: new AbortController().signal,
				}),
			).rejects.toThrow("Timed out waiting for the provider");
		} finally {
			now.mockRestore();
		}

		expect(database.set).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				error: CONNECTOR_TIMEOUT_MESSAGE,
				failureKind: "timeout",
				failureProviderMessage: null,
			}),
		);
		expect(mocks.finalizeBilling).toHaveBeenCalledWith(
			mocks.billing,
			payload.billing,
			[],
			{ childUnits: 0 },
		);
		expect(mocks.billing.refund).not.toHaveBeenCalled();
	});

	it("keeps the existing unlim_choice verdict as a failed run", async () => {
		const database = setupDatabase({
			selectRows: [[attempt], [{ media: null, status: "running" }]],
			updateRows: [[{ id: ATTEMPT_ID }], [{ id: ATTEMPT_ID }]],
		});
		const providerText = JSON.stringify({
			question: "Choose which Higgsfield plan to use",
			type: "unlim_choice",
		});
		mocks.client.callTool.mockResolvedValue({
			content: [{ text: providerText, type: "text" }],
		});

		await expect(
			task.run(payload, {
				ctx: { run: { id: "run-7" } },
				signal: new AbortController().signal,
			}),
		).rejects.toThrow(
			"This Higgsfield tool needs a higher Higgsfield plan. Update your Higgsfield account, then try again.",
		);

		expect(mocks.billing.refund).toHaveBeenCalledOnce();
		expect(mocks.recordReceipt).not.toHaveBeenCalled();
		expect(database.set).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				error:
					"This Higgsfield tool needs a higher Higgsfield plan. Update your Higgsfield account, then try again.",
				failureKind: "connector_account",
				failureProviderMessage:
					"This Higgsfield tool needs a higher Higgsfield plan.",
				failureSource: "higgsfield",
			}),
		);
	});
});

function useImmediateTimers() {
	return vi.spyOn(globalThis, "setTimeout").mockImplementation(((
		callback: () => void,
	) => {
		queueMicrotask(callback);
		return 0;
	}) as unknown as typeof setTimeout);
}

function mockJobStatusDefinition(): void {
	mocks.client.listTools.mockResolvedValue({
		tools: [
			{
				inputSchema: { properties: { job_id: {} } },
				name: "job_status",
			},
		],
	});
}

function setupDatabase(input: {
	selectRows: unknown[][];
	updateRows: unknown[][];
}) {
	const selectRows = [...input.selectRows];
	const updateRows = [...input.updateRows];
	const limit = vi.fn(async () => selectRows.shift() ?? []);
	const returning = vi.fn(async () => updateRows.shift() ?? []);
	const set = vi.fn((_values: unknown) => ({
		where: vi.fn(() => ({ returning })),
	}));
	const database = {
		$client: { end: mocks.end },
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({ limit })),
			})),
		})),
		update: vi.fn(() => ({ set })),
	};
	mocks.createDb.mockReturnValue(database);

	return { ...database, limit, returning, set };
}
