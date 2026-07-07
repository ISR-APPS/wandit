import { useTranslation } from "@wandit/internationalization/react";
import { useThemeColor } from "heroui-native";
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	Text,
	View,
} from "react-native";

import { WanditIcon } from "@/components/wandit-icon";
import { BrandGradientFill } from "@/shared/ui/brand-gradient-fill";

import type { ChatThreadMessage } from "../lib/chat-message";

export type ChatArtifact = {
	title: string;
	meta: string;
};

export function DateSeparator({ label }: { label: string }) {
	return (
		<Text className="text-center font-mono text-[10.5px] text-muted">
			{label}
		</Text>
	);
}

export function UserBubble({ text }: { text: string }) {
	return (
		<View className="max-w-[78%] self-end rounded-[18px] rounded-ee-[5px] bg-surface-secondary px-3.5 py-[11px] dark:bg-surface-tertiary">
			<Text className="text-[14.5px] text-foreground leading-[21px]">
				{text}
			</Text>
		</View>
	);
}

export function ThoughtLine({ label }: { label: string }) {
	return <Text className="text-[12.5px] text-muted">{label}</Text>;
}

export function AssistantText({
	text,
	isStreaming = false,
}: {
	text: string;
	isStreaming?: boolean;
}) {
	const accent = useThemeColor("accent");

	return (
		<Text className="text-[14.5px] text-foreground/90 leading-[22px]">
			{text}
			{isStreaming ? <Text style={{ color: accent }}> |</Text> : null}
		</Text>
	);
}

export function AssistantMessage({
	text,
	isStreaming = false,
}: {
	text: string;
	isStreaming?: boolean;
}) {
	const accent = useThemeColor("accent");
	const muted = useThemeColor("muted");

	if (!text && !isStreaming) {
		return null;
	}

	return (
		<View className="gap-[9px]">
			<View className="flex-row items-center gap-1.5">
				<WanditIcon name="spark" size={12} color={accent} />
				<Text className="font-mono text-[10px] text-muted">wandit</Text>
			</View>
			<AssistantText text={text} isStreaming={isStreaming} />
			{isStreaming && !text ? (
				<ActivityIndicator size="small" color={muted} />
			) : null}
		</View>
	);
}

export function ArtifactCard({ artifact }: { artifact: ChatArtifact }) {
	const { t } = useTranslation();
	const muted = useThemeColor("muted");
	const foreground = useThemeColor("foreground");

	return (
		<View className="gap-[11px] rounded-[16px] border border-accent/35 bg-surface p-3.5">
			<View className="flex-row items-center gap-[9px]">
				<View className="relative h-[34px] w-[34px] items-center justify-center overflow-hidden rounded-[10px]">
					<BrandGradientFill radius={10} />
					<WanditIcon name="spark" size={15} color="#160D07" />
				</View>
				<View className="flex-1">
					<Text className="font-sans-semibold text-[13.5px] text-foreground">
						{artifact.title}
					</Text>
					<Text className="mt-0.5 font-mono text-[10px] text-muted">
						{artifact.meta}
					</Text>
				</View>
				<WanditIcon name="bookmark" size={15} color={muted} />
			</View>
			<View className="flex-row gap-2">
				<Pressable
					accessibilityRole="button"
					className="h-[38px] flex-1 items-center justify-center rounded-[11px] border border-border active:bg-surface-secondary"
				>
					<Text className="font-sans-medium text-[13.5px] text-foreground">
						{t("native.workspace.artifact.details")}
					</Text>
				</Pressable>
				{/* TODO: page preview — inert until the preview screen exists. */}
				<Pressable
					accessibilityRole="button"
					className="h-[38px] flex-1 flex-row items-center justify-center gap-1.5 rounded-[11px] bg-surface-secondary active:opacity-80 dark:bg-surface-tertiary"
				>
					<WanditIcon name="play" size={11} color={foreground} />
					<Text className="font-sans-semibold text-[13.5px] text-foreground">
						{t("native.workspace.artifact.preview")}
					</Text>
				</Pressable>
			</View>
			{/* Reactions row (dark prototype §4) — inert until wired. */}
			<View className="flex-row gap-4 px-0.5 pt-0.5">
				<WanditIcon name="undo" size={15} color={muted} />
				<WanditIcon name="thumbsUp" size={15} color={muted} />
				<View style={{ transform: [{ rotate: "180deg" }] }}>
					<WanditIcon name="thumbsUp" size={15} color={muted} />
				</View>
				<WanditIcon name="copy" size={15} color={muted} />
			</View>
		</View>
	);
}

export function UpdateCard({
	text,
	linkLabel,
}: {
	text: string;
	linkLabel: string;
}) {
	const success = useThemeColor("success");

	return (
		<View className="flex-row items-center gap-[9px] rounded-[14px] border border-border bg-surface px-3 py-2.5">
			<View
				className="h-[7px] w-[7px] rounded-full"
				style={{ backgroundColor: success }}
			/>
			<Text className="flex-1 text-[13px] text-foreground/90">{text}</Text>
			<Pressable accessibilityRole="button">
				<Text className="font-sans-semibold text-[13px] text-accent">
					{linkLabel}
				</Text>
			</Pressable>
		</View>
	);
}

export function SuggestionsRow({
	suggestions,
	onPick,
}: {
	suggestions: string[];
	onPick: (suggestion: string) => void;
}) {
	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			contentContainerClassName="gap-[7px] px-4"
		>
			{suggestions.map((suggestion) => (
				<Pressable
					key={suggestion}
					accessibilityRole="button"
					onPress={() => onPick(suggestion)}
					className="h-8 items-center justify-center rounded-full border border-border bg-surface/60 px-[13px] active:scale-95 dark:bg-surface/60"
				>
					<Text className="text-[12.5px] text-foreground/85">{suggestion}</Text>
				</Pressable>
			))}
		</ScrollView>
	);
}

export function ChatEmptyState() {
	const { t } = useTranslation();
	const muted = useThemeColor("muted");

	return (
		<View className="flex-1 items-center justify-center px-7">
			<View className="w-full items-center gap-2.5 rounded-[20px] border-[1.5px] border-foreground/15 border-dashed px-5 py-7">
				<WanditIcon name="page" size={26} color={muted} strokeWidth={1.4} />
				<Text className="font-display text-[17px] text-foreground">
					{t("native.workspace.chat.empty.title")}
				</Text>
				<Text className="text-center text-[13px] text-muted leading-5">
					{t("native.workspace.chat.empty.subtitle")}
				</Text>
			</View>
		</View>
	);
}

export function ChatThinkingIndicator({ label }: { label: string }) {
	const accent = useThemeColor("accent");

	return (
		<View className="gap-[9px]">
			<View className="flex-row items-center gap-1.5">
				<WanditIcon name="spark" size={12} color={accent} />
				<Text className="font-mono text-[10px] text-muted">wandit</Text>
			</View>
			<View className="flex-row items-center gap-2">
				<ActivityIndicator size="small" color={accent} />
				<Text className="text-[12.5px] text-muted">{label}</Text>
			</View>
		</View>
	);
}

export function ChatErrorBanner({ message }: { message: string }) {
	return (
		<View className="rounded-[14px] border border-accent/35 bg-accent/10 px-3 py-2.5">
			<Text className="text-[13px] text-foreground/90 leading-5">
				{message}
			</Text>
		</View>
	);
}

export function ChatLoadingState() {
	const accent = useThemeColor("accent");

	return (
		<View className="flex-1 items-center justify-center">
			<ActivityIndicator size="small" color={accent} />
		</View>
	);
}

export function ChatMessages({ messages }: { messages: ChatThreadMessage[] }) {
	return (
		<>
			{messages.map((message) => {
				if (message.role === "user") {
					return <UserBubble key={message.id} text={message.text} />;
				}
				return (
					<AssistantMessage
						key={message.id}
						text={message.text}
						isStreaming={message.isStreaming}
					/>
				);
			})}
		</>
	);
}
