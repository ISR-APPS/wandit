import {
	type ComposerQuality,
	IMAGE_TO_VIDEO_SOURCE_MEDIA_TYPES,
} from "@wandit/contracts";
import {
	useDictionary,
	useTranslation,
} from "@wandit/internationalization/react";
import { cn, useThemeColor } from "heroui-native";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	ActivityIndicator,
	Image,
	Keyboard,
	Pressable,
	ScrollView,
	Text,
	TextInput,
	View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { WanditIcon } from "@/components/wandit-icon";
import { useAppTheme } from "@/contexts/app-theme-context";
import { ConnectorsSheet } from "@/features/connectors";
import { ICON_STROKE } from "@/shared/lib/brand";
import { BrandGradientFill } from "@/shared/ui/brand-gradient-fill";
import {
	ALL_SKILLS,
	buildComposer,
	CHAT_PROMPT_MAX_LENGTH,
	createDefaultOptions,
	createVideoSubmissionId,
	type GenerationOutputDef,
	type GenerationOutputId,
	getDefaultOutput,
	getOutput,
	PROJECT_PROMPT_MAX_LENGTH,
	type PromptDraft,
	ROUTE_MODES,
	type RouteMode,
	type SkillFileDef,
	type SkillFileId,
} from "../lib/prompt";
import {
	type ComposerAttachment,
	useAttachments,
} from "../lib/use-attachments";
import { useVoiceDictation } from "../lib/use-voice-dictation";
import { AttachSheet } from "./attach-sheet";
import { EnginePickerSheet } from "./engine-picker-sheet";
import { OutputConfigSheet } from "./output-config-sheet";
import { RecordingWaveform } from "./recording-waveform";
import { SkillSelectDialog } from "./skill-select-dialog";

/** While a request-tray ask is docked, the send arrow becomes the answer
    CTA: an ember pill whose label names the confirm action ("Choose this
    option", "Send 2 files", …). `false` from onSubmit keeps the draft. */
export type PromptBoxSubmitOverride = {
	label: string;
	disabled?: boolean;
	onSubmit: () =>
		| boolean
		| undefined
		| void
		| Promise<boolean | undefined | void>;
};

const VIDEO_SOURCE_MEDIA_TYPES = new Set<string>(
	IMAGE_TO_VIDEO_SOURCE_MEDIA_TYPES,
);

export type PromptBoxProps = {
	/** Receives the trimmed text and the exact composer snapshot. */
	onSubmit: (
		draft: PromptDraft,
	) => boolean | undefined | Promise<boolean | undefined>;
	/** Replaces the send button + submit routing while an ask is docked. */
	submitOverride?: PromptBoxSubmitOverride;
	/** hero = centered home composer; compact = chat dock. */
	variant?: "hero" | "compact";
	placeholder?: string;
	initialValue?: string;
	maxLength?: number;
	clearOnSubmit?: boolean;
	isSubmitting?: boolean;
	/** Hard lock (out of credits, web parity): typing, dictation and every
	    toolbar control gray out and stop responding until the caller's gate
	    lifts — the composer never fires a send the server would refuse. */
	disabled?: boolean;
	className?: string;
	/** Mirrors every draft change (typing, voice transcripts, clear-on-submit)
	    so the chat screen can route typed text to a docked ask. */
	onValueChange?: (value: string) => void;
	/** Renders INSIDE the card, above everything — the request tray docks
	    here and fuses with the composer (same contract as the web PromptBox). */
	topSlot?: ReactNode;
};

/**
 * THE shared ember composer, mobile twin of the web PromptBox. Toolbar:
 * [+] opens the attach sheet (files/photo/library/skills → skill dialog),
 * the mode pill picks the route, and the sliders button configures the
 * generation output + its options for concrete modes.
 */
export function PromptBox({
	onSubmit,
	submitOverride,
	variant = "hero",
	placeholder,
	initialValue = "",
	maxLength,
	clearOnSubmit = false,
	isSubmitting = false,
	disabled = false,
	className,
	onValueChange,
	topSlot,
}: PromptBoxProps) {
	const { t } = useTranslation();
	const promptBox = useDictionary().projects.promptBox;
	const { isDark } = useAppTheme();
	const accent = useThemeColor("accent");
	const muted = useThemeColor("muted");
	const danger = useThemeColor("danger");
	const iconStroke = isDark ? ICON_STROKE.dark : ICON_STROKE.light;

	const inputRef = useRef<TextInput>(null);
	const submitInFlightRef = useRef(false);
	const videoSubmissionIdRef = useRef<string | null>(null);
	if (videoSubmissionIdRef.current === null) {
		videoSubmissionIdRef.current = createVideoSubmissionId();
	}
	const [value, setValue] = useState(initialValue);
	const [routeMode, setRouteMode] = useState<RouteMode>("auto");
	const [quality, setQuality] = useState<ComposerQuality>("standard");
	const [selectedOutputId, setSelectedOutputId] =
		useState<GenerationOutputId | null>(null);
	const [outputOptions, setOutputOptions] = useState<Record<string, string>>(
		{},
	);
	const [selectedSkillIds, setSelectedSkillIds] = useState<SkillFileId[]>([]);
	const [engineOpen, setEngineOpen] = useState(false);
	const [attachOpen, setAttachOpen] = useState(false);
	const [skillsOpen, setSkillsOpen] = useState(false);
	const [configOpen, setConfigOpen] = useState(false);
	const [connectorsOpen, setConnectorsOpen] = useState(false);

	const attachments = useAttachments({
		cameraPermissionDenied: t("native.attach.cameraPermissionDenied"),
		limitReached: t("native.attach.limitReached"),
		tooLarge: t("native.attach.tooLarge"),
		unsupported: t("native.attach.unsupported"),
		uploadFailed: t("native.attach.uploadFailed"),
	});

	// Chips beyond this collapse into a "+N" pill so the composer stays short.
	const maxVisibleSkills = 2;

	const appendTranscript = useCallback((text: string) => {
		videoSubmissionIdRef.current = createVideoSubmissionId();
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

	// One mirror for every way the draft changes — typing, voice transcript
	// appends, clear-on-submit — instead of notifying from each call site.
	useEffect(() => {
		onValueChange?.(value);
	}, [value, onValueChange]);

	const isHero = variant === "hero";
	const canSubmit = submitOverride
		? !submitOverride.disabled
		: (value.trim().length > 0 || attachments.hasReadyFiles) &&
			!attachments.isUploading;
	const submitEnabled =
		canSubmit && !disabled && !isSubmitting && !voiceDictation.isBusy;
	const selectedMode =
		ROUTE_MODES.find((mode) => mode.id === routeMode) ?? ROUTE_MODES[0];
	const selectedOutput = getOutput(selectedOutputId);
	const attachedSkills = ALL_SKILLS.filter((skill) =>
		selectedSkillIds.includes(skill.id),
	);
	const handleSubmit = async () => {
		if (
			disabled ||
			submitInFlightRef.current ||
			isSubmitting ||
			voiceDictation.isBusy
		) {
			return;
		}

		// A docked ask hijacks the submit: the CTA confirms the tray draft
		// (typed text, chip pick, or uploads) instead of opening a user turn.
		if (submitOverride) {
			if (submitOverride.disabled) return;
			submitInFlightRef.current = true;
			voiceDictation.clearError();
			try {
				const result = await submitOverride.onSubmit();
				if (clearOnSubmit && result !== false) {
					setValue("");
				}
			} finally {
				submitInFlightRef.current = false;
			}
			return;
		}

		const prompt = value.trim();
		const files = attachments.readyFiles;
		if (!prompt && files.length === 0) {
			return;
		}
		if (attachments.isUploading) {
			return;
		}
		submitInFlightRef.current = true;
		voiceDictation.clearError();
		const options: Record<string, unknown> = { ...outputOptions };
		if (routeMode === "video") {
			options.videoSubmissionId =
				videoSubmissionIdRef.current ?? createVideoSubmissionId();
			// Video always animates a user image (contract: animate_image) — ride
			// the first eligible ready attachment as the source, web parity.
			const sourceImage = files.find((file) =>
				VIDEO_SOURCE_MEDIA_TYPES.has(file.mediaType),
			);
			if (sourceImage) {
				options.sourceImageUrl = sourceImage.url;
				options.sourceMediaType = sourceImage.mediaType;
			}
		}
		try {
			const result = await onSubmit({
				text: prompt,
				composer: buildComposer({
					mode: routeMode,
					quality,
					output: selectedOutputId,
					skills: selectedSkillIds,
					options,
				}),
				...(files.length > 0 ? { files } : {}),
			});
			if (clearOnSubmit && result !== false) {
				setValue("");
				// Consume only what this submit sent — files the user attached
				// while the send was in flight stay drafted for the next turn.
				attachments.consume(files);
			}
		} finally {
			submitInFlightRef.current = false;
		}
	};

	const handleValueChange = (nextValue: string) => {
		voiceDictation.clearError();
		if (nextValue !== value) {
			videoSubmissionIdRef.current = createVideoSubmissionId();
		}
		setValue(nextValue);
	};

	const startVoiceDictation = () => {
		if (disabled || isSubmitting || voiceDictation.isTranscribing) {
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
		videoSubmissionIdRef.current = createVideoSubmissionId();
		setRouteMode(mode);
		setQuality("standard");
		const defaultOutput = getDefaultOutput(mode);
		setSelectedOutputId(defaultOutput?.id ?? null);
		setOutputOptions(defaultOutput ? createDefaultOptions(defaultOutput) : {});
	};

	const selectOutput = (output: GenerationOutputDef) => {
		voiceDictation.clearError();
		videoSubmissionIdRef.current = createVideoSubmissionId();
		setSelectedOutputId(output.id);
		setQuality("standard");
		setOutputOptions(createDefaultOptions(output));
	};

	const updateOutputOption = (groupId: string, choiceId: string) => {
		voiceDictation.clearError();
		videoSubmissionIdRef.current = createVideoSubmissionId();
		if (
			groupId === "quality" &&
			(choiceId === "standard" || choiceId === "max")
		) {
			setQuality(choiceId);
			return;
		}
		setOutputOptions((current) => ({ ...current, [groupId]: choiceId }));
	};

	const toggleSkill = (skill: SkillFileDef) => {
		voiceDictation.clearError();
		videoSubmissionIdRef.current = createVideoSubmissionId();
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
	const voiceActive =
		voiceDictation.isRecording || voiceDictation.isTranscribing;
	const resolvedMaxLength =
		maxLength ?? (isHero ? PROJECT_PROMPT_MAX_LENGTH : CHAT_PROMPT_MAX_LENGTH);

	return (
		<View
			className={cn(
				"w-full rounded-[22px] border border-border bg-surface",
				isDark && "bg-surface/90",
				className,
			)}
			style={{ boxShadow: cardShadow }}
		>
			{topSlot ? (
				// Clips the tray to the card's top radius WITHOUT putting
				// overflow-hidden on the card itself (that would kill the shadow).
				<View
					style={{
						overflow: "hidden",
						borderTopLeftRadius: 21,
						borderTopRightRadius: 21,
					}}
				>
					{topSlot}
				</View>
			) : null}
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
			{attachments.attachments.length > 0 ? (
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					style={{ flexGrow: 0 }}
					contentContainerClassName="gap-2 px-3.5 pt-3"
				>
					{attachments.attachments.map((attachment) => (
						<AttachmentChip
							key={attachment.id}
							attachment={attachment}
							onRemove={() => attachments.removeAttachment(attachment.id)}
							onRetry={() => attachments.retryAttachment(attachment.id)}
							removeLabel={t("native.attach.remove")}
						/>
					))}
				</ScrollView>
			) : null}
			<TextInput
				ref={inputRef}
				accessibilityLabel={resolvedPlaceholder}
				value={value}
				onChangeText={handleValueChange}
				placeholder={resolvedPlaceholder}
				placeholderTextColor={muted}
				multiline
				editable={!disabled && !isSubmitting && !voiceActive}
				maxLength={resolvedMaxLength}
				textAlignVertical="top"
				className={cn(
					"w-full px-4 pt-[15px] pb-1 text-[15px] text-foreground leading-[22px]",
					disabled && "opacity-60",
				)}
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
						accessibilityState={{ disabled }}
						disabled={disabled}
						onPress={() => {
							voiceDictation.clearError();
							setAttachOpen(true);
						}}
						className={cn(
							"h-[38px] w-[38px] items-center justify-center rounded-full border border-border active:scale-95",
							disabled && "opacity-45",
						)}
					>
						<WanditIcon name="plus" size={16} color={iconStroke} />
					</Pressable>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={promptBox.modeLabel}
						accessibilityState={{ disabled }}
						disabled={disabled}
						onPress={() => {
							voiceDictation.clearError();
							setEngineOpen(true);
						}}
						className={cn(
							"h-[34px] flex-row items-center gap-1.5 rounded-full border border-border px-[11px] active:scale-95",
							disabled && "opacity-45",
						)}
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
							accessibilityState={{ disabled }}
							disabled={disabled}
							onPress={() => {
								voiceDictation.clearError();
								setConfigOpen(true);
							}}
							className={cn(
								"h-[38px] w-[38px] items-center justify-center rounded-full border border-border active:scale-95",
								disabled && "opacity-45",
							)}
						>
							<WanditIcon name="sliders" size={16} color={iconStroke} />
						</Pressable>
					) : null}
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={promptBox.micLabel}
						accessibilityState={{
							busy: voiceDictation.isTranscribing,
							disabled:
								disabled || isSubmitting || voiceDictation.isTranscribing,
							selected: voiceDictation.isRecording,
						}}
						disabled={disabled || isSubmitting || voiceDictation.isTranscribing}
						onPress={startVoiceDictation}
						className={cn(
							"h-[38px] w-[38px] items-center justify-center rounded-full border border-border active:scale-95",
							voiceDictation.isRecording && "border-accent/45 bg-accent/10",
							(disabled || isSubmitting || voiceDictation.isTranscribing) &&
								"opacity-45",
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
						accessibilityLabel={submitOverride?.label ?? promptBox.submitLabel}
						accessibilityState={{
							disabled: !submitEnabled,
							busy: isSubmitting,
						}}
						disabled={!submitEnabled}
						onPress={() => {
							void handleSubmit();
						}}
						className={cn(
							"relative items-center justify-center overflow-visible rounded-full active:scale-95",
							submitOverride && "flex-row overflow-hidden",
						)}
						style={{
							height: sendSize,
							opacity: submitEnabled ? 1 : isSubmitting ? 0.78 : 0.45,
							boxShadow: submitEnabled ? sendGlow : undefined,
							...(submitOverride
								? { paddingHorizontal: 14, gap: 6, flexShrink: 1, minWidth: 0 }
								: { width: sendSize }),
						}}
					>
						<BrandGradientFill radius={sendSize / 2} />
						{submitOverride ? (
							<>
								{isSubmitting ? (
									<ActivityIndicator
										size="small"
										color={isDark ? "#160D07" : "#FFFFFF"}
									/>
								) : (
									<WanditIcon
										name="check"
										size={13}
										color={isDark ? "#160D07" : "#FFFFFF"}
									/>
								)}
								<Text
									numberOfLines={1}
									className="font-sans-semibold"
									style={{
										fontSize: 12.5,
										flexShrink: 1,
										color: isDark ? "#160D07" : "#FFFFFF",
									}}
								>
									{submitOverride.label}
								</Text>
							</>
						) : isSubmitting ? (
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
			{attachments.notice ? (
				<Text
					selectable
					className="px-4 pb-2.5 font-sans-medium text-[12px] text-danger"
				>
					{attachments.notice}
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
				onAttachSkill={openSkillDialog}
				skillCount={selectedSkillIds.length}
				onTakePhoto={() => void attachments.takePhoto()}
				onPickFromLibrary={() => void attachments.pickFromLibrary()}
				onBrowseFiles={() => void attachments.browseFiles()}
				onConnectApps={() => setConnectorsOpen(true)}
			/>
			<ConnectorsSheet
				isOpen={connectorsOpen}
				onOpenChange={setConnectorsOpen}
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
					values={{ ...outputOptions, quality }}
					onSelectOutput={selectOutput}
					onValueChange={updateOutputOption}
				/>
			) : null}
		</View>
	);
}

/** One pending attachment. Ready/uploading keep the compact thumbnail / doc
    pill (spinner overlay marks uploading); failed chips expand into a danger
    pill with the failure reason and a retry control, plus the same floating
    remove badge. */
function AttachmentChip({
	attachment,
	onRemove,
	onRetry,
	removeLabel,
}: {
	attachment: ComposerAttachment;
	onRemove: () => void;
	onRetry: () => void;
	removeLabel: string;
}) {
	const attachmentsCopy = useDictionary().projects.promptBox.attachments;
	const muted = useThemeColor("muted");
	const danger = useThemeColor("danger");
	const isImage = attachment.mediaType.startsWith("image/");

	if (attachment.status === "error") {
		const reason =
			attachment.error === "unsupported"
				? attachmentsCopy.unsupported
				: attachment.error === "too-large"
					? attachmentsCopy.tooLarge
					: attachmentsCopy.failed;
		return (
			<View className="relative pe-1.5 pt-1.5">
				<View className="h-[54px] flex-row items-center gap-2 rounded-[12px] border border-danger/60 bg-danger/10 ps-2 pe-0.5">
					{isImage ? (
						<Image
							source={{ uri: attachment.uri }}
							resizeMode="cover"
							className="h-[38px] w-[38px] rounded-[9px]"
							accessibilityLabel={attachment.filename}
						/>
					) : (
						<View className="h-[38px] w-[38px] items-center justify-center rounded-[9px] border border-danger/25 bg-surface">
							<WanditIcon name="page" size={13} color={danger} />
						</View>
					)}
					<View style={{ maxWidth: 118 }}>
						<Text
							numberOfLines={1}
							className="text-[11.5px] text-foreground"
							style={{ writingDirection: "ltr" }}
						>
							{attachment.filename}
						</Text>
						<Text numberOfLines={1} className="mt-0.5 text-[10px] text-danger">
							{reason}
						</Text>
					</View>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={attachmentsCopy.retry}
						onPress={onRetry}
						hitSlop={8}
						className="h-[32px] w-[32px] items-center justify-center rounded-full active:scale-95"
					>
						<WanditIcon name="refresh" size={14} color={danger} />
					</Pressable>
				</View>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={removeLabel}
					onPress={onRemove}
					hitSlop={7}
					className="absolute end-0 top-0 h-[18px] w-[18px] items-center justify-center rounded-full border border-border bg-surface"
				>
					<WanditIcon name="close" size={8} color={muted} />
				</Pressable>
			</View>
		);
	}

	return (
		<View className="relative pe-1.5 pt-1.5">
			<View
				className={cn(
					"overflow-hidden rounded-[12px] border border-border",
					isImage
						? "h-[54px] w-[54px]"
						: "h-[38px] max-w-[160px] flex-row items-center gap-1.5 bg-surface-secondary px-2.5",
				)}
			>
				{isImage ? (
					<Image
						source={{ uri: attachment.uri }}
						resizeMode="cover"
						className="h-full w-full"
						accessibilityLabel={attachment.filename}
					/>
				) : (
					<>
						<WanditIcon name="page" size={13} color={muted} />
						<Text
							numberOfLines={1}
							className="text-[11.5px] text-foreground"
							style={{ maxWidth: 110, writingDirection: "ltr" }}
						>
							{attachment.filename}
						</Text>
					</>
				)}
				{attachment.status === "uploading" ? (
					<View className="absolute inset-0 items-center justify-center bg-black/25">
						<ActivityIndicator size="small" color="#FFFFFF" />
					</View>
				) : null}
			</View>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={removeLabel}
				onPress={onRemove}
				hitSlop={7}
				className="absolute end-0 top-0 h-[18px] w-[18px] items-center justify-center rounded-full border border-border bg-surface"
			>
				<WanditIcon name="close" size={8} color={muted} />
			</Pressable>
		</View>
	);
}
