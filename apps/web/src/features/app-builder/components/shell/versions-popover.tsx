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

import { CaretDownIcon } from "@phosphor-icons/react/CaretDown";
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react/ClockCounterClockwise";
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
import { Button } from "@wandit/ui/components/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@wandit/ui/components/popover";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
import { useState } from "react";

import { formatRelativeTime, useTranslation } from "@/lib/i18n";
import { useRestoreVersion } from "../../api/app-builder.mutations";
import {
	appVersionsQuery,
	versionDiffQuery,
} from "../../api/app-builder.queries";
import { parseUnifiedDiff } from "../../lib/unified-diff";
import { DiffCard } from "../chat/diff-card";
import { HISTORY_ACTION_CLASS } from "./android-build-card";
import { IconAction, TOOLBAR_ICON_BUTTON_CLASS } from "./top-bar";

// Seven characters name a commit, like `git log --oneline`.
const SHORT_SHA_LENGTH = 7;

// Diff and Restore: the ghost pill of the publish history. An open diff keeps the pressed tint through aria-expanded.
const ROW_ACTION_CLASS = cn(
	HISTORY_ACTION_CLASS,
	"aria-expanded:bg-popover-foreground/[0.08] aria-expanded:text-popover-foreground",
);

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
			<IconAction label={t("appBuilder.topBar.history")}>
				<PopoverTrigger asChild>
					<Button
						variant="ghost"
						size="icon-sm"
						className={TOOLBAR_ICON_BUTTON_CLASS}
					>
						<ClockCounterClockwiseIcon aria-hidden weight="bold" />
					</Button>
				</PopoverTrigger>
			</IconAction>
			{/* 26 rem so a diff line fits under a row. A long history scrolls inside the sheet. */}
			<PopoverContent
				align="start"
				className="flex max-h-[min(36rem,var(--radix-popover-content-available-height))] w-[26rem] max-w-[calc(100vw-24px)] flex-col p-0"
			>
				<h2 className="flex h-12 shrink-0 items-center border-popover-foreground/[0.07] border-b px-4 font-grotesk font-semibold text-[15px]">
					{t("appBuilder.versions.title")}
				</h2>
				<div className="min-h-0 overflow-y-auto p-1.5">
					<VersionsBody projectId={projectId} onRestored={onRestored} />
				</div>
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
			<div className="flex flex-col gap-1.5 p-1">
				<Skeleton className="h-12 rounded-[14px]" />
				<Skeleton className="h-12 rounded-[14px]" />
				<Skeleton className="h-12 rounded-[14px]" />
			</div>
		);
	}
	if (versions.isError) {
		return (
			<p className="px-3 py-6 text-center text-popover-foreground/55 text-sm">
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
 * chip. The first row is the current version; every other row also has a
 * Diff toggle and a Restore button that opens a confirm dialog.
 */
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
			<p className="px-3 py-6 text-center text-popover-foreground/55 text-sm">
				{t("appBuilder.versions.empty")}
			</p>
		);
	}

	return (
		<ul className="flex flex-col gap-0.5">
			{versions.map((version, index) => {
				const isCurrent = index === 0;
				const isDiffOpen = openDiff === version.sha;
				return (
					<li
						key={version.sha}
						className="rounded-[14px] transition-colors hover:bg-popover-foreground/[0.035] has-[[aria-expanded=true]]:bg-popover-foreground/[0.035]"
					>
						<div className="flex items-center gap-3 px-2.5 py-2.5">
							{/* A commit id reads left to right in every locale. */}
							<span
								dir="ltr"
								className="shrink-0 rounded-md bg-popover-foreground/[0.05] px-1.5 py-0.5 font-mono text-[11.5px] text-popover-foreground/70"
							>
								{version.sha.slice(0, SHORT_SHA_LENGTH)}
							</span>
							<div className="min-w-0 flex-1">
								{/* w-fit puts a Latin message on the start side of an Arabic page, like the line under it. */}
								<div
									className="w-fit max-w-full truncate font-grotesk font-medium text-sm leading-tight"
									dir="auto"
								>
									{version.message.split("\n")[0]}
								</div>
								<div className="mt-1 flex items-center gap-1.5 text-popover-foreground/50 text-xs">
									<span className="truncate">
										{formatRelativeTime(version.createdAt, locale)}
									</span>
									<span className="inline-flex h-[18px] shrink-0 items-center rounded-full bg-popover-foreground/[0.05] px-1.5 font-grotesk font-medium text-[11px] text-popover-foreground/60">
										{t(`appBuilder.versions.source.${version.source}`)}
									</span>
								</div>
							</div>
							{isCurrent ? (
								<span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-spark/20 px-2.5 font-grotesk font-semibold text-[11.5px] text-night dark:bg-spark/15 dark:text-spark">
									<span
										aria-hidden
										className="size-1.5 rounded-full bg-spark-deep dark:bg-spark"
									/>
									{t("appBuilder.versions.current")}
								</span>
							) : (
								<div className="flex shrink-0 items-center">
									<button
										type="button"
										className={ROW_ACTION_CLASS}
										aria-expanded={isDiffOpen}
										onClick={() => setOpenDiff(isDiffOpen ? null : version.sha)}
									>
										{t("appBuilder.versions.diff")}
										<CaretDownIcon
											aria-hidden
											weight="bold"
											className={cn(
												"size-3 transition-transform duration-200 motion-reduce:transition-none",
												isDiffOpen && "rotate-180",
											)}
										/>
									</button>
									<AlertDialog>
										<AlertDialogTrigger asChild>
											{/* A second restore during the first sends a stale head sha and ends in VERSION_CONFLICT. */}
											<button
												type="button"
												className={ROW_ACTION_CLASS}
												disabled={isRestoring}
											>
												{t("appBuilder.versions.restore")}
											</button>
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
								</div>
							)}
						</div>
						{isDiffOpen ? (
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
			<div className="px-2.5 pb-3">
				<Skeleton className="h-16 rounded-[14px]" />
			</div>
		);
	}
	if (diff.isError) {
		return (
			<p className="px-2.5 pb-3 text-popover-foreground/55 text-sm">
				{t("errors.generic")}
			</p>
		);
	}
	const files = parseUnifiedDiff(diff.data.patch);
	if (files.length === 0) {
		return (
			<p className="px-2.5 pb-3 text-popover-foreground/55 text-sm">
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
		<div className="flex flex-col gap-2 px-2.5 pb-3">
			<div className="font-mono text-popover-foreground/55 text-xs tabular-nums">
				{t("appBuilder.versions.numstat", { added, removed })}
			</div>
			{files.map((file) => (
				<DiffCard key={file.path} path={file.path} lines={file.lines} />
			))}
		</div>
	);
}
