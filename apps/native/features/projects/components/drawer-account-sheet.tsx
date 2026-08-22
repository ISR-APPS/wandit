import type { Locale } from "@wandit/internationalization";
import { localeMeta, locales } from "@wandit/internationalization";
import { useTranslation } from "@wandit/internationalization/react";
import { cn, useThemeColor } from "heroui-native";
import { I18nManager, Pressable, Text, View } from "react-native";

import { WanditIcon } from "@/components/wandit-icon";
import { AppBottomSheet } from "@/shared/ui/bottom-sheet";
import { BrandGradientFill } from "@/shared/ui/brand-gradient-fill";

/**
 * Account + language sheets from the drawer prototype. The avatar opens the
 * account sheet (identity header, Language, Sign out); Language hands off to
 * the language sheet, where each locale shows its own script, a direction
 * tag, and preview bars aligned to its reading side.
 */

type AccountSheetProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	userName: string;
	userEmail: string;
	initial: string;
	/** Native label of the active app language, shown on the Language row. */
	currentLanguageLabel: string;
	/** Opens the language sheet (this sheet closes itself first). */
	onOpenLanguage: () => void;
	onSignOut: () => void;
};

export function AccountSheet({
	isOpen,
	onOpenChange,
	userName,
	userEmail,
	initial,
	currentLanguageLabel,
	onOpenLanguage,
	onSignOut,
}: AccountSheetProps) {
	const { t } = useTranslation();
	const foreground = useThemeColor("foreground");
	const muted = useThemeColor("muted");

	// Close, then hand off immediately — the drawer owns the 220ms delay
	// before opening the next surface, so it can cancel the handoff when
	// the drawer itself closes.
	const closeThen = (action: () => void) => () => {
		onOpenChange(false);
		action();
	};

	return (
		<AppBottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
			<AppBottomSheet.Portal>
				<AppBottomSheet.Overlay className="bg-black/45" />
				<AppBottomSheet.Content
					detached
					bottomInset={14}
					handleComponent={null}
					style={{ marginHorizontal: 10 }}
					backgroundClassName="bg-transparent"
					contentContainerClassName="px-0 pb-0"
				>
					<View className="overflow-hidden rounded-[20px] border border-border bg-surface dark:bg-surface-secondary/95">
						<View className="flex-row items-center gap-3 p-4">
							<View className="relative h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full">
								<BrandGradientFill radius={22} />
								<Text className="font-sans-bold text-[16px] text-white">
									{initial}
								</Text>
							</View>
							<View className="min-w-0 flex-1">
								<Text
									numberOfLines={1}
									className="font-sans-semibold text-[15px] text-foreground"
								>
									{userName}
								</Text>
								{userEmail ? (
									<Text
										numberOfLines={1}
										className="mt-0.5 font-sans-medium text-[12.5px] text-muted"
									>
										{userEmail}
									</Text>
								) : null}
							</View>
						</View>
						<View className="h-px bg-separator" />
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={t("native.drawer.language")}
							onPress={closeThen(onOpenLanguage)}
							className="h-14 flex-row items-center gap-3 px-4 active:bg-surface-secondary"
						>
							<WanditIcon name="globe" size={18} color={foreground} />
							<Text className="flex-1 font-sans-medium text-[15px] text-foreground">
								{t("native.drawer.language")}
							</Text>
							<Text className="font-sans-medium text-[14px] text-muted">
								{currentLanguageLabel}
							</Text>
							<View
								style={{
									transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }],
								}}
							>
								<WanditIcon name="chevronRight" size={13} color={muted} />
							</View>
						</Pressable>
						<View className="h-px bg-separator" />
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={t("native.drawer.signOut")}
							onPress={closeThen(onSignOut)}
							className="h-14 flex-row items-center gap-3 px-4 active:bg-surface-secondary"
						>
							{/* The door arrow is directional — mirror it in RTL. */}
							<View
								style={{
									transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }],
								}}
							>
								<WanditIcon name="signOut" size={18} color={foreground} />
							</View>
							<Text className="flex-1 font-sans-medium text-[15px] text-foreground">
								{t("native.drawer.signOut")}
							</Text>
						</Pressable>
					</View>
					<Pressable
						accessibilityRole="button"
						onPress={() => onOpenChange(false)}
						className="mt-2 h-[52px] items-center justify-center rounded-[16px] bg-surface active:opacity-80 dark:bg-surface-tertiary"
					>
						<Text className="font-sans-bold text-[15.5px] text-foreground">
							{t("native.drawer.cancel")}
						</Text>
					</Pressable>
				</AppBottomSheet.Content>
			</AppBottomSheet.Portal>
		</AppBottomSheet>
	);
}

// The prototype's language cards show each language named in itself — these
// Latin sub-labels are deliberately not translated.
const LATIN_LABELS: Record<Locale, string> = {
	en: "English",
	fr: "French",
	ar: "Arabic",
};

const GLYPHS: Record<Locale, string> = {
	en: "En",
	fr: "Fr",
	ar: "ع",
};

type LanguageSheetProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	locale: Locale;
	onSelect: (locale: Locale) => void;
};

export function LanguageSheet({
	isOpen,
	onOpenChange,
	locale,
	onSelect,
}: LanguageSheetProps) {
	const { t } = useTranslation();

	return (
		<AppBottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
			<AppBottomSheet.Portal>
				<AppBottomSheet.Overlay className="bg-black/45" />
				<AppBottomSheet.Content
					detached
					bottomInset={14}
					handleComponent={null}
					style={{ marginHorizontal: 10 }}
					backgroundClassName="bg-transparent"
					contentContainerClassName="px-0 pb-0"
				>
					<View className="rounded-[20px] border border-border bg-surface px-4 pt-[18px] pb-4 dark:bg-surface-secondary/95">
						<Text className="font-sans-semibold text-[17px] text-foreground">
							{t("native.drawer.languageTitle")}
						</Text>
						<Text className="mt-1.5 font-sans-medium text-[12.5px] text-muted leading-[18px]">
							{t("native.drawer.languageSubtitle")}
						</Text>
						<View className="mt-4 gap-2">
							{locales.map((item) => (
								<LanguageOption
									key={item}
									locale={item}
									selected={item === locale}
									onPress={() => {
										onOpenChange(false);
										if (item !== locale) {
											onSelect(item);
										}
									}}
								/>
							))}
						</View>
					</View>
					<Pressable
						accessibilityRole="button"
						onPress={() => onOpenChange(false)}
						className="mt-2 h-[52px] items-center justify-center rounded-[16px] bg-surface active:opacity-80 dark:bg-surface-tertiary"
					>
						<Text className="font-sans-bold text-[15.5px] text-foreground">
							{t("native.drawer.cancel")}
						</Text>
					</Pressable>
				</AppBottomSheet.Content>
			</AppBottomSheet.Portal>
		</AppBottomSheet>
	);
}

function LanguageOption({
	locale,
	selected,
	onPress,
}: {
	locale: Locale;
	selected: boolean;
	onPress: () => void;
}) {
	const { t } = useTranslation();
	const accent = useThemeColor("accent");
	const accentForeground = useThemeColor("accent-foreground");
	const muted = useThemeColor("muted");
	const meta = localeMeta[locale];
	const barAlignEnd = meta.dir === "rtl";

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={t("native.drawer.selectLanguageLabel", {
				language: meta.nativeLabel,
			})}
			accessibilityState={{ selected }}
			onPress={onPress}
			className={cn(
				"flex-row items-center gap-3 rounded-[16px] border-[1.5px] p-3 active:opacity-85",
				selected ? "border-accent/55 bg-accent/5" : "border-border bg-surface",
			)}
		>
			<View className="relative h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[13px] bg-surface-secondary dark:bg-surface-tertiary">
				{selected ? <BrandGradientFill radius={13} /> : null}
				<Text
					className={cn(
						"font-sans-semibold",
						locale === "ar" ? "text-[19px]" : "text-[16px]",
					)}
					style={{ color: selected ? "#FCFBF8" : muted }}
				>
					{GLYPHS[locale]}
				</Text>
			</View>
			<View className="min-w-0 flex-1">
				<Text
					numberOfLines={1}
					className="font-sans-semibold text-[16px] text-foreground"
				>
					{meta.nativeLabel}
				</Text>
				<View className="mt-1 flex-row items-center gap-1.5">
					<Text className="font-sans-medium text-[12.5px] text-muted">
						{LATIN_LABELS[locale]}
					</Text>
					<View className="rounded-[5px] bg-surface-secondary px-[5px] py-[2px] dark:bg-surface-tertiary">
						<Text
							className="font-mono text-[9.5px] text-muted uppercase tracking-[1px]"
							style={{ writingDirection: "ltr" }}
						>
							{meta.dir}
						</Text>
					</View>
				</View>
			</View>
			<View
				className="w-[30px] shrink-0 gap-1"
				style={{
					alignItems: barAlignEnd ? "flex-end" : "flex-start",
					opacity: selected ? 0.9 : 0.4,
				}}
			>
				{[26, 17, 22].map((width, index) => (
					<View
						key={width}
						className="h-[3px] rounded-full"
						style={{
							width,
							backgroundColor: accent,
							opacity: 1 - index * 0.3,
						}}
					/>
				))}
			</View>
			{selected ? (
				<View className="h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-accent">
					<WanditIcon name="check" size={12} color={accentForeground} />
				</View>
			) : (
				<View className="h-[22px] w-[22px] shrink-0 rounded-full border-[1.5px] border-border" />
			)}
		</Pressable>
	);
}
