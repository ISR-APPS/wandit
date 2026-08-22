import MaskedView from "@react-native-masked-view/masked-view";
import { useTranslation } from "@wandit/internationalization/react";
import {
	cssColorToHex,
	dispatchTargetComments,
	parsePageTokens,
	sanitizeTargetCommentEntry,
	setCommentPinsMessage,
	setModeMessage,
	setSuspendedMessage,
	type TargetCommentEntry,
	upsertTargetCommentEntry,
} from "@wandit/preview-editor";
import { BlurView } from "expo-blur";
import { Dialog } from "heroui-native";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { WanditIcon } from "@/components/wandit-icon";
import {
	usePageOverviewPollingQuery,
	useVersionHtmlQuery,
} from "@/features/workspace/api/pages.queries";
import { usePublishController } from "@/features/workspace/lib/use-publish-controller";

import {
	CommentModeOverlay,
	type CommentRow,
} from "../components/page-editor/comment-mode";
import {
	type EditorSheetView,
	PageEditBar,
	PageEditorSheet,
} from "../components/page-editor/edit-mode";
import { PagePreviewWebView } from "../components/page-editor/page-web-view";
import { PageToast, usePageToast } from "../components/page-editor/page-toast";
import { PublishSheet } from "../components/page-editor/publish-sheet";
import { PageViewBar } from "../components/page-editor/view-mode-bar";
import { SpinnerArc } from "../components/spinner-arc";
import { pageCommentHandoff } from "../lib/page-preview/comment-handoff";
import { targetLabel, type PreviewSelection } from "../lib/page-preview/types";
import { usePageEditor } from "../lib/page-preview/use-page-editor";

/** Perceived luminance check so the blur cap tint follows the PAGE palette
    (which is independent of the app theme). */
function isDarkBackground(hex: string): boolean {
	const value = /^#([0-9a-fA-F]{6})$/.exec(hex)?.[1];
	if (!value) return false;
	const r = Number.parseInt(value.slice(0, 2), 16);
	const g = Number.parseInt(value.slice(2, 4), 16);
	const b = Number.parseInt(value.slice(4, 6), 16);
	return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

function commentEntry(
	selection: PreviewSelection,
	comment: string,
): TargetCommentEntry | null {
	const trimmed = comment.trim();
	if (!trimmed) return null;
	return sanitizeTargetCommentEntry({
		wid: selection.wid,
		tag: selection.tag,
		excerpt: selection.excerpt,
		comment: trimmed,
	});
}

/**
 * The landing-page preview behind the header's ember ▶ button — LIVE data:
 * the overview polls while a build runs, the active version's HTML renders
 * in the WebView with the SAME injected editor the web uses. Three modes:
 * browse, comment (pin notes on tapped blocks → one batched AI message with
 * targets), and edit (theme tokens / tapped-target text, spacing, removal →
 * one op batch per Save = one new immutable version).
 */
export function PageScreen() {
	const { projectId: routeProjectId } = useLocalSearchParams<{
		projectId?: string;
	}>();
	const projectId =
		typeof routeProjectId === "string" ? routeProjectId : undefined;
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();
	const toast = usePageToast();

	const overviewQuery = usePageOverviewPollingQuery(projectId ?? "");
	const overview = overviewQuery.data;
	const activeVersion = overview?.activeVersion ?? null;
	const attempt = overview?.latestAttempt ?? null;
	const isGenerating =
		attempt?.status === "queued" || attempt?.status === "generating";
	const htmlQuery = useVersionHtmlQuery(activeVersion?.id);
	const html = htmlQuery.data?.html ?? "";

	const editor = usePageEditor({
		projectId: projectId ?? "",
		activeVersionId: activeVersion?.id ?? null,
		onSuperseded: () => toast.show(t("native.page.editor.superseded")),
		onSaved: (n) => toast.show(t("native.page.editor.saved", { n })),
		onSaveFailed: (reason) =>
			toast.show(t("native.page.editor.saveFailed", { reason })),
	});
	const { mode, selection } = editor;

	const [sheetView, setSheetView] = useState<EditorSheetView>("theme");
	const [sheetOpen, setSheetOpen] = useState(false);
	const [listOpen, setListOpen] = useState(false);
	const [publishOpen, setPublishOpen] = useState(false);
	// 0 at the page top → 1 after ~64px of scroll; drives the top blur cap.
	const [scrollProgress, setScrollProgress] = useState(0);

	// Publishing is real: one controller owns the deployment snapshot, the
	// slug editor, publish/unpublish/rollback and the history — the sheet
	// renders it, the toasts land here.
	const publishController = usePublishController({
		projectId: projectId ?? "",
		enabled: Boolean(projectId),
		sheetOpen: publishOpen,
		onPublished: (liveUrl) =>
			toast.show(
				liveUrl
					? t("native.page.publish.publishedToast", {
							url: liveUrl.replace(/^https:\/\//, ""),
						})
					: t("native.page.publish.liveTitle"),
			),
		onUnpublished: () =>
			toast.show(t("native.page.publish.unpublishedToast")),
		onRolledBack: (n, liveUrl) =>
			toast.show(
				n !== null
					? t("native.page.publish.rolledBackToast", { n })
					: t("native.page.publish.publishedToast", {
							url: (liveUrl ?? "").replace(/^https:\/\//, ""),
						}),
			),
		onError: (message) => toast.show(message),
	});
	const published = publishController.published;
	const publishing = publishController.publishing;

	// The page's own background drives the chrome (blur tint, bar fade).
	const pageBg = useMemo(() => {
		const raw = parsePageTokens(html).background;
		return (raw ? cssColorToHex(raw) : null) ?? "#FFFFFF";
	}, [html]);

	// Wids that exist in the rendered version — queued comments for wids a
	// foreign/AI version dropped are pruned with an honest note.
	const validWids = useMemo(() => {
		const wids = new Set<string>();
		for (const match of html.matchAll(/data-wid="([^"]+)"/g)) {
			const wid = match[1];
			if (wid) wids.add(wid);
		}
		return wids;
	}, [html]);
	const { pruneComments, comments } = editor;
	useEffect(() => {
		if (html.length === 0 || comments.length === 0) return;
		const removed = pruneComments(validWids);
		if (removed > 0) toast.show(t("native.page.editor.targetRemoved"));
	}, [comments.length, html.length, pruneComments, t, toast, validWids]);

	// Mirror mode / pins / dispatch freeze into the page whenever they change
	// (posts made before the document is ready queue inside the WebView).
	const { postToPreview, scriptMode, commentPins, isDispatching } = editor;
	useEffect(() => {
		postToPreview(setModeMessage(scriptMode));
	}, [postToPreview, scriptMode]);
	useEffect(() => {
		postToPreview(setCommentPinsMessage(commentPins));
	}, [commentPins, postToPreview]);
	useEffect(() => {
		postToPreview(setSuspendedMessage(isDispatching));
	}, [isDispatching, postToPreview]);

	// A build kicking off mid-edit force-exits the editor: the page is about
	// to be replaced. Dirty state gets the discard confirm instead of a
	// silent drop (web parity).
	const { dirtyCount, forceView, openDiscardPrompt } = editor;
	useEffect(() => {
		if (!isGenerating || mode === "view") return;
		setSheetOpen(false);
		if (dirtyCount > 0) {
			openDiscardPrompt(null);
		} else {
			forceView();
		}
	}, [dirtyCount, forceView, isGenerating, mode, openDiscardPrompt]);

	// ── Comment mode (§5a pins & batch tray) ─────────────────────────────────

	const commentRows: CommentRow[] = editor.comments.map((entry, index) => ({
		wid: entry.wid,
		label: targetLabel(entry),
		n: index + 1,
		text: entry.comment,
	}));
	const commentTarget = mode === "comment" ? selection : null;
	const targetRow = commentTarget
		? {
				id: commentTarget.wid,
				label: targetLabel(commentTarget),
				n:
					commentRows.find((row) => row.wid === commentTarget.wid)?.n ??
					editor.comments.length + 1,
			}
		: null;

	/** Freeze → drain manual saves → stash the batch for the chat screen →
	 * pop back. The chat screen consumes the handoff on focus and ships it as
	 * ONE user message with selectedWids + selectedTargets (web format). */
	async function dispatchBatch(batch: TargetCommentEntry[]) {
		if (!projectId) return;
		const result = await dispatchTargetComments({
			comments: batch,
			begin: editor.beginDispatch,
			end: editor.endDispatch,
			save: editor.save,
			send: async (text, { selectedWids, selectedTargets }) => {
				pageCommentHandoff.stash(projectId, {
					text,
					selectedWids,
					selectedTargets,
				});
				return true;
			},
			onSendFailure: () => toast.show(t("native.page.editor.askAiFailed")),
			onSuccess: editor.clearComments,
		});
		if (result === "sent") {
			setListOpen(false);
			editor.forceView();
			router.back();
		}
	}

	/** "Send to Wandit": the pinned batch plus the composer's live draft. */
	function sendBatch(draft: string | null) {
		let batch = editor.comments;
		if (commentTarget && draft) {
			const entry = commentEntry(commentTarget, draft);
			if (entry) batch = upsertTargetCommentEntry([...batch], entry);
		}
		if (batch.length === 0) return;
		void dispatchBatch(batch);
	}

	function exitCommentMode() {
		editor.clearComments();
		setListOpen(false);
		editor.requestMode("view");
	}

	/** The bar's ⌜Done⌟ — leaves edit mode (dirty state gets the discard
	    confirm via requestMode; Save lives on the pending strip). */
	function exitEditMode() {
		setSheetOpen(false);
		editor.requestMode("view");
	}

	// Keep the page's own bottom padding clear of whichever overlay is up.
	const padBottom =
		mode === "view"
			? 130
			: mode === "comment"
				? commentTarget
					? 320
					: listOpen
						? 460
						: 140
				: sheetOpen
					? 380
					: 150;

	const chipLabel =
		mode === "comment"
			? t("native.page.chip.comment")
			: mode === "edit"
				? t("native.page.chip.edit")
				: null;

	// The cap covers the status bar plus the mode chip, then keeps going for a
	// long tail the gradient mask dissolves — so the blur has no bottom edge.
	const blurCapHeight = insets.top + (chipLabel ? 50 : 12) + 44;
	const pageIsDark = isDarkBackground(pageBg);

	// ── Empty / building / failed states (no version to render yet) ──────────

	const statePending =
		overviewQuery.isPending || (activeVersion !== null && htmlQuery.isPending);

	if (!projectId || statePending) {
		return (
			<View className="flex-1 items-center justify-center bg-background">
				<SpinnerArc size={26} />
			</View>
		);
	}

	if (!activeVersion) {
		return (
			<View className="flex-1 items-center justify-center bg-background px-8">
				{isGenerating ? (
					<StateCard
						spinner
						title={t("native.page.state.generatingTitle")}
						body={t("native.page.state.generatingBody")}
					/>
				) : attempt?.status === "failed" ? (
					<StateCard
						icon="close"
						title={t("native.page.state.failedTitle")}
						body={attempt.error ?? t("native.page.state.failedBody")}
					/>
				) : (
					<StateCard
						icon="spark"
						title={t("native.page.state.emptyTitle")}
						body={t("native.page.state.emptyBody")}
					/>
				)}
				<Pressable
					accessibilityRole="button"
					onPress={() => router.back()}
					className="mt-6 h-[46px] flex-row items-center justify-center gap-1.5 rounded-full border border-border px-5 active:scale-[0.97]"
				>
					<Text className="font-sans-semibold text-[14px] text-foreground">
						{t("native.page.bar.chat")}
					</Text>
				</Pressable>
			</View>
		);
	}

	return (
		<View className="flex-1 bg-background">
			<PagePreviewWebView
				key={`${activeVersion.id}-${editor.discardCount}`}
				html={html}
				registerPost={editor.registerPost}
				onReady={() => {
					// A fresh document boots in browse mode — resend the current
					// surface state, then replay unsaved edits (web onReady parity).
					postToPreview(setModeMessage(editor.scriptMode));
					postToPreview(setCommentPinsMessage(editor.commentPins));
					postToPreview(setSuspendedMessage(editor.isDispatching));
					editor.replayPending();
				}}
				onSelect={(next) => {
					editor.setSelection(next);
					if (mode === "edit") {
						setSheetView("target");
						setSheetOpen(true);
					}
					if (mode === "comment") setListOpen(false);
				}}
				onDeselect={() => {
					editor.setSelection(null);
					if (mode === "edit" && sheetView === "target") setSheetOpen(false);
				}}
				onScrollProgress={setScrollProgress}
				backgroundColor={pageBg}
				insetTop={insets.top + (mode === "view" ? 6 : 46)}
				insetBottom={padBottom}
			/>

			{scrollProgress > 0 ? (
				<MaskedView
					pointerEvents="none"
					style={{
						position: "absolute",
						top: 0,
						insetInlineStart: 0,
						insetInlineEnd: 0,
						height: blurCapHeight,
					}}
					maskElement={
						// The mask fades the WHOLE cap (blur + wash) to nothing, so
						// there is no visible seam where the effect stops.
						<Svg style={StyleSheet.absoluteFill}>
							<Defs>
								<LinearGradient id="pageBlurMask" x1="0" y1="0" x2="0" y2="1">
									<Stop offset="0" stopColor="#fff" stopOpacity={1} />
									<Stop offset="0.45" stopColor="#fff" stopOpacity={1} />
									<Stop offset="1" stopColor="#fff" stopOpacity={0} />
								</LinearGradient>
							</Defs>
							<Rect
								x="0"
								y="0"
								width="100%"
								height="100%"
								fill="url(#pageBlurMask)"
							/>
						</Svg>
					}
				>
					<BlurView
						intensity={Math.round(34 * scrollProgress)}
						tint={pageIsDark ? "dark" : "light"}
						style={StyleSheet.absoluteFill}
					/>
					{/* Faint wash of the page's own bg keeps the chip legible. */}
					<View
						style={[
							StyleSheet.absoluteFill,
							{
								backgroundColor: pageBg,
								opacity: 0.3 * scrollProgress,
							},
						]}
					/>
				</MaskedView>
			) : null}

			{chipLabel ? (
				<View
					pointerEvents="none"
					className="absolute inset-x-0 items-center"
					style={{ top: insets.top + 10 }}
				>
					<View
						className="h-[26px] items-center justify-center rounded-full border px-3"
						style={{
							backgroundColor: "rgba(239,91,54,0.16)",
							borderColor: "rgba(239,91,54,0.35)",
						}}
					>
						<Text
							className="font-mono-semibold text-[10px] tracking-[1px]"
							style={{ color: "#C2502F" }}
						>
							{chipLabel.toUpperCase()}
						</Text>
					</View>
				</View>
			) : null}

			{attempt?.status === "failed" ? (
				// A later build failed but this version still stands — quiet note
				// instead of hijacking the whole stage (web parity).
				<View
					pointerEvents="none"
					className="absolute inset-x-8 items-center"
					style={{ top: insets.top + (chipLabel ? 44 : 10) }}
				>
					<View
						className="max-w-full flex-row items-center gap-1.5 rounded-full border px-3 py-1.5"
						style={{
							backgroundColor: "rgba(198,67,42,0.12)",
							borderColor: "rgba(198,67,42,0.35)",
						}}
					>
						<Text
							numberOfLines={1}
							className="min-w-0 font-sans-semibold text-[11.5px]"
							style={{ color: "#C6432A" }}
						>
							{t("native.page.state.laterBuildFailed")}
						</Text>
					</View>
				</View>
			) : null}

			{isGenerating && mode === "view" ? (
				<View
					pointerEvents="none"
					className="absolute inset-0 items-center justify-center"
					style={{ backgroundColor: "rgba(0,0,0,0.25)" }}
				>
					<View className="items-center gap-3 rounded-[20px] bg-background px-7 py-6 shadow-lg">
						<SpinnerArc size={22} />
						<Text className="font-sans-semibold text-[14px] text-foreground">
							{t("native.page.state.generatingTitle")}
						</Text>
					</View>
				</View>
			) : null}

			<KeyboardStickyView
				offset={{ closed: 0, opened: insets.bottom }}
				style={{
					position: "absolute",
					insetInlineStart: 0,
					insetInlineEnd: 0,
					bottom: 0,
				}}
			>
				<View className="gap-2.5" style={{ paddingBottom: insets.bottom + 12 }}>
					{mode === "view" ? (
						<PageViewBar
							onBackToChat={() => router.back()}
							onStartComment={() => editor.requestMode("comment")}
							onStartEdit={() => {
								editor.requestMode("edit");
								setSheetView("theme");
								setSheetOpen(false);
							}}
							onOpenPublish={() => setPublishOpen(true)}
							published={published}
							fadeColor={pageBg}
						/>
					) : null}
					{mode === "comment" ? (
						<CommentModeOverlay
							comments={commentRows}
							target={targetRow}
							targetInitialText={
								commentTarget
									? (editor.comments.find(
											(entry) => entry.wid === commentTarget.wid,
										)?.comment ?? "")
									: ""
							}
							listOpen={listOpen}
							onExit={exitCommentMode}
							onToggleList={() => setListOpen((open) => !open)}
							onClearAll={() => {
								editor.clearComments();
								setListOpen(false);
							}}
							onCancelTarget={editor.clearSelection}
							onCommit={(text) => {
								if (!commentTarget) return;
								const entry = commentEntry(commentTarget, text);
								if (!entry) return;
								if (!editor.upsertComment(entry)) {
									toast.show(t("native.page.comment.queueFull"));
									return;
								}
								editor.clearSelection();
							}}
							onSend={sendBatch}
							onEditComment={(wid) => {
								setListOpen(false);
								// Re-selecting via the page keeps pin numbers stable; the
								// composer just reopens on the queued entry.
								const queued = editor.comments.find(
									(entry) => entry.wid === wid,
								);
								if (queued) {
									editor.setSelection({
										// Minimal synthetic selection: the composer only reads
										// wid/tag/excerpt.
										...(selection ?? SYNTHETIC_SELECTION),
										wid: queued.wid,
										tag: queued.tag,
										excerpt: queued.excerpt,
									});
								}
							}}
							onRemoveComment={(wid) => {
								editor.removeComment(wid);
								if (editor.comments.length <= 1) setListOpen(false);
							}}
						/>
					) : null}
					{mode === "edit" ? (
						<PageEditBar
							dirtyCount={editor.dirtyCount}
							saving={editor.isSaving}
							onOpenTheme={() => {
								setSheetView("theme");
								setSheetOpen(true);
							}}
							onDiscard={() => editor.openDiscardPrompt(null)}
							onSave={() => void editor.save()}
							onDone={exitEditMode}
						/>
					) : null}
				</View>
			</KeyboardStickyView>

			<PageEditorSheet
				isOpen={mode === "edit" && sheetOpen}
				onOpenChange={(open) => {
					setSheetOpen(open);
					if (!open) editor.clearSelection();
				}}
				view={sheetView}
				projectId={projectId}
				canonicalHtml={html}
				editor={editor}
			/>

			<PublishSheet
				isOpen={publishOpen}
				onOpenChange={setPublishOpen}
				controller={publishController}
			/>

			<Dialog
				isOpen={editor.discardPrompt !== null}
				onOpenChange={(open) => {
					if (!open) editor.cancelDiscardPrompt();
				}}
			>
				<Dialog.Portal>
					<Dialog.Overlay className="bg-black/50" />
					<Dialog.Content className="p-5">
						<Dialog.Title className="font-sans-semibold text-[16px]">
							{t("native.page.editor.discardTitle")}
						</Dialog.Title>
						<Dialog.Description className="mt-2 font-sans-medium text-[14px] text-muted leading-5">
							{t("native.page.editor.changesCount", {
								count: editor.dirtyCount,
							})}
						</Dialog.Description>
						<View className="mt-[18px] flex-row gap-2.5">
							<Pressable
								accessibilityRole="button"
								onPress={editor.cancelDiscardPrompt}
								className="h-[46px] flex-1 items-center justify-center rounded-full border border-border active:opacity-80"
							>
								<Text className="font-sans-semibold text-[14.5px] text-foreground">
									{t("native.page.editor.discardKeep")}
								</Text>
							</Pressable>
							<Pressable
								accessibilityRole="button"
								onPress={editor.confirmDiscardPrompt}
								className="h-[46px] flex-1 items-center justify-center rounded-full bg-foreground active:opacity-90"
							>
								<Text className="font-sans-semibold text-[14.5px] text-background">
									{t("native.page.editor.discard")}
								</Text>
							</Pressable>
						</View>
					</Dialog.Content>
				</Dialog.Portal>
			</Dialog>

			<Dialog isOpen={editor.conflictOpen} onOpenChange={() => {}}>
				<Dialog.Portal>
					<Dialog.Overlay className="bg-black/50" />
					<Dialog.Content className="p-5">
						<Dialog.Title className="font-sans-semibold text-[16px]">
							{t("native.page.editor.conflictTitle")}
						</Dialog.Title>
						<Dialog.Description className="mt-2 font-sans-medium text-[14px] text-muted leading-5">
							{t("native.page.editor.conflictBody")}
						</Dialog.Description>
						<Pressable
							accessibilityRole="button"
							onPress={editor.resolveConflict}
							className="mt-[18px] h-[46px] items-center justify-center rounded-full bg-foreground active:opacity-90"
						>
							<Text className="font-sans-semibold text-[14.5px] text-background">
								{t("native.page.editor.conflictReload")}
							</Text>
						</Pressable>
					</Dialog.Content>
				</Dialog.Portal>
			</Dialog>

			<PageToast message={toast.message} bottomOffset={insets.bottom + 90} />
		</View>
	);
}

/** Empty selection scaffold for reopening a queued comment from the list —
 * only wid/tag/excerpt are read by the composer. */
const SYNTHETIC_SELECTION: PreviewSelection = {
	wid: "",
	sectionWid: null,
	tag: "div",
	kind: "element",
	excerpt: null,
	ladder: [],
	ladderIndex: 0,
	text: null,
	src: null,
	inlineWidth: null,
	removable: false,
	textEditable: false,
	isPlaceholderImage: false,
	placeholder: null,
	href: null,
	sectionStyles: null,
	bgImage: null,
	styles: {
		backgroundColor: "",
		borderRadius: "",
		color: "",
		direction: "",
		fontFamily: "",
		fontSize: "",
		fontStyle: "",
		fontWeight: "",
		height: "",
		letterSpacing: "",
		lineHeight: "",
		objectFit: "",
		textAlign: "",
		width: "",
	},
};

function StateCard({
	title,
	body,
	icon,
	spinner,
}: {
	title: string;
	body: string;
	icon?: "spark" | "close";
	spinner?: boolean;
}) {
	return (
		<View className="items-center gap-3">
			{spinner ? (
				<SpinnerArc size={24} />
			) : icon ? (
				<View className="h-[46px] w-[46px] items-center justify-center rounded-full border border-border bg-surface dark:bg-surface-tertiary/50">
					<WanditIcon name={icon} size={18} color="#8A7A66" />
				</View>
			) : null}
			<Text className="text-center font-display-semibold text-[19px] text-foreground tracking-[-0.3px]">
				{title}
			</Text>
			<Text className="text-center text-[13.5px] text-muted leading-5">
				{body}
			</Text>
		</View>
	);
}
