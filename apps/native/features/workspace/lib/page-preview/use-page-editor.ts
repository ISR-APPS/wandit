// Native page editor state — the mobile twin of the web's use-page-editor
// (same contract invariants, mobile-sized surface):
// - The client NEVER mutates canonical HTML: live tweaks ride postMessage
//   into the WebView; persistence is ONE op batch → ONE new immutable version
//   via POST /page/ops.
// - Ops are keyed per wid and merged; buildPendingOps freezes the batch
//   order; `baseVersionId` is captured on the first dirty op.
// - A FOREIGN active-version change drops the batch + queued comments (they
//   would 409 anyway); our own save prunes exactly what it persisted and
//   rebases leftovers recorded while the request was in flight.
// The native slice covers text, section spacing/background, element removal
// and the theme tokens; web-only surfaces (images, links, brand logos,
// per-element styles) stay on the web inspector.

import type { PageTokenName } from "@wandit/contracts";
import { curatedFontById, type CuratedFont } from "@wandit/contracts";
import {
	buildFontsCss2Url,
	buildPendingOps,
	clearSelectionMessage,
	countPendingTokenSlot,
	diffPendingSectionStyles,
	diffPendingTokens,
	diffPendingValues,
	nextPendingTokensReset,
	omitWid,
	type PendingSectionStyle,
	type PreviewParentMessage,
	type PreviewSelection,
	pruneMissingTargetComments,
	removeElementMessage,
	removeTargetCommentEntry,
	resolveSectionStylePatch,
	setTextMessage,
	setTokensMessage,
	sourceForPendingOps,
	TARGET_COMMENT_LIMIT,
	type TargetCommentEntry,
	targetCommentPins,
	tokenValuesForPreview,
	tokensEqual,
	upsertTargetCommentEntry,
	applySectionStyleMessage,
} from "@wandit/preview-editor";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { pageKeys } from "@/features/workspace/api/generation.keys";
import {
	applyPageOps,
	PageOpsConflictError,
	PageOpsFailedError,
} from "@/features/workspace/api/pages.requests";
import { type PageEditorMode, scriptModeFor } from "./types";

export type PageEditorSaveResult = "saved" | "noop" | "failed";

type UsePageEditorOptions = {
	projectId: string;
	/** Overview's activeVersion.id — the foreign-version watcher's input. */
	activeVersionId: string | null;
	/** Superseded batch dropped (foreign version landed while dirty). */
	onSuperseded: () => void;
	onSaved: (versionNumber: number) => void;
	onSaveFailed: (reason: string) => void;
};

export type DiscardPrompt = {
	/** Mode to switch to after a confirmed discard (null = stay). */
	nextMode: PageEditorMode | null;
};

export function usePageEditor({
	projectId,
	activeVersionId,
	onSuperseded,
	onSaved,
	onSaveFailed,
}: UsePageEditorOptions) {
	const queryClient = useQueryClient();

	const [mode, setModeState] = useState<PageEditorMode>("view");
	const [selection, setSelectionState] = useState<PreviewSelection | null>(
		null,
	);
	const [comments, setComments] = useState<TargetCommentEntry[]>([]);
	const [pendingText, setPendingText] = useState<Record<string, string>>({});
	const [pendingRemovals, setPendingRemovals] = useState<string[]>([]);
	const [pendingSectionStyles, setPendingSectionStyles] = useState<
		Record<string, PendingSectionStyle>
	>({});
	const [pendingTokens, setPendingTokens] = useState<
		Partial<Record<PageTokenName, string>>
	>({});
	const [pendingTokensReset, setPendingTokensReset] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [isDispatching, setIsDispatching] = useState(false);
	const [discardCount, setDiscardCount] = useState(0);
	const [discardPrompt, setDiscardPrompt] = useState<DiscardPrompt | null>(
		null,
	);
	const [conflictOpen, setConflictOpen] = useState(false);

	const dirtyCount =
		Object.keys(pendingText).length +
		pendingRemovals.length +
		Object.keys(pendingSectionStyles).length +
		countPendingTokenSlot(pendingTokensReset, pendingTokens);
	const dirtyRef = useRef(dirtyCount);
	dirtyRef.current = dirtyCount;

	// Render-mirrored refs: save() needs the LATEST committed pending state
	// when its request resolves, and replayPending() runs from WebView onReady.
	const pendingTextRef = useRef(pendingText);
	pendingTextRef.current = pendingText;
	const pendingRemovalsRef = useRef(pendingRemovals);
	pendingRemovalsRef.current = pendingRemovals;
	const pendingSectionStylesRef = useRef(pendingSectionStyles);
	pendingSectionStylesRef.current = pendingSectionStyles;
	const pendingTokensRef = useRef(pendingTokens);
	pendingTokensRef.current = pendingTokens;
	const pendingTokensResetRef = useRef(pendingTokensReset);
	pendingTokensResetRef.current = pendingTokensReset;
	const commentsRef = useRef(comments);
	commentsRef.current = comments;
	const baseVersionIdRef = useRef<string | null>(null);
	const activeVersionRef = useRef(activeVersionId);
	activeVersionRef.current = activeVersionId;
	const resetPreviewRef = useRef<{
		values: Record<string, string>;
		fontStylesheetHrefs: string[];
	} | null>(null);
	const tokensResetRevisionRef = useRef(0);
	const saveInFlightRef = useRef<Promise<PageEditorSaveResult> | null>(null);
	const recordingBlockedRef = useRef(false);
	const ownVersionIds = useMemo(() => new Set<string>(), []);

	const callbacksRef = useRef({ onSuperseded, onSaved, onSaveFailed });
	callbacksRef.current = { onSuperseded, onSaved, onSaveFailed };

	// The WebView poster, registered by the screen (remounts per version).
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
		baseVersionIdRef.current =
			baseVersionIdRef.current ?? activeVersionRef.current;
	}, []);

	const resetPending = useCallback(() => {
		pendingTextRef.current = {};
		pendingRemovalsRef.current = [];
		pendingSectionStylesRef.current = {};
		pendingTokensRef.current = {};
		pendingTokensResetRef.current = false;
		baseVersionIdRef.current = null;
		resetPreviewRef.current = null;
		tokensResetRevisionRef.current = 0;
		setPendingText({});
		setPendingRemovals([]);
		setPendingSectionStyles({});
		setPendingTokens({});
		setPendingTokensReset(false);
	}, []);

	// A FOREIGN new active version supersedes any in-flight edits: the ops
	// were made against the old DOM and would 409 — drop them with an honest
	// warning. Our OWN saves already pruned exactly what they persisted.
	const previousVersionRef = useRef<string | null>(activeVersionId);
	useEffect(() => {
		if (previousVersionRef.current === activeVersionId) return;
		previousVersionRef.current = activeVersionId;
		setSelectionState(null);
		if (activeVersionId !== null && ownVersionIds.delete(activeVersionId)) {
			baseVersionIdRef.current =
				dirtyRef.current > 0 ? activeVersionId : null;
			return;
		}
		ownVersionIds.clear();
		setComments([]);
		if (dirtyRef.current > 0) {
			resetPending();
			callbacksRef.current.onSuperseded();
		} else {
			baseVersionIdRef.current = null;
		}
	}, [activeVersionId, ownVersionIds, resetPending]);

	const setSelection = useCallback(
		(next: PreviewSelection | null) => setSelectionState(next),
		[],
	);

	const clearSelection = useCallback(() => {
		setSelectionState(null);
		postToPreview(clearSelectionMessage());
	}, [postToPreview]);

	const forceView = useCallback(() => {
		setModeState("view");
		setSelectionState(null);
		postToPreview(clearSelectionMessage());
	}, [postToPreview]);

	const requestMode = useCallback(
		(next: PageEditorMode) => {
			if (next !== "edit" && dirtyRef.current > 0) {
				setDiscardPrompt({ nextMode: next });
				return;
			}
			setModeState((current) => {
				if (next === current) return current;
				return next;
			});
			setSelectionState(null);
			postToPreview(clearSelectionMessage());
		},
		[postToPreview],
	);

	// ── Comment queue (§5a batch tray) ───────────────────────────────────────

	const upsertComment = useCallback((entry: TargetCommentEntry) => {
		const current = commentsRef.current;
		const exists = current.some(({ wid }) => wid === entry.wid);
		if (!exists && current.length >= TARGET_COMMENT_LIMIT) return false;
		const next = upsertTargetCommentEntry(current, entry);
		commentsRef.current = next;
		setComments(next);
		return true;
	}, []);

	const removeComment = useCallback((wid: string) => {
		const next = removeTargetCommentEntry(commentsRef.current, wid);
		commentsRef.current = next;
		setComments(next);
	}, []);

	const clearComments = useCallback(() => {
		commentsRef.current = [];
		setComments([]);
	}, []);

	const commentPins = useMemo(() => targetCommentPins(comments), [comments]);

	// ── Recorders (record + live-apply) ──────────────────────────────────────

	const recordText = useCallback(
		(wid: string, value: string) => {
			if (recordingBlockedRef.current) return;
			touchBase();
			setPendingText((prev) => ({ ...prev, [wid]: value }));
			postToPreview(setTextMessage(wid, value));
		},
		[postToPreview, touchBase],
	);

	const removeElement = useCallback(
		(wid: string) => {
			if (recordingBlockedRef.current) return;
			touchBase();
			setPendingRemovals((prev) =>
				prev.includes(wid) ? prev : [...prev, wid],
			);
			// A removed element's other pending edits are moot — drop them so the
			// save batch never targets a wid the removal just deleted.
			setPendingText((prev) => omitWid(prev, wid));
			setPendingSectionStyles((prev) => omitWid(prev, wid));
			const nextComments = removeTargetCommentEntry(commentsRef.current, wid);
			commentsRef.current = nextComments;
			setComments(nextComments);
			setSelectionState((current) =>
				current?.wid === wid ? null : current,
			);
			postToPreview(removeElementMessage(wid));
		},
		[postToPreview, touchBase],
	);

	const applySectionStyle = useCallback(
		(wid: string, patch: PendingSectionStyle) => {
			if (recordingBlockedRef.current) return;
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

	/** Live message value shaping shared by applyTokens and replayPending:
	 * curated font ids become full stacks plus a preview fonts <link>. */
	const postTokensPreview = useCallback(
		(tokens: Partial<Record<PageTokenName, string>>) => {
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
					resetPreviewRef.current?.fontStylesheetHrefs ?? [],
				),
			);
		},
		[postToPreview],
	);

	const applyTokens = useCallback(
		(
			patch: Partial<Record<PageTokenName, string>>,
			effective: Partial<Record<PageTokenName, string>>,
		) => {
			if (recordingBlockedRef.current) return;
			touchBase();
			setPendingTokens((prev) => ({ ...prev, ...patch }));
			postTokensPreview(effective);
		},
		[postTokensPreview, touchBase],
	);

	const resetTokens = useCallback(
		(
			originalTokens: Partial<Record<PageTokenName, string>>,
			baseTokens: Partial<Record<PageTokenName, string>>,
			originalFontStylesheetHrefs: readonly string[] = [],
		) => {
			if (recordingBlockedRef.current) return;
			setPendingTokens({});
			const baseIsOriginal = tokensEqual(baseTokens, originalTokens);
			const values = tokenValuesForPreview(
				baseIsOriginal ? baseTokens : originalTokens,
			);

			if (baseIsOriginal) {
				// Nothing to persist — the base already IS the builder theme; the
				// live message just clears any previewed overrides.
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

	// ── Save / discard ───────────────────────────────────────────────────────

	const saveOnce = useCallback((): Promise<PageEditorSaveResult> => {
		if (saveInFlightRef.current) return saveInFlightRef.current;
		const request = (async (): Promise<PageEditorSaveResult> => {
			const sentText = pendingTextRef.current;
			const sentRemovals = [...pendingRemovalsRef.current];
			const sentSectionStyles = pendingSectionStylesRef.current;
			const sentTokens = pendingTokensRef.current;
			const sentReset = pendingTokensResetRef.current;
			const sentResetRevision = tokensResetRevisionRef.current;
			const ops = buildPendingOps({
				text: sentText,
				styles: {},
				images: {},
				placeholderImages: {},
				links: {},
				placeholders: {},
				removals: sentRemovals,
				sectionStyles: sentSectionStyles,
				tokens: sentTokens,
				tokensReset: sentReset,
			});
			const base = baseVersionIdRef.current ?? activeVersionRef.current;
			if (ops.length === 0 || !base) return "noop";

			setIsSaving(true);
			try {
				const response = await applyPageOps(projectId, {
					baseVersionId: base,
					source: sourceForPendingOps(ops),
					ops,
				});
				// Prune EXACTLY what this batch persisted; edits recorded while the
				// request was in flight stay pending, rebased onto the new version.
				// Mark the version as our own BEFORE invalidating so the watcher
				// does not drop them.
				ownVersionIds.add(response.version.id);
				const nextText = diffPendingValues(pendingTextRef.current, sentText);
				const savedRemovals = new Set(sentRemovals);
				const nextRemovals = pendingRemovalsRef.current.filter(
					(wid) => !savedRemovals.has(wid),
				);
				const nextSectionStyles = diffPendingSectionStyles(
					pendingSectionStylesRef.current,
					sentSectionStyles,
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
				if (sentReset && !nextTokensReset) resetPreviewRef.current = null;
				const leftover =
					Object.keys(nextText).length +
					nextRemovals.length +
					Object.keys(nextSectionStyles).length +
					countPendingTokenSlot(nextTokensReset, nextTokens);
				pendingTextRef.current = nextText;
				pendingRemovalsRef.current = nextRemovals;
				pendingSectionStylesRef.current = nextSectionStyles;
				pendingTokensRef.current = nextTokens;
				pendingTokensResetRef.current = nextTokensReset;
				baseVersionIdRef.current =
					leftover > 0 ? response.version.id : null;
				setPendingText(nextText);
				setPendingRemovals(nextRemovals);
				setPendingSectionStyles(nextSectionStyles);
				setPendingTokens(nextTokens);
				setPendingTokensReset(nextTokensReset);
				await Promise.all([
					queryClient.invalidateQueries({
						queryKey: pageKeys.overview(projectId),
					}),
					queryClient.invalidateQueries({
						queryKey: pageKeys.versions(projectId),
					}),
				]);
				callbacksRef.current.onSaved(response.version.number);
				return "saved";
			} catch (error) {
				if (error instanceof PageOpsConflictError) {
					setConflictOpen(true);
				} else if (error instanceof PageOpsFailedError) {
					callbacksRef.current.onSaveFailed(error.reason);
				} else {
					callbacksRef.current.onSaveFailed(
						error instanceof Error ? error.message : String(error),
					);
				}
				return "failed";
			} finally {
				setIsSaving(false);
			}
		})();
		saveInFlightRef.current = request;
		const clear = () => {
			if (saveInFlightRef.current === request) saveInFlightRef.current = null;
		};
		void request.then(clear, clear);
		return request;
	}, [ownVersionIds, projectId, queryClient]);

	/** Drain every leftover snapshot while the dispatch freeze is on, so the
	 * AI reads the fully saved page (web drainPageEditorSaves parity). */
	const save = useCallback(async (): Promise<PageEditorSaveResult> => {
		if (!recordingBlockedRef.current) return saveOnce();
		let result = await saveOnce();
		while (result === "saved") result = await saveOnce();
		return result;
	}, [saveOnce]);

	const discard = useCallback(() => {
		resetPending();
		setSelectionState(null);
		// Remounting the WebView restores the canonical HTML — no revert
		// messages (web discard semantics).
		setDiscardCount((count) => count + 1);
	}, [resetPending]);

	const openDiscardPrompt = useCallback((nextMode: PageEditorMode | null) => {
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

	// ── Ask-AI dispatch freeze ───────────────────────────────────────────────

	const beginDispatch = useCallback(() => {
		if (recordingBlockedRef.current) return false;
		recordingBlockedRef.current = true;
		setIsDispatching(true);
		return true;
	}, []);

	const endDispatch = useCallback(() => {
		recordingBlockedRef.current = false;
		setIsDispatching(false);
	}, []);

	// ── Remount replay ───────────────────────────────────────────────────────

	/** Re-post pending live tweaks into a freshly loaded document (the WebView
	 * remounts per version / discard): the fresh DOM is canonical HTML, so
	 * unsaved edits must be re-applied to stay visible. */
	const replayPending = useCallback(() => {
		for (const [wid, value] of Object.entries(pendingTextRef.current)) {
			postToPreview(setTextMessage(wid, value));
		}
		for (const [wid, patch] of Object.entries(
			pendingSectionStylesRef.current,
		)) {
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
		if (Object.keys(pendingTokensRef.current).length > 0) {
			postTokensPreview(pendingTokensRef.current);
		}
	}, [postToPreview, postTokensPreview]);

	/** Drop queued comments whose wids no longer exist in the rendered
	 * version (called by the screen after each document load). */
	const pruneComments = useCallback((validWids: Iterable<string>) => {
		const result = pruneMissingTargetComments(
			commentsRef.current,
			new Set(validWids),
		);
		if (result.removedCount === 0) return 0;
		commentsRef.current = result.comments;
		setComments(result.comments);
		return result.removedCount;
	}, []);

	return {
		mode,
		scriptMode: scriptModeFor(mode),
		requestMode,
		forceView,
		selection,
		setSelection,
		clearSelection,
		comments,
		commentPins,
		upsertComment,
		removeComment,
		clearComments,
		pruneComments,
		pendingText,
		pendingSectionStyles,
		pendingRemovals,
		pendingTokens,
		pendingTokensReset,
		dirtyCount,
		isSaving,
		isDispatching,
		discardCount,
		recordText,
		removeElement,
		applySectionStyle,
		applyTokens,
		resetTokens,
		save,
		discard,
		beginDispatch,
		endDispatch,
		replayPending,
		discardPrompt,
		openDiscardPrompt,
		confirmDiscardPrompt,
		cancelDiscardPrompt,
		conflictOpen,
		resolveConflict,
		registerPost,
		postToPreview,
	};
}

export type PageEditor = ReturnType<typeof usePageEditor>;
