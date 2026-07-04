// Page tab controls, rendered inside the main card's header (see
// shell/main-pane-header.tsx): version switcher, generation status, viewport
// toggle and preview actions. The trailing action group is the reserved slot
// for the future edit-mode toggle that opens the right-side element-inspector
// rail (click-to-edit, post-MVP — see docs/PRD.md #4).

import { Button } from "@wandit/ui/components/button";
import { Separator } from "@wandit/ui/components/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { cn } from "@wandit/ui/lib/utils";
import {
	ExternalLink,
	Loader2,
	Monitor,
	RefreshCw,
	Smartphone,
} from "lucide-react";
import type * as React from "react";

import { useTranslation } from "@/lib/i18n";
import { getVersionPage } from "../../api/workspace.services";
import { openHtmlInNewTab } from "../../lib/helpers";
import { useWorkspace, type Viewport } from "../../lib/store";
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
					variant="ghost"
					size="icon-sm"
					aria-label={label}
					onClick={onClick}
					disabled={disabled}
					className={className}
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
		activeVersion,
		project,
		isGenerating,
		pendingVersionNumber,
	} = useWorkspace();

	const openInNewTab = () => {
		if (!activeVersion) return;
		const page = getVersionPage(activeVersion.pageKey, project?.name);
		openHtmlInNewTab(page.html);
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
						"grid size-7 place-items-center rounded-md text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
						viewport === target
							? "bg-background text-foreground shadow-xs"
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
		<div className="flex items-center gap-1">
			{isGenerating ? (
				<span className="hidden items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1 font-mono text-[11px] text-primary lg:flex">
					<Loader2 className="size-3 animate-spin" />
					{t("workspace.page.generatingTitle", { n: pendingVersionNumber })}
				</span>
			) : null}

			<VersionSwitcher />

			<div className="ms-1 flex items-center gap-0.5 rounded-lg bg-muted/60 p-0.5">
				{viewportButton(
					"mobile",
					t("workspace.page.viewportMobile"),
					<Smartphone className="size-3.5" />,
				)}
				{viewportButton(
					"desktop",
					t("workspace.page.viewportDesktop"),
					<Monitor className="size-3.5" />,
				)}
			</div>
			<Separator
				orientation="vertical"
				className="mx-1 hidden data-[orientation=vertical]:h-4 sm:block"
			/>
			<IconAction
				label={t("workspace.page.refresh")}
				onClick={onReload}
				disabled={!activeVersion}
				className="hidden sm:inline-flex"
			>
				<RefreshCw className="size-3.5" />
			</IconAction>
			<IconAction
				label={t("workspace.page.openInNewTab")}
				onClick={openInNewTab}
				disabled={!activeVersion}
				className="hidden sm:inline-flex"
			>
				<ExternalLink className="size-3.5" />
			</IconAction>
		</div>
	);
}
