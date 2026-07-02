// One immutable PageVersion in the assets grid: gradient thumb with a v{n}
// glyph, kind/lang badges, live/viewing state, and a hover-reveal "open in
// new tab" action. Clicking the card focuses the version in the canvas.

import { Badge } from "@wandit/ui/components/badge";
import { Button } from "@wandit/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { cn } from "@wandit/ui/lib/utils";
import { ExternalLink } from "lucide-react";
import type * as React from "react";

import { thumbGradient } from "@/features/projects";
import { relativeTime } from "@/lib/relative-time";
import type { PageVersion } from "../../api/dto";
import { getVersionPage } from "../../api/workspace.services";
import { WORKSPACE_COPY } from "../../lib/constants";
import { openHtmlInNewTab } from "../../lib/helpers";
import { useWorkspace } from "../../lib/store";

export function AssetCard({ version }: { version: PageVersion }) {
	const { project, state, activeVersion, selectVersion } = useWorkspace();

	const isLive = version.id === state?.deployment.publishedVersionId;
	const isViewing = activeVersion?.id === version.id;

	const handleOpenInNewTab = (event: React.MouseEvent) => {
		event.stopPropagation();
		const { html } = getVersionPage(version.pageKey, project?.name);
		openHtmlInNewTab(html);
	};

	return (
		<div className="group relative">
			<button
				type="button"
				onClick={() => selectVersion(version.id, { focusCanvas: true })}
				className={cn(
					"block w-full overflow-hidden rounded-xl border bg-card text-left transition-all duration-150",
					"hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg",
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
				)}
			>
				<div
					className="relative aspect-[4/3]"
					style={{
						background: thumbGradient(
							(project?.thumbnailSeed ?? 7) + version.number * 17,
						),
					}}
				>
					<div
						aria-hidden
						className="pointer-events-none absolute inset-0 bg-grain"
					/>
					<span
						aria-hidden
						className="absolute inset-0 flex select-none items-center justify-center font-bold font-display text-5xl text-white/20"
					>
						{WORKSPACE_COPY.canvas.versionShort(version.number)}
					</span>
					<div className="absolute top-2 left-2 flex items-center gap-1">
						<Badge variant="secondary" className="font-mono text-[10px]">
							{WORKSPACE_COPY.assets.kindLandingPage}
						</Badge>
						<Badge variant="outline" className="font-mono text-[10px]">
							{version.lang.toUpperCase()}
						</Badge>
					</div>
					{isLive || isViewing ? (
						<div className="absolute top-2 right-2 flex flex-col items-end gap-1">
							{isLive ? (
								<Badge variant="success" className="font-mono text-[10px]">
									{WORKSPACE_COPY.assets.liveBadge}
								</Badge>
							) : null}
							{isViewing ? (
								<Badge className="font-mono text-[10px]">
									{WORKSPACE_COPY.assets.currentBadge}
								</Badge>
							) : null}
						</div>
					) : null}
				</div>
				<div className="p-3.5">
					<h3 dir="auto" className="truncate font-medium text-sm">
						{version.label}
					</h3>
					<div className="mt-1.5 flex items-center gap-1.5 font-mono text-muted-foreground text-xs">
						<span>{WORKSPACE_COPY.assets.versionTitle(version.number)}</span>
						<span aria-hidden className="text-muted-foreground/50">
							·
						</span>
						<span>{relativeTime(version.createdAt)}</span>
					</div>
				</div>
			</button>

			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="secondary"
						size="icon-sm"
						aria-label={WORKSPACE_COPY.assets.openInNewTab}
						onClick={handleOpenInNewTab}
						className="pointer-events-none absolute top-2 right-2 z-10 size-7 opacity-0 shadow-sm transition-opacity duration-150 focus-visible:pointer-events-auto focus-visible:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"
					>
						<ExternalLink className="size-4" />
					</Button>
				</TooltipTrigger>
				<TooltipContent>{WORKSPACE_COPY.assets.openInNewTab}</TooltipContent>
			</Tooltip>
		</div>
	);
}
