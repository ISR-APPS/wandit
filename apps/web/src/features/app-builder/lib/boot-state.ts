/**
 * Pure state of the preview boot screen. The preview token, chat, project,
 * and Cloud signals go in; the screen content comes out. PreviewBootScreen
 * calls rememberBoot and bootViewOf on every render. This file calls no
 * API and holds no React state.
 */

import type { CloudBackendResponse, TurnStreamPhase } from "@wandit/contracts";

import type { TranslationKey } from "@/lib/i18n";

/** Chat and Cloud signals of the boot screen. app-builder-page.tsx builds them; the previews pass them through. */
export type BootContext = {
	/** True while a builder turn that the API accepted streams, or a resumed turn replays. From `thread.isTurnRunning`. */
	isTurnRunning: boolean;
	/** Last `data-turn-status` phase of the running turn. Null before its first status part and while no turn runs. */
	turnPhase: TurnStreamPhase | null;
	/** True when the last assistant reply holds an error card. */
	lastTurnFailed: boolean;
	/** True while the chat holds at most one user message. The first turn creates the sandbox; later turns resume it. Null while the history loads. */
	isFirstTurn: boolean | null;
	/** Answer of `GET cloud/backend`. Undefined while it loads, after it failed, and without the `project:update` right. */
	backend: CloudBackendResponse | undefined;
	/** False while the project holds only the template. From `project.hasCodeChanges`, refetched at each turn end. */
	hasCodeChanges: boolean;
};

/** Everything the mapping reads. PreviewPanel shows its own alert for the token status `error`. */
export type BootSignals = BootContext & {
	/** Status of `usePreviewToken`, without `error`. */
	tokenStatus: "loading" | "waking" | "ready";
};

/** Facts the screen keeps between renders. They reset when the boot screen unmounts, which happens when the app shows. */
export type BootMemory = {
	/** True from the first `waking` without a turn until a turn starts. A token flip back to `ready` does not end it. */
	asleep: boolean;
	/**
	 * True after the machine answered, until the sandbox sleeps. The machine step then never goes back to active.
	 * A template-only project keeps the screen on, so the value carries into its next turn.
	 */
	machineReady: boolean;
	/** True after a turn ran while this screen was on. Only then can a failed reply explain a stop. */
	turnSeen: boolean;
};

/** Memory of a new boot screen. */
export const INITIAL_BOOT_MEMORY: BootMemory = {
	asleep: false,
	machineReady: false,
	turnSeen: false,
};

/** One row of the step list. */
export type BootStep = {
	/**
	 * `database` runs in parallel with the other two and sits under a divider.
	 * `build` takes the place of `preview` while the project holds only the template.
	 */
	id: "machine" | "preview" | "build" | "database";
	state: "pending" | "active" | "done" | "failed";
	label: TranslationKey;
	/** Lines under the label. The screen shows each line for 3.2 s, then keeps the last one. */
	details: TranslationKey[];
};

/** The picture of the boot screen. BootPlan draws one scene for each value. `stopped` is a failed start, which is not a sleep. */
export type BootScene =
	| "loading"
	| "create"
	| "wake"
	| "open"
	| "asleep"
	| "stopped";

/**
 * What the screen shows. `stopped` is true when a turn failed while the user
 * watched. `waiting` is for a project with only the template and no turn.
 */
export type BootView =
	| { variant: "loading" }
	| { variant: "asleep"; stopped: boolean }
	| { variant: "waiting" }
	| {
			variant: "booting";
			/** `create`: a new app is set up. `wake`: a saved app wakes. `open`: the app page loads, or the first version builds. */
			scene: "create" | "wake" | "open";
			steps: BootStep[];
	  };

// The turn writes these phases after the sandbox runs. `checkpoint` is in the contract, but no code sends it.
const MACHINE_READY_PHASES: readonly TurnStreamPhase[] = [
	"session_starting",
	"running",
	"checkpoint",
	"committing",
];

/**
 * The memory after one more render. It returns the same object when no
 * fact changed, so the caller can compare by reference and skip a state
 * update.
 */
export function rememberBoot(
	memory: BootMemory,
	signals: BootSignals,
): BootMemory {
	// Only a chat message wakes a stopped sandbox, so asleep holds until a turn starts.
	const asleep =
		!signals.isTurnRunning &&
		(memory.asleep || signals.tokenStatus === "waking");
	const machineAnswers =
		signals.tokenStatus === "ready" ||
		(signals.turnPhase !== null &&
			MACHINE_READY_PHASES.includes(signals.turnPhase));
	// The proxy can report not-running for seconds after the first mint. The machine step must not go back.
	const machineReady = !asleep && (memory.machineReady || machineAnswers);
	const turnSeen = memory.turnSeen || signals.isTurnRunning;
	if (
		asleep === memory.asleep &&
		machineReady === memory.machineReady &&
		turnSeen === memory.turnSeen
	) {
		return memory;
	}
	return { asleep, machineReady, turnSeen };
}

/** The screen content for the signals, and for the memory that rememberBoot returned for them. */
export function bootViewOf(signals: BootSignals, memory: BootMemory): BootView {
	// The template is not the user's app. Only a turn can write the first version, so the chat is the next step.
	if (!signals.hasCodeChanges && !signals.isTurnRunning) {
		return { variant: "waiting" };
	}
	if (signals.tokenStatus === "loading") return { variant: "loading" };
	if (memory.asleep) {
		// A failed reply from an earlier visit must not claim that this boot failed.
		return {
			variant: "asleep",
			stopped: memory.turnSeen && signals.lastTurnFailed,
		};
	}
	// The machine labels differ for a first turn. The mark stays until the history tells which turn runs.
	if (!memory.machineReady && signals.isFirstTurn === null) {
		return { variant: "loading" };
	}
	// The first turn creates the sandbox from the template. A later turn resumes the saved one.
	const scene = memory.machineReady
		? "open"
		: signals.isFirstTurn
			? "create"
			: "wake";
	const machine: BootStep =
		scene === "open"
			? {
					id: "machine",
					state: "done",
					label: "appBuilder.preview.boot.machine.done",
					details: [],
				}
			: scene === "create"
				? {
						id: "machine",
						state: "active",
						label: "appBuilder.preview.boot.machine.starting",
						// The first turn waits tens of seconds. The last line says that the wait is normal, and it stays.
						details: [
							"appBuilder.preview.boot.machine.copying",
							"appBuilder.preview.boot.machine.installing",
							"appBuilder.preview.boot.machine.firstTime",
						],
					}
				: {
						id: "machine",
						state: "active",
						label: "appBuilder.preview.boot.machine.waking",
						details: ["appBuilder.preview.boot.machine.restoring"],
					};
	// A template-only project keeps the frame covered for the whole turn, so the build is the last step.
	const lastStep: BootStep = !signals.hasCodeChanges
		? {
				id: "build",
				state: scene === "open" ? "active" : "pending",
				label: "appBuilder.preview.boot.build.label",
				details:
					scene === "open" ? ["appBuilder.preview.boot.build.detail"] : [],
			}
		: scene === "open"
			? {
					id: "preview",
					state: "active",
					label: "appBuilder.preview.boot.preview.label",
					// A ready token means the frame loads now. A waking token means the app server did not answer yet.
					details: [
						signals.tokenStatus === "ready"
							? "appBuilder.preview.boot.preview.loading"
							: "appBuilder.preview.boot.preview.waiting",
					],
				}
			: {
					id: "preview",
					state: "pending",
					label: "appBuilder.preview.boot.preview.label",
					details: [],
				};
	const database = databaseStepOf(signals.backend);
	return {
		variant: "booting",
		scene,
		steps:
			database === null ? [machine, lastStep] : [machine, lastStep, database],
	};
}

/** The scene of a view. A booting view holds its own scene. This function names the scene of the other variants. */
export function sceneOf(view: BootView): BootScene {
	switch (view.variant) {
		case "loading":
			return "loading";
		case "asleep":
			return view.stopped ? "stopped" : "asleep";
		// No app exists yet. The dim picture of the asleep note says "nothing runs now".
		case "waiting":
			return "asleep";
		case "booting":
			return view.scene;
	}
}

/** The database row, or null when the preview has nothing true to say about the database. */
function databaseStepOf(
	backend: CloudBackendResponse | undefined,
): BootStep | null {
	// Unknown: the route still loads, failed, or is forbidden. No row is better than a row that comes and goes.
	if (backend === undefined) return null;
	switch (backend.status) {
		case "creating":
			return {
				id: "database",
				state: "active",
				// The ref exists once Supabase accepted the create call; then the project boots.
				label:
					backend.ref === null
						? "appBuilder.preview.boot.database.creating"
						: "appBuilder.preview.boot.database.starting",
				details: ["appBuilder.preview.boot.database.wait"],
			};
		case "active":
			return {
				id: "database",
				state: "done",
				label: "appBuilder.preview.boot.database.done",
				details: [],
			};
		case "error":
			return {
				id: "database",
				state: "failed",
				label: "appBuilder.preview.boot.database.failed",
				details: ["appBuilder.preview.boot.database.failedDetail"],
			};
		case "none":
		case "paused":
		case "restoring":
		case "deleting":
			// The preview does not use the database in these states. They belong to the Cloud tab.
			return null;
	}
}

/** `m:ss` since the step list showed. The minutes grow past 59. A negative time shows `0:00`. */
export function formatElapsed(elapsedMs: number): string {
	const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
	const seconds = String(totalSeconds % 60).padStart(2, "0");
	return `${Math.floor(totalSeconds / 60)}:${seconds}`;
}
