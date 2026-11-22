/**
 * The sources menu of the two V2 prompt boxes, and its @-tag. The "+" chip,
 * or an "@" that the user types, opens one menu over the textarea: add
 * photos and files, web search, deep search, clone website (web projects),
 * and the skills of the dashboard box. A search or clone pick becomes one
 * tag at the start of the textarea (`InlineActionTag`). chat/composer.tsx and
 * the dashboard prompt box (features/projects, through the barrel) render it
 * with the state of `usePromptSources`. chat-message.tsx shows a sent tag.
 */

import type { Icon } from "@phosphor-icons/react";
import { ArrowRightIcon } from "@phosphor-icons/react/ArrowRight";
import { BinocularsIcon } from "@phosphor-icons/react/Binoculars";
import { CaretLeftIcon } from "@phosphor-icons/react/CaretLeft";
import { CheckIcon } from "@phosphor-icons/react/Check";
import { CopySimpleIcon } from "@phosphor-icons/react/CopySimple";
import { GlobeIcon } from "@phosphor-icons/react/Globe";
import { LinkSimpleIcon } from "@phosphor-icons/react/LinkSimple";
import { MagicWandIcon } from "@phosphor-icons/react/MagicWand";
import { PaperclipIcon } from "@phosphor-icons/react/Paperclip";
import { PlusIcon } from "@phosphor-icons/react/Plus";
import { XIcon } from "@phosphor-icons/react/X";
import {
	type BuilderTurnAction,
	publicWebAddressSchema,
} from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import {
	Command,
	CommandGroup,
	CommandItem,
	CommandList,
} from "@wandit/ui/components/command";
import {
	Popover,
	PopoverAnchor,
	PopoverContent,
	PopoverTrigger,
} from "@wandit/ui/components/popover";
import { cn } from "@wandit/ui/lib/utils";
import {
	type KeyboardEvent,
	type RefObject,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { flushSync } from "react-dom";

import { type TranslationKey, useTranslation } from "@/lib/i18n";
import { webHostOf } from "../../lib/turn-parts";
import { PROMPT_CHIP_CLASS } from "../builder-model-picker";
import { IconAction } from "../shell/top-bar";

/** The skill library of the dashboard box. features/projects prompt-box.tsx builds it from its skill files. */
export type PromptSkills = {
	/** Title of the row that opens the skills step, for example "Add skill". */
	title: string;
	/** Muted text after the title. */
	hint: string;
	/** The skills by category, in menu order. */
	groups: {
		id: string;
		/** Heading of the category. */
		label: string;
		skills: {
			id: string;
			label: string;
			/** One line about what the skill does. */
			hint: string;
			/** True while the skill goes with the next message. The row shows a check. */
			isSelected: boolean;
		}[];
	}[];
	/** Adds or removes one skill. The step stays open for more picks. */
	onToggle: (skillId: string) => void;
};

/** What the caller gives to `usePromptSources`. */
export type UsePromptSourcesInput = {
	/** The draft text of the caller. */
	draft: string;
	/** Writes the draft. A pick from "@" removes the "@query" text through it. */
	setDraft: (text: string) => void;
	/** The textarea of the caller. The menu floats over it, and a pick gives the focus back to it. */
	textareaRef: RefObject<HTMLTextAreaElement | null>;
	/** True for a web project: the menu lists "Clone website". */
	canCloneSite: boolean;
	/** Null: the files row works. A text: the row is off and shows this reason. */
	filesBlockedReason: string | null;
	/** Opens the file picker of the caller. */
	onAddFiles: () => void;
	/** Turns Plan Mode off. A Plan turn has no capture tool, so a clone needs a build turn. */
	onPickClone: () => void;
	/** The skills step of the dashboard box. Absent: the menu has no skills row. */
	skills?: PromptSkills;
};

/** One row of the first step. `skills` and `clone_site` open a step; the others act at once. Skills come last. */
type SourceRowId =
	| "files"
	| "skills"
	| "web_search"
	| "deep_search"
	| "clone_site";

/** One row of the first step, with its translated text. */
type SourceRow = {
	id: SourceRowId;
	icon: Icon;
	title: string;
	hint: string;
	/** True while the row cannot act, for example at the file limit. */
	isDisabled: boolean;
};

/** The "@query" that ends at the caret. `start` is the index of the "@", `end` the caret. */
type Mention = { start: number; end: number; query: string };

/** The view of the popover: the rows, the address field of a clone, or the skill library. */
type MenuStep = "list" | "clone_site" | "skills";

/** The text keys of the fixed rows, in menu order. */
const ROW_KEYS: readonly {
	id: Exclude<SourceRowId, "skills">;
	icon: Icon;
	titleKey: TranslationKey;
	hintKey: TranslationKey;
}[] = [
	{
		id: "files",
		icon: PaperclipIcon,
		titleKey: "appBuilder.chat.sourcesMenu.files.title",
		hintKey: "appBuilder.chat.sourcesMenu.files.hint",
	},
	{
		id: "web_search",
		icon: GlobeIcon,
		titleKey: "appBuilder.chat.sourcesMenu.webSearch.title",
		hintKey: "appBuilder.chat.sourcesMenu.webSearch.hint",
	},
	{
		id: "deep_search",
		icon: BinocularsIcon,
		titleKey: "appBuilder.chat.sourcesMenu.deepSearch.title",
		hintKey: "appBuilder.chat.sourcesMenu.deepSearch.hint",
	},
	{
		id: "clone_site",
		icon: CopySimpleIcon,
		titleKey: "appBuilder.chat.sourcesMenu.clone.title",
		hintKey: "appBuilder.chat.sourcesMenu.clone.hint",
	},
];

/** Space between the tag and the first word of the textarea, in px. */
const TAG_GAP_PX = 6;

/**
 * The "@query" that ends at the caret, or null. The "@" must start the
 * draft or follow a white space, so an email like "a@b.com" never matches.
 * The query has no space: a space ends it.
 */
function mentionAt(text: string, caret: number): Mention | null {
	const match = /(?:^|\s)@([^\s@]*)$/.exec(text.slice(0, caret));
	if (match === null) return null;
	const query = match[1] ?? "";
	return { start: caret - query.length - 1, end: caret, query };
}

/**
 * True when a message with this text, these files, and this tag can go. A
 * search needs words to search for. A clone tag is a full request alone.
 */
export function canSendWithAction(
	action: BuilderTurnAction | null,
	hasText: boolean,
	hasFiles: boolean,
): boolean {
	switch (action?.kind) {
		case "web_search":
		case "deep_search":
			return hasText;
		case "clone_site":
			return true;
		default:
			return hasText || hasFiles;
	}
}

/** The tag text without the "@", for example "Clone website · stripe.com". */
function actionLabelOf(
	action: BuilderTurnAction,
	t: ReturnType<typeof useTranslation>["t"],
): string {
	switch (action.kind) {
		case "web_search":
			return t("appBuilder.chat.sourcesMenu.webSearch.title");
		case "deep_search":
			return t("appBuilder.chat.sourcesMenu.deepSearch.title");
		case "clone_site":
			// publicWebUrlSchema accepted the URL, so it has a host.
			return `${t("appBuilder.chat.sourcesMenu.clone.title")} · ${webHostOf(action.url) ?? action.url}`;
	}
}

/**
 * The state of one sources menu and its tag: the picked action, the open
 * state, the "@query" of the draft, and the step. The caller sends `action`
 * and calls `trackDraft` and `handleKeyDown` from its textarea.
 */
export function usePromptSources(input: UsePromptSourcesInput) {
	const { t } = useTranslation();
	const [action, setAction] = useState<BuilderTurnAction | null>(null);
	const [isOpen, setIsOpen] = useState(false);
	const [mention, setMention] = useState<Mention | null>(null);
	const [step, setStep] = useState<MenuStep>("list");
	const [selectedRowId, setSelectedRowId] = useState<SourceRowId | null>(null);
	// True when the close must give the focus to the textarea: after a pick and after Escape.
	const refocusOnCloseRef = useRef(false);
	// Start index of the "@query" that the user closed with Escape or an outside click, or null.
	const dismissedMentionStartRef = useRef<number | null>(null);

	// Product rule: only a web project can copy a web page.
	const fixedRows = ROW_KEYS.filter(
		(row) => row.id !== "clone_site" || input.canCloneSite,
	).map((row) => {
		const blockedReason = row.id === "files" ? input.filesBlockedReason : null;
		return {
			id: row.id,
			icon: row.icon,
			title: t(row.titleKey),
			hint: blockedReason ?? t(row.hintKey),
			isDisabled: blockedReason !== null,
		};
	});
	const allRows: SourceRow[] = input.skills
		? [
				...fixedRows,
				{
					id: "skills",
					icon: MagicWandIcon,
					title: input.skills.title,
					hint: input.skills.hint,
					isDisabled: false,
				},
			]
		: fixedRows;
	const query = mention?.query.toLowerCase() ?? "";
	const rows = allRows.filter((row) => row.title.toLowerCase().includes(query));
	const enabledRows = rows.filter((row) => !row.isDisabled);
	const activeRowId =
		enabledRows.find((row) => row.id === selectedRowId)?.id ??
		enabledRows[0]?.id ??
		null;
	// An "@query" that matches no row shows no menu, so Enter still sends.
	const isMenuOpen = isOpen && (mention === null || enabledRows.length > 0);

	function open(next: Mention | null) {
		setIsOpen(true);
		setMention(next);
		setStep("list");
	}

	// A close that does not ask for the textarea keeps the focus rule of Radix:
	// an outside click keeps the focus where the user put it.
	function close(refocusTextarea: boolean) {
		if (refocusTextarea) refocusOnCloseRef.current = true;
		setIsOpen(false);
		setMention(null);
	}

	/** The user closes the menu. More typing in the same "@query" does not open it again. */
	function dismiss() {
		if (mention !== null) dismissedMentionStartRef.current = mention.start;
		close(false);
	}

	function pick(rowId: SourceRowId) {
		const textarea = input.textareaRef.current;
		if (mention !== null) {
			// The tag or the step replaces the "@query" text.
			const { start, end } = mention;
			flushSync(() =>
				input.setDraft(input.draft.slice(0, start) + input.draft.slice(end)),
			);
			textarea?.setSelectionRange(start, start);
			setMention(null);
		}
		switch (rowId) {
			case "files":
				close(true);
				input.onAddFiles();
				return;
			case "web_search":
			case "deep_search":
				// One tag at a time: a new pick replaces the old one.
				setAction({ kind: rowId });
				close(true);
				return;
			case "clone_site":
			case "skills":
				setStep(rowId);
				return;
		}
	}

	function confirmClone(url: string) {
		setAction({ kind: "clone_site", url });
		input.onPickClone();
		close(true);
	}

	/** Call it from the textarea `onChange`, after the draft update. A typed "@" opens the menu; a space closes it. */
	function trackDraft(text: string, caret: number) {
		const next = mentionAt(text, caret);
		// The user closed the menu for this "@query", so it stays closed until the query ends.
		if (next !== null && next.start === dismissedMentionStartRef.current) {
			return;
		}
		dismissedMentionStartRef.current = null;
		if (next !== null) {
			if (mention === null) open(next);
			else setMention(next);
		} else if (mention !== null) {
			// The user types on, so the focus stays in the textarea.
			close(true);
		}
	}

	/**
	 * Call it first from the textarea `onKeyDown`. True when the menu or the
	 * tag took the key: the caller then does nothing else with it.
	 */
	function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): boolean {
		// The textarea keeps the focus while the menu follows an "@query", so it moves the menu row.
		if (mention !== null && isMenuOpen) {
			if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				event.preventDefault();
				const index = enabledRows.findIndex((row) => row.id === activeRowId);
				const offset = event.key === "ArrowDown" ? 1 : -1;
				const next =
					enabledRows[
						(index + offset + enabledRows.length) % enabledRows.length
					];
				if (next) setSelectedRowId(next.id);
				return true;
			}
			if (event.key === "Enter" && !event.nativeEvent.isComposing) {
				event.preventDefault();
				if (activeRowId !== null) pick(activeRowId);
				return true;
			}
		}
		const textarea = event.currentTarget;
		// The tag sits before the first character, so Backspace there removes it.
		if (
			event.key === "Backspace" &&
			action !== null &&
			textarea.selectionStart === 0 &&
			textarea.selectionEnd === 0
		) {
			event.preventDefault();
			setAction(null);
			return true;
		}
		return false;
	}

	return {
		/** The picked @-tag, or null. The caller sends it with the message. */
		action,
		/** Sets or clears the tag: a send clears it, a refused send puts it back. */
		setAction,
		trackDraft,
		handleKeyDown,
		textareaRef: input.textareaRef,
		skills: input.skills,
		isMenuOpen,
		isMention: mention !== null,
		step,
		setStep,
		rows,
		activeRowId,
		setSelectedRowId,
		refocusOnCloseRef,
		open,
		dismiss,
		pick,
		confirmClone,
	};
}

/** The state of one menu, from `usePromptSources`. */
export type PromptSources = ReturnType<typeof usePromptSources>;

/** Props of the sources menu. */
export type PromptSourcesMenuProps = {
	sources: PromptSources;
	/** `md` is 36 px, for the dashboard hero box. `sm` is 32 px, for the builder composer. */
	size?: "sm" | "md";
	/**
	 * The whole prompt box of the dashboard. Set: the menu opens under the box.
	 * Absent: the menu opens above the textarea, because the composer is at the screen bottom.
	 */
	belowElementRef?: RefObject<HTMLElement | null>;
};

/**
 * The "+" chip and the menu popover. The popover floats over the textarea
 * of the caller, or under `belowElementRef`, in both ways to open it.
 * The caller wraps it in a TooltipProvider.
 */
export function PromptSourcesMenu({
	sources,
	size = "sm",
	belowElementRef,
}: PromptSourcesMenuProps) {
	const { t } = useTranslation();
	const commandRef = useRef<HTMLDivElement>(null);
	const { textareaRef } = sources;
	// The trigger sits in the chip row, but the menu floats over the textarea or under the box.
	// contextElement lets the popover follow that element when it grows or scrolls.
	const anchorRef = useRef({
		getBoundingClientRect: () =>
			(
				belowElementRef?.current ?? textareaRef.current
			)?.getBoundingClientRect() ?? new DOMRect(),
		get contextElement() {
			return belowElementRef?.current ?? textareaRef.current ?? undefined;
		},
	});
	const label = t("appBuilder.chat.addContext");
	const { isMenuOpen, isMention, step } = sources;
	// After the "+" chip and after a step change, the list takes the keys.
	// After an "@", the textarea keeps them. The address field focuses itself.
	useEffect(() => {
		if (isMenuOpen && !isMention && step !== "clone_site") {
			commandRef.current?.focus();
		}
	}, [isMenuOpen, isMention, step]);

	return (
		<Popover
			open={sources.isMenuOpen}
			onOpenChange={(isOpen) => {
				if (isOpen) sources.open(null);
				else sources.dismiss();
			}}
		>
			<PopoverAnchor virtualRef={anchorRef} />
			<IconAction label={label}>
				<PopoverTrigger asChild>
					<Button
						type="button"
						variant="outline"
						size="icon-sm"
						className={cn(
							PROMPT_CHIP_CLASS,
							"text-night dark:text-foreground",
							size === "md" && "size-9",
						)}
					>
						<PlusIcon weight="bold" className="size-4" aria-hidden />
					</Button>
				</PopoverTrigger>
			</IconAction>
			<PopoverContent
				// Radix flips the side when the screen has no room there.
				side={belowElementRef ? "bottom" : "top"}
				align="start"
				// On a phone the sheet keeps 12 px from each screen edge.
				collisionPadding={12}
				className="w-[23rem] max-w-[calc(100vw-24px)] overflow-hidden p-0"
				// The effect above moves the focus, so Radix must not move it to the sheet.
				onOpenAutoFocus={(event) => event.preventDefault()}
				onCloseAutoFocus={(event) => {
					if (!sources.refocusOnCloseRef.current) return;
					sources.refocusOnCloseRef.current = false;
					event.preventDefault();
					textareaRef.current?.focus();
				}}
				onEscapeKeyDown={(event) => {
					// Escape in a step goes back to the rows; on the rows it closes.
					if (sources.step !== "list") {
						event.preventDefault();
						sources.setStep("list");
						return;
					}
					sources.refocusOnCloseRef.current = true;
				}}
				// React sends a click in this portal to the parents of the menu. The
				// dashboard prompt row then moves the focus from the field to its textarea.
				onClick={(event) => event.stopPropagation()}
			>
				{sources.step === "clone_site" ? (
					<CloneStep
						onBack={() => sources.setStep("list")}
						onConfirm={sources.confirmClone}
					/>
				) : (
					<Command
						ref={commandRef}
						tabIndex={-1}
						label={label}
						// The rows filter on the "@query" of the textarea, not on a field of the list.
						shouldFilter={false}
						loop
						value={
							sources.step === "list"
								? (sources.activeRowId ?? undefined)
								: undefined
						}
						onValueChange={(value) => {
							const row = sources.rows.find((entry) => entry.id === value);
							if (row) sources.setSelectedRowId(row.id);
						}}
						className="rounded-none outline-none"
					>
						{sources.step === "skills" && sources.skills ? (
							<SkillsStep
								skills={sources.skills}
								onBack={() => sources.setStep("list")}
							/>
						) : (
							<>
								<CommandList>
									{sources.rows.map((row) => (
										<CommandItem
											key={row.id}
											value={row.id}
											disabled={row.isDisabled}
											onSelect={() => sources.pick(row.id)}
										>
											<row.icon weight="duotone" aria-hidden />
											<span className="shrink-0">{row.title}</span>
											<span className="min-w-0 truncate font-normal font-sans text-[13px] text-popover-foreground/50">
												{row.hint}
											</span>
										</CommandItem>
									))}
								</CommandList>
								<p className="border-popover-foreground/[0.07] border-t px-4 py-2.5 font-sans text-[12px] text-popover-foreground/50">
									{t(
										sources.isMention
											? "appBuilder.chat.sourcesMenu.footer"
											: "appBuilder.chat.sourcesMenu.footerTip",
									)}
								</p>
							</>
						)}
					</Command>
				)}
			</PopoverContent>
		</Popover>
	);
}

/** The title row of a step: a back button and the step name. */
function StepHeader({ title, onBack }: { title: string; onBack: () => void }) {
	const { t } = useTranslation();
	return (
		<div className="flex h-11 items-center gap-1.5 border-popover-foreground/[0.07] border-b px-2">
			<button
				type="button"
				onClick={onBack}
				aria-label={t("appBuilder.chat.sourcesMenu.back")}
				className="grid size-7 place-items-center rounded-full text-popover-foreground/55 outline-none transition-colors hover:bg-popover-foreground/[0.06] hover:text-popover-foreground focus-visible:ring-2 focus-visible:ring-ember/40"
			>
				<CaretLeftIcon
					weight="bold"
					className="size-4 rtl:-scale-x-100"
					aria-hidden
				/>
			</button>
			<span className="font-grotesk font-medium text-sm">{title}</span>
		</div>
	);
}

/**
 * The address step of "Clone website". It checks the address with
 * `publicWebAddressSchema`, so `website.shop.dz` also works. It gives the
 * full URL to `onConfirm`.
 */
function CloneStep({
	onBack,
	onConfirm,
}: {
	/** Shows the rows again. */
	onBack: () => void;
	/** Gets the checked address. The caller sets the tag and closes the menu. */
	onConfirm: (url: string) => void;
}) {
	const { t } = useTranslation();
	const [address, setAddress] = useState("");
	// True after a confirm with a bad address, until the user changes the field.
	const [isAddressRefused, setIsAddressRefused] = useState(false);
	// The footer holds the notice or the error, so the field points to it.
	const footerId = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	// The step opens from a pick, so the field takes the keys at once.
	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	return (
		<>
			<StepHeader
				title={t("appBuilder.chat.sourcesMenu.clone.title")}
				onBack={onBack}
			/>
			<form
				// The browser check of a `url` field shows its own text, so the footer shows the error.
				noValidate
				className="flex h-12 items-center gap-2.5 ps-4 pe-2"
				onSubmit={(event) => {
					event.preventDefault();
					// The same guard as the `capture_site` tool, so the agent gets no address that the tool refuses.
					const parsed = publicWebAddressSchema.safeParse(address);
					if (!parsed.success) {
						setIsAddressRefused(true);
						return;
					}
					onConfirm(parsed.data);
				}}
			>
				<LinkSimpleIcon
					weight="duotone"
					className="size-4 shrink-0 text-popover-foreground/55"
					aria-hidden
				/>
				<input
					type="url"
					ref={inputRef}
					dir="ltr"
					value={address}
					onChange={(event) => {
						setAddress(event.target.value);
						setIsAddressRefused(false);
					}}
					placeholder={t("appBuilder.chat.clone.urlPlaceholder")}
					aria-label={t("appBuilder.chat.clone.urlLabel")}
					aria-invalid={isAddressRefused}
					aria-describedby={footerId}
					autoComplete="off"
					autoCapitalize="none"
					spellCheck={false}
					className="h-full min-w-0 flex-1 bg-transparent font-sans text-[15px] text-popover-foreground outline-none placeholder:text-popover-foreground/40"
				/>
				<button
					type="submit"
					disabled={address.trim() === ""}
					aria-label={t("appBuilder.chat.clone.confirm")}
					// An empty field gives a flat grey button, as the panel pills do, so it reads as "not yet".
					className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground outline-none transition-colors hover:bg-ember-deep focus-visible:ring-2 focus-visible:ring-ember/40 disabled:bg-popover-foreground/10 disabled:text-popover-foreground/40 dark:hover:bg-primary/90"
				>
					<ArrowRightIcon
						weight="bold"
						className="size-4 rtl:-scale-x-100"
						aria-hidden
					/>
				</button>
			</form>
			<p
				id={footerId}
				// The footer shows the notice, or the error after a refused address.
				role={isAddressRefused ? "alert" : undefined}
				className={cn(
					"border-popover-foreground/[0.07] border-t px-4 py-2.5 font-sans text-[12px]",
					isAddressRefused ? "text-destructive" : "text-popover-foreground/50",
				)}
			>
				{t(
					isAddressRefused
						? "appBuilder.chat.clone.urlInvalid"
						: "appBuilder.chat.clone.notice",
				)}
			</p>
		</>
	);
}

/** The skill library step: one row per skill, with a check on a picked one. */
function SkillsStep({
	skills,
	onBack,
}: {
	skills: PromptSkills;
	/** Shows the rows again. */
	onBack: () => void;
}) {
	return (
		<>
			<StepHeader title={skills.title} onBack={onBack} />
			<CommandList>
				{skills.groups.map((group) => (
					<CommandGroup key={group.id} heading={group.label}>
						{group.skills.map((skill) => (
							<CommandItem
								key={skill.id}
								value={skill.id}
								aria-checked={skill.isSelected}
								onSelect={() => skills.onToggle(skill.id)}
								className="items-start"
							>
								<span className="flex min-w-0 flex-col">
									<span>{skill.label}</span>
									<span className="font-normal font-sans text-popover-foreground/50 text-xs leading-snug">
										{skill.hint}
									</span>
								</span>
								{skill.isSelected ? (
									<CheckIcon
										weight="bold"
										className="ms-auto size-4 shrink-0 text-primary"
										aria-hidden
									/>
								) : null}
							</CommandItem>
						))}
					</CommandGroup>
				))}
			</CommandList>
		</>
	);
}

/** The look of a tag: the brand accent on a soft tint, the same in the textarea and in a sent bubble. */
const TAG_CLASS =
	"inline-flex h-[22px] max-w-full items-center gap-0.5 rounded-[7px] bg-ember/[0.1] ps-1.5 font-grotesk font-medium text-[13px] text-ember-text leading-none dark:bg-spark/[0.12] dark:text-spark";

/** The read-only tag of a sent message. chat-message.tsx puts it before the text of the bubble. */
export function ActionTag({ action }: { action: BuilderTurnAction }) {
	const { t } = useTranslation();
	return (
		<span className={cn(TAG_CLASS, "pe-1.5")}>
			<span dir="auto" className="min-w-0 truncate">
				@{actionLabelOf(action, t)}
			</span>
		</span>
	);
}

/** Props of the tag inside the textarea. */
export type InlineActionTagProps = {
	action: BuilderTurnAction;
	/** The textarea of the caller. The tag sits on its first line and indents that line. */
	textareaRef: RefObject<HTMLTextAreaElement | null>;
	/** Clears the tag. A click on the tag calls it. */
	onRemove: () => void;
};

/**
 * The tag at the start of the textarea, as a button that removes it. Render
 * it next to the textarea, in the same positioned parent. It sets the
 * text-indent of the textarea to its own width, so the first line flows
 * after it. The caller gives the textarea no `dir="auto"` while a tag shows:
 * the tag and the indent then take the same side, also in Arabic.
 */
export function InlineActionTag({
	action,
	textareaRef,
	onRemove,
}: InlineActionTagProps) {
	const { t } = useTranslation();
	const tagRef = useRef<HTMLButtonElement>(null);
	const label = `@${actionLabelOf(action, t)}`;

	useLayoutEffect(() => {
		const textarea = textareaRef.current;
		const tag = tagRef.current;
		if (textarea === null || tag === null) return;
		// A textarea cannot hold an element, so the tag floats over its first line.
		const place = () => {
			const style = getComputedStyle(textarea);
			const paddingTop = Number.parseFloat(style.paddingTop);
			const lineHeight = Number.parseFloat(style.lineHeight);
			// "normal" parses to NaN: the tag then aligns to the padding edge.
			const centerOffset = Number.isNaN(lineHeight)
				? 0
				: (lineHeight - tag.offsetHeight) / 2;
			tag.style.top = `${textarea.offsetTop + paddingTop + centerOffset - textarea.scrollTop}px`;
			tag.style.left =
				style.direction === "rtl"
					? `${textarea.offsetLeft + textarea.offsetWidth - Number.parseFloat(style.paddingRight) - tag.offsetWidth}px`
					: `${textarea.offsetLeft + Number.parseFloat(style.paddingLeft)}px`;
			// Scrolled text leaves at the top edge. The tag must not cover the chips above it.
			tag.style.visibility =
				textarea.scrollTop > paddingTop ? "hidden" : "visible";
			textarea.style.textIndent = `${tag.offsetWidth + TAG_GAP_PX}px`;
		};
		place();
		// The tag width changes with its text. The textarea moves when the box
		// resizes, or when a chip row above it comes or goes: the parent then resizes.
		const observer = new ResizeObserver(place);
		observer.observe(tag);
		observer.observe(textarea);
		if (textarea.offsetParent !== null) observer.observe(textarea.offsetParent);
		textarea.addEventListener("scroll", place);
		return () => {
			observer.disconnect();
			textarea.removeEventListener("scroll", place);
			textarea.style.textIndent = "";
		};
	}, [textareaRef]);

	return (
		<button
			ref={tagRef}
			type="button"
			onClick={() => {
				onRemove();
				textareaRef.current?.focus();
			}}
			aria-label={t("appBuilder.chat.sourcesMenu.removeTag", { label })}
			className={cn(
				TAG_CLASS,
				"group/tag absolute z-10 pe-1 outline-none transition-colors hover:bg-ember/[0.16] focus-visible:ring-2 focus-visible:ring-ember/40 dark:focus-visible:ring-spark/40 dark:hover:bg-spark/[0.18]",
			)}
		>
			<span dir="auto" className="min-w-0 max-w-56 truncate">
				{label}
			</span>
			{/* The x keeps its room while hidden, so a hover does not move the text. */}
			<XIcon
				weight="bold"
				className="size-3 shrink-0 opacity-0 transition-opacity group-hover/tag:opacity-100 group-focus-visible/tag:opacity-100"
				aria-hidden
			/>
		</button>
	);
}
