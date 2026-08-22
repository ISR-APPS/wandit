// In-thread rendering for one round of ask_user calls — mobile twin of the
// web AskUserGroupCard (parts/ask-user-part.tsx). The questions share a
// single collapsible transcript card while the interactive answer UI stays
// docked on the composer, one question at a time. The card stays COLLAPSED
// by default — the tray is the interaction surface and the transcript is a
// receipt — so only an explicit tap expands it; the collapsed header keeps
// the "{answered}/{total} answered" count ticking as answers land.

import { useTranslation } from "@wandit/internationalization/react";
import { useThemeColor } from "heroui-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { WanditIcon } from "@/components/wandit-icon";
import { BrandGradientFill } from "@/shared/ui/brand-gradient-fill";

import type { AskUserThreadPart } from "../lib/chat-message";
import { TrayPointerChip } from "./request-tray/tray-signals";
import { askAnswerValue } from "./request-tray/use-request-tray";

function isPendingAsk(part: AskUserThreadPart) {
	return part.state === "input-streaming" || part.state === "input-available";
}

export function AskUserGroupCard({
	parts,
	activeAskToolCallId,
	ownsActiveAsk,
	isAfterActiveAsk,
}: {
	parts: AskUserThreadPart[];
	/** The ask currently docked on the composer tray (if any). */
	activeAskToolCallId?: string;
	/** Whether this card's message owns the docked ask. */
	ownsActiveAsk: boolean;
	/** Whether this whole run sits after the docked ask in the turn. */
	isAfterActiveAsk: boolean;
}) {
	const { t } = useTranslation();
	const muted = useThemeColor("muted");
	const activeAskIndex = parts.findIndex(
		(part) => part.toolCallId === activeAskToolCallId,
	);
	const hasOpenAsk = parts.some(isPendingAsk);

	// Skipped questions don't count as answered — "4/5 answered" is honest.
	const answeredCount = parts.filter(
		(part) => part.state === "output-available" && !part.output?.dismissed,
	).length;
	const [open, setOpen] = useState(false);
	const previousHasOpenAsk = useRef(hasOpenAsk);

	// Fold back to the one-line receipt when the last open ask settles —
	// only on that true→false transition, never auto-opening for new asks.
	useEffect(() => {
		if (previousHasOpenAsk.current !== hasOpenAsk) {
			previousHasOpenAsk.current = hasOpenAsk;
			if (!hasOpenAsk) setOpen(false);
		}
	}, [hasOpenAsk]);

	return (
		<View className="overflow-hidden rounded-[14px] border border-border bg-background">
			<Pressable
				accessibilityRole="button"
				accessibilityState={{ expanded: open }}
				onPress={() => setOpen((value) => !value)}
				className="flex-row items-center"
				style={{
					gap: 8,
					paddingHorizontal: 14,
					paddingTop: 12,
					paddingBottom: 10,
				}}
			>
				<Text
					numberOfLines={1}
					className="font-sans-medium text-foreground"
					style={{ flexShrink: 1, fontSize: 13.5 }}
				>
					{t("native.workspace.chat.askUser.questionsTitle")}
				</Text>
				<View className="flex-1" />
				<Text
					className="text-muted"
					style={{ fontSize: 11, writingDirection: "auto" }}
				>
					{open
						? t("native.workspace.chat.askUser.questionCount", {
								count: parts.length,
							})
						: t("native.workspace.chat.askUser.answeredCount", {
								answered: answeredCount,
								total: parts.length,
							})}
				</Text>
				<View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
					<WanditIcon
						name="caretDown"
						size={13}
						color={muted}
						strokeWidth={2}
					/>
				</View>
			</Pressable>
			{open ? (
				<View className="border-border border-t">
					{parts.map((part, index) => {
						const question = part.input?.question;
						const isActive = part.toolCallId === activeAskToolCallId;
						const isPending = isPendingAsk(part);
						const isWaiting =
							!isActive &&
							ownsActiveAsk &&
							isPending &&
							(activeAskIndex >= 0 ? index > activeAskIndex : isAfterActiveAsk);
						const hasOptions = (part.input?.options ?? []).length > 0;

						return (
							<View
								key={part.toolCallId}
								className={index > 0 ? "border-border border-t" : undefined}
								style={{ paddingHorizontal: 14, paddingVertical: 12 }}
							>
								{question ? (
									<Text
										className="text-foreground"
										style={{
											fontSize: 14,
											lineHeight: 21,
											writingDirection: "auto",
										}}
									>
										{question}
									</Text>
								) : null}
								{isActive ? (
									<View style={{ marginTop: 6 }}>
										<TrayPointerChip
											icon={
												part.input?.kind === "attachments"
													? "media"
													: hasOptions
														? "options"
														: "question"
											}
											label={
												hasOptions
													? t("native.workspace.chat.tray.pickBelow")
													: t("native.workspace.chat.tray.answerBelow")
											}
										/>
									</View>
								) : isWaiting ? (
									<Text
										className="text-muted"
										style={{ marginTop: 8, fontSize: 12.5, opacity: 0.7 }}
									>
										{t("native.workspace.chat.askUser.upNext")}
									</Text>
								) : part.state === "output-available" && part.output ? (
									<AskReceiptLine output={part.output} />
								) : part.state === "output-error" ? (
									<Text
										className="text-danger"
										style={{ marginTop: 8, fontSize: 12 }}
									>
										{t("native.workspace.chat.errors.tool")}
									</Text>
								) : null}
							</View>
						);
					})}
				</View>
			) : null}
		</View>
	);
}

/** How the ask settled, in one quiet line. */
function AskReceiptLine({
	output,
}: {
	output: NonNullable<AskUserThreadPart["output"]>;
}) {
	const { t } = useTranslation();
	const success = useThemeColor("success");
	const muted = useThemeColor("muted");

	if (output.dismissed) {
		return (
			<Text className="text-muted" style={{ marginTop: 8, fontSize: 12.5 }}>
				{t("native.workspace.chat.tray.skipped")}
			</Text>
		);
	}

	const value = askAnswerValue(output);
	if (value) {
		return (
			<View className="flex-row items-center" style={{ marginTop: 8, gap: 7 }}>
				<View
					className="items-center justify-center rounded-full bg-success/15"
					style={{ width: 14, height: 14 }}
				>
					<WanditIcon name="check" size={9} color={success} />
				</View>
				<Text
					numberOfLines={1}
					className="text-muted"
					style={{ flexShrink: 1, fontSize: 12.5, writingDirection: "auto" }}
				>
					{value}
				</Text>
				{output.files?.length ? (
					<View
						className="flex-row items-center"
						style={{ flexShrink: 0, gap: 4, opacity: 0.8 }}
					>
						<WanditIcon name="paperclip" size={12} color={muted} />
						<Text
							className="text-muted"
							style={{ fontSize: 11.5, writingDirection: "ltr" }}
						>
							{t("native.workspace.chat.tray.filesSent", {
								count: output.files.length,
							})}
						</Text>
					</View>
				) : null}
			</View>
		);
	}

	// Attachments ask settled with uploads — count receipt instead of text.
	if (output.files?.length) {
		return (
			<View className="flex-row items-center" style={{ marginTop: 8, gap: 7 }}>
				<View
					className="items-center justify-center rounded-full bg-success/15"
					style={{ width: 14, height: 14 }}
				>
					<WanditIcon name="paperclip" size={8} color={success} />
				</View>
				<Text className="text-muted" style={{ fontSize: 12.5 }}>
					{t("native.workspace.chat.tray.filesSent", {
						count: output.files.length,
					})}
				</Text>
			</View>
		);
	}

	if (output.delegated) {
		return (
			<View className="flex-row items-center" style={{ marginTop: 8, gap: 7 }}>
				<View
					className="relative items-center justify-center overflow-hidden rounded-full"
					style={{ width: 14, height: 14 }}
				>
					<BrandGradientFill radius={7} />
				</View>
				<Text className="text-muted" style={{ fontSize: 12.5 }}>
					{t("native.workspace.chat.tray.pickedForYou")}
				</Text>
			</View>
		);
	}

	return null;
}
