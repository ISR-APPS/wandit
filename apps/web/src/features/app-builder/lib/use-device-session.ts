/**
 * Runs the Appetize device session of the mobile stage (WANDIT-196).
 * PhonePreview calls it with the picked target; its stage bar and its phone
 * screen render the result. It starts and ends the session through the
 * device-session routes and drives the Appetize JS SDK in the iframe with
 * the id `frameId`. Each device minute costs money: read the rules below.
 */

import {
	appetizeInactivityWarningSchema,
	appetizeQueueEventSchema,
	type DevicePlatform,
	uuidSchema,
} from "@wandit/contracts";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { getApiErrorMessage, isApiClientError } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import {
	endDeviceSession,
	startDeviceSession,
} from "../api/app-builder.services";
import {
	type AppetizeClient,
	type AppetizeSession,
	loadAppetize,
} from "./appetize-sdk";

/** Heartbeat period, ms. Half of the 120 s idle timeout of Appetize. */
const HEARTBEAT_INTERVAL_MS = 60_000;

/** What the device stage shows. */
export type DevicePhase =
	| { kind: "idle" }
	| { kind: "starting" }
	| { kind: "queued"; position: number }
	| {
			kind: "running";
			/** End of the time limit of the session, ms since epoch. The countdown chip reads it. */
			endsAtMs: number;
	  }
	| { kind: "ended" }
	| {
			kind: "error";
			/** One short reason under the error title, from the API or the Appetize failure. */
			message: string;
			/** True after a 402: the month minutes are spent, so the start button stays off. */
			isExhausted: boolean;
			/** True when the stream ran before it failed. The card then says the device stopped, not that it did not start. */
			didStart: boolean;
	  };

const IDLE_PHASE: DevicePhase = { kind: "idle" };

// A reload runs no effect cleanup, so the old page cannot end its row.
// sessionStorage outlives a reload in the same tab, so the next start ends it.
function openSessionKeyOf(projectId: string): string {
	return `wandit:device-session:${projectId}`;
}

/** Keeps the open row id for the next page of this tab, or deletes it with null. */
function rememberOpenSession(
	projectId: string,
	deviceSessionId: string | null,
): void {
	const key = openSessionKeyOf(projectId);
	try {
		if (deviceSessionId === null) {
			window.sessionStorage.removeItem(key);
		} else {
			window.sessionStorage.setItem(key, deviceSessionId);
		}
	} catch (error) {
		// Blocked storage throws. The user lock then frees the device after 17 minutes.
		console.error("Device session storage failed", error);
	}
}

/** Reads and deletes the row id that an earlier page of this tab left open. Null when there is none. */
function takeLeftOpenSession(projectId: string): string | null {
	const key = openSessionKeyOf(projectId);
	try {
		const stored = window.sessionStorage.getItem(key);
		window.sessionStorage.removeItem(key);
		// Other code can write this storage, so the schema decides.
		const parsed = uuidSchema.safeParse(stored);
		return parsed.success ? parsed.data : null;
	} catch (error) {
		console.error("Device session storage failed", error);
		return null;
	}
}

/** Injected services, for the spec seam. Production callers leave them out. */
export type DeviceSessionDeps = {
	startDeviceSession: typeof startDeviceSession;
	endDeviceSession: typeof endDeviceSession;
	loadAppetize: typeof loadAppetize;
};

const defaultDeps: DeviceSessionDeps = {
	startDeviceSession,
	endDeviceSession,
	loadAppetize,
};

/** Return of useDeviceSession. The stage bar and the phone screen of PhonePreview read it. */
export type DeviceSession = {
	phase: DevicePhase;
	/** Seconds before Appetize ends an idle session, from its warning; null without a warning. */
	idleWarningSeconds: number | null;
	/** Id of the iframe that the SDK fills. Each start gets a new id, so the SDK never reuses an ended embed. */
	frameId: string;
	/** Starts one session. Only the start button calls it. */
	start: () => void;
	/** Ends the session, or leaves the queue. */
	stop: () => void;
	/** Restarts the app in Expo Go. */
	restartApp: () => void;
	/** Shakes the device, so Expo Go opens its dev menu. */
	shake: () => void;
};

/**
 * Starts a session only on `start`, never on mount. Ends it on `stop`, on
 * the Appetize end event, on a target switch, and on unmount. Sends one
 * heartbeat per minute while the tab is visible. A start first ends the
 * row that a reload of this tab left open.
 */
export function useDeviceSession(
	projectId: string,
	/** The picked device, or null on the web target. A change ends the old session. */
	platform: DevicePlatform | null,
	deps: DeviceSessionDeps = defaultDeps,
): DeviceSession {
	const { t } = useTranslation();
	// The functions are the deps, not the deps object: an inline literal must not end a session on each render.
	const { startDeviceSession, endDeviceSession, loadAppetize } = deps;
	const baseFrameId = useId();
	const [attempt, setAttempt] = useState(0);
	const [phase, setPhase] = useState<DevicePhase>(IDLE_PHASE);
	const [idleWarningSeconds, setIdleWarningSeconds] = useState<number | null>(
		null,
	);
	// A target switch shows the new target idle at once. The effect below ends the old session.
	const [phasePlatform, setPhasePlatform] = useState(platform);
	if (phasePlatform !== platform) {
		setPhasePlatform(platform);
		setPhase(IDLE_PHASE);
		setIdleWarningSeconds(null);
	}
	const clientRef = useRef<AppetizeClient | null>(null);
	const sessionRef = useRef<AppetizeSession | null>(null);
	// The row of the open session; null before a start and after the end call.
	const deviceSessionIdRef = useRef<string | null>(null);
	// The attempt of the last start. A stop, a target switch, and the unmount
	// bump it, so the late callbacks of an old start change nothing.
	const attemptRef = useRef(0);

	// Tells the API once that the session ended, with the Appetize token when one started.
	const reportEnd = useCallback(() => {
		const deviceSessionId = deviceSessionIdRef.current;
		if (deviceSessionId === null) return;
		deviceSessionIdRef.current = null;
		rememberOpenSession(projectId, null);
		void endDeviceSession(
			projectId,
			deviceSessionId,
			sessionRef.current?.token,
		).catch((error: unknown) => {
			// LIMIT: these cases leave the row open: a lost end call, a closed tab,
			// or a reload before the start answers. A start on another project
			// after a reload also leaves it open. The minutes task bills its own
			// clock, at most 15 minutes, and the user lock expires after 17
			// minutes. Upgrade: a sendBeacon end route.
			console.error("Device session end failed", error);
		});
	}, [endDeviceSession, projectId]);

	const start = useCallback(async () => {
		if (platform === null) return;
		attemptRef.current += 1;
		const startAttempt = attemptRef.current;
		const isStale = () => attemptRef.current !== startAttempt;
		// The "starting" render mounts the iframe of this attempt before the SDK looks for it.
		setAttempt(startAttempt);
		setPhase({ kind: "starting" });
		setIdleWarningSeconds(null);
		sessionRef.current = null;
		// The row of a reloaded page holds the user lock for 17 minutes, and the
		// start would answer 409. Its end frees the lock. A repeated end is a no-op.
		const leftOpenSessionId = takeLeftOpenSession(projectId);
		if (leftOpenSessionId !== null) {
			await endDeviceSession(projectId, leftOpenSessionId, undefined).catch(
				(error: unknown) => {
					// The start still runs. It shows the 409 when the lock stays.
					// The id goes back, so the next Retry ends the row again.
					console.error("Device session end after a reload failed", error);
					rememberOpenSession(projectId, leftOpenSessionId);
				},
			);
			if (isStale()) return;
		}
		try {
			const config = await startDeviceSession(projectId, platform);
			if (isStale()) {
				// The user left before the row came back. End it now, so it bills nothing.
				void endDeviceSession(
					projectId,
					config.deviceSessionId,
					undefined,
				).catch((error: unknown) => {
					console.error("Device session end failed", error);
				});
				return;
			}
			deviceSessionIdRef.current = config.deviceSessionId;
			rememberOpenSession(projectId, config.deviceSessionId);
			const sdk = await loadAppetize();
			// From here on, the stop or the cleanup that made the start stale also ended the row.
			if (isStale()) return;
			const client = await sdk.getClient(
				`#${CSS.escape(`${baseFrameId}-${startAttempt}`)}`,
				{
					buildId: config.publicKey,
					codec: "h264",
					device: config.device,
					launchUrl: config.launchUrl,
					osVersion: config.osVersion,
					params: config.params,
					scale: "auto",
					screenOnly: true,
				},
			);
			if (isStale()) {
				void client.endSession().catch((error: unknown) => {
					console.error("Appetize end failed", error);
				});
				return;
			}
			clientRef.current = client;
			client.on("queue", (data) => {
				if (isStale()) return;
				const queue = appetizeQueueEventSchema.safeParse(data);
				if (queue.success) {
					setPhase({ kind: "queued", position: queue.data.position });
				}
			});
			client.on("session", (session) => {
				if (isStale()) return;
				sessionRef.current = session;
				setPhase({
					kind: "running",
					endsAtMs: Date.now() + config.timeLimitSeconds * 1000,
				});
				session.on("inactivityWarning", (data) => {
					if (isStale()) return;
					const warning = appetizeInactivityWarningSchema.safeParse(data);
					if (warning.success) {
						setIdleWarningSeconds(warning.data.secondsRemaining);
					}
				});
			});
			client.on("sessionEnded", () => {
				if (isStale()) return;
				reportEnd();
				setPhase({ kind: "ended" });
			});
			const onFailure = (error: unknown) => {
				if (isStale()) return;
				// No stack trace reaches the user; the console keeps it.
				console.error("Appetize session failed", error);
				reportEnd();
				setPhase({
					kind: "error",
					// A short reason only: the card already shows the title and the retry button.
					message: t("appBuilder.devicePreview.streamFailed"),
					isExhausted: false,
					// The "session" event set the ref, so a stream ran before this failure.
					didStart: sessionRef.current !== null,
				});
			};
			client.on("sessionError", onFailure);
			client.on("error", onFailure);
			await client.startSession();
		} catch (error) {
			// A stale start already lost its row to the stop or the cleanup, so the user sees nothing.
			if (isStale()) {
				console.error(
					"Device session start failed after the stage left it",
					error,
				);
				return;
			}
			reportEnd();
			setPhase({
				kind: "error",
				// The phone link needs a running sandbox, like the preview frame.
				message:
					isApiClientError(error) && error.code === "SANDBOX_NOT_RUNNING"
						? t("appBuilder.devicePreview.notRunning")
						: getApiErrorMessage(error),
				isExhausted:
					isApiClientError(error) && error.code === "DEVICE_MINUTES_EXHAUSTED",
				didStart: false,
			});
		}
	}, [
		baseFrameId,
		endDeviceSession,
		loadAppetize,
		platform,
		projectId,
		reportEnd,
		startDeviceSession,
		t,
	]);

	const stop = useCallback(async () => {
		// The end event of this session must not report the end a second time.
		attemptRef.current += 1;
		const stopAttempt = attemptRef.current;
		const client = clientRef.current;
		clientRef.current = null;
		// Report before the await: a start on a new target during the await
		// writes its own row id, and a late report would end that row.
		// A queued start has no session, so Appetize sends no end event.
		reportEnd();
		await client?.endSession().catch((error: unknown) => {
			console.error("Appetize end failed", error);
		});
		// A target switch during the await shows the new target idle. "Session ended" belongs to the old target.
		if (attemptRef.current !== stopAttempt) return;
		setPhase({ kind: "ended" });
	}, [reportEnd]);

	// A target switch, a view switch, or a page leave ends the session.
	// Both calls fire at once: a closing tab runs no code after an await.
	// biome-ignore lint/correctness/useExhaustiveDependencies: platform is an intentional end trigger
	useEffect(
		() => () => {
			attemptRef.current += 1;
			const client = clientRef.current;
			clientRef.current = null;
			void client?.endSession().catch((error: unknown) => {
				console.error("Appetize end failed", error);
			});
			reportEnd();
		},
		[platform, reportEnd],
	);

	// A heartbeat each minute keeps a watched device alive. A hidden tab
	// sends none, so Appetize can end a forgotten session.
	const isRunning = phase.kind === "running";
	useEffect(() => {
		if (!isRunning) return;
		const heartbeatId = setInterval(() => {
			if (document.visibilityState !== "visible") return;
			setIdleWarningSeconds(null);
			void sessionRef.current?.heartbeat().catch((error: unknown) => {
				console.error("Appetize heartbeat failed", error);
			});
		}, HEARTBEAT_INTERVAL_MS);
		return () => clearInterval(heartbeatId);
	}, [isRunning]);

	return {
		phase,
		idleWarningSeconds,
		frameId: `${baseFrameId}-${attempt}`,
		start: () => void start(),
		stop: () => void stop(),
		restartApp: () => {
			void sessionRef.current?.restartApp().catch((error: unknown) => {
				console.error("Appetize restart failed", error);
			});
		},
		shake: () => {
			void sessionRef.current?.shake().catch((error: unknown) => {
				console.error("Appetize shake failed", error);
			});
		},
	};
}
