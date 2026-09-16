import type {
	BuilderTurnStatus,
	HarnessPendingInteraction,
} from "@wandit/contracts";
import type { UIMessageChunk } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeBuilderHarness } from "../modules/app-builder/application/harness/fake.harness";
import { EmptyHostToolRegistry } from "../modules/app-builder/application/host-tools/host-tool-registry";
import type { LlmProxyTokenClaimsInput } from "../modules/app-builder/application/services/llm-proxy-token.service";
import type {
	HarnessResumeState,
	HarnessStreamEvent,
} from "../modules/app-builder/domain/ports/builder-harness";
import type {
	CommitTurnDeps,
	CommitTurnInput,
	CommitTurnResult,
} from "../modules/app-builder/infrastructure/git/commit-turn";
import type { BuilderSessionRow } from "../modules/app-builder/infrastructure/persistence/builder-sessions.repository";
import type {
	BuilderTurnFailure,
	BuilderTurnPatch,
	BuilderTurnRow,
	BuilderTurnUsage,
} from "../modules/app-builder/infrastructure/persistence/builder-turns.repository";
import type { ProjectCostCapsRow } from "../modules/app-builder/infrastructure/persistence/project-cost-caps.repository";
import type { TurnProjectRow } from "../modules/app-builder/infrastructure/persistence/turn-project.repository";
import { FakeTurnLock } from "../modules/app-builder/infrastructure/redis/fake-turn-lock";
import { TURN_LOCK_TTL_MS } from "../modules/app-builder/infrastructure/redis/redis-turn-lock";
import { FakeSandboxProvider } from "../modules/app-builder/infrastructure/sandbox/fake-sandbox.provider";
import { FakeTurnEventStream } from "../modules/app-builder/infrastructure/trigger/fake-turn-events";
import type { MeteringSubject } from "../modules/credits/domain/credit-owner";
import type { MeteringService } from "../modules/metering/application/services/metering.service";

import {
	type BuilderTurnDeps,
	type BuilderTurnInput,
	runBuilderTurn,
} from "./builder-turn.runtime";

// The runtime's failure path captures through Sentry; the spec replaces
// the third-party SDK with a stub so no event leaves the test process.
vi.mock("@wandit/observability/node", () => ({
	Sentry: {
		captureException: () => "sentry-event-test",
		logger: {
			error: () => {},
			info: () => {},
			warn: () => {},
		},
	},
}));

const TURN_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const CHAT_ID = "33333333-3333-4333-8333-333333333333";
const PAUSED_TURN_ID = "44444444-4444-4444-8444-444444444444";
const RUN_ID = "run_test_1";
const MODEL = "anthropic/claude-sonnet-5";
const PROXY_BASE_URL = "https://api.test/api/v2/llm";

/** The question card a suspended turn waits on; two options. */
const PENDING_QUESTION: HarnessPendingInteraction = {
	kind: "question",
	questions: [
		{
			id: "question-1",
			options: [
				{ id: "option-1", label: "Blue" },
				{ id: "option-2", label: "Green" },
			],
			question: "Which color?",
		},
	],
	toolCallId: "call-1",
};

/** A question card with two questions; the answer turn answers the first. */
const PENDING_TWO_QUESTIONS: HarnessPendingInteraction = {
	kind: "question",
	questions: [
		...(PENDING_QUESTION.kind === "question" ? PENDING_QUESTION.questions : []),
		{ id: "question-2", options: [], question: "Which font?" },
	],
	toolCallId: "call-1",
};

/** The approval card a suspended turn waits on. */
const PENDING_APPROVAL: HarnessPendingInteraction = {
	approvalId: "appr-1",
	input: '{"prompt":"a hero image"}',
	kind: "approval",
	toolCallId: "call-9",
	toolName: "generate_image",
};

/** The session row a paused turn leaves behind for the answer turn. */
function pausedSessionRow(
	pending: HarnessPendingInteraction[],
): BuilderSessionRow {
	// SAFETY: the runtime reads only resumeState off the session row.
	return {
		resumeState: {
			harness: "claude_code",
			payload: "{}",
			pending,
		},
	} as BuilderSessionRow;
}

/** In-memory `builder_turns` store with the CAS surface the runtime uses. */
class FakeTurns {
	claimResult = true;
	completeResult = true;
	failResult = true;
	transitionResult = true;
	/** Highest turn number of the project; fencing reads it per write. */
	current = 1;
	row: BuilderTurnRow;
	/** The paused row `findWaitingForUser` answers, or null. */
	waitingForUser: BuilderTurnRow | null = null;

	readonly claimCalls: { runId: string; turnId: string }[] = [];
	readonly completeCalls: {
		input: {
			completedAt: Date;
			outputCommitSha: string | null;
			status: BuilderTurnStatus;
		};
		turnId: string;
	}[] = [];
	readonly failCalls: { failure: BuilderTurnFailure; turnId: string }[] = [];
	readonly usageCalls: { turnId: string; usage: BuilderTurnUsage }[] = [];
	readonly transitionCalls: {
		from: BuilderTurnStatus[];
		patch: BuilderTurnPatch | undefined;
		to: BuilderTurnStatus;
		turnId: string;
	}[] = [];

	constructor() {
		this.row = fakeTurnRow({});
	}

	async claimRunning(turnId: string, triggerRunId: string) {
		this.claimCalls.push({ runId: triggerRunId, turnId });
		return this.claimResult;
	}

	async findById(_turnId: string): Promise<BuilderTurnRow | null> {
		return this.row;
	}

	async findWaitingForUser(_projectId: string): Promise<BuilderTurnRow | null> {
		return this.waitingForUser;
	}

	async currentTurnNumber(_projectId: string): Promise<number> {
		return this.current;
	}

	async recordUsage(turnId: string, usage: BuilderTurnUsage) {
		this.usageCalls.push({ turnId, usage });
	}

	async complete(
		turnId: string,
		input: {
			completedAt: Date;
			outputCommitSha: string | null;
			status: BuilderTurnStatus;
		},
	) {
		this.completeCalls.push({ input, turnId });
		return this.completeResult;
	}

	async fail(turnId: string, failure: BuilderTurnFailure) {
		this.failCalls.push({ failure, turnId });
		return this.failResult;
	}

	async transition(
		turnId: string,
		from: BuilderTurnStatus[],
		to: BuilderTurnStatus,
		patch?: BuilderTurnPatch,
	) {
		this.transitionCalls.push({ from, patch, to, turnId });
		return this.transitionResult;
	}
}

/** In-memory `builder_sessions` store. */
class FakeSessions {
	row: BuilderSessionRow | null = null;
	readonly saved: {
		chatId: string;
		input: {
			model: string | null;
			providerSessionId: string | null;
			resumeState: HarnessResumeState;
		};
	}[] = [];

	async findByChatId(_chatId: string): Promise<BuilderSessionRow | null> {
		return this.row;
	}

	async saveResumeState(
		chatId: string,
		input: {
			model: string | null;
			providerSessionId: string | null;
			resumeState: HarnessResumeState;
		},
	) {
		this.saved.push({ chatId, input });
		return this.row;
	}
}

/** In-memory `ai_usage_events` store: one hold row. */
class FakeMetering {
	event: Awaited<ReturnType<MeteringService["findByIdempotencyKey"]>> =
		fakeHoldEvent("reserved");
	readonly keys: string[] = [];
	readonly refundCalls: { eventId: string; reason: string }[] = [];
	readonly settleCalls: {
		eventId: string;
		settlement: Parameters<MeteringService["settle"]>[1];
	}[] = [];

	async findByIdempotencyKey(
		key: string,
		_subject: MeteringSubject,
	): ReturnType<MeteringService["findByIdempotencyKey"]> {
		this.keys.push(key);
		return this.event;
	}

	async refund(
		eventId: string,
		reason = "ai_usage_refund",
	): ReturnType<MeteringService["refund"]> {
		this.refundCalls.push({ eventId, reason });
		// SAFETY: the runtime ignores the refunded row.
		return { id: eventId, status: "refunded" } as Awaited<
			ReturnType<MeteringService["refund"]>
		>;
	}

	async settle(
		eventId: string,
		settlement: Parameters<MeteringService["settle"]>[1],
	): ReturnType<MeteringService["settle"]> {
		this.settleCalls.push({ eventId, settlement });
		// SAFETY: the runtime reads only `id` and `status` off the answer.
		return { id: eventId, status: "settled" } as Awaited<
			ReturnType<MeteringService["settle"]>
		>;
	}
}

function fakeTurnRow(over: Partial<BuilderTurnRow>): BuilderTurnRow {
	// SAFETY: the runtime reads only chatId, turnNumber, and spec off the row.
	return {
		chatId: CHAT_ID,
		id: TURN_ID,
		projectId: PROJECT_ID,
		spec: { attachments: [], composer: null, message: "Build a form" },
		turnNumber: 1,
		...over,
	} as BuilderTurnRow;
}

function fakeProjectRow(over?: Partial<TurnProjectRow>): TurnProjectRow {
	return {
		engine: "v2_app",
		framework: "web-app",
		languages: ["en"],
		networkAllowedHosts: [],
		organizationId: null,
		templateVersion: "web-app@1.0.0",
		userId: "user_1",
		...over,
	};
}

function fakeCapsRow(perTurnCapCredits: number | null): ProjectCostCapsRow {
	return { monthlyCapCredits: null, perTurnCapCredits };
}

function fakeHoldEvent(
	status: "reserved" | "settled",
): Awaited<ReturnType<MeteringService["findByIdempotencyKey"]>> {
	// SAFETY: the runtime reads only id and status off the hold row.
	return { id: "evt_hold_1", status } as Awaited<
		ReturnType<MeteringService["findByIdempotencyKey"]>
	>;
}

function fakeCommitResult(): CommitTurnResult {
	return {
		// SAFETY: the runtime reads only sha and numstat off the result.
		commit: {} as CommitTurnResult["commit"],
		numstat: [{ deletions: 0, insertions: 3, path: "src/app.ts" }],
		parentSha: null,
		patchKey: "git/p/patches/sha1.diff",
		sha: "commit-sha-1",
	};
}

function textChunks(text: string): UIMessageChunk[] {
	return [
		{ id: "t1", type: "text-start" },
		{ delta: text, id: "t1", type: "text-delta" },
		{ id: "t1", type: "text-end" },
	];
}

function makeWorld(over?: {
	caps?: ProjectCostCapsRow | null;
	project?: TurnProjectRow | null;
}) {
	const turns = new FakeTurns();
	const sessions = new FakeSessions();
	const metering = new FakeMetering();
	const stream = new FakeTurnEventStream();
	const lock = new FakeTurnLock();
	const sandboxes = new FakeSandboxProvider();
	const harness = new FakeBuilderHarness();
	const touched: string[] = [];
	const revoked: string[] = [];
	const minted: LlmProxyTokenClaimsInput[] = [];
	const commits: CommitTurnInput[] = [];
	const inserted: {
		input: Parameters<BuilderTurnDeps["insertAssistantMessage"]>[0];
	}[] = [];
	const promoted: { endedTurnId: string; projectId: string }[] = [];
	const warnings: string[] = [];

	const commitDeps: CommitTurnDeps = {
		appCommits: {
			findBranch: async () => null,
			insert: async () => {
				throw new Error("unused in this spec");
			},
			upsertBranchHead: async () => false,
		},
		gitStore: {
			deleteRepository: async () => {},
			ensureRepository: async () => ({
				remoteUrl: "https://git.test/repo",
			}),
			issueCredential: async () => ({
				expiresAt: new Date(),
				password: "p",
				remoteUrl: "https://git.test/repo",
				username: "u",
			}),
		},
		putPatch: async () => {},
	};

	const deps: BuilderTurnDeps = {
		caps: {
			findByProjectId: async () =>
				over?.caps === undefined ? fakeCapsRow(6400) : over.caps,
		},
		commit: async (_sandbox, _deps, input) => {
			commits.push(input);
			return fakeCommitResult();
		},
		commitDeps,
		counters: {
			revokeRun: async (runId) => {
				revoked.push(runId);
			},
		},
		harness,
		hostTools: new EmptyHostToolRegistry(),
		insertAssistantMessage: async (input) => {
			inserted.push({ input });
		},
		lock,
		logger: {
			error: () => {},
			info: () => {},
			warn: (message) => {
				warnings.push(message);
			},
		},
		metering,
		mintToken: (claims) => {
			minted.push(claims);
			return "fake-run-token";
		},
		model: MODEL,
		now: () => Date.now(),
		project: {
			findForTurn: async () =>
				over?.project === undefined ? fakeProjectRow() : over.project,
		},
		promoteNext: async (projectId, endedTurnId) => {
			promoted.push({ endedTurnId, projectId });
		},
		proxyBaseUrl: PROXY_BASE_URL,
		resolvePlan: async () => "pro",
		sandboxSessions: {
			touchActivity: async (projectId) => {
				touched.push(projectId);
			},
		},
		sandboxes,
		sessions,
		turns,
		usdMicrosPerCredit: 32_000,
		writer: stream,
	};

	return {
		commits,
		deps,
		harness,
		inserted,
		lock,
		metering,
		minted,
		promoted,
		revoked,
		sandboxes,
		sessions,
		stream,
		touched,
		turns,
		warnings,
	};
}

function makeInput(): {
	controller: AbortController;
	input: BuilderTurnInput;
} {
	const controller = new AbortController();
	return {
		controller,
		input: {
			actorUserId: "user_1",
			organizationId: null,
			projectId: PROJECT_ID,
			runId: RUN_ID,
			turnId: TURN_ID,
		},
	};
}

function happyEvents(): HarnessStreamEvent[] {
	return [
		...textChunks("Here is your app").map((chunk) => ({
			chunk,
			type: "part" as const,
		})),
		{
			cacheReadTokens: 0,
			cacheWriteTokens: 0,
			inputTokens: 100,
			outputTokens: 50,
			type: "usage",
		},
	];
}

/** Lets the run reach `harness.stream` before the spec drives timers. */
async function waitForStream(harness: FakeBuilderHarness) {
	await vi.waitFor(
		() => {
			expect(harness.streamCalls).toHaveLength(1);
		},
		{ interval: 1, timeout: 2000 },
	);
}

describe("runBuilderTurn", () => {
	beforeEach(async () => {
		vi.useRealTimers();
	});

	it("exits without touching anything when the claim fails", async () => {
		const world = makeWorld();
		world.turns.claimResult = false;
		const { controller, input } = makeInput();

		await runBuilderTurn(world.deps, input, controller.signal);

		expect(world.stream.eventsOf(TURN_ID)).toHaveLength(0);
		expect(world.sandboxes.createdCount).toBe(0);
		expect(world.harness.createCalls).toHaveLength(0);
		expect(world.turns.failCalls).toHaveLength(0);
		expect(world.minted).toHaveLength(0);
	});

	it("rejects the first fenced write when a newer turn number owns the project", async () => {
		const world = makeWorld();
		world.turns.current = 5;
		const { controller, input } = makeInput();

		await runBuilderTurn(world.deps, input, controller.signal);

		expect(world.turns.failCalls).toHaveLength(1);
		expect(world.turns.failCalls[0]?.failure.failureCode).toBe(
			"BUILDER_TURN_STALE",
		);
		expect(world.sandboxes.createdCount).toBe(0);
		// The terminal events still flush: they are unfenced by design.
		const types = world.stream.eventsOf(TURN_ID).map((e) => e.type);
		expect(types).toEqual(["error", "done"]);
	});

	it("runs the happy path: events, row writes, settle, release, promote", async () => {
		const world = makeWorld();
		world.harness.events = happyEvents();
		await world.lock.acquire(PROJECT_ID, TURN_ID, TURN_LOCK_TTL_MS);
		const { controller, input } = makeInput();

		await runBuilderTurn(world.deps, input, controller.signal);

		const events = world.stream.eventsOf(TURN_ID);
		expect(events.map((e) => e.type)).toEqual([
			"status",
			"status",
			"status",
			"part",
			"part",
			"part",
			"usage",
			"status",
			"part",
			"done",
		]);
		const phases = events
			.filter((e) => e.type === "status")
			.map((e) => (e.type === "status" ? e.data.phase : ""));
		expect(phases).toEqual([
			"sandbox_waking",
			"session_starting",
			"running",
			"committing",
		]);
		// Envelope: every event carries a sequential id and an `at` stamp.
		for (const [index, event] of events.entries()) {
			expect(event.id).toBe(String(index));
			expect(Number.isInteger(event.at)).toBe(true);
		}
		// 700 USD micros of priced usage → ceil(70000/32000) = 3 centi-credits.
		const usageEvent = events.find((e) => e.type === "usage");
		expect(usageEvent?.type === "usage" && usageEvent.data.credits).toBe(3);
		const filesEvent = events.at(-2);
		expect(filesEvent?.type).toBe("part");
		const doneEvent = events.at(-1);
		expect(doneEvent?.type === "done" && doneEvent.data).toEqual({
			outputCommitSha: "commit-sha-1",
			receipt: { credits: 3 },
			status: "succeeded",
		});

		expect(world.commits).toHaveLength(1);
		expect(world.commits[0]?.source).toBe("agent");
		expect(world.commits[0]?.summary).toBe("Here is your app");
		expect(world.commits[0]?.turnId).toBe(TURN_ID);

		expect(world.inserted).toHaveLength(1);
		const inserted = world.inserted[0]?.input;
		expect(inserted?.turnId).toBe(TURN_ID);
		expect(inserted?.chatId).toBe(CHAT_ID);
		expect(inserted?.metadata).toEqual({
			harness: "claude_code",
			model: MODEL,
			outputCommitSha: "commit-sha-1",
			usage: {
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
				credits: 3,
				inputTokens: 100,
				outputTokens: 50,
			},
		});
		expect(inserted?.parts.at(0)?.type).toBe("text");

		expect(world.turns.usageCalls).toHaveLength(1);
		expect(world.turns.usageCalls[0]?.usage.credits).toBe(3);
		expect(world.turns.usageCalls[0]?.usage.model).toBe(MODEL);
		expect(world.turns.completeCalls).toHaveLength(1);
		expect(world.turns.completeCalls[0]?.input.status).toBe("succeeded");
		expect(world.turns.completeCalls[0]?.input.outputCommitSha).toBe(
			"commit-sha-1",
		);

		expect(world.metering.settleCalls).toHaveLength(1);
		const settle = world.metering.settleCalls[0];
		expect(settle?.eventId).toBe("evt_hold_1");
		expect(settle?.settlement.pricing).toBe("token");
		if (settle?.settlement.pricing === "token") {
			expect(settle.settlement.modelId).toBe(MODEL);
		}
		expect(world.metering.refundCalls).toHaveLength(0);

		expect(world.sessions.saved).toHaveLength(1);
		expect(world.sessions.saved[0]?.input.providerSessionId).toBe(
			"fake-session-1",
		);
		expect(world.sessions.saved[0]?.input.model).toBe(MODEL);

		expect(world.revoked).toEqual([RUN_ID]);
		expect(await world.lock.holder(PROJECT_ID)).toBeNull();
		expect(world.promoted).toEqual([
			{ endedTurnId: TURN_ID, projectId: PROJECT_ID },
		]);
		expect(world.touched.length).toBeGreaterThanOrEqual(2);
	});

	it("fails the turn on a harness stream error and refunds the hold", async () => {
		const world = makeWorld();
		world.harness.streamError = new Error("provider blew up");
		await world.lock.acquire(PROJECT_ID, TURN_ID, TURN_LOCK_TTL_MS);
		const { controller, input } = makeInput();

		await runBuilderTurn(world.deps, input, controller.signal);

		expect(world.turns.failCalls).toHaveLength(1);
		const failure = world.turns.failCalls[0]?.failure;
		expect(failure?.error.length).toBeGreaterThan(0);
		expect(failure?.sentryEventId).toBe("sentry-event-test");

		const types = world.stream.eventsOf(TURN_ID).map((e) => e.type);
		expect(types).toContain("error");
		expect(types.at(-1)).toBe("done");
		const done = world.stream.eventsOf(TURN_ID).at(-1);
		expect(done?.type === "done" && done.data.status).toBe("failed");

		expect(world.metering.refundCalls).toEqual([
			{ eventId: "evt_hold_1", reason: "builder_turn_failed" },
		]);
		expect(world.metering.settleCalls).toHaveLength(0);
		expect(world.harness.detachCalls).toHaveLength(1);
		expect(world.revoked).toEqual([RUN_ID]);
		expect(world.promoted).toEqual([
			{ endedTurnId: TURN_ID, projectId: PROJECT_ID },
		]);
	});

	it("writes one error event for a harness error chunk", async () => {
		const world = makeWorld();
		world.harness.events = [
			{
				code: "harness_error",
				message: "boom",
				retryable: false,
				type: "error",
			},
		];
		await world.lock.acquire(PROJECT_ID, TURN_ID, TURN_LOCK_TTL_MS);
		const { controller, input } = makeInput();

		await runBuilderTurn(world.deps, input, controller.signal);

		const events = world.stream.eventsOf(TURN_ID);
		const errors = events.filter((e) => e.type === "error");
		expect(errors).toHaveLength(1);
		expect(errors[0]?.type === "error" && errors[0].data.code).toBe(
			"harness_error",
		);
		expect(events.map((e) => e.type).slice(-2)).toEqual(["error", "done"]);
		const done = events.at(-1);
		expect(done?.type === "done" && done.data.status).toBe("failed");
		expect(world.turns.failCalls[0]?.failure.failureCode).toBe("harness_error");
		expect(world.metering.refundCalls).toEqual([
			{ eventId: "evt_hold_1", reason: "builder_turn_failed" },
		]);
	});

	it("fails with model_missing before the sandbox starts", async () => {
		const world = makeWorld();
		world.deps.model = null;
		const { controller, input } = makeInput();

		await runBuilderTurn(world.deps, input, controller.signal);

		expect(world.turns.failCalls[0]?.failure.failureCode).toBe("model_missing");
		expect(world.sandboxes.createdCount).toBe(0);
		expect(world.minted).toHaveLength(0);
	});

	it("fails with project_not_v2 on a V1 project", async () => {
		const world = makeWorld({
			project: { ...fakeProjectRow(), engine: "v1_page" },
		});
		const { controller, input } = makeInput();

		await runBuilderTurn(world.deps, input, controller.signal);

		expect(world.turns.failCalls[0]?.failure.failureCode).toBe(
			"project_not_v2",
		);
	});

	it("frees the slot when the claimed turn has no chat", async () => {
		const world = makeWorld();
		world.turns.row = fakeTurnRow({ chatId: null });
		await world.lock.acquire(PROJECT_ID, TURN_ID, TURN_LOCK_TTL_MS);
		const { controller, input } = makeInput();

		await runBuilderTurn(world.deps, input, controller.signal);

		expect(world.turns.failCalls[0]?.failure.failureCode).toBe("chat_missing");
		// No token and no sandbox exist on this path; the lock and the
		// waiting-turn promotion still run.
		expect(await world.lock.holder(PROJECT_ID)).toBeNull();
		expect(world.promoted).toEqual([
			{ endedTurnId: TURN_ID, projectId: PROJECT_ID },
		]);
		expect(world.sandboxes.createdCount).toBe(0);
		expect(world.metering.refundCalls).toEqual([
			{ eventId: "evt_hold_1", reason: "builder_turn_failed" },
		]);
		const events = world.stream.eventsOf(TURN_ID);
		expect(events.map((e) => e.type)).toEqual(["error", "done"]);
		expect(events[0]?.type === "error" && events[0].data.code).toBe(
			"chat_missing",
		);
		expect(events[1]?.type === "done" && events[1].data.status).toBe("failed");
	});

	it("commits wip state and marks the turn canceled on abort", async () => {
		vi.useFakeTimers();
		const world = makeWorld();
		let release: () => void = () => {};
		world.harness.streamHold = new Promise<void>((resolve) => {
			release = resolve;
		});
		await world.lock.acquire(PROJECT_ID, TURN_ID, TURN_LOCK_TTL_MS);
		const { controller, input } = makeInput();

		const run = runBuilderTurn(world.deps, input, controller.signal);
		await waitForStream(world.harness);
		controller.abort();
		release();
		await run;

		expect(world.commits).toHaveLength(1);
		expect(world.commits[0]?.source).toBe("wip");
		expect(world.commits[0]?.summary).toBe("Interrupted");
		expect(world.harness.detachCalls).toHaveLength(1);
		expect(world.sessions.saved).toHaveLength(1);
		const done = world.stream.eventsOf(TURN_ID).at(-1);
		expect(done?.type === "done" && done.data.status).toBe("canceled");
		expect(world.turns.transitionCalls).toEqual([
			{ from: ["cancelling", "running"], to: "canceled", turnId: TURN_ID },
		]);
		expect(world.metering.refundCalls).toEqual([
			{ eventId: "evt_hold_1", reason: "builder_turn_canceled" },
		]);
		expect(world.revoked).toEqual([RUN_ID]);
		expect(await world.lock.holder(PROJECT_ID)).toBeNull();
		expect(world.promoted).toEqual([
			{ endedTurnId: TURN_ID, projectId: PROJECT_ID },
		]);
	});

	it("refreshes the lock, keepAlive, and activity every 60 s", async () => {
		vi.useFakeTimers();
		const world = makeWorld();
		let release: () => void = () => {};
		world.harness.streamHold = new Promise<void>((resolve) => {
			release = resolve;
		});
		await world.lock.acquire(PROJECT_ID, TURN_ID, TURN_LOCK_TTL_MS);
		const { controller, input } = makeInput();

		const run = runBuilderTurn(world.deps, input, controller.signal);
		await waitForStream(world.harness);
		const touchedBefore = world.touched.length;

		await vi.advanceTimersByTimeAsync(60_000);

		expect(world.sandboxes.keepAliveCalls).toBe(1);
		expect(world.touched.length).toBe(touchedBefore + 1);
		// The lock is still held: refresh succeeded instead of failing the turn.
		expect(await world.lock.holder(PROJECT_ID)).toBe(TURN_ID);
		expect(world.turns.failCalls).toHaveLength(0);

		release();
		await run;
	});

	it("writes a Working heartbeat after 30 s of part silence", async () => {
		vi.useFakeTimers();
		const world = makeWorld();
		let release: () => void = () => {};
		world.harness.streamHold = new Promise<void>((resolve) => {
			release = resolve;
		});
		await world.lock.acquire(PROJECT_ID, TURN_ID, TURN_LOCK_TTL_MS);
		const { controller, input } = makeInput();

		const run = runBuilderTurn(world.deps, input, controller.signal);
		await waitForStream(world.harness);

		await vi.advanceTimersByTimeAsync(30_000);

		const statuses = world.stream
			.eventsOf(TURN_ID)
			.filter((e) => e.type === "status");
		const last = statuses.at(-1);
		expect(last?.type === "status" && last.data).toEqual({
			message: "Working",
			phase: "running",
		});

		release();
		await run;
	});

	it("aborts as stalled after 4 minutes without a part", async () => {
		vi.useFakeTimers();
		const world = makeWorld();
		let release: () => void = () => {};
		world.harness.streamHold = new Promise<void>((resolve) => {
			release = resolve;
		});
		await world.lock.acquire(PROJECT_ID, TURN_ID, TURN_LOCK_TTL_MS);
		const { controller, input } = makeInput();

		const run = runBuilderTurn(world.deps, input, controller.signal);
		await waitForStream(world.harness);

		await vi.advanceTimersByTimeAsync(4 * 60_000);
		release();
		await run;

		// `stalled` is its own terminal status: the row moves by transition,
		// not by `fail` (which would write `failed`).
		expect(world.turns.failCalls).toHaveLength(0);
		expect(world.turns.transitionCalls).toEqual([
			{
				from: ["running", "cancelling"],
				patch: expect.objectContaining({ failureCode: "stalled" }),
				to: "stalled",
				turnId: TURN_ID,
			},
		]);
		const done = world.stream.eventsOf(TURN_ID).at(-1);
		expect(done?.type === "done" && done.data.status).toBe("stalled");
	});

	it("aborts with lock_lost when the lock refresh fails", async () => {
		vi.useFakeTimers();
		const world = makeWorld();
		let release: () => void = () => {};
		world.harness.streamHold = new Promise<void>((resolve) => {
			release = resolve;
		});
		await world.lock.acquire(PROJECT_ID, TURN_ID, TURN_LOCK_TTL_MS);
		const { controller, input } = makeInput();

		const run = runBuilderTurn(world.deps, input, controller.signal);
		await waitForStream(world.harness);
		// A foreign writer took the lock: the compare-expire fails.
		await world.lock.release(PROJECT_ID, TURN_ID);

		await vi.advanceTimersByTimeAsync(60_000);
		release();
		await run;

		expect(world.turns.failCalls).toHaveLength(1);
		expect(world.turns.failCalls[0]?.failure.failureCode).toBe("lock_lost");
		const done = world.stream.eventsOf(TURN_ID).at(-1);
		expect(done?.type === "done" && done.data.status).toBe("failed");
	});

	it("resumes the stored harness session instead of creating one", async () => {
		const world = makeWorld();
		// SAFETY: the runtime reads only resumeState off the session row.
		world.sessions.row = {
			resumeState: { harness: "claude_code", payload: "{}" },
		} as BuilderSessionRow;
		const { controller, input } = makeInput();

		await runBuilderTurn(world.deps, input, controller.signal);

		expect(world.harness.resumeCalls).toHaveLength(1);
		expect(world.harness.createCalls).toHaveLength(0);
		// The envelope parse fills `pending` with its default.
		expect(world.harness.resumeCalls[0]?.resumeState).toEqual({
			harness: "claude_code",
			payload: "{}",
			pending: [],
		});
	});

	it("starts a fresh session when the stored one cannot resume", async () => {
		const world = makeWorld();
		// SAFETY: the runtime reads only resumeState off the session row.
		world.sessions.row = {
			resumeState: { harness: "claude_code", payload: "{}" },
		} as BuilderSessionRow;
		world.harness.resumeError = new Error("policy conflict");
		const { controller, input } = makeInput();

		await runBuilderTurn(world.deps, input, controller.signal);

		// The dead session is logged and replaced; the turn still runs.
		expect(world.harness.resumeCalls).toHaveLength(1);
		expect(world.harness.createCalls).toHaveLength(1);
		expect(world.turns.failCalls).toHaveLength(0);
		expect(world.turns.completeCalls).toHaveLength(1);
	});

	it("mints the run token with plan, cap, and scope claims", async () => {
		const world = makeWorld();
		const { controller, input } = makeInput();

		await runBuilderTurn(world.deps, input, controller.signal);

		expect(world.minted).toHaveLength(1);
		const claims = world.minted[0];
		// 6400 cc = 64 credits × $0.032 = $2.048.
		expect(claims?.capUsd).toBeCloseTo(2.048);
		expect(claims?.plan).toBe("pro");
		expect(claims?.runId).toBe(RUN_ID);
		expect(claims?.turnId).toBe(TURN_ID);
		expect(claims?.projectId).toBe(PROJECT_ID);
		expect(claims?.userId).toBe("user_1");
		expect(claims?.workspaceId).toBeNull();
	});

	it("falls back to the 5-dollar cap when the project has no caps row", async () => {
		const world = makeWorld({ caps: null });
		const { controller, input } = makeInput();

		await runBuilderTurn(world.deps, input, controller.signal);

		expect(world.minted[0]?.capUsd).toBe(5);
	});

	it("passes the proxy env to the session without a provider key", async () => {
		const world = makeWorld();
		const { controller, input } = makeInput();

		await runBuilderTurn(world.deps, input, controller.signal);

		const env = world.harness.createCalls[0]?.env;
		expect(env?.ANTHROPIC_API_KEY).toBe("");
		expect(env?.ANTHROPIC_AUTH_TOKEN).toBe("fake-run-token");
		expect(env?.ANTHROPIC_BASE_URL).toBe(PROXY_BASE_URL);
		expect(env?.ANTHROPIC_CUSTOM_HEADERS).toContain(RUN_ID);
		expect(env?.VITE_SUPABASE_URL).toBeUndefined();
		expect(env?.VITE_SUPABASE_ANON_KEY).toBeUndefined();
	});

	it("pauses on a pending question and waits for the answer turn", async () => {
		const world = makeWorld();
		world.harness.events = happyEvents();
		world.harness.unfinishedTurn = true;
		world.harness.pendingOnSuspend = [PENDING_QUESTION];
		await world.lock.acquire(PROJECT_ID, TURN_ID, TURN_LOCK_TTL_MS);
		const { controller, input } = makeInput();

		await runBuilderTurn(world.deps, input, controller.signal);

		expect(world.turns.completeCalls).toHaveLength(1);
		expect(world.turns.completeCalls[0]?.input.status).toBe(
			"waiting_for_answer",
		);
		expect(world.harness.suspendCalls).toEqual(["fake-session-1"]);
		expect(world.harness.detachCalls).toHaveLength(0);

		// The card goes out as a stream part and into the assistant message.
		type CardChunk = {
			data?: { answer?: string | null; options?: string[] };
			id?: string;
			type?: string;
		};
		// SAFETY: the spec wrote the chunks; the card is the only data part.
		const chunks = world.stream
			.eventsOf(TURN_ID)
			.filter((e) => e.type === "part")
			.map((e) => e.data) as CardChunk[];
		const card = chunks.find((chunk) => chunk.type === "data-question");
		expect(card).toEqual({
			data: {
				answer: null,
				options: ["Blue", "Green"],
				question: "Which color?",
				questionId: "question-1",
				toolCallId: "call-1",
			},
			id: "call-1:question-1",
			type: "data-question",
		});
		expect(world.inserted[0]?.input.parts).toContainEqual(card);

		// The suspended state lands in the session row with its pending card.
		expect(world.sessions.saved[0]?.input.resumeState.pending).toEqual([
			PENDING_QUESTION,
		]);

		const done = world.stream.eventsOf(TURN_ID).at(-1);
		expect(done?.type === "done" && done.data.status).toBe(
			"waiting_for_answer",
		);
		expect(world.metering.settleCalls).toHaveLength(1);
		expect(await world.lock.holder(PROJECT_ID)).toBeNull();
		expect(world.promoted).toEqual([
			{ endedTurnId: TURN_ID, projectId: PROJECT_ID },
		]);
	});

	it("writes one question card per question of a pending call", async () => {
		const world = makeWorld();
		world.harness.events = happyEvents();
		world.harness.unfinishedTurn = true;
		world.harness.pendingOnSuspend = [PENDING_TWO_QUESTIONS];
		await world.lock.acquire(PROJECT_ID, TURN_ID, TURN_LOCK_TTL_MS);
		const { controller, input } = makeInput();

		await runBuilderTurn(world.deps, input, controller.signal);

		type CardChunk = { id?: string; type?: string };
		// SAFETY: the spec wrote the chunks; the cards are the only data parts.
		const chunks = world.stream
			.eventsOf(TURN_ID)
			.filter((e) => e.type === "part")
			.map((e) => e.data) as CardChunk[];
		const cards = chunks.filter((chunk) => chunk.type === "data-question");
		expect(cards.map((card) => card.id)).toEqual([
			"call-1:question-1",
			"call-1:question-2",
		]);
		for (const card of cards) {
			expect(world.inserted[0]?.input.parts).toContainEqual(card);
		}
	});

	it("pauses on a pending approval and completes as waiting_for_approval", async () => {
		const world = makeWorld();
		world.harness.events = happyEvents();
		world.harness.unfinishedTurn = true;
		world.harness.pendingOnSuspend = [PENDING_APPROVAL];
		await world.lock.acquire(PROJECT_ID, TURN_ID, TURN_LOCK_TTL_MS);
		const { controller, input } = makeInput();

		await runBuilderTurn(world.deps, input, controller.signal);

		expect(world.turns.completeCalls).toHaveLength(1);
		expect(world.turns.completeCalls[0]?.input.status).toBe(
			"waiting_for_approval",
		);
		expect(world.harness.suspendCalls).toEqual(["fake-session-1"]);

		// The approval card goes out as a stream part and into the message.
		type CardChunk = {
			data?: { decision?: string | null };
			id?: string;
			type?: string;
		};
		// SAFETY: the spec wrote the chunks; the card is the only data-approval part.
		const chunks = world.stream
			.eventsOf(TURN_ID)
			.filter((e) => e.type === "part")
			.map((e) => e.data) as CardChunk[];
		const card = chunks.find((chunk) => chunk.type === "data-approval");
		expect(card).toEqual({
			data: {
				approvalId: "appr-1",
				decision: null,
				input: '{"prompt":"a hero image"}',
				toolCallId: "call-9",
				toolName: "generate_image",
			},
			id: "appr-1",
			type: "data-approval",
		});
		expect(world.inserted[0]?.input.parts).toContainEqual(card);

		const done = world.stream.eventsOf(TURN_ID).at(-1);
		expect(done?.type === "done" && done.data.status).toBe(
			"waiting_for_approval",
		);
	});

	it("continues a suspended turn with the option answer from the message", async () => {
		const world = makeWorld();
		world.sessions.row = pausedSessionRow([PENDING_QUESTION]);
		world.turns.waitingForUser = fakeTurnRow({
			id: PAUSED_TURN_ID,
			status: "waiting_for_answer",
		});
		world.turns.row = fakeTurnRow({
			spec: { attachments: [], composer: null, message: "green" },
		});
		const { controller, input } = makeInput();

		await runBuilderTurn(world.deps, input, controller.signal);

		expect(world.harness.resumeCalls).toHaveLength(1);
		expect(world.harness.streamCalls[0]?.input).toEqual({
			approvals: [],
			kind: "continue",
			signal: expect.any(AbortSignal),
			toolResults: [
				{
					answers: { "question-1": { optionIds: ["option-2"] } },
					partial: false,
					toolCallId: "call-1",
				},
			],
		});
		// The paused row counts as answered and moves to succeeded.
		expect(world.turns.transitionCalls).toEqual([
			{
				from: ["waiting_for_answer", "waiting_for_approval"],
				patch: undefined,
				to: "succeeded",
				turnId: PAUSED_TURN_ID,
			},
		]);
	});

	it("marks the answer partial when the call holds two questions", async () => {
		const world = makeWorld();
		world.sessions.row = pausedSessionRow([PENDING_TWO_QUESTIONS]);
		world.turns.waitingForUser = fakeTurnRow({
			id: PAUSED_TURN_ID,
			status: "waiting_for_answer",
		});
		world.turns.row = fakeTurnRow({
			spec: { attachments: [], composer: null, message: "green" },
		});
		const { controller, input } = makeInput();

		await runBuilderTurn(world.deps, input, controller.signal);

		expect(world.harness.streamCalls[0]?.input).toEqual({
			approvals: [],
			kind: "continue",
			signal: expect.any(AbortSignal),
			toolResults: [
				{
					answers: { "question-1": { optionIds: ["option-2"] } },
					partial: true,
					toolCallId: "call-1",
				},
			],
		});
	});

	it("warns when the paused row moved on before the CAS", async () => {
		const world = makeWorld();
		world.sessions.row = pausedSessionRow([PENDING_QUESTION]);
		world.turns.waitingForUser = fakeTurnRow({
			id: PAUSED_TURN_ID,
			status: "waiting_for_answer",
		});
		world.turns.row = fakeTurnRow({
			spec: { attachments: [], composer: null, message: "green" },
		});
		world.turns.transitionResult = false;
		const { controller, input } = makeInput();

		await runBuilderTurn(world.deps, input, controller.signal);

		expect(world.warnings).toContain(
			`Waiting turn ${PAUSED_TURN_ID} write lost: row moved on`,
		);
		expect(world.turns.completeCalls).toHaveLength(1);
	});

	it("sends a free-text answer as freeform", async () => {
		const world = makeWorld();
		world.sessions.row = pausedSessionRow([PENDING_QUESTION]);
		world.turns.row = fakeTurnRow({
			spec: { attachments: [], composer: null, message: "chartreuse" },
		});
		const { controller, input } = makeInput();

		await runBuilderTurn(world.deps, input, controller.signal);

		expect(world.harness.streamCalls[0]?.input).toEqual({
			approvals: [],
			kind: "continue",
			signal: expect.any(AbortSignal),
			toolResults: [
				{
					answers: {
						"question-1": { freeform: "chartreuse", optionIds: [] },
					},
					partial: false,
					toolCallId: "call-1",
				},
			],
		});
	});

	it("sends an attachment-only answer as the attachment text", async () => {
		const world = makeWorld();
		world.sessions.row = pausedSessionRow([PENDING_QUESTION]);
		world.turns.waitingForUser = fakeTurnRow({
			id: PAUSED_TURN_ID,
			status: "waiting_for_answer",
		});
		world.turns.row = fakeTurnRow({
			spec: {
				attachments: [
					{ mediaType: "image/png", url: "https://files.test/shot.png" },
				],
				composer: null,
				message: "",
			},
		});
		const { controller, input } = makeInput();

		await runBuilderTurn(world.deps, input, controller.signal);

		expect(world.harness.streamCalls[0]?.input).toMatchObject({
			kind: "continue",
			toolResults: [
				{
					answers: {
						"question-1": {
							freeform: "See the attached files.\nhttps://files.test/shot.png",
							optionIds: [],
						},
					},
					partial: false,
					toolCallId: "call-1",
				},
			],
		});
	});

	it("continues a suspended turn with the approval decision from the body", async () => {
		const world = makeWorld();
		world.sessions.row = pausedSessionRow([PENDING_APPROVAL]);
		world.turns.waitingForUser = fakeTurnRow({
			id: PAUSED_TURN_ID,
			status: "waiting_for_approval",
		});
		world.turns.row = fakeTurnRow({
			spec: {
				approval: { approvalId: "appr-1", approved: true },
				attachments: [],
				composer: null,
				message: "",
			},
		});
		const { controller, input } = makeInput();

		await runBuilderTurn(world.deps, input, controller.signal);

		expect(world.harness.streamCalls[0]?.input).toEqual({
			approvals: [{ approvalId: "appr-1", approved: true }],
			kind: "continue",
			signal: expect.any(AbortSignal),
			toolResults: [],
		});
	});

	it("denies an approval the body does not name", async () => {
		const world = makeWorld();
		world.sessions.row = pausedSessionRow([PENDING_APPROVAL]);
		world.turns.waitingForUser = fakeTurnRow({
			id: PAUSED_TURN_ID,
			status: "waiting_for_approval",
		});
		world.turns.row = fakeTurnRow({
			spec: {
				approval: { approvalId: "other", approved: true },
				attachments: [],
				composer: null,
				message: "",
			},
		});
		const { controller, input } = makeInput();

		await runBuilderTurn(world.deps, input, controller.signal);

		expect(world.harness.streamCalls[0]?.input).toMatchObject({
			approvals: [{ approvalId: "appr-1", approved: false }],
			kind: "continue",
			toolResults: [],
		});
	});

	it("tells a fresh session that the user denied the call", async () => {
		const world = makeWorld();
		world.sessions.row = pausedSessionRow([PENDING_APPROVAL]);
		world.turns.row = fakeTurnRow({
			spec: { attachments: [], composer: null, message: "" },
		});
		world.harness.resumeError = new Error("policy conflict");
		const { controller, input } = makeInput();

		await runBuilderTurn(world.deps, input, controller.signal);

		expect(world.harness.createCalls).toHaveLength(1);
		expect(world.harness.streamCalls[0]?.input).toMatchObject({
			kind: "prompt",
			prompt: "The user denied the generate_image call. Continue.",
		});
	});

	it("answers the card as plain text when the suspended session is lost", async () => {
		const world = makeWorld();
		world.sessions.row = pausedSessionRow([PENDING_QUESTION]);
		world.turns.row = fakeTurnRow({
			spec: { attachments: [], composer: null, message: "green" },
		});
		world.harness.resumeError = new Error("policy conflict");
		const { controller, input } = makeInput();

		await runBuilderTurn(world.deps, input, controller.signal);

		expect(world.harness.createCalls).toHaveLength(1);
		expect(world.harness.streamCalls[0]?.input).toEqual({
			kind: "prompt",
			prompt: 'Answer to your question "Which color?": green',
			signal: expect.any(AbortSignal),
		});
	});

	it("saves the suspended state when the settle tail fails", async () => {
		const world = makeWorld();
		world.harness.events = happyEvents();
		world.harness.unfinishedTurn = true;
		world.harness.pendingOnSuspend = [PENDING_QUESTION];
		world.deps.insertAssistantMessage = async () => {
			throw new Error("insert failed");
		};
		await world.lock.acquire(PROJECT_ID, TURN_ID, TURN_LOCK_TTL_MS);
		const { controller, input } = makeInput();

		await runBuilderTurn(world.deps, input, controller.signal);

		expect(world.turns.failCalls).toHaveLength(1);
		expect(world.harness.suspendCalls).toEqual(["fake-session-1"]);
		expect(world.harness.detachCalls).toHaveLength(0);
		expect(world.sessions.saved).toHaveLength(1);
		expect(world.sessions.saved[0]?.input.resumeState.pending).toEqual([
			PENDING_QUESTION,
		]);
		expect(await world.lock.holder(PROJECT_ID)).toBeNull();
	});
});
