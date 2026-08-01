// The Page tab: preview stage rendering the active landing-page version in a
// sandboxed iframe (mobile frame by default), plus generating/empty/failed
// states. LIVE data: the overview query polls while a build runs in the
// background (queued/generating) and the version's HTML is fetched separately
// once it exists — see api/pages.queries.ts. Its controls (version switcher,
// viewport toggle, preview actions) live in the main card's header — see
// shell/main-pane-header.tsx / page-toolbar.tsx (real page versions
// slice).
// WS2: the preview doubles as the click-to-target / inline-editor surface —
// the srcDoc gets the preview-editor script injected at render time (never
// into the canonical HTML), the postMessage bridge feeds the PageEditor
// context, and the left-pane edit panel (edit-panel.tsx, swapped in for the
// chat by workspace-page.tsx) + save bar/dialogs render the pending op batch
// (contract §6/§7.1/§11).
// Failure-state strings are hardcoded English this pass (same temporary rule
// as the request-tray chrome); they move to the dictionary later.

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@wandit/ui/components/alert-dialog";
import { Button } from "@wandit/ui/components/button";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
import { AlertTriangle, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import type * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Spark } from "@/components/logo";
import { useDictionary, useTranslation } from "@/lib/i18n";
import { useVersionHtmlQuery } from "../../api/pages.queries";
import { useAiChatControls } from "../../lib/ai-chat-context";
import { shouldShowSaveBar } from "../../lib/page-editor-state";
import { injectPreviewEditor } from "../../lib/preview-editor/inject";
import {
	type EditorMode,
	type PreviewCommentPin,
	type PreviewSelectionRect,
	setAiTargetsMessage,
	setCommentPinsMessage,
	setModeMessage,
	setSuspendedMessage,
} from "../../lib/preview-editor/messages";
import { usePreviewBridge } from "../../lib/preview-editor/use-preview-bridge";
import { useWorkspace } from "../../lib/store";
import {
	dispatchTargetComments,
	type TargetCommentDispatchResult,
} from "../../lib/target-comment-dispatch";
import { usePageEditor } from "../../lib/use-page-editor";
import type { TargetCommentEntry } from "../../lib/use-target-comments";
import {
	TargetCommentPopover,
	targetCommentEntry,
} from "./target-comment-popover";
import { TargetCommentReviewBar } from "./target-comment-review-bar";

export function previewReadyMessages(
	mode: EditorMode,
	pins: readonly PreviewCommentPin[],
	aiWids: readonly string[],
	suspended: boolean,
) {
	return [
		setModeMessage(mode),
		setCommentPinsMessage(pins),
		setAiTargetsMessage(aiWids),
		setSuspendedMessage(suspended),
	] as const;
}

export function syncPreviewSuspension(
	post: (message: ReturnType<typeof setSuspendedMessage>) => void,
	suspended: boolean,
): void {
	post(setSuspendedMessage(suspended));
}

export function routePreviewAskAiShortcut(
	mode: EditorMode,
	focus: () => void,
): boolean {
	if (mode !== "select") return false;
	focus();
	return true;
}

export function selectionRectAfterSelect(
	current: PreviewSelectionRect | null,
	wid: string,
): PreviewSelectionRect | null {
	return current?.wid === wid ? current : null;
}

export async function dispatchPopoverTargetComment({
	entry,
	queuedComments,
	enqueue,
	dispatch,
}: {
	entry: TargetCommentEntry;
	queuedComments: readonly TargetCommentEntry[];
	enqueue: (entry: TargetCommentEntry) => boolean;
	dispatch: (
		comments: readonly TargetCommentEntry[],
	) => Promise<TargetCommentDispatchResult>;
}): Promise<TargetCommentDispatchResult> {
	if (queuedComments.length === 0) return dispatch([entry]);
	if (!enqueue(entry)) return "blocked";
	return dispatch([...queuedComments, entry]);
}

export function targetCommentDraftVersionAfterDispatch(
	current: number,
	result: TargetCommentDispatchResult,
): number {
	return result === "sent" ? current + 1 : current;
}

export function PageTab({ reloadKey }: { reloadKey: number }) {
	return (
		<div className="flex h-full min-h-0 flex-col">
			<SaveBar />
			<HistoricalVersionBanner />
			<div className="flex min-h-0 flex-1">
				{/* The stage floor is plain parchment (3a reference) — one step
				    lighter than the sand card that hosts it. The stage keeps the
				    full row width: edit (Modifier) controls live in the LEFT pane
				    (edit-panel.tsx, swapped in for the chat by workspace-page.tsx),
				    not in a rail beside the preview. */}
				<div className="relative min-h-0 flex-1 overflow-hidden bg-background">
					<PreviewStage reloadKey={reloadKey} />
				</div>
			</div>
			<DiscardConfirmDialog />
			<ConflictDialog />
		</div>
	);
}

function HistoricalVersionBanner() {
	const { t } = useTranslation();
	const {
		previewVersion,
		serverActiveVersion,
		isPreviewingHistorical,
		backToLatest,
		restorePreviewVersion,
		restorePending,
	} = useWorkspace();

	if (!isPreviewingHistorical || !previewVersion) return null;

	return (
		<div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-amber-500/25 border-b bg-amber-500/8 px-3.5 py-2">
			<p className="text-amber-900 text-xs dark:text-amber-100">
				<VersionMessage
					message={t("workspace.page.viewingReadOnly", {
						n: previewVersion.number,
					})}
					number={previewVersion.number}
				/>
			</p>
			<div className="flex items-center gap-1.5">
				<Button
					variant="outline"
					size="sm"
					className="h-7 bg-background/70"
					disabled={restorePending || !serverActiveVersion}
					onClick={restorePreviewVersion}
				>
					{restorePending
						? t("workspace.page.restoring")
						: t("workspace.page.restoreVersion")}
				</Button>
				<Button
					variant="ghost"
					size="sm"
					className="h-7"
					disabled={restorePending}
					onClick={backToLatest}
				>
					{t("workspace.page.backToLatest")}
				</Button>
			</div>
		</div>
	);
}

/** Keeps the compact vN marker isolated inside RTL translated sentences. */
function VersionMessage({
	message,
	number,
}: {
	message: string;
	number: number;
}) {
	const marker = `v${number}`;
	const index = message.indexOf(marker);
	if (index === -1) return <span dir="auto">{message}</span>;

	return (
		<span dir="auto">
			{message.slice(0, index)}
			<bdi dir="ltr">{marker}</bdi>
			{message.slice(index + marker.length)}
		</span>
	);
}

/** Slim pending-changes strip above the stage — appears with the first
    recorded op, persists ONE new version per Save (contract §7.1). */
export function SaveBar() {
	const { t } = useTranslation();
	const { isPreviewingHistorical } = useWorkspace();
	const editor = usePageEditor();
	if (!shouldShowSaveBar(editor.dirtyCount, isPreviewingHistorical))
		return null;
	return (
		<div className="flex shrink-0 items-center justify-between gap-3 border-b bg-card px-3.5 py-2">
			<span className="text-muted-foreground text-xs">
				{t("workspace.page.editor.changesCount", {
					count: editor.dirtyCount,
				})}
			</span>
			<div className="flex items-center gap-1.5">
				<Button
					variant="ghost"
					size="sm"
					className="h-7"
					disabled={editor.isSaving}
					onClick={() => editor.openDiscardPrompt(null)}
				>
					{t("workspace.page.editor.discard")}
				</Button>
				<Button
					size="sm"
					className="h-7"
					disabled={editor.isSaving}
					onClick={() => void editor.save()}
				>
					{editor.isSaving ? (
						<Loader2 className="size-3.5 animate-spin" aria-hidden />
					) : null}
					{t("workspace.page.editor.save")}
				</Button>
			</div>
		</div>
	);
}

function DiscardConfirmDialog() {
	const { t } = useTranslation();
	const editor = usePageEditor();
	return (
		<AlertDialog
			open={editor.discardPrompt !== null}
			onOpenChange={(open) => {
				if (!open) editor.cancelDiscardPrompt();
			}}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{t("workspace.page.editor.discardConfirm")}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{t("workspace.page.editor.changesCount", {
							count: editor.dirtyCount,
						})}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel onClick={editor.cancelDiscardPrompt}>
						{t("workspace.page.editor.discardKeep")}
					</AlertDialogCancel>
					<AlertDialogAction onClick={editor.confirmDiscardPrompt}>
						{t("workspace.page.editor.discard")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

/** 409 VERSION_CONFLICT — the only sane recovery is reload-from-latest
    (contract §7.1: client should refetch and re-edit). */
function ConflictDialog() {
	const { t } = useTranslation();
	const editor = usePageEditor();
	return (
		<AlertDialog open={editor.conflictOpen}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{t("workspace.page.editor.conflictTitle")}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{t("workspace.page.editor.conflictBody")}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogAction onClick={editor.resolveConflict}>
						{t("workspace.page.editor.conflictReload")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

function PreviewStage({ reloadKey }: { reloadKey: number }) {
	const { t } = useTranslation();
	const {
		project,
		viewport,
		pageOverview,
		pageOverviewPending,
		previewVersion,
		isPreviewingHistorical,
		isGenerating,
		pendingVersionNumber,
	} = useWorkspace();
	const editor = usePageEditor();
	const { aiTargets, sendText, status: chatStatus } = useAiChatControls();
	// Immutable HTML, fetched once per version (staleTime Infinity).
	const htmlQuery = useVersionHtmlQuery(previewVersion?.id);
	const html = htmlQuery.data?.html ?? "";
	const previewMode = isPreviewingHistorical ? "browse" : editor.mode;

	// A historical canvas is strictly read-only. Pending edits made against the
	// active version are preserved, but its selection and mode are cleared.
	useEffect(() => {
		if (isPreviewingHistorical) editor.forceBrowse();
	}, [editor.forceBrowse, isPreviewingHistorical]);

	// The cache keeps the CANONICAL html; the editor script is injected at
	// render time only (contract §11 — never part of published output).
	const previewHtml = useMemo(
		() => (html ? injectPreviewEditor(html) : html),
		[html],
	);

	const stageRef = useRef<HTMLDivElement>(null);
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const [selectionRect, setSelectionRect] =
		useState<PreviewSelectionRect | null>(null);
	const [targetCommentDraftVersion, setTargetCommentDraftVersion] = useState(0);
	const modeRef = useRef(previewMode);
	modeRef.current = previewMode;
	const aiTargetWids = useMemo(
		() => aiTargets.map(({ wid }) => wid),
		[aiTargets],
	);
	// The wid of the LAST select the user produced in this document — the
	// only element a text-edited message may target. Deliberately not
	// cleared on deselect/chip-clear (the editor script emits text-edited
	// BEFORE deselect, and a chip clear can race a still-open contentEditable
	// session); reset on every iframe remount (onReady).
	const lastSelectWidRef = useRef<string | null>(null);

	// Same-frame forgery guard: generated page JS shares the iframe's
	// contentWindow with the injected editor script, so the `event.source`
	// check alone cannot tell them apart — any child message is spoofable
	// from inside the sandbox. Gate what each message may do: selections
	// only while a targeting mode is active, text edits only for the element
	// the user actually selected (the editor script always emits `select`
	// from a real click before any `text-edited` for that element). Residual
	// risk — a hostile page forging select+text-edited while the user is
	// targeting — stays visible in the inspector/save bar and only persists
	// through an explicit user Save of plain text (the server escapes it).
	const post = usePreviewBridge({
		iframeRef,
		onSelect: (selection) => {
			if (modeRef.current === "browse") return;
			setSelectionRect((current) =>
				selectionRectAfterSelect(current, selection.wid),
			);
			lastSelectWidRef.current = selection.wid;
			editor.setSelection(selection);
		},
		onDeselect: () => {
			setSelectionRect(null);
			editor.setSelection(null);
		},
		onSelectionRect: (rect) => {
			if (rect === null) {
				setSelectionRect(null);
				return;
			}
			if (
				modeRef.current === "select" &&
				lastSelectWidRef.current === rect.wid
			) {
				setSelectionRect(rect);
			}
		},
		onEscape: editor.handleEscape,
		onAskAiShortcut: () => {
			routePreviewAskAiShortcut(modeRef.current, editor.focusTargetComment);
		},
		onTextEdited: (wid, value, flattenedWids) => {
			if (modeRef.current === "browse") return;
			if (lastSelectWidRef.current !== wid) return;
			editor.recordText(wid, value, flattenedWids);
		},
		// The iframe remounts per version/reload/discard — sync the mode as
		// soon as its editor script boots, then re-apply any pending live
		// tweaks (edits recorded during an in-flight save survive the remount
		// as pending state and must stay visible).
		onReady: () => {
			lastSelectWidRef.current = null;
			setSelectionRect(null);
			for (const message of previewReadyMessages(
				modeRef.current,
				editor.targetCommentPins,
				aiTargetWids,
				editor.isAskAiDispatching,
			)) {
				iframeRef.current?.contentWindow?.postMessage(message, "*");
			}
			if (!isPreviewingHistorical) editor.replayPending();
		},
	});

	// Panels (element/theme) post live messages through the provider.
	useEffect(() => {
		editor.registerPost(post);
		return () => editor.registerPost(null);
	}, [editor.registerPost, post]);

	// Mode toggles arrive from the toolbar — mirror them into the iframe.
	useEffect(() => {
		post(setModeMessage(previewMode));
		if (previewMode !== "select") setSelectionRect(null);
	}, [post, previewMode]);

	useEffect(() => {
		post(setCommentPinsMessage(editor.targetCommentPins));
	}, [editor.targetCommentPins, post]);

	useEffect(() => {
		post(setAiTargetsMessage(aiTargetWids));
	}, [aiTargetWids, post]);

	// Freeze direct iframe edits for the whole scoped Ask-AI dispatch: the
	// auto-save, the AI turn, and its ready/error completion. onReady above
	// mirrors the same state when a version refresh remounts the iframe mid-turn.
	useEffect(() => {
		syncPreviewSuspension(post, editor.isAskAiDispatching);
	}, [editor.isAskAiDispatching, post]);

	useEffect(() => {
		if (editor.prunedTargetCommentCount === 0) return;
		toast.info(
			t("workspace.page.editor.targetRemoved", {
				count: editor.prunedTargetCommentCount,
			}),
		);
		editor.acknowledgeTargetCommentsPruned();
	}, [
		editor.acknowledgeTargetCommentsPruned,
		editor.prunedTargetCommentCount,
		t,
	]);

	const dispatchComments = async (
		comments: Parameters<typeof dispatchTargetComments>[0]["comments"],
	) => {
		const result = await dispatchTargetComments({
			comments,
			begin: editor.beginAskAiDispatch,
			end: editor.endAskAiDispatch,
			save: editor.save,
			send: sendText,
			onSendFailure: () => toast.error(t("workspace.page.editor.askAiFailed")),
			onSuccess: editor.clearTargetComments,
		});
		setTargetCommentDraftVersion((current) =>
			targetCommentDraftVersionAfterDispatch(current, result),
		);
		return result;
	};

	const attempt = pageOverview?.latestAttempt ?? null;

	if (pageOverviewPending || (previewVersion && htmlQuery.isPending)) {
		return (
			<div className="relative flex h-full items-center justify-center p-6">
				<Skeleton className="h-full max-h-[720px] w-[390px] max-w-full rounded-[2rem]" />
			</div>
		);
	}

	if (!previewVersion) {
		return (
			<div className="relative flex h-full items-center justify-center p-6">
				{isGenerating ? (
					<GeneratingPanel pendingVersionNumber={pendingVersionNumber} />
				) : attempt?.status === "failed" ? (
					<FailedPanel error={attempt.error} />
				) : (
					<EmptyPreview />
				)}
			</div>
		);
	}

	const mobile = viewport === "mobile";
	const selection = editor.selection;
	const selectedComment = selection
		? (editor.targetComments.find(({ wid }) => wid === selection.wid) ?? null)
		: null;
	const dispatchDisabled =
		editor.isAskAiDispatching ||
		editor.isSaving ||
		chatStatus === "submitted" ||
		chatStatus === "streaming";
	const showTargetPopover =
		previewMode === "select" &&
		selection !== null &&
		selectionRect?.wid === selection.wid;

	return (
		<div
			ref={stageRef}
			className="relative flex h-full items-center justify-center p-4 md:p-6"
		>
			<span className="absolute start-4 top-3.5 z-10 text-muted-foreground text-xs">
				{mobile
					? t("workspace.page.viewportMobile")
					: t("workspace.page.viewportDesktop")}
			</span>
			{attempt?.status === "failed" ? (
				// A later build failed but this version still stands — quiet note
				// instead of hijacking the whole stage.
				<div className="absolute top-3 left-1/2 z-10 flex max-w-[80%] -translate-x-1/2 items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-destructive text-xs">
					<AlertTriangle className="size-3 shrink-0" aria-hidden />
					<span className="min-w-0 truncate">
						{attempt.error ?? "The last build failed."}
					</span>
				</div>
			) : null}
			<motion.div
				layout
				transition={{ type: "spring", bounce: 0.14, duration: 0.55 }}
				className={cn(
					"relative flex min-h-0 overflow-hidden",
					mobile
						? // Dark phone bezel (3a reference): the generated page is the
							// only place the system goes dark.
							"h-full max-h-[632px] w-[304px] max-w-full rounded-[38px] border border-black/12 bg-[#0a0a0c] p-2 shadow-[0_40px_80px_-30px_rgb(0_0_0_/_0.4)]"
						: "h-full w-full max-w-[1440px] rounded-2xl border bg-white shadow-shell",
				)}
			>
				<div
					className={cn(
						"relative flex min-h-0 flex-1 overflow-hidden",
						// The screen stays void-dark so the load-in feels like a phone
						// waking up; the iframe paints its own page background.
						mobile ? "rounded-[31px] bg-void" : "rounded-none bg-white",
					)}
				>
					<PreviewFrame
						key={`${previewVersion.id}-${reloadKey}-${viewport}-${editor.discardCount}`}
						html={previewHtml}
						title={`${project?.name ?? t("workspace.page.previewFallback")} — v${previewVersion.number}`}
						frameRef={iframeRef}
					/>
					{/* Bezel handle bar — physically centered; no reading direction. */}
					{mobile ? (
						<span
							aria-hidden
							className="pointer-events-none absolute top-2 left-1/2 z-10 h-[5px] w-[70px] -translate-x-1/2 rounded-full bg-white/18"
						/>
					) : null}
				</div>
				{/* While editing, the overlay would swallow the editor's clicks —
				    keep it browse-only (the toolbar still shows build status). */}
				{isGenerating && !isPreviewingHistorical && previewMode === "browse" ? (
					<div className="absolute inset-0 z-10 grid place-items-center bg-background/55 backdrop-blur-[2px]">
						<GeneratingPanel pendingVersionNumber={pendingVersionNumber} />
					</div>
				) : null}
			</motion.div>
			{showTargetPopover && selection && selectionRect ? (
				<TargetCommentPopover
					key={`${selection.wid}:${selectedComment?.comment ?? "new"}:${targetCommentDraftVersion}`}
					selectionRect={selectionRect}
					queuedComment={selectedComment}
					queuedCount={editor.targetComments.length}
					queueFull={editor.isTargetCommentQueueFull}
					disabled={dispatchDisabled}
					stageRef={stageRef}
					iframeRef={iframeRef}
					registerFocus={editor.registerTargetCommentFocus}
					onSend={(comment) => {
						const entry = targetCommentEntry(selection, comment);
						if (!entry) return;
						void dispatchPopoverTargetComment({
							entry,
							queuedComments: editor.targetComments,
							enqueue: editor.upsertTargetComment,
							dispatch: dispatchComments,
						});
					}}
					onAdd={(comment) => {
						const entry = targetCommentEntry(selection, comment);
						if (entry) editor.upsertTargetComment(entry);
					}}
					onUpdate={(comment) => {
						const entry = targetCommentEntry(selection, comment);
						if (entry) editor.upsertTargetComment(entry);
					}}
					onRemove={() => editor.removeTargetComment(selection.wid)}
				/>
			) : null}
			{editor.targetComments.length > 0 && !isPreviewingHistorical ? (
				<TargetCommentReviewBar
					count={editor.targetComments.length}
					disabled={dispatchDisabled}
					onClear={editor.clearTargetComments}
					onSend={() => void dispatchComments([...editor.targetComments])}
				/>
			) : null}
		</div>
	);
}

/**
 * Sandboxed preview — no allow-same-origin, mirroring how user HTML will be
 * isolated in production (the editor bridge relies on this opaque origin —
 * contract §11). Remounted (via key) on version switch, reload, or discard.
 */
function PreviewFrame({
	html,
	title,
	frameRef,
}: {
	html: string;
	title: string;
	frameRef: React.RefObject<HTMLIFrameElement | null>;
}) {
	const [loaded, setLoaded] = useState(false);
	return (
		<iframe
			ref={frameRef}
			srcDoc={html}
			sandbox="allow-scripts allow-forms"
			title={title}
			onLoad={() => setLoaded(true)}
			className={cn(
				"size-full border-0 bg-white transition-opacity duration-300",
				loaded ? "opacity-100" : "opacity-0",
			)}
		/>
	);
}

function GeneratingPanel({
	pendingVersionNumber,
}: {
	/** The version number the in-flight build will produce. */
	pendingVersionNumber: number;
}) {
	const { t } = useTranslation();
	const dictionary = useDictionary();
	const generatingSteps = dictionary.workspace.page.generatingSteps;
	const [stepIndex, setStepIndex] = useState(0);

	useEffect(() => {
		const id = window.setInterval(
			() => setStepIndex((index) => (index + 1) % generatingSteps.length),
			1400,
		);
		return () => window.clearInterval(id);
	}, [generatingSteps.length]);

	return (
		<div className="relative flex w-72 flex-col items-center gap-4 rounded-2xl border bg-card/90 p-6 text-center shadow-xl backdrop-blur-sm">
			<div className="relative">
				<div
					aria-hidden
					className="absolute -inset-2 animate-pulse rounded-full bg-gradient-ember opacity-20 blur-md"
				/>
				<span className="relative grid size-11 place-items-center rounded-full border border-primary/30 bg-background">
					<Spark className="size-4 animate-pulse text-primary" />
				</span>
			</div>
			<div>
				<p className="font-display font-semibold text-sm">
					{t("workspace.page.generatingTitle", { n: pendingVersionNumber })}
				</p>
				<p className="mt-1 h-4 font-mono text-[11px] text-muted-foreground">
					{generatingSteps[stepIndex]}
				</p>
			</div>
			<div className="h-1 w-full overflow-hidden rounded-full bg-muted">
				<motion.div
					className="h-full w-1/3 rounded-full bg-gradient-ember"
					animate={{ x: ["-100%", "300%"] }}
					transition={{
						duration: 1.4,
						repeat: Number.POSITIVE_INFINITY,
						ease: "easeInOut",
					}}
				/>
			</div>
		</div>
	);
}

/** A build failed and there's no earlier version to fall back to. The error
    comes straight off the attempt row — honest, not prettified. */
function FailedPanel({ error }: { error: string | null }) {
	const { chatOpen, toggleChat } = useWorkspace();
	return (
		<div className="relative flex max-w-sm flex-col items-center gap-2.5 text-center">
			<span className="grid size-11 place-items-center rounded-full border border-destructive/30 bg-destructive/10">
				<AlertTriangle className="size-4 text-destructive" aria-hidden />
			</span>
			<p className="font-display font-semibold text-base">
				The page build failed
			</p>
			<p dir="auto" className="text-muted-foreground text-sm leading-relaxed">
				{error ?? "Something went wrong while generating your page."}
			</p>
			<p className="text-muted-foreground text-xs">
				Ask Wandit in the chat to try again.
			</p>
			{!chatOpen ? (
				<Button
					variant="secondary"
					size="sm"
					className="mt-1.5"
					onClick={toggleChat}
				>
					Open the chat
				</Button>
			) : null}
		</div>
	);
}

function EmptyPreview() {
	const { t } = useTranslation();
	const { chatOpen, toggleChat } = useWorkspace();
	return (
		<div className="relative flex flex-col items-center gap-2.5 text-center">
			<span className="grid size-11 place-items-center rounded-full border border-primary/25 bg-card">
				<Spark className="size-4 text-primary/70" />
			</span>
			<p className="font-display font-semibold text-base">
				{t("workspace.page.emptyTitle")}
			</p>
			<p className="max-w-xs text-muted-foreground text-sm leading-relaxed">
				{t("workspace.page.emptyBody")}
			</p>
			{!chatOpen ? (
				<Button
					variant="secondary"
					size="sm"
					className="mt-1.5"
					onClick={toggleChat}
				>
					{t("workspace.chat.expand")}
				</Button>
			) : null}
		</div>
	);
}
