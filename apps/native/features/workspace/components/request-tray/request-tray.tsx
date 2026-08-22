// The request tray — mobile twin of the web shell (request-tray.tsx). It
// FUSES into the top of the PromptBox card: warm parchment section one step
// under the white card, hairline divider, composer beneath. Anatomy: context
// header (badge + mono label naming what's needed + ONE quiet escape hatch +
// dismiss X), the question + helper, and the swappable answer body
// (tray-bodies.tsx). Settled answers live in the chat transcript
// (AskUserGroupCard) — the tray intentionally renders only the question that
// still needs an answer.
// Layout metrics use explicit style numbers, not spacing utilities — new
// arbitrary spacing classes proved unreliable on device (the first build
// rendered the tray with no padding at all).

import { useTranslation } from "@wandit/internationalization/react";
import { cn, useThemeColor } from "heroui-native";
import { Pressable, Text, View } from "react-native";

import { WanditIcon, type WanditIconName } from "@/components/wandit-icon";

import { SpinnerArc } from "../spinner-arc";
import { type TrayBodyCallbacks, TrayBodySlot } from "./tray-bodies";
import type { RequestTrayState, TrayBadgeIcon } from "./tray-types";

const BADGE_ICONS: Partial<Record<TrayBadgeIcon, WanditIconName>> = {
	media: "image",
	file: "page",
	link: "link",
	calendar: "calendar",
	access: "download",
	confirm: "alertTriangle",
};

// ember = waiting on you · amber = consent · muted = optional (web parity);
// amber rides the theme's warning token instead of web's oklch literals so
// dark mode adapts.
const BADGE_TONES = {
	ember: "border-accent/40 bg-accent/10",
	amber: "border-warning/50 bg-warning/15",
	muted: "border-border bg-transparent",
} as const;

export function RequestTray({
	state,
	notice,
	onEscape,
	onDismiss,
	bodyCallbacks,
}: {
	state: RequestTrayState;
	/** Transient feedback line (camera permission, upload failure). */
	notice?: string | null;
	onEscape?: () => void;
	onDismiss?: () => void;
	/** Live answer wiring for the interactive bodies (use-request-tray.ts). */
	bodyCallbacks?: TrayBodyCallbacks;
}) {
	const { t } = useTranslation();
	const accent = useThemeColor("accent");
	const warning = useThemeColor("warning");
	const muted = useThemeColor("muted");
	const tone = state.labelTone ?? "ember";
	const toneColor =
		tone === "ember" ? accent : tone === "amber" ? warning : muted;
	const badgeIcon = BADGE_ICONS[state.badge];
	const hasBody = state.body.kind !== "free-text";

	return (
		<View
			className="border-border border-b bg-background"
			style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 }}
		>
			<View className="flex-row items-center" style={{ gap: 9 }}>
				{state.badge === "spinner" ? (
					<SpinnerArc />
				) : (
					<View
						className={cn(
							"items-center justify-center rounded-[7px] border",
							BADGE_TONES[tone],
						)}
						style={{ width: 20, height: 20 }}
					>
						{badgeIcon ? (
							<WanditIcon name={badgeIcon} size={12} color={toneColor} />
						) : (
							<Text
								className="font-sans-semibold"
								style={{ fontSize: 11, lineHeight: 13, color: toneColor }}
							>
								?
							</Text>
						)}
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
						color: toneColor,
						writingDirection: "auto",
					}}
				>
					{state.label}
				</Text>
				{state.step ? (
					// Multi-question turns step through the tray one ask at a time —
					// this is the only signal that more questions are queued behind
					// the current one.
					<Text
						className="font-mono text-muted"
						style={{ fontSize: 10.5, writingDirection: "auto" }}
					>
						{t("native.workspace.chat.tray.questionStep", {
							current: state.step.current,
							total: state.step.total,
						})}
					</Text>
				) : null}
				{state.meta ? (
					<Text
						className="font-mono text-muted"
						style={{ fontSize: 10.5, writingDirection: "ltr" }}
					>
						{state.meta}
					</Text>
				) : null}
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

			{state.question ? (
				<Text
					className="font-sans-semibold text-foreground"
					style={{
						marginTop: 10,
						fontSize: 16,
						lineHeight: 22,
						writingDirection: "auto",
					}}
				>
					{state.question}
				</Text>
			) : null}
			{state.helper ? (
				<Text
					className="text-muted"
					style={{
						marginTop: 3,
						fontSize: 12.5,
						lineHeight: 17,
						writingDirection: "auto",
					}}
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
			{notice ? (
				<Text
					selectable
					className="font-sans-medium text-danger"
					style={{ marginTop: 8, fontSize: 12 }}
				>
					{notice}
				</Text>
			) : null}
		</View>
	);
}
