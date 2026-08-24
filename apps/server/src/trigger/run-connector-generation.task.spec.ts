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

const attempt = {
	args: { urls: ["https://www.youtube.com/watch?v=clip"] },
	connectorSlug: "higgsfield",
	id: ATTEMPT_ID,
	organizationId: null,
	status: "queued",
	toolName: "personal_clipper_create",
	userId: USER_ID,
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
				error: UNFOLLOWABLE_MESSAGE,
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
			reason: USER_MESSAGE,
		});

		expect(database.set).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ error: USER_MESSAGE, status: "failed" }),
		);
		expect(mocks.captureResult).toHaveBeenCalledWith(
			mocks.billing,
			payload.billing,
			errorResult,
		);
		expect(mocks.billing.refund).not.toHaveBeenCalled();
		expect(mocks.logger.warn).toHaveBeenCalledWith(
			"Connector generation submit was rejected by the provider",
			{ kind: "validation", providerText },
		);
		expect(mocks.recordReceipt).not.toHaveBeenCalled();
	});

	it("captures unknown submit errors, stores safe text, and throws the raw provider text", async () => {
		const database = setupDatabase({
			selectRows: [[attempt], [{ media: null, status: "running" }]],
			updateRows: [[{ id: ATTEMPT_ID }], [{ id: ATTEMPT_ID }]],
		});
		const providerText = "Unexpected provider failure (Request ID: req-secret)";
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
		expect((thrown as Error).message).toBe(providerText);

		expect(database.set).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				error: "Unexpected provider failure",
				status: "failed",
			}),
		);
		expect(mocks.captureResult).toHaveBeenCalledWith(
			mocks.billing,
			payload.billing,
			errorResult,
		);
		expect(mocks.billing.refund).toHaveBeenCalledOnce();
		expect(mocks.recordReceipt).not.toHaveBeenCalled();
	});

	it("does not refund an unknown submit rejection with provider evidence", async () => {
		const database = setupDatabase({
			selectRows: [[attempt], [{ media: null, status: "running" }]],
			updateRows: [[{ id: ATTEMPT_ID }], [{ id: ATTEMPT_ID }]],
		});
		const providerText = "Unexpected provider failure (Request ID: req-secret)";
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
		expect((thrown as Error).message).toBe(providerText);
		expect(database.set).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				error: "Unexpected provider failure",
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
		const providerText = "Unexpected provider failure (Request ID: req-secret)";
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
		expect((thrown as Error).message).toBe(providerText);
		expect(database.set).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				error: "Unexpected provider failure",
				status: "failed",
			}),
		);
		expect(mocks.billing.refund).not.toHaveBeenCalled();
		expect(mocks.logger.error).toHaveBeenCalledWith(
			`Connector submit-result capture failed for attempt ${ATTEMPT_ID}`,
			{ error: captureError },
		);
		expect(mocks.recordReceipt).not.toHaveBeenCalled();
	});

	it("keeps the existing unlim_choice verdict as a failed run", async () => {
		setupDatabase({
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
		).rejects.toThrow(providerText);

		expect(mocks.billing.refund).toHaveBeenCalledOnce();
		expect(mocks.recordReceipt).not.toHaveBeenCalled();
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

function setupDatabase(input: {
	selectRows: unknown[][];
	updateRows: unknown[][];
}) {
	const selectRows = [...input.selectRows];
	const updateRows = [...input.updateRows];
	const limit = vi.fn(async () => selectRows.shift() ?? []);
	const returning = vi.fn(async () => updateRows.shift() ?? []);
	const set = vi.fn(() => ({
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
