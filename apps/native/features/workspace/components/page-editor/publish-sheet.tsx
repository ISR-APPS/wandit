// Publish bottom sheet — the full native publish surface. Web parity
// (publish popover + settings publish section) in one sheet: slug editing
// with a debounced server availability verdict, publish/update with pinned
// version numbers, failed + retry, unpublish with an in-sheet confirm, and
// the publish history with rollback. All server truth flows through
// usePublishController; this file only renders it.

import type { Deployment } from "@wandit/contracts";
import {
	useDictionary,
	useTranslation,
} from "@wandit/internationalization/react";
import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Linking,
	Pressable,
	Text,
	TextInput,
	View,
} from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withSequence,
	withTiming,
} from "react-native-reanimated";

import { WanditIcon } from "@/components/wandit-icon";
import { useAppTheme } from "@/contexts/app-theme-context";
import { formatShortRelativeTime } from "@/features/projects/lib/helpers";
import {
	type PublishController,
	ROLLBACKABLE_STATUSES,
} from "@/features/workspace/lib/use-publish-controller";
import { ICON_STROKE } from "@/shared/lib/brand";
import { AppBottomSheet } from "@/shared/ui/bottom-sheet";
import { BrandGradientFill } from "@/shared/ui/brand-gradient-fill";

/** Prototype oklch(0.62 0.13 155) — the "page is live" pulse dot. */
const LIVE_GREEN = "#2EA46C";
/** Ember text action (oklch(0.52 0.15 45)), lifted a step for dark bg. */
const EMBER_ACTION = { light: "#C2502F", dark: "#F08553" } as const;
/** Danger, matched to the edit sheet's remove action. */
const DANGER = { light: "#C6432A", dark: "#E4715A" } as const;

const HISTORY_LIMIT = 6;

type PublishSheetProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	controller: PublishController;
};

function LiveDot() {
	const pulse = useSharedValue(1);
	useEffect(() => {
		pulse.value = withRepeat(
			withSequence(
				withTiming(0.35, { duration: 1200 }),
				withTiming(1, { duration: 1200 }),
			),
			-1,
		);
	}, [pulse]);
	const style = useAnimatedStyle(() => ({ opacity: pulse.value }));

	return (
		<Animated.View
			style={[
				{ width: 9, height: 9, borderRadius: 999, backgroundColor: LIVE_GREEN },
				style,
			]}
		/>
	);
}

function CardAction({
	label,
	onPress,
	disabled,
}: {
	label: string;
	onPress: () => void;
	disabled?: boolean;
}) {
	const { isDark } = useAppTheme();

	return (
		<Pressable
			accessibilityRole="button"
			onPress={onPress}
			disabled={disabled}
			hitSlop={8}
		>
			<Text
				className="font-sans-semibold text-[12.5px]"
				style={{
					color: isDark ? EMBER_ACTION.dark : EMBER_ACTION.light,
					opacity: disabled ? 0.5 : 1,
				}}
			>
				{label}
			</Text>
		</Pressable>
	);
}

function AddressCard({
	slug,
	autoLabel,
	actions,
}: {
	slug: string | null;
	/** Shown instead of an address before the first publish. */
	autoLabel: string;
	actions: { label: string; onPress: () => void; disabled?: boolean }[];
}) {
	const { isDark } = useAppTheme();

	return (
		<View className="mt-4 flex-row items-center gap-2.5 rounded-[16px] border border-border bg-surface p-3.5 dark:bg-surface-secondary">
			<WanditIcon
				name="globe"
				size={17}
				color={isDark ? ICON_STROKE.dark : ICON_STROKE.light}
			/>
			{slug ? (
				<Text
					className="min-w-0 flex-1 font-mono text-[13px] text-foreground"
					numberOfLines={1}
					style={{ writingDirection: "ltr" }}
				>
					{slug}
					<Text className="text-muted">.wandit.app</Text>
				</Text>
			) : (
				<Text
					className="min-w-0 flex-1 text-[13px] text-muted"
					numberOfLines={1}
				>
					{autoLabel}
				</Text>
			)}
			{actions.map((action) => (
				<CardAction key={action.label} {...action} />
			))}
		</View>
	);
}

/** Slug editor: TextInput + fixed suffix, a live server verdict underneath,
 * and Save gated on "available" (or an unchanged value, which just closes). */
function SlugEditor({ controller }: { controller: PublishController }) {
	const { t } = useTranslation();
	const { isDark } = useAppTheme();
	const danger = isDark ? DANGER.dark : DANGER.light;

	const verdict = controller.slugVerdict;
	const saveEnabled =
		(verdict === "available" ||
			controller.slugInput === (controller.savedSlug ?? "")) &&
		!controller.busy;

	return (
		<View className="mt-4 rounded-[16px] border border-border bg-surface p-3.5 dark:bg-surface-secondary">
			<View className="flex-row items-center gap-1.5">
				<TextInput
					value={controller.slugInput}
					onChangeText={controller.changeSlug}
					autoFocus
					autoCapitalize="none"
					autoCorrect={false}
					spellCheck={false}
					placeholder="mon-site"
					className="min-w-0 flex-1 rounded-[10px] bg-background px-3 py-2 font-mono text-[13.5px] text-foreground dark:bg-surface"
					style={{ writingDirection: "ltr" }}
				/>
				<Text
					className="font-mono text-[12.5px] text-muted"
					style={{ writingDirection: "ltr" }}
				>
					.wandit.app
				</Text>
			</View>

			<View className="mt-2 min-h-[18px] flex-row items-center gap-1.5">
				{verdict === "checking" ? (
					<>
						<ActivityIndicator size="small" />
						<Text className="text-[12px] text-muted">
							{t("native.page.publish.slugChecking")}
						</Text>
					</>
				) : verdict === "invalid" ? (
					<Text className="text-[12px]" style={{ color: danger }}>
						{t("native.page.publish.slugInvalid")}
					</Text>
				) : verdict === "taken" ? (
					<Text className="text-[12px]" style={{ color: danger }}>
						{t("native.page.publish.slugTaken")}
					</Text>
				) : verdict === "reserved" ? (
					<Text className="text-[12px]" style={{ color: danger }}>
						{t("native.page.publish.slugReserved")}
					</Text>
				) : verdict === "available" ? (
					<>
						<WanditIcon name="check" size={11} color={LIVE_GREEN} />
						<Text className="text-[12px]" style={{ color: LIVE_GREEN }}>
							{t("native.page.publish.slugAvailable")}
						</Text>
					</>
				) : null}
			</View>

			<View className="mt-2 flex-row items-center justify-end gap-2">
				<Pressable
					accessibilityRole="button"
					onPress={controller.cancelSlugEdit}
					className="h-9 items-center justify-center rounded-full px-4"
					hitSlop={4}
				>
					<Text className="font-sans-semibold text-[13px] text-muted">
						{t("native.page.publish.cancel")}
					</Text>
				</Pressable>
				<Pressable
					accessibilityRole="button"
					onPress={controller.commitSlug}
					disabled={!saveEnabled}
					className="h-9 flex-row items-center justify-center gap-1.5 rounded-full bg-foreground px-4 active:scale-[0.97]"
					style={saveEnabled ? undefined : { opacity: 0.4 }}
				>
					{controller.busy ? (
						<ActivityIndicator size="small" color="#FFFFFF" />
					) : null}
					<Text className="font-sans-semibold text-[13px] text-background">
						{t("native.page.publish.save")}
					</Text>
				</Pressable>
			</View>
		</View>
	);
}

/** "v{live} is online, v{n} is ready" — the republish nudge while live. */
function UpdateCard({ controller }: { controller: PublishController }) {
	const { t } = useTranslation();
	const n = controller.pendingVersionNumber;
	const live = controller.liveVersionNumber;
	const disabled = !controller.canPublish || controller.publishing;

	return (
		<View className="mt-3 flex-row items-center gap-3 rounded-[16px] border border-border bg-surface p-3.5 dark:bg-surface-secondary">
			<View className="min-w-0 flex-1">
				<Text
					className="font-sans-semibold text-[13.5px] text-foreground"
					numberOfLines={1}
				>
					{n !== null
						? t("native.page.publish.updateReady", { n })
						: t("native.page.publish.update")}
				</Text>
				{live !== null ? (
					<Text className="mt-0.5 text-[12px] text-muted" numberOfLines={1}>
						{t("native.page.publish.liveVersion", { n: live })}
					</Text>
				) : null}
			</View>
			<Pressable
				accessibilityRole="button"
				onPress={controller.publish}
				disabled={disabled}
				className="relative h-10 flex-row items-center justify-center gap-1.5 overflow-hidden rounded-full px-4 active:scale-[0.97]"
				style={disabled ? { opacity: 0.6 } : undefined}
			>
				<BrandGradientFill radius={20} />
				{controller.publishing ? (
					<ActivityIndicator size="small" color="#FFFFFF" />
				) : (
					<WanditIcon name="spark" size={13} color="#FFFFFF" />
				)}
				<Text
					className="font-sans-bold text-[13px] text-white"
					style={{ writingDirection: "ltr" }}
				>
					{controller.publishing
						? t("native.page.publish.publishing")
						: n !== null
							? t("native.page.publish.updateCta", { n })
							: t("native.page.publish.update")}
				</Text>
			</Pressable>
		</View>
	);
}

/** Destructive path with an in-sheet confirm — no nested dialog inside the
 * sheet portal. */
function UnpublishBlock({ controller }: { controller: PublishController }) {
	const { t } = useTranslation();
	const { isDark } = useAppTheme();
	const danger = isDark ? DANGER.dark : DANGER.light;
	const [confirming, setConfirming] = useState(false);

	// The sheet flips to the draft layout once unpublish settles; also reset
	// when the live state goes away for any other reason (foreign unpublish).
	useEffect(() => {
		if (!controller.published) setConfirming(false);
	}, [controller.published]);

	if (!confirming) {
		return (
			<Pressable
				accessibilityRole="button"
				onPress={() => setConfirming(true)}
				disabled={controller.busy}
				className="mt-3 items-center py-2"
				hitSlop={4}
			>
				<Text
					className="font-sans-semibold text-[13px]"
					style={{ color: danger, opacity: controller.busy ? 0.5 : 1 }}
				>
					{t("native.page.publish.unpublish")}
				</Text>
			</Pressable>
		);
	}

	return (
		<View className="mt-3 rounded-[16px] border border-border bg-surface p-3.5 dark:bg-surface-secondary">
			<Text className="font-sans-semibold text-[14px] text-foreground">
				{t("native.page.publish.unpublishTitle")}
			</Text>
			<Text className="mt-1 text-[12.5px] text-muted leading-[18px]">
				{t("native.page.publish.unpublishBody")}
			</Text>
			<View className="mt-3 flex-row items-center justify-end gap-2">
				<Pressable
					accessibilityRole="button"
					onPress={() => setConfirming(false)}
					className="h-9 items-center justify-center rounded-full px-4"
					hitSlop={4}
				>
					<Text className="font-sans-semibold text-[13px] text-muted">
						{t("native.page.publish.cancel")}
					</Text>
				</Pressable>
				<Pressable
					accessibilityRole="button"
					onPress={controller.unpublish}
					disabled={controller.busy}
					className="h-9 flex-row items-center justify-center gap-1.5 rounded-full px-4 active:scale-[0.97]"
					style={{ backgroundColor: danger, opacity: controller.busy ? 0.7 : 1 }}
				>
					{controller.busy ? (
						<ActivityIndicator size="small" color="#FFFFFF" />
					) : null}
					<Text className="font-sans-semibold text-[13px] text-white">
						{t("native.page.publish.unpublishConfirm")}
					</Text>
				</Pressable>
			</View>
		</View>
	);
}

function HistoryRow({
	row,
	versionNumber,
	busy,
	onRollback,
}: {
	row: Deployment;
	versionNumber: number | null;
	busy: boolean;
	onRollback: () => void;
}) {
	const { t } = useTranslation();
	const labels = useDictionary().native.relativeTime;
	const rollbackable = ROLLBACKABLE_STATUSES.includes(row.status);

	return (
		<View className="flex-row items-center gap-2.5 py-2">
			<Text
				className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[11px] text-foreground"
				style={{ writingDirection: "ltr" }}
			>
				{versionNumber !== null ? `v${versionNumber}` : "—"}
			</Text>
			<Text
				className="min-w-0 flex-1 font-mono text-[12px] text-foreground"
				numberOfLines={1}
				style={{ writingDirection: "ltr" }}
			>
				{row.slug}
			</Text>
			<Text className="text-[11px] text-muted">
				{formatShortRelativeTime(row.createdAt, labels)}
			</Text>
			{row.status === "active" ? (
				<Text
					className="font-sans-semibold text-[11px]"
					style={{ color: LIVE_GREEN }}
				>
					{t("native.page.publish.historyLive")}
				</Text>
			) : rollbackable ? (
				<CardAction
					label={t("native.page.publish.historyRestore")}
					onPress={onRollback}
					disabled={busy}
				/>
			) : (
				<Text className="text-[11px] text-muted">
					{t(
						row.status === "pending"
							? "native.page.publish.historyPending"
							: "native.page.publish.historyFailed",
					)}
				</Text>
			)}
		</View>
	);
}

function HistoryList({ controller }: { controller: PublishController }) {
	const { t } = useTranslation();
	if (controller.history.length === 0) return null;

	return (
		<View className="mt-5">
			<Text className="font-sans-semibold text-[11.5px] text-muted uppercase tracking-[1px]">
				{t("native.page.publish.history")}
			</Text>
			<View className="mt-1">
				{controller.history.slice(0, HISTORY_LIMIT).map((row) => (
					<HistoryRow
						key={row.id}
						row={row}
						versionNumber={controller.versionNumberById.get(row.versionId) ?? null}
						busy={controller.busy || controller.publishing}
						onRollback={() =>
							controller.rollback(
								row.id,
								controller.versionNumberById.get(row.versionId) ?? null,
							)
						}
					/>
				))}
			</View>
		</View>
	);
}

/** Publish bottom sheet. REAL publishing — the POST runs the whole pipeline
    and answers settled; the mutations seed the deployment caches. */
export function PublishSheet({
	isOpen,
	onOpenChange,
	controller,
}: PublishSheetProps) {
	const { t } = useTranslation();
	const { isDark } = useAppTheme();
	const danger = isDark ? DANGER.dark : DANGER.light;

	const deployment = controller.deployment;
	const liveUrl = deployment?.liveUrl ?? null;
	const displayedSlug = controller.savedSlug;

	const [copied, setCopied] = useState(false);
	const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(
		() => () => {
			if (copyTimer.current) clearTimeout(copyTimer.current);
		},
		[],
	);
	// A reopened sheet should offer "Copy" again and start outside edit mode.
	const { cancelSlugEdit } = controller;
	useEffect(() => {
		if (!isOpen) {
			setCopied(false);
			cancelSlugEdit();
		}
	}, [cancelSlugEdit, isOpen]);

	async function copyAddress() {
		await Clipboard.setStringAsync(
			liveUrl ?? `https://${displayedSlug}.wandit.app`,
		);
		setCopied(true);
		if (copyTimer.current) clearTimeout(copyTimer.current);
		copyTimer.current = setTimeout(() => setCopied(false), 1800);
	}

	const addressBlock = controller.slugEditing ? (
		<SlugEditor controller={controller} />
	) : (
		<AddressCard
			slug={displayedSlug}
			autoLabel={t("native.page.publish.autoAddress")}
			actions={[
				{
					label: t("native.page.publish.addressEdit"),
					onPress: controller.beginSlugEdit,
					disabled: controller.busy || controller.publishing,
				},
				...(controller.published
					? [
							{
								label: copied
									? t("native.page.publish.copied")
									: t("native.page.publish.copy"),
								onPress: () => void copyAddress(),
							},
						]
					: []),
			]}
		/>
	);

	const publishCtaDisabled = controller.publishing || !controller.canPublish;

	return (
		<AppBottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
			<AppBottomSheet.Portal>
				<AppBottomSheet.Overlay />
				<AppBottomSheet.Content
					backgroundClassName="bg-background rounded-t-[26px]"
					handleIndicatorClassName="w-[42px] bg-foreground/15"
					contentContainerClassName="px-5 pb-12"
				>
					{controller.published ? (
						<>
							<View className="flex-row items-center gap-2">
								<LiveDot />
								<Text className="font-display-semibold text-[23px] text-foreground tracking-[-0.4px]">
									{t("native.page.publish.liveTitle")}
								</Text>
							</View>
							<Text className="mt-1 text-[13.5px] text-muted leading-5">
								{t("native.page.publish.liveSubtitle")}
							</Text>
							{addressBlock}
							{controller.updateAvailable ? (
								<UpdateCard controller={controller} />
							) : null}
							<View className="mt-4 flex-row gap-2.5">
								<Pressable
									accessibilityRole="button"
									disabled={!liveUrl}
									onPress={() => {
										if (liveUrl) void Linking.openURL(liveUrl);
									}}
									className="h-[50px] flex-1 items-center justify-center rounded-full border-[1.5px] border-border bg-surface active:scale-[0.97] dark:bg-surface-secondary"
									style={liveUrl ? undefined : { opacity: 0.5 }}
								>
									<Text className="font-sans-semibold text-[14px] text-foreground">
										{t("native.page.publish.viewSite")}
									</Text>
								</Pressable>
								<Pressable
									accessibilityRole="button"
									onPress={() => onOpenChange(false)}
									className="h-[50px] flex-1 items-center justify-center rounded-full bg-foreground active:scale-[0.97]"
								>
									<Text className="font-sans-semibold text-[14px] text-background">
										{t("native.page.publish.done")}
									</Text>
								</Pressable>
							</View>
							<UnpublishBlock controller={controller} />
						</>
					) : (
						<>
							<Text className="font-display-semibold text-[23px] text-foreground tracking-[-0.4px]">
								{controller.failed
									? t("native.page.publish.failedTitle")
									: t("native.page.publish.title")}
							</Text>
							{controller.failed ? (
								<Text
									className="mt-1 text-[13px] leading-[18px]"
									style={{ color: danger }}
								>
									{deployment?.error ?? t("native.page.publish.failed")}
								</Text>
							) : (
								<Text className="mt-1 text-[13.5px] text-muted leading-5">
									{t("native.page.publish.subtitle")}
								</Text>
							)}
							{addressBlock}
							<Pressable
								accessibilityRole="button"
								disabled={publishCtaDisabled}
								onPress={controller.publish}
								className="relative mt-4 h-[52px] flex-row items-center justify-center gap-2 overflow-hidden rounded-full active:scale-[0.97]"
								style={publishCtaDisabled ? { opacity: 0.75 } : undefined}
							>
								<BrandGradientFill radius={26} />
								{controller.publishing ? (
									<ActivityIndicator size="small" color="#FFFFFF" />
								) : (
									<WanditIcon name="spark" size={15} color="#FFFFFF" />
								)}
								<Text className="font-sans-bold text-[15px] text-white">
									{controller.publishing
										? t("native.page.publish.publishing")
										: controller.failed
											? t("native.page.publish.retry")
											: t("native.page.publish.cta")}
								</Text>
							</Pressable>
						</>
					)}
					<HistoryList controller={controller} />
				</AppBottomSheet.Content>
			</AppBottomSheet.Portal>
		</AppBottomSheet>
	);
}
