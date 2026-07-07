import {
	useDictionary,
	useTranslation,
} from "@wandit/internationalization/react";
import { cn, useThemeColor } from "heroui-native";
import { useCallback, useRef, useState } from "react";
import {
	ActivityIndicator,
	Keyboard,
	Pressable,
	Text,
	TextInput,
	View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { WanditIcon } from "@/components/wandit-icon";
import { useAppTheme } from "@/contexts/app-theme-context";
import { ICON_STROKE } from "@/shared/lib/brand";
import { BrandGradientFill } from "@/shared/ui/brand-gradient-fill";

import {
	ALL_SKILLS,
	createDefaultOptions,
	type GenerationOutputDef,
	type GenerationOutputId,
	getDefaultOutput,
	getOutput,
	type MockAttachment,
	PROMPT_MAX_LENGTH,
	ROUTE_MODES,
	type RouteMode,
	type SkillFileDef,
	type SkillFileId,
} from "../lib/prompt";
import { useVoiceDictation } from "../lib/use-voice-dictation";
import { AttachSheet, type AttachSource } from "./attach-sheet";
import { EnginePickerSheet } from "./engine-picker-sheet";
import { OutputConfigSheet } from "./output-config-sheet";
import { RecordingWaveform } from "./recording-waveform";
import { SkillSelectDialog } from "./skill-select-dialog";

export type PromptBoxProps = {
	/** Receives the trimmed prompt. Return false to keep the draft. */
	// biome-ignore lint/suspicious/noConfusingVoidType: void-returning callbacks are fine — only an explicit `false` keeps the draft
	onSubmit: (prompt: string) => boolean | void;
	/** hero = centered home composer; compact = chat dock. */
	variant?: "hero" | "compact";
	placeholder?: string;
	initialValue?: string;
	clearOnSubmit?: boolean;
	isSubmitting?: boolean;
	className?: string;
};

/**
 * THE shared ember composer, mobile twin of the web PromptBox. Toolbar:
 * [+] opens the attach sheet (files/photo/library/skills → skill dialog),
 * the mode pill picks the route, and the sliders button configures the
 * generation output + its options for concrete modes.
 */
export function PromptBox({
	onSubmit,
	variant = "hero",
	placeholder,
	initialValue = "",
	clearOnSubmit = false,
	isSubmitting = false,
	className,
}: PromptBoxProps) {
	const { t } = useTranslation();
	const promptBox = useDictionary().projects.promptBox;
	const { isDark } = useAppTheme();
	const foreground = useThemeColor("foreground");
	const accent = useThemeColor("accent");
	const muted = useThemeColor("muted");
	const danger = useThemeColor("danger");
	const iconStroke = isDark ? ICON_STROKE.dark : ICON_STROKE.light;

	const inputRef = useRef<TextInput>(null);
	const [value, setValue] = useState(initialValue);
	const [routeMode, setRouteMode] = useState<RouteMode>("auto");
	const [selectedOutputId, setSelectedOutputId] =
		useState<GenerationOutputId | null>(null);
	const [outputOptions, setOutputOptions] = useState<Record<string, string>>(
		{},
	);
	const [selectedSkillIds, setSelectedSkillIds] = useState<SkillFileId[]>([]);
	const [attachments, setAttachments] = useState<MockAttachment[]>([]);
	const [engineOpen, setEngineOpen] = useState(false);
	const [attachOpen, setAttachOpen] = useState(false);
	const [skillsOpen, setSkillsOpen] = useState(false);
	const [configOpen, setConfigOpen] = useState(false);

	// Chips beyond this collapse into a "+N" pill so the composer stays short.
	const maxVisibleSkills = 2;

	const appendTranscript = useCallback((text: string) => {
		setValue((current) => (current ? `${current.trimEnd()} ${text}` : text));
	}, []);
	const voiceDictation = useVoiceDictation(appendTranscript, {
		permissionDenied: t("native.voiceDictation.permissionDenied"),
		recordingError: t("native.voiceDictation.recordingError"),
		recordingTooLargeError: t("native.voiceDictation.recordingTooLargeError"),
		recordingUnreadableError: t(
			"native.voiceDictation.recordingUnreadableError",
		),
		transcribeError: t("native.voiceDictation.transcribeError"),
	});

	const isHero = variant === "hero";
	const canSubmit = value.trim().length > 0;
	const submitEnabled = canSubmit && !isSubmitting && !voiceDictation.isBusy;
	const selectedMode =
		ROUTE_MODES.find((mode) => mode.id === routeMode) ?? ROUTE_MODES[0];
	const selectedOutput = getOutput(selectedOutputId);
	const attachedSkills = ALL_SKILLS.filter((skill) =>
		selectedSkillIds.includes(skill.id),
	);

	const handleSubmit = () => {
		if (isSubmitting || voiceDictation.isBusy) {
			return;
		}

		const prompt = value.trim();
		if (!prompt) {
			return;
		}
		voiceDictation.clearError();
		const result = onSubmit(prompt);
		if (clearOnSubmit && result !== false) {
			setValue("");
			setAttachments([]);
		}
	};

	const handleValueChange = (nextValue: string) => {
		voiceDictation.clearError();
		setValue(nextValue);
	};

	const startVoiceDictation = () => {
		if (isSubmitting || voiceDictation.isTranscribing) {
			return;
		}

		Keyboard.dismiss();
		void voiceDictation.start();
	};

	const cancelVoiceDictation = () => {
		void voiceDictation.cancel();
	};

	const confirmVoiceDictation = () => {
		void voiceDictation.stop();
	};

	const handleModeChange = (mode: RouteMode) => {
		voiceDictation.clearError();
		setRouteMode(mode);
		const defaultOutput = getDefaultOutput(mode);
		setSelectedOutputId(defaultOutput?.id ?? null);
		setOutputOptions(defaultOutput ? createDefaultOptions(defaultOutput) : {});
	};

	const selectOutput = (output: GenerationOutputDef) => {
		voiceDictation.clearError();
		setSelectedOutputId(output.id);
		setOutputOptions(createDefaultOptions(output));
	};

	const updateOutputOption = (groupId: string, choiceId: string) => {
		voiceDictation.clearError();
		setOutputOptions((current) => ({ ...current, [groupId]: choiceId }));
	};

	const toggleSkill = (skill: SkillFileDef) => {
		voiceDictation.clearError();
		setSelectedSkillIds((current) =>
			current.includes(skill.id)
				? current.filter((id) => id !== skill.id)
				: [...current, skill.id],
		);
	};

	const openSkillDialog = () => {
		voiceDictation.clearError();
		// Let the attach sheet's dismissal start before the dialog fades in.
		setTimeout(() => setSkillsOpen(true), 220);
	};

	const handlePickAttachment = (source: AttachSource) => {
		voiceDictation.clearError();
		// UI-only mock until expo-image-picker is wired: show the attachment row
		// exactly like the prototype's "IMG_2041.jpg · attached · 2.1 MB".
		const id = `mock-${Date.now()}`;
		setAttachments((current) => [
			...current,
			{
				id,
				fileName: source === "files" ? "brief.pdf" : "IMG_2041.jpg",
				sizeLabel: "2.1 MB",
			},
		]);
		// Attaching a shot flips the mode to image gen (prototype 2b behavior).
		if (source !== "files") {
			handleModeChange("image");
		}
	};

	const resolvedPlaceholder =
		placeholder ??
		(selectedOutput
			? promptBox.outputs[selectedOutput.id].placeholder
			: null) ??
		(isHero
			? promptBox.routeModes[routeMode].placeholder
			: promptBox.placeholderCompact);

	const cardShadow = isDark
		? "0 16px 48px -12px rgba(0, 0, 0, 0.55)"
		: "0 16px 40px -20px rgba(209, 96, 34, 0.35), 0 2px 8px rgba(36, 30, 26, 0.04)";
	const sendGlow = isDark
		? "0 4px 16px -4px rgba(253, 106, 58, 0.6)"
		: "0 6px 18px -6px rgba(209, 96, 34, 0.6)";
	const voiceConfirmGlow = isDark
		? "0 4px 14px -5px rgba(253, 106, 58, 0.64)"
		: "0 6px 16px -7px rgba(209, 96, 34, 0.58)";
	// Same footprint as the other toolbar circles ([+], sliders, mic).
	const sendSize = 38;
	const voiceActive = voiceDictation.isRecording || voiceDictation.isTranscribing;

	return (
		<View
			className={cn(
				"w-full rounded-[22px] border border-border bg-surface",
				isDark && "bg-surface/90",
				className,
			)}
			style={{ boxShadow: cardShadow }}
		>
			{attachedSkills.length > 0 ? (
				<View className="flex-row flex-wrap gap-1.5 px-3.5 pt-3">
					{attachedSkills.slice(0, maxVisibleSkills).map((skill) => (
						<View
							key={skill.id}
							className="h-7 flex-row items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 ps-2.5 pe-1.5"
						>
							<WanditIcon name={skill.icon} size={12} color={accent} />
							<Text className="text-[12px] text-foreground">
								{promptBox.skills[skill.id].label}
							</Text>
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={t("projects.promptBox.removeSkillLabel", {
									name: promptBox.skills[skill.id].label,
								})}
								onPress={() => toggleSkill(skill)}
								className="rounded-full p-0.5"
							>
								<WanditIcon name="close" size={9} color={muted} />
							</Pressable>
						</View>
					))}
					{attachedSkills.length > maxVisibleSkills ? (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={t("projects.promptBox.moreSkillsLabel", {
								count: attachedSkills.length - maxVisibleSkills,
							})}
							onPress={() => {
								voiceDictation.clearError();
								setSkillsOpen(true);
							}}
							className="h-7 items-center justify-center rounded-full border border-accent/25 bg-accent/10 px-2.5 active:scale-95"
						>
							<Text
								className="font-sans-semibold text-[12px]"
								style={{ color: accent }}
							>
								+{attachedSkills.length - maxVisibleSkills}
							</Text>
						</Pressable>
					) : null}
				</View>
			) : null}
			{attachments.length > 0 ? (
				<View className="gap-2 px-3.5 pt-3">
					{attachments.map((attachment) => (
						<View key={attachment.id} className="flex-row items-center gap-2.5">
							<View className="relative h-11 w-11 items-center justify-center rounded-[11px] border border-border bg-surface-secondary">
								<Text className="font-mono text-[7.5px] text-muted">photo</Text>
								<Pressable
									accessibilityRole="button"
									accessibilityLabel={t("native.attach.remove")}
									onPress={() => {
										voiceDictation.clearError();
										setAttachments((current) =>
											current.filter((item) => item.id !== attachment.id),
										);
									}}
									className="absolute -end-1.5 -top-1.5 h-[18px] w-[18px] items-center justify-center rounded-full border border-border bg-surface-tertiary"
								>
									<WanditIcon name="close" size={8} color={foreground} />
								</Pressable>
							</View>
							<View className="flex-1">
								<Text className="font-sans-medium text-[12.5px] text-foreground">
									{attachment.fileName}
								</Text>
								<Text className="mt-0.5 font-mono text-[9.5px] text-muted">
									{t("native.attach.attachedMeta", {
										size: attachment.sizeLabel,
									})}
								</Text>
							</View>
						</View>
					))}
				</View>
			) : null}
			<TextInput
				ref={inputRef}
				accessibilityLabel={resolvedPlaceholder}
				value={value}
				onChangeText={handleValueChange}
				placeholder={resolvedPlaceholder}
				placeholderTextColor={muted}
				multiline
				editable={!isSubmitting && !voiceActive}
				maxLength={PROMPT_MAX_LENGTH}
				textAlignVertical="top"
				className="w-full px-4 pt-[15px] pb-1 text-[15px] text-foreground leading-[22px]"
				style={{
					minHeight: isHero ? 64 : 48,
					maxHeight: isHero ? 160 : 120,
				}}
			/>
			{/* Voice focus mode: the text box stays visible above, only the bottom
			    options row swaps for the recording controls. */}
			<View>
				{voiceDictation.isRecording ? (
					<Animated.View
						entering={FadeIn.duration(160)}
						className="flex-row items-center gap-3 px-2.5 pt-2.5 pb-2.5"
					>
						{/* Discard on the left, confirm on the right — the layout every
						    voice-note UI trains people on. The waveform owns the middle.
						    Danger tint marks it as "throw this recording away". */}
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={t("native.voiceDictation.cancelLabel")}
							onPress={cancelVoiceDictation}
							hitSlop={8}
							className="h-[38px] w-[38px] items-center justify-center rounded-full border border-danger/30 bg-danger/10 active:scale-95"
						>
							<WanditIcon name="close" size={14} color={danger} />
						</Pressable>
						<RecordingWaveform
							recorder={voiceDictation.recorder}
							elapsedSeconds={voiceDictation.elapsedSeconds}
						/>
						{/* Confirm mirrors the send button (gradient + up arrow): the
						    recording "sends" the same way a typed prompt does. */}
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={t("native.voiceDictation.confirmLabel")}
							onPress={confirmVoiceDictation}
							hitSlop={8}
							className="relative items-center justify-center overflow-visible rounded-full active:scale-95"
							style={{
								width: sendSize,
								height: sendSize,
								boxShadow: voiceConfirmGlow,
							}}
						>
							<BrandGradientFill radius={sendSize / 2} />
							<WanditIcon
								name="arrowUp"
								size={17}
								color={isDark ? "#160D07" : "#FFFFFF"}
							/>
						</Pressable>
					</Animated.View>
				) : null}
				{voiceDictation.isTranscribing ? (
					<Animated.View
						entering={FadeIn.duration(160)}
						className="mt-2.5 mb-2.5 h-[38px] flex-row items-center gap-2.5 px-4"
					>
						<ActivityIndicator size="small" color={accent} />
						<Text
							numberOfLines={1}
							className="font-sans-medium text-[13px] text-muted"
						>
							{t("native.voiceDictation.transcribing")}
						</Text>
					</Animated.View>
				) : null}
			</View>
			{!voiceActive ? (
			<View className="flex-row items-center gap-2 px-2.5 pb-2.5">
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={promptBox.addMenuLabel}
					onPress={() => {
						voiceDictation.clearError();
						setAttachOpen(true);
					}}
					className="h-[38px] w-[38px] items-center justify-center rounded-full border border-border active:scale-95"
				>
					<WanditIcon name="plus" size={16} color={iconStroke} />
				</Pressable>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={promptBox.modeLabel}
					onPress={() => {
						voiceDictation.clearError();
						setEngineOpen(true);
					}}
					className="h-[34px] flex-row items-center gap-1.5 rounded-full border border-border px-[11px] active:scale-95"
				>
					<WanditIcon name={selectedMode.icon} size={12} color={accent} />
					<Text className="font-sans-semibold text-[12px] text-foreground">
						{promptBox.routeModes[routeMode].label}
					</Text>
					<WanditIcon
						name="caretDown"
						size={12}
						color={muted}
						strokeWidth={2}
					/>
				</Pressable>
				<View className="flex-1" />
				{selectedOutput ? (
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={promptBox.settingsLabel}
						onPress={() => {
							voiceDictation.clearError();
							setConfigOpen(true);
						}}
						className="h-[38px] w-[38px] items-center justify-center rounded-full border border-border active:scale-95"
					>
						<WanditIcon name="sliders" size={16} color={iconStroke} />
					</Pressable>
				) : null}
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={promptBox.micLabel}
					accessibilityState={{
						busy: voiceDictation.isTranscribing,
						disabled: isSubmitting || voiceDictation.isTranscribing,
						selected: voiceDictation.isRecording,
					}}
					disabled={isSubmitting || voiceDictation.isTranscribing}
					onPress={startVoiceDictation}
					className={cn(
						"h-[38px] w-[38px] items-center justify-center rounded-full border border-border active:scale-95",
						voiceDictation.isRecording && "border-accent/45 bg-accent/10",
						(isSubmitting || voiceDictation.isTranscribing) && "opacity-45",
					)}
				>
					<WanditIcon
						name="mic"
						size={16}
						color={voiceDictation.isRecording ? accent : iconStroke}
					/>
				</Pressable>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={promptBox.submitLabel}
					accessibilityState={{ disabled: !submitEnabled, busy: isSubmitting }}
					disabled={!submitEnabled}
					onPress={handleSubmit}
					className="relative items-center justify-center overflow-visible rounded-full active:scale-95"
					style={{
						width: sendSize,
						height: sendSize,
						opacity: submitEnabled ? 1 : isSubmitting ? 0.78 : 0.45,
						boxShadow: submitEnabled ? sendGlow : undefined,
					}}
				>
					<BrandGradientFill radius={sendSize / 2} />
					{isSubmitting ? (
						<ActivityIndicator
							size="small"
							color={isHero || !isDark ? "#FFFFFF" : "#160D07"}
						/>
					) : isHero ? (
						<WanditIcon name="spark" size={16} color="#FFFFFF" />
					) : (
						<WanditIcon
							name="arrowUp"
							size={17}
							color={isDark ? "#160D07" : "#FFFFFF"}
						/>
					)}
				</Pressable>
			</View>
			) : null}
			{voiceDictation.error ? (
				<Text
					selectable
					className="px-4 pb-2.5 font-sans-medium text-[12px] text-danger"
				>
					{voiceDictation.error}
				</Text>
			) : null}

			<EnginePickerSheet
				isOpen={engineOpen}
				onOpenChange={setEngineOpen}
				mode={routeMode}
				onSelect={handleModeChange}
			/>
			<AttachSheet
				isOpen={attachOpen}
				onOpenChange={setAttachOpen}
				onPick={handlePickAttachment}
				onAttachSkill={openSkillDialog}
				skillCount={selectedSkillIds.length}
			/>
			<SkillSelectDialog
				isOpen={skillsOpen}
				onOpenChange={setSkillsOpen}
				selectedSkillIds={selectedSkillIds}
				onToggleSkill={toggleSkill}
			/>
			{selectedOutput && routeMode !== "auto" ? (
				<OutputConfigSheet
					isOpen={configOpen}
					onOpenChange={setConfigOpen}
					mode={routeMode}
					output={selectedOutput}
					values={outputOptions}
					onSelectOutput={selectOutput}
					onValueChange={updateOutputOption}
				/>
			) : null}
		</View>
	);
}
