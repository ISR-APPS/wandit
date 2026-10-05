/**
 * The two halves of the top bar of the app builder. ProjectBar holds the
 * project controls: back link, project menu, version history, and the chat
 * expand button. WorkBar holds the view switcher, publish, and the user menu.
 * It shows no credit balance. Billing opens from the user menu.
 * The preview controls live in the bar of each preview card.
 * Rendered by pages/app-builder-page.tsx, which owns every value shown
 * here and places each half over its card.
 */

import { CodeIcon } from "@phosphor-icons/react/Code";
import { EyeIcon } from "@phosphor-icons/react/Eye";
import { SidebarSimpleIcon } from "@phosphor-icons/react/SidebarSimple";
import { SquaresFourIcon } from "@phosphor-icons/react/SquaresFour";
import { Link } from "@tanstack/react-router";
import { Button } from "@wandit/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import type { ReactNode } from "react";

import { Spark } from "@/components/logo";
import { UserMenu } from "@/features/auth";
import { useTranslation } from "@/lib/i18n";
import type { AppProject } from "../../api/dto";
import type { BuilderView } from "../../lib/constants";
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
	/** Sha of the commit the live web app runs, from the publish status in the page. Null when nothing is live. */
	liveCommitSha: string | null;
	/** Runs after a restore succeeds. The page mints a new preview token with it. */
	onRestored: () => void;
};

/** On desktop this half sits over the chat card. While the chat is closed it moves to the main card. */
export function ProjectBar({
	project,
	chatOpen,
	onExpandChat,
	liveCommitSha,
	onRestored,
}: ProjectBarProps) {
	const { t } = useTranslation();

	return (
		// On phones it grows, so the work controls sit at the end. From md it keeps its width, and a long name truncates.
		<div className="flex min-w-0 flex-1 items-center gap-2 md:flex-initial">
			{/* The brand tile of the dashboard sidebar is the way back. */}
			{/* On phones the project menu's "All projects" item is the way back, so the tile hides. */}
			<IconAction label={t("appBuilder.topBar.backToDashboard")}>
				<Link
					to="/dashboard"
					className="group/logo hidden size-8 shrink-0 place-items-center rounded-[10px] bg-night outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:grid dark:ring-1 dark:ring-white/10"
				>
					<Spark className="size-4.5 text-spark transition-transform duration-500 ease-out group-hover/logo:rotate-90 motion-reduce:transition-none" />
				</Link>
			</IconAction>
			<ProjectMenu project={project} />
			<span className="flex items-center gap-0.5">
				{/* Every width shows it: a phone user must be able to list and restore versions too. */}
				<VersionsPopover
					projectId={project.id}
					liveCommitSha={liveCommitSha}
					onRestored={onRestored}
				/>
				{chatOpen ? null : (
					<IconAction label={t("appBuilder.topBar.expandChat")}>
						<Button
							variant="ghost"
							size="icon-sm"
							className={TOOLBAR_ICON_BUTTON_CLASS}
							onClick={onExpandChat}
						>
							{/* In RTL the chat sits on the right, so the icon mirrors. */}
							<SidebarSimpleIcon
								aria-hidden
								weight="bold"
								className="rtl:-scale-x-100"
							/>
						</Button>
					</IconAction>
				)}
			</span>
		</div>
	);
}

/** Props of WorkBar. The page passes them; ViewSwitcher reuses the view fields. */
export type WorkBarProps = {
	/** The open project, from appProjectQuery in the page. */
	project: AppProject;
	/** The open view: `preview`, `code`, or `more`. The page reads it from `?view=` of the URL. */
	view: BuilderView;
	/** Writes the picked view to `?view=` of the URL. The view switcher calls it. */
	onChangeView: (view: BuilderView) => void;
	/** True when the chat can take a message. Passed to the publish popover for "Ask the AI to fix". */
	canAskFix: boolean;
	/** Sends one chat message and opens the chat. The publish popover sends the gate findings with it. */
	onAskFix: (text: string) => void;
};

/** On desktop this half sits over the main card. A drag of the split moves it with the card. */
export function WorkBar({
	project,
	view,
	onChangeView,
	canAskFix,
	onAskFix,
}: WorkBarProps) {
	return (
		<div className="flex shrink-0 items-center gap-2 md:min-w-0 md:flex-1">
			<ViewSwitcher view={view} onChangeView={onChangeView} />
			<div className="ms-auto flex shrink-0 items-center gap-2">
				<PublishPopover
					project={project}
					canAskFix={canAskFix}
					onAskFix={onAskFix}
				/>
				<UserMenu />
			</div>
		</div>
	);
}

/** Props of ViewSwitcher: the same open view and change handler that WorkBar gets from the page. */
export type ViewSwitcherProps = Pick<WorkBarProps, "view" | "onChangeView">;

/**
 * The Preview, Code, and More switch at the start of the work bar. From the
 * sm width, only the open view shows its label; below it, icons only. More
 * holds every project panel, the Cloud panels too. Exported for the spec.
 */
export function ViewSwitcher({ view, onChangeView }: ViewSwitcherProps) {
	const { t } = useTranslation();

	return (
		<SegmentedControl
			ariaLabel={t("appBuilder.topBar.viewsAriaLabel")}
			value={view}
			onChange={onChangeView}
			// A phone row also holds the project controls and History, so the open view keeps its label for screen readers only.
			className="max-sm:[&_span]:sr-only"
			options={[
				{
					value: "preview",
					label: t("appBuilder.views.preview"),
					icon: EyeIcon,
					iconOnly: view !== "preview",
				},
				{
					value: "code",
					label: t("appBuilder.views.code"),
					icon: CodeIcon,
					iconOnly: view !== "code",
				},
				{
					value: "more",
					label: t("appBuilder.views.more"),
					icon: SquaresFourIcon,
					iconOnly: view !== "more",
				},
			]}
		/>
	);
}

/**
 * Look of every round icon button in the bars of the workspace: the top bar,
 * the preview bars, the Code view header, and the logs search field. Use it
 * on a ghost `icon-sm` Button. A navy tint shows on hover and while its menu
 * or popover is open.
 */
export const TOOLBAR_ICON_BUTTON_CLASS =
	"size-8 rounded-full text-night/65 hover:bg-night/[0.06] hover:text-night aria-expanded:bg-night/[0.08] aria-expanded:text-night disabled:opacity-40 dark:text-foreground/65 dark:aria-expanded:bg-white/[0.1] dark:aria-expanded:text-foreground dark:hover:bg-white/[0.08] dark:hover:text-foreground [&_svg:not([class*='size-'])]:size-[18px]";

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
