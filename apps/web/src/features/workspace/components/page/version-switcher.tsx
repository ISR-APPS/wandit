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
import { Check, ChevronDown } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { relativeTime } from "@/lib/relative-time";
import { useWorkspace } from "../../lib/store";

export function VersionSwitcher() {
	const { t } = useTranslation();
	const { versions, activeVersion, selectVersion } = useWorkspace();

	if (!activeVersion) return null;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm" className="h-[30px] gap-[7px] px-3">
					<span className="text-[13px]">
						{t("workspace.page.versionShort", { n: activeVersion.number })}
					</span>
					<ChevronDown className="size-[11px] opacity-50" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-72">
				<DropdownMenuLabel className="text-muted-foreground text-xs">
					{t("workspace.page.versionsMenuLabel")}
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
									{version.label ??
										t("workspace.page.versionShort", { n: version.number })}
								</p>
								<p className="font-mono text-[10px] text-muted-foreground">
									{relativeTime(version.createdAt)}
								</p>
							</div>
							{version.isLive ? (
								<Badge variant="success" className="font-mono text-[10px]">
									{t("workspace.page.liveBadge")}
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
