/**
 * Views of the Appetize device on the mobile stage (WANDIT-196).
 * DeviceScreen fills the phone screen: the turn-on card, the start-up,
 * queue, end, and error states, and the stream iframe. DeviceBarControls
 * sit at the end of the stage bar while a session runs. PhonePreview
 * renders both from useDeviceSession. Both are pure; the spec renders them.
 */

import type { Icon } from "@phosphor-icons/react";
import { AndroidLogoIcon } from "@phosphor-icons/react/AndroidLogo";
import { AppleLogoIcon } from "@phosphor-icons/react/AppleLogo";
import { ArrowClockwiseIcon } from "@phosphor-icons/react/ArrowClockwise";
import { CircleNotchIcon } from "@phosphor-icons/react/CircleNotch";
import { GlobeIcon } from "@phosphor-icons/react/Globe";
import { HandWavingIcon } from "@phosphor-icons/react/HandWaving";
import { PowerIcon } from "@phosphor-icons/react/Power";
import { StopIcon } from "@phosphor-icons/react/Stop";
import { WarningCircleIcon } from "@phosphor-icons/react/WarningCircle";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import type { MobilePreviewTarget, PhoneDevice } from "../../lib/constants";
import type { DevicePhase } from "../../lib/use-device-session";
import { IconAction, TOOLBAR_ICON_BUTTON_CLASS } from "../shell/top-bar";

/** Icon of each target of the mobile stage. The target switch and the turn-on card use it. */
export const MOBILE_TARGET_ICON: Record<MobilePreviewTarget, Icon> = {
	web: GlobeIcon,
	ios: AppleLogoIcon,
	android: AndroidLogoIcon,
};

// Large soft blobs of the brand colors on the night ground, behind the glass card.
const BACKDROP_STYLE: CSSProperties = {
	backgroundImage: [
		"radial-gradient(70% 42% at 12% 14%, color-mix(in oklab, var(--color-ember) 85%, transparent), transparent 70%)",
		"radial-gradient(62% 40% at 96% 50%, color-mix(in oklab, var(--color-spark) 55%, transparent), transparent 72%)",
		"radial-gradient(80% 44% at 24% 100%, color-mix(in oklab, var(--color-cream) 40%, transparent), transparent 72%)",
	].join(", "),
};

/** Props of the phone screen of a device target. PhonePreview passes the useDeviceSession state. */
export type DeviceScreenProps = {
	/** The device target of the stage. It picks the logo and the title of the turn-on card. */
	platform: PhoneDevice;
	/** The session phase from useDeviceSession. Every phase but `running` shows the card. */
	phase: DevicePhase;
	/** Seconds before Appetize ends an idle session, from its warning; null without a warning. */
	idleWarningSeconds: number | null;
	/** Id of the iframe that the Appetize SDK fills, from useDeviceSession. */
	frameId: string;
	/** Accessible name of the stream iframe. */
	title: string;
	/** Starts a session. Each device minute costs money, so only this button starts one. */
	onStart: () => void;
};

/** The phone screen of a device target. The card covers the stream until it runs. */
export function DeviceScreen({
	platform,
	phase,
	idleWarningSeconds,
	frameId,
	title,
	onStart,
}: DeviceScreenProps) {
	const { t } = useTranslation();

	return (
		<div className="absolute inset-0 bg-night">
			{/* The SDK fills this iframe; it stays mounted from the first start on. */}
			{phase.kind === "idle" ? null : (
				<iframe
					key={frameId}
					id={frameId}
					title={title}
					className="absolute inset-0 size-full border-0"
				/>
			)}
			{phase.kind === "running" ? (
				idleWarningSeconds === null ? null : (
					<p
						role="status"
						className="absolute inset-x-4 bottom-6 rounded-full bg-night/85 px-3 py-2 text-center font-grotesk font-medium text-[12px] text-paper ring-1 ring-white/10 backdrop-blur-md"
					>
						{t("appBuilder.devicePreview.idleWarning", {
							seconds: String(Math.ceil(idleWarningSeconds)),
						})}
					</p>
				)
			) : (
				<div
					className="absolute inset-0 grid place-items-center bg-night px-5"
					style={BACKDROP_STYLE}
				>
					<DeviceCard platform={platform} phase={phase} onStart={onStart} />
				</div>
			)}
		</div>
	);
}

/** The glass card of every phase but `running`: a medallion, a title, a note, and the button. */
function DeviceCard({
	platform,
	phase,
	onStart,
}: Pick<DeviceScreenProps, "platform" | "phase" | "onStart">) {
	const { t } = useTranslation();
	const PlatformIcon = MOBILE_TARGET_ICON[platform];
	const platformTitle = t(
		platform === "ios"
			? "appBuilder.mobileStage.iosTitle"
			: "appBuilder.mobileStage.androidTitle",
	);

	let medallion: ReactNode = (
		<PlatformIcon aria-hidden weight="fill" className="size-6" />
	);
	let heading = platformTitle;
	let note: ReactNode = t("appBuilder.devicePreview.startHint");
	let buttonLabel: string | null = t("appBuilder.devicePreview.start");
	let ButtonIcon: Icon = PowerIcon;
	let isButtonDisabled = false;
	if (phase.kind === "starting" || phase.kind === "queued") {
		medallion = (
			<CircleNotchIcon
				aria-hidden
				weight="bold"
				className="size-6 animate-spin text-spark motion-reduce:animate-none"
			/>
		);
		heading =
			phase.kind === "starting"
				? t("appBuilder.devicePreview.starting")
				: t("appBuilder.mobileStage.queued", {
						position: String(phase.position),
					});
		note =
			phase.kind === "queued" ? t("appBuilder.mobileStage.queueNote") : null;
		buttonLabel = null;
	} else if (phase.kind === "ended") {
		heading = t("appBuilder.devicePreview.ended");
		buttonLabel = t("appBuilder.devicePreview.again");
	} else if (phase.kind === "error") {
		medallion = (
			<WarningCircleIcon
				aria-hidden
				weight="fill"
				className="size-6 text-spark"
			/>
		);
		heading = t(
			phase.didStart
				? "appBuilder.mobileStage.stoppedTitle"
				: "appBuilder.mobileStage.errorTitle",
		);
		note = <span role="alert">{phase.message}</span>;
		buttonLabel = t("appBuilder.devicePreview.retry");
		ButtonIcon = ArrowClockwiseIcon;
		// The month minutes are spent: a new start would fail the same way.
		isButtonDisabled = phase.isExhausted;
	}

	return (
		<div
			// Screen readers hear each new phase, like "Starting the device…".
			aria-live="polite"
			className="flex w-full flex-col items-center rounded-[24px] bg-white/10 px-5 pt-6 pb-5 text-center text-white ring-1 ring-white/15 backdrop-blur-xl"
		>
			<span className="grid size-12 place-items-center rounded-full bg-white/[0.12] ring-1 ring-white/20">
				{medallion}
			</span>
			<p className="mt-3.5 text-balance font-grotesk font-semibold text-[17px] leading-tight">
				{heading}
			</p>
			{note === null ? null : (
				<p className="mt-1.5 text-pretty font-sans text-[13px] text-white/70 leading-snug">
					{note}
				</p>
			)}
			{buttonLabel === null ? null : (
				<Button
					onClick={onStart}
					disabled={isButtonDisabled}
					className="mt-5 h-10 rounded-full bg-spark px-5 font-grotesk font-semibold text-night hover:bg-spark/90 has-[>svg]:px-5"
				>
					<ButtonIcon aria-hidden weight="bold" />
					{buttonLabel}
				</Button>
			)}
		</div>
	);
}

/** Props of the session buttons in the stage bar. PhonePreview passes the useDeviceSession state. */
export type DeviceBarControlsProps = {
	/** The session phase from useDeviceSession. Only `queued` and `running` show buttons. */
	phase: DevicePhase;
	/** True on a narrow stage bar, from PhonePreview: the chip shows the bare time and Stop shows only its icon. */
	isCompact: boolean;
	/** Ends the session, or leaves the queue. */
	onStop: () => void;
	/** Restarts the app in Expo Go. */
	onRestartApp: () => void;
	/** Shakes the device, so Expo Go opens its dev menu. */
	onDevMenu: () => void;
};

/** End of the stage bar on a device target: the countdown and the session buttons. Nothing while no session is open. */
export function DeviceBarControls({
	phase,
	isCompact,
	onStop,
	onRestartApp,
	onDevMenu,
}: DeviceBarControlsProps) {
	const { t } = useTranslation();
	// No session exists while idle, starting, ended, or failed, so there is nothing to stop.
	if (phase.kind !== "running" && phase.kind !== "queued") return null;

	return (
		<>
			{phase.kind === "running" ? (
				<>
					<TimeLeftChip endsAtMs={phase.endsAtMs} isCompact={isCompact} />
					<IconAction label={t("appBuilder.devicePreview.reload")}>
						<Button
							variant="ghost"
							size="icon-sm"
							className={TOOLBAR_ICON_BUTTON_CLASS}
							onClick={onRestartApp}
						>
							<ArrowClockwiseIcon aria-hidden weight="bold" />
						</Button>
					</IconAction>
					<IconAction label={t("appBuilder.devicePreview.devMenu")}>
						<Button
							variant="ghost"
							size="icon-sm"
							className={TOOLBAR_ICON_BUTTON_CLASS}
							onClick={onDevMenu}
						>
							<HandWavingIcon aria-hidden weight="bold" />
						</Button>
					</IconAction>
				</>
			) : null}
			<Button
				variant="outline"
				size="sm"
				onClick={onStop}
				className={cn(
					"rounded-full border-night/15 bg-transparent font-grotesk font-medium text-night hover:bg-night/[0.05] hover:text-night dark:border-white/15 dark:bg-transparent dark:text-foreground dark:hover:bg-white/[0.06]",
					isCompact
						? "px-2.5 has-[>svg]:px-2.5"
						: "ms-1 px-3.5 has-[>svg]:px-3.5",
				)}
			>
				<StopIcon aria-hidden weight="fill" className="size-3" />
				{/* The label stays the accessible name when only the icon shows. */}
				<span className={isCompact ? "sr-only" : undefined}>
					{t("appBuilder.devicePreview.stop")}
				</span>
			</Button>
		</>
	);
}

/** The time left of the running session. Only the chip ticks each second, so the stage and its iframe do not re-render. */
function TimeLeftChip({
	endsAtMs,
	isCompact,
}: {
	/** End of the time limit, ms since epoch, from the running phase. */
	endsAtMs: number;
	/** True on a narrow stage bar: the chip shows the bare time, without the dot. */
	isCompact: boolean;
}) {
	const { t } = useTranslation();
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const tickId = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(tickId);
	}, []);
	const remainingSeconds = Math.max(Math.ceil((endsAtMs - now) / 1000), 0);
	const time = formatCountdown(remainingSeconds);
	const timeLeft = t("appBuilder.devicePreview.timeLeft", { time });

	// Each minute costs money, so the chip shows at every width.
	return (
		<span
			className={cn(
				"flex h-8 shrink-0 items-center gap-2 rounded-full bg-night/[0.05] font-grotesk font-medium text-[13px] text-night/75 tabular-nums dark:bg-white/[0.06] dark:text-foreground/75",
				isCompact ? "px-2.5" : "me-1 px-3",
			)}
		>
			{isCompact ? (
				<>
					<span aria-hidden>{time}</span>
					{/* Screen readers hear the full text, also on a narrow bar. */}
					<span className="sr-only">{timeLeft}</span>
				</>
			) : (
				<>
					<span aria-hidden className="size-1.5 rounded-full bg-success" />
					{timeLeft}
				</>
			)}
		</span>
	);
}

/** `m:ss` of a number of seconds, for the countdown. */
export function formatCountdown(totalSeconds: number): string {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
