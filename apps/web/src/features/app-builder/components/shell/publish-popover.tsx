/**
 * Publish button of the top bar and its popover. Rendered by components/shell/top-bar.tsx.
 * A web app shows its publish status (appPublishQuery, WANDIT-178) with Publish,
 * Unpublish, Roll back, the gate findings of publish-gate-findings.tsx, "Publish
 * anyway" (WANDIT-190), and a staff suspension (WANDIT-181). A mobile app shows the
 * Android APK card of android-build-card.tsx (mobileBuildsQuery, WANDIT-194), and
 * "Show QR" opens the Expo Go panel of expo-go-popover.tsx under its row. The
 * spec renders the pure *Targets parts.
 */

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { AppPublishStatus } from "@wandit/contracts";
import { Badge } from "@wandit/ui/components/badge";
import { Button } from "@wandit/ui/components/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@wandit/ui/components/popover";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
import {
	ArrowUp,
	ChevronDown,
	Globe,
	LoaderCircle,
	type LucideIcon,
	Zap,
} from "lucide-react";
import { type ReactNode, useState } from "react";

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
} from "./android-build-card";
import { ExpoGoPanel } from "./expo-go-popover";
import { PublishGateFindings } from "./publish-gate-findings";

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
	// Controlled, so a link to a More panel can close the popover before the view changes.
	const [open, setOpen] = useState(false);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button size="sm" aria-label={t("appBuilder.publish.cta")}>
					<ArrowUp className="size-3.5" />
					<span className="hidden sm:inline">
						{t("appBuilder.publish.cta")}
					</span>
					<ChevronDown className="hidden size-3.5 sm:block" />
				</Button>
			</PopoverTrigger>
			{/* 360 px like the design. On a phone it keeps 12 px from each edge. The open QR panel can pass the screen height, so the content scrolls. */}
			<PopoverContent
				align="end"
				className="flex max-h-(--radix-popover-content-available-height) w-[360px] max-w-[calc(100vw-24px)] flex-col gap-3 overflow-y-auto p-4"
			>
				<div className="flex items-baseline justify-between gap-3">
					<span className="truncate font-semibold text-sm" dir="auto">
						{t("appBuilder.publish.title", { name: project.name })}
					</span>
					<span className="shrink-0 text-muted-foreground text-xs">
						{t("appBuilder.publish.version", {
							version: formatNumber(project.versionNumber, locale),
						})}
						{" · "}
						{t("appBuilder.publish.changes", {
							count: project.unpublishedChanges,
							countDisplay: formatNumber(project.unpublishedChanges, locale),
						})}
					</span>
				</div>
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
		return publishStatus.isError ? (
			<p className="text-muted-foreground text-sm">
				{getApiErrorMessage(publishStatus.error)}
			</p>
		) : (
			<Skeleton className="h-16" />
		);
	}

	return (
		<PublishWebTargets
			status={publishStatus.data}
			isSending={
				publish.isPending ||
				rollback.isPending ||
				unpublish.isPending ||
				override.isPending
			}
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

/** What the web targets show and do. PublishWebBody fills it; the spec passes plain values. */
export type PublishWebTargetsProps = {
	/** The publish status of the project, from appPublishQuery. */
	status: AppPublishStatus;
	/** True while a publish, rollback, override, or unpublish request runs. The actions are disabled then. */
	isSending: boolean;
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
 * The suspension box, the web row with its Live badge or the running step,
 * the failure text, the gate findings with "Publish anyway", the live link
 * with Unpublish, the earlier versions with Roll back, and the custom
 * domain footer.
 */
export function PublishWebTargets({
	status,
	isSending,
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
	// Only a row that was live once can come back. The live row is the web row itself.
	const earlierDeployments = status.history
		.filter(
			(deployment) =>
				deployment.status === "superseded" ||
				deployment.status === "unpublished",
		)
		.slice(0, HISTORY_ROWS);
	// One publish runs at a time, so every action waits for the running one.
	const isBusy = isSending || runningBuild !== null;
	// A suspended app cannot go live again. The API also answers 403 PROJECT_SUSPENDED.
	const isPublishDisabled = isBusy || suspension !== null;

	return (
		<>
			{suspension ? (
				<p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-destructive text-xs">
					{t("appBuilder.publish.suspension", {
						reason: t(
							`appBuilder.publish.suspensionReasons.${suspension.reasonCode}`,
						),
					})}
				</p>
			) : null}
			<TargetRow
				icon={runningBuild ? LoaderCircle : Globe}
				iconClassName={runningBuild ? "animate-spin" : undefined}
				title={t("appBuilder.publish.web")}
				note={
					runningBuild
						? t(`appBuilder.publish.status.${runningBuild.status}`)
						: live
							? new URL(live.url).host
							: t("appBuilder.publish.notLive")
				}
			>
				{live && !runningBuild ? (
					<Badge variant="success">
						<span aria-hidden className="size-1.5 rounded-full bg-success" />
						{t("appBuilder.publish.live")}
					</Badge>
				) : null}
				<Button size="sm" disabled={isPublishDisabled} onClick={onPublish}>
					{t(
						live
							? "appBuilder.publish.update"
							: "appBuilder.publish.publishNow",
					)}
				</Button>
			</TargetRow>
			{runningBuild ? (
				<p className="text-muted-foreground text-xs">
					{t("appBuilder.publish.liveHint")}
				</p>
			) : null}
			{failedBuild ? (
				<p className="text-destructive text-xs">
					{/* The contract allows a failed row without a code. The generic `internal` text covers it. */}
					{t(
						`appBuilder.publish.errors.${failedBuild.errorCode ?? "internal"}`,
					)}
				</p>
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
					<p className="flex-1 text-orange-600 text-xs dark:text-orange-400">
						{t("appBuilder.publish.findings.overrideWarning")}
					</p>
					<Button
						variant="outline"
						size="sm"
						disabled={isPublishDisabled}
						onClick={() => onOverride(latestBuild.id)}
					>
						{t("appBuilder.publish.findings.override")}
					</Button>
				</div>
			) : null}
			{live ? (
				<div className="flex items-center justify-between gap-3 text-xs">
					<a
						href={live.url}
						target="_blank"
						rel="noopener noreferrer"
						className="text-primary hover:underline"
					>
						{t("appBuilder.publish.open")}
					</a>
					<button
						type="button"
						disabled={isBusy}
						onClick={onUnpublish}
						className="text-destructive hover:underline disabled:opacity-50"
					>
						{t("appBuilder.publish.unpublish")}
					</button>
				</div>
			) : null}
			{earlierDeployments.length > 0 ? (
				<div className="flex flex-col gap-1 border-t pt-2">
					<div className="text-muted-foreground text-xs">
						{t("appBuilder.publish.history")}
					</div>
					<ul className="flex flex-col gap-1">
						{earlierDeployments.map((deployment) => (
							<li
								key={deployment.id}
								className="flex items-center gap-2 text-xs"
							>
								<span className="min-w-0 flex-1 truncate">
									{/* A commit id reads left to right in every locale. */}
									<span dir="ltr" className="font-mono">
										{deployment.commitSha.slice(0, SHORT_SHA_LENGTH)}
									</span>
									{" · "}
									{t(
										`appBuilder.publish.deploymentStatus.${deployment.status}`,
									)}
									{" · "}
									{formatRelativeTime(deployment.createdAt, locale)}
								</span>
								<button
									type="button"
									disabled={isPublishDisabled}
									onClick={() => onRollback(deployment.id)}
									className="text-primary hover:underline disabled:opacity-50"
								>
									{t("appBuilder.publish.rollback")}
								</button>
							</li>
						))}
					</ul>
				</div>
			) : null}
			<p className="text-muted-foreground text-xs">
				{t("appBuilder.publish.customDomain")}
				{" · "}
				<button
					type="button"
					className="text-primary hover:underline"
					onClick={onConnectDomain}
				>
					{t("appBuilder.publish.connectOne")}
				</button>
			</p>
		</>
	);
}

/**
 * Reads the Android builds and wires the mobile actions. The builds poll
 * only while this body is mounted. "Show QR" opens the Expo Go panel under
 * its row; the next open of the popover starts closed again.
 */
function PublishMobileBody({ projectId }: { projectId: string }) {
	const builds = useQuery(mobileBuildsQuery(projectId));
	const createBuild = useCreateMobileBuild(projectId);
	const cancelBuild = useCancelMobileBuild(projectId);
	const [isQrOpen, setIsQrOpen] = useState(false);

	// A failed poll keeps the last list on screen. Only a first load without a list shows the error.
	if (builds.data === undefined) {
		return builds.isError ? (
			<p className="text-muted-foreground text-sm">
				{getApiErrorMessage(builds.error)}
			</p>
		) : (
			<Skeleton className="h-16" />
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
 * The Android APK card, the test-on-phone row, and the backend footer. No
 * iOS row until WANDIT-284 builds iOS: a row with mock testers misled users.
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
			<AndroidBuildCard {...android} />
			<TargetRow
				icon={Zap}
				title={t("appBuilder.publish.testOnPhone")}
				note={t("appBuilder.publish.scanQr")}
			>
				<Button
					variant="outline"
					size="sm"
					aria-expanded={isQrOpen}
					onClick={onToggleQr}
				>
					{isQrOpen
						? t("appBuilder.publish.hideQr")
						: t("appBuilder.publish.showQr")}
				</Button>
			</TargetRow>
			{isQrOpen ? (
				<div className="flex flex-col gap-3 rounded-xl border bg-card p-3">
					{qrPanel}
				</div>
			) : null}
			<p className="text-muted-foreground text-xs">
				{t("appBuilder.publish.backendNote")}
			</p>
		</>
	);
}

/** One card row of the popover: icon, title, a note under it, and the action at the end. */
function TargetRow({
	icon: Icon,
	iconClassName,
	title,
	note,
	children,
}: {
	icon: LucideIcon;
	/** Extra classes of the icon, for example `animate-spin` on a loader. */
	iconClassName?: string;
	title: string;
	/** Host, build state, or hint. A host is user content, so `dir="auto"` sets its direction. */
	note: string;
	children: ReactNode;
}) {
	return (
		<div className="flex items-center gap-3 rounded-xl border bg-card p-3">
			<Icon
				aria-hidden
				className={cn("size-4 shrink-0 text-muted-foreground", iconClassName)}
			/>
			<div className="min-w-0 flex-1">
				<div className="font-medium text-sm">{title}</div>
				<div className="truncate text-muted-foreground text-xs" dir="auto">
					{note}
				</div>
			</div>
			{children}
		</div>
	);
}
