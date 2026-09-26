/**
 * The two halves of the top bar of the app builder. ProjectBar holds the
 * project controls: back link, project menu, version history, and the chat
 * expand button. WorkBar holds the work pane controls: the view switcher,
 * the title, the preview actions, credits, publish, and the user menu.
 * Rendered by pages/app-builder-page.tsx, which owns every value shown
 * here and places each half over its card.
 */

import { Link } from "@tanstack/react-router";
import { Button } from "@wandit/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import {
	Cloud,
	Code,
	ExternalLink,
	Globe,
	Layers,
	Menu,
	Monitor,
	PanelLeftOpen,
	RefreshCw,
	Smartphone,
	Tablet,
} from "lucide-react";
import type { ReactNode } from "react";

import { Spark } from "@/components/logo";
import { UserMenu } from "@/features/auth";
import { CreditsChip } from "@/features/credits";
import { useTranslation } from "@/lib/i18n";
import type { AppProject } from "../../api/dto";
import type {
	BuilderView,
	PhoneDevice,
	WebViewport,
} from "../../lib/constants";
import { ExpoGoPopover } from "./expo-go-popover";
import { ProjectMenu } from "./project-menu";
import { PublishPopover } from "./publish-popover";
import { SegmentedControl } from "./segmented-control";
import { VersionsPopover } from "./versions-popover";

export type ProjectBarProps = {
	/** The open project, from appProjectQuery in the page. */
	project: AppProject;
	/** True while the chat card is open. The expand button shows only when it is closed. */
	chatOpen: boolean;
	/** Opens the chat card. The collapse button lives in the card header. */
	onExpandChat: () => void;
	/** Runs after a restore succeeds. The page mints a new preview token with it. */
	onRestored: () => void;
};

/** On desktop this half sits over the chat card. While the chat is closed it moves to the main card. */
export function ProjectBar({
	project,
	chatOpen,
	onExpandChat,
	onRestored,
}: ProjectBarProps) {
	const { t } = useTranslation();

	return (
		// On phones it grows, so the work controls sit at the end. From md it keeps its width, and a long name truncates.
		<div className="flex min-w-0 flex-1 items-center gap-2 md:flex-initial">
			<IconAction label={t("appBuilder.topBar.backToDashboard")}>
				<Button
					asChild
					variant="ghost"
					size="icon-sm"
					className="hidden md:inline-flex"
				>
					<Link to="/dashboard">
						<Menu className="size-4" />
					</Link>
				</Button>
			</IconAction>
			{/* On phones the project menu's "All projects" item is the way back, so the mark hides. */}
			<Link
				to="/dashboard"
				aria-label={t("appBuilder.topBar.backToDashboard")}
				className="hidden size-6 shrink-0 place-items-center rounded-full bg-gradient-ember outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:grid"
			>
				<Spark className="size-3 text-background" />
			</Link>
			<ProjectMenu project={project} />
			<span className="flex items-center gap-1">
				<span className="hidden md:block">
					<VersionsPopover projectId={project.id} onRestored={onRestored} />
				</span>
				{chatOpen ? null : (
					<IconAction label={t("appBuilder.topBar.expandChat")}>
						<Button variant="ghost" size="icon-sm" onClick={onExpandChat}>
							{/* In RTL the chat sits on the right, so the icon mirrors. */}
							<PanelLeftOpen className="size-4 rtl:-scale-x-100" />
						</Button>
					</IconAction>
				)}
			</span>
		</div>
	);
}

export type WorkBarProps = {
	/** The open project, from appProjectQuery in the page. */
	project: AppProject;
	view: BuilderView;
	/** Centered over the work pane: the view name, or the title of the open More panel. */
	title: string;
	/** True when the view switcher lists Cloud. The page reads it from useCloudTabEnabled. */
	showCloud: boolean;
	/** Phone frame of the mobile preview. Read only when the project is a mobile app. */
	device: PhoneDevice;
	/** Frame width of the web preview. Read only when the project is a web app. */
	viewport: WebViewport;
	onChangeView: (view: BuilderView) => void;
	onChangeDevice: (device: PhoneDevice) => void;
	onChangeViewport: (viewport: WebViewport) => void;
	/** Bumps `reloadKey`; the panel mints a new token and the new src reloads the frame. */
	onReload: () => void;
	/** Opens the published app in a new tab. Web projects only: a mobile app has no site. */
	onOpenExternal: () => void;
};

/** On desktop this half sits over the main card. A drag of the split moves it with the card. */
export function WorkBar({
	project,
	view,
	title,
	showCloud,
	device,
	viewport,
	onChangeView,
	onChangeDevice,
	onChangeViewport,
	onReload,
	onOpenExternal,
}: WorkBarProps) {
	const { t } = useTranslation();

	return (
		// LIMIT: the controls need about 740 px; a narrower row clips the actions at the end. Upgrade: fold the actions into one menu.
		<div className="flex shrink-0 items-center gap-2 md:min-w-0 md:flex-1">
			<SegmentedControl
				ariaLabel={t("appBuilder.topBar.viewsAriaLabel")}
				value={view}
				onChange={onChangeView}
				options={[
					{
						value: "preview",
						label: t("appBuilder.views.preview"),
						icon: Globe,
						iconOnly: view !== "preview",
					},
					{
						value: "code",
						label: t("appBuilder.views.code"),
						icon: Code,
						iconOnly: view !== "code",
					},
					...(showCloud
						? [
								{
									value: "cloud" as const,
									label: t("workspace.tabs.cloud"),
									icon: Cloud,
									iconOnly: view !== "cloud",
								},
							]
						: []),
					{
						value: "more",
						label: t("appBuilder.views.more"),
						icon: Layers,
						iconOnly: view !== "more",
					},
				]}
			/>
			<span className="hidden min-w-0 flex-1 truncate px-3 text-center font-medium text-sm lg:block">
				{title}
			</span>
			<div className="ms-auto flex shrink-0 items-center gap-2">
				{view === "preview" ? (
					<PreviewActions
						project={project}
						device={device}
						viewport={viewport}
						onChangeDevice={onChangeDevice}
						onChangeViewport={onChangeViewport}
						onReload={onReload}
						onOpenExternal={onOpenExternal}
					/>
				) : null}
				<CreditsChip className="hidden sm:flex" />
				<PublishPopover project={project} />
				<UserMenu />
			</div>
		</div>
	);
}

export type PreviewActionsProps = Pick<
	WorkBarProps,
	| "project"
	| "device"
	| "viewport"
	| "onChangeDevice"
	| "onChangeViewport"
	| "onReload"
	| "onOpenExternal"
>;

/**
 * Preview controls of the work bar. A web app gets the viewport switch and
 * the new-tab button. A mobile app gets the device switch and the Expo Go
 * popover. Both get the reload button.
 */
export function PreviewActions({
	project,
	device,
	viewport,
	onChangeDevice,
	onChangeViewport,
	onReload,
	onOpenExternal,
}: PreviewActionsProps) {
	const { t } = useTranslation();
	const reload = (
		<IconAction label={t("appBuilder.topBar.reload")}>
			<Button
				variant="outline"
				size="icon-sm"
				className="hidden md:inline-flex"
				onClick={onReload}
			>
				<RefreshCw className="size-3.5" />
			</Button>
		</IconAction>
	);

	if (project.kind === "web") {
		return (
			<>
				<SegmentedControl
					ariaLabel={t("appBuilder.viewport.ariaLabel")}
					value={viewport}
					onChange={onChangeViewport}
					className="hidden md:flex"
					options={[
						{
							value: "desktop",
							label: t("appBuilder.viewport.desktop"),
							icon: Monitor,
							iconOnly: true,
						},
						{
							value: "tablet",
							label: t("appBuilder.viewport.tablet"),
							icon: Tablet,
							iconOnly: true,
						},
						{
							value: "mobile",
							label: t("appBuilder.viewport.mobile"),
							icon: Smartphone,
							iconOnly: true,
						},
					]}
				/>
				{reload}
				<IconAction label={t("appBuilder.topBar.openExternal")}>
					<Button
						variant="outline"
						size="icon-sm"
						className="hidden md:inline-flex"
						onClick={onOpenExternal}
					>
						<ExternalLink className="size-3.5" />
					</Button>
				</IconAction>
			</>
		);
	}
	// A mobile app has no published site yet, so no new-tab button (WANDIT-193).
	return (
		<>
			<SegmentedControl
				ariaLabel={t("appBuilder.device.ariaLabel")}
				value={device}
				onChange={onChangeDevice}
				className="hidden md:flex"
				options={[
					{
						value: "ios",
						label: t("appBuilder.device.ios"),
						icon: Smartphone,
					},
					{
						value: "android",
						label: t("appBuilder.device.android"),
						icon: Smartphone,
					},
				]}
			/>
			<ExpoGoPopover projectId={project.id} />
			{reload}
		</>
	);
}

/**
 * Wraps one icon button with its tooltip. The label is also the accessible
 * name. The Code view header uses it too.
 */
export function IconAction({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild aria-label={label}>
				{children}
			</TooltipTrigger>
			<TooltipContent side="bottom">{label}</TooltipContent>
		</Tooltip>
	);
}
