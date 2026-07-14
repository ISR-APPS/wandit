// The swappable answer bodies of the request tray — mobile twin of the web
// tray-bodies.tsx, trimmed to the three kinds the live ask_user contract
// recognizes. Each body renders ONLY the answer control; question, header and
// escape hatch belong to the shell (request-tray.tsx). Single-choice answers
// on the spot; multi-select needs the explicit confirm so individual taps
// never complete the tool call — the confirm button only appears once
// something is picked, so there is never a dead disabled button.
// Layout metrics use explicit style numbers, same rule as the shell.

import { useTranslation } from "@wandit/internationalization/react";
import { cn, useThemeColor } from "heroui-native";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { WanditIcon } from "@/components/wandit-icon";
import { useAppTheme } from "@/contexts/app-theme-context";
import { BrandGradientFill } from "@/shared/ui/brand-gradient-fill";

import type { ChipOption, TrayBody } from "./tray-types";

/** Live answer wiring, threaded in from use-request-tray.ts. */
export type TrayBodyCallbacks = {
	/** Single-choice: one tap answers the ask immediately. */
	onPick?: (option: ChipOption) => void;
	/** Multi-select: controlled selection + explicit confirm. */
	multiSelectedIds?: string[];
	onToggleMulti?: (id: string) => void;
	onConfirmMulti?: () => void;
};

export function TrayBodySlot({
	body,
	callbacks,
}: {
	body: TrayBody;
	callbacks?: TrayBodyCallbacks;
}) {
	switch (body.kind) {
		case "free-text":
			return null; // the composer input is the answer, no body at all
		case "single-choice":
			return (
				<View className="flex-row flex-wrap" style={{ gap: 8 }}>
					{body.options.map((option) => (
						<ChoiceChip
							key={option.id}
							label={option.label}
							selected={false}
							onPress={() => callbacks?.onPick?.(option)}
						/>
					))}
				</View>
			);
		case "multi-select":
			return (
				<MultiSelectBody
					options={body.options}
					selectedIds={callbacks?.multiSelectedIds ?? body.selectedIds}
					onToggle={callbacks?.onToggleMulti}
					onConfirm={callbacks?.onConfirmMulti}
				/>
			);
	}
}

function ChoiceChip({
	label,
	selected,
	withCheck = false,
	onPress,
}: {
	label: string;
	selected: boolean;
	withCheck?: boolean;
	onPress: () => void;
}) {
	const accent = useThemeColor("accent");

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ selected }}
			onPress={onPress}
			className={cn(
				"flex-row items-center rounded-full border active:scale-95",
				selected
					? "border-accent bg-accent/10"
					: "border-border bg-surface active:bg-surface-secondary",
			)}
			style={{ height: 36, paddingHorizontal: 14, gap: 6 }}
		>
			{withCheck && selected ? (
				<WanditIcon name="check" size={11} color={accent} />
			) : null}
			<Text
				className={cn(
					"text-foreground",
					selected ? "font-sans-semibold" : "font-sans-medium",
				)}
				style={{ fontSize: 13.5 }}
			>
				{label}
			</Text>
		</Pressable>
	);
}

function MultiSelectBody({
	options,
	selectedIds,
	onToggle,
	onConfirm,
}: {
	options: ChipOption[];
	selectedIds: string[];
	onToggle?: (id: string) => void;
	onConfirm?: () => void;
}) {
	const { t } = useTranslation();
	const { isDark } = useAppTheme();
	const picked = selectedIds.length;

	return (
		<View style={{ gap: 12 }}>
			<View className="flex-row flex-wrap" style={{ gap: 8 }}>
				{options.map((option) => (
					<ChoiceChip
						key={option.id}
						label={option.label}
						selected={selectedIds.includes(option.id)}
						withCheck
						onPress={() => onToggle?.(option.id)}
					/>
				))}
			</View>
			{picked > 0 ? (
				// The confirm mirrors the composer's send button (ember gradient):
				// confirming picks "sends" the same way a typed prompt does.
				<Animated.View entering={FadeIn.duration(160)} className="flex-row">
					<Pressable
						accessibilityRole="button"
						onPress={onConfirm}
						className="relative flex-row items-center justify-center overflow-hidden rounded-full active:scale-95"
						style={{ height: 38, paddingHorizontal: 18, gap: 7 }}
					>
						<BrandGradientFill radius={19} />
						<WanditIcon
							name="check"
							size={13}
							color={isDark ? "#160D07" : "#FFFFFF"}
						/>
						<Text
							className="font-sans-semibold"
							style={{ fontSize: 13.5, color: isDark ? "#160D07" : "#FFFFFF" }}
						>
							{t("native.workspace.chat.tray.useThese")} ({picked})
						</Text>
					</Pressable>
				</Animated.View>
			) : null}
		</View>
	);
}
