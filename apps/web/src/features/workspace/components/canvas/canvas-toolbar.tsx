// Canvas toolbar: chat expander, version switcher, generation status,
// viewport toggle and preview actions.

import { Button } from "@my-better-t-app/ui/components/button";
import { Separator } from "@my-better-t-app/ui/components/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@my-better-t-app/ui/components/tooltip";
import { cn } from "@my-better-t-app/ui/lib/utils";
import {
	ExternalLink,
	Loader2,
	Monitor,
	PanelLeftOpen,
	RefreshCw,
	Smartphone,
} from "lucide-react";
import type * as React from "react";

import { WORKSPACE_COPY } from "../../lib/constants";
import { getMockPage } from "../../lib/mock-pages";
import { useWorkspace, type Viewport } from "../../lib/store";
import { VersionSwitcher } from "./version-switcher";

const COPY = WORKSPACE_COPY.canvas;

function IconAction({
	label,
	onClick,
	disabled,
	children,
}: {
	label: string;
	onClick: () => void;
	disabled?: boolean;
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
				>
					{children}
				</Button>
			</TooltipTrigger>
			<TooltipContent side="bottom">{label}</TooltipContent>
		</Tooltip>
	);
}

export function CanvasToolbar({ onReload }: { onReload: () => void }) {
	const {
		chatOpen,
		toggleChat,
		viewport,
		setViewport,
		activeVersion,
		project,
		isGenerating,
		pendingVersionNumber,
	} = useWorkspace();

	const openInNewTab = () => {
		if (!activeVersion) return;
		const page = getMockPage(activeVersion.pageKey, { title: project?.name });
		const url = URL.createObjectURL(
			new Blob([page.html], { type: "text/html" }),
		);
		window.open(url, "_blank", "noopener");
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
							? "border border-border bg-background text-foreground shadow-xs"
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
		<div className="flex h-11 shrink-0 items-center gap-1.5 border-b bg-background/70 px-2.5 backdrop-blur-md">
			{!chatOpen ? (
				<>
					<IconAction label={WORKSPACE_COPY.chat.expand} onClick={toggleChat}>
						<PanelLeftOpen className="size-4" />
					</IconAction>
					<Separator
						orientation="vertical"
						className="mx-0.5 data-[orientation=vertical]:h-4"
					/>
				</>
			) : null}

			<VersionSwitcher />

			{isGenerating ? (
				<span className="hidden items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1 font-mono text-[11px] text-primary sm:flex">
					<Loader2 className="size-3 animate-spin" />
					{COPY.generatingTitle(pendingVersionNumber)}
				</span>
			) : null}

			<div className="ml-auto flex items-center gap-1">
				<div className="flex items-center gap-0.5 rounded-lg border border-border/70 bg-muted/40 p-0.5">
					{viewportButton(
						"mobile",
						COPY.viewportMobile,
						<Smartphone className="size-3.5" />,
					)}
					{viewportButton(
						"desktop",
						COPY.viewportDesktop,
						<Monitor className="size-3.5" />,
					)}
				</div>
				<Separator
					orientation="vertical"
					className="mx-1 data-[orientation=vertical]:h-4"
				/>
				<IconAction
					label={COPY.refresh}
					onClick={onReload}
					disabled={!activeVersion}
				>
					<RefreshCw className="size-3.5" />
				</IconAction>
				<IconAction
					label={COPY.openInNewTab}
					onClick={openInNewTab}
					disabled={!activeVersion}
				>
					<ExternalLink className="size-3.5" />
				</IconAction>
			</div>
		</div>
	);
}
