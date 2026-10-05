/**
 * Editor column of the Code view: the header (tree toggle, path breadcrumb,
 * language chip, copy), the body, and the status bar. The body shows the
 * lazy CodeMirror editor of components/code/code-editor.tsx, a message for
 * a file it cannot show, or a skeleton. code-view.tsx renders CodeViewer
 * with the state of the file query and reuses CodeMessage, RetryButton, and
 * the skeleton parts. file-tree.tsx imports CODE_BAR_CLASS.
 */

import type { Icon } from "@phosphor-icons/react";
import { ArrowClockwiseIcon } from "@phosphor-icons/react/ArrowClockwise";
import { BinaryIcon } from "@phosphor-icons/react/Binary";
import { CopyIcon } from "@phosphor-icons/react/Copy";
import { FileDashedIcon } from "@phosphor-icons/react/FileDashed";
import { FileXIcon } from "@phosphor-icons/react/FileX";
import { LockSimpleIcon } from "@phosphor-icons/react/LockSimple";
import { SidebarSimpleIcon } from "@phosphor-icons/react/SidebarSimple";
import { WarningCircleIcon } from "@phosphor-icons/react/WarningCircle";
import { CODE_FILE_MAX_BYTES } from "@wandit/contracts";
import { Sentry } from "@wandit/observability/browser";
import { Button } from "@wandit/ui/components/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@wandit/ui/components/empty";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
import { lazy, type ReactNode, Suspense, useMemo } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n";
import type { CodeFile } from "../../api/dto";
import {
	CODE_FONT_FAMILY,
	codeLanguageFor,
	countLines,
	fileIconFor,
	fileNameOf,
} from "../../lib/code-files";
import { copyToClipboard } from "../../lib/helpers";
import { PANEL_SECONDARY_BUTTON_CLASS } from "../more/panel-shell";
import { IconAction, TOOLBAR_ICON_BUTTON_CLASS } from "../shell/top-bar";

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

/**
 * A bar at the top of a Code view column: 48 px, bottom hairline. The tree
 * header, the editor header, and their skeletons share it, so the two
 * hairlines line up.
 */
export const CODE_BAR_CLASS =
	"flex h-12 shrink-0 items-center border-night/[0.07] border-b dark:border-white/[0.07]";

/**
 * The faint fill of a skeleton bar. The kit default is the beige accent,
 * which reads as a stain on the paper card.
 */
export const CODE_SKELETON_CLASS =
	"rounded-full bg-night/[0.06] dark:bg-white/[0.06]";

/** Widths of the code line bars of the skeleton, in percent, from a fixed list so each render matches. */
const LINE_BAR_WIDTHS = [
	38, 62, 54, 0, 71, 45, 83, 66, 0, 29, 58, 77, 49, 0, 64, 41,
];

/** Bars on the 20 px rhythm of the code lines. A 0 width is an empty line. */
export function CodeLinesSkeleton() {
	return (
		<div aria-hidden="true" className="flex flex-col gap-2 px-5 py-4">
			{LINE_BAR_WIDTHS.map((width, line) => (
				<Skeleton
					// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
					key={line}
					className={cn("h-3", CODE_SKELETON_CLASS, width === 0 && "invisible")}
					style={{ width: `${width}%` }}
				/>
			))}
		</div>
	);
}

/**
 * A centered state: a medallion, a title, a line of text, and an optional
 * action. The Code view uses it for asleep, no files, a failed load, and
 * the files that the editor cannot show.
 */
export function CodeMessage({
	icon: StateIcon,
	title,
	text,
	children,
}: {
	/** A Phosphor icon. The medallion draws it in the duotone weight. */
	icon: Icon;
	/** A short name of the state, like "Your app is asleep". */
	title: string;
	/** One or two sentences under the title. */
	text: string;
	/** An optional control under the text, like the retry button. */
	children?: ReactNode;
}) {
	return (
		<Empty className="h-full min-w-0 flex-1 gap-5 p-8">
			<EmptyHeader className="max-w-[20rem] gap-1.5">
				<EmptyMedia className="mb-3 size-14 rounded-full bg-night/[0.05] text-night/70 dark:bg-white/[0.06] dark:text-foreground/70">
					<StateIcon aria-hidden weight="duotone" className="size-7" />
				</EmptyMedia>
				<EmptyTitle className="font-grotesk font-semibold text-[17px] text-night tracking-normal dark:text-foreground">
					{title}
				</EmptyTitle>
				<EmptyDescription className="font-sans text-night/60 text-sm/relaxed dark:text-foreground/60">
					{text}
				</EmptyDescription>
			</EmptyHeader>
			{children}
		</Empty>
	);
}

/**
 * The pill under a failed load. It loads the code again. It has the look of
 * the retry pill of the Cloud panels.
 */
export function RetryButton({ onRetry }: { onRetry: () => void }) {
	const { t } = useTranslation();
	return (
		<Button
			variant="outline"
			size="sm"
			onClick={onRetry}
			className={PANEL_SECONDARY_BUTTON_CLASS}
		>
			<ArrowClockwiseIcon aria-hidden weight="bold" />
			{t("appBuilder.code.retry")}
		</Button>
	);
}

/** The body message of a file that the editor cannot show. */
function FileMessage({ file }: { file: Exclude<CodeFile, { kind: "text" }> }) {
	const { t, locale } = useTranslation();
	switch (file.kind) {
		case "binary":
			return (
				<CodeMessage
					icon={BinaryIcon}
					title={t("appBuilder.code.binaryTitle")}
					text={t("appBuilder.code.binaryFile")}
				/>
			);
		case "tooLarge":
			return (
				<CodeMessage
					icon={FileDashedIcon}
					title={t("appBuilder.code.tooLargeTitle")}
					text={t("appBuilder.code.fileTooLarge", {
						limit: formatFileSize(CODE_FILE_MAX_BYTES, locale),
					})}
				/>
			);
		case "missing":
			return (
				<CodeMessage
					icon={FileXIcon}
					title={t("appBuilder.code.missingTitle")}
					text={t("appBuilder.code.fileMissing")}
				/>
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
	const segments = path.split("/");
	const fileIcon = fileIconFor(fileNameOf(path));
	// The chip, the status bar, and the copy button speak about the requested
	// file only, never about the previous one that stays on screen while loading.
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
			<header className={cn(CODE_BAR_CLASS, "gap-2 px-2")}>
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
						className={TOOLBAR_ICON_BUTTON_CLASS}
					>
						{/* The tree sits on the start side, so the icon mirrors in Arabic. */}
						<SidebarSimpleIcon
							aria-hidden
							weight="bold"
							className="rtl:-scale-x-100"
						/>
					</Button>
				</IconAction>
				{/* A path reads left to right in every locale. In Arabic it still sits next to the toggle. */}
				<nav
					dir="ltr"
					translate="no"
					style={{ fontFamily: CODE_FONT_FAMILY }}
					className="flex min-w-0 flex-1 items-center overflow-hidden whitespace-nowrap text-[12.5px] text-night/45 tracking-normal rtl:justify-end dark:text-foreground/45"
				>
					{segments.map((segment, index) => {
						const isLast = index === segments.length - 1;
						// The path prefix is unique per segment, so it is the key.
						const key = segments.slice(0, index + 1).join("/");
						if (isLast) {
							return (
								<span
									key={key}
									className="flex min-w-0 shrink-0 items-center gap-1.5 text-night dark:text-foreground"
								>
									<fileIcon.Icon
										aria-hidden
										weight="duotone"
										className={cn("size-4 shrink-0", fileIcon.colorClass)}
									/>
									<span className="truncate">{segment}</span>
								</span>
							);
						}
						// A narrow card shows only the file name.
						return (
							<span
								key={key}
								className="@md/code:flex hidden min-w-0 items-center"
							>
								<span className="max-w-[16ch] truncate">{segment}</span>
								<span
									aria-hidden="true"
									className="px-1.5 text-night/25 dark:text-foreground/25"
								>
									/
								</span>
							</span>
						);
					})}
				</nav>
				{currentText ? (
					<bdi className="flex h-6 shrink-0 items-center rounded-full bg-night/[0.05] px-2.5 font-grotesk font-medium text-[11.5px] text-night/60 dark:bg-white/[0.06] dark:text-foreground/60">
						{codeLanguageFor(currentText.path)?.label ??
							t("appBuilder.code.plainText")}
					</bdi>
				) : null}
				<IconAction label={t("appBuilder.code.copyFile")}>
					<Button
						variant="ghost"
						size="icon-sm"
						disabled={currentText === undefined}
						onClick={() => void copyFile()}
						className={TOOLBAR_ICON_BUTTON_CLASS}
					>
						<CopyIcon aria-hidden weight="bold" />
					</Button>
				</IconAction>
			</header>
			<div className="relative min-h-0 flex-1">
				<FileBodyView body={body} onRetry={onRetry} />
			</div>
			<footer className="flex h-8 shrink-0 items-center gap-4 border-night/[0.07] border-t px-4 font-grotesk text-[11.5px] text-night/50 tabular-nums dark:border-white/[0.07] dark:text-foreground/50">
				<span className="flex min-w-0 items-center gap-1.5">
					<span
						aria-hidden="true"
						className="size-1.5 shrink-0 rounded-full bg-success"
					/>
					<span className="truncate">
						{t("appBuilder.code.synced", { branch })}
					</span>
				</span>
				<span className="ms-auto flex shrink-0 items-center gap-4">
					{currentFile ? (
						<FileFacts file={currentFile} lineCount={lineCount} />
					) : null}
					<span className="flex items-center gap-1">
						<LockSimpleIcon aria-hidden weight="bold" className="size-3" />
						{t("appBuilder.code.readOnlyLabel")}
					</span>
				</span>
			</footer>
		</div>
	);
}

/** Line count and size of the open file, in the status bar. */
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
	return (
		<>
			{file.kind === "text" ? (
				<bdi>{t("appBuilder.code.lineCount", { count: lineCount })}</bdi>
			) : null}
			{/* A narrow card keeps the line count of a text file and drops its
			    size. A binary file has only its size, so it shows at every width. */}
			<bdi className={cn(file.kind === "text" && "@md/code:inline hidden")}>
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
			<CodeMessage
				icon={WarningCircleIcon}
				title={t("appBuilder.code.loadFailed")}
				text={t("appBuilder.code.loadFailedHint")}
			>
				<RetryButton onRetry={onRetry} />
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
					// React.lazy keeps the failed import, so only a page reload helps.
					<Sentry.ErrorBoundary
						fallback={
							<CodeMessage
								icon={WarningCircleIcon}
								title={t("appBuilder.code.loadFailed")}
								text={t("appBuilder.code.reloadHint")}
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
