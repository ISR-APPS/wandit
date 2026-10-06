/**
 * HTTP client of the harness host process. `RoutingTurnTaskStarter` calls it
 * in the API, the `builder-turn` task, and the host to start and stop
 * host-run turns. Every call carries the shared secret: the host starts paid
 * turns and holds bridge credentials, so only these callers may reach it.
 */
import {
	type HarnessHostStartTurn,
	harnessHostRoutes,
} from "@wandit/contracts";

// 2 s: the host claims the row and answers at once; a slower answer means a
// sick host, and the turn falls back to Trigger.dev.
const START_TIMEOUT_MS = 2_000;
// 5 s for a cancel; the cancel route waits for the row anyway.
const CANCEL_TIMEOUT_MS = 5_000;

/** The host calls `RoutingTurnTaskStarter` makes; the spec passes a fake. */
export type HarnessHostCalls = Pick<
	HarnessHostClient,
	"cancelTurn" | "startTurn"
>;

/** One client per process; it holds no connection between calls. */
export class HarnessHostClient {
	constructor(
		/** `HARNESS_HOST_URL`, the base URL of the host process. */
		private readonly baseUrl: string,
		/** `HARNESS_HOST_SECRET`; sent as a bearer token. */
		private readonly secret: string,
		private readonly fetchFn: typeof fetch = fetch,
	) {}

	/**
	 * Hands one queued, host-owned row to the host. Answers true when the host
	 * runs the turn, false when the host is full (503). Throws on any other
	 * answer, a timeout, or a network error.
	 */
	async startTurn(input: HarnessHostStartTurn): Promise<boolean> {
		const path = harnessHostRoutes.startTurn(input.turnId);
		const response = await this.post(path, input, START_TIMEOUT_MS);
		// 503: the host is at its live turn cap (`MAX_LIVE_TURNS` in harness-host.server.ts).
		if (response.status === 503) {
			return false;
		}
		assertOk(response, path);
		return true;
	}

	/** Asks the host to stop a turn it runs. Throws on any answer that is not 2xx. */
	async cancelTurn(turnId: string): Promise<void> {
		const path = harnessHostRoutes.cancelTurn(turnId);
		assertOk(await this.post(path, {}, CANCEL_TIMEOUT_MS), path);
	}

	private post(
		path: string,
		body: HarnessHostStartTurn | Record<string, never>,
		timeoutMs: number,
	): Promise<Response> {
		return this.fetchFn(new URL(path, this.baseUrl), {
			body: JSON.stringify(body),
			headers: {
				authorization: `Bearer ${this.secret}`,
				"content-type": "application/json",
			},
			method: "POST",
			signal: AbortSignal.timeout(timeoutMs),
		});
	}
}

function assertOk(response: Response, path: string): void {
	if (!response.ok) {
		throw new Error(`Harness host answered ${response.status} on ${path}`);
	}
}
