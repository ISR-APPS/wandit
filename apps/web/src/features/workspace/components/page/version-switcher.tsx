// Toolbar dropdown flipping the preview between immutable versions.

import { Badge } from "@wandit/ui/components/badge";
import { Button } from "@wandit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@wandit/ui/components/dropdown-menu";
import { Check, ChevronDown, History } from "lucide-react";

import { relativeTime } from "@/lib/relative-time";
import { WORKSPACE_COPY } from "../../lib/constants";
import { useWorkspace } from "../../lib/store";

const COPY = WORKSPACE_COPY.page;

export function VersionSwitcher() {
	const { versions, activeVersion, selectVersion, state } = useWorkspace();

	if (!activeVersion) return null;

	const publishedVersionId = state?.deployment.publishedVersionId ?? null;
	const isLatest = activeVersion.id === versions.at(-1)?.id;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="h-8 gap-1.5 rounded-lg px-2.5"
				>
					<History className="size-3.5 text-muted-foreground" />
					<span className="font-mono text-xs tabular-nums">
						{COPY.versionShort(activeVersion.number)}
					</span>
					{isLatest ? (
						<span className="hidden text-muted-foreground text-xs sm:inline">
							· {COPY.latestSuffix}
						</span>
					) : null}
					<ChevronDown className="size-3.5 text-muted-foreground" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-72">
				<DropdownMenuLabel className="text-muted-foreground text-xs">
					{COPY.versionsMenuLabel}
				</DropdownMenuLabel>
				<div className="max-h-80 overflow-y-auto">
					{[...versions].reverse().map((version) => (
						<DropdownMenuItem
							key={version.id}
							onSelect={() => selectVersion(version.id)}
							className="gap-2.5"
						>
							<span className="rounded-md border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] tabular-nums">
								v{version.number}
							</span>
							<div className="min-w-0 flex-1">
								<p dir="auto" className="truncate text-sm">
									{version.label}
								</p>
								<p className="font-mono text-[10px] text-muted-foreground">
									{relativeTime(version.createdAt)}
								</p>
							</div>
							{version.id === publishedVersionId ? (
								<Badge variant="success" className="font-mono text-[10px]">
									{COPY.liveBadge}
								</Badge>
							) : null}
							{version.id === activeVersion.id ? (
								<Check className="size-4 shrink-0 text-primary" />
							) : null}
						</DropdownMenuItem>
					))}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
