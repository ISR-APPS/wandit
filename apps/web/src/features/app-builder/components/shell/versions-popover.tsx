/**
 * History button of the top bar and its popover with the version list.
 * Rendered by components/shell/top-bar.tsx on every screen width. The list
 * reads appVersionsQuery when the popover opens, 50 versions per page, with
 * "Load more" for older ones. The page gives the live commit for the Live
 * badge. Each older row can open its diff (versionDiffQuery, parsed by
 * lib/unified-diff.ts) or restore the version through useRestoreVersion
 * after a confirm dialog.
 * The spec renders VersionsList without the popover. The Diff toggle mounts
 * VersionDiff, which reads versionDiffQuery, so the list needs a
 * QueryClientProvider around it.
 */

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
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
import { History, LoaderCircle } from "lucide-react";
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
	/** Sha of the commit the live web app runs, from the publish status. Null when nothing is live. */
	liveCommitSha: string | null;
	/** Runs after a restore succeeds. The page mints a new preview token with it. */
	onRestored: () => void;
};

/** The History icon button. Its popover loads the versions only while it is open. */
export function VersionsPopover({
	projectId,
	liveCommitSha,
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
			{/* 26 rem so a diff line fits under a row. On a phone it keeps 12 px from each edge. */}
			{/* The list scrolls under the title when it is taller than the space under the button. */}
			<PopoverContent
				align="start"
				collisionPadding={12}
				className="flex max-h-(--radix-popover-content-available-height) w-[26rem] max-w-[calc(100vw-24px)] flex-col p-0"
			>
				<div className="shrink-0 border-b px-4 py-3 font-semibold text-sm">
					{t("appBuilder.versions.title")}
				</div>
				<div className="min-h-0 overflow-y-auto">
					<VersionsBody
						projectId={projectId}
						liveCommitSha={liveCommitSha}
						onRestored={onRestored}
					/>
				</div>
			</PopoverContent>
		</Popover>
	);
}

/**
 * Loads the versions when the popover opens and owns the restore mutation.
 * Three skeleton rows stand in while it loads. "Load more" fetches the next
 * page while the API answers a cursor.
 */
function VersionsBody({
	projectId,
	liveCommitSha,
	onRestored,
}: Pick<VersionsPopoverProps, "projectId" | "liveCommitSha" | "onRestored">) {
	const { t } = useTranslation();
	const versions = useInfiniteQuery(appVersionsQuery(projectId));
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
	// A failed "Load more" keeps the loaded rows. Only a first load without rows shows the error.
	if (versions.data === undefined) {
		return (
			<p className="px-4 py-3 text-muted-foreground text-sm">
				{t("errors.generic")}
			</p>
		);
	}
	const items = versions.data.pages.flatMap((page) => page.items);
	return (
		<>
			<VersionsList
				versions={items}
				projectId={projectId}
				liveCommitSha={liveCommitSha}
				isRestoring={restore.isPending}
				onRestore={(sha) =>
					restore.mutate(
						// The API compares this head with the real one and swaps on it.
						{ sha, expectedHeadSha: items[0].sha },
					)
				}
			/>
			{versions.hasNextPage ? (
				<div className="flex flex-col items-center gap-1 border-t p-2">
					{versions.isFetchNextPageError ? (
						<p className="text-muted-foreground text-xs">
							{t("errors.generic")}
						</p>
					) : null}
					{/* A click during a refetch cancels it and keeps the old head on top. */}
					<Button
						variant="ghost"
						size="sm"
						disabled={versions.isFetching}
						onClick={() => void versions.fetchNextPage()}
					>
						{versions.isFetchingNextPage ? (
							<LoaderCircle className="size-3.5 animate-spin" />
						) : null}
						{t("appBuilder.versions.loadMore")}
					</Button>
				</div>
			) : null}
		</>
	);
}

export type VersionsListProps = {
	/** Newest first, every loaded page of appVersionsQuery. The first row is the current version. */
	versions: AppCommit[];
	/** Sha of the version to restore. The parent runs the mutation. */
	onRestore: (sha: string) => void;
	/** Route param of the open project. The diff block queries with it. */
	projectId: string;
	/** Sha of the commit the live web app runs. Its row gets the Live mark. Null when nothing is live. */
	liveCommitSha: string | null;
	/** True while a restore runs. Every Restore button is disabled then. */
	isRestoring: boolean;
};

/**
 * One row per version: short sha, first message line, age, the Live mark on
 * the published version, and the source badge. The first row is the
 * current version; every other row also has a Diff toggle and a Restore
 * button that opens a confirm dialog.
 */
export function VersionsList({
	versions,
	onRestore,
	projectId,
	liveCommitSha,
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
								{/* The Live mark sits in this line, so a phone row keeps room for the message. */}
								<div className="flex items-center gap-1.5 text-muted-foreground text-xs">
									{formatRelativeTime(version.createdAt, locale)}
									{version.sha === liveCommitSha ? (
										<span className="flex items-center gap-1 font-medium text-success-text">
											<span
												aria-hidden
												className="size-1.5 rounded-full bg-success"
											/>
											{t("appBuilder.publish.live")}
										</span>
									) : null}
								</div>
							</div>
							{/* A phone row has no room for it next to Diff and Restore; the message names a restore. */}
							<Badge variant="secondary" className="max-sm:hidden">
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
