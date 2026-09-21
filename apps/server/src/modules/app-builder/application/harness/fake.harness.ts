/**
 * In-memory `BuilderHarness` for specs.
 * `builder-turn.runtime.spec.ts` scripts the event list `stream`
 * replays; `detach`/`suspendTurn` record their calls and answer fixed
 * resume states.
 */
import type { HarnessPendingInteraction } from "@wandit/contracts";

import type {
	BuilderHarness,
	HarnessKind,
	HarnessResumeState,
	HarnessSession,
	HarnessSessionInput,
	HarnessStreamEvent,
	HarnessTurnInput,
} from "../../domain/ports/builder-harness";

/** One recorded `stream` call. */
export type FakeHarnessStreamCall = {
	sessionId: string;
	input: HarnessTurnInput;
};

/**
 * `BuilderHarness` fake. `kind` is mutable so a spec can run the resume
 * path under a different harness name.
 */
export class FakeBuilderHarness implements BuilderHarness {
	kind: HarnessKind = "claude_code";

	/** Events each `stream` call replays, in order. */
	events: HarnessStreamEvent[] = [];

	/** `sessionId`s passed to `detach`, in call order. */
	readonly detachCalls: string[] = [];

	/** Inputs of `createSession`, in call order. */
	readonly createCalls: HarnessSessionInput[] = [];

	/** Inputs of `resumeSession`, in call order. */
	readonly resumeCalls: {
		input: HarnessSessionInput;
		resumeState: HarnessResumeState;
	}[] = [];

	/** Recorded `stream` calls; `input` keeps the full prompt/continue payload. */
	readonly streamCalls: FakeHarnessStreamCall[] = [];

	/** `sessionId`s passed to `suspendTurn`, in call order. */
	readonly suspendCalls: string[] = [];

	/** The resume state `detach` returns. */
	resumeState: HarnessResumeState = {
		harness: "claude_code",
		payload: "{}",
		pending: [],
	};

	/** What `hasUnfinishedTurn` answers. */
	unfinishedTurn = false;

	/**
	 * When true, only the session `resumeSession` returned answers true to
	 * `hasUnfinishedTurn`: a stored turn the runtime cannot continue.
	 */
	unfinishedOnResume = false;

	private resumedSessionId: string | null = null;

	/** The `pending` list `suspendTurn` puts into its resume state. */
	pendingOnSuspend: HarnessPendingInteraction[] = [];

	/** Error `stream` throws before yielding; null replays `events`. */
	streamError: Error | null = null;

	/**
	 * When set, `stream` waits on it after the scripted events. Timer and
	 * cancel specs hold the stream open, advance the clock, then release.
	 */
	streamHold: Promise<void> | null = null;

	private counter = 0;

	async createSession(input: HarnessSessionInput): Promise<HarnessSession> {
		this.createCalls.push(input);
		this.counter += 1;
		return { sessionId: `fake-session-${this.counter}` };
	}

	/** Error `resumeSession` throws; null resumes normally. */
	resumeError: Error | null = null;

	async resumeSession(
		input: HarnessSessionInput,
		resumeState: HarnessResumeState,
	): Promise<HarnessSession> {
		this.resumeCalls.push({ input, resumeState });
		if (this.resumeError) {
			throw this.resumeError;
		}
		this.counter += 1;
		this.resumedSessionId = `fake-session-${this.counter}`;
		return { sessionId: this.resumedSessionId };
	}

	async *stream(
		session: HarnessSession,
		input: HarnessTurnInput,
	): AsyncIterable<HarnessStreamEvent> {
		this.streamCalls.push({ input, sessionId: session.sessionId });
		if (this.streamError !== null) {
			throw this.streamError;
		}
		for (const event of this.events) {
			if (input.signal.aborted) {
				throw new Error("Stream aborted");
			}
			yield event;
		}
		if (this.streamHold !== null) {
			await this.streamHold;
		}
		if (input.signal.aborted) {
			throw new Error("Stream aborted");
		}
	}

	async hasUnfinishedTurn(session: HarnessSession): Promise<boolean> {
		return (
			this.unfinishedTurn ||
			(this.unfinishedOnResume && session.sessionId === this.resumedSessionId)
		);
	}

	async detach(session: HarnessSession): Promise<HarnessResumeState> {
		this.detachCalls.push(session.sessionId);
		return this.resumeState;
	}

	async suspendTurn(session: HarnessSession): Promise<HarnessResumeState> {
		this.suspendCalls.push(session.sessionId);
		return {
			...this.resumeState,
			pending: this.pendingOnSuspend,
		};
	}
}
