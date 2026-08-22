import { useThemeColor } from "heroui-native";
import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { WanditIcon } from "@/components/wandit-icon";

import { SpinnerArc } from "./spinner-arc";

export type StatusHeaderTone = "danger" | "working" | "success" | "muted";

/**
 * Status byline + kicker for state-changing chat moments (web parity with
 * status-message-header.tsx, restyled to match the native thread's compact
 * "wandit" byline): a small tone-tinted avatar, the lowercase mono wordmark,
 * then a mono uppercase kicker line in the tone color.
 */
export function StatusMessageHeader({
	tone,
	kicker,
	children,
}: {
	tone: StatusHeaderTone;
	kicker: string;
	children?: ReactNode;
}) {
	const danger = useThemeColor("danger");
	const success = useThemeColor("success");
	const accent = useThemeColor("accent");
	const muted = useThemeColor("muted");

	const toneColor =
		tone === "danger"
			? danger
			: tone === "success"
				? success
				: tone === "working"
					? accent
					: muted;
	const avatarClassName =
		tone === "danger"
			? "border-danger/40 bg-danger/12"
			: tone === "success"
				? "border-success/40 bg-success/12"
				: tone === "working"
					? "border-accent/40 bg-accent/12"
					: "border-border bg-surface-secondary";

	return (
		<View className="gap-1.5">
			<View className="flex-row items-center gap-2">
				<View
					className={`h-[22px] w-[22px] items-center justify-center rounded-full border ${avatarClassName}`}
				>
					{children ?? <ToneGlyph tone={tone} color={toneColor} />}
				</View>
				<Text className="font-mono text-[10px] text-muted">wandit</Text>
			</View>
			<Text
				className="font-mono text-[11px] uppercase"
				style={{ color: toneColor, letterSpacing: 1.1 }}
			>
				{kicker}
			</Text>
		</View>
	);
}

function ToneGlyph({ tone, color }: { tone: StatusHeaderTone; color: string }) {
	if (tone === "working") return <SpinnerArc size={12} />;
	if (tone === "success") {
		return <WanditIcon name="check" size={11} color={color} />;
	}
	if (tone === "muted") {
		return <WanditIcon name="squareStop" size={10} color={color} />;
	}
	return <WanditIcon name="alertTriangle" size={11} color={color} />;
}
