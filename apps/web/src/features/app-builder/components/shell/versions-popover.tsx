/**
 * History button of the top bar and its popover with the version list.
 * Rendered by components/shell/top-bar.tsx. The list reads appVersionsQuery
 * when the popover opens. Each older row can open its diff (versionDiffQuery,
 * parsed by lib/unified-diff.ts) or restore the version through
 * useRestoreVersion after a confirm dialog.
 * The spec renders VersionsList without the popover. The Diff toggle mounts
 * VersionDiff, which reads versionDiffQuery, so the list needs a
 * QueryClientProvider around it.
 */

import { useQuery } from "@tanstack/react-query";
import type { AppCommit } from "@wandit/contracts";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@wandit/ui/components/alert-dialog";
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
import { useState } from "react";

import { formatRelativeTime, useTranslation } from "@/lib/i18n";
import { useRestoreVersion } from "../../api/app-builder.mutations";
import {
	appVersionsQuery,
	versionDiffQuery,
} from "../../api/app-builder.queries";
import { parseUnifiedDiff } from "../../lib/unified-diff";
import { DiffCard } from "../chat/diff-card";

export type VersionsPopoverProps = {
	/** Route param of the open project. */
	projectId: string;
	/** Runs after a restore succeeds. The page mints a new preview token with it. */
	onRestored: () => void;
};

/** The top bar hides this button below the md breakpoint; see top-bar.tsx. */
export function VersionsPopover({
	projectId,
	onRestored,
}: VersionsPopoverProps) {
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
			{/* 26 rem so a diff line fits under a row. */}
			<PopoverContent align="start" className="w-[26rem] p-0">
				<div className="border-b px-4 py-3 font-semibold text-sm">
					{t("appBuilder.versions.title")}
				</div>
				<VersionsBody projectId={projectId} onRestored={onRestored} />
			</PopoverContent>
		</Popover>
	);
}

/** Loads the versions when the popover opens and owns the restore mutation. Three skeleton rows stand in while it loads. */
function VersionsBody({
	projectId,
	onRestored,
}: {
	projectId: string;
	onRestored: () => void;
}) {
	const { t } = useTranslation();
	const versions = useQuery(appVersionsQuery(projectId));
	// The callback lives on the hook so it also runs when the popover closed mid-restore.
	const restore = useRestoreVersion(projectId, { onRestored });

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
	return (
		<VersionsList
			versions={versions.data.items}
			projectId={projectId}
			isRestoring={restore.isPending}
			onRestore={(sha) =>
				restore.mutate(
					// The API compares this head with the real one and swaps on it.
					{ sha, expectedHeadSha: versions.data.items[0].sha },
				)
			}
		/>
	);
}

export type VersionsListProps = {
	/** Newest first, as appVersionsQuery returns them. The first row is the current version. */
	versions: AppCommit[];
	/** Sha of the version to restore. The parent runs the mutation. */
	onRestore: (sha: string) => void;
	/** Route param of the open project. The diff block queries with it. */
	projectId: string;
	/** True while a restore runs. Every Restore button is disabled then. */
	isRestoring: boolean;
};

/**
 * One row per version: short sha, first message line, age, and the source
 * badge. The first row is the current version; every other row also has a
 * Diff toggle and a Restore button that opens a confirm dialog.
 */
// LIMIT: the V2 API has no publish state, so there is no Live badge. Upgrade: WANDIT-178.
export function VersionsList({
	versions,
	onRestore,
	projectId,
	isRestoring,
}: VersionsListProps) {
	const { t, locale } = useTranslation();
	/** Sha of the row whose diff is open, or null. */
	const [openDiff, setOpenDiff] = useState<string | null>(null);

	// A project before its first turn has no commit row yet.
	if (versions.length === 0) {
		return (
			<p className="px-4 py-3 text-muted-foreground text-sm">
				{t("appBuilder.versions.empty")}
			</p>
		);
	}

	return (
		<ul>
			{versions.map((version, index) => {
				const isCurrent = index === 0;
				return (
					<li key={version.sha} className="border-b last:border-0">
						<div className="flex items-center gap-3 px-4 py-2.5 text-sm">
							<span
								dir="ltr"
								className="w-14 shrink-0 font-mono text-muted-foreground text-xs"
							>
								{version.sha.slice(0, 7)}
							</span>
							<div className="min-w-0 flex-1">
								<div className="truncate" dir="auto">
									{version.message.split("\n")[0]}
								</div>
								<div className="text-muted-foreground text-xs">
									{formatRelativeTime(version.createdAt, locale)}
								</div>
							</div>
							<Badge variant="secondary">
								{t(`appBuilder.versions.source.${version.source}`)}
							</Badge>
							{isCurrent ? (
								<Badge variant="outline">
									{t("appBuilder.versions.current")}
								</Badge>
							) : (
								<>
									<Button
										variant="ghost"
										size="xs"
										aria-expanded={openDiff === version.sha}
										onClick={() =>
											setOpenDiff(openDiff === version.sha ? null : version.sha)
										}
									>
										{t("appBuilder.versions.diff")}
									</Button>
									<AlertDialog>
										<AlertDialogTrigger asChild>
											{/* A second restore during the first sends a stale head sha and ends in VERSION_CONFLICT. */}
											<Button variant="ghost" size="xs" disabled={isRestoring}>
												{t("appBuilder.versions.restore")}
											</Button>
										</AlertDialogTrigger>
										<AlertDialogContent>
											<AlertDialogHeader>
												<AlertDialogTitle>
													{t("appBuilder.versions.restoreTitle")}
												</AlertDialogTitle>
												<AlertDialogDescription>
													{t("appBuilder.versions.restoreBody")}
												</AlertDialogDescription>
											</AlertDialogHeader>
											<AlertDialogFooter>
												<AlertDialogCancel>
													{t("appBuilder.versions.cancel")}
												</AlertDialogCancel>
												<AlertDialogAction
													onClick={() => onRestore(version.sha)}
												>
													{t("appBuilder.versions.restore")}
												</AlertDialogAction>
											</AlertDialogFooter>
										</AlertDialogContent>
									</AlertDialog>
								</>
							)}
						</div>
						{openDiff === version.sha ? (
							<VersionDiff projectId={projectId} sha={version.sha} />
						) : null}
					</li>
				);
			})}
		</ul>
	);
}

/**
 * The diff of one version under its row: a numstat header line, then one
 * DiffCard per file parsed from the stored patch.
 */
function VersionDiff({ projectId, sha }: { projectId: string; sha: string }) {
	const { t } = useTranslation();
	const diff = useQuery(versionDiffQuery(projectId, sha));

	if (diff.isPending) {
		return (
			<div className="px-4 pb-3">
				<Skeleton className="h-16" />
			</div>
		);
	}
	if (diff.isError) {
		return (
			<p className="px-4 pb-3 text-muted-foreground text-sm">
				{t("errors.generic")}
			</p>
		);
	}
	const files = parseUnifiedDiff(diff.data.patch);
	if (files.length === 0) {
		return (
			<p className="px-4 pb-3 text-muted-foreground text-sm">
				{t("appBuilder.versions.emptyDiff")}
			</p>
		);
	}
	// The numstat covers every file, including binary ones the patch skips.
	const added = diff.data.numstat.reduce(
		(total, file) => total + file.insertions,
		0,
	);
	const removed = diff.data.numstat.reduce(
		(total, file) => total + file.deletions,
		0,
	);
	// LIMIT: the whole patch renders, up to 1 MB. Upgrade: collapse each DiffCard past 200 lines.
	return (
		<div className="flex flex-col gap-2 px-4 pb-3">
			<div className="font-mono text-muted-foreground text-xs tabular-nums">
				{t("appBuilder.versions.numstat", { added, removed })}
			</div>
			{files.map((file) => (
				<DiffCard key={file.path} path={file.path} lines={file.lines} />
			))}
		</div>
	);
}
