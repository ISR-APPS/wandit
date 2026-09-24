/**
 * Code view of the app builder: the file tree on the start side, the
 * read-only editor column next to it. Reads codeSnapshotQuery and
 * codeFileQuery, which read the running sandbox through the V2 API; the
 * snapshot also fills the file cache, so most clicks need no request. An
 * asleep sandbox, a project without files, and a failed load each show a
 * message inside the view, never an error page.
 * Rendered by pages/app-builder-page.tsx. The page owns the selected path
 * in the URL and passes onSelectFile.
 */

import {
	keepPreviousData,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { Button } from "@wandit/ui/components/button";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { useIsMobile } from "@wandit/ui/hooks/use-mobile";
import { cn } from "@wandit/ui/lib/utils";
import { FolderOpen, MoonStar, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import {
	appBuilderKeys,
	codeFileQuery,
	codeSnapshotQuery,
} from "../../api/app-builder.queries";
import {
	CodeLinesSkeleton,
	CodeMessage,
	CodeViewer,
	type FileBody,
	loadCodeEditor,
} from "./code-viewer";
import { FileTree } from "./file-tree";

export type CodeViewProps = {
	projectId: string;
	/** Path from the URL, or undefined to open the default file of the snapshot. */
	filePath: string | undefined;
	onSelectFile: (path: string) => void;
};

/** Tree bar widths (percent) and depths of the first-load skeleton, fixed so each render matches. */
const TREE_BARS = [
	{ width: 55, depth: 0 },
	{ width: 70, depth: 1 },
	{ width: 45, depth: 1 },
	{ width: 80, depth: 0 },
	{ width: 60, depth: 1 },
	{ width: 50, depth: 2 },
	{ width: 75, depth: 2 },
	{ width: 40, depth: 1 },
	{ width: 65, depth: 0 },
];

/** Shows a message, not an error page, for an asleep sandbox, no files, or a failed load. */
export function CodeView({ projectId, filePath, onSelectFile }: CodeViewProps) {
	const { t } = useTranslation();
	const isMobile = useIsMobile();
	const snapshot = useQuery(codeSnapshotQuery(projectId));
	// The click shows the file at once. The URL follows when the router
	// commits; a new URL path (back, forward, a link) wins again.
	const [pickedPath, setPickedPath] = useState(filePath);
	const [urlPath, setUrlPath] = useState(filePath);
	if (urlPath !== filePath) {
		setUrlPath(filePath);
		setPickedPath(filePath);
	}
	// null follows the default: open on a wide screen, closed on a phone.
	const [treeChoice, setTreeChoice] = useState<boolean | null>(null);
	const isTreeOpen = treeChoice ?? !isMobile;

	// The CodeMirror chunk downloads while the tree and the first file load.
	useEffect(() => {
		loadCodeEditor().catch(() => {
			// A failed early download only loses the head start: the lazy
			// editor fails the same way, and its error boundary in
			// code-viewer.tsx shows the message and reports it.
		});
	}, []);

	if (snapshot.isPending) {
		return <CodeViewSkeleton />;
	}
	// A failed refetch keeps the last good data; only a first load that
	// failed has no data.
	if (snapshot.data === undefined) {
		return (
			<CodeMessage icon={TriangleAlert} text={t("appBuilder.code.loadFailed")}>
				<Button
					variant="outline"
					size="sm"
					onClick={() => void snapshot.refetch()}
				>
					{t("appBuilder.code.retry")}
				</Button>
			</CodeMessage>
		);
	}
	// The server never wakes a sandbox for a read. The next turn wakes it,
	// and the turn end refetches the snapshot.
	if (snapshot.data === null) {
		return <CodeMessage icon={MoonStar} text={t("appBuilder.code.asleep")} />;
	}
	const selectedPath = pickedPath ?? snapshot.data.defaultFilePath;
	// The default path is null only when the tree holds no file.
	if (selectedPath === null) {
		return (
			<CodeMessage icon={FolderOpen} text={t("appBuilder.code.noFiles")} />
		);
	}

	function selectFile(path: string) {
		setPickedPath(path);
		onSelectFile(path);
		// On a phone the tree covers the card, so a pick shows the file.
		if (isMobile) setTreeChoice(false);
	}

	return (
		<div className="@container/code flex h-full min-h-0">
			{/* Hidden, not unmounted: the search text and the open folders stay. */}
			<div
				className={cn(
					"min-h-0 shrink-0 flex-col border-e",
					isTreeOpen ? "flex" : "hidden",
					isMobile ? "w-full" : "w-60",
				)}
			>
				<FileTree
					nodes={snapshot.data.tree}
					selectedPath={selectedPath}
					onSelect={selectFile}
				/>
			</div>
			<div
				className={cn(
					"min-w-0 flex-1",
					isMobile && isTreeOpen ? "hidden" : "flex",
				)}
			>
				<OpenFile
					projectId={projectId}
					path={selectedPath}
					branch={snapshot.data.branch}
					isTreeOpen={isTreeOpen}
					onToggleTree={() => setTreeChoice(!isTreeOpen)}
				/>
			</div>
		</div>
	);
}

/**
 * The editor column of one path. `keepPreviousData` keeps the old file on
 * screen while an uncached file loads, so a click never shows a blank body.
 */
function OpenFile({
	projectId,
	path,
	branch,
	isTreeOpen,
	onToggleTree,
}: {
	projectId: string;
	/** Path relative to the worktree root, from a click, the URL, or the snapshot. */
	path: string;
	/** Git branch of the snapshot, shown in the status bar. */
	branch: string;
	isTreeOpen: boolean;
	onToggleTree: () => void;
}) {
	const queryClient = useQueryClient();
	const file = useQuery({
		...codeFileQuery(projectId, path),
		placeholderData: keepPreviousData,
	});
	let body: FileBody;
	if (file.data !== undefined) {
		body = { kind: "file", file: file.data, isStale: file.isPlaceholderData };
	} else if (file.isPending) {
		body = { kind: "loading" };
	} else {
		body = { kind: "failed" };
	}

	return (
		<CodeViewer
			path={path}
			branch={branch}
			body={body}
			// A file error can be a 409: the sandbox fell asleep. The retry
			// refetches the tree too, so the view can show the asleep message.
			onRetry={() =>
				void queryClient.invalidateQueries({
					queryKey: appBuilderKeys.code(projectId),
				})
			}
			isTreeOpen={isTreeOpen}
			onToggleTree={onToggleTree}
		/>
	);
}

/** The first-load layout: tree bars, a header bar, and code line bars. */
function CodeViewSkeleton() {
	return (
		<div aria-busy="true" className="flex h-full min-h-0">
			<div className="hidden w-60 shrink-0 flex-col border-e md:flex">
				<div className="flex h-11 shrink-0 items-center border-b px-2">
					<Skeleton className="h-8 w-full rounded-md" />
				</div>
				<div className="flex flex-col gap-4 px-4 py-3">
					{TREE_BARS.map((bar, row) => (
						<Skeleton
							// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
							key={row}
							className="h-2.5 rounded-full"
							style={{
								width: `${bar.width}%`,
								marginInlineStart: bar.depth * 12,
							}}
						/>
					))}
				</div>
			</div>
			<div className="flex min-w-0 flex-1 flex-col">
				<div className="flex h-11 shrink-0 items-center border-b px-4">
					<Skeleton className="h-3 w-[30%] rounded-full" />
				</div>
				<div className="min-h-0 flex-1 bg-background">
					<CodeLinesSkeleton />
				</div>
			</div>
		</div>
	);
}
