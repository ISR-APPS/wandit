/**
 * History button of the top bar and its popover with the version list.
 * Rendered by components/shell/top-bar.tsx. The list reads appVersionsQuery
 * when the popover opens. Restore has no backend yet and shows a toast.
 * VersionsList is the pure list; the spec renders it without the popover.
 */

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@wandit/ui/components/badge";
import { Button } from "@wandit/ui/components/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@wandit/ui/components/popover";
import { Skeleton } from "@wandit/ui/components/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { History } from "lucide-react";
import { toast } from "sonner";

import { formatNumber, formatRelativeTime, useTranslation } from "@/lib/i18n";
import { appVersionsQuery } from "../../api/app-builder.queries";
import type { AppVersion } from "../../api/dto";

export type VersionsPopoverProps = {
	/** Route param of the open project. */
	projectId: string;
};

/** The top bar hides this button below the md breakpoint; see top-bar.tsx. */
export function VersionsPopover({ projectId }: VersionsPopoverProps) {
	const { t } = useTranslation();

	return (
		<Popover>
			<Tooltip>
				<TooltipTrigger asChild>
					<PopoverTrigger asChild>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={t("appBuilder.topBar.history")}
						>
							<History className="size-4" />
						</Button>
					</PopoverTrigger>
				</TooltipTrigger>
				<TooltipContent side="bottom">
					{t("appBuilder.topBar.history")}
				</TooltipContent>
			</Tooltip>
			<PopoverContent align="start" className="w-80 p-0">
				<div className="border-b px-4 py-3 font-semibold text-sm">
					{t("appBuilder.versions.title")}
				</div>
				<VersionsBody projectId={projectId} />
			</PopoverContent>
		</Popover>
	);
}

/** Loads the versions when the popover opens. Three skeleton rows stand in while it loads. */
function VersionsBody({ projectId }: { projectId: string }) {
	const { t } = useTranslation();
	const versions = useQuery(appVersionsQuery(projectId));

	if (versions.isPending) {
		return (
			<div className="flex flex-col gap-2 p-4">
				<Skeleton className="h-8" />
				<Skeleton className="h-8" />
				<Skeleton className="h-8" />
			</div>
		);
	}
	if (versions.isError) {
		return (
			<p className="px-4 py-3 text-muted-foreground text-sm">
				{t("errors.generic")}
			</p>
		);
	}
	return <VersionsList versions={versions.data} />;
}

export type VersionsListProps = {
	/** Newest first, as appVersionsQuery returns them. The first row is the current version. */
	versions: AppVersion[];
};

/** One row per version: number, summary, age, and Live, Current, or Restore at the end. */
export function VersionsList({ versions }: VersionsListProps) {
	const { t, locale } = useTranslation();

	return (
		<ul>
			{versions.map((version, index) => {
				const isCurrent = index === 0;
				return (
					<li
						key={version.number}
						className="flex items-center gap-3 border-b px-4 py-2.5 text-sm last:border-0"
					>
						<span className="w-8 shrink-0 font-mono text-muted-foreground text-xs">
							{t("appBuilder.versions.version", {
								number: formatNumber(version.number, locale),
							})}
						</span>
						<div className="min-w-0 flex-1">
							<div className="truncate" dir="auto">
								{version.summary}
							</div>
							<div className="text-muted-foreground text-xs">
								{formatRelativeTime(version.createdAt, locale)}
							</div>
						</div>
						{version.isLive ? (
							<Badge variant="success">
								<span
									aria-hidden
									className="size-1.5 rounded-full bg-success"
								/>
								{t("appBuilder.versions.live")}
							</Badge>
						) : null}
						{isCurrent ? (
							<Badge variant="outline">
								{t("appBuilder.versions.current")}
							</Badge>
						) : null}
						{/* The live and the current version need no restore. */}
						{version.isLive || isCurrent ? null : (
							<Button
								variant="ghost"
								size="xs"
								onClick={() => toast(t("appBuilder.mock.notWired"))}
							>
								{t("appBuilder.versions.restore")}
							</Button>
						)}
					</li>
				);
			})}
		</ul>
	);
}
