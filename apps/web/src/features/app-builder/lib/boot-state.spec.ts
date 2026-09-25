import type { CloudBackendResponse } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import {
	type BootMemory,
	type BootScene,
	type BootSignals,
	type BootView,
	bootViewOf,
	formatElapsed,
	INITIAL_BOOT_MEMORY,
	rememberBoot,
	sceneOf,
} from "./boot-state";

const IDLE: BootSignals = {
	tokenStatus: "waking",
	isTurnRunning: false,
	turnPhase: null,
	lastTurnFailed: false,
	isFirstTurn: true,
	backend: undefined,
	hasCodeChanges: true,
};

const FIRST_TURN_BOOTING: BootSignals = {
	...IDLE,
	isTurnRunning: true,
	turnPhase: "sandbox_waking",
};

/** Runs rememberBoot over each signal set in order, like renders, and maps the last one. */
function viewAfter(...renders: BootSignals[]): {
	view: BootView;
	memory: BootMemory;
} {
	let memory = INITIAL_BOOT_MEMORY;
	let last = IDLE;
	for (const signals of renders) {
		memory = rememberBoot(memory, signals);
		last = signals;
	}
	return { view: bootViewOf(last, memory), memory };
}

/** The steps of a booting view, as `id:state:label` lines. Fails on another variant. */
function stepsOf(view: BootView): string[] {
	if (view.variant !== "booting") throw new Error(`variant ${view.variant}`);
	return view.steps.map((step) => `${step.id}:${step.state}:${step.label}`);
}

function backend(
	status: CloudBackendResponse["status"],
	ref: string | null = null,
): CloudBackendResponse {
	return { status, ref, region: null, failureCode: null };
}

describe("bootViewOf", () => {
	it("shows the loading variant while the first mint runs", () => {
		expect(viewAfter({ ...IDLE, tokenStatus: "loading" }).view).toEqual({
			variant: "loading",
		});
	});

	it("shows asleep when no sandbox runs and no turn runs", () => {
		expect(viewAfter(IDLE).view).toEqual({ variant: "asleep", stopped: false });
	});

	it("says the app did not start when a turn failed on screen", () => {
		const failed = { ...IDLE, lastTurnFailed: true };
		expect(viewAfter(FIRST_TURN_BOOTING, failed).view).toEqual({
			variant: "asleep",
			stopped: true,
		});
	});

	it("keeps the calm asleep note for a failed reply from an earlier visit", () => {
		expect(viewAfter({ ...IDLE, lastTurnFailed: true }).view).toEqual({
			variant: "asleep",
			stopped: false,
		});
	});

	it("shows the create steps on the first turn", () => {
		const { view } = viewAfter(FIRST_TURN_BOOTING);
		expect(view.variant === "booting" && view.scene).toBe("create");
		expect(stepsOf(view)).toEqual([
			"machine:active:appBuilder.preview.boot.machine.starting",
			"preview:pending:appBuilder.preview.boot.preview.label",
		]);
		expect(view.variant === "booting" && view.steps[0]?.details).toEqual([
			"appBuilder.preview.boot.machine.copying",
			"appBuilder.preview.boot.machine.installing",
			"appBuilder.preview.boot.machine.firstTime",
		]);
	});

	it("shows the resume steps on a later turn", () => {
		const { view } = viewAfter({ ...FIRST_TURN_BOOTING, isFirstTurn: false });
		expect(view.variant === "booting" && view.scene).toBe("wake");
		expect(stepsOf(view)[0]).toBe(
			"machine:active:appBuilder.preview.boot.machine.waking",
		);
		expect(view.variant === "booting" && view.steps[0]?.details).toEqual([
			"appBuilder.preview.boot.machine.restoring",
		]);
	});

	it("keeps the mark while the history loads, then shows the right machine copy", () => {
		const loading = { ...FIRST_TURN_BOOTING, isFirstTurn: null };
		expect(viewAfter(loading).view).toEqual({ variant: "loading" });
		expect(stepsOf(viewAfter(loading, FIRST_TURN_BOOTING).view)[0]).toBe(
			"machine:active:appBuilder.preview.boot.machine.starting",
		);
	});

	it("marks the machine ready when the token is ready before any phase", () => {
		const { view } = viewAfter({
			...IDLE,
			tokenStatus: "ready",
			isTurnRunning: true,
		});
		expect(view.variant === "booting" && view.scene).toBe("open");
		expect(stepsOf(view)).toEqual([
			"machine:done:appBuilder.preview.boot.machine.done",
			"preview:active:appBuilder.preview.boot.preview.label",
		]);
		expect(view.variant === "booting" && view.steps[1]?.details).toEqual([
			"appBuilder.preview.boot.preview.loading",
		]);
	});

	it("waits for the app server when the session starts but the token still says waking", () => {
		const { view } = viewAfter({
			...FIRST_TURN_BOOTING,
			turnPhase: "session_starting",
		});
		expect(stepsOf(view)[0]).toBe(
			"machine:done:appBuilder.preview.boot.machine.done",
		);
		expect(view.variant === "booting" && view.steps[1]?.details).toEqual([
			"appBuilder.preview.boot.preview.waiting",
		]);
	});

	it("never moves the machine step back when the proxy reports not-running", () => {
		const ready = { ...FIRST_TURN_BOOTING, tokenStatus: "ready" as const };
		const { view } = viewAfter(FIRST_TURN_BOOTING, ready, FIRST_TURN_BOOTING);
		expect(stepsOf(view)[0]).toBe(
			"machine:done:appBuilder.preview.boot.machine.done",
		);
	});

	it("stays asleep when the token flips back to ready without a turn", () => {
		const { view } = viewAfter(IDLE, { ...IDLE, tokenStatus: "ready" });
		expect(view).toEqual({ variant: "asleep", stopped: false });
	});

	it("shows the waiting note for a template-only project while no turn runs", () => {
		const templateOnly = { ...IDLE, hasCodeChanges: false };
		expect(viewAfter(templateOnly).view).toEqual({ variant: "waiting" });
		// The note does not wait for the token or the history.
		expect(
			viewAfter({ ...templateOnly, tokenStatus: "loading", isFirstTurn: null })
				.view,
		).toEqual({ variant: "waiting" });
	});

	it("ends a template-only turn on the build step, not on the preview step", () => {
		const templateOnly = { ...FIRST_TURN_BOOTING, hasCodeChanges: false };
		expect(stepsOf(viewAfter(templateOnly).view)).toEqual([
			"machine:active:appBuilder.preview.boot.machine.starting",
			"build:pending:appBuilder.preview.boot.build.label",
		]);

		const { view } = viewAfter({ ...templateOnly, tokenStatus: "ready" });
		expect(stepsOf(view)).toEqual([
			"machine:done:appBuilder.preview.boot.machine.done",
			"build:active:appBuilder.preview.boot.build.label",
		]);
		expect(view.variant === "booting" && view.steps[1]?.details).toEqual([
			"appBuilder.preview.boot.build.detail",
		]);
	});

	it("ends asleep when a turn starts, with the machine step active again", () => {
		const ready = { ...FIRST_TURN_BOOTING, tokenStatus: "ready" as const };
		const { view, memory } = viewAfter(ready, IDLE, FIRST_TURN_BOOTING);
		expect(memory.asleep).toBe(false);
		expect(stepsOf(view)[0]).toBe(
			"machine:active:appBuilder.preview.boot.machine.starting",
		);
	});
});

describe("bootViewOf database row", () => {
	const cases: [CloudBackendResponse | undefined, string | null][] = [
		[
			backend("creating"),
			"database:active:appBuilder.preview.boot.database.creating",
		],
		[
			backend("creating", "abcdefghijklmnopqrst"),
			"database:active:appBuilder.preview.boot.database.starting",
		],
		[backend("active"), "database:done:appBuilder.preview.boot.database.done"],
		[
			backend("error"),
			"database:failed:appBuilder.preview.boot.database.failed",
		],
		[backend("none"), null],
		[backend("paused"), null],
		[backend("restoring", "abcdefghijklmnopqrst"), null],
		[backend("deleting"), null],
		[undefined, null],
	];

	it.each(cases)("maps %o to the row %s", (answer, row) => {
		const { view } = viewAfter({ ...FIRST_TURN_BOOTING, backend: answer });
		expect(stepsOf(view)[2] ?? null).toBe(row);
	});
});

describe("rememberBoot", () => {
	it("returns the same object when no fact changed", () => {
		const memory = rememberBoot(INITIAL_BOOT_MEMORY, FIRST_TURN_BOOTING);
		expect(rememberBoot(memory, FIRST_TURN_BOOTING)).toBe(memory);
	});
});

describe("sceneOf", () => {
	const cases: [BootView, BootScene][] = [
		[{ variant: "loading" }, "loading"],
		[{ variant: "asleep", stopped: false }, "asleep"],
		[{ variant: "asleep", stopped: true }, "stopped"],
		[{ variant: "waiting" }, "asleep"],
		[{ variant: "booting", scene: "create", steps: [] }, "create"],
		[{ variant: "booting", scene: "wake", steps: [] }, "wake"],
		[{ variant: "booting", scene: "open", steps: [] }, "open"],
	];

	it.each(cases)("maps %o to the scene %s", (view, scene) => {
		expect(sceneOf(view)).toBe(scene);
	});
});

describe("formatElapsed", () => {
	it.each([
		[0, "0:00"],
		[75_400, "1:15"],
		[-5, "0:00"],
		[3_600_000, "60:00"],
	])("formats %i ms as %s", (elapsedMs, text) => {
		expect(formatElapsed(elapsedMs)).toBe(text);
	});
});
