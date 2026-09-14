/**
 * Code view of the app builder: the file search and the file tree on the
 * left, the read-only viewer on the right. Reads codeSnapshotQuery and
 * codeFileQuery and suspends until both are loaded.
 * Rendered by pages/app-builder-page.tsx inside a Suspense boundary. The
 * page owns the selected path in the URL and passes onSelectFile.
 */

import { useSuspenseQuery } from "@tanstack/react-query";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@wandit/ui/components/input-group";
import { Search } from "lucide-react";
import { useDeferredValue, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import {
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

export function CodeView({ projectId, filePath, onSelectFile }: CodeViewProps) {
	const { t } = useTranslation();
	const [query, setQuery] = useState("");
	const { data: snapshot } = useSuspenseQuery(codeSnapshotQuery(projectId));
	const selectedPath = filePath ?? snapshot.defaultFilePath;
	// The deferred path lets React keep the old file on screen while the next one loads.
	// Without it every file click shows the Suspense fallback of the whole view.
	const loadedPath = useDeferredValue(selectedPath);
	const { data: file } = useSuspenseQuery(codeFileQuery(projectId, loadedPath));

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
						nodes={snapshot.tree}
						selectedPath={selectedPath}
						onSelect={onSelectFile}
						query={query}
					/>
				</div>
			</div>
			<CodeViewer
				file={file}
				branch={snapshot.branch}
				selectedPath={loadedPath}
			/>
		</div>
	);
}
