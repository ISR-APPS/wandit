/**
 * Publish button of the top bar and its popover. Rendered by components/shell/top-bar.tsx.
 * A web app shows its publish status (appPublishQuery, WANDIT-178) with Publish,
 * Unpublish, Roll back, the gate findings of publish-gate-findings.tsx, "Publish
 * anyway" (WANDIT-190), and a staff suspension (WANDIT-181). A mobile app shows the
 * Android APK card of android-build-card.tsx (mobileBuildsQuery, WANDIT-194), and
 * "Show QR" opens the Expo Go panel of expo-go-popover.tsx under its row. The
 * spec renders the pure *Targets parts.
 */

import type { Icon } from "@phosphor-icons/react";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/ArrowCounterClockwise";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/ArrowSquareOut";
import { CaretDownIcon } from "@phosphor-icons/react/CaretDown";
import { CaretRightIcon } from "@phosphor-icons/react/CaretRight";
import { CircleNotchIcon } from "@phosphor-icons/react/CircleNotch";
import { CloudCheckIcon } from "@phosphor-icons/react/CloudCheck";
import { GlobeIcon } from "@phosphor-icons/react/Globe";
import { LinkSimpleIcon } from "@phosphor-icons/react/LinkSimple";
import { QrCodeIcon } from "@phosphor-icons/react/QrCode";
import { RocketLaunchIcon } from "@phosphor-icons/react/RocketLaunch";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { AppPublishStatus } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@wandit/ui/components/popover";
import { Skeleton } from "@wandit/ui/components/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { type ReactNode, useId, useState } from "react";

import { getApiErrorMessage } from "@/lib/api-client";
import { formatNumber, formatRelativeTime, useTranslation } from "@/lib/i18n";
import type { AppProject } from "../../api/dto";
import {
	useCancelMobileBuild,
	useCreateMobileBuild,
} from "../../api/mobile-builds.mutations";
import { mobileBuildsQuery } from "../../api/mobile-builds.queries";
import {
	useOverridePublishGate,
	usePublishApp,
	useRollbackApp,
	useUnpublishApp,
} from "../../api/publish.mutations";
import {
	appPublishQuery,
	LIVE_PUBLISH_STATUSES,
} from "../../api/publish.queries";
import {
	AndroidBuildCard,
	type AndroidBuildCardProps,
	DESTINATION_ACTION_CLASS,
	DestinationCard,
	DestinationError,
	HISTORY_ACTION_CLASS,
	HISTORY_ROW_CLASS,
	HistoryList,
} from "./android-build-card";
import { ExpoGoPanel } from "./expo-go-popover";
import {
	GATE_ACTION_CLASS,
	PublishGateFindings,
} from "./publish-gate-findings";

// The popover shows the five newest earlier versions; older ones stay in the API answer.
const HISTORY_ROWS = 5;
// Seven characters name a commit, like `git log --oneline`.
const SHORT_SHA_LENGTH = 7;

/** Props of the top bar Publish button. WorkBar in top-bar.tsx passes them from the page. */
export type PublishPopoverProps = {
	/** The open project, from appProjectQuery in the page. Sets the kind, the name, and the version line. */
	project: AppProject;
	/** True when the chat can take a message: its history loaded and no turn sends. From useBuilderThread in the page. */
	canAskFix: boolean;
	/** Sends one chat message through `thread.send` of the page. "Ask the AI to fix" lists the gate findings in it. */
	onAskFix: (text: string) => void;
};

/** Each body loads its data when the popover opens and shows a skeleton until then, so the top bar never waits. */
export function PublishPopover({
	project,
	canAskFix,
	onAskFix,
}: PublishPopoverProps) {
	const { t, locale } = useTranslation();
	// Controlled, so a link to another view can close the popover before the view changes.
	const [open, setOpen] = useState(false);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<Tooltip>
				<TooltipTrigger asChild>
					<PopoverTrigger asChild>
						{/* On a phone only the rocket shows, so the pill becomes a 36 px circle. */}
						{/* The open look keys on aria-expanded: the tooltip on this button overwrites data-state. */}
						<Button
							aria-label={t("appBuilder.publish.cta")}
							className="group/publish h-9 gap-1.5 rounded-full font-grotesk font-semibold has-[>svg]:px-2.5 aria-expanded:bg-primary/90 sm:has-[>svg]:px-4"
						>
							<RocketLaunchIcon aria-hidden weight="fill" className="size-4" />
							<span className="hidden sm:inline">
								{t("appBuilder.publish.cta")}
							</span>
							<CaretDownIcon
								aria-hidden
								weight="bold"
								className="hidden size-3.5 opacity-75 transition-transform duration-200 group-aria-expanded/publish:rotate-180 motion-reduce:transition-none sm:block"
							/>
						</Button>
					</PopoverTrigger>
				</TooltipTrigger>
				{/* From sm the pill shows its label, so the tooltip names only the bare rocket. */}
				<TooltipContent side="bottom" className="sm:hidden">
					{t("appBuilder.publish.cta")}
				</TooltipContent>
			</Tooltip>
			{/* 380 px like the design. On a phone it keeps 12 px from each edge. The open QR panel can pass the screen height, so the content scrolls. */}
			<PopoverContent
				align="end"
				className="scroll-warm max-h-(--radix-popover-content-available-height) w-[380px] max-w-[calc(100vw-24px)] overflow-y-auto p-0"
			>
				<header className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
					<div className="min-w-0">
						<h2 className="font-grotesk font-semibold text-base leading-tight">
							{t("appBuilder.publish.cta")}
						</h2>
						<p
							className="mt-0.5 w-fit max-w-full truncate text-[13px] text-popover-foreground/55"
							dir="auto"
						>
							{project.name}
						</p>
					</div>
					<span className="inline-flex h-6 shrink-0 items-center rounded-full bg-popover-foreground/[0.05] px-2.5 font-grotesk font-medium text-popover-foreground/65 text-xs tabular-nums">
						{t("appBuilder.publish.version", {
							version: formatNumber(project.versionNumber, locale),
						})}
						{" · "}
						{t("appBuilder.publish.changes", {
							count: project.unpublishedChanges,
							countDisplay: formatNumber(project.unpublishedChanges, locale),
						})}
					</span>
				</header>
				{project.kind === "web" ? (
					<PublishWebBody
						projectId={project.id}
						canAskFix={canAskFix}
						onAskFix={(text) => {
							onAskFix(text);
							// The reply shows in the chat, so the popover gets out of the way.
							setOpen(false);
						}}
						onNavigate={() => setOpen(false)}
					/>
				) : (
					<PublishMobileBody projectId={project.id} />
				)}
			</PopoverContent>
		</Popover>
	);
}

/** Reads the publish status and wires the web actions. Connect one opens the Domains panel. */
function PublishWebBody({
	projectId,
	canAskFix,
	onAskFix,
	onNavigate,
}: Pick<PublishWebTargetsProps, "canAskFix" | "onAskFix"> & {
	/** Route param of the open project. */
	projectId: string;
	/** Closes the popover before the view changes under it. */
	onNavigate: () => void;
}) {
	const navigate = useNavigate({ from: "/app/$projectId" });
	const publishStatus = useQuery(appPublishQuery(projectId));
	const publish = usePublishApp(projectId);
	const rollback = useRollbackApp(projectId);
	const unpublish = useUnpublishApp(projectId);
	const override = useOverridePublishGate(projectId);

	// A failed poll keeps the last status on screen. Only a first load without a status shows the error.
	if (publishStatus.data === undefined) {
		return (
			<BodyPlaceholder
				errorText={
					publishStatus.isError ? getApiErrorMessage(publishStatus.error) : null
				}
			/>
		);
	}

	return (
		<PublishWebTargets
			status={publishStatus.data}
			// "Publish anyway" queues a new build too, so the pill spins for it.
			isPublishPending={
				publish.isPending || rollback.isPending || override.isPending
			}
			isUnpublishPending={unpublish.isPending}
			canAskFix={canAskFix}
			onAskFix={onAskFix}
			// A new key per click. A second click while a publish runs gets 409 PUBLISH_ACTIVE.
			onPublish={() => publish.mutate(crypto.randomUUID())}
			onRollback={(deploymentId) => rollback.mutate(deploymentId)}
			onOverride={(buildId) => override.mutate(buildId)}
			onUnpublish={() => unpublish.mutate()}
			onConnectDomain={() => {
				onNavigate();
				void navigate({
					search: (prev) => ({ ...prev, view: "more", panel: "domains" }),
				});
			}}
		/>
	);
}

/** The skeleton of a destination card while the first read runs, or the API error when it failed. */
function BodyPlaceholder({ errorText }: { errorText: string | null }) {
	return (
		<div className="px-3 pb-3">
			{errorText === null ? (
				<Skeleton className="h-[132px] rounded-[20px]" />
			) : (
				<DestinationError text={errorText} />
			)}
		</div>
	);
}

/** What the web targets show and do. PublishWebBody fills it; the spec passes plain values. */
export type PublishWebTargetsProps = {
	/** The publish status of the project, from appPublishQuery. */
	status: AppPublishStatus;
	/** True while a publish, a rollback, or a "Publish anyway" request runs. The actions are disabled and the Publish pill spins. */
	isPublishPending: boolean;
	/** True while an unpublish request runs. The actions are disabled, with no spinner. */
	isUnpublishPending: boolean;
	/** True when the chat can take a message. "Ask the AI to fix" is disabled otherwise. */
	canAskFix: boolean;
	/** Sends the "Ask the AI to fix" chat message and closes the popover. */
	onAskFix: (text: string) => void;
	/** Publishes the saved head of the app, or updates the live app. */
	onPublish: () => void;
	/** Puts the earlier deployment with this id live again. */
	onRollback: (deploymentId: string) => void;
	/** "Publish anyway": builds the blocked attempt with this id again past its overridable findings. */
	onOverride: (buildId: string) => void;
	/** Takes the live app down. */
	onUnpublish: () => void;
	/** Opens the Domains panel of the More view. */
	onConnectDomain: () => void;
};

/**
 * The suspension notice, then the web destination card with its Live chip
 * or the running step, the failure text, the gate findings with "Publish
 * anyway", and the live link with Unpublish. Then the earlier versions with
 * Roll back, and the custom domain row at the foot.
 */
export function PublishWebTargets({
	status,
	isPublishPending,
	isUnpublishPending,
	canAskFix,
	onAskFix,
	onPublish,
	onRollback,
	onOverride,
	onUnpublish,
	onConnectDomain,
}: PublishWebTargetsProps) {
	const { t, locale } = useTranslation();
	const { live, latestBuild, suspension } = status;
	const runningBuild =
		latestBuild && LIVE_PUBLISH_STATUSES.has(latestBuild.status)
			? latestBuild
			: null;
	const failedBuild =
		latestBuild?.status === "failed" || latestBuild?.status === "blocked"
			? latestBuild
			: null;
	// Only a row that was live once can come back. The live row is the web card itself.
	const earlierDeployments = status.history
		.filter(
			(deployment) =>
				deployment.status === "superseded" ||
				deployment.status === "unpublished",
		)
		.slice(0, HISTORY_ROWS);
	// The pill spins while a publish, a rollback, or an override request runs, and while the build it queued runs.
	const isPublishing = isPublishPending || runningBuild !== null;
	// One publish runs at a time, so every action waits for the running one. An unpublish blocks them too.
	const isBusy = isPublishing || isUnpublishPending;
	// A suspended app cannot go live again. The API also answers 403 PROJECT_SUSPENDED.
	const isPublishDisabled = isBusy || suspension !== null;

	return (
		<>
			<div className="flex flex-col gap-3 px-3 pb-3">
				{suspension ? (
					<DestinationError
						text={t("appBuilder.publish.suspension", {
							reason: t(
								`appBuilder.publish.suspensionReasons.${suspension.reasonCode}`,
							),
						})}
					/>
				) : null}
				<DestinationCard
					icon={GlobeIcon}
					tone={runningBuild ? "busy" : live ? "live" : "idle"}
					title={t("appBuilder.publish.web")}
					badge={live && !runningBuild ? <LiveChip /> : null}
					status={
						runningBuild ? (
							t(`appBuilder.publish.status.${runningBuild.status}`)
						) : live ? (
							// A host reads left to right in every locale.
							<span dir="ltr" className="font-mono text-[12px]">
								{new URL(live.url).host}
							</span>
						) : (
							t("appBuilder.publish.notLive")
						)
					}
				>
					{failedBuild ? (
						// The contract allows a failed row without a code. The generic `internal` text covers it.
						<DestinationError
							text={t(
								`appBuilder.publish.errors.${failedBuild.errorCode ?? "internal"}`,
							)}
						/>
					) : null}
					{latestBuild && latestBuild.gateFindings.length > 0 ? (
						<PublishGateFindings
							findings={latestBuild.gateFindings}
							isOverride={latestBuild.gateOverride}
							canAskFix={canAskFix}
							onAskFix={onAskFix}
						/>
					) : null}
					{/* The API sets the flag for the project creator when every block finding is overridable. */}
					{latestBuild && status.gateOverrideAllowed ? (
						<div className="flex items-center gap-3">
							<p className="min-w-0 flex-1 text-[12.5px] text-spark-deep leading-snug dark:text-spark">
								{t("appBuilder.publish.findings.overrideWarning")}
							</p>
							<Button
								variant="outline"
								size="sm"
								className={GATE_ACTION_CLASS}
								disabled={isPublishDisabled}
								onClick={() => onOverride(latestBuild.id)}
							>
								{t("appBuilder.publish.findings.override")}
							</Button>
						</div>
					) : null}
					<Button
						className={DESTINATION_ACTION_CLASS}
						disabled={isPublishDisabled}
						onClick={onPublish}
					>
						{isPublishing ? (
							<CircleNotchIcon
								aria-hidden
								weight="bold"
								className="animate-spin motion-reduce:animate-none"
							/>
						) : (
							<RocketLaunchIcon aria-hidden weight="fill" />
						)}
						{t(
							live
								? "appBuilder.publish.update"
								: "appBuilder.publish.publishNow",
						)}
					</Button>
					{runningBuild ? (
						<p className="text-center text-popover-foreground/55 text-xs">
							{t("appBuilder.publish.liveHint")}
						</p>
					) : null}
					{live ? (
						<div className="flex items-center justify-between gap-3 ps-1">
							<a
								href={live.url}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1.5 rounded-full font-grotesk font-medium text-[13px] text-ember-text underline-offset-2 hover:underline"
							>
								{t("appBuilder.publish.open")}
								<ArrowSquareOutIcon
									aria-hidden
									weight="bold"
									className="size-3.5 rtl:-scale-x-100"
								/>
							</a>
							<button
								type="button"
								disabled={isBusy}
								onClick={onUnpublish}
								className="h-7 rounded-full px-2.5 font-grotesk font-medium text-destructive/85 text-xs transition-colors hover:bg-destructive/[0.08] hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
							>
								{t("appBuilder.publish.unpublish")}
							</button>
						</div>
					) : null}
				</DestinationCard>
				{earlierDeployments.length > 0 ? (
					<HistoryList label={t("appBuilder.publish.history")}>
						{earlierDeployments.map((deployment) => (
							<li key={deployment.id} className={HISTORY_ROW_CLASS}>
								{/* A commit id reads left to right in every locale. */}
								<span
									dir="ltr"
									className="shrink-0 rounded-md bg-popover-foreground/[0.05] px-1.5 py-0.5 font-mono text-[11.5px] text-popover-foreground/75"
								>
									{deployment.commitSha.slice(0, SHORT_SHA_LENGTH)}
								</span>
								<span className="min-w-0 flex-1 truncate text-[13px]">
									<span className="font-grotesk font-medium text-popover-foreground/85">
										{t(
											`appBuilder.publish.deploymentStatus.${deployment.status}`,
										)}
									</span>
									<span className="text-popover-foreground/50">
										{" · "}
										{formatRelativeTime(deployment.createdAt, locale)}
									</span>
								</span>
								<button
									type="button"
									disabled={isPublishDisabled}
									onClick={() => onRollback(deployment.id)}
									className={HISTORY_ACTION_CLASS}
								>
									<ArrowCounterClockwiseIcon
										aria-hidden
										weight="bold"
										className="size-3.5"
									/>
									{t("appBuilder.publish.rollback")}
								</button>
							</li>
						))}
					</HistoryList>
				) : null}
			</div>
			<FooterRow
				icon={LinkSimpleIcon}
				title={t("appBuilder.publish.customDomain")}
				action={t("appBuilder.publish.connectOne")}
				onClick={onConnectDomain}
			/>
		</>
	);
}

/** The green "Live" chip after the title of a live web card. */
function LiveChip() {
	const { t } = useTranslation();
	return (
		<span className="inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full bg-success/[0.12] px-2 font-grotesk font-semibold text-[11px] text-success-text">
			<span aria-hidden className="size-1.5 rounded-full bg-success" />
			{t("appBuilder.publish.live")}
		</span>
	);
}

/**
 * Reads the Android builds and wires the mobile actions. The builds poll
 * only while this body is mounted. "Show QR" opens the Expo Go panel under
 * its row; the next open of the popover starts closed again.
 */
function PublishMobileBody({
	projectId,
}: {
	/** Route param of the open project. */
	projectId: string;
}) {
	const builds = useQuery(mobileBuildsQuery(projectId));
	const createBuild = useCreateMobileBuild(projectId);
	const cancelBuild = useCancelMobileBuild(projectId);
	const [isQrOpen, setIsQrOpen] = useState(false);

	// A failed poll keeps the last list on screen. Only a first load without a list shows the error.
	if (builds.data === undefined) {
		return (
			<BodyPlaceholder
				errorText={builds.isError ? getApiErrorMessage(builds.error) : null}
			/>
		);
	}

	return (
		<PublishMobileTargets
			isQrOpen={isQrOpen}
			onToggleQr={() => setIsQrOpen((open) => !open)}
			// Each mount of the panel mints a new phone link, so it mounts only while open.
			qrPanel={isQrOpen ? <ExpoGoPanel projectId={projectId} /> : null}
			android={{
				builds: builds.data.items,
				isStarting: createBuild.isPending,
				isCanceling: cancelBuild.isPending,
				// A new key per click. A second click while a build is live gets 409 MOBILE_BUILD_ACTIVE.
				onBuild: () => createBuild.mutate(crypto.randomUUID()),
				onCancel: (buildId) => cancelBuild.mutate(buildId),
			}}
		/>
	);
}

/** What the mobile targets show and do. PublishMobileBody fills it; the spec passes plain values. */
export type PublishMobileTargetsProps = {
	/** True while the Expo Go panel shows under the test-on-phone row. */
	isQrOpen: boolean;
	/** Shows or hides the Expo Go panel. */
	onToggleQr: () => void;
	/** The Expo Go panel with the QR code, or null while it is closed. */
	qrPanel: ReactNode;
	/** Builds and actions of the Android APK card. */
	android: AndroidBuildCardProps;
};

/**
 * The Android APK card, the backend note, and the test-on-phone row with
 * the Expo Go panel under it. No iOS row until WANDIT-284 builds iOS: a row
 * with mock testers misled users.
 */
export function PublishMobileTargets({
	isQrOpen,
	onToggleQr,
	qrPanel,
	android,
}: PublishMobileTargetsProps) {
	const { t } = useTranslation();

	return (
		<>
			<div className="flex flex-col gap-2.5 px-3 pb-3">
				<AndroidBuildCard {...android} />
				<p className="flex items-center gap-1.5 px-1 text-popover-foreground/55 text-xs">
					<CloudCheckIcon
						aria-hidden
						weight="duotone"
						className="size-4 shrink-0 text-popover-foreground/45"
					/>
					{t("appBuilder.publish.backendNote")}
				</p>
			</div>
			<FooterRow
				icon={QrCodeIcon}
				title={t("appBuilder.publish.testOnPhone")}
				note={t("appBuilder.publish.scanQr")}
				action={
					isQrOpen
						? t("appBuilder.publish.hideQr")
						: t("appBuilder.publish.showQr")
				}
				isExpanded={isQrOpen}
				onClick={onToggleQr}
			/>
			{isQrOpen ? (
				<div className="px-3 pb-3">
					<div className="rounded-[20px] border border-popover-foreground/[0.08] bg-paper p-3.5 dark:bg-white/[0.03]">
						{qrPanel}
					</div>
				</div>
			) : null}
		</>
	);
}

/**
 * The one row button at the foot of the popover, under a hairline: medallion,
 * title, note, and the action word. The action word is the accessible name;
 * the title and the note describe it.
 */
function FooterRow({
	icon: RowIcon,
	title,
	note,
	action,
	isExpanded,
	onClick,
}: {
	icon: Icon;
	title: string;
	/** A second line under the title. */
	note?: string;
	/** The ember word at the end, for example "Connect one". */
	action: string;
	/** Set only on a row that shows or hides a panel under it. True while the panel shows. */
	isExpanded?: boolean;
	onClick: () => void;
}) {
	const textId = useId();

	return (
		<div className="border-popover-foreground/[0.07] border-t p-1.5">
			<button
				type="button"
				aria-label={action}
				aria-describedby={textId}
				aria-expanded={isExpanded}
				onClick={onClick}
				className="group/footer flex w-full items-center gap-3 rounded-[14px] px-2.5 py-2 text-start outline-none transition-colors hover:bg-popover-foreground/[0.05] focus-visible:bg-popover-foreground/[0.05] focus-visible:ring-2 focus-visible:ring-ring/50"
			>
				<span
					aria-hidden
					className="grid size-8 shrink-0 place-items-center rounded-full bg-popover-foreground/[0.05] text-popover-foreground/60 transition-colors group-hover/footer:text-primary"
				>
					<RowIcon weight="duotone" className="size-[18px]" />
				</span>
				<span id={textId} className="min-w-0 flex-1">
					<span className="block truncate font-grotesk font-medium text-sm">
						{title}
					</span>
					{note ? (
						<span className="block truncate text-popover-foreground/55 text-xs">
							{note}
						</span>
					) : null}
				</span>
				<span className="shrink-0 font-grotesk font-medium text-[13px] text-ember-text">
					{action}
				</span>
				<CaretRightIcon
					aria-hidden
					weight="bold"
					className="size-3.5 shrink-0 text-popover-foreground/40 rtl:-scale-x-100"
				/>
			</button>
		</div>
	);
}
