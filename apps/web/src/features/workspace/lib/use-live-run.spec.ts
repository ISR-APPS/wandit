import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const transports = vi.hoisted(() => ({
	error: undefined as unknown,
	errorsByRunId: {} as Record<string, unknown>,
	polledRun: undefined as unknown,
	streamedRun: undefined as unknown,
}));

vi.mock("@trigger.dev/react-hooks", () => ({
	useRealtimeRun: (_runId: string | undefined, options: { id?: string }) => ({
		error: options.id ? transports.errorsByRunId[options.id] : transports.error,
		run: transports.streamedRun,
	}),
	// Mirrors the real hook's sharp edges: a token-less call survives ONLY
	// when it is explicitly disabled — otherwise useApiClient throws in
	// render — and a null SWR key never fetches, so the null-key gate is the
	// mechanism that actually stops the poll.
	useRun: (
		runId: string | null,
		options?: { accessToken?: string; enabled?: boolean },
	) => {
		if (!options?.accessToken) {
			if (options?.enabled === false) {
				return { run: undefined };
			}

			throw new Error(
				"Missing accessToken in TriggerAuthContext or useApiClient options",
			);
		}

		return { run: runId === null ? undefined : transports.polledRun };
	},
}));

import { pickFresher, useLiveRun } from "./use-live-run";

const handle = {
	publicAccessToken: "public-token",
	runId: "run-1",
};

type LiveRunOptions = Parameters<typeof useLiveRun>[0];
type LiveRunResult = ReturnType<typeof useLiveRun>;

const mountedRoots = new Set<Root>();

function installMinimalDom() {
	const document = {
		nodeType: 9,
		activeElement: null,
		addEventListener() {},
		removeEventListener() {},
	} as Record<string, unknown>;
	const window = {
		document,
		HTMLIFrameElement: class {},
	};
	document.defaultView = window;
	vi.stubGlobal("document", document);
	vi.stubGlobal("window", window);
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

	return {
		nodeType: 1,
		tagName: "DIV",
		nodeName: "DIV",
		ownerDocument: document,
		firstChild: null,
		textContent: "",
		addEventListener() {},
		removeEventListener() {},
		appendChild() {},
		removeChild() {},
		insertBefore() {},
	};
}

async function renderLiveRunHook(initialOptions: LiveRunOptions) {
	let options = initialOptions;
	let current: LiveRunResult | undefined;
	const root = createRoot(installMinimalDom() as unknown as Element);
	mountedRoots.add(root);

	function Harness() {
		current = useLiveRun(options);
		return null;
	}

	await act(async () => {
		root.render(createElement(Harness));
	});

	return {
		get result() {
			if (!current) throw new Error("Hook did not render");
			return current;
		},
		async rerender(nextOptions: LiveRunOptions) {
			options = nextOptions;
			await act(async () => {
				root.render(createElement(Harness));
			});
		},
	};
}

beforeEach(() => {
	transports.error = undefined;
	transports.errorsByRunId = {};
	transports.polledRun = undefined;
	transports.streamedRun = undefined;
});

afterEach(async () => {
	await act(async () => {
		for (const root of mountedRoots) root.unmount();
	});
	mountedRoots.clear();
	vi.unstubAllGlobals();
});

describe("pickFresher", () => {
	it("prefers a terminal row even when a nonterminal row has a later timestamp", () => {
		const completed = {
			id: "run-1",
			status: "COMPLETED",
			updatedAt: "2026-08-01T10:00:00.000Z",
		};
		const executing = {
			id: "run-1",
			status: "EXECUTING",
			updatedAt: "2026-08-01T10:00:01.000Z",
		};

		expect(pickFresher(executing, completed)).toBe(completed);
		expect(pickFresher(completed, executing)).toBe(completed);
	});

	it("uses timestamps for equal lifecycle states and favors the first row on ties", () => {
		const first = {
			id: "run-1",
			status: "EXECUTING",
			updatedAt: "2026-08-01T10:00:00.000Z",
		};
		const tied = { ...first };
		const newer = {
			id: "run-1",
			status: "EXECUTING",
			updatedAt: "2026-08-01T10:00:01.000Z",
		};

		expect(pickFresher(first, tied)).toBe(first);
		expect(pickFresher(first, newer)).toBe(newer);
	});
});

describe("useLiveRun", () => {
	it("renders disabled without a handle instead of throwing (crashed-retry regression)", async () => {
		const view = await renderLiveRunHook({
			enabled: true,
			handle: undefined,
		});

		expect(view.result.status).toBeUndefined();
		expect(view.result.settled).toBe(false);
		expect(view.result.failed).toBe(false);
	});

	it("keeps a polled terminal snapshot after teardown reveals a stale fixing stream", async () => {
		const onSettled = vi.fn();
		transports.streamedRun = {
			id: "run-1",
			metadata: { progress: { phase: "fixing" } },
			status: "EXECUTING",
			updatedAt: "2026-08-01T10:00:00.000Z",
		};
		transports.polledRun = {
			id: "run-1",
			metadata: { progress: { phase: "finishing" } },
			status: "COMPLETED",
			updatedAt: "2026-08-01T10:00:01.000Z",
		};

		const live = await renderLiveRunHook({ enabled: true, handle, onSettled });

		expect(live.result.settled).toBe(true);
		expect(live.result.status).toBe("COMPLETED");
		expect(live.result.metadata?.progress).toEqual({ phase: "finishing" });
		expect(onSettled).toHaveBeenCalledTimes(1);

		// Simulate disabling/removing the poll key while Trigger's disabled
		// Realtime hook still returns its cached EXECUTING snapshot.
		transports.polledRun = undefined;
		await live.rerender({ enabled: false, handle, onSettled });

		expect(live.result.settled).toBe(true);
		expect(live.result.status).toBe("COMPLETED");
		expect(live.result.metadata?.progress).toEqual({ phase: "finishing" });
		expect(onSettled).toHaveBeenCalledTimes(1);
	});

	it("fires onSettled once for each runId when a hook instance is reused", async () => {
		const onSettled = vi.fn();
		const staleError = new Error("run-1 stream failed");
		transports.error = staleError;
		transports.errorsByRunId = { "run-1": staleError };
		transports.polledRun = {
			id: "run-1",
			status: "COMPLETED",
			updatedAt: "2026-08-01T10:00:00.000Z",
		};

		const live = await renderLiveRunHook({ enabled: true, handle, onSettled });
		await live.rerender({ enabled: true, handle, onSettled });
		expect(onSettled).toHaveBeenCalledTimes(1);

		const nextHandle = { ...handle, runId: "run-2" };
		await live.rerender({ enabled: true, handle: nextHandle, onSettled });
		expect(live.result.settled).toBe(false);
		expect(live.result.status).toBeUndefined();
		expect(live.result.failed).toBe(false);
		expect(onSettled).toHaveBeenCalledTimes(1);

		transports.polledRun = {
			id: "run-2",
			status: "COMPLETED",
			updatedAt: "2026-08-01T10:01:00.000Z",
		};
		await live.rerender({ enabled: true, handle: nextHandle, onSettled });
		await live.rerender({ enabled: true, handle: nextHandle, onSettled });

		expect(onSettled).toHaveBeenCalledTimes(2);
	});
});
