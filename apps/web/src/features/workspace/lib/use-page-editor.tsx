// Single source of truth for the Page tab's edit mode (WS2, spec §6–§8):
// click-to-target selection, the pending op batch the inline editor / theme
// panel accumulate, and Save/Discard against the ops endpoint (contract
// §7.1). Plain React context, same house rule as lib/store.tsx.
//
// Key invariants (contract §6/§14):
// - The client NEVER mutates canonical HTML — live tweaks go to the iframe
//   via postMessage; persistence is ONE op batch → ONE new immutable version.
// - Ops are keyed per wid and merged (last wins per property); Save orders
//   them text → image-src → set-link-href → element-style → section-style →
//   remove-element → one set-tokens (frozen batch order, inline-editor V3).
// - `baseVersionId` is captured on the FIRST dirty op; a FOREIGN version
//   change while dirty drops the batch (it would 409 anyway) with a warning
//   toast. Our own save only clears what it persisted — edits recorded while
//   the request was in flight stay pending, rebased onto the new version.

import { useQueryClient } from "@tanstack/react-query";
import {
	type ClientEditOp,
	type CuratedFont,
	type CuratedFontId,
	curatedFontById,
	curatedFontStack,
	type PageTokenName,
	SECTION_PADDING_CSS,
	type SectionPaddingStep,
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
	applySectionStyleMessage,
	applyStyleMessage,
	clearSelectionMessage,
	type EditorMode,
	type PreviewParentMessage,
	type PreviewSelection,
	removeElementMessage,
	type SectionStylePatch,
	setLinkHrefMessage,
	setTextMessage,
	setTokensMessage,
	swapImageMessage,
} from "./preview-editor/messages";
import { buildFontsCss2Url } from "./preview-editor/parse-tokens";
import { useWorkspace } from "./store";

/** Element-style patch as PERSISTED: fontFamily is the curated id (the live
 *  postMessage resolves it to a full stack before sending). */
export type PendingElementStyle = {
	color?: string;
	fontSize?: string;
	fontFamily?: CuratedFontId;
};

/** Section-style patch as PERSISTED: padding STEPS + a raw https URL (or
 *  "none" = clear); the live postMessage resolves steps via
 *  SECTION_PADDING_CSS and wraps the URL in url("…") before sending. */
export type PendingSectionStyle = {
	paddingTop?: SectionPaddingStep;
	paddingBottom?: SectionPaddingStep;
	backgroundImage?: string;
};

type DiscardPrompt = {
	/** Mode to switch to after a confirmed discard (null = stay). */
	nextMode: EditorMode | null;
};

type PageEditorContextValue = {
	mode: EditorMode;
	/** Mode switch with the dirty-state guard: leaving to browse while dirty
	 *  opens the discard confirm instead of switching. */
	requestMode: (mode: EditorMode) => void;
	selection: PreviewSelection | null;
	/** Bridge writes (select / deselect events). */
	setSelection: (selection: PreviewSelection | null) => void;
	/** User-initiated clear (chip X) — also clears the iframe outline. */
	clearSelection: () => void;
	pendingText: Record<string, string>;
	pendingStyles: Record<string, PendingElementStyle>;
	pendingImages: Record<string, string>;
	pendingLinks: Record<string, string>;
	pendingRemovals: string[];
	pendingSectionStyles: Record<string, PendingSectionStyle>;
	pendingTokens: Partial<Record<PageTokenName, string>>;
	dirtyCount: number;
	isSaving: boolean;
	/** Folded into the iframe key — discarding remounts the canonical HTML. */
	discardCount: number;
	recordText: (wid: string, value: string) => void;
	/** Record + live-apply an element style patch. */
	applyStyle: (wid: string, style: PendingElementStyle) => void;
	/** Record + live-apply an image swap (url = uploaded R2 url). */
	applyImage: (wid: string, url: string) => void;
	/** Record + live-apply a link href (already isSafeLinkHref-validated). */
	applyLinkHref: (wid: string, href: string) => void;
	/** Record an element removal (server restricts to <img>), live-remove it
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
	save: () => Promise<void>;
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
};

const PageEditorContext = createContext<PageEditorContextValue | null>(null);

export function PageEditorProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const { projectId } = useWorkspace();
	const { t } = useTranslation();
	const queryClient = useQueryClient();

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
	const [pendingLinks, setPendingLinks] = useState<Record<string, string>>({});
	const [pendingRemovals, setPendingRemovals] = useState<string[]>([]);
	const [pendingSectionStyles, setPendingSectionStyles] = useState<
		Record<string, PendingSectionStyle>
	>({});
	const [pendingTokens, setPendingTokens] = useState<
		Partial<Record<PageTokenName, string>>
	>({});
	const [baseVersionId, setBaseVersionId] = useState<string | null>(null);
	const [discardCount, setDiscardCount] = useState(0);
	const [isSaving, setIsSaving] = useState(false);
	const [discardPrompt, setDiscardPrompt] = useState<DiscardPrompt | null>(
		null,
	);
	const [conflictOpen, setConflictOpen] = useState(false);

	const dirtyCount =
		Object.keys(pendingText).length +
		Object.keys(pendingStyles).length +
		Object.keys(pendingImages).length +
		Object.keys(pendingLinks).length +
		pendingRemovals.length +
		Object.keys(pendingSectionStyles).length +
		(Object.keys(pendingTokens).length > 0 ? 1 : 0);
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
	const pendingLinksRef = useRef(pendingLinks);
	pendingLinksRef.current = pendingLinks;
	const pendingRemovalsRef = useRef(pendingRemovals);
	pendingRemovalsRef.current = pendingRemovals;
	const pendingSectionStylesRef = useRef(pendingSectionStyles);
	pendingSectionStylesRef.current = pendingSectionStyles;
	const pendingTokensRef = useRef(pendingTokens);
	pendingTokensRef.current = pendingTokens;

	// Version id produced by OUR OWN save — lets the version-change watcher
	// tell a save landing apart from a foreign version (AI edit, other tab)
	// and preserve edits recorded while the save was in flight.
	const expectedVersionRef = useRef<string | null>(null);

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

	// Every recorder pins the batch to the version it was made against.
	const touchBase = useCallback(() => {
		setBaseVersionId((current) => current ?? activeVersionRef.current);
	}, []);

	const resetPending = useCallback(() => {
		setPendingText({});
		setPendingStyles({});
		setPendingImages({});
		setPendingLinks({});
		setPendingRemovals([]);
		setPendingSectionStyles({});
		setPendingTokens({});
		setBaseVersionId(null);
	}, []);

	// A FOREIGN new active version supersedes any in-flight edits: the ops
	// were made against the old DOM and would 409 — drop them with an honest
	// warning. Our OWN save is recognized via expectedVersionRef: save()
	// already pruned exactly what it persisted and rebased the leftovers, so
	// dropping here would erase edits made while the request was in flight.
	const previousVersionRef = useRef<string | null>(activeVersionId);
	useEffect(() => {
		if (previousVersionRef.current === activeVersionId) return;
		previousVersionRef.current = activeVersionId;
		setSelectionState(null);
		if (
			activeVersionId !== null &&
			expectedVersionRef.current === activeVersionId
		) {
			expectedVersionRef.current = null;
			return;
		}
		expectedVersionRef.current = null;
		if (dirtyRef.current > 0) {
			resetPending();
			toast.warning(t("workspace.page.editor.versionSuperseded"));
		} else {
			setBaseVersionId(null);
		}
	}, [activeVersionId, resetPending, t]);

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

	const requestMode = useCallback(
		(next: EditorMode) => {
			if (next === "browse" && dirtyRef.current > 0) {
				setDiscardPrompt({ nextMode: "browse" });
				return;
			}
			if (next === mode) return;
			setModeState(next);
			// EVERY effective mode change drops the selection — a select-mode
			// target must not leak into the inspector nor the other way around
			// (contract §4) — and clears the iframe outline with it.
			setSelectionState(null);
			postToPreview(clearSelectionMessage());
		},
		[mode, postToPreview],
	);

	// Escape at the APP level (the iframe already handles its own — contract
	// §11) leaves targeting mode (lane 3.3). Scoped to "select": edit mode
	// keeps Escape free for dialogs and in-iframe contentEditable.
	useEffect(() => {
		if (mode !== "select") return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") requestMode("browse");
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [mode, requestMode]);

	const recordText = useCallback(
		(wid: string, value: string) => {
			touchBase();
			setPendingText((prev) => ({ ...prev, [wid]: value }));
		},
		[touchBase],
	);

	const applyStyle = useCallback(
		(wid: string, style: PendingElementStyle) => {
			touchBase();
			setPendingStyles((prev) => ({
				...prev,
				[wid]: { ...prev[wid], ...style },
			}));
			postToPreview(
				applyStyleMessage(wid, {
					...(style.color ? { color: style.color } : {}),
					...(style.fontSize ? { fontSize: style.fontSize } : {}),
					...(style.fontFamily
						? { fontFamily: curatedFontStack(style.fontFamily) }
						: {}),
				}),
			);
		},
		[postToPreview, touchBase],
	);

	const applyImage = useCallback(
		(wid: string, url: string) => {
			touchBase();
			setPendingImages((prev) => ({ ...prev, [wid]: url }));
			postToPreview(swapImageMessage(wid, url));
		},
		[postToPreview, touchBase],
	);

	const applyLinkHref = useCallback(
		(wid: string, href: string) => {
			touchBase();
			setPendingLinks((prev) => ({ ...prev, [wid]: href }));
			postToPreview(setLinkHrefMessage(wid, href));
		},
		[postToPreview, touchBase],
	);

	const removeElement = useCallback(
		(wid: string) => {
			touchBase();
			setPendingRemovals((prev) =>
				prev.includes(wid) ? prev : [...prev, wid],
			);
			// A removed element's other pending edits are moot — drop them so
			// the save batch never targets a wid the removal just deleted.
			setPendingText((prev) => omitWid(prev, wid));
			setPendingStyles((prev) => omitWid(prev, wid));
			setPendingImages((prev) => omitWid(prev, wid));
			setPendingLinks((prev) => omitWid(prev, wid));
			postToPreview(removeElementMessage(wid));
		},
		[postToPreview, touchBase],
	);

	const applySectionStyle = useCallback(
		(wid: string, patch: PendingSectionStyle) => {
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
				),
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

	const save = useCallback(async () => {
		if (isSaving) return;
		const ops: ClientEditOp[] = [];
		for (const [wid, value] of Object.entries(pendingText)) {
			ops.push({ kind: "text", wid, value });
		}
		for (const [wid, value] of Object.entries(pendingImages)) {
			ops.push({ kind: "image-src", wid, value });
		}
		for (const [wid, value] of Object.entries(pendingLinks)) {
			ops.push({ kind: "set-link-href", wid, value });
		}
		for (const [wid, value] of Object.entries(pendingStyles)) {
			ops.push({ kind: "element-style", wid, value });
		}
		for (const [wid, value] of Object.entries(pendingSectionStyles)) {
			ops.push({ kind: "section-style", wid, value });
		}
		// Removals go LAST (frozen batch order) — every other op targeting the
		// wid was already dropped when the removal was recorded.
		for (const wid of pendingRemovals) {
			ops.push({ kind: "remove-element", wid });
		}
		const hasTokens = Object.keys(pendingTokens).length > 0;
		if (hasTokens) ops.push({ kind: "set-tokens", value: pendingTokens });
		const base = baseVersionId ?? activeVersionRef.current;
		if (ops.length === 0 || !base) return;

		setIsSaving(true);
		try {
			const response = await applyPageOps(projectId, {
				baseVersionId: base,
				// Tokens-only batches are theme saves; anything element-level makes
				// the whole batch "inline" (contract §7.1 source semantics).
				source: hasTokens && ops.length === 1 ? "theme" : "inline",
				ops,
			});
			// Prune EXACTLY what this batch persisted (the closure snapshots
			// below are what the ops were built from). Edits recorded while the
			// request was in flight stay pending, rebased onto the new version —
			// wids are stable across versions, and the new version already
			// contains everything the batch saved. Mark the version as our own
			// BEFORE invalidating so the watcher above does not drop them.
			expectedVersionRef.current = response.version.id;
			const nextText = diffPendingValues(pendingTextRef.current, pendingText);
			const nextImages = diffPendingValues(
				pendingImagesRef.current,
				pendingImages,
			);
			const nextLinks = diffPendingValues(
				pendingLinksRef.current,
				pendingLinks,
			);
			const nextStyles = diffPendingStyles(
				pendingStylesRef.current,
				pendingStyles,
			);
			const nextSectionStyles = diffPendingSectionStyles(
				pendingSectionStylesRef.current,
				pendingSectionStyles,
			);
			// Removals are idempotent flags — everything in the saved snapshot
			// is gone from the new version, only later removals stay pending.
			const nextRemovals = pendingRemovalsRef.current.filter(
				(wid) => !pendingRemovals.includes(wid),
			);
			const nextTokens = diffPendingTokens(
				pendingTokensRef.current,
				pendingTokens,
			);
			const leftover =
				Object.keys(nextText).length +
				Object.keys(nextImages).length +
				Object.keys(nextLinks).length +
				Object.keys(nextStyles).length +
				Object.keys(nextSectionStyles).length +
				nextRemovals.length +
				Object.keys(nextTokens).length;
			setPendingText(nextText);
			setPendingImages(nextImages);
			setPendingLinks(nextLinks);
			setPendingStyles(nextStyles);
			setPendingSectionStyles(nextSectionStyles);
			setPendingRemovals(nextRemovals);
			setPendingTokens(nextTokens);
			setBaseVersionId(leftover > 0 ? response.version.id : null);
			await queryClient.invalidateQueries({
				queryKey: pageKeys.overview(projectId),
			});
			// Honest confirmation only — the AI-side "user edited these wids" note
			// is server context injection; the client NEVER injects fake chat
			// messages (lane 3.2).
			toast.success(
				t("workspace.page.editor.saved", { n: response.version.number }),
			);
		} catch (error) {
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
		} finally {
			setIsSaving(false);
		}
	}, [
		isSaving,
		pendingText,
		pendingImages,
		pendingLinks,
		pendingStyles,
		pendingSectionStyles,
		pendingRemovals,
		pendingTokens,
		baseVersionId,
		projectId,
		queryClient,
		t,
	]);

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
		for (const [wid, style] of Object.entries(pendingStylesRef.current)) {
			postToPreview(
				applyStyleMessage(wid, {
					...(style.color ? { color: style.color } : {}),
					...(style.fontSize ? { fontSize: style.fontSize } : {}),
					...(style.fontFamily
						? { fontFamily: curatedFontStack(style.fontFamily) }
						: {}),
				}),
			);
		}
		for (const [wid, href] of Object.entries(pendingLinksRef.current)) {
			postToPreview(setLinkHrefMessage(wid, href));
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
				),
			);
		}
	}, [postToPreview]);

	const openDiscardPrompt = useCallback((nextMode: EditorMode | null) => {
		setDiscardPrompt({ nextMode });
	}, []);

	const confirmDiscardPrompt = useCallback(() => {
		setDiscardPrompt((prompt) => {
			if (prompt?.nextMode) setModeState(prompt.nextMode);
			return null;
		});
		discard();
	}, [discard]);

	const cancelDiscardPrompt = useCallback(() => setDiscardPrompt(null), []);

	const resolveConflict = useCallback(() => {
		setConflictOpen(false);
		discard();
		void queryClient.invalidateQueries({
			queryKey: pageKeys.overview(projectId),
		});
	}, [discard, projectId, queryClient]);

	const value = useMemo<PageEditorContextValue>(
		() => ({
			mode,
			requestMode,
			selection,
			setSelection,
			clearSelection,
			pendingText,
			pendingStyles,
			pendingImages,
			pendingLinks,
			pendingRemovals,
			pendingSectionStyles,
			pendingTokens,
			dirtyCount,
			isSaving,
			discardCount,
			recordText,
			applyStyle,
			applyImage,
			applyLinkHref,
			removeElement,
			applySectionStyle,
			applyTokens,
			save,
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
		}),
		[
			mode,
			requestMode,
			selection,
			setSelection,
			clearSelection,
			pendingText,
			pendingStyles,
			pendingImages,
			pendingLinks,
			pendingRemovals,
			pendingSectionStyles,
			pendingTokens,
			dirtyCount,
			isSaving,
			discardCount,
			recordText,
			applyStyle,
			applyImage,
			applyLinkHref,
			removeElement,
			applySectionStyle,
			applyTokens,
			save,
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
		],
	);

	return (
		<PageEditorContext.Provider value={value}>
			{children}
		</PageEditorContext.Provider>
	);
}

export function usePageEditor(): PageEditorContextValue {
	const context = useContext(PageEditorContext);
	if (!context) {
		throw new Error("usePageEditor must be used inside <PageEditorProvider>");
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
	return resolved;
}

// ── Save pruning helpers ────────────────────────────────────────────────────
// After a successful save, only the entries the batch actually persisted are
// cleared: anything recorded while the request was in flight differs from
// the saved snapshot and stays pending (rebased onto the new version).

function diffPendingValues(
	current: Record<string, string>,
	saved: Record<string, string>,
): Record<string, string> {
	const next: Record<string, string> = {};
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
		// Styles merge per property — keep only the properties that changed
		// after the snapshot was taken.
		const leftover: PendingElementStyle = {};
		if (style.color !== undefined && style.color !== savedStyle.color) {
			leftover.color = style.color;
		}
		if (
			style.fontSize !== undefined &&
			style.fontSize !== savedStyle.fontSize
		) {
			leftover.fontSize = style.fontSize;
		}
		if (
			style.fontFamily !== undefined &&
			style.fontFamily !== savedStyle.fontFamily
		) {
			leftover.fontFamily = style.fontFamily;
		}
		if (Object.keys(leftover).length > 0) next[wid] = leftover;
	}
	return next;
}

function diffPendingSectionStyles(
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
		// Section styles merge per property too — keep only what changed after
		// the snapshot was taken.
		const leftover: PendingSectionStyle = {};
		if (
			patch.paddingTop !== undefined &&
			patch.paddingTop !== savedPatch.paddingTop
		) {
			leftover.paddingTop = patch.paddingTop;
		}
		if (
			patch.paddingBottom !== undefined &&
			patch.paddingBottom !== savedPatch.paddingBottom
		) {
			leftover.paddingBottom = patch.paddingBottom;
		}
		if (
			patch.backgroundImage !== undefined &&
			patch.backgroundImage !== savedPatch.backgroundImage
		) {
			leftover.backgroundImage = patch.backgroundImage;
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
