// Page tab controls, rendered inside the main card's header (see
// shell/main-pane-header.tsx): version switcher, generation status, viewport
// toggle, preview actions, and the WS2 edit-mode toggles — "Cibler"
// (click-to-target) and "Modifier" (inline editor) — driving the PageEditor
// context that opens the right-side inspector rail. The toggles derive their
// disabled state from the REAL page overview query (an actual version must
// exist and no build may be running), not the mock workspace versions.

import { Button } from "@wandit/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { cn } from "@wandit/ui/lib/utils";
import {
	Crosshair,
	ExternalLink,
	Loader2,
	Monitor,
	Pencil,
	RefreshCw,
	Smartphone,
} from "lucide-react";
import type * as React from "react";

import { useTranslation } from "@/lib/i18n";
import { usePageOverviewQuery } from "../../api/pages.queries";
import { getVersionHtml } from "../../api/pages.services";
import { openHtmlInNewTab } from "../../lib/helpers";
import { useWorkspace, type Viewport } from "../../lib/store";
import { usePageEditor } from "../../lib/use-page-editor";
import { VersionSwitcher } from "./version-switcher";

function IconAction({
	label,
	onClick,
	disabled,
	className,
	children,
}: {
	label: string;
	onClick: () => void;
	disabled?: boolean;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant="outline"
					size="icon-sm"
					aria-label={label}
					onClick={onClick}
					disabled={disabled}
					className={cn("size-[30px] text-muted-foreground", className)}
				>
					{children}
				</Button>
			</TooltipTrigger>
			<TooltipContent side="bottom">{label}</TooltipContent>
		</Tooltip>
	);
}

export function PageControls({ onReload }: { onReload: () => void }) {
	const { t } = useTranslation();
	const {
		viewport,
		setViewport,
		projectId,
		isGenerating,
		pendingVersionNumber,
	} = useWorkspace();
	const editor = usePageEditor();

	// REAL overview (contract §12 / lane 2.6/3.3): editing needs an actual
	// active version and no in-flight build.
	const overviewQuery = usePageOverviewQuery(projectId);
	const realActiveVersion = overviewQuery.data?.activeVersion ?? null;
	const attemptStatus = overviewQuery.data?.latestAttempt?.status;
	const buildRunning =
		attemptStatus === "queued" || attemptStatus === "generating";

	const openInNewTab = () => {
		if (!realActiveVersion) return;
		// Versions are immutable; fetch the real HTML and open it.
		void getVersionHtml(realActiveVersion.id).then(({ html }) =>
			openHtmlInNewTab(html),
		);
	};

	const viewportButton = (
		target: Viewport,
		label: string,
		icon: React.ReactNode,
	) => (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					aria-label={label}
					aria-pressed={viewport === target}
					onClick={() => setViewport(target)}
					className={cn(
						"grid h-6 w-[30px] place-items-center rounded-full text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
						viewport === target
							? "bg-background text-foreground shadow-segment"
							: "hover:text-foreground",
					)}
				>
					{icon}
				</button>
			</TooltipTrigger>
			<TooltipContent side="bottom">{label}</TooltipContent>
		</Tooltip>
	);

	return (
		<div className="flex items-center gap-2">
			{isGenerating ? (
				<span className="hidden items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1 font-mono text-[11px] text-primary lg:flex">
					<Loader2 className="size-3 animate-spin" />
					{t("workspace.page.generatingTitle", { n: pendingVersionNumber })}
				</span>
			) : null}

			<VersionSwitcher />

			<div className="flex items-center gap-0.5 rounded-full border border-border bg-muted p-[3px]">
				{viewportButton(
					"desktop",
					t("workspace.page.viewportDesktop"),
					<Monitor className="size-3.5" />,
				)}
				{viewportButton(
					"mobile",
					t("workspace.page.viewportMobile"),
					<Smartphone className="size-[13px]" />,
				)}
			</div>
			{/* Hidden entirely without a version to edit (lane 3.3); while a build
			    runs they only disable for ENTERING a mode — exiting must stay
			    possible when a build kicks off mid-edit. */}
			{realActiveVersion ? (
				<>
					<IconAction
						label={
							editor.mode === "select"
								? t("workspace.page.editor.done")
								: t("workspace.page.editor.target")
						}
						onClick={() =>
							editor.requestMode(editor.mode === "select" ? "browse" : "select")
						}
						disabled={buildRunning && editor.mode !== "select"}
						className={cn(
							editor.mode === "select" &&
								"border-primary/40 bg-primary/10 text-primary",
						)}
					>
						<Crosshair className="size-3.5" />
					</IconAction>
					<IconAction
						label={
							editor.mode === "edit"
								? t("workspace.page.editor.done")
								: t("workspace.page.editor.edit")
						}
						onClick={() =>
							editor.requestMode(editor.mode === "edit" ? "browse" : "edit")
						}
						disabled={buildRunning && editor.mode !== "edit"}
						className={cn(
							editor.mode === "edit" &&
								"border-primary/40 bg-primary/10 text-primary",
						)}
					>
						<Pencil className="size-3.5" />
					</IconAction>
				</>
			) : null}
			{/* Refresh reloads the REAL preview iframe — its availability must
			    track the real overview, not the mock workspace versions. */}
			<IconAction
				label={t("workspace.page.refresh")}
				onClick={onReload}
				disabled={!realActiveVersion}
				className="hidden sm:inline-flex"
			>
				<RefreshCw className="size-3.5" />
			</IconAction>
			<IconAction
				label={t("workspace.page.openInNewTab")}
				onClick={openInNewTab}
				disabled={!realActiveVersion}
				className="hidden sm:inline-flex"
			>
				<ExternalLink className="size-3.5" />
			</IconAction>
		</div>
	);
}
