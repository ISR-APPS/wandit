import {
	CURATED_FONTS,
	type PageTokenName,
	PRESET_PALETTES,
	SECTION_PADDING_STEPS,
	type SectionPaddingStep,
} from "@wandit/contracts";
import { useTranslation } from "@wandit/internationalization/react";
import {
	cssColorToHex,
	hasCompletePageTheme,
	matchCuratedFontId,
	parsePageTokens,
	selectTargetMessage,
	tokensEqual,
} from "@wandit/preview-editor";
import { useThemeColor } from "heroui-native";
import { useEffect, useMemo, useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	Text,
	TextInput,
	useWindowDimensions,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WanditIcon } from "@/components/wandit-icon";
import { AppBottomSheet } from "@/shared/ui/bottom-sheet";
import { BrandGradientFill } from "@/shared/ui/brand-gradient-fill";

import type { PageEditor } from "../../lib/page-preview/use-page-editor";
import { useOriginalTheme } from "../../lib/page-preview/use-original-theme";
import { targetLabel } from "../../lib/page-preview/types";
import { PAGE_CHROME } from "./chrome";

/** What the editor sheet shows: the global theme, or one tapped target. */
export type EditorSheetView = "theme" | "target";

const ACCENT = "#EF5B36";
const ACCENT_TEXT = "#D14E2E";
const DANGER = "#C6432A";

const TOKEN_LABEL_KEYS = {
	background: "native.page.edit.tokens.background",
	foreground: "native.page.edit.tokens.foreground",
	primary: "native.page.edit.tokens.primary",
	"primary-foreground": "native.page.edit.tokens.primaryForeground",
	secondary: "native.page.edit.tokens.secondary",
	accent: "native.page.edit.tokens.accent",
	muted: "native.page.edit.tokens.muted",
	border: "native.page.edit.tokens.border",
} as const satisfies Partial<Record<PageTokenName, string>>;

const COLOR_TOKEN_NAMES = Object.keys(
	TOKEN_LABEL_KEYS,
) as (keyof typeof TOKEN_LABEL_KEYS)[];

const RADIUS_PRESETS = [
	{ value: "0rem", labelKey: "native.page.edit.radius.sharp" },
	{ value: "0.375rem", labelKey: "native.page.edit.radius.subtle" },
	{ value: "0.75rem", labelKey: "native.page.edit.radius.soft" },
	{ value: "1.25rem", labelKey: "native.page.edit.radius.round" },
] as const;

/** Edit-mode floating bar (§4a): hint chip + ONE pill that adapts. Clean:
    ⌜Theme⌟ · ⌜Done⌟. With pending edits the same pill becomes the save
    strip — theme collapses to its icon, the count takes the middle, and
    ⌜Done⌟ yields to ⌜Cancel⌟ · ⌜Save⌟ until the batch settles. */
export function PageEditBar({
	dirtyCount,
	saving,
	onOpenTheme,
	onDiscard,
	onSave,
	onDone,
}: {
	dirtyCount: number;
	saving: boolean;
	onOpenTheme: () => void;
	onDiscard: () => void;
	onSave: () => void;
	onDone: () => void;
}) {
	const { t } = useTranslation();
	const dirty = dirtyCount > 0 || saving;

	return (
		<View className="items-center gap-2 px-3.5">
			<View
				className="h-[24px] items-center justify-center rounded-full px-3"
				style={{ backgroundColor: PAGE_CHROME.bar }}
			>
				<Text
					className="font-mono text-[10px] tracking-[1px]"
					style={{ color: PAGE_CHROME.textMuted }}
				>
					{t("native.page.edit.hint").toUpperCase()}
				</Text>
			</View>
			<View
				className="h-[56px] w-full flex-row items-center gap-1 rounded-full ps-2 pe-1.5"
				style={{ backgroundColor: PAGE_CHROME.bar }}
			>
				{dirty ? (
					<>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={t("native.page.edit.theme")}
							onPress={onOpenTheme}
							className="h-[42px] w-[42px] items-center justify-center rounded-full active:scale-[0.95]"
						>
							<WanditIcon name="contrast" size={16} color={PAGE_CHROME.text} />
						</Pressable>
						<Text
							className="min-w-0 flex-1 font-sans-semibold text-[13px]"
							numberOfLines={1}
							style={{ color: PAGE_CHROME.text }}
						>
							{t("native.page.editor.changesCount", {
								count: Math.max(dirtyCount, 1),
							})}
						</Text>
						<Pressable
							accessibilityRole="button"
							disabled={saving}
							onPress={onDiscard}
							className="h-[38px] items-center justify-center rounded-full px-3 active:scale-[0.95]"
						>
							<Text
								className="font-sans-semibold text-[13px]"
								style={{ color: PAGE_CHROME.textMuted }}
							>
								{t("native.page.editor.discard")}
							</Text>
						</Pressable>
						<Pressable
							accessibilityRole="button"
							disabled={saving}
							onPress={onSave}
							className="h-[44px] flex-row items-center justify-center gap-1.5 rounded-full bg-white px-4 active:scale-[0.95]"
						>
							{saving ? (
								<ActivityIndicator size="small" color="#26221D" />
							) : null}
							<Text
								className="font-sans-bold text-[13px]"
								style={{ color: "#26221D" }}
							>
								{t("native.page.editor.save")}
							</Text>
						</Pressable>
					</>
				) : (
					<>
						<Pressable
							accessibilityRole="button"
							onPress={onOpenTheme}
							className="h-[42px] flex-row items-center gap-1.5 rounded-full px-3 active:scale-[0.95]"
						>
							<WanditIcon name="contrast" size={16} color={PAGE_CHROME.text} />
							<Text
								className="font-sans-semibold text-[13.5px]"
								style={{ color: PAGE_CHROME.text }}
							>
								{t("native.page.edit.theme")}
							</Text>
						</Pressable>
						<View className="flex-1" />
						<Pressable
							accessibilityRole="button"
							onPress={onDone}
							className="relative h-[44px] items-center justify-center overflow-hidden rounded-full px-5 active:scale-[0.95]"
						>
							<BrandGradientFill radius={22} />
							<Text className="font-sans-bold text-[14px] text-white">
								{t("native.page.edit.done")}
							</Text>
						</Pressable>
					</>
				)}
			</View>
		</View>
	);
}

type EditorSheetProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	view: EditorSheetView;
	projectId: string;
	/** Canonical HTML of the rendered version — the theme tab parses its
	 * :root block so the panel edits exactly what a save will touch. */
	canonicalHtml: string;
	editor: PageEditor;
};

/**
 * The editor sheet — a real draggable bottom sheet. Opens at ~a third of the
 * screen and drags up to near-full so the page preview stays visible while
 * properties change live. No dimming overlay on purpose: theme and text
 * edits render on the page behind it in real time.
 */
export function PageEditorSheet(props: EditorSheetProps) {
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();
	const foreground = useThemeColor("foreground");
	const { height: windowHeight } = useWindowDimensions();
	const { view, editor } = props;
	const selection = editor.selection;

	// heroui's Content hosts children in a BottomSheetView that sizes to its
	// content, so a flex viewport never gets bounded. Size the scroll area to
	// the CURRENT snap (minus handle + header chrome).
	const snapFractions = view === "theme" ? [0.52, 0.88] : [0.42, 0.88];
	const [snapIndex, setSnapIndex] = useState(0);
	const scrollHeight = windowHeight * (snapFractions[snapIndex] ?? 0.88) - 104;

	// Reset-to-original needs the newest builder-origin version's theme —
	// resolved lazily while the theme view is open.
	const originalTheme = useOriginalTheme(
		props.projectId,
		props.isOpen && view === "theme",
	);
	const baseTokens = useMemo(
		() => parsePageTokens(props.canonicalHtml),
		[props.canonicalHtml],
	);

	const title =
		view === "theme"
			? t("native.page.edit.theme")
			: selection
				? targetLabel(selection)
				: "";

	return (
		<AppBottomSheet isOpen={props.isOpen} onOpenChange={props.onOpenChange}>
			<AppBottomSheet.Portal>
				<AppBottomSheet.Content
					snapPoints={snapFractions.map((f) => `${f * 100}%`)}
					index={0}
					onChange={(index) => {
						if (index >= 0) setSnapIndex(index);
					}}
					enableDynamicSizing={false}
					enablePanDownToClose
					// The handle drags the sheet; content drags must reach the inner
					// ScrollView, so the sheet's own content pan gesture is off.
					enableContentPanningGesture={false}
					keyboardBehavior="extend"
					keyboardBlurBehavior="restore"
					backgroundClassName="bg-background rounded-t-[26px]"
					handleIndicatorClassName="w-[42px] bg-foreground/15"
					contentContainerClassName="flex-1 px-0 pb-0"
				>
					<View className="flex-row items-center gap-2 px-4 pb-2">
						<Text
							numberOfLines={1}
							className="min-w-0 flex-1 font-mono text-[10px] text-muted uppercase tracking-[1.5px]"
						>
							{title}
						</Text>
						{view === "theme" && originalTheme ? (
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={t("native.page.edit.reset")}
								onPress={() =>
									editor.resetTokens(
										originalTheme.tokens,
										baseTokens,
										originalTheme.fontStylesheetHrefs,
									)
								}
								className="h-[32px] flex-row items-center gap-1.5 rounded-full bg-surface ps-3 pe-3.5 active:scale-[0.95] dark:bg-surface-tertiary/65"
							>
								<WanditIcon
									name="undo"
									size={13}
									color={foreground}
									strokeWidth={1.8}
								/>
								<Text className="font-sans-semibold text-[12.5px] text-foreground">
									{t("native.page.edit.resetShort")}
								</Text>
							</Pressable>
						) : null}
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={t("native.page.edit.done")}
							onPress={() => props.onOpenChange(false)}
							className="h-[32px] w-[32px] items-center justify-center rounded-full bg-surface active:scale-[0.92] dark:bg-surface-tertiary/65"
						>
							<WanditIcon
								name="close"
								size={14}
								color={foreground}
								strokeWidth={2}
							/>
						</Pressable>
					</View>
					<ScrollView
						keyboardShouldPersistTaps="handled"
						style={{ height: scrollHeight, flexGrow: 0 }}
						contentContainerStyle={{
							paddingHorizontal: 16,
							paddingBottom: insets.bottom + 36,
							gap: 18,
						}}
					>
						{view === "theme" ? (
							<ThemeTab
								editor={editor}
								baseTokens={baseTokens}
								originalTokens={originalTheme?.tokens ?? null}
							/>
						) : null}
						{view === "target" && selection ? (
							<TargetTab editor={editor} selection={selection} />
						) : null}
					</ScrollView>
				</AppBottomSheet.Content>
			</AppBottomSheet.Portal>
		</AppBottomSheet>
	);
}

// ── Theme tab ───────────────────────────────────────────────────────────────

function ThemeTab({
	editor,
	baseTokens,
	originalTokens,
}: {
	editor: PageEditor;
	baseTokens: Partial<Record<PageTokenName, string>>;
	originalTokens: Partial<Record<PageTokenName, string>> | null;
}) {
	const { t } = useTranslation();
	const muted = useThemeColor("muted");

	// The panel edits the fixed 11-token contract; a legacy page without the
	// complete :root signature would only produce ineffective versions.
	const complete = hasCompletePageTheme(baseTokens);

	// Same layering as the web: reset swaps the base for the builder theme,
	// pending overrides sit on top.
	const effective = useMemo(
		() => ({
			...(editor.pendingTokensReset && originalTokens
				? originalTokens
				: baseTokens),
			...editor.pendingTokens,
		}),
		[
			baseTokens,
			editor.pendingTokens,
			editor.pendingTokensReset,
			originalTokens,
		],
	);

	if (!complete) {
		return (
			<View className="rounded-[14px] border border-border bg-surface p-4 dark:bg-surface-tertiary/50">
				<Text className="text-[13px] text-muted leading-5">
					{t("native.page.edit.themeUnavailable")}
				</Text>
			</View>
		);
	}

	const applyAll = (values: Record<PageTokenName, string>) =>
		editor.applyTokens({ ...values }, { ...values });

	const applyOne = (name: PageTokenName, value: string) =>
		editor.applyTokens({ [name]: value }, { ...effective, [name]: value });

	const headingFontId = effective["font-heading"]
		? matchCuratedFontId(effective["font-heading"])
		: null;
	const bodyFontId = effective["font-body"]
		? matchCuratedFontId(effective["font-body"])
		: null;

	return (
		<>
			<View className="gap-2.5">
				<Text className="font-mono text-[10px] text-muted uppercase tracking-[1.5px]">
					{t("native.page.edit.presets")}
				</Text>
				<View className="flex-row flex-wrap gap-2">
					{PRESET_PALETTES.map((palette) => {
						const active = tokensEqual(effective, palette.values);
						return (
							<Pressable
								key={palette.id}
								accessibilityRole="button"
								accessibilityLabel={palette.name}
								onPress={() => applyAll({ ...palette.values })}
								className="w-[48%] flex-grow gap-2 rounded-[14px] border border-border p-2.5 active:scale-[0.97]"
								style={
									active
										? { borderColor: ACCENT, borderWidth: 1.5 }
										: undefined
								}
							>
								<View className="flex-row items-center gap-1">
									<Text
										numberOfLines={1}
										className="min-w-0 flex-1 font-sans-semibold text-[12.5px] text-foreground"
									>
										{palette.name}
									</Text>
									<WanditIcon
										name={palette.mode === "dark" ? "contrast" : "sun"}
										size={11}
										color={muted}
									/>
								</View>
								<View className="h-[16px] flex-row overflow-hidden rounded-[5px]">
									{[
										palette.values.background,
										palette.values.secondary,
										palette.values.primary,
										palette.values.accent,
										palette.values.foreground,
									].map((color, index) => (
										<View
											// biome-ignore lint/suspicious/noArrayIndexKey: fixed 5-stripe swatch
											key={index}
											className="flex-1"
											style={{ backgroundColor: color }}
										/>
									))}
								</View>
							</Pressable>
						);
					})}
				</View>
			</View>
			<View className="gap-2.5">
				<Text className="font-mono text-[10px] text-muted uppercase tracking-[1.5px]">
					{t("native.page.edit.colors")}
				</Text>
				{COLOR_TOKEN_NAMES.map((name) => (
					<HexTokenRow
						key={name}
						label={t(TOKEN_LABEL_KEYS[name])}
						value={cssColorToHex(effective[name] ?? "") ?? effective[name] ?? ""}
						onCommit={(value) => applyOne(name, value)}
					/>
				))}
			</View>
			<View className="gap-2">
				<Text className="font-mono text-[10px] text-muted uppercase tracking-[1.5px]">
					{t("native.page.edit.corners")}
				</Text>
				<View className="flex-row gap-1.5">
					{RADIUS_PRESETS.map((preset) => {
						const active = effective.radius === preset.value;
						return (
							<Pressable
								key={preset.value}
								accessibilityRole="button"
								onPress={() => applyOne("radius", preset.value)}
								className="h-[36px] flex-1 items-center justify-center rounded-full border border-border active:scale-[0.96]"
								style={
									active
										? {
												borderColor: ACCENT,
												backgroundColor: "rgba(239,91,54,0.12)",
											}
										: undefined
								}
							>
								<Text
									className="font-sans-semibold text-[12.5px] text-foreground"
									style={active ? { color: ACCENT_TEXT } : undefined}
								>
									{t(preset.labelKey)}
								</Text>
							</Pressable>
						);
					})}
				</View>
			</View>
			<FontPickerRow
				label={t("native.page.edit.headingFont")}
				role="heading"
				activeId={headingFontId}
				onPick={(id) => applyOne("font-heading", id)}
			/>
			<FontPickerRow
				label={t("native.page.edit.bodyFont")}
				role="body"
				activeId={bodyFontId}
				onPick={(id) => applyOne("font-body", id)}
			/>
		</>
	);
}

/** Hex field with a local buffer: applies live as soon as the text is a
    valid #rrggbb, keeps the half-typed value otherwise. */
function HexTokenRow({
	label,
	value,
	onCommit,
}: {
	label: string;
	value: string;
	onCommit: (value: string) => void;
}) {
	const [text, setText] = useState(value);

	useEffect(() => {
		setText(value);
	}, [value]);

	return (
		<View className="flex-row items-center gap-2.5">
			<Text className="min-w-0 flex-1 text-[13px] text-foreground">
				{label}
			</Text>
			<View
				className="h-[30px] w-[30px] rounded-[8px] border border-border"
				style={{
					backgroundColor: /^#[0-9a-fA-F]{6}$/.test(text) ? text : value,
				}}
			/>
			<TextInput
				value={text}
				onChangeText={(next) => {
					setText(next);
					if (/^#[0-9a-fA-F]{6}$/.test(next)) onCommit(next);
				}}
				autoCapitalize="none"
				autoCorrect={false}
				className="h-[32px] w-[104px] rounded-[9px] border border-border bg-surface px-2.5 font-mono text-[12px] text-foreground dark:bg-surface-tertiary/65"
				style={{ writingDirection: "ltr" }}
			/>
		</View>
	);
}

function FontPickerRow({
	label,
	role,
	activeId,
	onPick,
}: {
	label: string;
	role: "heading" | "body";
	activeId: string | null;
	onPick: (id: string) => void;
}) {
	const fonts = CURATED_FONTS.filter((font) =>
		role === "heading" ? font.heading : font.body,
	);

	return (
		<View className="gap-2">
			<Text className="font-mono text-[10px] text-muted uppercase tracking-[1.5px]">
				{label}
			</Text>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={{ gap: 6 }}
			>
				{fonts.map((font) => {
					const active = font.id === activeId;
					return (
						<Pressable
							key={font.id}
							accessibilityRole="button"
							onPress={() => onPick(font.id)}
							className="h-[34px] items-center justify-center rounded-full border border-border px-3.5 active:scale-[0.96]"
							style={
								active
									? {
											borderColor: ACCENT,
											backgroundColor: "rgba(239,91,54,0.12)",
										}
									: undefined
							}
						>
							<Text
								className="font-sans-semibold text-[12.5px] text-foreground"
								style={active ? { color: ACCENT_TEXT } : undefined}
							>
								{font.family}
							</Text>
						</Pressable>
					);
				})}
			</ScrollView>
		</View>
	);
}

// ── Target tab ──────────────────────────────────────────────────────────────

const PADDING_STEP_LABEL_KEYS = {
	none: "native.page.edit.padding.none",
	s: "native.page.edit.padding.s",
	m: "native.page.edit.padding.m",
	l: "native.page.edit.padding.l",
	xl: "native.page.edit.padding.xl",
} as const satisfies Record<SectionPaddingStep, string>;

function TargetTab({
	editor,
	selection,
}: {
	editor: PageEditor;
	selection: NonNullable<PageEditor["selection"]>;
}) {
	const { t } = useTranslation();
	const wid = selection.wid;
	const pendingSection = editor.pendingSectionStyles[wid];

	return (
		<>
			{selection.ladder.length > 1 ? (
				<View className="gap-2">
					<Text className="font-mono text-[10px] text-muted uppercase tracking-[1.5px]">
						{t("native.page.edit.targetLadder")}
					</Text>
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={{ gap: 6 }}
					>
						{selection.ladder.map((stop, index) => {
							const active = index === selection.ladderIndex;
							return (
								<Pressable
									key={stop.wid}
									accessibilityRole="button"
									onPress={() =>
										editor.postToPreview(selectTargetMessage(stop.wid))
									}
									className="h-[32px] items-center justify-center rounded-full border border-border px-3 active:scale-[0.96]"
									style={
										active
											? {
													borderColor: ACCENT,
													backgroundColor: "rgba(239,91,54,0.12)",
												}
											: undefined
									}
								>
									<Text
										numberOfLines={1}
										className="max-w-[140px] font-sans-semibold text-[12px] text-foreground"
										style={active ? { color: ACCENT_TEXT } : undefined}
									>
										{stop.label}
									</Text>
								</Pressable>
							);
						})}
					</ScrollView>
				</View>
			) : null}

			{selection.textEditable && selection.text !== null ? (
				<View className="gap-1.5">
					<Text className="text-[12.5px] text-muted">
						{t("native.page.edit.textLabel")}
					</Text>
					<TextInput
						defaultValue={editor.pendingText[wid] ?? selection.text}
						onChangeText={(next) => editor.recordText(wid, next)}
						multiline
						className="min-h-[74px] rounded-[12px] border border-border bg-surface px-3 py-2.5 text-[14px] text-foreground dark:bg-surface-tertiary/65"
						style={{ textAlignVertical: "top" }}
					/>
				</View>
			) : null}

			{selection.kind === "section" ? (
				<>
					<PaddingStepRow
						label={t("native.page.edit.paddingTop")}
						active={pendingSection?.paddingTop}
						onPick={(step) =>
							editor.applySectionStyle(wid, { paddingTop: step })
						}
					/>
					<PaddingStepRow
						label={t("native.page.edit.paddingBottom")}
						active={pendingSection?.paddingBottom}
						onPick={(step) =>
							editor.applySectionStyle(wid, { paddingBottom: step })
						}
					/>
					<View className="gap-2">
						<Text className="font-mono text-[10px] text-muted uppercase tracking-[1.5px]">
							{t("native.page.edit.sectionBackground")}
						</Text>
						<HexTokenRow
							label={t("native.page.edit.tokens.background")}
							value={
								pendingSection?.backgroundColor ??
								cssColorToHex(
									selection.sectionStyles?.backgroundColor ?? "",
								) ??
								""
							}
							onCommit={(value) =>
								editor.applySectionStyle(wid, { backgroundColor: value })
							}
						/>
					</View>
				</>
			) : null}

			{selection.removable ? (
				<Pressable
					accessibilityRole="button"
					onPress={() => editor.removeElement(wid)}
					className="h-[46px] flex-row items-center justify-center gap-2 rounded-[14px] border active:scale-[0.98]"
					style={{ borderColor: "rgba(198,67,42,0.45)" }}
				>
					<WanditIcon name="trash" size={15} color={DANGER} strokeWidth={1.9} />
					<Text
						className="font-sans-semibold text-[13.5px]"
						style={{ color: DANGER }}
					>
						{t("native.page.edit.removeElement")}
					</Text>
				</Pressable>
			) : null}
		</>
	);
}

function PaddingStepRow({
	label,
	active,
	onPick,
}: {
	label: string;
	active: SectionPaddingStep | undefined;
	onPick: (step: SectionPaddingStep) => void;
}) {
	const { t } = useTranslation();

	return (
		<View className="gap-2">
			<Text className="font-mono text-[10px] text-muted uppercase tracking-[1.5px]">
				{label}
			</Text>
			<View className="flex-row gap-1.5">
				{SECTION_PADDING_STEPS.map((step) => {
					const isActive = step === active;
					return (
						<Pressable
							key={step}
							accessibilityRole="button"
							onPress={() => onPick(step)}
							className="h-[34px] flex-1 items-center justify-center rounded-full border border-border active:scale-[0.96]"
							style={
								isActive
									? {
											borderColor: ACCENT,
											backgroundColor: "rgba(239,91,54,0.12)",
										}
									: undefined
							}
						>
							<Text
								className="font-sans-semibold text-[11.5px] text-foreground"
								style={isActive ? { color: ACCENT_TEXT } : undefined}
							>
								{t(PADDING_STEP_LABEL_KEYS[step])}
							</Text>
						</Pressable>
					);
				})}
			</View>
		</View>
	);
}
