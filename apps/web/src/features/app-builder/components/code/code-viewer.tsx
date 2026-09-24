/**
 * Editor column of the Code view: the header (tree toggle, path breadcrumb,
 * copy, GitHub, Edit code), the body, and the status bar. The body shows
 * the lazy CodeMirror editor of components/code/code-editor.tsx, a message
 * for a file it cannot show, or a skeleton. Rendered by
 * components/code/code-view.tsx with the state of the file query.
 */

import { CODE_FILE_MAX_BYTES } from "@wandit/contracts";
import { Sentry } from "@wandit/observability/browser";
import { Button } from "@wandit/ui/components/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
} from "@wandit/ui/components/empty";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { Switch } from "@wandit/ui/components/switch";
import { cn } from "@wandit/ui/lib/utils";
import {
	Binary,
	ChevronRight,
	Copy,
	FileWarning,
	FileX,
	Lock,
	type LucideIcon,
	PanelLeftClose,
	PanelLeftOpen,
	TriangleAlert,
} from "lucide-react";
import { lazy, type ReactNode, Suspense, useId, useMemo } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n";
import type { CodeFile } from "../../api/dto";
import {
	codeLanguageFor,
	countLines,
	fileIconFor,
	fileNameOf,
} from "../../lib/code-files";
import { copyToClipboard } from "../../lib/helpers";
import { IconAction } from "../shell/top-bar";

/** Loads the CodeMirror chunk. code-view.tsx calls it early to start the download. */
export const loadCodeEditor = () => import("./code-editor");
const CodeEditor = lazy(loadCodeEditor);

/** What the body shows for the requested path. */
export type FileBody =
	/** The first answer for this path has not arrived. */
	| { kind: "loading" }
	/** The first load of this path failed. */
	| { kind: "failed" }
	/** `isStale` is true while `file` is the previous path and the new one loads. */
	| { kind: "file"; file: CodeFile; isStale: boolean };

export type CodeViewerProps = {
	/** The requested path. The breadcrumb shows it at once, before its file arrives. */
	path: string;
	/** Git branch of the snapshot, shown in the status bar. */
	branch: string;
	body: FileBody;
	/** Loads the file and the tree again after a failed load. */
	onRetry: () => void;
	/** True when the file tree column shows. */
	isTreeOpen: boolean;
	onToggleTree: () => void;
};

/** Widths of the code line bars of the skeleton, in percent, from a fixed list so each render matches. */
const LINE_BAR_WIDTHS = [
	38, 62, 54, 0, 71, 45, 83, 66, 0, 29, 58, 77, 49, 0, 64, 41,
];

/** Bars on the 20 px rhythm of the code lines. A 0 width is an empty line. */
export function CodeLinesSkeleton() {
	return (
		<div aria-hidden="true" className="flex flex-col gap-2 px-4 py-3">
			{LINE_BAR_WIDTHS.map((width, line) => (
				<Skeleton
					// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
					key={line}
					className={cn("h-3 rounded-full", width === 0 && "invisible")}
					style={{ width: `${width}%` }}
				/>
			))}
		</div>
	);
}

/** A file state in the body: an icon, one line of text, and an optional action. */
export function CodeMessage({
	icon: Icon,
	text,
	children,
}: {
	icon: LucideIcon;
	text: string;
	/** An optional control under the text, like the retry button. */
	children?: ReactNode;
}) {
	return (
		<Empty className="h-full min-w-0 flex-1 gap-4 p-6">
			<EmptyHeader>
				<EmptyMedia
					variant="icon"
					className="size-10 rounded-xl bg-muted text-muted-foreground"
				>
					<Icon className="size-5" strokeWidth={1.75} />
				</EmptyMedia>
				<EmptyDescription className="max-w-sm text-muted-foreground text-sm">
					{text}
				</EmptyDescription>
			</EmptyHeader>
			{children}
		</Empty>
	);
}

/** The body message of a file that the editor cannot show. */
function FileMessage({ file }: { file: Exclude<CodeFile, { kind: "text" }> }) {
	const { t, locale } = useTranslation();
	switch (file.kind) {
		case "binary":
			return (
				<CodeMessage
					icon={Binary}
					text={`${t("appBuilder.code.binaryFile")} · ${formatFileSize(file.size, locale)}`}
				/>
			);
		case "tooLarge":
			return (
				<CodeMessage
					icon={FileWarning}
					text={t("appBuilder.code.fileTooLarge", {
						limit: formatFileSize(CODE_FILE_MAX_BYTES, locale),
					})}
				/>
			);
		case "missing":
			return (
				<CodeMessage icon={FileX} text={t("appBuilder.code.fileMissing")} />
			);
	}
}

/**
 * A size in the locale, for example "42 bytes" or "1.4 kB". The API sends
 * bytes; from 1024 bytes on, the text shows kilobytes.
 */
function formatFileSize(bytes: number, locale: string): string {
	if (bytes < 1024) {
		return new Intl.NumberFormat(locale, {
			style: "unit",
			unit: "byte",
			unitDisplay: "long",
		}).format(bytes);
	}
	return new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "kilobyte",
		maximumFractionDigits: 1,
	}).format(bytes / 1024);
}

/** The editor column for one requested path. */
export function CodeViewer({
	path,
	branch,
	body,
	onRetry,
	isTreeOpen,
	onToggleTree,
}: CodeViewerProps) {
	const { t } = useTranslation();
	const editSwitchId = useId();
	const segments = path.split("/");
	const fileIcon = fileIconFor(fileNameOf(path));
	// The status bar and the copy button speak about the requested file
	// only, never about the previous one that stays on screen while loading.
	const currentFile =
		body.kind === "file" && !body.isStale ? body.file : undefined;
	const currentText = currentFile?.kind === "text" ? currentFile : undefined;
	const lineCount = useMemo(
		() => (currentText ? countLines(currentText.content) : 0),
		[currentText],
	);

	async function copyFile() {
		if (currentText && (await copyToClipboard(currentText.content))) {
			toast(t("appBuilder.chat.copied"));
		}
	}

	return (
		<div className="flex min-w-0 flex-1 flex-col">
			<header className="flex h-11 shrink-0 items-center gap-2 border-b px-2 text-[13px]">
				<IconAction
					label={t(
						isTreeOpen
							? "appBuilder.code.hideFiles"
							: "appBuilder.code.showFiles",
					)}
				>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-expanded={isTreeOpen}
						onClick={onToggleTree}
						className="shrink-0 rounded-full text-muted-foreground"
					>
						{isTreeOpen ? (
							<PanelLeftClose className="size-4 rtl:-scale-x-100" />
						) : (
							<PanelLeftOpen className="size-4 rtl:-scale-x-100" />
						)}
					</Button>
				</IconAction>
				{/* A path reads left to right in every locale. */}
				<nav
					dir="ltr"
					translate="no"
					className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden whitespace-nowrap text-muted-foreground"
				>
					{segments.map((segment, index) => {
						const isLast = index === segments.length - 1;
						// The path prefix is unique per segment, so it is the key.
						const key = segments.slice(0, index + 1).join("/");
						if (isLast) {
							return (
								<span
									key={key}
									className="flex min-w-0 shrink-0 items-center gap-1.5 font-medium text-foreground"
								>
									<fileIcon.Icon
										className={cn("size-3.5 shrink-0", fileIcon.colorClass)}
										strokeWidth={1.75}
									/>
									<span className="truncate">{segment}</span>
								</span>
							);
						}
						// A narrow card shows only the file name.
						return (
							<span
								key={key}
								className="@md/code:flex hidden min-w-0 items-center gap-1"
							>
								<span className="max-w-[14ch] truncate">{segment}</span>
								<ChevronRight className="size-3 shrink-0 text-muted-foreground/50" />
							</span>
						);
					})}
				</nav>
				<IconAction label={t("appBuilder.code.copyFile")}>
					<Button
						variant="ghost"
						size="icon-sm"
						disabled={currentText === undefined}
						onClick={() => void copyFile()}
						className="shrink-0 rounded-full text-muted-foreground"
					>
						<Copy className="size-4" />
					</Button>
				</IconAction>
				<div className="@3xl/code:flex hidden shrink-0 items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => toast(t("appBuilder.mock.notWired"))}
					>
						{t("appBuilder.code.github")}
					</Button>
					{/* Editing has no backend yet. The switch stays off and only explains that. */}
					<label
						htmlFor={editSwitchId}
						className="flex h-8 cursor-pointer items-center gap-2 rounded-full border px-3"
					>
						<span>{t("appBuilder.code.editCode")}</span>
						<Switch
							id={editSwitchId}
							size="sm"
							checked={false}
							onCheckedChange={() => toast(t("appBuilder.code.readOnly"))}
						/>
					</label>
				</div>
			</header>
			<div className="relative min-h-0 flex-1 bg-background">
				<FileBodyView body={body} onRetry={onRetry} />
			</div>
			<footer className="flex h-7 shrink-0 items-center gap-3 border-t px-3 text-muted-foreground text-xs">
				<span className="flex min-w-0 items-center gap-1.5">
					<span className="size-1.5 shrink-0 rounded-full bg-success" />
					<span className="truncate">
						{t("appBuilder.code.synced", { branch })}
					</span>
				</span>
				<span className="ms-auto flex shrink-0 items-center gap-3">
					{currentFile ? (
						<FileFacts file={currentFile} lineCount={lineCount} />
					) : null}
					<span className="flex items-center gap-1">
						<Lock className="size-3" />
						{t("appBuilder.code.readOnlyLabel")}
					</span>
				</span>
			</footer>
		</div>
	);
}

/** Language, line count, and size of the open file, in the status bar. */
function FileFacts({
	file,
	lineCount,
}: {
	file: CodeFile;
	/** Lines of a text file, from `countLines`. Unused for other kinds. */
	lineCount: number;
}) {
	const { t, locale } = useTranslation();
	if (file.kind !== "text" && file.kind !== "binary") return null;
	const language = codeLanguageFor(file.path);
	return (
		<>
			{file.kind === "text" ? (
				<>
					<bdi className="@md/code:inline hidden">
						{language?.label ?? t("appBuilder.code.plainText")}
					</bdi>
					<bdi>{t("appBuilder.code.lineCount", { count: lineCount })}</bdi>
				</>
			) : null}
			<bdi className="@md/code:inline hidden">
				{formatFileSize(file.size, locale)}
			</bdi>
		</>
	);
}

/** The body for each state of the file query. */
function FileBodyView({
	body,
	onRetry,
}: {
	body: FileBody;
	onRetry: () => void;
}) {
	const { t } = useTranslation();
	if (body.kind === "loading") return <CodeLinesSkeleton />;
	if (body.kind === "failed") {
		return (
			<CodeMessage icon={TriangleAlert} text={t("appBuilder.code.loadFailed")}>
				<Button variant="outline" size="sm" onClick={onRetry}>
					{t("appBuilder.code.retry")}
				</Button>
			</CodeMessage>
		);
	}
	const { file, isStale } = body;
	return (
		<>
			{/* A fast answer shows no flash: the bar and the dim start after 150 ms. */}
			{isStale ? (
				<div
					aria-hidden="true"
					className="absolute inset-x-0 top-0 z-10 h-0.5 animate-shimmer bg-[length:40%_100%] bg-[linear-gradient(90deg,transparent,var(--primary),transparent)] bg-no-repeat opacity-100 starting:opacity-0 transition-opacity delay-150 duration-200 motion-reduce:animate-none motion-reduce:bg-primary/40"
				/>
			) : null}
			<div
				aria-busy={isStale}
				className={cn(
					"h-full transition-opacity",
					isStale ? "opacity-55 delay-150 duration-200" : "opacity-100",
				)}
			>
				{file.kind === "text" ? (
					// A failed editor chunk (a deploy replaced it, or the network
					// dropped) shows a message here, not an error page for the builder.
					<Sentry.ErrorBoundary
						fallback={
							<CodeMessage
								icon={TriangleAlert}
								text={t("appBuilder.code.loadFailed")}
							/>
						}
					>
						<Suspense fallback={<CodeLinesSkeleton />}>
							<CodeEditor path={file.path} content={file.content} />
						</Suspense>
					</Sentry.ErrorBoundary>
				) : (
					<FileMessage file={file} />
				)}
			</div>
		</>
	);
}
