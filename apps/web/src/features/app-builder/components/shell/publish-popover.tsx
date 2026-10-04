/**
 * Publish button of the top bar and its popover. Rendered by components/shell/top-bar.tsx.
 * A web app shows its publish status (appPublishQuery, WANDIT-178) with Publish,
 * Unpublish, and Roll back. A mobile app shows the Android APK card of
 * android-build-card.tsx (mobileBuildsQuery, WANDIT-194), and "Show QR" opens
 * the Expo Go panel of expo-go-popover.tsx under its row. The spec renders the pure *Targets parts.
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

// The popover shows the five newest earlier versions; older ones stay in the API answer.
const HISTORY_ROWS = 5;
// Seven characters name a commit, like `git log --oneline`.
const SHORT_SHA_LENGTH = 7;

export type PublishPopoverProps = {
	/** The open project, from appProjectQuery in the page. Sets the kind, the name, and the version line. */
	project: AppProject;
};

/** Each body loads its data when the popover opens and shows a skeleton until then, so the top bar never waits. */
export function PublishPopover({ project }: PublishPopoverProps) {
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
	onNavigate,
}: {
	projectId: string;
	/** Closes the popover before the view changes under it. */
	onNavigate: () => void;
}) {
	const navigate = useNavigate({ from: "/app/$projectId" });
	const publishStatus = useQuery(appPublishQuery(projectId));
	const publish = usePublishApp(projectId);
	const rollback = useRollbackApp(projectId);
	const unpublish = useUnpublishApp(projectId);

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
			isSending={publish.isPending || rollback.isPending || unpublish.isPending}
			// A new key per click. A second click while a publish runs gets 409 PUBLISH_ACTIVE.
			onPublish={() => publish.mutate(crypto.randomUUID())}
			onRollback={(deploymentId) => rollback.mutate(deploymentId)}
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

export type PublishWebTargetsProps = {
	/** The publish status of the project, from appPublishQuery. */
	status: AppPublishStatus;
	/** True while a publish, rollback, or unpublish request runs. The actions are disabled then. */
	isSending: boolean;
	/** Publishes the saved head of the app, or updates the live app. */
	onPublish: () => void;
	/** Puts the earlier deployment with this id live again. */
	onRollback: (deploymentId: string) => void;
	/** Takes the live app down. */
	onUnpublish: () => void;
	/** Opens the Domains panel of the More view. */
	onConnectDomain: () => void;
};

/**
 * The web row with its Live badge or the running step, the failure text,
 * the live link with Unpublish, the earlier versions with Roll back, and
 * the custom domain footer.
 */
export function PublishWebTargets({
	status,
	isSending,
	onPublish,
	onRollback,
	onUnpublish,
	onConnectDomain,
}: PublishWebTargetsProps) {
	const { t, locale } = useTranslation();
	const { live, latestBuild } = status;
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

	return (
		<>
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
				<Button size="sm" disabled={isBusy} onClick={onPublish}>
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
									disabled={isBusy}
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
