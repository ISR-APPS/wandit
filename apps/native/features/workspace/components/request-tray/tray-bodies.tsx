// The swappable answer bodies of the request tray — mobile twin of the web
// tray-bodies.tsx, now carrying all thirteen kinds. Free-text, single-choice,
// world-pick, multi-select and media-drop are LIVE: they hold DRAFTS (picks,
// uploads) and the composer's answer CTA (submitOverride) confirms, so no
// body completes the tool call on its own. The other eight kinds are
// display-only against the current ask contract (web parity) — they fall
// back to local state so design review still feels alive, and they will wire
// through the same onAnswer path when their slices activate. Each body
// renders ONLY the answer control; question, header and escape hatch belong
// to the shell (request-tray.tsx).
// Layout metrics use explicit style numbers, same rule as the shell.

import { useTranslation } from "@wandit/internationalization/react";
import * as Clipboard from "expo-clipboard";
import { cn, useThemeColor } from "heroui-native";
import { useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";

import { WanditIcon, type WanditIconName } from "@/components/wandit-icon";
import { AppSkeletonGroup } from "@/shared/ui/skeleton-group";

import { useWorldFont } from "../../lib/world-fonts";
import { SpinnerArc } from "../spinner-arc";
import type {
	ChipOption,
	TrayBody,
	TrayMediaItem,
	WorldCardOption,
} from "./tray-types";

/** Live answer wiring, threaded in from use-request-tray.ts. */
export type TrayBodyCallbacks = {
	/** Single-choice: one tap DRAFTS the pick; the composer CTA confirms. */
	onPick?: (option: ChipOption) => void;
	/** Multi-select: controlled selection, confirmed by the composer CTA. */
	multiSelectedIds?: string[];
	onToggleMulti?: (id: string) => void;
	/** Attachments ask: native pickers + draft management. */
	onAttachCamera?: () => void;
	onAttachLibrary?: () => void;
	onAttachBrowse?: () => void;
	onRemoveAttachment?: (id: string) => void;
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
			// No check icon on single-choice — the ember border/tint IS the
			// selection; the check is the multi-select affordance (web parity).
			return (
				<View className="flex-row flex-wrap" style={{ gap: 8 }}>
					{body.options.map((option) => (
						<ChoiceChip
							key={option.id}
							label={option.label}
							selected={option.id === body.selectedId}
							onPress={() => callbacks?.onPick?.(option)}
						/>
					))}
				</View>
			);
		case "world-pick":
			return <WorldPickBody body={body} callbacks={callbacks} />;
		case "multi-select":
			return (
				<View className="flex-row flex-wrap" style={{ gap: 8 }}>
					{body.options.map((option) => (
						<ChoiceChip
							key={option.id}
							label={option.label}
							selected={(
								callbacks?.multiSelectedIds ?? body.selectedIds
							).includes(option.id)}
							withCheck
							onPress={() => callbacks?.onToggleMulti?.(option.id)}
						/>
					))}
				</View>
			);
		case "media-drop":
			return <MediaDropBody body={body} callbacks={callbacks} />;
		case "segmented":
			return <SegmentedBody body={body} />;
		case "visual-pick":
			return <VisualPickBody body={body} />;
		case "file-drop":
			return <FileDropBody body={body} />;
		case "link":
			return <LinkBody body={body} />;
		case "amount":
			return <AmountBody body={body} />;
		case "datetime":
			return <DatetimeBody body={body} />;
		case "confirm":
			return <ConfirmBody body={body} />;
		case "connect":
			return <ConnectBody body={body} />;
		default:
			// A kind this build does not know degrades to the free-text
			// composer — never an empty broken tray.
			return null;
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

/** Taste question: 168pt specimen cards in a bleed scroller — the world's
    real display face and palette from the server-authored card data (web
    WorldPickBody parity). An unresolved id renders the neutral "Aa" card. */
function WorldPickBody({
	body,
	callbacks,
}: {
	body: Extract<TrayBody, { kind: "world-pick" }>;
	callbacks?: TrayBodyCallbacks;
}) {
	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			// Bleed to the tray's edges so the row reads as a filmstrip.
			style={{ marginHorizontal: -15 }}
			contentContainerStyle={{
				gap: 8,
				paddingHorizontal: 15,
				paddingBottom: 4,
			}}
		>
			{body.options.map((option) => (
				<WorldCardButton
					key={option.id}
					option={option}
					selected={option.id === body.selectedId}
					onPress={() =>
						callbacks?.onPick?.({ id: option.id, label: option.label })
					}
				/>
			))}
		</ScrollView>
	);
}

function WorldCardButton({
	option,
	selected,
	onPress,
}: {
	option: WorldCardOption;
	selected: boolean;
	onPress: () => void;
}) {
	const accent = useThemeColor("accent");
	const muted = useThemeColor("muted");
	const preview = option.card?.preview;
	// The specimen face only applies once its family is actually loaded — a
	// missing font renders the neutral card, never a crash or a system-font
	// impostor pretending to be the world's face.
	const fontReady = useWorldFont(preview?.fontFamily);

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ selected }}
			onPress={onPress}
			className={cn(
				"w-[168px] overflow-hidden rounded-[14px] border bg-background",
				selected ? "border-accent" : "border-border",
			)}
			style={
				selected ? { boxShadow: "0 0 0 3px rgba(239,91,54,0.14)" } : undefined
			}
		>
			<View
				className="justify-between px-3.5 pt-3 pb-3"
				style={{
					height: 104,
					backgroundColor: preview ? preview.ground : accent,
				}}
				accessibilityElementsHidden
			>
				<Text
					numberOfLines={2}
					style={{
						fontSize: 24,
						lineHeight: 26,
						color: preview ? preview.ink : muted,
						writingDirection: "auto",
						...(preview && fontReady ? { fontFamily: preview.fontFamily } : {}),
					}}
				>
					{preview ? preview.sampleWord : "Aa"}
				</Text>
				{preview ? (
					<View className="flex-row" style={{ gap: 6 }}>
						{[preview.accent, preview.ink, preview.ground].map((dot, index) => (
							<View
								// biome-ignore lint/suspicious/noArrayIndexKey: fixed 3-dot swatch, order is the identity
								key={index}
								style={{
									width: 12,
									height: 12,
									borderRadius: 6,
									backgroundColor: dot,
									borderWidth: 1,
									borderColor: "rgba(0,0,0,0.1)",
								}}
							/>
						))}
					</View>
				) : null}
			</View>
			<View className="border-border border-t px-3.5 py-2">
				<View
					className="flex-row items-center justify-between"
					style={{ gap: 6 }}
				>
					<Text
						numberOfLines={1}
						className="min-w-0 flex-1 font-sans-medium text-[13px] text-foreground"
						style={{ writingDirection: "auto" }}
					>
						{option.card?.name ?? option.label}
					</Text>
					{selected ? (
						<WanditIcon name="check" size={11} color={accent} strokeWidth={3} />
					) : null}
				</View>
				{option.card ? (
					<Text
						numberOfLines={2}
						className="mt-0.5 text-[11px] text-muted"
						style={{ lineHeight: 15, writingDirection: "auto" }}
					>
						{option.label}
					</Text>
				) : null}
			</View>
		</Pressable>
	);
}

/** Attachments ask — the mobile stand-in for the web drop zone: drafted
    uploads as thumbnails/pills, plus native picker buttons while there is
    room for more files. */
function MediaDropBody({
	body,
	callbacks,
}: {
	body: Extract<TrayBody, { kind: "media-drop" }>;
	callbacks?: TrayBodyCallbacks;
}) {
	const { t } = useTranslation();
	const muted = useThemeColor("muted");
	// The web "add more" tile is one button; native has up to three sources,
	// so the tile opens the broadest picker while the chips keep every source
	// reachable.
	const onAddMore = body.sources.library
		? callbacks?.onAttachLibrary
		: body.sources.files
			? callbacks?.onAttachBrowse
			: callbacks?.onAttachCamera;

	const sourceChips = (
		<View className="flex-row flex-wrap justify-center" style={{ gap: 8 }}>
			{body.sources.camera ? (
				<SourceChip
					icon="camera"
					label={t("native.attach.takePhoto")}
					onPress={() => callbacks?.onAttachCamera?.()}
				/>
			) : null}
			{body.sources.library ? (
				<SourceChip
					icon="image"
					label={t("native.attach.photoLibrary")}
					onPress={() => callbacks?.onAttachLibrary?.()}
				/>
			) : null}
			{body.sources.files ? (
				<SourceChip
					icon="folder"
					label={t("native.attach.browseFiles")}
					onPress={() => callbacks?.onAttachBrowse?.()}
				/>
			) : null}
		</View>
	);

	if (body.items.length === 0) {
		// Empty state — the web dashed drop panel; the picker chips stand where
		// web puts the underlined Browse link (touch has no drag-and-drop).
		return (
			<View
				className="items-center rounded-[14px] border-[1.5px] border-accent/45 border-dashed bg-accent/5"
				style={{ paddingHorizontal: 14, paddingTop: 15, paddingBottom: 13 }}
			>
				<View className="flex-row" style={{ gap: 8, marginBottom: 8 }}>
					<FormatTile icon="image" />
					<FormatTile icon="clap" />
				</View>
				<Text
					className="font-sans-semibold text-foreground"
					style={{ fontSize: 13.5, marginBottom: 8 }}
				>
					{t("native.workspace.chat.tray.addFiles")}
				</Text>
				{sourceChips}
			</View>
		);
	}

	return (
		<View style={{ gap: 10 }}>
			<View className="flex-row flex-wrap items-start" style={{ gap: 8 }}>
				{body.items.map((item) => (
					<MediaDraftThumb
						key={item.id}
						item={item}
						onRemove={() => callbacks?.onRemoveAttachment?.(item.id)}
						removeLabel={t("native.attach.remove")}
					/>
				))}
				{body.canAddMore ? (
					// marginTop 6 aligns the tile with the thumbs, whose containers
					// reserve 6pt above for the floating remove badge.
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={t("native.workspace.chat.tray.addMore")}
						onPress={() => onAddMore?.()}
						className="items-center justify-center rounded-[11px] border-[1.5px] border-border border-dashed active:bg-surface-secondary"
						style={{ width: 54, height: 54, marginTop: 6 }}
					>
						<WanditIcon name="plus" size={14} color={muted} />
					</Pressable>
				) : null}
			</View>
			{body.canAddMore ? sourceChips : null}
		</View>
	);
}

/** 36pt format tile inside the empty drop panel (web's ImageIcon +
    Clapperboard pair). */
function FormatTile({ icon }: { icon: WanditIconName }) {
	const muted = useThemeColor("muted");
	return (
		<View
			className="items-center justify-center rounded-[10px] border border-border bg-background"
			style={{ width: 36, height: 36 }}
		>
			<WanditIcon name={icon} size={15} color={muted} />
		</View>
	);
}

function SourceChip({
	icon,
	label,
	onPress,
}: {
	icon: WanditIconName;
	label: string;
	onPress: () => void;
}) {
	const muted = useThemeColor("muted");

	return (
		<Pressable
			accessibilityRole="button"
			onPress={onPress}
			className="flex-row items-center rounded-full border border-border bg-surface active:bg-surface-secondary"
			style={{ height: 36, paddingHorizontal: 14, gap: 7 }}
		>
			<WanditIcon name={icon} size={13} color={muted} />
			<Text
				className="font-sans-medium text-foreground"
				style={{ fontSize: 13.5 }}
			>
				{label}
			</Text>
		</Pressable>
	);
}

/** One drafted upload: image thumbnail or doc pill, uploading / error
    overlays, floating remove badge — the composer AttachmentChip's tray
    sibling. */
function MediaDraftThumb({
	item,
	onRemove,
	removeLabel,
}: {
	item: TrayMediaItem;
	onRemove: () => void;
	removeLabel: string;
}) {
	const muted = useThemeColor("muted");
	const danger = useThemeColor("danger");

	return (
		<View className="relative" style={{ paddingEnd: 6, paddingTop: 6 }}>
			<View
				className={cn(
					"overflow-hidden rounded-[12px] border",
					item.error ? "border-danger/60" : "border-border",
					item.previewUri
						? "h-[54px] w-[54px]"
						: "h-[38px] max-w-[160px] flex-row items-center gap-1.5 bg-surface-secondary px-2.5",
				)}
			>
				{item.previewUri ? (
					<Image
						source={{ uri: item.previewUri }}
						resizeMode="cover"
						className="h-full w-full"
						accessibilityLabel={item.name}
					/>
				) : (
					<>
						<WanditIcon name="page" size={13} color={muted} />
						<Text
							numberOfLines={1}
							className="text-[11.5px] text-foreground"
							style={{ maxWidth: 110, writingDirection: "auto" }}
						>
							{item.name}
						</Text>
					</>
				)}
				{item.uploading ? (
					// Web MediaThumb uploading tile: shimmer + centred ember arc + a
					// 3px progress track. Native overlays the EXISTING tile instead of
					// swapping it, so the layout doesn't jump when the upload settles;
					// track insets scale web's 6px on an 86px tile down to the 54px one.
					<View className="absolute inset-0">
						<AppSkeletonGroup isLoading className="h-full w-full">
							<AppSkeletonGroup.Item className="h-full w-full rounded-none" />
						</AppSkeletonGroup>
						<View className="absolute inset-0 items-center justify-center">
							<SpinnerArc />
						</View>
						<View
							className="absolute overflow-hidden rounded-full bg-black/10"
							style={{ start: 5, end: 5, bottom: 5, height: 3 }}
						>
							<View
								className="h-full rounded-full bg-accent"
								style={{ width: `${item.uploading.percent}%` }}
							/>
						</View>
					</View>
				) : null}
				{item.error ? (
					<View className="absolute inset-0 items-center justify-center bg-danger/15">
						<WanditIcon name="close" size={12} color={danger} />
					</View>
				) : null}
			</View>
			{item.previewUri ? (
				<Text
					numberOfLines={1}
					className="mt-1 text-[9.5px] text-muted"
					style={{ maxWidth: 54, writingDirection: "auto" }}
				>
					{item.name}
				</Text>
			) : null}
			{item.uploading ? null : (
				// Removing a file mid-upload would strand its request — the badge
				// appears once the draft settles (web parity).
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={removeLabel}
					onPress={onRemove}
					hitSlop={7}
					className="absolute end-0 top-0 h-[18px] w-[18px] items-center justify-center rounded-full border border-border bg-surface"
				>
					<WanditIcon name="close" size={8} color={muted} />
				</Pressable>
			)}
		</View>
	);
}

/* ---------- segmented (web 10e) ---------- */

function SegmentedBody({
	body,
}: {
	body: Extract<TrayBody, { kind: "segmented" }>;
}) {
	const [selectedId, setSelectedId] = useState(body.selectedId);
	return (
		<View
			className="flex-row self-start rounded-full border border-border bg-surface"
			style={{ padding: 3, gap: 3 }}
		>
			{body.options.map((option) => {
				const selected = option.id === selectedId;
				return (
					<Pressable
						key={option.id}
						accessibilityRole="button"
						accessibilityState={{ selected }}
						onPress={() => setSelectedId(option.id)}
						className={cn(
							"justify-center rounded-full",
							selected ? "bg-accent" : "active:bg-surface-secondary",
						)}
						style={{ height: 30, paddingHorizontal: 15 }}
					>
						<Text
							className={cn(
								selected
									? "font-sans-semibold text-accent-foreground"
									: "text-muted",
							)}
							style={{ fontSize: 13, writingDirection: "auto" }}
						>
							{option.label}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

/* ---------- visual pick (web 10f, 7a generating) ---------- */

function VisualPickBody({
	body,
}: {
	body: Extract<TrayBody, { kind: "visual-pick" }>;
}) {
	const accent = useThemeColor("accent");
	const [selectedId, setSelectedId] = useState(body.selectedId);
	return (
		<View>
			<View className="flex-row" style={{ gap: 8 }}>
				{body.options.map((option) =>
					option.pending ? (
						// Card still streaming in — shimmer swatch + skeleton caption.
						<AppSkeletonGroup
							key={option.id}
							isLoading
							className="flex-1 overflow-hidden rounded-xl border border-border bg-background"
						>
							<AppSkeletonGroup.Item className="h-12 w-full rounded-none" />
							<View style={{ paddingHorizontal: 9, paddingVertical: 8 }}>
								<AppSkeletonGroup.Item className="h-2 w-3/5 rounded-full" />
							</View>
						</AppSkeletonGroup>
					) : (
						<Pressable
							key={option.id}
							accessibilityRole="button"
							accessibilityState={{ selected: option.id === selectedId }}
							onPress={() => setSelectedId(option.id)}
							className={cn(
								"flex-1 overflow-hidden rounded-xl border bg-background",
								option.id === selectedId ? "border-accent" : "border-border",
							)}
							style={
								option.id === selectedId
									? { boxShadow: "0 0 0 3px rgba(239,91,54,0.12)" }
									: undefined
							}
						>
							<View
								style={{ height: 48, backgroundColor: option.preview }}
								accessibilityElementsHidden
							/>
							<View
								className="flex-row items-center justify-between"
								style={{ paddingHorizontal: 9, paddingVertical: 6, gap: 6 }}
							>
								<Text
									numberOfLines={1}
									className={cn(
										"min-w-0 flex-1",
										option.id === selectedId ? "text-foreground" : "text-muted",
									)}
									style={{ fontSize: 12, writingDirection: "auto" }}
								>
									{option.label}
								</Text>
								{option.id === selectedId ? (
									<WanditIcon
										name="check"
										size={12}
										color={accent}
										strokeWidth={3}
									/>
								) : null}
							</View>
						</Pressable>
					),
				)}
			</View>
			{body.hint ? (
				<Text
					className="text-muted"
					style={{ marginTop: 8, fontSize: 12, writingDirection: "auto" }}
				>
					{body.hint}
				</Text>
			) : null}
		</View>
	);
}

/* ---------- file / document (web 10h, 10p) ---------- */

function FileDropBody({
	body,
}: {
	body: Extract<TrayBody, { kind: "file-drop" }>;
}) {
	const { t } = useTranslation();
	const muted = useThemeColor("muted");
	return (
		<View
			className="flex-row items-center rounded-[13px] border-[1.5px] border-border border-dashed"
			style={{ paddingHorizontal: 13, paddingVertical: 11, gap: 11 }}
		>
			<View
				className="items-center justify-center rounded-[10px] border border-border bg-surface"
				style={{ width: 34, height: 34 }}
			>
				<WanditIcon
					name={body.icon === "image" ? "image" : "page"}
					size={15}
					color={muted}
				/>
			</View>
			<View className="min-w-0 flex-1">
				<Text
					className="text-foreground"
					style={{ fontSize: 13.5, writingDirection: "auto" }}
				>
					{body.prompt}
					{body.browse ? (
						<Text
							className="text-accent"
							style={{ textDecorationLine: "underline" }}
						>
							{" "}
							{t("native.workspace.chat.tray.orBrowse")}
						</Text>
					) : null}
				</Text>
				{body.formatsHint ? (
					<Text
						className="text-muted"
						style={{ marginTop: 2, fontSize: 12, writingDirection: "auto" }}
					>
						{body.formatsHint}
					</Text>
				) : null}
			</View>
		</View>
	);
}

/* ---------- link (web 10i, invalid = 10n state 5) ---------- */

function LinkBody({ body }: { body: Extract<TrayBody, { kind: "link" }> }) {
	const { t } = useTranslation();
	const muted = useThemeColor("muted");
	const danger = useThemeColor("danger");
	const success = useThemeColor("success");
	// Local value keeps the display-only preview alive: Paste fills the field
	// from the clipboard even before the live plumbing for this kind exists.
	const [value, setValue] = useState(body.value);
	const paste = async () => {
		try {
			const text = await Clipboard.getStringAsync();
			if (text) setValue(text.trim());
		} catch {
			// Clipboard read denied — the field keeps its current value.
		}
	};
	return (
		<View style={{ gap: 8 }}>
			<View
				className={cn(
					"flex-row items-center rounded-xl border bg-surface",
					body.error ? "border-danger/40" : "border-border",
				)}
				style={{ paddingHorizontal: 12, paddingVertical: 9, gap: 9 }}
			>
				<WanditIcon name="link" size={14} color={muted} />
				<Text
					numberOfLines={1}
					className={cn(
						"min-w-0 flex-1 font-mono",
						body.error ? "text-danger" : "text-foreground",
					)}
					style={{ fontSize: 13.5, writingDirection: "ltr" }}
				>
					{value}
				</Text>
				{body.error ? (
					<WanditIcon name="alertCircle" size={14} color={danger} />
				) : (
					<Pressable
						accessibilityRole="button"
						onPress={paste}
						className="justify-center rounded-full bg-surface-secondary active:opacity-80"
						style={{ height: 24, paddingHorizontal: 10 }}
					>
						<Text className="text-muted" style={{ fontSize: 11.5 }}>
							{t("native.workspace.chat.tray.paste")}
						</Text>
					</Pressable>
				)}
			</View>
			{body.verified ? (
				<View
					className="flex-row items-center rounded-[10px] border border-success/25 bg-success/10"
					style={{ paddingHorizontal: 11, paddingVertical: 7, gap: 8 }}
				>
					<View
						className="items-center justify-center rounded-full bg-success/15"
						style={{ width: 16, height: 16 }}
					>
						<WanditIcon name="check" size={9} color={success} />
					</View>
					<Text
						numberOfLines={1}
						className="min-w-0 flex-1 text-success"
						style={{ fontSize: 12.5, writingDirection: "auto" }}
					>
						{body.verified}
					</Text>
				</View>
			) : null}
			{body.error ? (
				<Text
					className="text-danger"
					style={{ fontSize: 12, writingDirection: "auto" }}
				>
					{body.error}
				</Text>
			) : null}
		</View>
	);
}

/* ---------- amount (web 10j) ---------- */

function AmountBody({ body }: { body: Extract<TrayBody, { kind: "amount" }> }) {
	const { t } = useTranslation();
	const muted = useThemeColor("muted");
	return (
		<View style={{ gap: 8 }}>
			<View className="flex-row flex-wrap items-center" style={{ gap: 10 }}>
				<View
					className="flex-row items-center overflow-hidden rounded-xl border-[1.5px] border-accent bg-surface"
					style={{ boxShadow: "0 0 0 3px rgba(239,91,54,0.10)" }}
				>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={t("native.workspace.chat.tray.decrease")}
						className="items-center justify-center active:bg-surface-secondary"
						style={{ width: 32, height: 38 }}
					>
						<WanditIcon name="minus" size={13} color={muted} />
					</Pressable>
					<Text
						className="text-center font-mono text-foreground"
						style={{ minWidth: 64, fontSize: 15, writingDirection: "ltr" }}
					>
						{body.value}
					</Text>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={t("native.workspace.chat.tray.increase")}
						className="items-center justify-center active:bg-surface-secondary"
						style={{ width: 32, height: 38 }}
					>
						<WanditIcon name="plus" size={13} color={muted} />
					</Pressable>
				</View>
				<Text
					className="font-mono text-muted"
					style={{ fontSize: 12, writingDirection: "ltr" }}
				>
					{body.unit}
				</Text>
				<View className="flex-row" style={{ gap: 6, marginStart: "auto" }}>
					{body.quickValues.map((quickValue) => (
						<Pressable
							key={quickValue}
							accessibilityRole="button"
							className="justify-center rounded-full border border-border bg-surface active:bg-surface-secondary"
							style={{ height: 32, paddingHorizontal: 12 }}
						>
							<Text
								className="text-foreground"
								style={{ fontSize: 12.5, writingDirection: "ltr" }}
							>
								{quickValue}
							</Text>
						</Pressable>
					))}
				</View>
			</View>
			{body.hint ? (
				<Text
					className="text-muted"
					style={{ fontSize: 12, writingDirection: "auto" }}
				>
					{body.hint}
				</Text>
			) : null}
		</View>
	);
}

/* ---------- date & time (web 10k) ---------- */

function DatetimeBody({
	body,
}: {
	body: Extract<TrayBody, { kind: "datetime" }>;
}) {
	const muted = useThemeColor("muted");
	const [selectedId, setSelectedId] = useState(body.selectedId);
	return (
		<View style={{ gap: 8 }}>
			<View className="flex-row flex-wrap items-center" style={{ gap: 8 }}>
				{body.presets.map((preset) => (
					<ChoiceChip
						key={preset.id}
						label={preset.label}
						selected={preset.id === selectedId}
						onPress={() => setSelectedId(preset.id)}
					/>
				))}
				{body.pickLabel ? (
					// Inert like the web button — a real date picker joins when this
					// kind activates (no picker dependency in the app today).
					<Pressable
						accessibilityRole="button"
						className="flex-row items-center rounded-full border border-border bg-surface active:bg-surface-secondary"
						style={{ height: 36, paddingHorizontal: 14, gap: 6 }}
					>
						<WanditIcon name="calendar" size={13} color={muted} />
						<Text
							className="text-muted"
							style={{ fontSize: 13.5, writingDirection: "auto" }}
						>
							{body.pickLabel}
						</Text>
					</Pressable>
				) : null}
			</View>
			{body.hint ? (
				<Text
					className="text-muted"
					style={{ fontSize: 12, writingDirection: "auto" }}
				>
					{body.hint}
				</Text>
			) : null}
		</View>
	);
}

/* ---------- confirmation (web 10l) ---------- */

function ConfirmBody({
	body,
}: {
	body: Extract<TrayBody, { kind: "confirm" }>;
}) {
	return (
		<View className="flex-row" style={{ gap: 8 }}>
			<Pressable
				accessibilityRole="button"
				className="flex-1 items-center justify-center rounded-full bg-accent active:opacity-90"
				style={{ height: 40 }}
			>
				<Text
					className="font-sans-semibold text-accent-foreground"
					style={{ fontSize: 13.5, writingDirection: "auto" }}
				>
					{body.confirmLabel}
				</Text>
			</Pressable>
			<Pressable
				accessibilityRole="button"
				className="flex-1 items-center justify-center rounded-full border border-border bg-surface active:bg-surface-secondary"
				style={{ height: 40 }}
			>
				<Text
					className="text-foreground"
					style={{ fontSize: 13.5, writingDirection: "auto" }}
				>
					{body.cancelLabel}
				</Text>
			</Pressable>
		</View>
	);
}

/* ---------- connect (web 10m) ---------- */

function ConnectBody({
	body,
}: {
	body: Extract<TrayBody, { kind: "connect" }>;
}) {
	const background = useThemeColor("background");
	return (
		<Pressable
			accessibilityRole="button"
			className="w-full flex-row items-center justify-center rounded-full bg-foreground active:opacity-90"
			style={{ height: 42, gap: 9 }}
		>
			<WanditIcon name="camera" size={15} color={background} />
			<Text
				className="font-sans-semibold text-background"
				style={{ fontSize: 13.5, writingDirection: "auto" }}
			>
				{body.buttonLabel}
			</Text>
		</Pressable>
	);
}
