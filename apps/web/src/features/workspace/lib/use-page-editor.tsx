// Single source of truth for the Page tab's edit mode (WS2, spec §6–§8):
// click-to-target selection, the pending op batch the inline editor / theme
// panel accumulate, and Save/Discard against the ops endpoint (contract
// §7.1). Plain React context, same house rule as lib/store.tsx.
//
// Key invariants (contract §6/§14):
// - The client NEVER mutates canonical HTML — live tweaks go to the iframe
//   via postMessage; persistence is ONE op batch → ONE new immutable version.
// - Ops are keyed per wid and merged (last wins per property); Save orders
//   them remove-element → text → image ops → brand-logo → set-link-href →
//   set-placeholder → element-style → section-style → reset-tokens → one
//   set-tokens. Brand swaps precede descendant-sensitive styles/links because
//   replacing wrapper innerHTML deletes stamped descendants (frozen order).
// - `baseVersionId` is captured on the FIRST dirty op; a FOREIGN version
//   change while dirty drops the batch (it would 409 anyway) with a warning
//   toast. Our own save only clears what it persisted — edits recorded while
//   the request was in flight stay pending, rebased onto the new version.

import { useQueryClient } from "@tanstack/react-query";
import {
	type ClientEditOp,
	type CuratedFont,
	curatedFontById,
	curatedFontStack,
	type PageTokenName,
	SECTION_PADDING_CSS,
} from "@wandit/contracts";
import type * as React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n";
import { pageKeys, usePageOverviewQuery } from "../api/pages.queries";
import {
	applyPageOps,
	PageOpsConflictError,
	PageOpsFailedError,
} from "../api/pages.services";
import {
	buildPendingOps,
	countPendingTokenSlot,
	diffPendingPlaceholderImages,
	fontStylesheetHrefsForResetPreview,
	nextPendingTokensReset,
	omitPendingRemovals,
	omitPendingWids,
	type PendingPlaceholderImage,
	type SpeculativeTokenReset,
	shouldClearSpeculativeTokenReset,
	shouldQueueTokenReset,
	sourceForPendingOps,
} from "./page-editor-pending";
import {
	isKeyKShortcut,
	nextBaseVersionAfterOwnSave,
	shouldDeferVersionChangeWhileSaving,
	shouldHandleWindowEscape,
} from "./page-editor-state";
import {
	applySectionStyleMessage,
	applyStyleMessage,
	clearSelectionMessage,
	type EditorMode,
	type ElementStylePatch,
	type PreviewParentMessage,
	type PreviewSelection,
	placeholderImageMessage,
	removeElementMessage,
	type SectionStylePatch,
	setBrandLogoMessage,
	setLinkHrefMessage,
	setPlaceholderMessage,
	setTextMessage,
	setTokensMessage,
	swapImageMessage,
} from "./preview-editor/messages";
import { buildFontsCss2Url, tokensEqual } from "./preview-editor/parse-tokens";
import { useWorkspace } from "./store";
import {
	type TargetCommentsState,
	useTargetComments,
} from "./use-target-comments";

/** Element-style patch as PERSISTED: fontFamily is the curated id (the live
 *  postMessage resolves it to a full stack before sending). Deriving the
 *  shape from the contract keeps every newly allowlisted property in sync. */
export type PendingElementStyle = Extract<
	ClientEditOp,
	{ kind: "element-style" }
>["value"];

/** Section-style patch as PERSISTED: padding STEPS + a raw https URL (or
 *  "none" = clear); the live postMessage resolves steps via
 *  SECTION_PADDING_CSS and wraps the URL in url("…") before sending. */
export type PendingSectionStyle = Extract<
	ClientEditOp,
	{ kind: "section-style" }
>["value"];

export type PageEditorSaveResult = "saved" | "noop" | "failed";

type MutableCell<T> = { current: T };

/** Return the active save promise verbatim so concurrent callers wait for
 * the same authoritative result instead of racing a stale base version. */
export function joinPageEditorSave(
	inFlight: MutableCell<Promise<PageEditorSaveResult> | null>,
	run: () => Promise<PageEditorSaveResult>,
): Promise<PageEditorSaveResult> {
	if (inFlight.current) return inFlight.current;
	const request = run();
	inFlight.current = request;
	const clear = () => {
		if (inFlight.current === request) inFlight.current = null;
	};
	void request.then(clear, clear);
	return request;
}

export function beginManualEditGuard(blocked: MutableCell<boolean>): boolean {
	if (blocked.current) return false;
	blocked.current = true;
	return true;
}

export function endManualEditGuard(blocked: MutableCell<boolean>): void {
	blocked.current = false;
}

/** Remove queued comments for descendants that a live parent edit destroys. */
export function pruneDestroyedTargetComments(
	destroyedWids: readonly string[],
	pruneTargetComment: (wid: string) => boolean,
): number {
	let removedCount = 0;
	for (const wid of new Set(destroyedWids)) {
		if (pruneTargetComment(wid)) removedCount += 1;
	}
	return removedCount;
}

/** Ask-AI freezes recorders, so a save that joined an older request can safely
 * drain every leftover snapshot before the foreign AI version is allowed. */
export async function drainPageEditorSaves(
	saveOnce: () => Promise<PageEditorSaveResult>,
): Promise<PageEditorSaveResult> {
	let result = await saveOnce();
	while (result === "saved") result = await saveOnce();
	return result;
}

type DiscardPrompt = {
	/** Mode to switch to after a confirmed discard (null = stay). */
	nextMode: EditorMode | null;
};

type PageEditorContextValue = TargetCommentsState & {
	mode: EditorMode;
	/** Mode switch with the dirty-state guard: leaving to browse while dirty
	 *  opens the discard confirm instead of switching. */
	requestMode: (mode: EditorMode) => void;
	/** Unconditional read-only transition (historical previews/build starts):
	 *  keeps pending ops, but clears selection and the iframe outline. */
	forceBrowse: () => void;
	/** Escape ladder shared by parent and iframe focus: deselect, then browse. */
	handleEscape: () => void;
	selection: PreviewSelection | null;
	/** Bridge writes (select / deselect events). */
	setSelection: (selection: PreviewSelection | null) => void;
	/** User-initiated clear (chip X) — also clears the iframe outline. */
	clearSelection: () => void;
	pendingText: Record<string, string>;
	pendingStyles: Record<string, PendingElementStyle>;
	pendingImages: Record<string, string>;
	pendingPlaceholderImages: Record<string, PendingPlaceholderImage>;
	pendingBrandLogos: Record<string, string | null>;
	pendingLinks: Record<string, string>;
	pendingPlaceholders: Record<string, string>;
	pendingRemovals: string[];
	pendingSectionStyles: Record<string, PendingSectionStyle>;
	pendingTokens: Partial<Record<PageTokenName, string>>;
	pendingTokensReset: boolean;
	dirtyCount: number;
	isSaving: boolean;
	/** Folded into the iframe key — discarding remounts the canonical HTML. */
	discardCount: number;
	recordText: (
		wid: string,
		value: string,
		flattenedDescendantWids?: readonly string[],
	) => void;
	/** Record + live-apply an element style patch. */
	applyStyle: (wid: string, style: PendingElementStyle) => void;
	/** Record + live-apply an image swap (url = uploaded R2 url). */
	applyImage: (wid: string, url: string) => void;
	/** Swap an image in place for the neutral placeholder. */
	applyImagePlaceholder: (
		wid: string,
		dimensions: PendingPlaceholderImage,
	) => void;
	/** Replace a stamped nav/footer brand wrapper's inner content. Descendant
	 * pending ops are pruned because the swap removes those nodes. */
	applyBrandLogo: (
		wid: string,
		value: string | null,
		descendantWids?: readonly string[],
	) => void;
	/** Record + live-apply a link href (already isSafeLinkHref-validated). */
	applyLinkHref: (wid: string, href: string) => void;
	/** Record + live-apply an input/textarea placeholder. */
	applyPlaceholder: (wid: string, value: string) => void;
	/** Record an editable-leaf removal, live-remove it
	 *  and drop the wid's other pending entries — they became moot. */
	removeElement: (wid: string) => void;
	/** Record + live-apply a section spacing/background patch (steps + raw
	 *  url; the live message carries resolved CSS). */
	applySectionStyle: (wid: string, patch: PendingSectionStyle) => void;
	/** Record a token patch + live-apply the FULL effective values map (the
	 *  theme panel owns parsed-base ∪ pending; fonts may be curated ids or
	 *  raw stacks from the page). */
	applyTokens: (
		patch: Partial<Record<PageTokenName, string>>,
		effective: Partial<Record<PageTokenName, string>>,
	) => void;
	/** Restore the newest builder-origin token set without touching elements. */
	resetTokens: (
		originalTokens: Partial<Record<PageTokenName, string>>,
		baseTokens: Partial<Record<PageTokenName, string>>,
		originalFontStylesheetHrefs?: readonly string[],
	) => void;
	save: () => Promise<PageEditorSaveResult>;
	/** Freeze manual recorders across the inspector's auto-save → AI send. */
	beginAskAiDispatch: () => boolean;
	endAskAiDispatch: () => void;
	isAskAiDispatching: boolean;
	discard: () => void;
	/** Re-post every pending live tweak into a freshly mounted iframe — the
	 *  preview remounts per version/reload, and edits recorded during an
	 *  in-flight save survive the remount as pending state. */
	replayPending: () => void;
	// Discard confirm (save-bar Annuler + leaving edit mode while dirty).
	discardPrompt: DiscardPrompt | null;
	openDiscardPrompt: (nextMode: EditorMode | null) => void;
	confirmDiscardPrompt: () => void;
	cancelDiscardPrompt: () => void;
	// 409 conflict dialog.
	conflictOpen: boolean;
	resolveConflict: () => void;
	/** PreviewStage registers the iframe poster here (null when unmounted). */
	registerPost: (
		post: ((message: PreviewParentMessage) => void) | null,
	) => void;
	postToPreview: (message: PreviewParentMessage) => void;
	registerTargetCommentFocus: (focus: (() => void) | null) => void;
	focusTargetComment: () => void;
};

const PageEditorContext = createContext<PageEditorContextValue | null>(null);

/** High-churn pending edits stay out of consumers that only need mode/selection. */
export type PageEditorModeContextValue = {
	mode: EditorMode;
	selection: PreviewSelection | null;
	clearSelection: () => void;
	requestMode: (mode: EditorMode) => void;
};

const PageEditorModeContext = createContext<PageEditorModeContextValue | null>(
	null,
);

export function PageEditorProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const { isPreviewingHistorical, projectId } = useWorkspace();
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const targetCommentState = useTargetComments();
	const { clearTargetComments, pruneTargetComment } = targetCommentState;

	const overviewQuery = usePageOverviewQuery(projectId);
	const activeVersionId = overviewQuery.data?.activeVersion?.id ?? null;
	const activeVersionRef = useRef<string | null>(activeVersionId);
	activeVersionRef.current = activeVersionId;

	const [mode, setModeState] = useState<EditorMode>("browse");
	const [selection, setSelectionState] = useState<PreviewSelection | null>(
		null,
	);
	const [pendingText, setPendingText] = useState<Record<string, string>>({});
	const [pendingStyles, setPendingStyles] = useState<
		Record<string, PendingElementStyle>
	>({});
	const [pendingImages, setPendingImages] = useState<Record<string, string>>(
		{},
	);
	const [pendingPlaceholderImages, setPendingPlaceholderImages] = useState<
		Record<string, PendingPlaceholderImage>
	>({});
	const [pendingBrandLogos, setPendingBrandLogos] = useState<
		Record<string, string | null>
	>({});
	const [pendingLinks, setPendingLinks] = useState<Record<string, string>>({});
	const [pendingPlaceholders, setPendingPlaceholders] = useState<
		Record<string, string>
	>({});
	const [pendingRemovals, setPendingRemovals] = useState<string[]>([]);
	const [pendingSectionStyles, setPendingSectionStyles] = useState<
		Record<string, PendingSectionStyle>
	>({});
	const [pendingTokens, setPendingTokens] = useState<
		Partial<Record<PageTokenName, string>>
	>({});
	const [pendingTokensReset, setPendingTokensReset] = useState(false);
	const [baseVersionId, setBaseVersionId] = useState<string | null>(null);
	const [discardCount, setDiscardCount] = useState(0);
	const [isSaving, setIsSaving] = useState(false);
	const [isAskAiDispatching, setIsAskAiDispatching] = useState(false);
	const [discardPrompt, setDiscardPrompt] = useState<DiscardPrompt | null>(
		null,
	);
	const [conflictOpen, setConflictOpen] = useState(false);

	const dirtyCount =
		Object.keys(pendingText).length +
		Object.keys(pendingStyles).length +
		Object.keys(pendingImages).length +
		Object.keys(pendingPlaceholderImages).length +
		Object.keys(pendingBrandLogos).length +
		Object.keys(pendingLinks).length +
		Object.keys(pendingPlaceholders).length +
		pendingRemovals.length +
		Object.keys(pendingSectionStyles).length +
		countPendingTokenSlot(pendingTokensReset, pendingTokens);
	const dirtyRef = useRef(dirtyCount);
	dirtyRef.current = dirtyCount;

	// Render-mirrored refs: save() needs the LATEST committed pending state
	// when its request resolves (the closure only has the snapshot it sent),
	// and replayPending() runs from iframe onReady callbacks.
	const pendingTextRef = useRef(pendingText);
	pendingTextRef.current = pendingText;
	const pendingStylesRef = useRef(pendingStyles);
	pendingStylesRef.current = pendingStyles;
	const pendingImagesRef = useRef(pendingImages);
	pendingImagesRef.current = pendingImages;
	const pendingPlaceholderImagesRef = useRef(pendingPlaceholderImages);
	pendingPlaceholderImagesRef.current = pendingPlaceholderImages;
	const pendingBrandLogosRef = useRef(pendingBrandLogos);
	pendingBrandLogosRef.current = pendingBrandLogos;
	const pendingLinksRef = useRef(pendingLinks);
	pendingLinksRef.current = pendingLinks;
	const pendingPlaceholdersRef = useRef(pendingPlaceholders);
	pendingPlaceholdersRef.current = pendingPlaceholders;
	const pendingRemovalsRef = useRef(pendingRemovals);
	pendingRemovalsRef.current = pendingRemovals;
	const pendingSectionStylesRef = useRef(pendingSectionStyles);
	pendingSectionStylesRef.current = pendingSectionStyles;
	const pendingTokensRef = useRef(pendingTokens);
	pendingTokensRef.current = pendingTokens;
	const pendingTokensResetRef = useRef(pendingTokensReset);
	pendingTokensResetRef.current = pendingTokensReset;
	const baseVersionIdRef = useRef(baseVersionId);
	baseVersionIdRef.current = baseVersionId;
	const resetPreviewRef = useRef<{
		values: Record<string, string>;
		fontStylesheetHrefs: string[];
	} | null>(null);
	const tokensResetRevisionRef = useRef(0);
	const tokenSaveAttemptCounterRef = useRef(0);
	const tokenSaveInFlightAttemptRef = useRef<number | null>(null);
	const speculativeTokenResetRef = useRef<SpeculativeTokenReset | null>(null);
	const saveInFlightRef = useRef<Promise<PageEditorSaveResult> | null>(null);
	const manualRecordingBlockedRef = useRef(false);

	const beginAskAiDispatch = useCallback(() => {
		if (!beginManualEditGuard(manualRecordingBlockedRef)) return false;
		setIsAskAiDispatching(true);
		return true;
	}, []);
	const endAskAiDispatch = useCallback(() => {
		endManualEditGuard(manualRecordingBlockedRef);
		setIsAskAiDispatching(false);
	}, []);

	// Version id produced by OUR OWN save — lets the version-change watcher
	// tell a save landing apart from a foreign version (AI edit, other tab)
	// and preserve edits recorded while the save was in flight.
	const ownVersionIds = useMemo(() => new Set<string>(), []);

	// The iframe poster, registered by PreviewStage (remounts per version).
	const postRef = useRef<((message: PreviewParentMessage) => void) | null>(
		null,
	);
	const registerPost = useCallback(
		(post: ((message: PreviewParentMessage) => void) | null) => {
			postRef.current = post;
		},
		[],
	);
	const postToPreview = useCallback((message: PreviewParentMessage) => {
		postRef.current?.(message);
	}, []);
	const targetCommentFocusRef = useRef<(() => void) | null>(null);
	const registerTargetCommentFocus = useCallback(
		(focus: (() => void) | null) => {
			targetCommentFocusRef.current = focus;
		},
		[],
	);
	const focusTargetComment = useCallback(
		() => targetCommentFocusRef.current?.(),
		[],
	);

	// Every recorder pins the batch to the version it was made against.
	const touchBase = useCallback(() => {
		const base = baseVersionIdRef.current ?? activeVersionRef.current;
		baseVersionIdRef.current = base;
		setBaseVersionId((current) => current ?? base);
	}, []);

	const resetPending = useCallback(() => {
		pendingTextRef.current = {};
		pendingStylesRef.current = {};
		pendingImagesRef.current = {};
		pendingPlaceholderImagesRef.current = {};
		pendingBrandLogosRef.current = {};
		pendingLinksRef.current = {};
		pendingPlaceholdersRef.current = {};
		pendingRemovalsRef.current = [];
		pendingSectionStylesRef.current = {};
		pendingTokensRef.current = {};
		pendingTokensResetRef.current = false;
		baseVersionIdRef.current = null;
		setPendingText({});
		setPendingStyles({});
		setPendingImages({});
		setPendingPlaceholderImages({});
		setPendingBrandLogos({});
		setPendingLinks({});
		setPendingPlaceholders({});
		setPendingRemovals([]);
		setPendingSectionStyles({});
		setPendingTokens({});
		setPendingTokensReset(false);
		resetPreviewRef.current = null;
		tokensResetRevisionRef.current = 0;
		speculativeTokenResetRef.current = null;
		setBaseVersionId(null);
	}, []);

	// A FOREIGN new active version supersedes any in-flight edits: the ops
	// were made against the old DOM and would 409 — drop them with an honest
	// warning. Our OWN saves are recognized via ownVersionIds: save()
	// already pruned exactly what it persisted and rebased the leftovers, so
	// dropping here would erase edits made while the request was in flight.
	//
	// Overview polling can observe our committed version BEFORE save() adds it
	// to ownVersionIds. While a save is in flight we defer classification and
	// flush after the promise settles (see saveOnce).
	const previousVersionRef = useRef<string | null>(activeVersionId);
	const deferredActiveVersionRef = useRef<string | null | undefined>(undefined);

	const applyActiveVersionChange = useCallback(
		(nextActiveVersionId: string | null) => {
			if (previousVersionRef.current === nextActiveVersionId) return;
			previousVersionRef.current = nextActiveVersionId;
			setSelectionState(null);
			if (
				nextActiveVersionId !== null &&
				ownVersionIds.delete(nextActiveVersionId)
			) {
				const nextBase = nextBaseVersionAfterOwnSave(
					nextActiveVersionId,
					dirtyRef.current,
				);
				baseVersionIdRef.current = nextBase;
				setBaseVersionId(nextBase);
				return;
			}
			ownVersionIds.clear();
			clearTargetComments();
			if (dirtyRef.current > 0) {
				resetPending();
				toast.warning(t("workspace.page.editor.versionSuperseded"));
			} else {
				baseVersionIdRef.current = null;
				setBaseVersionId(null);
			}
		},
		[clearTargetComments, ownVersionIds, resetPending, t],
	);

	useEffect(() => {
		if (previousVersionRef.current === activeVersionId) return;
		if (shouldDeferVersionChangeWhileSaving(Boolean(saveInFlightRef.current))) {
			deferredActiveVersionRef.current = activeVersionId;
			return;
		}
		deferredActiveVersionRef.current = undefined;
		applyActiveVersionChange(activeVersionId);
	}, [activeVersionId, applyActiveVersionChange]);

	useEffect(() => {
		if (isPreviewingHistorical) clearTargetComments();
	}, [clearTargetComments, isPreviewingHistorical]);

	// A build kicking off mid-edit force-exits the editor (lane 3.3): the page
	// is about to be replaced, so keeping the surface editable is a dead end.
	// Dirty state gets the discard confirm instead of a silent drop; cancelling
	// it lets the user keep editing until the new version lands (at which point
	// the watcher above drops the ops with its warning).
	const attemptStatus = overviewQuery.data?.latestAttempt?.status;
	const isBuildRunning =
		attemptStatus === "queued" || attemptStatus === "generating";
	useEffect(() => {
		if (!isBuildRunning || mode === "browse") return;
		if (dirtyRef.current > 0) {
			setDiscardPrompt({ nextMode: "browse" });
		} else {
			setModeState("browse");
			setSelectionState(null);
		}
	}, [isBuildRunning, mode]);

	const setSelection = useCallback(
		(next: PreviewSelection | null) => setSelectionState(next),
		[],
	);

	const clearSelection = useCallback(() => {
		setSelectionState(null);
		postToPreview(clearSelectionMessage());
	}, [postToPreview]);

	const forceBrowse = useCallback(() => {
		setModeState("browse");
		setSelectionState(null);
		postToPreview(clearSelectionMessage());
	}, [postToPreview]);

	const requestMode = useCallback(
		(next: EditorMode) => {
			if (next === "browse" && dirtyRef.current > 0) {
				setDiscardPrompt({ nextMode: "browse" });
				return;
			}
			if (next === mode) return;
			setModeState(next);
			// EVERY effective mode change drops the selection. Edit-mode selection
			// never IMPLICITLY rides the main composer; only the inspector's explicit
			// Ask AI action may attach it (contract §4). Clear the iframe outline too.
			setSelectionState(null);
			postToPreview(clearSelectionMessage());
		},
		[mode, postToPreview],
	);

	const handleEscape = useCallback(() => {
		if (selection !== null) {
			clearSelection();
			return;
		}
		requestMode("browse");
	}, [clearSelection, requestMode, selection]);

	// Parent shortcuts mirror iframe focus: Cmd/Ctrl+K focuses the selected
	// target's comment popover; Escape deselects before leaving the mode.
	useEffect(() => {
		if (mode === "browse") return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (
				mode === "select" &&
				selection !== null &&
				(event.metaKey || event.ctrlKey) &&
				isKeyKShortcut(event)
			) {
				event.preventDefault();
				focusTargetComment();
				return;
			}
			if (shouldHandleWindowEscape(event)) handleEscape();
		};
		window.addEventListener("keydown", onKeyDown, true);
		return () => window.removeEventListener("keydown", onKeyDown, true);
	}, [focusTargetComment, handleEscape, mode, selection]);

	const recordText = useCallback(
		(
			wid: string,
			value: string,
			flattenedDescendantWids: readonly string[] = [],
		) => {
			if (manualRecordingBlockedRef.current) return;
			touchBase();
			// The iframe flattens every inline descendant when it records a parent
			// text edit. Drop operations for those now-gone wids or the ordered
			// server batch would later fail with "no element matches wid".
			setPendingText((prev) => ({
				...omitPendingWids(prev, flattenedDescendantWids),
				[wid]: value,
			}));
			setPendingStyles((prev) =>
				omitPendingWids(prev, flattenedDescendantWids),
			);
			setPendingImages((prev) =>
				omitPendingWids(prev, flattenedDescendantWids),
			);
			setPendingPlaceholderImages((prev) =>
				omitPendingWids(prev, flattenedDescendantWids),
			);
			setPendingBrandLogos((prev) =>
				omitPendingWids(prev, flattenedDescendantWids),
			);
			setPendingLinks((prev) => omitPendingWids(prev, flattenedDescendantWids));
			setPendingPlaceholders((prev) =>
				omitPendingWids(prev, flattenedDescendantWids),
			);
			setPendingRemovals((prev) =>
				omitPendingRemovals(prev, flattenedDescendantWids),
			);
			setPendingSectionStyles((prev) =>
				omitPendingWids(prev, flattenedDescendantWids),
			);
			pruneDestroyedTargetComments(flattenedDescendantWids, pruneTargetComment);
		},
		[pruneTargetComment, touchBase],
	);

	const applyStyle = useCallback(
		(wid: string, style: PendingElementStyle) => {
			if (manualRecordingBlockedRef.current) return;
			touchBase();
			setPendingStyles((prev) => ({
				...prev,
				[wid]: { ...prev[wid], ...style },
			}));
			postToPreview(applyStyleMessage(wid, resolveElementStylePatch(style)));
		},
		[postToPreview, touchBase],
	);

	const applyImage = useCallback(
		(wid: string, url: string) => {
			if (manualRecordingBlockedRef.current) return;
			touchBase();
			setPendingImages((prev) => ({ ...prev, [wid]: url }));
			setPendingPlaceholderImages((prev) => omitWid(prev, wid));
			postToPreview(swapImageMessage(wid, url));
		},
		[postToPreview, touchBase],
	);

	const applyImagePlaceholder = useCallback(
		(wid: string, dimensions: PendingPlaceholderImage) => {
			if (manualRecordingBlockedRef.current) return;
			touchBase();
			setPendingPlaceholderImages((prev) => ({
				...prev,
				[wid]: dimensions,
			}));
			setPendingImages((prev) => omitWid(prev, wid));
			postToPreview(placeholderImageMessage(wid, dimensions ?? undefined));
		},
		[postToPreview, touchBase],
	);

	const applyBrandLogo = useCallback(
		(
			wid: string,
			value: string | null,
			descendantWids: readonly string[] = [],
		) => {
			if (manualRecordingBlockedRef.current) return;
			touchBase();
			setPendingBrandLogos((prev) => ({
				...omitPendingWids(prev, descendantWids),
				[wid]: value,
			}));
			// The wrapper remains stable, but every stamped descendant disappears
			// when its innerHTML becomes the logo (or restored fallback).
			setPendingText((prev) => omitPendingWids(prev, descendantWids));
			setPendingStyles((prev) => omitPendingWids(prev, descendantWids));
			setPendingImages((prev) => omitPendingWids(prev, descendantWids));
			setPendingPlaceholderImages((prev) =>
				omitPendingWids(prev, descendantWids),
			);
			setPendingLinks((prev) => omitPendingWids(prev, descendantWids));
			setPendingPlaceholders((prev) => omitPendingWids(prev, descendantWids));
			setPendingRemovals((prev) => omitPendingRemovals(prev, descendantWids));
			setPendingSectionStyles((prev) => omitPendingWids(prev, descendantWids));
			pruneDestroyedTargetComments(descendantWids, pruneTargetComment);
			postToPreview(setBrandLogoMessage(wid, value));
		},
		[postToPreview, pruneTargetComment, touchBase],
	);

	const applyLinkHref = useCallback(
		(wid: string, href: string) => {
			if (manualRecordingBlockedRef.current) return;
			touchBase();
			setPendingLinks((prev) => ({ ...prev, [wid]: href }));
			postToPreview(setLinkHrefMessage(wid, href));
		},
		[postToPreview, touchBase],
	);

	const applyPlaceholder = useCallback(
		(wid: string, value: string) => {
			if (manualRecordingBlockedRef.current) return;
			touchBase();
			setPendingPlaceholders((prev) => ({ ...prev, [wid]: value }));
			postToPreview(setPlaceholderMessage(wid, value));
		},
		[postToPreview, touchBase],
	);

	const removeElement = useCallback(
		(wid: string) => {
			if (manualRecordingBlockedRef.current) return;
			touchBase();
			setPendingRemovals((prev) =>
				prev.includes(wid) ? prev : [...prev, wid],
			);
			// A removed element's other pending edits are moot — drop them so
			// the save batch never targets a wid the removal just deleted.
			setPendingText((prev) => omitWid(prev, wid));
			setPendingStyles((prev) => omitWid(prev, wid));
			setPendingImages((prev) => omitWid(prev, wid));
			setPendingPlaceholderImages((prev) => omitWid(prev, wid));
			setPendingBrandLogos((prev) => omitWid(prev, wid));
			setPendingLinks((prev) => omitWid(prev, wid));
			setPendingPlaceholders((prev) => omitWid(prev, wid));
			pruneTargetComment(wid);
			postToPreview(removeElementMessage(wid));
		},
		[postToPreview, pruneTargetComment, touchBase],
	);

	const applySectionStyle = useCallback(
		(wid: string, patch: PendingSectionStyle) => {
			if (manualRecordingBlockedRef.current) return;
			touchBase();
			setPendingSectionStyles((prev) => ({
				...prev,
				[wid]: { ...prev[wid], ...patch },
			}));
			postToPreview(
				applySectionStyleMessage(wid, resolveSectionStylePatch(patch)),
			);
		},
		[postToPreview, touchBase],
	);

	const applyTokens = useCallback(
		(
			patch: Partial<Record<PageTokenName, string>>,
			effective: Partial<Record<PageTokenName, string>>,
		) => {
			if (manualRecordingBlockedRef.current) return;
			touchBase();
			setPendingTokens((prev) => ({ ...prev, ...patch }));
			// Live message: fonts become full stacks; curated families also get a
			// preview <link> so the swap actually renders (contract §11).
			const values: Record<string, string> = {};
			const fonts: CuratedFont[] = [];
			for (const [name, raw] of Object.entries(effective)) {
				if (raw === undefined) continue;
				if (name === "font-heading" || name === "font-body") {
					const font = curatedFontById(raw);
					if (font) {
						values[name] = `"${font.family}", ${font.fallback}`;
						fonts.push(font);
					} else {
						values[name] = raw; // page's own non-curated stack
					}
				} else {
					values[name] = raw;
				}
			}
			postToPreview(
				setTokensMessage(
					values,
					fonts.length > 0 ? buildFontsCss2Url(fonts) : undefined,
					fontStylesheetHrefsForResetPreview(
						resetPreviewRef.current,
						effective,
						false,
					),
				),
			);
		},
		[postToPreview, touchBase],
	);

	const resetTokens = useCallback(
		(
			originalTokens: Partial<Record<PageTokenName, string>>,
			baseTokens: Partial<Record<PageTokenName, string>>,
			originalFontStylesheetHrefs: readonly string[] = [],
		) => {
			if (manualRecordingBlockedRef.current) return;
			setPendingTokens({});
			const baseIsOriginal = tokensEqual(baseTokens, originalTokens);
			const values = tokenValuesForPreview(
				baseIsOriginal ? baseTokens : originalTokens,
			);

			if (
				!shouldQueueTokenReset(
					baseIsOriginal,
					tokenSaveInFlightAttemptRef.current !== null,
				)
			) {
				setPendingTokensReset(false);
				resetPreviewRef.current = null;
				postToPreview(
					setTokensMessage(values, undefined, originalFontStylesheetHrefs),
				);
				return;
			}

			touchBase();
			setPendingTokensReset(true);
			tokensResetRevisionRef.current += 1;
			speculativeTokenResetRef.current =
				baseIsOriginal && tokenSaveInFlightAttemptRef.current !== null
					? {
							attempt: tokenSaveInFlightAttemptRef.current,
							revision: tokensResetRevisionRef.current,
						}
					: null;
			resetPreviewRef.current = {
				values,
				fontStylesheetHrefs: [...originalFontStylesheetHrefs],
			};
			postToPreview(
				setTokensMessage(values, undefined, originalFontStylesheetHrefs),
			);
		},
		[postToPreview, touchBase],
	);

	const discard = useCallback(() => {
		resetPending();
		setSelectionState(null);
		// Remounting the iframe restores the canonical HTML (contract §11
		// discard semantics — no revert messages).
		setDiscardCount((count) => count + 1);
	}, [resetPending]);

	const flushDeferredActiveVersionChange = useCallback(() => {
		const deferred = deferredActiveVersionRef.current;
		if (deferred === undefined) return;
		deferredActiveVersionRef.current = undefined;
		applyActiveVersionChange(deferred);
	}, [applyActiveVersionChange]);

	const saveOnce = useCallback((): Promise<PageEditorSaveResult> => {
		return joinPageEditorSave(saveInFlightRef, async () => {
			// Snapshot from refs at the instant this request actually starts. An
			// Ask-AI submit may first join an older manual save, then invoke save()
			// again to flush the leftovers that older snapshot deliberately kept.
			const sentText = pendingTextRef.current;
			const sentStyles = pendingStylesRef.current;
			const sentImages = pendingImagesRef.current;
			const sentPlaceholderImages = pendingPlaceholderImagesRef.current;
			const sentBrandLogos = pendingBrandLogosRef.current;
			const sentLinks = pendingLinksRef.current;
			const sentPlaceholders = pendingPlaceholdersRef.current;
			const sentRemovals = [...pendingRemovalsRef.current];
			const sentSectionStyles = pendingSectionStylesRef.current;
			const sentTokens = pendingTokensRef.current;
			const sentReset = pendingTokensResetRef.current;
			const sentResetRevision = tokensResetRevisionRef.current;
			// Removals lead the frozen batch order: removing nested inline targets
			// first lets a later parent text edit pass the descendant-shape guard.
			// Same-wid edits are safe because removeElement prunes them immediately.
			const ops = buildPendingOps({
				text: sentText,
				styles: sentStyles,
				images: sentImages,
				placeholderImages: sentPlaceholderImages,
				brandLogos: sentBrandLogos,
				links: sentLinks,
				placeholders: sentPlaceholders,
				removals: sentRemovals,
				sectionStyles: sentSectionStyles,
				tokens: sentTokens,
				tokensReset: sentReset,
			});
			const base = baseVersionIdRef.current ?? activeVersionRef.current;
			if (ops.length === 0 || !base) return "noop";

			const savesTokens = ops.some(
				(op) => op.kind === "reset-tokens" || op.kind === "set-tokens",
			);
			let tokenSaveAttempt: number | null = null;
			if (savesTokens) {
				tokenSaveAttemptCounterRef.current += 1;
				tokenSaveAttempt = tokenSaveAttemptCounterRef.current;
			}
			tokenSaveInFlightAttemptRef.current = tokenSaveAttempt;
			setIsSaving(true);
			try {
				const response = await applyPageOps(projectId, {
					baseVersionId: base,
					// Token-only batches are theme saves; anything element-level makes
					// the whole batch "inline" (contract §7.1 source semantics).
					source: sourceForPendingOps(ops),
					ops,
				});
				// Prune EXACTLY what this batch persisted (the closure snapshots
				// below are what the ops were built from). Edits recorded while the
				// request was in flight stay pending, rebased onto the new version —
				// wids are stable across versions, and the new version already
				// contains everything the batch saved. Mark the version as our own
				// BEFORE invalidating so the watcher above does not drop them.
				ownVersionIds.add(response.version.id);
				const nextText = diffPendingValues(pendingTextRef.current, sentText);
				const nextImages = diffPendingValues(
					pendingImagesRef.current,
					sentImages,
				);
				const nextPlaceholderImages = diffPendingPlaceholderImages(
					pendingPlaceholderImagesRef.current,
					sentPlaceholderImages,
				);
				const nextBrandLogos = diffPendingValues(
					pendingBrandLogosRef.current,
					sentBrandLogos,
				);
				const nextLinks = diffPendingValues(pendingLinksRef.current, sentLinks);
				const nextPlaceholders = diffPendingValues(
					pendingPlaceholdersRef.current,
					sentPlaceholders,
				);
				const nextStyles = diffPendingStyles(
					pendingStylesRef.current,
					sentStyles,
				);
				const nextSectionStyles = diffPendingSectionStyles(
					pendingSectionStylesRef.current,
					sentSectionStyles,
				);
				// Removals are idempotent flags — everything in the saved snapshot
				// is gone from the new version, only later removals stay pending.
				const savedRemovals = new Set(sentRemovals);
				const nextRemovals = pendingRemovalsRef.current.filter(
					(wid) => !savedRemovals.has(wid),
				);
				const nextTokens = diffPendingTokens(
					pendingTokensRef.current,
					sentTokens,
				);
				const nextTokensReset = nextPendingTokensReset(
					pendingTokensResetRef.current,
					sentReset,
					tokensResetRevisionRef.current,
					sentResetRevision,
				);

				if (sentReset && !nextTokensReset) {
					resetPreviewRef.current = null;
				}
				if (speculativeTokenResetRef.current?.attempt === tokenSaveAttempt) {
					speculativeTokenResetRef.current = null;
				}
				const leftover =
					Object.keys(nextText).length +
					Object.keys(nextImages).length +
					Object.keys(nextPlaceholderImages).length +
					Object.keys(nextBrandLogos).length +
					Object.keys(nextLinks).length +
					Object.keys(nextPlaceholders).length +
					Object.keys(nextStyles).length +
					Object.keys(nextSectionStyles).length +
					nextRemovals.length +
					countPendingTokenSlot(nextTokensReset, nextTokens);
				pendingTextRef.current = nextText;
				pendingImagesRef.current = nextImages;
				pendingPlaceholderImagesRef.current = nextPlaceholderImages;
				pendingBrandLogosRef.current = nextBrandLogos;
				pendingLinksRef.current = nextLinks;
				pendingPlaceholdersRef.current = nextPlaceholders;
				pendingStylesRef.current = nextStyles;
				pendingSectionStylesRef.current = nextSectionStyles;
				pendingRemovalsRef.current = nextRemovals;
				pendingTokensRef.current = nextTokens;
				pendingTokensResetRef.current = nextTokensReset;
				baseVersionIdRef.current = leftover > 0 ? response.version.id : null;
				setPendingText(nextText);
				setPendingImages(nextImages);
				setPendingPlaceholderImages(nextPlaceholderImages);
				setPendingBrandLogos(nextBrandLogos);
				setPendingLinks(nextLinks);
				setPendingPlaceholders(nextPlaceholders);
				setPendingStyles(nextStyles);
				setPendingSectionStyles(nextSectionStyles);
				setPendingRemovals(nextRemovals);
				setPendingTokens(nextTokens);
				setPendingTokensReset(nextTokensReset);
				setBaseVersionId(leftover > 0 ? response.version.id : null);
				await Promise.all([
					queryClient.invalidateQueries({
						queryKey: pageKeys.overview(projectId),
					}),
					queryClient.invalidateQueries({
						queryKey: pageKeys.versions(projectId),
					}),
				]);
				// Honest confirmation only — the AI-side "user edited these wids" note
				// is server context injection; the client NEVER injects fake chat
				// messages (lane 3.2).
				toast.success(
					t("workspace.page.editor.saved", { n: response.version.number }),
				);
				return "saved";
			} catch (error) {
				if (
					(error instanceof PageOpsConflictError ||
						error instanceof PageOpsFailedError) &&
					shouldClearSpeculativeTokenReset(
						speculativeTokenResetRef.current,
						tokenSaveAttempt,
						tokensResetRevisionRef.current,
					)
				) {
					pendingTokensResetRef.current = false;
					setPendingTokensReset(false);
					resetPreviewRef.current = null;
					speculativeTokenResetRef.current = null;
				}
				if (error instanceof PageOpsConflictError) {
					setConflictOpen(true);
				} else if (error instanceof PageOpsFailedError) {
					toast.error(
						t("workspace.page.editor.saveFailed", { reason: error.reason }),
					);
				} else {
					toast.error(
						t("workspace.page.editor.saveFailed", {
							reason: error instanceof Error ? error.message : String(error),
						}),
					);
				}
				return "failed";
			} finally {
				if (tokenSaveInFlightAttemptRef.current === tokenSaveAttempt) {
					tokenSaveInFlightAttemptRef.current = null;
				}
				setIsSaving(false);
			}
		}).finally(() => {
			// joinPageEditorSave clears saveInFlightRef in its own then(); flush
			// any overview update that arrived while ownVersionIds was incomplete.
			flushDeferredActiveVersionChange();
		});
	}, [
		flushDeferredActiveVersionChange,
		ownVersionIds,
		projectId,
		queryClient,
		t,
	]);

	const save = useCallback(
		(): Promise<PageEditorSaveResult> =>
			manualRecordingBlockedRef.current
				? drainPageEditorSaves(saveOnce)
				: saveOnce(),
		[saveOnce],
	);

	// Re-post pending live tweaks after any iframe remount (own-save version
	// change, manual reload): the fresh document is canonical HTML, so the
	// unsaved edits must be re-applied to stay visible. Runs from the
	// PreviewStage's onReady handler.
	const replayPending = useCallback(() => {
		for (const [wid, value] of Object.entries(pendingTextRef.current)) {
			postToPreview(setTextMessage(wid, value));
		}
		for (const [wid, url] of Object.entries(pendingImagesRef.current)) {
			postToPreview(swapImageMessage(wid, url));
		}
		for (const [wid, dimensions] of Object.entries(
			pendingPlaceholderImagesRef.current,
		)) {
			postToPreview(placeholderImageMessage(wid, dimensions ?? undefined));
		}
		for (const [wid, value] of Object.entries(pendingBrandLogosRef.current)) {
			postToPreview(setBrandLogoMessage(wid, value));
		}
		for (const [wid, style] of Object.entries(pendingStylesRef.current)) {
			postToPreview(applyStyleMessage(wid, resolveElementStylePatch(style)));
		}
		for (const [wid, href] of Object.entries(pendingLinksRef.current)) {
			postToPreview(setLinkHrefMessage(wid, href));
		}
		for (const [wid, value] of Object.entries(pendingPlaceholdersRef.current)) {
			postToPreview(setPlaceholderMessage(wid, value));
		}
		for (const [wid, patch] of Object.entries(
			pendingSectionStylesRef.current,
		)) {
			// Same resolution as applySectionStyle: steps → CSS, url → url("…").
			postToPreview(
				applySectionStyleMessage(wid, resolveSectionStylePatch(patch)),
			);
		}
		// Removals last — nothing above may target an already-removed node.
		for (const wid of pendingRemovalsRef.current) {
			postToPreview(removeElementMessage(wid));
		}
		if (resetPreviewRef.current) {
			postToPreview(
				setTokensMessage(
					resetPreviewRef.current.values,
					undefined,
					resetPreviewRef.current.fontStylesheetHrefs,
				),
			);
		}
		const tokens = pendingTokensRef.current;
		if (Object.keys(tokens).length > 0) {
			// Same value shaping as applyTokens: fonts become full stacks and a
			// preview <link> so the swap actually renders (contract §11).
			const values: Record<string, string> = {};
			const fonts: CuratedFont[] = [];
			for (const [name, raw] of Object.entries(tokens)) {
				if (raw === undefined) continue;
				if (name === "font-heading" || name === "font-body") {
					const font = curatedFontById(raw);
					if (font) {
						values[name] = `"${font.family}", ${font.fallback}`;
						fonts.push(font);
					} else {
						values[name] = raw;
					}
				} else {
					values[name] = raw;
				}
			}
			postToPreview(
				setTokensMessage(
					values,
					fonts.length > 0 ? buildFontsCss2Url(fonts) : undefined,
					fontStylesheetHrefsForResetPreview(
						resetPreviewRef.current,
						tokens,
						true,
					),
				),
			);
		}
	}, [postToPreview]);

	const openDiscardPrompt = useCallback((nextMode: EditorMode | null) => {
		setDiscardPrompt({ nextMode });
	}, []);

	const confirmDiscardPrompt = useCallback(() => {
		if (discardPrompt?.nextMode) setModeState(discardPrompt.nextMode);
		setDiscardPrompt(null);
		discard();
	}, [discard, discardPrompt?.nextMode]);

	const cancelDiscardPrompt = useCallback(() => setDiscardPrompt(null), []);

	const resolveConflict = useCallback(() => {
		setConflictOpen(false);
		discard();
		void queryClient.invalidateQueries({
			queryKey: pageKeys.overview(projectId),
		});
	}, [discard, projectId, queryClient]);

	const modeValue = useMemo<PageEditorModeContextValue>(
		() => ({
			mode,
			selection,
			clearSelection,
			requestMode,
		}),
		[mode, selection, clearSelection, requestMode],
	);

	const value = useMemo<PageEditorContextValue>(
		() => ({
			...targetCommentState,
			mode,
			requestMode,
			forceBrowse,
			handleEscape,
			selection,
			setSelection,
			clearSelection,
			pendingText,
			pendingStyles,
			pendingImages,
			pendingPlaceholderImages,
			pendingBrandLogos,
			pendingLinks,
			pendingPlaceholders,
			pendingRemovals,
			pendingSectionStyles,
			pendingTokens,
			pendingTokensReset,
			dirtyCount,
			isSaving,
			isAskAiDispatching,
			discardCount,
			recordText,
			applyStyle,
			applyImage,
			applyImagePlaceholder,
			applyBrandLogo,
			applyLinkHref,
			applyPlaceholder,
			removeElement,
			applySectionStyle,
			applyTokens,
			resetTokens,
			save,
			beginAskAiDispatch,
			endAskAiDispatch,
			discard,
			replayPending,
			discardPrompt,
			openDiscardPrompt,
			confirmDiscardPrompt,
			cancelDiscardPrompt,
			conflictOpen,
			resolveConflict,
			registerPost,
			postToPreview,
			registerTargetCommentFocus,
			focusTargetComment,
		}),
		[
			targetCommentState,
			mode,
			requestMode,
			forceBrowse,
			handleEscape,
			selection,
			setSelection,
			clearSelection,
			pendingText,
			pendingStyles,
			pendingImages,
			pendingPlaceholderImages,
			pendingBrandLogos,
			pendingLinks,
			pendingPlaceholders,
			pendingRemovals,
			pendingSectionStyles,
			pendingTokens,
			pendingTokensReset,
			dirtyCount,
			isSaving,
			isAskAiDispatching,
			discardCount,
			recordText,
			applyStyle,
			applyImage,
			applyImagePlaceholder,
			applyBrandLogo,
			applyLinkHref,
			applyPlaceholder,
			removeElement,
			applySectionStyle,
			applyTokens,
			resetTokens,
			save,
			beginAskAiDispatch,
			endAskAiDispatch,
			discard,
			replayPending,
			discardPrompt,
			openDiscardPrompt,
			confirmDiscardPrompt,
			cancelDiscardPrompt,
			conflictOpen,
			resolveConflict,
			registerPost,
			postToPreview,
			registerTargetCommentFocus,
			focusTargetComment,
		],
	);

	return (
		<PageEditorModeContext.Provider value={modeValue}>
			<PageEditorContext.Provider value={value}>
				{children}
			</PageEditorContext.Provider>
		</PageEditorModeContext.Provider>
	);
}

export function usePageEditor(): PageEditorContextValue {
	const context = useContext(PageEditorContext);
	if (!context) {
		throw new Error("usePageEditor must be used inside <PageEditorProvider>");
	}
	return context;
}

/** Mode/selection only — safe for chat and other surfaces that must not
 *  re-render on every pending keystroke. */
export function usePageEditorMode(): PageEditorModeContextValue {
	const context = useContext(PageEditorModeContext);
	if (!context) {
		throw new Error(
			"usePageEditorMode must be used inside <PageEditorProvider>",
		);
	}
	return context;
}

// ── Pending helpers ─────────────────────────────────────────────────────────

/** Drop one wid's entry without touching the rest (identity kept when the
 *  wid was never recorded — no pointless re-renders). */
function omitWid<T>(record: Record<string, T>, wid: string): Record<string, T> {
	if (!(wid in record)) return record;
	const { [wid]: _dropped, ...rest } = record;
	return rest;
}

/** Persisted element style → ready-to-apply CSS for the iframe. Curated font
 *  ids are the sole property whose wire value differs from the saved op. */
function resolveElementStylePatch(
	style: PendingElementStyle,
): ElementStylePatch {
	return {
		...(style.backgroundColor !== undefined
			? { backgroundColor: style.backgroundColor }
			: {}),
		...(style.borderRadius !== undefined
			? { borderRadius: style.borderRadius }
			: {}),
		...(style.color !== undefined ? { color: style.color } : {}),
		...(style.fontFamily !== undefined
			? { fontFamily: curatedFontStack(style.fontFamily) }
			: {}),
		...(style.fontSize !== undefined ? { fontSize: style.fontSize } : {}),
		...(style.fontStyle !== undefined ? { fontStyle: style.fontStyle } : {}),
		...(style.fontWeight !== undefined
			? { fontWeight: String(style.fontWeight) }
			: {}),
		...(style.letterSpacing !== undefined
			? { letterSpacing: style.letterSpacing }
			: {}),
		...(style.lineHeight !== undefined
			? { lineHeight: String(style.lineHeight) }
			: {}),
		...(style.objectFit !== undefined ? { objectFit: style.objectFit } : {}),
		...(style.textAlign !== undefined ? { textAlign: style.textAlign } : {}),
		...(style.width !== undefined ? { width: style.width } : {}),
	};
}

/** Pending section patch → READY CSS for the live message: steps through the
 *  frozen SECTION_PADDING_CSS scale, url wrapped in url("…") with the same
 *  escaping rule the server applies (backslash first, then quote), "none"
 *  passing through as the CLEAR sentinel. */
function resolveSectionStylePatch(
	patch: PendingSectionStyle,
): SectionStylePatch {
	const resolved: SectionStylePatch = {};
	if (patch.paddingTop) {
		resolved.paddingTop = SECTION_PADDING_CSS[patch.paddingTop];
	}
	if (patch.paddingBottom) {
		resolved.paddingBottom = SECTION_PADDING_CSS[patch.paddingBottom];
	}
	if (patch.backgroundImage !== undefined) {
		resolved.backgroundImage =
			patch.backgroundImage === "none"
				? "none"
				: `url("${patch.backgroundImage.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}")`;
	}
	if (patch.backgroundColor !== undefined) {
		resolved.backgroundColor = patch.backgroundColor;
	}
	return resolved;
}

function tokenValuesForPreview(
	tokens: Partial<Record<PageTokenName, string>>,
): Record<string, string> {
	const values: Record<string, string> = {};

	for (const [name, value] of Object.entries(tokens)) {
		if (value !== undefined) {
			values[name] = value;
		}
	}

	return values;
}

// ── Save pruning helpers ────────────────────────────────────────────────────
// After a successful save, only the entries the batch actually persisted are
// cleared: anything recorded while the request was in flight differs from
// the saved snapshot and stays pending (rebased onto the new version).

function diffPendingValues<T>(
	current: Record<string, T>,
	saved: Record<string, T>,
): Record<string, T> {
	const next: Record<string, T> = {};
	for (const [wid, value] of Object.entries(current)) {
		if (saved[wid] !== value) next[wid] = value;
	}
	return next;
}

function diffPendingStyles(
	current: Record<string, PendingElementStyle>,
	saved: Record<string, PendingElementStyle>,
): Record<string, PendingElementStyle> {
	const next: Record<string, PendingElementStyle> = {};
	for (const [wid, style] of Object.entries(current)) {
		const savedStyle = saved[wid];
		if (!savedStyle) {
			next[wid] = style;
			continue;
		}
		// Styles merge per property — keep only properties changed after the
		// snapshot. Iterate the contract-derived shape so new allowlisted fields
		// cannot be accidentally pruned while an earlier save is in flight.
		const leftover: PendingElementStyle = {};
		for (const [property, value] of Object.entries(style)) {
			const key = property as keyof PendingElementStyle;
			if (value !== undefined && value !== savedStyle[key]) {
				Object.assign(leftover, { [key]: value });
			}
		}
		if (Object.keys(leftover).length > 0) next[wid] = leftover;
	}
	return next;
}

export function diffPendingSectionStyles(
	current: Record<string, PendingSectionStyle>,
	saved: Record<string, PendingSectionStyle>,
): Record<string, PendingSectionStyle> {
	const next: Record<string, PendingSectionStyle> = {};
	for (const [wid, patch] of Object.entries(current)) {
		const savedPatch = saved[wid];
		if (!savedPatch) {
			next[wid] = patch;
			continue;
		}
		// Section styles merge per property too. Iterate the contract-derived
		// shape so a newly allowlisted property cannot be silently pruned.
		const leftover: PendingSectionStyle = {};
		for (const [property, value] of Object.entries(patch)) {
			const key = property as keyof PendingSectionStyle;
			if (value !== undefined && value !== savedPatch[key]) {
				Object.assign(leftover, { [key]: value });
			}
		}
		if (Object.keys(leftover).length > 0) next[wid] = leftover;
	}
	return next;
}

function diffPendingTokens(
	current: Partial<Record<PageTokenName, string>>,
	saved: Partial<Record<PageTokenName, string>>,
): Partial<Record<PageTokenName, string>> {
	const next: Partial<Record<PageTokenName, string>> = {};
	for (const [name, value] of Object.entries(current) as [
		PageTokenName,
		string | undefined,
	][]) {
		if (value !== undefined && saved[name] !== value) next[name] = value;
	}
	return next;
}
