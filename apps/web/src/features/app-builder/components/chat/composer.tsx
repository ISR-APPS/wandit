/**
 * Prompt box of the builder chat, a white card. The request tray slot sits on top.
 * Then come the focus chip, the textarea, and the row of controls and send.
 * While the tray shows, the send button becomes the answer pill of the tray.
 * Rendered by chat-pane.tsx. Calls `onSend` with the trimmed draft.
 * Actions with no backend show the notWired toast.
 */

import type { Icon } from "@phosphor-icons/react";
import { ArrowUpIcon } from "@phosphor-icons/react/ArrowUp";
import { CaretDownIcon } from "@phosphor-icons/react/CaretDown";
import { CheckIcon } from "@phosphor-icons/react/Check";
import { CrosshairIcon } from "@phosphor-icons/react/Crosshair";
import { HammerIcon } from "@phosphor-icons/react/Hammer";
import { ImageIcon } from "@phosphor-icons/react/Image";
import { LayoutIcon } from "@phosphor-icons/react/Layout";
import { ListChecksIcon } from "@phosphor-icons/react/ListChecks";
import { MicrophoneIcon } from "@phosphor-icons/react/Microphone";
import { PaperclipIcon } from "@phosphor-icons/react/Paperclip";
import { PlusIcon } from "@phosphor-icons/react/Plus";
import { XIcon } from "@phosphor-icons/react/X";
import { projectPromptMaxLength } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItemBare,
	DropdownMenuTrigger,
} from "@wandit/ui/components/dropdown-menu";
import { Textarea } from "@wandit/ui/components/textarea";
import { cn } from "@wandit/ui/lib/utils";
import { type KeyboardEvent, type ReactNode, useState } from "react";
import { toast } from "sonner";

import { Spark } from "@/components/logo";
import { useTranslation } from "@/lib/i18n";
import type { SendBuilderMessageInput } from "../../api/app-builder.services";
import { COMPOSER_MODES, type ComposerMode } from "../../lib/constants";
import { IconAction } from "../shell/top-bar";

/**
 * The answer button that replaces the send circle while the request tray
 * shows. lib/use-request-tray.ts builds it.
 */
export type ComposerSubmitOverride = {
	/** Pill text, for example "Choose this option". */
	label: string;
	/** True while the answer is incomplete; the empty draft does not decide it. */
	disabled: boolean;
	/** Takes the current draft; the composer clears the draft after the call. */
	onSubmit: (text: string) => void;
};

export type ComposerProps = {
	/** Credits one turn costs, whole credits. Shown next to the mode menu. */
	turnEstimateCredits: number;
	/** Screen or element the next turn targets, or null. Shown as a chip the user can remove. */
	focusLabel: string | null;
	/** True while a turn runs or the chat is not ready yet. Locks the textarea and the send button. */
	isSending: boolean;
	onSend: (input: SendBuilderMessageInput) => void;
	/** Content at the top of the card, above the textarea: the request tray. */
	topSlot?: ReactNode;
	/** Set while the request tray shows: Enter and the button answer the tray. */
	submitOverride?: ComposerSubmitOverride | null;
	/** Gets every draft change; the tray reads the typed answer from it. */
	onDraftChange?: (text: string) => void;
};

// A soft navy chip that turns into a solid night pill (spark in dark mode)
// while its menu is open. A copy of HERO_CHIP_CLASS in
// features/projects/components/prompt-box.tsx, so the two prompt boxes match.
// The open look keys on aria-expanded: a tooltip on the same button overwrites data-state.
const CHIP_CLASS =
	"group/trigger rounded-full border-transparent bg-night/[0.05] font-grotesk font-medium text-night/75 shadow-none transition-colors duration-200 hover:bg-night/[0.09] hover:text-night aria-expanded:bg-night aria-expanded:text-paper dark:border-transparent dark:bg-white/[0.06] dark:text-foreground/75 dark:aria-expanded:bg-spark dark:aria-expanded:text-night dark:hover:bg-white/[0.1] dark:hover:text-foreground";

/** Icon of each mode, on the chip and in the menu row. */
const MODE_ICONS = {
	build: HammerIcon,
	plan: ListChecksIcon,
} as const satisfies Record<ComposerMode, Icon>;

// The send circle and the answer pill share the ember face, with a soft
// ember (#d16022) glow. Disabled is a flat navy tint, not a faded ember: a
// pale orange reads as "almost ready".
const SEND_CLASS =
	"rounded-full bg-primary text-primary-foreground shadow-[0_1px_0_rgb(11_16_51/0.08),0_4px_12px_-4px_rgb(209_96_34/0.55)] transition-colors duration-150 hover:bg-ember-deep disabled:bg-night/10 disabled:text-night/35 disabled:opacity-100 disabled:shadow-none dark:hover:bg-primary/90 dark:disabled:bg-white/10 dark:disabled:text-foreground/35";

/**
 * The chat prompt box. Enter sends the trimmed draft, Shift+Enter adds a
 * line. With `submitOverride` set, Enter and the pill answer the tray.
 */
export function Composer({
	turnEstimateCredits,
	focusLabel,
	isSending,
	onSend,
	topSlot,
	submitOverride,
	onDraftChange,
}: ComposerProps) {
	const { t } = useTranslation();
	const [draft, setDraftState] = useState("");
	const setDraft = (text: string) => {
		setDraftState(text);
		onDraftChange?.(text);
	};
	const [mode, setMode] = useState<ComposerMode>("build");
	// The label the user removed. A different label from the preview shows the chip again.
	// LIMIT: the same label picked again stays hidden until a reload. Upgrade: the page clears thread.focusLabel through a mutation.
	const [clearedLabel, setClearedLabel] = useState<string | null>(null);
	const trimmed = draft.trim();
	// The tray decides when its answer is complete: a picked chip answers with
	// an empty draft.
	const canSend = submitOverride
		? !submitOverride.disabled && !isSending
		: trimmed.length > 0 && !isSending;
	const notWired = () => toast(t("appBuilder.mock.notWired"));

	function send() {
		if (!canSend) return;
		if (submitOverride) {
			submitOverride.onSubmit(trimmed);
		} else {
			onSend({ text: trimmed, mode });
		}
		setDraft("");
	}

	function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		// Enter sends. Shift+Enter, and Enter that ends an IME composition, insert a newline.
		if (
			event.key !== "Enter" ||
			event.shiftKey ||
			event.nativeEvent.isComposing
		) {
			return;
		}
		event.preventDefault();
		send();
	}

	return (
		// The ember ring shows while any control of the card has focus.
		<div className="flex flex-col overflow-hidden rounded-[22px] border border-night/[0.08] bg-white shadow-[0_1px_0_rgb(11_16_51/0.04),0_12px_32px_-20px_rgb(11_16_51/0.35)] transition-[box-shadow,border-color] duration-200 focus-within:border-ember/40 focus-within:ring-[3px] focus-within:ring-ember/15 dark:border-white/[0.08] dark:bg-white/[0.04] dark:shadow-none dark:focus-within:border-spark/40 dark:focus-within:ring-spark/15">
			{topSlot}
			{/* The padding sits here, not on the card, so the tray reaches the card edges. */}
			<div className="flex flex-col px-3 pt-3 pb-2.5">
				{focusLabel !== null && focusLabel !== clearedLabel ? (
					<span className="mx-1 mb-1.5 flex h-7 max-w-full items-center gap-1.5 self-start rounded-full bg-spark/[0.16] ps-2.5 pe-1 font-grotesk font-medium text-[12px] text-night dark:bg-spark/[0.14] dark:text-foreground">
						<CrosshairIcon
							weight="bold"
							className="size-3.5 shrink-0 text-spark-deep dark:text-spark"
							aria-hidden
						/>
						<span dir="auto" className="min-w-0 truncate">
							{t("appBuilder.chat.focusChip", { label: focusLabel })}
						</span>
						<IconAction label={t("appBuilder.chat.removeFocus")}>
							<button
								type="button"
								onClick={() => setClearedLabel(focusLabel)}
								className="grid size-5 shrink-0 place-items-center rounded-full text-night/50 outline-none transition-colors hover:bg-night/[0.08] hover:text-night focus-visible:ring-2 focus-visible:ring-ember/40 dark:text-foreground/50 dark:hover:bg-white/[0.1] dark:hover:text-foreground"
							>
								<XIcon weight="bold" className="size-3" aria-hidden />
							</button>
						</IconAction>
					</span>
				) : null}
				{/* The kit textarea grows with its content (field-sizing), so no resize code here. */}
				<Textarea
					rows={1}
					// The turn route refuses a longer message or typed answer.
					maxLength={projectPromptMaxLength}
					dir="auto"
					value={draft}
					placeholder={t("appBuilder.chat.placeholder")}
					disabled={isSending}
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={onKeyDown}
					className="max-h-40 min-h-[44px] resize-none border-0 bg-transparent px-1 py-1.5 font-sans text-[15px] text-night leading-[1.5] caret-ember shadow-none placeholder:text-night/40 focus-visible:ring-0 disabled:opacity-60 dark:bg-transparent dark:text-foreground dark:caret-spark dark:placeholder:text-foreground/40"
				/>
				<div className="mt-1 flex items-center gap-1.5">
					<DropdownMenu>
						<IconAction label={t("appBuilder.chat.addContext")}>
							<DropdownMenuTrigger asChild>
								<Button
									variant="outline"
									size="icon-sm"
									className={cn(CHIP_CLASS, "text-night dark:text-foreground")}
								>
									<PlusIcon weight="bold" className="size-4" aria-hidden />
								</Button>
							</DropdownMenuTrigger>
						</IconAction>
						<DropdownMenuContent align="start" sideOffset={8} className="w-60">
							<DropdownMenuItem onSelect={notWired}>
								<PaperclipIcon weight="duotone" aria-hidden />
								{t("appBuilder.chat.attach")}
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={notWired}>
								<ImageIcon weight="duotone" aria-hidden />
								{t("appBuilder.chat.attachImage")}
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={notWired}>
								<LayoutIcon weight="duotone" aria-hidden />
								{t("appBuilder.chat.attachScreen")}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					<span className="ms-auto flex items-center gap-1 whitespace-nowrap font-grotesk text-[12px] text-night/50 tabular-nums dark:text-foreground/50">
						<Spark className="size-3 text-spark" />
						{t("appBuilder.chat.estimate", { count: turnEstimateCredits })}
					</span>
					{/* An answer to the tray is not a build or plan turn, so the mode chip steps aside for the answer pill. */}
					{submitOverride ? null : (
						<ModeMenu mode={mode} onModeChange={setMode} />
					)}
					<IconAction label={t("appBuilder.chat.dictate")}>
						<Button
							variant="ghost"
							size="icon-sm"
							onClick={notWired}
							className="rounded-full text-night/55 hover:bg-night/[0.06] hover:text-night dark:text-foreground/55 dark:hover:bg-white/[0.08] dark:hover:text-foreground"
						>
							<MicrophoneIcon
								weight="bold"
								className="size-[18px]"
								aria-hidden
							/>
						</Button>
					</IconAction>
					{submitOverride ? (
						<Button
							disabled={!canSend}
							onClick={send}
							className={cn(
								SEND_CLASS,
								"h-9 min-w-0 shrink gap-1.5 px-3.5 font-grotesk font-semibold text-[13px] has-[>svg]:px-3.5",
							)}
						>
							<CheckIcon weight="bold" className="size-3.5" aria-hidden />
							<span className="truncate">{submitOverride.label}</span>
						</Button>
					) : (
						<IconAction label={t("appBuilder.chat.send")}>
							<Button
								size="icon"
								disabled={!canSend}
								onClick={send}
								className={SEND_CLASS}
							>
								<ArrowUpIcon
									weight="bold"
									className="size-[18px]"
									aria-hidden
								/>
							</Button>
						</IconAction>
					)}
				</div>
			</div>
		</div>
	);
}

/** The Build | Plan chip and its menu. Each menu row has a medallion and a one-line hint. */
function ModeMenu({
	mode,
	onModeChange,
}: {
	mode: ComposerMode;
	onModeChange: (mode: ComposerMode) => void;
}) {
	const { t } = useTranslation();
	const ModeIcon = MODE_ICONS[mode];
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					aria-label={t("appBuilder.chat.modeLabel")}
					className={cn(
						CHIP_CLASS,
						"h-8 gap-1.5 ps-2.5 pe-2 text-[13px] has-[>svg]:ps-2.5 has-[>svg]:pe-2",
					)}
				>
					<ModeIcon weight="bold" className="size-3.5" aria-hidden />
					{t(`appBuilder.chat.modes.${mode}`)}
					{/* The caret turns over while the menu is open. */}
					<CaretDownIcon
						weight="bold"
						className="size-3 opacity-60 transition-transform duration-200 group-aria-expanded/trigger:rotate-180 motion-reduce:transition-none"
						aria-hidden
					/>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				sideOffset={8}
				collisionPadding={12}
				className="w-72"
			>
				<DropdownMenuRadioGroup
					value={mode}
					onValueChange={(next) => {
						// Radix hands back a plain string; only a known mode changes the state.
						const picked = COMPOSER_MODES.find((option) => option === next);
						if (picked) onModeChange(picked);
					}}
				>
					{COMPOSER_MODES.map((option) => (
						<DropdownMenuRadioItemBare key={option} value={option}>
							<ModeMedallion
								icon={MODE_ICONS[option]}
								isPicked={option === mode}
							/>
							<span className="min-w-0">
								<span className="block font-semibold leading-tight">
									{t(`appBuilder.chat.modes.${option}`)}
								</span>
								<span className="mt-0.5 block font-normal font-sans text-popover-foreground/55 text-xs leading-snug">
									{t(`appBuilder.chat.modeHints.${option}`)}
								</span>
							</span>
							<CheckIcon
								weight="bold"
								aria-hidden
								className="ms-auto size-4 shrink-0 text-primary opacity-0 group-data-[state=checked]/row:opacity-100"
							/>
						</DropdownMenuRadioItemBare>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/**
 * The round icon at the start of a mode row. The picked row gets the spark
 * circle and the filled glyph. A copy of RowMedallion in
 * features/projects/components/prompt-box.tsx.
 */
function ModeMedallion({
	icon: RowIcon,
	isPicked,
}: {
	icon: Icon;
	isPicked: boolean;
}) {
	return (
		<span
			aria-hidden
			className={cn(
				"grid size-8 shrink-0 place-items-center rounded-full transition-colors",
				isPicked
					? "bg-spark text-night dark:bg-night dark:text-spark"
					: "bg-popover-foreground/[0.05] text-popover-foreground/60",
			)}
		>
			{/* text-current opts out of the menu rule that dims every icon without a text color. */}
			<RowIcon
				weight={isPicked ? "fill" : "duotone"}
				className="size-[18px] text-current"
			/>
		</span>
	);
}
