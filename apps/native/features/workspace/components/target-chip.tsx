import type { AiChatSelectedTarget } from "@wandit/contracts";
import { useThemeColor } from "heroui-native";
import { Pressable, Text, View } from "react-native";

import { WanditIcon } from "@/components/wandit-icon";

type TargetChipProps = {
	target: AiChatSelectedTarget;
	/** Optional context announced before the visual tag/excerpt descriptor. */
	accessibleLabel?: string;
} & (
	| { onClear: () => void; clearLabel: string }
	| { onClear?: never; clearLabel?: never }
);

/** Shared target descriptor for pending Cibler and persisted user turns
    (web parity with target-chip.tsx). */
export function TargetChip({
	target,
	accessibleLabel,
	onClear,
	clearLabel,
}: TargetChipProps) {
	const accent = useThemeColor("accent");
	const excerpt = target.excerpt?.trim();

	return (
		<View
			// Without onClear the chip is one static descriptor — collapse it into
			// a single accessibility node; a clear button needs its own focus stop.
			accessible={!onClear}
			accessibilityLabel={[accessibleLabel, target.tag, excerpt]
				.filter(Boolean)
				.join(" · ")}
			className="min-w-0 max-w-full flex-row items-center gap-1.5 rounded-full border border-accent/30 bg-accent/5 py-1 ps-2.5 pe-2"
		>
			<WanditIcon name="crosshair" size={12} color={accent} />
			<Text
				className="shrink-0 font-mono text-[12px] text-accent"
				style={{ writingDirection: "ltr" }}
			>
				{target.tag}
			</Text>
			{excerpt ? (
				<>
					<Text className="text-[12px] text-accent/50">·</Text>
					<Text
						numberOfLines={1}
						className="min-w-0 shrink text-[12px] text-accent"
						style={{ writingDirection: "auto" }}
					>
						{excerpt}
					</Text>
				</>
			) : null}
			{onClear ? (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={clearLabel}
					onPress={onClear}
					className="-me-1 h-5 w-5 items-center justify-center rounded-full active:bg-accent/10"
				>
					<WanditIcon name="close" size={10} color={accent} />
				</Pressable>
			) : null}
		</View>
	);
}
