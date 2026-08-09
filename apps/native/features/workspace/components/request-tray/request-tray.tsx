// The request tray — mobile twin of the web shell (request-tray.tsx). It
// FUSES into the top of the PromptBox card: warm parchment section one step
// under the white card, hairline divider, composer beneath. Anatomy: context
// header (badge + mono label naming what's needed + ONE quiet escape hatch +
// dismiss X), receipt rows for already-answered questions, the question +
// helper, and the swappable answer body (tray-bodies.tsx).
// Layout metrics use explicit style numbers, not spacing utilities — new
// arbitrary spacing classes proved unreliable on device (the first build
// rendered the tray with no padding at all).

import { useTranslation } from "@wandit/internationalization/react";
import { useThemeColor } from "heroui-native";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { WanditIcon } from "@/components/wandit-icon";
import { BrandGradientFill } from "@/shared/ui/brand-gradient-fill";

import { type TrayBodyCallbacks, TrayBodySlot } from "./tray-bodies";
import type { RequestTrayState, TrayReceipt } from "./tray-types";

export function RequestTray({
	state,
	onEscape,
	onDismiss,
	bodyCallbacks,
}: {
	state: RequestTrayState;
	onEscape?: () => void;
	onDismiss?: () => void;
	/** Live answer wiring for the interactive bodies (use-request-tray.ts). */
	bodyCallbacks?: TrayBodyCallbacks;
}) {
	const { t } = useTranslation();
	const accent = useThemeColor("accent");
	const muted = useThemeColor("muted");
	const hasBody = state.body.kind !== "free-text";

	return (
		<View
			className="border-border border-b bg-background"
			style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 }}
		>
			<View className="flex-row items-center" style={{ gap: 9 }}>
				{state.badge === "spinner" ? (
					<ActivityIndicator size="small" color={accent} />
				) : (
					<View
						className="items-center justify-center rounded-[7px] border border-accent/40 bg-accent/10"
						style={{ width: 20, height: 20 }}
					>
						<Text
							className="font-sans-semibold"
							style={{ fontSize: 11, lineHeight: 13, color: accent }}
						>
							?
						</Text>
					</View>
				)}
				<Text
					numberOfLines={1}
					className="font-mono"
					style={{
						flex: 1,
						fontSize: 10.5,
						letterSpacing: 1.1,
						textTransform: "uppercase",
						color: accent,
					}}
				>
					{state.label}
				</Text>
				{state.escape ? (
					// The one escape hatch — quiet text, no chrome: the chips are the
					// loud thing in this section.
					<Pressable
						accessibilityRole="button"
						onPress={onEscape}
						hitSlop={8}
						className="flex-row items-center rounded-full active:bg-surface-secondary"
						style={{ gap: 5, paddingHorizontal: 8, height: 28 }}
					>
						<WanditIcon name="undo" size={11} color={muted} />
						<Text style={{ fontSize: 12.5 }} className="text-muted">
							{state.escape.label}
						</Text>
					</Pressable>
				) : null}
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={t("native.workspace.chat.tray.dismiss")}
					onPress={onDismiss}
					hitSlop={8}
					// Dismiss collapses the tray to a receipt line in the thread — it
					// never discards the question.
					className="items-center justify-center rounded-full active:bg-surface-secondary"
					style={{ width: 28, height: 28 }}
				>
					<WanditIcon name="close" size={12} color={muted} />
				</Pressable>
			</View>

			{state.receipts?.length ? (
				<View style={{ marginTop: 10, gap: 6 }}>
					{state.receipts.map((receipt) => (
						<ReceiptRow key={receipt.label + receipt.value} receipt={receipt} />
					))}
				</View>
			) : null}

			{state.question ? (
				<Text
					className="font-sans-semibold text-foreground"
					style={{ marginTop: 10, fontSize: 16, lineHeight: 22 }}
				>
					{state.question}
				</Text>
			) : null}
			{state.helper ? (
				<Text
					className="text-muted"
					style={{ marginTop: 3, fontSize: 12.5, lineHeight: 17 }}
				>
					{state.helper}
				</Text>
			) : null}

			{hasBody ? (
				<View
					// Typing a free-form answer overrides the options — they dim but
					// stay tappable so the user can still pick one.
					style={{ marginTop: 12, opacity: state.typingOverride ? 0.38 : 1 }}
				>
					<TrayBodySlot body={state.body} callbacks={bodyCallbacks} />
				</View>
			) : null}
			{state.typingOverride ? (
				<Text style={{ marginTop: 8, fontSize: 11.5, color: accent }}>
					{t("native.workspace.chat.tray.typingOverride")}
				</Text>
			) : null}
		</View>
	);
}

/** A settled question collapsed to one row: green check + value, or — when
    Wandit picked for you — the gradient spark dot. Logs the choice, never
    silently. (The web receipt's edit/undo affordances are not ported: they
    are non-functional there too.) */
function ReceiptRow({ receipt }: { receipt: TrayReceipt }) {
	const { t } = useTranslation();
	const success = useThemeColor("success");

	return (
		<View
			className="flex-row items-center rounded-xl border border-border bg-surface"
			style={{ gap: 9, paddingHorizontal: 12, paddingVertical: 10 }}
		>
			{receipt.kind === "answered" ? (
				<View
					className="items-center justify-center rounded-full bg-success/15"
					style={{ width: 16, height: 16 }}
				>
					<WanditIcon name="check" size={10} color={success} />
				</View>
			) : (
				<View
					className="relative items-center justify-center overflow-hidden rounded-full"
					style={{ width: 16, height: 16 }}
				>
					<BrandGradientFill radius={8} />
				</View>
			)}
			<Text
				numberOfLines={1}
				className="text-muted"
				style={{ flex: 1, fontSize: 13 }}
			>
				{receipt.kind === "delegated"
					? t("native.workspace.chat.tray.wanditPicked")
					: receipt.label}
			</Text>
			<Text
				numberOfLines={1}
				className="font-sans-medium text-foreground"
				style={{ maxWidth: "45%", fontSize: 13.5 }}
			>
				{receipt.value}
			</Text>
		</View>
	);
}
