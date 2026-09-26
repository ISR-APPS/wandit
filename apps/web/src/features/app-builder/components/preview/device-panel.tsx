/**
 * Appetize device of the mobile preview (WANDIT-196): a start button, then a
 * streamed iPhone or Android device that runs the project in Expo Go.
 * Rendered by phone-preview.tsx when the user asks for a device. It starts
 * and ends the session through the device-session routes and drives the
 * Appetize JS SDK. DeviceControls is pure; the spec renders it.
 */

import {
	appetizeInactivityWarningSchema,
	appetizeQueueEventSchema,
	type DevicePlatform,
} from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { Loader2, Menu, Play, RefreshCw, Square } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { getApiErrorMessage, isApiClientError } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import {
	endDeviceSession,
	startDeviceSession,
} from "../../api/app-builder.services";
import {
	type AppetizeClient,
	type AppetizeSession,
	loadAppetize,
} from "../../lib/appetize-sdk";

/** Heartbeat period, ms. Half of the 120 s idle timeout of Appetize. */
const HEARTBEAT_INTERVAL_MS = 60_000;

/** What the device panel shows. */
export type DevicePhase =
	| { kind: "idle" }
	| { kind: "starting" }
	| { kind: "queued"; position: number }
	| { kind: "running"; endsAtMs: number }
	| { kind: "ended" }
	| {
			kind: "error";
			message: string;
			/** True after a 402: the month minutes are spent, so the start button stays off. */
			isExhausted: boolean;
	  };

export type DevicePanelProps = {
	/** The open mobile project. Its id starts the device session. */
	projectId: string;
	/** `ios` or `android`, from the device toggle of the top bar. The parent remounts the panel on a change. */
	platform: DevicePlatform;
	/** Accessible name of the device iframe. */
	title: string;
};

/**
 * Starts one device session on the button, never on mount: each minute
 * costs money. Ends the session on stop, on the Appetize end, and on unmount.
 */
export function DevicePanel({ projectId, platform, title }: DevicePanelProps) {
	const { t } = useTranslation();
	const baseFrameId = useId();
	// Each start gets a fresh iframe, so the SDK never reuses an ended embed.
	const [attempt, setAttempt] = useState(0);
	const frameId = `${baseFrameId}-${attempt}`;
	const [phase, setPhase] = useState<DevicePhase>({ kind: "idle" });
	const [idleWarningSeconds, setIdleWarningSeconds] = useState<number | null>(
		null,
	);
	const [now, setNow] = useState(() => Date.now());
	const clientRef = useRef<AppetizeClient | null>(null);
	const sessionRef = useRef<AppetizeSession | null>(null);
	// The row of the open session; null before a start and after the end call.
	const deviceSessionIdRef = useRef<string | null>(null);
	// The attempt of the last start; the start reads it after its awaits.
	const attemptRef = useRef(0);

	// Tells the API once that the session ended, with the Appetize token when one started.
	const reportEnd = useCallback(() => {
		const deviceSessionId = deviceSessionIdRef.current;
		if (deviceSessionId === null) return;
		deviceSessionIdRef.current = null;
		void endDeviceSession(
			projectId,
			deviceSessionId,
			sessionRef.current?.token,
		).catch((error: unknown) => {
			// LIMIT: a lost end call (or a closed tab) leaves the row open. The
			// minutes task bills its own clock, at most 15 minutes, and the user
			// lock expires after 17 minutes. Upgrade: a sendBeacon end route.
			console.error("Device session end failed", error);
		});
	}, [projectId]);

	const start = useCallback(async () => {
		attemptRef.current += 1;
		// The "starting" render mounts the iframe of this attempt before the SDK looks for it.
		const attemptFrameId = `${baseFrameId}-${attemptRef.current}`;
		setAttempt(attemptRef.current);
		setPhase({ kind: "starting" });
		setIdleWarningSeconds(null);
		sessionRef.current = null;
		try {
			const config = await startDeviceSession(projectId, platform);
			deviceSessionIdRef.current = config.deviceSessionId;
			const sdk = await loadAppetize();
			const client = await sdk.getClient(`#${CSS.escape(attemptFrameId)}`, {
				buildId: config.publicKey,
				codec: "h264",
				device: config.device,
				launchUrl: config.launchUrl,
				osVersion: config.osVersion,
				params: config.params,
				scale: "auto",
			});
			clientRef.current = client;
			client.on("queue", (data) => {
				const queue = appetizeQueueEventSchema.safeParse(data);
				if (queue.success) {
					setPhase({ kind: "queued", position: queue.data.position });
				}
			});
			client.on("session", (session) => {
				sessionRef.current = session;
				setPhase({
					kind: "running",
					endsAtMs: Date.now() + config.timeLimitSeconds * 1000,
				});
				session.on("inactivityWarning", (data) => {
					const warning = appetizeInactivityWarningSchema.safeParse(data);
					if (warning.success) {
						setIdleWarningSeconds(warning.data.secondsRemaining);
					}
				});
			});
			client.on("sessionEnded", () => {
				reportEnd();
				setPhase({ kind: "ended" });
			});
			const onFailure = (error: unknown) => {
				// No stack trace reaches the user; the console keeps it.
				console.error("Appetize session failed", error);
				reportEnd();
				setPhase({
					kind: "error",
					message: t("appBuilder.devicePreview.failed"),
					isExhausted: false,
				});
			};
			client.on("sessionError", onFailure);
			client.on("error", onFailure);
			await client.startSession();
		} catch (error) {
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
			});
		}
	}, [baseFrameId, platform, projectId, reportEnd, t]);

	const stop = useCallback(async () => {
		await clientRef.current?.endSession().catch((error: unknown) => {
			console.error("Appetize end failed", error);
		});
		// A queued start has no session, so Appetize sends no end event.
		reportEnd();
		setPhase({ kind: "ended" });
	}, [reportEnd]);

	// A view switch, a device switch, or a page leave ends the session.
	useEffect(
		() => () => {
			void clientRef.current?.endSession().catch((error: unknown) => {
				console.error("Appetize end failed", error);
			});
			reportEnd();
		},
		[reportEnd],
	);

	// The countdown ticks each second, and a heartbeat each minute keeps a
	// watched device alive. A hidden tab sends none, so Appetize can end it.
	const isRunning = phase.kind === "running";
	useEffect(() => {
		if (!isRunning) return;
		const tickId = setInterval(() => setNow(Date.now()), 1000);
		const heartbeatId = setInterval(() => {
			if (document.visibilityState !== "visible") return;
			setIdleWarningSeconds(null);
			void sessionRef.current?.heartbeat().catch((error: unknown) => {
				console.error("Appetize heartbeat failed", error);
			});
		}, HEARTBEAT_INTERVAL_MS);
		return () => {
			clearInterval(tickId);
			clearInterval(heartbeatId);
		};
	}, [isRunning]);

	return (
		<div className="flex size-full flex-col gap-3">
			<DeviceControls
				phase={phase}
				remainingSeconds={
					phase.kind === "running"
						? Math.max(Math.ceil((phase.endsAtMs - now) / 1000), 0)
						: null
				}
				idleWarningSeconds={idleWarningSeconds}
				onStart={() => void start()}
				onStop={() => void stop()}
				onReload={() => {
					void sessionRef.current?.restartApp().catch((error: unknown) => {
						console.error("Appetize restart failed", error);
					});
				}}
				onDevMenu={() => {
					void sessionRef.current?.shake().catch((error: unknown) => {
						console.error("Appetize shake failed", error);
					});
				}}
			/>
			{/* The SDK fills this iframe; it stays mounted from the first start on. */}
			{phase.kind === "idle" ? null : (
				<iframe
					key={frameId}
					id={frameId}
					title={title}
					className="min-h-0 w-full flex-1 rounded-lg border-0"
				/>
			)}
		</div>
	);
}

export type DeviceControlsProps = {
	phase: DevicePhase;
	/** Seconds left of the running session, or null when no session runs. */
	remainingSeconds: number | null;
	/** Seconds before Appetize ends an idle session, from its warning; null without a warning. */
	idleWarningSeconds: number | null;
	onStart: () => void;
	onStop: () => void;
	/** Restarts the app in Expo Go. */
	onReload: () => void;
	/** Shakes the device, so Expo Go opens its dev menu. */
	onDevMenu: () => void;
};

/** Status line and buttons of the device panel. */
export function DeviceControls({
	phase,
	remainingSeconds,
	idleWarningSeconds,
	onStart,
	onStop,
	onReload,
	onDevMenu,
}: DeviceControlsProps) {
	const { t } = useTranslation();

	if (
		phase.kind === "idle" ||
		phase.kind === "ended" ||
		phase.kind === "error"
	) {
		const isExhausted = phase.kind === "error" && phase.isExhausted;
		let message = t("appBuilder.devicePreview.startHint");
		if (phase.kind === "error") message = phase.message;
		if (phase.kind === "ended") message = t("appBuilder.devicePreview.ended");
		return (
			<div className="flex flex-col items-center gap-2 text-center">
				<p
					role={phase.kind === "error" ? "alert" : undefined}
					className="text-muted-foreground text-sm"
				>
					{message}
				</p>
				<Button size="sm" onClick={onStart} disabled={isExhausted}>
					<Play className="size-3.5" />
					{phase.kind === "idle"
						? t("appBuilder.devicePreview.start")
						: t("appBuilder.devicePreview.again")}
				</Button>
			</div>
		);
	}

	let status: string;
	if (phase.kind === "starting") {
		status = t("appBuilder.devicePreview.starting");
	} else if (phase.kind === "queued") {
		status = t("appBuilder.devicePreview.queue", {
			position: String(phase.position),
		});
	} else if (idleWarningSeconds !== null) {
		status = t("appBuilder.devicePreview.idleWarning", {
			seconds: String(Math.ceil(idleWarningSeconds)),
		});
	} else {
		status = t("appBuilder.devicePreview.timeLeft", {
			time: formatCountdown(remainingSeconds ?? 0),
		});
	}

	return (
		<div className="flex items-center justify-between gap-2">
			<span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground text-xs">
				{phase.kind === "running" ? null : (
					<Loader2 className="size-3.5 shrink-0 animate-spin" />
				)}
				{status}
			</span>
			<span className="flex shrink-0 items-center gap-1">
				{phase.kind === "running" ? (
					<>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={t("appBuilder.devicePreview.reload")}
							onClick={onReload}
						>
							<RefreshCw className="size-3.5" />
						</Button>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={t("appBuilder.devicePreview.devMenu")}
							onClick={onDevMenu}
						>
							<Menu className="size-3.5" />
						</Button>
					</>
				) : null}
				{/* No session exists while the start call runs, so there is nothing to stop. */}
				{phase.kind === "starting" ? null : (
					<Button variant="outline" size="sm" onClick={onStop}>
						<Square className="size-3" />
						{t("appBuilder.devicePreview.stop")}
					</Button>
				)}
			</span>
		</div>
	);
}

/** `m:ss` of a number of seconds, for the countdown. */
export function formatCountdown(totalSeconds: number): string {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
