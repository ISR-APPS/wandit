/**
 * HTTP surface of the harness host: the routes of `harnessHostRoutes`, which
 * the API calls through `HarnessHostClient`. `main.ts` starts the server.
 * A start runs the turn in this process through `HostTurnRunner`. When the
 * host is full, the start answers 503. A cancel aborts that run.
 */
import { timingSafeEqual } from "node:crypto";
import {
	createServer,
	type IncomingMessage,
	type Server,
	type ServerResponse,
} from "node:http";
import {
	type HarnessHostStartTurn,
	harnessHostRoutes,
	harnessHostStartTurnSchema,
} from "@wandit/contracts";

import type { BuilderTurnLogger } from "../trigger/builder-turn.runtime";

// 16 KB: the start body holds five short fields.
const MAX_BODY_BYTES = 16 * 1024;

/**
 * The maximum number of turns that this process runs at the same time. Over
 * it, the start route answers 503 and the API runs the turn on Trigger.dev
 * (`RoutingTurnTaskStarter`). The next turn of a live project skips the cap.
 */
// LIMIT: 20 live turns on one Node thread, not load-tested. Upgrade: a second host replica with an instance id on the row.
export const MAX_LIVE_TURNS = 20;

/** The turns of this host; `HostTurnRunner` in production, a fake in the spec. */
export type HostTurns = {
	/**
	 * Starts the turn in the background. Answers true when this host runs it
	 * (a live turn too), false when the host is full and refuses it.
	 */
	start(input: HarnessHostStartTurn): boolean;
	/** Aborts a turn this host runs. An unknown id does nothing. */
	cancel(turnId: string): void;
};

/**
 * Runs each started turn in this process and keeps the live ones: the
 * cancel route aborts them, and the recovery skips them.
 */
export class HostTurnRunner implements HostTurns {
	/** Key: the turn id. `projectId` lets the cap accept the next turn of a live project. */
	private readonly live = new Map<
		string,
		{ abortController: AbortController; projectId: string }
	>();

	constructor(
		/** One whole turn: `runBuilderTurn` with the host deps (see `main.ts`). */
		private readonly run: (
			input: HarnessHostStartTurn,
			signal: AbortSignal,
		) => Promise<void>,
		private readonly logger: BuilderTurnLogger,
	) {}

	start(input: HarnessHostStartTurn): boolean {
		// The API may retry a start; the row claim inside the run also dedupes.
		if (this.live.has(input.turnId)) {
			return true;
		}
		// The project lock allows one turn per project. A live turn of the same
		// project is ending and frees its slot, so the cap skips its promoted turn.
		const isProjectLive = [...this.live.values()].some(
			(turn) => turn.projectId === input.projectId,
		);
		// A full host refuses the turn. The cap keeps the heap and the event
		// loop of this one process safe.
		if (this.live.size >= MAX_LIVE_TURNS && !isProjectLive) {
			this.logger.warn("harness-host.turn-refused-full", {
				liveTurns: this.live.size,
				turnId: input.turnId,
			});
			return false;
		}
		const abortController = new AbortController();
		this.live.set(input.turnId, {
			abortController,
			projectId: input.projectId,
		});
		void this.run(input, abortController.signal)
			.catch((error: unknown) => {
				// `runBuilderTurn` handles its own failures; this is a bug path.
				// The recovery timer ends the row once the turn leaves `live`
				// and its run mark expires (`main.ts`).
				this.logger.error("harness-host.turn-crashed", {
					message: error instanceof Error ? error.message : String(error),
					turnId: input.turnId,
				});
			})
			.finally(() => {
				this.live.delete(input.turnId);
			});
		return true;
	}

	cancel(turnId: string): void {
		this.live.get(turnId)?.abortController.abort();
	}

	/** Ids of the turns that run in this process now. */
	liveTurnIds(): ReadonlySet<string> {
		return new Set(this.live.keys());
	}
}

/**
 * The host server. Every route except the health check needs
 * `Authorization: Bearer <HARNESS_HOST_SECRET>`.
 */
export function createHarnessHostServer(
	secret: string,
	turns: HostTurns,
	logger: BuilderTurnLogger,
): Server {
	return createServer((request, response) => {
		handle(request, response).catch((error: unknown) => {
			logger.error("harness-host.request-failed", {
				message: error instanceof Error ? error.message : String(error),
				url: request.url,
			});
			if (!response.headersSent) {
				send(response, 500);
			}
		});
	});

	async function handle(
		request: IncomingMessage,
		response: ServerResponse,
	): Promise<void> {
		const path = new URL(request.url ?? "/", "http://host").pathname;
		if (request.method === "GET" && path === harnessHostRoutes.health) {
			send(response, 204);
			return;
		}
		// Security: the host starts paid turns and holds the bridge credentials,
		// so only the holder of the shared secret (the API) may call it.
		if (!isAuthorized(request.headers.authorization, secret)) {
			send(response, 401);
			return;
		}
		// `/turns/<turnId>/<action>`; the contract builds the same path below.
		const turnId = path.split("/")[2] ?? "";
		if (request.method !== "POST") {
			send(response, 404);
			return;
		}
		if (path === harnessHostRoutes.cancelTurn(turnId)) {
			turns.cancel(turnId);
			send(response, 202);
			return;
		}
		if (path !== harnessHostRoutes.startTurn(turnId)) {
			send(response, 404);
			return;
		}
		const body = await readJsonBody(request);
		if (body.kind === "too_large") {
			send(response, 413);
			return;
		}
		const parsed = harnessHostStartTurnSchema.safeParse(body.value);
		if (!parsed.success || parsed.data.turnId !== turnId) {
			send(response, 400);
			return;
		}
		// 503 tells the API that the host is full. The API then runs the turn on Trigger.dev.
		send(response, turns.start(parsed.data) ? 202 : 503);
	}
}

/** Constant-time check of the bearer secret. */
function isAuthorized(header: string | undefined, secret: string): boolean {
	const given = Buffer.from(header ?? "");
	const expected = Buffer.from(`Bearer ${secret}`);
	return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * The request body as parsed JSON: the raw value before the zod parse.
 * A body that is not JSON gives undefined, so the schema refuses it.
 */
async function readJsonBody(
	request: IncomingMessage,
): Promise<{ kind: "json"; value: unknown } | { kind: "too_large" }> {
	const chunks: Buffer[] = [];
	let size = 0;
	for await (const chunk of request) {
		// SAFETY: a Node request stream without `setEncoding` yields Buffers.
		const buffer = chunk as Buffer;
		size += buffer.length;
		if (size > MAX_BODY_BYTES) {
			return { kind: "too_large" };
		}
		chunks.push(buffer);
	}
	try {
		return {
			kind: "json",
			value: JSON.parse(Buffer.concat(chunks).toString()),
		};
	} catch {
		// Not JSON: the same answer as a wrong shape, a 400 after the parse.
		return { kind: "json", value: undefined };
	}
}

function send(response: ServerResponse, status: number): void {
	response.writeHead(status).end();
}
