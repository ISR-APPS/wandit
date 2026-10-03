import type { AddressInfo } from "node:net";
import type { HarnessHostStartTurn } from "@wandit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	createHarnessHostServer,
	HostTurnRunner,
	type HostTurns,
} from "./harness-host.server";

const SECRET = "s".repeat(32);
const TURN_ID = "22222222-2222-4222-8222-222222222222";
const BODY: HarnessHostStartTurn = {
	actorUserId: "user-1",
	apiCreateMs: 40,
	organizationId: null,
	projectId: "11111111-1111-4111-8111-111111111111",
	turnId: TURN_ID,
};
const logger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };

let close: (() => void) | null = null;
afterEach(() => {
	close?.();
	close = null;
});

/** Starts the server on a free port; answers its base URL and the fake turns. */
async function startServer() {
	const turns = {
		cancel: vi.fn((_turnId: string) => undefined),
		start: vi.fn((_input: HarnessHostStartTurn) => undefined),
	} satisfies HostTurns;
	const server = createHarnessHostServer(SECRET, turns, logger);
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	close = () => server.close();
	// SAFETY: a server that listens on a TCP port answers an AddressInfo.
	const { port } = server.address() as AddressInfo;
	return { base: `http://127.0.0.1:${port}`, turns };
}

function post(url: string, body: string, secret = SECRET) {
	return fetch(url, {
		body,
		headers: { authorization: `Bearer ${secret}` },
		method: "POST",
	});
}

describe("createHarnessHostServer", () => {
	it("starts a valid turn and answers 202", async () => {
		const { base, turns } = await startServer();

		const response = await post(
			`${base}/turns/${TURN_ID}/start`,
			JSON.stringify(BODY),
		);

		expect(response.status).toBe(202);
		expect(turns.start).toHaveBeenCalledWith(BODY);
	});

	it("refuses a call without the secret", async () => {
		const { base, turns } = await startServer();

		const response = await post(
			`${base}/turns/${TURN_ID}/start`,
			JSON.stringify(BODY),
			"x".repeat(32),
		);

		expect(response.status).toBe(401);
		expect(turns.start).not.toHaveBeenCalled();
	});

	it("refuses a body that does not parse or names another turn", async () => {
		const { base, turns } = await startServer();

		const broken = await post(`${base}/turns/${TURN_ID}/start`, "{");
		const otherTurn = await post(
			`${base}/turns/33333333-3333-4333-8333-333333333333/start`,
			JSON.stringify(BODY),
		);

		expect(broken.status).toBe(400);
		expect(otherTurn.status).toBe(400);
		expect(turns.start).not.toHaveBeenCalled();
	});

	it("cancels a turn and answers 202", async () => {
		const { base, turns } = await startServer();

		const response = await post(`${base}/turns/${TURN_ID}/cancel`, "");

		expect(response.status).toBe(202);
		expect(turns.cancel).toHaveBeenCalledWith(TURN_ID);
	});

	it("answers the health check without the secret", async () => {
		const { base } = await startServer();

		const response = await fetch(`${base}/health`);

		expect(response.status).toBe(204);
	});
});

describe("HostTurnRunner", () => {
	it("runs a turn once, aborts it on cancel, and forgets it at the end", async () => {
		let finish = () => {};
		const signals: AbortSignal[] = [];
		const run = vi.fn(
			(_input: HarnessHostStartTurn, signal: AbortSignal) =>
				new Promise<void>((resolve) => {
					signals.push(signal);
					finish = resolve;
				}),
		);
		const runner = new HostTurnRunner(run, logger);

		runner.start(BODY);
		runner.start(BODY);
		runner.cancel(TURN_ID);

		expect(run).toHaveBeenCalledTimes(1);
		expect(signals[0]?.aborted).toBe(true);
		expect(runner.liveTurnIds().has(TURN_ID)).toBe(true);
		finish();
		await vi.waitFor(() => expect(runner.liveTurnIds().size).toBe(0));
	});
});
