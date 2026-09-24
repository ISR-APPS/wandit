/**
 * Code view of the app builder: the file search and the file tree on the
 * left, the read-only viewer on the right. Reads codeSnapshotQuery and
 * codeFileQuery, which read the running sandbox through the V2 API. An
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
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@wandit/ui/components/input-group";
import { Search } from "lucide-react";
import { useState } from "react";

import Loader from "@/components/loader";
import { useTranslation } from "@/lib/i18n";
import {
	appBuilderKeys,
	codeFileQuery,
	codeSnapshotQuery,
} from "../../api/app-builder.queries";
import { CodeViewer } from "./code-viewer";
import { FileTree } from "./file-tree";

export type CodeViewProps = {
	projectId: string;
	/** Path from the URL, or undefined to open the default file of the snapshot. */
	filePath: string | undefined;
	onSelectFile: (path: string) => void;
};

/** Shows a message, not an error page, for an asleep sandbox, no files, or a failed load. */
export function CodeView({ projectId, filePath, onSelectFile }: CodeViewProps) {
	const { t } = useTranslation();
	const [query, setQuery] = useState("");
	const snapshot = useQuery(codeSnapshotQuery(projectId));

	if (snapshot.isPending) {
		return <Loader />;
	}
	// A failed refetch keeps the last good data; only a first load that
	// failed has no data.
	if (snapshot.data === undefined) {
		return <LoadFailed onRetry={() => void snapshot.refetch()} />;
	}
	// The server never wakes a sandbox for a read. The next turn wakes it,
	// and the turn end refetches the snapshot.
	if (snapshot.data === null) {
		return <CodeMessage text={t("appBuilder.code.asleep")} />;
	}
	const selectedPath = filePath ?? snapshot.data.defaultFilePath;
	// The default path is null only when the tree holds no file.
	if (selectedPath === null) {
		return <CodeMessage text={t("appBuilder.code.noFiles")} />;
	}

	return (
		<div className="flex h-full min-h-0">
			<div className="flex w-[236px] shrink-0 flex-col border-e">
				<InputGroup className="m-3 w-auto shrink-0 rounded-xl">
					<InputGroupAddon>
						<Search className="size-3.5" />
					</InputGroupAddon>
					<InputGroupInput
						type="search"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={t("appBuilder.code.searchFiles")}
						aria-label={t("appBuilder.code.searchFiles")}
					/>
				</InputGroup>
				<div className="min-h-0 flex-1 overflow-y-auto">
					<FileTree
						nodes={snapshot.data.tree}
						selectedPath={selectedPath}
						onSelect={onSelectFile}
						query={query}
					/>
				</div>
			</div>
			<OpenFile
				projectId={projectId}
				path={selectedPath}
				branch={snapshot.data.branch}
			/>
		</div>
	);
}

/**
 * The viewer of one path. `keepPreviousData` keeps the old file on screen
 * while the next one loads, so a file click shows no loader.
 */
function OpenFile({
	projectId,
	path,
	branch,
}: {
	projectId: string;
	/** Path relative to the worktree root, from the URL or the snapshot. */
	path: string;
	/** Git branch of the snapshot, shown in the viewer header. */
	branch: string;
}) {
	const queryClient = useQueryClient();
	const file = useQuery({
		...codeFileQuery(projectId, path),
		placeholderData: keepPreviousData,
	});

	if (file.isPending) {
		return (
			<div className="min-w-0 flex-1">
				<Loader />
			</div>
		);
	}
	if (file.data === undefined) {
		// A file error can be a 409: the sandbox fell asleep. The retry
		// refetches the tree too, so the view can show the asleep message.
		return (
			<LoadFailed
				onRetry={() =>
					void queryClient.invalidateQueries({
						queryKey: appBuilderKeys.code(projectId),
					})
				}
			/>
		);
	}
	return <CodeViewer file={file.data} branch={branch} />;
}

function CodeMessage({ text }: { text: string }) {
	return (
		<p className="flex h-full min-w-0 flex-1 items-center justify-center p-6 text-center text-muted-foreground text-sm">
			{text}
		</p>
	);
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
	const { t } = useTranslation();
	return (
		<div className="flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
			<p className="text-muted-foreground text-sm">
				{t("appBuilder.code.loadFailed")}
			</p>
			<Button variant="outline" size="sm" onClick={onRetry}>
				{t("appBuilder.code.retry")}
			</Button>
		</div>
	);
}
