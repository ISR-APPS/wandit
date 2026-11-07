/**
 * The desktop app card of the publish popover (docs/v2/desktop-apps.md):
 * the staff suspension notice, the stable download link of each platform,
 * the state of the latest build with its error or gate findings, the build
 * form with the platform choice, and the build list with Download, and
 * Release or Rebuild. Rendered by PublishDesktopBody in publish-popover.tsx,
 * which owns desktopOverviewQuery and the three desktop mutations. Reuses the
 * card parts of android-build-card.tsx.
 */

import type { Icon } from "@phosphor-icons/react";
import { AppleLogoIcon } from "@phosphor-icons/react/AppleLogo";
import { ArrowClockwiseIcon } from "@phosphor-icons/react/ArrowClockwise";
import { CircleNotchIcon } from "@phosphor-icons/react/CircleNotch";
import { CopyIcon } from "@phosphor-icons/react/Copy";
import { DesktopIcon } from "@phosphor-icons/react/Desktop";
import { DownloadSimpleIcon } from "@phosphor-icons/react/DownloadSimple";
import { HammerIcon } from "@phosphor-icons/react/Hammer";
import { RocketLaunchIcon } from "@phosphor-icons/react/RocketLaunch";
import { WindowsLogoIcon } from "@phosphor-icons/react/WindowsLogo";
import { XCircleIcon } from "@phosphor-icons/react/XCircle";
import {
	type AppSuspension,
	type CreateDesktopBuildBody,
	DESKTOP_BUILD_CREDITS,
	type DesktopApp,
	type DesktopBuild,
	type DesktopBuildStatus,
	type DesktopGateFinding,
	type DesktopPlatform,
	desktopBuildNotesMaxLength,
	desktopPlatformSchema,
	desktopPlatforms,
	desktopProductNameSchema,
} from "@wandit/contracts";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@wandit/ui/components/alert-dialog";
import { Button } from "@wandit/ui/components/button";
import { Input } from "@wandit/ui/components/input";
import { Textarea } from "@wandit/ui/components/textarea";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@wandit/ui/components/toggle-group";
import { cn } from "@wandit/ui/lib/utils";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";

import { formatNumber, formatRelativeTime, useTranslation } from "@/lib/i18n";
import { LIVE_DESKTOP_STATUSES } from "../../api/desktop.queries";
import { copyToClipboard } from "../../lib/helpers";
import {
	DESTINATION_ACTION_CLASS,
	DestinationCard,
	DestinationError,
	HISTORY_ACTION_CLASS,
	HISTORY_ROW_CLASS,
	HistoryList,
} from "./android-build-card";
import { GATE_ACTION_CLASS } from "./publish-gate-findings";
import { IconAction, TOOLBAR_ICON_BUTTON_CLASS } from "./top-bar";

// Neutral before and after the work, ember while it runs, green when ready, red on a failure, spark when the gate blocked.
const STATUS_CHIP_CLASS: Record<DesktopBuildStatus, string> = {
	queued: "bg-popover-foreground/[0.06] text-popover-foreground/65",
	preparing: "bg-primary/10 text-ember-text",
	building: "bg-primary/10 text-ember-text",
	signing: "bg-primary/10 text-ember-text",
	ready: "bg-success/[0.12] text-success-text",
	failed: "bg-destructive/[0.08] text-destructive",
	canceled: "bg-popover-foreground/[0.06] text-popover-foreground/65",
	blocked: "bg-spark/[0.16] text-spark-deep dark:text-spark",
};

const CHIP_CLASS =
	"inline-flex h-5 shrink-0 items-center rounded-full px-2 font-grotesk font-semibold text-[11px]";

const PLATFORM_ICON: Record<DesktopPlatform, Icon> = {
	windows: WindowsLogoIcon,
	macos: AppleLogoIcon,
};

/**
 * True when `build` is older than the current build of its platform.
 * Installed apps accept only a newer version, so the API refuses its release,
 * and the card offers Rebuild instead. Each platform has its own current
 * build, so a current build of the other platform never counts. `builds` is
 * the overview list, newest first. It holds only the newest builds, so a
 * current build outside it is older than every listed build, and the answer
 * is false.
 */
export function isOlderThanCurrentBuild(
	build: DesktopBuild,
	builds: readonly DesktopBuild[],
): boolean {
	const current = builds.find(
		(candidate) => candidate.isCurrent && candidate.platform === build.platform,
	);
	return (
		current !== undefined &&
		Date.parse(build.createdAt) < Date.parse(current.createdAt)
	);
}

/** What the card shows and does. PublishDesktopBody fills it from desktopOverviewQuery and the desktop mutations. */
export type DesktopBuildCardProps = {
	/** Desktop identity of the project, from desktopOverviewQuery. Null before the first build request: the form then asks for the product name. */
	app: DesktopApp | null;
	/** Newest first, from desktopOverviewQuery. Empty before the first build. */
	builds: DesktopBuild[];
	/** Name of the project. The product name field starts with it. */
	projectName: string;
	/** Staff suspension of the app, from desktopOverviewQuery. While set, the API refuses a build and a release with 403. */
	suspension: AppSuspension | null;
	/** `buildablePlatforms` of desktopOverviewQuery. The platform choice shows only with 2 entries. */
	buildablePlatforms: DesktopPlatform[];
	/** True while the create request runs. The Build button spins and is disabled. */
	isStarting: boolean;
	/** True while the cancel request runs. The Cancel button is disabled then. */
	isCanceling: boolean;
	/** True while a release request runs. Every Release button is disabled then. */
	isReleasing: boolean;
	/** Starts a build for `platform` of the head of `main`, or of an older build with `rebuildOfBuildId`. The caller adds the request key. The API holds DESKTOP_BUILD_CREDITS for it. */
	onBuild: (input: Omit<CreateDesktopBuildBody, "requestKey">) => void;
	/** Cancels the live build with this id. The API releases its credits. */
	onCancel: (buildId: string) => void;
	/** Makes the ready build with this id the version of the installed apps of its platform. Called only after the confirm dialog. */
	onRelease: (buildId: string) => void;
};

/**
 * One destination card. A project runs one build at a time, so a live
 * build disables the form and shows the wait hint with Cancel. A staff
 * suspension disables Build and says why. The API then answers no
 * installer, so Release does not show.
 */
export function DesktopBuildCard({
	app,
	builds,
	projectName,
	suspension,
	buildablePlatforms,
	isStarting,
	isCanceling,
	isReleasing,
	onBuild,
	onCancel,
	onRelease,
}: DesktopBuildCardProps) {
	const { t, locale } = useTranslation();
	const latest = builds.at(0);
	const liveBuild =
		latest && LIVE_DESKTOP_STATUSES.has(latest.status) ? latest : undefined;
	// The API refuses a build of a suspended app. Cancel stays on: the API allows it.
	const isBuildDisabled =
		liveBuild !== undefined || isStarting || suspension !== null;
	const hasRelease =
		app !== null &&
		desktopPlatforms.some(
			(platform) => app.releases[platform].currentBuildId !== null,
		);

	return (
		<DestinationCard
			icon={DesktopIcon}
			// A suspended app has no download, so it is not live.
			tone={
				liveBuild ? "busy" : hasRelease && suspension === null ? "live" : "idle"
			}
			title={t("appBuilder.desktopBuilds.title")}
			status={
				latest
					? `${t(`appBuilder.desktopBuilds.status.${latest.status}`)} · ${formatRelativeTime(latest.completedAt ?? latest.createdAt, locale)}`
					: buildablePlatforms.length > 1
						? t("appBuilder.desktopBuilds.emptyBoth")
						: t("appBuilder.desktopBuilds.empty")
			}
		>
			{suspension ? (
				<DestinationError
					text={t("appBuilder.publish.suspension", {
						reason: t(
							`appBuilder.publish.suspensionReasons.${suspension.reasonCode}`,
						),
					})}
				/>
			) : null}
			{desktopPlatforms.map((platform) => {
				const downloadUrl = app?.releases[platform].downloadUrl;
				return downloadUrl ? (
					<DownloadLinkRow
						key={platform}
						platform={platform}
						url={downloadUrl}
					/>
				) : null;
			})}
			{latest?.status === "failed" ? (
				// The contract allows a failed row without a code. The generic `internal` text covers it.
				<DestinationError
					text={t(
						`appBuilder.desktopBuilds.errors.${latest.errorCode ?? "internal"}`,
					)}
				/>
			) : null}
			{latest?.status === "blocked" && latest.findings.length > 0 ? (
				<GateFindingList findings={latest.findings} />
			) : null}
			{liveBuild ? (
				<div className="flex items-center gap-3">
					<p className="min-w-0 flex-1 text-[12.5px] text-popover-foreground/55 leading-snug">
						{t("appBuilder.desktopBuilds.liveHint")}
					</p>
					<Button
						variant="outline"
						size="sm"
						className={cn("h-8 rounded-full", GATE_ACTION_CLASS)}
						disabled={isCanceling}
						onClick={() => onCancel(liveBuild.id)}
					>
						{t("appBuilder.desktopBuilds.cancel")}
					</Button>
				</div>
			) : null}
			<BuildForm
				// A new build goes first in the list, so the form starts empty again after a start. A failed start keeps the draft.
				key={latest?.id ?? "first"}
				isFirstBuild={app === null}
				projectName={projectName}
				buildablePlatforms={buildablePlatforms}
				lastPlatform={latest?.platform ?? "windows"}
				isDisabled={isBuildDisabled}
				isStarting={isStarting}
				isRetry={latest?.status === "failed" || latest?.status === "blocked"}
				onBuild={onBuild}
			/>
			{builds.length > 0 ? (
				<div className="-mx-1 border-popover-foreground/[0.07] border-t pt-2">
					<HistoryList label={t("appBuilder.desktopBuilds.history")}>
						{builds.map((build) => (
							<BuildRow
								key={build.id}
								build={build}
								isOlderThanCurrent={isOlderThanCurrentBuild(build, builds)}
								isPlatformBuildable={buildablePlatforms.includes(
									build.platform,
								)}
								isReleasing={isReleasing}
								isBuildDisabled={isBuildDisabled}
								onRelease={onRelease}
								onBuild={onBuild}
							/>
						))}
					</HistoryList>
				</div>
			) : null}
		</DestinationCard>
	);
}

/** The platform icon and its name. The download rows and the build rows show it. */
function PlatformBadge({ platform }: { platform: DesktopPlatform }) {
	const { t } = useTranslation();
	const PlatformIcon = PLATFORM_ICON[platform];
	return (
		<span className="inline-flex shrink-0 items-center gap-1 text-popover-foreground/55 text-xs">
			<PlatformIcon aria-hidden weight="fill" className="size-3.5" />
			{t(`appBuilder.desktopBuilds.platforms.${platform}`)}
		</span>
	);
}

/** The stable download link of the current file of one platform, with a copy button. */
function DownloadLinkRow({
	platform,
	url,
}: {
	platform: DesktopPlatform;
	/** `releases[platform].downloadUrl` of the app: https only, by the contract schema. */
	url: string;
}) {
	const { t } = useTranslation();
	return (
		<div className="flex flex-col gap-1">
			<span className="flex items-center gap-2 px-1 font-grotesk font-semibold text-popover-foreground/55 text-xs">
				{t("appBuilder.desktopBuilds.downloadLink")}
				<PlatformBadge platform={platform} />
			</span>
			<div className="flex items-center gap-1 rounded-full bg-popover-foreground/[0.04] ps-3 pe-1 dark:bg-white/[0.05]">
				{/* A URL reads left to right in every locale. */}
				<a
					href={url}
					target="_blank"
					rel="noopener noreferrer"
					dir="ltr"
					className="min-w-0 flex-1 truncate py-1.5 font-mono text-[12px] text-ember-text underline-offset-2 hover:underline"
				>
					{url}
				</a>
				<IconAction label={t("appBuilder.desktopBuilds.copyLink")}>
					<Button
						variant="ghost"
						size="icon-sm"
						className={cn(TOOLBAR_ICON_BUTTON_CLASS, "size-7")}
						onClick={() => {
							void copyToClipboard(url).then((copied) => {
								if (copied) toast(t("appBuilder.desktopBuilds.linkCopied"));
							});
						}}
					>
						<CopyIcon aria-hidden weight="bold" className="size-4" />
					</Button>
				</IconAction>
			</div>
		</div>
	);
}

/** The reasons of a blocked build: a translated text per rule, then the path and the English detail. */
function GateFindingList({
	findings,
}: {
	/** `findings` of the blocked build. Not empty. */
	findings: DesktopGateFinding[];
}) {
	const { t } = useTranslation();
	return (
		<div className="flex flex-col gap-2 rounded-[14px] bg-popover-foreground/[0.03] px-3 py-2.5 dark:bg-white/[0.03]">
			<h4 className="font-grotesk font-semibold text-destructive text-xs">
				{t("appBuilder.desktopBuilds.findingsTitle")}
			</h4>
			{/* Many migration files can fail. The list scrolls, so the hint stays in view. */}
			<ul className="scroll-warm flex max-h-48 flex-col gap-2 overflow-y-auto">
				{findings.map((finding, index) => (
					<li
						// biome-ignore lint/suspicious/noArrayIndexKey: a finding has no id, and the list of one build never changes.
						key={index}
						className="flex items-start gap-2 text-[12.5px] leading-snug"
					>
						<XCircleIcon
							aria-hidden
							weight="fill"
							className="mt-px size-4 shrink-0 text-destructive"
						/>
						<div className="min-w-0">
							<p className="text-popover-foreground/85">
								{t(`appBuilder.desktopBuilds.rules.${finding.rule}`)}
							</p>
							{/* The API writes the detail in English for the user and for support. */}
							<p
								dir="auto"
								lang="en"
								className="mt-0.5 break-words text-popover-foreground/55 text-xs"
							>
								<code className="font-mono">{finding.path}</code>{" "}
								{finding.message}
							</p>
						</div>
					</li>
				))}
			</ul>
			<p className="text-popover-foreground/55 text-xs">
				{t("appBuilder.desktopBuilds.findingsHint")}
			</p>
		</div>
	);
}

/** The product name (first build only), the release notes, the platform choice, and the Build button with its price. */
function BuildForm({
	isFirstBuild,
	projectName,
	buildablePlatforms,
	lastPlatform,
	isDisabled,
	isStarting,
	isRetry,
	onBuild,
}: {
	/** True before the first build request. Only then the API reads a product name. */
	isFirstBuild: boolean;
	/** Start value of the product name field. */
	projectName: string;
	buildablePlatforms: DesktopBuildCardProps["buildablePlatforms"];
	/** Platform of the newest build, or Windows before the first build. The choice starts on it, so "Build again" repeats it. */
	lastPlatform: DesktopPlatform;
	/** True while a build is live, the create request runs, or staff suspend the app. */
	isDisabled: boolean;
	/** True while the create request runs. The button spins. */
	isStarting: boolean;
	/** True after a failed or blocked build. The button says "Build again" while the platform is `lastPlatform`. */
	isRetry: boolean;
	onBuild: DesktopBuildCardProps["onBuild"];
}) {
	const { t, locale } = useTranslation();
	const productNameId = useId();
	const productNameHintId = useId();
	const notesId = useId();
	const notesHintId = useId();
	const platformLabelId = useId();
	const [productName, setProductName] = useState(projectName);
	const [notes, setNotes] = useState("");
	const [chosenPlatform, setChosenPlatform] = useState(lastPlatform);
	// buildablePlatforms always holds Windows. The flag can turn macOS off while the popover is open, and the choice then hides.
	const platform = buildablePlatforms.includes(chosenPlatform)
		? chosenPlatform
		: "windows";
	// A build of the other platform is a new build, not a retry of the failed one.
	const isRetryOfLastPlatform = isRetry && platform === lastPlatform;
	// The NSIS script and the macOS `.app` take the product name, so the field takes only what the API takes.
	const parsedProductName = desktopProductNameSchema.safeParse(productName);
	const isProductNameInvalid = isFirstBuild && !parsedProductName.success;
	const priceParams = {
		count: DESKTOP_BUILD_CREDITS,
		countDisplay: formatNumber(DESKTOP_BUILD_CREDITS, locale),
	};

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		// Enter in the field submits the form even when the button is disabled.
		if (isDisabled || isProductNameInvalid) return;
		const trimmedNotes = notes.trim();
		onBuild({
			platform,
			// The API reads the name only on the first build: it fixes the install folder and the `.app` name for good.
			productName:
				isFirstBuild && parsedProductName.success
					? parsedProductName.data
					: undefined,
			notes: trimmedNotes === "" ? undefined : trimmedNotes,
		});
	}

	return (
		<form onSubmit={submit} className="flex flex-col gap-2.5">
			{isFirstBuild ? (
				<div className="flex flex-col gap-1">
					<label
						htmlFor={productNameId}
						className="px-1 font-grotesk font-semibold text-popover-foreground/70 text-xs"
					>
						{t("appBuilder.desktopBuilds.productName")}
					</label>
					<Input
						id={productNameId}
						value={productName}
						onChange={(event) => setProductName(event.target.value)}
						dir="auto"
						autoComplete="off"
						disabled={isDisabled}
						aria-invalid={isProductNameInvalid}
						aria-describedby={productNameHintId}
						className="h-9 rounded-full bg-popover px-3.5"
					/>
					<p
						id={productNameHintId}
						className={cn(
							"px-1 text-xs leading-snug",
							isProductNameInvalid
								? "text-destructive"
								: "text-popover-foreground/55",
						)}
					>
						{isProductNameInvalid
							? t("appBuilder.desktopBuilds.productNameInvalid")
							: t("appBuilder.desktopBuilds.productNameHint")}
					</p>
				</div>
			) : null}
			<div className="flex flex-col gap-1">
				<label
					htmlFor={notesId}
					className="px-1 font-grotesk font-semibold text-popover-foreground/70 text-xs"
				>
					{t("appBuilder.desktopBuilds.notes")}
				</label>
				<Textarea
					id={notesId}
					value={notes}
					onChange={(event) => setNotes(event.target.value)}
					maxLength={desktopBuildNotesMaxLength}
					rows={2}
					dir="auto"
					disabled={isDisabled}
					aria-describedby={notesHintId}
					className="min-h-14 rounded-[14px] bg-popover px-3.5 text-[13px] md:text-[13px]"
				/>
				<p
					id={notesHintId}
					className="px-1 text-popover-foreground/55 text-xs leading-snug"
				>
					{t("appBuilder.desktopBuilds.notesHint")}
				</p>
			</div>
			{buildablePlatforms.length > 1 ? (
				<div className="flex flex-col gap-1">
					<span
						id={platformLabelId}
						className="px-1 font-grotesk font-semibold text-popover-foreground/70 text-xs"
					>
						{t("appBuilder.desktopBuilds.platformLabel")}
					</span>
					{/* Radix renders a single-choice group as role="radiogroup" with radio items. */}
					<ToggleGroup
						type="single"
						variant="outline"
						size="sm"
						spacing={1}
						value={platform}
						disabled={isDisabled}
						aria-labelledby={platformLabelId}
						className="w-full"
						onValueChange={(value) => {
							// Radix sends an empty value when the user clicks the chosen item again. The choice then stays.
							const parsed = desktopPlatformSchema.safeParse(value);
							if (parsed.success) setChosenPlatform(parsed.data);
						}}
					>
						{buildablePlatforms.map((option) => {
							const OptionIcon = PLATFORM_ICON[option];
							return (
								<ToggleGroupItem
									key={option}
									value={option}
									className="flex-1 rounded-full"
								>
									<OptionIcon
										data-icon="inline-start"
										aria-hidden
										weight="fill"
									/>
									{t(`appBuilder.desktopBuilds.platforms.${option}`)}
								</ToggleGroupItem>
							);
						})}
					</ToggleGroup>
				</div>
			) : null}
			<Button
				type="submit"
				className={DESTINATION_ACTION_CLASS}
				disabled={isDisabled || isProductNameInvalid}
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
				{isRetryOfLastPlatform
					? t("appBuilder.desktopBuilds.retry", priceParams)
					: t("appBuilder.desktopBuilds.build", priceParams)}
			</Button>
		</form>
	);
}

/**
 * One build of the list: the version, the platform, the status or the
 * Current chip, the time and the notes, then Download and Release for a
 * ready build. A ready build older than the current build of its platform
 * shows Rebuild in place of Release.
 */
function BuildRow({
	build,
	isOlderThanCurrent,
	isPlatformBuildable,
	isReleasing,
	isBuildDisabled,
	onRelease,
	onBuild,
}: {
	build: DesktopBuild;
	/** True when the current build of the same platform is newer, from isOlderThanCurrentBuild. The row then offers Rebuild, not Release. */
	isOlderThanCurrent: boolean;
	/** True when buildablePlatforms of the overview holds the platform of this build. False for macOS while staff turn macOS builds off. */
	isPlatformBuildable: boolean;
	/** True while a release request runs. */
	isReleasing: boolean;
	/** True while a build is live, the create request runs, or staff suspend the app. Rebuild is disabled then. */
	isBuildDisabled: boolean;
	onRelease: (buildId: string) => void;
	onBuild: DesktopBuildCardProps["onBuild"];
}) {
	const { t, locale } = useTranslation();
	const isReady = build.status === "ready";
	const versionParams = { version: build.version };
	const rebuildParams = {
		...versionParams,
		count: DESKTOP_BUILD_CREDITS,
		countDisplay: formatNumber(DESKTOP_BUILD_CREDITS, locale),
	};

	return (
		<li className={cn(HISTORY_ROW_CLASS, "py-1.5")}>
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					{/* A version reads left to right in every locale. */}
					<span
						dir="ltr"
						className="font-mono text-[12.5px] text-popover-foreground/85"
					>
						{build.version}
					</span>
					<PlatformBadge platform={build.platform} />
					{build.isCurrent ? (
						<span
							className={cn(CHIP_CLASS, "bg-success/[0.12] text-success-text")}
						>
							{t("appBuilder.desktopBuilds.current")}
						</span>
					) : (
						<span className={cn(CHIP_CLASS, STATUS_CHIP_CLASS[build.status])}>
							{t(`appBuilder.desktopBuilds.status.${build.status}`)}
						</span>
					)}
				</div>
				<p className="mt-0.5 truncate text-popover-foreground/50 text-xs">
					{formatRelativeTime(build.completedAt ?? build.createdAt, locale)}
					{build.notes ? (
						<>
							{" · "}
							<span dir="auto">{build.notes}</span>
						</>
					) : null}
				</p>
			</div>
			{isReady && build.installerUrl ? (
				<IconAction
					label={t("appBuilder.desktopBuilds.download", versionParams)}
				>
					{/* `download` forces a save only for a same-origin URL. The R2 URL opens in a new tab instead. */}
					<a
						href={build.installerUrl}
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
					</a>
				</IconAction>
			) : null}
			{/* Installed apps accept only a newer version, so an older build ships again as a new build. A rebuild needs no installer. The API refuses a rebuild of a platform that it does not build now. */}
			{isReady && isOlderThanCurrent && isPlatformBuildable ? (
				<AlertDialog>
					<AlertDialogTrigger asChild>
						<button
							type="button"
							disabled={isBuildDisabled}
							className={HISTORY_ACTION_CLASS}
						>
							<ArrowClockwiseIcon
								aria-hidden
								weight="bold"
								className="size-3.5"
							/>
							{t("appBuilder.desktopBuilds.rebuild")}
						</button>
					</AlertDialogTrigger>
					{/* A rebuild costs credits, so the owner confirms it first. */}
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>
								{t("appBuilder.desktopBuilds.rebuildTitle", versionParams)}
							</AlertDialogTitle>
							<AlertDialogDescription>
								{t("appBuilder.desktopBuilds.rebuildBody", rebuildParams)}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>
								{t("appBuilder.desktopBuilds.confirmCancel")}
							</AlertDialogCancel>
							<AlertDialogAction
								// The API takes only the commit of the old build, so the body names its platform.
								onClick={() =>
									onBuild({
										platform: build.platform,
										rebuildOfBuildId: build.id,
									})
								}
							>
								{t("appBuilder.desktopBuilds.rebuild")}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			) : null}
			{/* A suspend clears every installer, and the API refuses to release a build with none. */}
			{isReady &&
			!build.isCurrent &&
			!isOlderThanCurrent &&
			build.installerUrl !== null ? (
				<AlertDialog>
					<AlertDialogTrigger asChild>
						<button
							type="button"
							disabled={isReleasing}
							className={HISTORY_ACTION_CLASS}
						>
							<RocketLaunchIcon
								aria-hidden
								weight="bold"
								className="size-3.5"
							/>
							{t("appBuilder.desktopBuilds.release")}
						</button>
					</AlertDialogTrigger>
					{/* Every installed app follows a release at its next start, so the owner confirms it first. */}
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>
								{t("appBuilder.desktopBuilds.releaseTitle", versionParams)}
							</AlertDialogTitle>
							<AlertDialogDescription>
								{t("appBuilder.desktopBuilds.releaseBody", versionParams)}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>
								{t("appBuilder.desktopBuilds.confirmCancel")}
							</AlertDialogCancel>
							<AlertDialogAction onClick={() => onRelease(build.id)}>
								{t("appBuilder.desktopBuilds.release")}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			) : null}
		</li>
	);
}
