import { useTranslation } from "@wandit/internationalization/react";
import { useThemeColor } from "heroui-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { WanditIcon } from "@/components/wandit-icon";
import { BrandGradientFill } from "@/shared/ui/brand-gradient-fill";

import { PAGE_CHROME } from "./chrome";

/** One drafted note with its resolved pin number + section name. */
export type CommentRow = {
	wid: string;
	label: string;
	n: number;
	text: string;
};

type CommentModeOverlayProps = {
	comments: CommentRow[];
	/** The block awaiting a note — set by tapping the page. */
	target: { id: string; label: string; n: number } | null;
	/** Existing note text when re-editing a pinned block. */
	targetInitialText: string;
	listOpen: boolean;
	onExit: () => void;
	onToggleList: () => void;
	onClearAll: () => void;
	onCancelTarget: () => void;
	/** ⌜Add comment⌟ — pin the note, free the composer for the next block. */
	onCommit: (text: string) => void;
	/** ⌜Send to Wandit⌟ — ship every pin (plus the live draft) to the chat. */
	onSend: (draft: string | null) => void;
	onEditComment: (wid: string) => void;
	onRemoveComment: (wid: string) => void;
};

/** Comment mode (§5a pins & batch tray): a dark bar counts the pins; tapping
    a block swaps it for the composer card; the list sheet reviews the batch. */
export function CommentModeOverlay(props: CommentModeOverlayProps) {
	const { target } = props;

	return (
		<View className="gap-2.5 px-3">
			{props.listOpen && !target ? <CommentListSheet {...props} /> : null}
			{target ? (
				<CommentComposer
					key={target.id}
					target={target}
					initialText={props.targetInitialText}
					pendingCount={
						props.comments.filter((c) => c.wid !== target.id).length
					}
					onCancel={props.onCancelTarget}
					onCommit={props.onCommit}
					onSend={props.onSend}
				/>
			) : (
				<CommentBar {...props} />
			)}
		</View>
	);
}

function CommentBar({
	comments,
	listOpen,
	onExit,
	onToggleList,
	onSend,
}: CommentModeOverlayProps) {
	const { t } = useTranslation();
	const count = comments.length;

	return (
		<View
			className="h-[56px] flex-row items-center gap-1.5 rounded-full ps-2 pe-1.5"
			style={{ backgroundColor: PAGE_CHROME.bar }}
		>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={t("native.page.comment.exit")}
				onPress={onExit}
				className="h-[42px] w-[42px] items-center justify-center rounded-full active:scale-[0.92]"
				style={{ backgroundColor: PAGE_CHROME.faint }}
			>
				<WanditIcon
					name="close"
					size={15}
					color={PAGE_CHROME.text}
					strokeWidth={2.2}
				/>
			</Pressable>
			<Pressable
				accessibilityRole="button"
				onPress={onToggleList}
				disabled={count === 0}
				className="h-[42px] min-w-0 flex-1 flex-row items-center gap-2 rounded-full px-2.5"
			>
				{count > 0 ? (
					<View className="relative h-[22px] w-[22px] items-center justify-center overflow-hidden rounded-full">
						<BrandGradientFill radius={11} />
						<Text className="font-mono-semibold text-[10px] text-white">
							{count}
						</Text>
					</View>
				) : null}
				<Text
					numberOfLines={1}
					className="min-w-0 flex-1 font-sans-semibold text-[13.5px]"
					style={{
						color: count > 0 ? PAGE_CHROME.text : PAGE_CHROME.textMuted,
					}}
				>
					{count > 0
						? t("native.page.comment.reviewHint")
						: t("native.page.comment.emptyHint")}
				</Text>
				{count > 0 ? (
					<View
						style={{ transform: [{ rotate: listOpen ? "0deg" : "180deg" }] }}
					>
						<WanditIcon
							name="caretDown"
							size={13}
							color={PAGE_CHROME.textMuted}
							strokeWidth={2.2}
						/>
					</View>
				) : null}
			</Pressable>
			{count > 0 ? (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={t("native.page.comment.send")}
					onPress={() => onSend(null)}
					className="relative h-[44px] flex-row items-center gap-1.5 overflow-hidden rounded-full px-4 active:scale-[0.95]"
				>
					<BrandGradientFill radius={22} />
					<Text className="font-sans-bold text-[14px] text-white">
						{t("native.page.comment.send")}
					</Text>
					<WanditIcon
						name="arrowRight"
						size={13}
						color="#FFFFFF"
						strokeWidth={2.4}
					/>
				</Pressable>
			) : null}
		</View>
	);
}

function CommentComposer({
	target,
	initialText,
	pendingCount,
	onCancel,
	onCommit,
	onSend,
}: {
	target: { id: string; label: string; n: number };
	initialText: string;
	/** Pins already in the tray besides this block. */
	pendingCount: number;
	onCancel: () => void;
	onCommit: (text: string) => void;
	onSend: (draft: string | null) => void;
}) {
	const { t } = useTranslation();
	const [draft, setDraft] = useState(initialText);
	const trimmed = draft.trim();
	const totalToSend = pendingCount + (trimmed ? 1 : 0);
	const isUpdate = initialText.length > 0;

	return (
		<View
			className="rounded-[22px] p-3"
			style={{ backgroundColor: PAGE_CHROME.card }}
		>
			<View className="flex-row items-center gap-2">
				<View
					className="h-[26px] max-w-[70%] flex-row items-center gap-1.5 rounded-full ps-1 pe-2.5"
					style={{ backgroundColor: "rgba(239,91,54,0.24)" }}
				>
					<View className="relative h-[18px] w-[18px] items-center justify-center overflow-hidden rounded-full">
						<BrandGradientFill radius={9} />
						<Text className="font-mono-semibold text-[9px] text-white">
							{target.n}
						</Text>
					</View>
					<Text
						numberOfLines={1}
						className="font-sans-semibold text-[12px]"
						style={{ color: "#F4B597" }}
					>
						{target.label}
					</Text>
				</View>
				<View className="flex-1" />
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={t("native.page.comment.cancel")}
					onPress={onCancel}
					className="h-[28px] w-[28px] items-center justify-center rounded-full active:scale-[0.9]"
					style={{ backgroundColor: PAGE_CHROME.faint }}
				>
					<WanditIcon
						name="close"
						size={13}
						color={PAGE_CHROME.text}
						strokeWidth={2.2}
					/>
				</Pressable>
			</View>
			<TextInput
				autoFocus
				multiline
				value={draft}
				onChangeText={setDraft}
				placeholder={t("native.page.comment.placeholder")}
				placeholderTextColor={PAGE_CHROME.textMuted}
				className="mt-2.5 min-h-[66px] rounded-[14px] px-3 py-2.5 font-sans text-[14.5px] leading-5"
				style={{
					backgroundColor: "rgba(255,255,255,0.06)",
					borderWidth: 1,
					borderColor: PAGE_CHROME.border,
					color: PAGE_CHROME.text,
					textAlignVertical: "top",
				}}
			/>
			<View className="mt-2.5 flex-row items-center gap-2">
				<Pressable
					accessibilityRole="button"
					disabled={!trimmed}
					onPress={() => onCommit(trimmed)}
					className="h-[44px] flex-1 flex-row items-center justify-center gap-1.5 rounded-full active:scale-[0.97]"
					style={{
						borderWidth: 1,
						borderColor: PAGE_CHROME.border,
						opacity: trimmed ? 1 : 0.4,
					}}
				>
					<WanditIcon
						name="plus"
						size={13}
						color={PAGE_CHROME.text}
						strokeWidth={2}
					/>
					<Text
						className="font-sans-semibold text-[14px]"
						style={{ color: PAGE_CHROME.text }}
					>
						{isUpdate
							? t("native.page.comment.update")
							: t("native.page.comment.add")}
					</Text>
				</Pressable>
				<Pressable
					accessibilityRole="button"
					disabled={totalToSend === 0}
					onPress={() => onSend(trimmed || null)}
					className="relative h-[44px] flex-[1.15] flex-row items-center justify-center gap-1.5 overflow-hidden rounded-full active:scale-[0.97]"
					style={{ opacity: totalToSend > 0 ? 1 : 0.4 }}
				>
					<BrandGradientFill radius={22} />
					<WanditIcon name="spark" size={13} color="#FFFFFF" />
					<Text
						numberOfLines={1}
						className="font-sans-bold text-[14px] text-white"
					>
						{totalToSend > 1
							? t("native.page.comment.sendMany", { count: totalToSend })
							: t("native.page.comment.sendOne")}
					</Text>
				</Pressable>
			</View>
		</View>
	);
}

function CommentListSheet({
	comments,
	onClearAll,
	onEditComment,
	onRemoveComment,
}: CommentModeOverlayProps) {
	const { t } = useTranslation();
	const muted = useThemeColor("muted");

	return (
		<View className="max-h-[300px] overflow-hidden rounded-[20px] border border-border bg-background shadow-lg">
			<View className="flex-row items-center gap-2 border-border/70 border-b px-3.5 pt-3 pb-2.5">
				<Text className="flex-1 font-sans-bold text-[14px] text-foreground">
					{t("native.page.comment.countLabel", { count: comments.length })}
				</Text>
				<Pressable accessibilityRole="button" onPress={onClearAll}>
					<Text className="font-sans-semibold text-[12.5px] text-muted">
						{t("native.page.comment.clearAll")}
					</Text>
				</Pressable>
			</View>
			<ScrollView className="px-2.5 py-2" contentContainerClassName="gap-2">
				{comments.map((comment) => (
					<View
						key={comment.wid}
						className="flex-row gap-2.5 rounded-[14px] border border-border bg-surface p-2.5 dark:bg-surface-tertiary/50"
					>
						<View className="relative h-[22px] w-[22px] items-center justify-center overflow-hidden rounded-full">
							<BrandGradientFill radius={11} />
							<Text className="font-mono-semibold text-[10px] text-white">
								{comment.n}
							</Text>
						</View>
						<Pressable
							accessibilityRole="button"
							className="min-w-0 flex-1"
							onPress={() => onEditComment(comment.wid)}
						>
							<Text className="font-mono text-[9.5px] text-muted uppercase tracking-[1px]">
								{comment.label}
							</Text>
							<Text className="mt-0.5 text-[13px] text-foreground leading-[18px]">
								{comment.text}
							</Text>
						</Pressable>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={t("native.page.comment.remove")}
							onPress={() => onRemoveComment(comment.wid)}
							className="h-[26px] w-[26px] items-center justify-center rounded-full bg-surface-secondary active:scale-[0.9]"
						>
							<WanditIcon
								name="close"
								size={11}
								color={muted}
								strokeWidth={2.4}
							/>
						</Pressable>
					</View>
				))}
			</ScrollView>
		</View>
	);
}
