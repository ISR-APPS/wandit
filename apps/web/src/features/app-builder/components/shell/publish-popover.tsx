/**
 * Publish button of the top bar and its popover. Rendered by components/shell/top-bar.tsx.
 * A web app shows its Wandit domain row (projectDomainsQuery). A mobile app shows the
 * Android APK card of android-build-card.tsx (mobileBuildsQuery, WANDIT-194) and the iOS
 * row (appStoresSummaryQuery, a mock until WANDIT-284). The spec renders the pure *Targets parts.
 */

import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Badge } from "@wandit/ui/components/badge";
import { Button } from "@wandit/ui/components/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@wandit/ui/components/popover";
import { Skeleton } from "@wandit/ui/components/skeleton";
import {
	ArrowUp,
	ChevronDown,
	Globe,
	type LucideIcon,
	Smartphone,
	Zap,
} from "lucide-react";
import { type ReactNode, Suspense, useState } from "react";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/lib/api-client";
import { formatNumber, useTranslation } from "@/lib/i18n";
import {
	appStoresSummaryQuery,
	projectDomainsQuery,
} from "../../api/app-builder.queries";
import type {
	AppProject,
	AppStoresSummary,
	ProjectDomain,
} from "../../api/dto";
import {
	useCancelMobileBuild,
	useCreateMobileBuild,
} from "../../api/mobile-builds.mutations";
import { mobileBuildsQuery } from "../../api/mobile-builds.queries";
import {
	AndroidBuildCard,
	type AndroidBuildCardProps,
} from "./android-build-card";

export type PublishPopoverProps = {
	/** The open project, from appProjectQuery in the page. Sets the kind, the name, and the version line. */
	project: AppProject;
};

/** Each body suspends inside the popover, so the top bar never waits for its data. */
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
			{/* 360 px like the design. On a phone it keeps 12 px from each edge. */}
			<PopoverContent
				align="end"
				className="flex w-[360px] max-w-[calc(100vw-24px)] flex-col gap-3 p-4"
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
				<Suspense fallback={<Skeleton className="h-16" />}>
					{project.kind === "web" ? (
						<PublishWebBody
							projectId={project.id}
							onNavigate={() => setOpen(false)}
						/>
					) : (
						<PublishMobileBody
							projectId={project.id}
							onNavigate={() => setOpen(false)}
						/>
					)}
				</Suspense>
			</PopoverContent>
		</Popover>
	);
}

/** Reads the domains and wires the web actions. Connect one opens the Domains panel. */
function PublishWebBody({
	projectId,
	onNavigate,
}: {
	projectId: string;
	/** Closes the popover before the view changes under it. */
	onNavigate: () => void;
}) {
	const { t } = useTranslation();
	const navigate = useNavigate({ from: "/app/$projectId" });
	const { data: domains } = useSuspenseQuery(projectDomainsQuery(projectId));

	return (
		<PublishWebTargets
			domains={domains}
			onUpdate={() => toast(t("appBuilder.mock.notWired"))}
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
	/** Domains of the project, from projectDomainsQuery. Only the `wandit` one decides the row. */
	domains: ProjectDomain[];
	/** Publishes, or updates the live app. */
	onUpdate: () => void;
	/** Opens the Domains panel of the More view. */
	onConnectDomain: () => void;
};

/** The Wandit domain row with its Live badge, and the custom domain footer. */
export function PublishWebTargets({
	domains,
	onUpdate,
	onConnectDomain,
}: PublishWebTargetsProps) {
	const { t } = useTranslation();
	const wanditDomain = domains.find((domain) => domain.kind === "wandit");
	const isLive = wanditDomain?.status === "live";

	return (
		<>
			<TargetRow
				icon={Globe}
				title={t("appBuilder.publish.web")}
				note={
					wanditDomain ? wanditDomain.host : t("appBuilder.publish.notLive")
				}
			>
				{isLive ? (
					<Badge variant="success">
						<span aria-hidden className="size-1.5 rounded-full bg-success" />
						{t("appBuilder.publish.live")}
					</Badge>
				) : null}
				<Button size="sm" onClick={onUpdate}>
					{t(
						isLive
							? "appBuilder.publish.update"
							: "appBuilder.publish.publishNow",
					)}
				</Button>
			</TargetRow>
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
 * Reads the Android builds and the iOS mock, and wires the mobile actions.
 * iOS Set up opens the App stores panel. The builds poll only while this body is mounted.
 */
function PublishMobileBody({
	projectId,
	onNavigate,
}: {
	projectId: string;
	/** Closes the popover before the view changes under it. */
	onNavigate: () => void;
}) {
	const { t } = useTranslation();
	const navigate = useNavigate({ from: "/app/$projectId" });
	const { data: stores } = useSuspenseQuery(appStoresSummaryQuery(projectId));
	const builds = useQuery(mobileBuildsQuery(projectId));
	const createBuild = useCreateMobileBuild(projectId);
	const cancelBuild = useCancelMobileBuild(projectId);

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
			ios={stores.ios}
			onSubmit={() => toast(t("appBuilder.mock.notWired"))}
			onSetUp={() => {
				onNavigate();
				void navigate({
					search: (prev) => ({ ...prev, view: "more", panel: "appStores" }),
				});
			}}
			onShowQr={() => toast(t("appBuilder.mock.notWired"))}
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
	/** iOS store state, from appStoresSummaryQuery. A mock until WANDIT-284. */
	ios: AppStoresSummary["ios"];
	/** Submits a store-ready iOS build for review. */
	onSubmit: () => void;
	/** Starts the iOS store setup. The body opens the App stores panel. */
	onSetUp: () => void;
	/** Shows the QR code that opens the app on a phone. */
	onShowQr: () => void;
	/** Builds and actions of the Android APK card. */
	android: AndroidBuildCardProps;
};

/** The Android APK card, the App Store row, the test-on-phone row, and the backend footer. */
export function PublishMobileTargets({
	ios,
	onSubmit,
	onSetUp,
	onShowQr,
	android,
}: PublishMobileTargetsProps) {
	const { t, locale } = useTranslation();
	const isIosReady = ios.status === "readyToSubmit";

	return (
		<>
			<AndroidBuildCard {...android} />
			<TargetRow
				icon={Smartphone}
				title={t("appBuilder.publish.ios")}
				note={
					isIosReady
						? t("appBuilder.publish.buildReady", {
								build: formatNumber(ios.latestBuild, locale),
								testers: formatNumber(ios.testflightTesters, locale),
							})
						: t("appBuilder.publish.notSetUp")
				}
			>
				<StoreAction ready={isIosReady} onSubmit={onSubmit} onSetUp={onSetUp} />
			</TargetRow>
			<TargetRow
				icon={Zap}
				title={t("appBuilder.publish.testOnPhone")}
				note={t("appBuilder.publish.scanQr")}
			>
				<Button variant="outline" size="sm" onClick={onShowQr}>
					{t("appBuilder.publish.showQr")}
				</Button>
			</TargetRow>
			<p className="text-muted-foreground text-xs">
				{t("appBuilder.publish.backendNote")}
			</p>
		</>
	);
}

/** Submit for a store-ready build, else Set up. */
function StoreAction({
	ready,
	onSubmit,
	onSetUp,
}: {
	ready: boolean;
	onSubmit: () => void;
	onSetUp: () => void;
}) {
	const { t } = useTranslation();
	return ready ? (
		<Button size="sm" onClick={onSubmit}>
			{t("appBuilder.publish.submit")}
		</Button>
	) : (
		<Button variant="outline" size="sm" onClick={onSetUp}>
			{t("appBuilder.publish.setUp")}
		</Button>
	);
}

/** One card row of the popover: icon, title, a note under it, and the action at the end. */
function TargetRow({
	icon: Icon,
	title,
	note,
	children,
}: {
	icon: LucideIcon;
	title: string;
	/** Host, build state, or hint. A host is user content, so `dir="auto"` sets its direction. */
	note: string;
	children: ReactNode;
}) {
	return (
		<div className="flex items-center gap-3 rounded-xl border bg-card p-3">
			<Icon className="size-4 shrink-0 text-muted-foreground" />
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
