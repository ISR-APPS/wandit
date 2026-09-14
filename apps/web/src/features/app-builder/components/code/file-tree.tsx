/**
 * File tree of the Code view: folders that open and close, files the user
 * picks, and a name filter from the search box above the tree.
 * Rendered by components/code/code-view.tsx, which owns the search text and
 * the selected path. `filterTree` is pure and has its own spec cases.
 */

import { cn } from "@wandit/ui/lib/utils";
import { ChevronRight, FileCode } from "lucide-react";
import { type ReactNode, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import type { CodeTreeNode } from "../../api/dto";

export type FileTreeProps = {
	nodes: CodeTreeNode[];
	/** Path of the open file. Its ancestor folders start open. */
	selectedPath: string;
	onSelect: (path: string) => void;
	/** Text of the search box. Empty shows every node. */
	query: string;
};

/** Inset of a depth-0 row, CSS px. With the nav padding, the icon lines up with the search icon. */
const ROW_INSET_PX = 12;
/** Extra inset per tree depth, CSS px. */
const DEPTH_INDENT_PX = 12;
const ROW_CLASS =
	"flex h-7 w-full items-center gap-1.5 rounded-md pe-2 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50";
const IDLE_ROW_CLASS =
	"text-foreground/85 hover:bg-accent/50 hover:text-foreground";

/**
 * Files whose name contains the query, case-insensitive, with the folders
 * that hold them. An empty query keeps every node. Folders keep their order.
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
			if (node.name.toLowerCase().includes(needle)) kept.push(node);
			continue;
		}
		const children = filterTree(node.children, needle);
		if (children.length > 0) kept.push({ ...node, children });
	}
	return kept;
}

/** Folders open on first render: the top-level folders and every ancestor of the selected file. */
function initialOpenFolders(
	nodes: CodeTreeNode[],
	selectedPath: string,
): Set<string> {
	const open = new Set<string>();
	for (const node of nodes) {
		if (node.kind === "folder") open.add(node.path);
	}
	const segments = selectedPath.split("/");
	for (let depth = 1; depth < segments.length; depth += 1) {
		open.add(segments.slice(0, depth).join("/"));
	}
	return open;
}

export function FileTree({
	nodes,
	selectedPath,
	onSelect,
	query,
}: FileTreeProps) {
	const { t } = useTranslation();
	const [openFolders, setOpenFolders] = useState(() =>
		initialOpenFolders(nodes, selectedPath),
	);
	const visible = filterTree(nodes, query);
	// A search opens every folder, so each match is visible.
	const isSearching = query.trim().length > 0;

	function toggleFolder(path: string) {
		setOpenFolders((current) => {
			const next = new Set(current);
			if (next.has(path)) next.delete(path);
			else next.add(path);
			return next;
		});
	}

	function renderRows(list: CodeTreeNode[], depth: number): ReactNode {
		return (
			<ul className="flex flex-col gap-px">
				{list.map((node) => {
					const inset = {
						paddingInlineStart: ROW_INSET_PX + depth * DEPTH_INDENT_PX,
					};
					if (node.kind === "folder") {
						const isOpen = isSearching || openFolders.has(node.path);
						return (
							<li key={node.path}>
								<button
									type="button"
									aria-expanded={isOpen}
									aria-label={t(
										isOpen
											? "appBuilder.code.collapse"
											: "appBuilder.code.expand",
										{ name: node.name },
									)}
									onClick={() => toggleFolder(node.path)}
									style={inset}
									className={cn(ROW_CLASS, IDLE_ROW_CLASS)}
								>
									<ChevronRight
										className={cn(
											"size-3.5 shrink-0 text-muted-foreground/70 transition-transform",
											isOpen ? "rotate-90" : "rtl:rotate-180",
										)}
									/>
									<span className="truncate">{node.name}</span>
								</button>
								{isOpen ? renderRows(node.children, depth + 1) : null}
							</li>
						);
					}
					const isSelected = node.path === selectedPath;
					return (
						<li key={node.path}>
							<button
								type="button"
								aria-current={isSelected ? "true" : undefined}
								onClick={() => onSelect(node.path)}
								style={inset}
								className={cn(
									ROW_CLASS,
									isSelected
										? "bg-primary/10 font-medium text-primary"
										: IDLE_ROW_CLASS,
								)}
							>
								<FileCode className="size-3.5 shrink-0 text-muted-foreground/70" />
								<span className="truncate">{node.name}</span>
							</button>
						</li>
					);
				})}
			</ul>
		);
	}

	return (
		<nav aria-label={t("appBuilder.code.treeAriaLabel")} className="px-2 pb-3">
			{visible.length === 0 ? (
				<p className="px-2 py-1 text-[13px] text-muted-foreground">
					{t("appBuilder.code.noMatch")}
				</p>
			) : (
				renderRows(visible, 0)
			)}
		</nav>
	);
}
