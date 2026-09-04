import { useTranslation } from "@wandit/internationalization/react";
import { router, useNavigation } from "expo-router";
import { cn, useThemeColor } from "heroui-native";
import { useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandOrb } from "@/components/brand-orb";
import { DottedGrid } from "@/components/dotted-grid";
import { IconCircleButton } from "@/components/icon-circle-button";
import { Wordmark } from "@/components/wordmark";
import { useAppTheme } from "@/contexts/app-theme-context";
import { CreditsChip } from "@/features/credits";
import {
	PromptBox,
	type PromptDraft,
	useCreateProject,
} from "@/features/projects";
import { chatAutostart } from "@/features/workspace/lib/chat-autostart";
import { authClient } from "@/lib/auth-client";

type SuggestionChipKey =
	| "native.home.chips.salesPage"
	| "native.home.chips.website"
	| "native.home.chips.productPhotos"
	| "native.home.chips.adCreatives"
	| "native.home.chips.flyer";

const SUGGESTION_CHIPS: SuggestionChipKey[] = [
	"native.home.chips.salesPage",
	"native.home.chips.website",
	"native.home.chips.productPhotos",
	"native.home.chips.adCreatives",
	"native.home.chips.flyer",
];

/** Post-login home: centered hero composer (light prototype riff 1a). */
export function HomeScreen() {
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();
	const navigation = useNavigation();
	const { isDark } = useAppTheme();
	const { data: session, isPending: isSessionPending } =
		authClient.useSession();
	const [activeChip, setActiveChip] = useState(0);
	const [prefill, setPrefill] = useState<{ key: number; value: string } | null>(
		null,
	);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const createProjectLockRef = useRef(false);
	const createProject = useCreateProject();

	const firstName = session?.user?.name?.trim().split(/\s+/)[0];
	const greeting =
		!isSessionPending && firstName
			? t("native.home.greeting", { name: firstName })
			: t("native.home.greetingNeutral");

	const accent = useThemeColor("accent");
	// Deeper ember text tones from the light spec (§2.5/§2.6):
	// oklch(0.45 0.13 45) and oklch(0.52 0.13 45); dark falls back to accent.
	const chipActiveColor = isDark ? accent : "#8D3700";
	const hintColor = isDark ? accent : "#A44C1D";

	function openDrawer() {
		(navigation as unknown as { openDrawer: () => void }).openDrawer();
	}

	function handleSubmit({ text, composer, files }: PromptDraft) {
		if (createProjectLockRef.current || createProject.isPending) {
			return false;
		}

		createProjectLockRef.current = true;
		setSubmitError(null);
		createProject.mutate(
			{
				prompt: text,
				composer,
				...(files?.length
					? {
							attachments: files.map(({ url, mediaType, filename }) => ({
								url,
								mediaType,
								filename,
							})),
						}
					: {}),
			},
			{
				onSuccess: ({ projectId, chatId }) => {
					chatAutostart.stash({ projectId, chatId, composer });
					setPrefill({ key: Date.now(), value: "" });
					router.push(`/project/${projectId}`);
				},
				onError: () => {
					setSubmitError(t("native.home.createProjectError"));
				},
				onSettled: () => {
					createProjectLockRef.current = false;
				},
			},
		);
		return false;
	}

	return (
		<View className="flex-1 bg-background">
			<View className="absolute start-0 end-0 top-0 h-[58%]">
				<DottedGrid
					color={isDark ? "#A79D91" : "#8F877B"}
					opacity={isDark ? 0.11 : 0.14}
					maskCenterY="40%"
				/>
			</View>

			<View
				className="flex-row items-center justify-between px-4 pb-2"
				style={{ paddingTop: insets.top + 10 }}
			>
				<IconCircleButton
					icon="menu"
					iconSize={19}
					onPress={openDrawer}
					accessibilityLabel={t("common.sidebarToggle")}
				/>
				<Wordmark />
				<CreditsChip />
			</View>

			<ScrollView
				className="flex-1"
				contentContainerClassName="flex-grow items-center justify-center px-[18px] pb-9"
				keyboardShouldPersistTaps="handled"
			>
				<View className="mb-3">
					<BrandOrb size={112} variant="aurora" />
				</View>
				<Text className="max-w-[300px] text-center font-display text-[27px] text-foreground leading-[31px] tracking-[-0.54px]">
					{greeting}
				</Text>
				<View className="mt-5 w-full">
					<PromptBox
						key={prefill?.key ?? 0}
						variant="hero"
						initialValue={prefill?.value}
						isSubmitting={createProject.isPending}
						onSubmit={handleSubmit}
					/>
					{submitError ? (
						<Text className="mt-2 text-center font-sans-medium text-[12.5px] text-danger">
							{submitError}
						</Text>
					) : null}
				</View>
				<View className="mt-3.5 flex-row flex-wrap justify-center gap-[7px]">
					{SUGGESTION_CHIPS.map((chipKey, index) => {
						const active = index === activeChip;
						return (
							<Pressable
								key={chipKey}
								accessibilityRole="button"
								accessibilityState={{ selected: active }}
								onPress={() => setActiveChip(index)}
								className={cn(
									"h-[34px] items-center justify-center rounded-full border px-3",
									active
										? "border-accent/45 bg-accent/10"
										: "border-border bg-surface dark:bg-surface-tertiary/55",
								)}
							>
								<Text
									className={cn(
										"font-sans-semibold text-[12.5px]",
										!active && "text-muted",
									)}
									style={active ? { color: chipActiveColor } : undefined}
								>
									{t(chipKey)}
								</Text>
							</Pressable>
						);
					})}
				</View>
				<Pressable
					accessibilityRole="button"
					onPress={() => {
						setSubmitError(null);
						setPrefill({ key: Date.now(), value: t("native.home.tryPrompt") });
					}}
					className="mt-4"
				>
					<Text
						className="font-mono text-[11px] tracking-[0.22px]"
						style={{ color: hintColor }}
					>
						{t("native.home.tryHint")}
					</Text>
				</Pressable>
			</ScrollView>
		</View>
	);
}
