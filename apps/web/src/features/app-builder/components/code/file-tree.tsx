/**
 * File tree of the Code view: the "Files" header with the file count, the
 * search box, then folders that open and close and files the user picks,
 * with file-type icons. @headless-tree gives the WAI-ARIA tree: one tab
 * stop, arrow keys, Home and End.
 * Rendered by components/code/code-view.tsx, which owns the selected path.
 * `filterTree` is pure and has its own spec cases.
 */

import {
	hotkeysCoreFeature,
	type ItemInstance,
	syncDataLoaderFeature,
} from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { CaretRightIcon } from "@phosphor-icons/react/CaretRight";
import { FolderIcon } from "@phosphor-icons/react/Folder";
import { FolderOpenIcon } from "@phosphor-icons/react/FolderOpen";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/MagnifyingGlass";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@wandit/ui/components/input-group";
import { cn } from "@wandit/ui/lib/utils";
import {
	type KeyboardEvent,
	type ReactNode,
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { useTranslation } from "@/lib/i18n";
import type { CodeTreeNode } from "../../api/dto";
import { fileIconFor } from "../../lib/code-files";
import { CODE_BAR_CLASS } from "./code-viewer";

export type FileTreeProps = {
	nodes: CodeTreeNode[];
	/** Path of the open file. Its ancestor folders open when it changes. */
	selectedPath: string;
	onSelect: (path: string) => void;
};

/** Id of the synthetic root item. A real path is never empty. */
const ROOT_ID = "";
/** Inset of a depth-0 row, CSS px. */
const ROW_INSET_PX = 8;
/** Extra inset per tree depth, CSS px. */
const DEPTH_INDENT_PX = 12;
/** Half the 16 px caret slot: an indent guide runs under the caret center. */
const CARET_CENTER_PX = 8;

/** The folders and files of a filtered tree, by path, for the headless tree loader. */
type TreeIndex = {
	nodeByPath: Map<string, CodeTreeNode>;
	/** Child paths of each folder path; the root is `ROOT_ID`. */
	childPaths: Map<string, string[]>;
	/** Every folder path, so a search can open them all. */
	folderPaths: string[];
};

/**
 * Files whose full path contains the query, case-insensitive, with the
 * folders that hold them. A folder name like "hammam" finds its files.
 * An empty query keeps every node. Folders keep their order.
 */
export function filterTree(
	nodes: CodeTreeNode[],
	query: string,
): CodeTreeNode[] {
	const needle = query.trim().toLowerCase();
	if (!needle) return nodes;
	const kept: CodeTreeNode[] = [];
	for (const node of nodes) {
		if (node.kind === "file") {
			if (node.path.toLowerCase().includes(needle)) kept.push(node);
			continue;
		}
		const children = filterTree(node.children, needle);
		if (children.length > 0) kept.push({ ...node, children });
	}
	return kept;
}

/**
 * True for a dot folder like `.claude`. The callers pass top-level nodes
 * only. It holds about 140 agent files, not app code, so it starts closed
 * and the file count skips it.
 */
function isToolFolder(node: CodeTreeNode): boolean {
	return node.kind === "folder" && node.name.startsWith(".");
}

/** Every file under `nodes`, at any depth. Folders do not count. */
function countFiles(nodes: CodeTreeNode[]): number {
	let count = 0;
	for (const node of nodes) {
		count += node.kind === "file" ? 1 : countFiles(node.children);
	}
	return count;
}

function indexTree(nodes: CodeTreeNode[]): TreeIndex {
	const index: TreeIndex = {
		nodeByPath: new Map(),
		childPaths: new Map(),
		folderPaths: [],
	};
	function add(list: CodeTreeNode[], parentPath: string) {
		index.childPaths.set(
			parentPath,
			list.map((node) => node.path),
		);
		for (const node of list) {
			index.nodeByPath.set(node.path, node);
			if (node.kind === "folder") {
				index.folderPaths.push(node.path);
				add(node.children, node.path);
			}
		}
	}
	add(nodes, ROOT_ID);
	return index;
}

/** The folder paths above a file: `a/b/c.ts` gives `a` and `a/b`. */
function ancestorsOf(path: string): string[] {
	const segments = path.split("/");
	return segments
		.slice(0, -1)
		.map((_, depth) => segments.slice(0, depth + 1).join("/"));
}

/**
 * Folders open on first render: the top-level folders, except a tool
 * folder, and every ancestor of the selected file.
 */
function initialOpenFolders(
	nodes: CodeTreeNode[],
	selectedPath: string,
): string[] {
	const open = new Set(ancestorsOf(selectedPath));
	for (const node of nodes) {
		if (node.kind === "folder" && !isToolFolder(node)) {
			open.add(node.path);
		}
	}
	return [...open];
}

/** The name with the first case-insensitive match of `needle` in a `<mark>`. */
function highlightMatch(name: string, needle: string): ReactNode {
	const start = needle ? name.toLowerCase().indexOf(needle) : -1;
	if (start === -1) return name;
	const end = start + needle.length;
	return (
		<>
			{name.slice(0, start)}
			<mark className="rounded-[3px] bg-spark/30 text-night dark:bg-spark/25 dark:text-foreground">
				{name.slice(start, end)}
			</mark>
			{name.slice(end)}
		</>
	);
}

/**
 * Owns the search text, the open folders, and the keyboard focus of the
 * tree. Calls `onSelect` for a file row only; a folder row opens or closes.
 */
export function FileTree({ nodes, selectedPath, onSelect }: FileTreeProps) {
	const { t, dir } = useTranslation();
	const [query, setQuery] = useState("");
	// The tree follows the box one frame later, so typing stays smooth on a large tree.
	const needle = useDeferredValue(query).trim().toLowerCase();
	const isSearching = needle !== "";
	const index = useMemo(
		() => indexTree(filterTree(nodes, needle)),
		[nodes, needle],
	);
	// The count gives the app files only: the files of a tool folder do not count.
	const fileCount = useMemo(
		() => countFiles(nodes.filter((node) => !isToolFolder(node))),
		[nodes],
	);
	const [expandedItems, setExpandedItems] = useState(() =>
		initialOpenFolders(nodes, selectedPath),
	);
	const [focusedItem, setFocusedItem] = useState<string | null>(selectedPath);

	// A new open file (a click, back or forward, a URL) opens its folders
	// and takes the keyboard focus, like in an editor.
	const [revealedPath, setRevealedPath] = useState(selectedPath);
	if (revealedPath !== selectedPath) {
		setRevealedPath(selectedPath);
		setFocusedItem(selectedPath);
		setExpandedItems((open) => [
			...new Set([...open, ...ancestorsOf(selectedPath)]),
		]);
	}

	const openFolders = isSearching ? index.folderPaths : expandedItems;
	const openFolderSet = new Set(openFolders);
	// A hidden focused row leaves the tree with no tab stop; null gives
	// the stop to the first row.
	const isFocusedRowShown =
		focusedItem !== null &&
		index.nodeByPath.has(focusedItem) &&
		ancestorsOf(focusedItem).every((folder) => openFolderSet.has(folder));

	const tree = useTree<CodeTreeNode | null>({
		rootItemId: ROOT_ID,
		getItemName: (item) => item.getItemData()?.name ?? "",
		isItemFolder: (item) => item.getItemData()?.kind !== "file",
		dataLoader: {
			getItem: (path) => index.nodeByPath.get(path) ?? null,
			getChildren: (path) => index.childPaths.get(path) ?? [],
		},
		state: {
			expandedItems: openFolders,
			focusedItem: isFocusedRowShown ? focusedItem : null,
		},
		// Every folder stays open while a search is active, as the matches need.
		setExpandedItems: isSearching ? () => {} : setExpandedItems,
		setFocusedItem,
		onPrimaryAction: (item) => {
			const node = item.getItemData();
			if (node?.kind === "file") onSelect(node.path);
		},
		// Arabic reads right to left, so the open and close arrows swap.
		hotkeys:
			dir === "rtl"
				? {
						expandOrDown: { hotkey: "ArrowLeft" },
						collapseOrUp: { hotkey: "ArrowRight" },
					}
				: undefined,
		features: [syncDataLoaderFeature, hotkeysCoreFeature],
	});

	// The loader reads `index`; a new index needs a new flat row list.
	// biome-ignore lint/correctness/useExhaustiveDependencies: a new index is the rebuild trigger
	useEffect(() => {
		tree.rebuildTree();
	}, [tree, index]);

	// Shows the row of a new open file once, as soon as the row exists: the
	// first rows appear only after the tree mounts.
	const shownPathRef = useRef<string | null>(null);
	useEffect(() => {
		if (shownPathRef.current === selectedPath) return;
		const element = tree.getItemInstance(selectedPath).getElement();
		// A phone keeps the tree hidden until "Show files". A scroll in a
		// hidden tree does nothing, so the reveal waits for a visible row.
		if (!element?.checkVisibility()) return;
		element.scrollIntoView({ block: "nearest" });
		shownPathRef.current = selectedPath;
	});

	// LIMIT: every visible row renders, about 5,000 rows during a search on
	// the largest tree. Upgrade: virtualize with @tanstack/react-virtual.
	const items = tree.getItems();

	function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === "Escape") {
			setQuery("");
			return;
		}
		if (event.key === "ArrowDown") {
			event.preventDefault();
			items[0]?.setFocused();
			tree.updateDomFocus();
			return;
		}
		if (event.key === "Enter" && isSearching) {
			const firstFile = items.find((item) => !item.isFolder());
			if (firstFile) firstFile.primaryAction();
		}
	}

	return (
		<>
			<div className={cn(CODE_BAR_CLASS, "gap-2 px-4")}>
				<h2 className="font-grotesk font-semibold text-[13px] text-night dark:text-foreground">
					{t("appBuilder.code.files")}
				</h2>
				<span className="grid h-5 min-w-5 place-items-center rounded-full bg-night/[0.06] px-1.5 font-grotesk font-medium text-[11px] text-night/60 tabular-nums dark:bg-white/[0.08] dark:text-foreground/60">
					{fileCount}
				</span>
			</div>
			<div className="shrink-0 px-3 pt-3 pb-1.5">
				<InputGroup className="h-8 rounded-full border-night/[0.09] bg-white shadow-none dark:border-white/[0.08] dark:bg-white/[0.04]">
					<InputGroupAddon className="ps-3">
						<MagnifyingGlassIcon
							aria-hidden
							weight="bold"
							className="size-3.5 text-night/45 dark:text-foreground/45"
						/>
					</InputGroupAddon>
					<InputGroupInput
						type="search"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						onKeyDown={onSearchKeyDown}
						placeholder={t("appBuilder.code.searchFiles")}
						aria-label={t("appBuilder.code.searchFiles")}
						className="font-sans text-[13px] text-night placeholder:text-night/40 dark:text-foreground dark:placeholder:text-foreground/40"
					/>
				</InputGroup>
			</div>
			<div className="scroll-warm min-h-0 flex-1 overflow-y-auto px-1.5 pt-1 pb-3">
				{/* The filtered index is ready in the first render; the tree rows
				    come one render later, so they cannot decide "no match". */}
				{index.childPaths.get(ROOT_ID)?.length === 0 ? (
					<p className="px-3 py-2 font-sans text-[13px] text-night/55 dark:text-foreground/55">
						{t("appBuilder.code.noMatch")}
					</p>
				) : (
					<div
						{...tree.getContainerProps(t("appBuilder.code.treeAriaLabel"))}
						className="flex flex-col gap-px outline-none"
					>
						{items.map((item) => (
							<TreeRow
								key={item.getId()}
								item={item}
								isSelected={item.getId() === selectedPath}
								needle={needle}
							/>
						))}
					</div>
				)}
			</div>
		</>
	);
}

function TreeRow({
	item,
	isSelected,
	needle,
}: {
	item: ItemInstance<CodeTreeNode | null>;
	/** True for the row of the open file. */
	isSelected: boolean;
	/** Lowercase search text; its first match in the name is marked. */
	needle: string;
}) {
	const node = item.getItemData();
	if (node === null) return null;
	const { level } = item.getItemMeta();
	const isFolder = node.kind === "folder";
	const isOpen = isFolder && item.isExpanded();
	const FolderStateIcon = isOpen ? FolderOpenIcon : FolderIcon;
	const fileIcon = isFolder ? null : fileIconFor(node.name);

	return (
		<button
			{...item.getProps()}
			type="button"
			// getProps sets the role too; the explicit role lets the linter
			// check the ARIA props.
			role="treeitem"
			aria-selected={isSelected}
			title={node.path}
			style={{ paddingInlineStart: ROW_INSET_PX + level * DEPTH_INDENT_PX }}
			className={cn(
				"relative flex h-8 pointer-coarse:h-10 w-full shrink-0 items-center gap-1.5 rounded-[10px] pe-2 text-start font-sans text-[13px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ember/40 focus-visible:ring-inset",
				isSelected
					? "bg-spark/[0.14] font-medium text-night focus:bg-spark/20 dark:bg-spark/[0.16] dark:text-foreground dark:focus:bg-spark/[0.22]"
					: "text-night/75 hover:bg-night/[0.04] hover:text-night dark:text-foreground/75 dark:hover:bg-white/[0.05] dark:hover:text-foreground",
			)}
		>
			{/* One guide per ancestor level, under the center of that ancestor's caret. */}
			{Array.from({ length: level }, (_, depth) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: one guide per depth, and the depth is its identity
					key={depth}
					aria-hidden="true"
					className="absolute inset-y-0 w-px bg-night/[0.08] dark:bg-white/[0.08]"
					style={{
						insetInlineStart:
							ROW_INSET_PX + depth * DEPTH_INDENT_PX + CARET_CENTER_PX,
					}}
				/>
			))}
			<span className="flex size-4 shrink-0 items-center justify-center">
				{isFolder ? (
					<CaretRightIcon
						aria-hidden
						weight="bold"
						className={cn(
							"size-3 text-night/40 transition-transform duration-150 motion-reduce:transition-none dark:text-foreground/40",
							// A closed folder points to the end side, so it points left in Arabic.
							isOpen ? "rotate-90" : "rtl:rotate-180",
						)}
					/>
				) : null}
			</span>
			{fileIcon ? (
				<fileIcon.Icon
					aria-hidden
					weight="duotone"
					className={cn("size-4 shrink-0", fileIcon.colorClass)}
				/>
			) : (
				<FolderStateIcon
					aria-hidden
					weight="duotone"
					className="size-4 shrink-0 text-spark-deep dark:text-spark"
				/>
			)}
			{/* A name like `.claude` must not show as `claude.` in Arabic. */}
			<span dir="ltr" translate="no" className="truncate">
				{highlightMatch(node.name, needle)}
			</span>
		</button>
	);
}
