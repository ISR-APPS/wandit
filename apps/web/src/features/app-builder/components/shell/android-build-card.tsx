/**
 * The Android APK card of the publish popover (WANDIT-194), and the card
 * parts that the web card of publish-popover.tsx shares with it.
 * Rendered by PublishMobileTargets in publish-popover.tsx. PublishMobileBody
 * there owns the builds query and the mutations. versions-popover.tsx reads
 * HISTORY_ACTION_CLASS. Draws the QR code with qrcode.react.
 */

import type { Icon } from "@phosphor-icons/react";
import { AndroidLogoIcon } from "@phosphor-icons/react/AndroidLogo";
import { CircleNotchIcon } from "@phosphor-icons/react/CircleNotch";
import { DownloadSimpleIcon } from "@phosphor-icons/react/DownloadSimple";
import { HammerIcon } from "@phosphor-icons/react/Hammer";
import { WarningCircleIcon } from "@phosphor-icons/react/WarningCircle";
import {
	MOBILE_BUILD_ANDROID_CREDITS,
	type MobileBuild,
	type MobileBuildStatus,
} from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { QRCodeSVG } from "qrcode.react";
import type { ReactNode } from "react";

import { formatNumber, formatRelativeTime, useTranslation } from "@/lib/i18n";
import {
	LIVE_STATUSES,
	MOBILE_BUILDS_LIMIT,
} from "../../api/mobile-builds.queries";

// 96 px gives about 3 px per module for an EAS APK URL. A phone camera reads that from a screen.
const QR_SIZE_PX = 96;

/** The full-width ember pill of a destination card: Publish, Update, or Build APK. */
export const DESTINATION_ACTION_CLASS =
	"h-10 w-full rounded-full font-grotesk font-semibold";

// The second build next to a ready APK is an outline pill, so the download stays the one ember action.
// The dark: classes override the dark fill and border of the kit outline variant.
const DESTINATION_OUTLINE_CLASS =
	"border-popover-foreground/[0.12] bg-transparent text-popover-foreground hover:bg-popover-foreground/[0.04] dark:border-white/[0.12] dark:bg-transparent dark:hover:bg-white/[0.05]";

/**
 * A small ghost pill at the end of a history row: Roll back or Download APK.
 * versions-popover.tsx builds its Diff and Restore pills on it.
 */
export const HISTORY_ACTION_CLASS =
	"inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 font-grotesk font-medium text-popover-foreground/70 text-xs transition-colors hover:bg-popover-foreground/[0.07] hover:text-popover-foreground disabled:pointer-events-none disabled:opacity-40";

/** One row of a history list. A soft tint shows on hover. */
export const HISTORY_ROW_CLASS =
	"flex min-h-9 items-center gap-2.5 rounded-[14px] px-2 py-1 transition-colors hover:bg-popover-foreground/[0.04]";

// The dot before an earlier build: green when ready, red when failed, faint otherwise.
const BUILD_DOT_CLASS: Record<MobileBuildStatus, string> = {
	queued: "bg-popover-foreground/25",
	building: "bg-primary",
	finished: "bg-success",
	failed: "bg-destructive",
	canceled: "bg-popover-foreground/25",
};

/**
 * State of a destination: `idle` before the first release or after a failure,
 * `busy` while a publish or a build runs, `live` while the app is out.
 */
type DestinationTone = "idle" | "busy" | "live";

// Neutral at rest, an ember tint while work runs, the spark ground once the app is out.
const MEDALLION_TONE_CLASS: Record<DestinationTone, string> = {
	idle: "bg-popover-foreground/[0.05] text-popover-foreground/60",
	busy: "bg-primary/10 text-ember-text",
	live: "bg-spark text-night",
};

/**
 * The frame of one destination in the publish popover: a medallion, the
 * title with an optional chip, one status line, then the actions below.
 */
export function DestinationCard({
	icon: CardIcon,
	tone,
	title,
	badge,
	status,
	children,
}: {
	icon: Icon;
	tone: DestinationTone;
	title: string;
	/** A chip after the title, for example the green Live chip. */
	badge?: ReactNode;
	/** One line under the title: the host, the build state, or a hint. A busy card draws it in ember. */
	status: ReactNode;
	/** The actions and notes of the card, stacked under the header. */
	children: ReactNode;
}) {
	return (
		<section className="rounded-[20px] border border-popover-foreground/[0.08] bg-paper p-3.5 dark:bg-white/[0.03]">
			<div className="flex items-center gap-3">
				<span
					aria-hidden
					className={cn(
						"grid size-10 shrink-0 place-items-center rounded-full transition-colors duration-200",
						MEDALLION_TONE_CLASS[tone],
					)}
				>
					<CardIcon
						weight={tone === "live" ? "fill" : "duotone"}
						className="size-5"
					/>
				</span>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<h3 className="truncate font-grotesk font-semibold text-[14.5px] leading-tight">
							{title}
						</h3>
						{badge}
					</div>
					<p
						className={cn(
							"mt-1 truncate text-[12.5px] leading-tight",
							tone === "busy"
								? "font-grotesk font-medium text-ember-text"
								: "text-popover-foreground/60",
						)}
					>
						{status}
					</p>
				</div>
			</div>
			<div className="mt-3.5 flex flex-col gap-2.5">{children}</div>
		</section>
	);
}

/** The failure text of a publish or a build, on a soft red ground with a warning icon. */
export function DestinationError({ text }: { text: string }) {
	return (
		<p className="flex items-start gap-2 rounded-[14px] bg-destructive/[0.07] px-3 py-2 text-[12.5px] text-destructive leading-snug dark:bg-destructive/[0.14]">
			<WarningCircleIcon
				aria-hidden
				weight="fill"
				className="mt-px size-4 shrink-0"
			/>
			<span>{text}</span>
		</p>
	);
}

/** A small label over a list of earlier versions or earlier builds. Each child is one `<li>` row. */
export function HistoryList({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<div className="flex flex-col">
			<h4 className="px-2 pt-0.5 pb-1 font-grotesk font-semibold text-popover-foreground/55 text-xs">
				{label}
			</h4>
			<ul className="flex flex-col">{children}</ul>
		</div>
	);
}

/** What the card shows and does. PublishMobileBody fills it from mobileBuildsQuery and the two build mutations. */
export type AndroidBuildCardProps = {
	/** Newest first, from mobileBuildsQuery. The card shows the first MOBILE_BUILDS_LIMIT builds: the latest, then the history. Empty before the first build. */
	builds: MobileBuild[];
	/** True while the create request runs. The build button is disabled then. */
	isStarting: boolean;
	/** True while the cancel request runs. The Cancel button is disabled then. */
	isCanceling: boolean;
	/** Starts a new APK build. The API holds MOBILE_BUILD_ANDROID_CREDITS for it. */
	onBuild: () => void;
	/** Cancels the live build with this id. The API refunds its credits. */
	onCancel: (buildId: string) => void;
};

/**
 * One destination card: the state of the latest build, then the QR code and
 * the download of a ready APK, the error text, or the wait hint with Cancel,
 * then the build button and the earlier builds.
 */
export function AndroidBuildCard({
	builds,
	isStarting,
	isCanceling,
	onBuild,
	onCancel,
}: AndroidBuildCardProps) {
	const { t, locale } = useTranslation();
	const latest = builds.at(0);
	// A create puts the new build first, so the cached list can hold one build too many until the next read.
	const olderBuilds = builds.slice(1, MOBILE_BUILDS_LIMIT);
	const liveBuild =
		latest && LIVE_STATUSES.has(latest.status) ? latest : undefined;
	const apkUrl = latest?.status === "finished" ? latest.artifactUrl : null;
	const priceParams = {
		count: MOBILE_BUILD_ANDROID_CREDITS,
		countDisplay: formatNumber(MOBILE_BUILD_ANDROID_CREDITS, locale),
	};

	return (
		<DestinationCard
			icon={AndroidLogoIcon}
			tone={liveBuild ? "busy" : apkUrl ? "live" : "idle"}
			title={t("appBuilder.mobileBuilds.title")}
			status={
				latest
					? `${t(`appBuilder.mobileBuilds.status.${latest.status}`)} · ${formatRelativeTime(latest.completedAt ?? latest.createdAt, locale)}`
					: t("appBuilder.mobileBuilds.empty")
			}
		>
			{apkUrl ? (
				<div className="flex items-center gap-3.5 rounded-[20px] bg-popover-foreground/[0.03] p-2.5 dark:bg-white/[0.03]">
					{/* The same surface as QR_TILE_CLASS of expo-go-popover.tsx. Black on white in both themes: a phone camera cannot read a dark code. */}
					<div className="shrink-0 rounded-[20px] bg-white p-3 shadow-[0_1px_2px_rgb(11_16_51/0.08)] ring-1 ring-night/[0.08] dark:ring-white/10">
						<QRCodeSVG
							value={apkUrl}
							size={QR_SIZE_PX}
							title={t("appBuilder.mobileBuilds.qrTitle")}
						/>
					</div>
					<div className="flex min-w-0 flex-col items-start gap-2.5">
						<p className="text-[12.5px] text-popover-foreground/60 leading-snug">
							{t("appBuilder.mobileBuilds.scanHint")}
						</p>
						<Button
							asChild
							size="sm"
							className="h-8 rounded-full font-grotesk font-semibold"
						>
							{/* `download` forces a save only for a same-origin URL. The EAS URL opens in a new tab instead. */}
							<a
								href={apkUrl}
								download
								target="_blank"
								rel="noopener noreferrer"
							>
								<DownloadSimpleIcon aria-hidden weight="bold" />
								{t("appBuilder.mobileBuilds.download")}
							</a>
						</Button>
					</div>
				</div>
			) : null}
			{latest?.status === "failed" ? (
				// The contract allows a failed row without a code. The generic `internal` text covers it.
				<DestinationError
					text={t(
						`appBuilder.mobileBuilds.errors.${latest.errorCode ?? "internal"}`,
					)}
				/>
			) : null}
			{liveBuild ? (
				// A project runs one build at a time, so a live build shows the hint and Cancel, and no build button.
				<div className="flex items-center gap-3">
					<p className="min-w-0 flex-1 text-[12.5px] text-popover-foreground/55 leading-snug">
						{t("appBuilder.mobileBuilds.liveHint")}
					</p>
					<Button
						variant="outline"
						size="sm"
						className={cn(
							"h-8 rounded-full font-grotesk font-semibold",
							DESTINATION_OUTLINE_CLASS,
						)}
						disabled={isCanceling}
						onClick={() => onCancel(liveBuild.id)}
					>
						{t("appBuilder.mobileBuilds.cancel")}
					</Button>
				</div>
			) : (
				<Button
					variant={apkUrl ? "outline" : "default"}
					className={cn(
						DESTINATION_ACTION_CLASS,
						apkUrl && DESTINATION_OUTLINE_CLASS,
					)}
					disabled={isStarting}
					onClick={onBuild}
				>
					{isStarting ? (
						<CircleNotchIcon
							aria-hidden
							weight="bold"
							className="animate-spin motion-reduce:animate-none"
						/>
					) : (
						<HammerIcon aria-hidden weight="fill" />
					)}
					{latest?.status === "failed"
						? t("appBuilder.mobileBuilds.retry", priceParams)
						: t("appBuilder.mobileBuilds.build", priceParams)}
				</Button>
			)}
			{olderBuilds.length > 0 ? (
				<div className="-mx-1 border-popover-foreground/[0.07] border-t pt-2">
					<HistoryList label={t("appBuilder.mobileBuilds.history")}>
						{olderBuilds.map((build) => (
							<li key={build.id} className={HISTORY_ROW_CLASS}>
								<span
									aria-hidden
									className={cn(
										"size-1.5 shrink-0 rounded-full",
										BUILD_DOT_CLASS[build.status],
									)}
								/>
								<span className="min-w-0 flex-1 truncate font-grotesk font-medium text-[13px] text-popover-foreground/80">
									{t(`appBuilder.mobileBuilds.status.${build.status}`)}
									{" · "}
									{formatRelativeTime(
										build.completedAt ?? build.createdAt,
										locale,
									)}
								</span>
								{build.status === "finished" && build.artifactUrl ? (
									<a
										href={build.artifactUrl}
										download
										target="_blank"
										rel="noopener noreferrer"
										className={HISTORY_ACTION_CLASS}
									>
										<DownloadSimpleIcon
											aria-hidden
											weight="bold"
											className="size-3.5"
										/>
										{t("appBuilder.mobileBuilds.download")}
									</a>
								) : null}
							</li>
						))}
					</HistoryList>
				</div>
			) : null}
		</DestinationCard>
	);
}
