import { projectPromptMaxLength } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItemBare,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@wandit/ui/components/dropdown-menu";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupTextarea,
} from "@wandit/ui/components/input-group";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@wandit/ui/components/toggle-group";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { cn } from "@wandit/ui/lib/utils";
import {
	Camera,
	Check,
	ChevronDown,
	Clapperboard,
	Globe2,
	ImageIcon,
	Languages,
	Loader2,
	type LucideIcon,
	Megaphone,
	Mic,
	ShoppingBag,
	Sparkles,
	WandSparkles,
} from "lucide-react";
import type * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { CREDIT_COSTS, PriceTag } from "@/features/credits";
import { useDictionary } from "@/lib/i18n";

export type PromptMode =
	| "sales-page"
	| "website"
	| "photos"
	| "ads"
	| "video"
	| "flyer";

type EngineId =
	| "auto"
	| "wandit-pages"
	| "gpt-image-2"
	| "nano-banana-pro"
	| "seedance-2"
	| "veo-3";

// Non-copy engine config: id + monogram. Labels/descriptions live in the
// `projects.promptBox.engines` dictionary namespace.
type EngineConfig = {
	id: EngineId;
	/** Two-char monogram call-sign; absent for Auto (which uses Sparkles). */
	mono?: string;
};

// Non-copy mode config: id + icon + engine list. Labels/placeholders live in
// the `projects.promptBox.modes` dictionary namespace.
type ModeConfig = {
	id: PromptMode;
	icon: LucideIcon;
	engines: readonly EngineConfig[];
};

const AUTO_ENGINE: EngineConfig = { id: "auto" };

const PAGE_ENGINES: readonly EngineConfig[] = [
	AUTO_ENGINE,
	{ id: "wandit-pages", mono: "WP" },
];

const IMAGE_ENGINES: readonly EngineConfig[] = [
	AUTO_ENGINE,
	{ id: "gpt-image-2", mono: "G2" },
	{ id: "nano-banana-pro", mono: "NB" },
];

const VIDEO_ENGINES: readonly EngineConfig[] = [
	AUTO_ENGINE,
	{ id: "seedance-2", mono: "S2" },
	{ id: "veo-3", mono: "V3" },
];

const MODES: readonly ModeConfig[] = [
	{ id: "sales-page", icon: ShoppingBag, engines: PAGE_ENGINES },
	{ id: "website", icon: Globe2, engines: PAGE_ENGINES },
	{ id: "photos", icon: Camera, engines: IMAGE_ENGINES },
	{ id: "ads", icon: Megaphone, engines: IMAGE_ENGINES },
	{ id: "video", icon: Clapperboard, engines: VIDEO_ENGINES },
	{ id: "flyer", icon: ImageIcon, engines: IMAGE_ENGINES },
];

/**
 * One row of the engine picker: leading tile (ember-gradient Sparkles for
 * Auto, mono call-sign otherwise), name + descriptor, trailing check. The
 * check stays in the tree at opacity-0 so rows never shift on selection.
 */
function EngineRow({ option }: { option: EngineConfig }) {
	const pb = useDictionary().projects.promptBox;
	const copy = pb.engines[option.id];
	const isAuto = option.id === AUTO_ENGINE.id;
	return (
		<DropdownMenuRadioItemBare
			value={option.id}
			className="data-[state=checked]:bg-primary/10"
		>
			<span
				aria-hidden
				className={cn(
					"flex size-7 shrink-0 items-center justify-center rounded-md transition-colors",
					isAuto
						? "bg-gradient-ember text-primary-foreground"
						: "bg-muted font-mono font-semibold text-[11px] text-muted-foreground group-data-[state=checked]/row:bg-primary/15 group-data-[state=checked]/row:text-primary",
				)}
			>
				{isAuto ? <Sparkles className="size-3.5" /> : option.mono}
			</span>
			<span className="flex min-w-0 flex-col">
				<span className="flex items-center gap-1.5 font-medium text-sm leading-tight">
					{copy.label}
					{isAuto ? (
						<span className="rounded-full bg-primary/10 px-1.5 py-px font-medium text-[10px] text-primary">
							{pb.engineAutoBadge}
						</span>
					) : null}
				</span>
				<span className="mt-0.5 truncate text-muted-foreground text-xs leading-snug">
					{copy.description}
				</span>
			</span>
			<Check className="ms-auto size-4 shrink-0 scale-90 text-primary opacity-0 transition-[opacity,transform] duration-150 group-data-[state=checked]/row:scale-100 group-data-[state=checked]/row:opacity-100" />
		</DropdownMenuRadioItemBare>
	);
}

export type PromptBoxProps = {
	/** A sync `false` return means nothing was sent (e.g. insufficient
	 * credits) — the box then keeps the draft even with clearOnSubmit. */
	// biome-ignore lint/suspicious/noConfusingVoidType: void keeps fire-and-forget callers assignable
	onSubmit: (prompt: string) => void | boolean | Promise<void | boolean>;
	variant?: "hero" | "compact";
	placeholder?: string;
	showPriceTag?: boolean;
	/** Tinted strip above the card (ai-chat-v2 style). */
	showBanner?: boolean;
	/** Creation-type chips below the card + per-mode advanced engine picker. */
	showModes?: boolean;
	isSubmitting?: boolean;
	initialValue?: string;
	/** Clear the textarea after submitting (chat-style usage). */
	clearOnSubmit?: boolean;
	className?: string;
};

/**
 * The ember prompt box — Wandit's signature element, shared verbatim by the
 * landing hero and the dashboard. Enter submits, Shift+Enter inserts a
 * newline; the textarea auto-grows; focus lights the ember-gradient ring.
 */
export function PromptBox({
	onSubmit,
	variant = "hero",
	placeholder,
	showPriceTag = false,
	showBanner = false,
	showModes = false,
	isSubmitting = false,
	initialValue = "",
	clearOnSubmit = false,
	className,
}: PromptBoxProps) {
	const pb = useDictionary().projects.promptBox;
	const [value, setValue] = useState(initialValue);
	const [mode, setMode] = useState<ModeConfig>(MODES[0]);
	const [engine, setEngine] = useState<EngineId>(AUTO_ENGINE.id);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const modeCopy = pb.modes[mode.id];
	const isHero = variant === "hero";
	const maxHeight = isHero ? 240 : 160;
	const canSubmit = value.trim().length > 0 && !isSubmitting;

	const resize = useCallback(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
	}, [maxHeight]);

	// Initial mount + variant change (typing resizes synchronously in
	// onChange); also re-measures after a programmatic clear (clearOnSubmit).
	// biome-ignore lint/correctness/useExhaustiveDependencies: value is an intentional re-measure trigger
	useEffect(() => {
		resize();
	}, [resize, value]);

	const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setValue(e.target.value);
		resize();
	};

	const handleSubmit = () => {
		const prompt = value.trim();
		if (!prompt || isSubmitting) return;
		const result = onSubmit(prompt);
		if (clearOnSubmit && result !== false) setValue("");
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	};

	const selectMode = (next: ModeConfig) => {
		setMode(next);
		setEngine(AUTO_ENGINE.id);
		textareaRef.current?.focus();
	};

	const selectedEngine =
		mode.engines.find((option) => option.id === engine) ?? AUTO_ENGINE;
	const selectedEngineCopy = pb.engines[selectedEngine.id];
	const isAutoEngine = selectedEngine.id === AUTO_ENGINE.id;
	// Every mode's engine list starts with Auto — split it out as the hero row.
	const [autoOption, ...engineOptions] = mode.engines;

	const handleModeValueChange = (nextModeId: string) => {
		const nextMode = MODES.find((item) => item.id === nextModeId);
		if (!nextMode) return;
		selectMode(nextMode);
	};

	const resolvedPlaceholder =
		placeholder ??
		(showModes
			? modeCopy.placeholder
			: isHero
				? pb.placeholderHero
				: pb.placeholderCompact);

	const box = (
		<div className="group/prompt relative">
			{/* Resting hairline border */}
			<div
				aria-hidden
				className="pointer-events-none absolute -inset-px rounded-[calc(1rem+1px)] bg-border"
			/>
			{/* Ember gradient ring + outer glow, revealed on focus */}
			<div
				aria-hidden
				className="pointer-events-none absolute -inset-[1.5px] rounded-[calc(1rem+2px)] bg-gradient-ember opacity-0 shadow-[0_0_20px_-2px_color-mix(in_oklab,var(--color-primary)_30%,transparent),0_8px_48px_-8px_color-mix(in_oklab,var(--color-primary)_25%,transparent)] transition-opacity duration-300 group-focus-within/prompt:opacity-100"
			/>
			{/* Content panel */}
			<InputGroup
				className="relative h-auto flex-col items-stretch rounded-2xl border-0 bg-card shadow-xs dark:bg-card dark:shadow-[inset_0_1px_0_0_oklch(1_0_0_/_0.04)]"
				data-disabled={isSubmitting}
			>
				<InputGroupTextarea
					ref={textareaRef}
					dir="auto"
					value={value}
					onChange={handleChange}
					onKeyDown={handleKeyDown}
					placeholder={resolvedPlaceholder}
					rows={1}
					maxLength={projectPromptMaxLength}
					disabled={isSubmitting}
					className={cn(
						"w-full overflow-y-auto py-0 text-foreground placeholder:text-muted-foreground/70 disabled:opacity-60",
						isHero
							? "min-h-[72px] px-5 pt-4 pb-1 text-base"
							: "min-h-11 px-4 pt-3 pb-1 text-sm",
					)}
				/>
				<InputGroupAddon
					align="block-end"
					className={cn(
						"flex w-full cursor-default items-end justify-between gap-2",
						isHero ? "px-4 pb-4" : "px-3 pb-3",
					)}
				>
					{showModes ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									type="button"
									variant="outline"
									size="sm"
									aria-label={`${pb.engineLabel} : ${selectedEngineCopy.label}`}
									className={cn(
										"group/trigger rounded-full shadow-none transition-colors duration-150",
										isAutoEngine
											? "bg-transparent text-muted-foreground hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground dark:bg-transparent"
											: "border-primary/35 bg-primary/10 text-foreground hover:bg-primary/15 data-[state=open]:bg-primary/15 dark:border-primary/40 dark:bg-primary/15",
									)}
								>
									{isAutoEngine ? (
										<Sparkles
											data-icon="inline-start"
											className="text-primary"
										/>
									) : (
										<span
											aria-hidden
											className="-ms-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-primary/15 font-mono font-semibold text-[9px] text-primary"
										>
											{selectedEngine.mono}
										</span>
									)}
									{isHero ? (
										<span className="text-muted-foreground">
											{pb.engineLabel}
											<span
												aria-hidden
												className="px-1 text-muted-foreground/50"
											>
												·
											</span>
										</span>
									) : null}
									<span
										className={cn(
											"truncate",
											isHero ? "max-w-32" : "max-w-28",
											!isAutoEngine && "font-medium",
										)}
									>
										{selectedEngineCopy.short}
									</span>
									<ChevronDown
										data-icon="inline-end"
										className="transition-transform duration-200 group-data-[state=open]/trigger:rotate-180"
									/>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="start"
								sideOffset={8}
								collisionPadding={12}
								className="w-80 max-w-[calc(100vw-1.5rem)] rounded-xl border-border/80 p-1.5 shadow-[0_12px_40px_-12px_color-mix(in_oklab,var(--color-primary)_14%,transparent),0_8px_24px_-12px_rgb(0_0_0/0.14)] dark:shadow-[inset_0_1px_0_0_oklch(1_0_0/0.05),0_16px_48px_-16px_rgb(0_0_0/0.6)]"
							>
								{/* Mono eyebrow + mode-context chip: says why the list differs per mode */}
								<div className="flex items-center justify-between gap-2 px-2 pt-1 pb-1.5">
									<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
										{pb.engineLabel}
									</span>
									<span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
										<mode.icon className="size-3" aria-hidden />
										{modeCopy.label}
									</span>
								</div>
								<DropdownMenuRadioGroup
									value={engine}
									onValueChange={(next) => setEngine(next as EngineId)}
								>
									<EngineRow option={autoOption} />
									<DropdownMenuSeparator className="my-1 bg-border/70" />
									{engineOptions.map((option) => (
										<EngineRow key={option.id} option={option} />
									))}
								</DropdownMenuRadioGroup>
								{/* Footer band bleeds to the panel edge (-mx/-mb cancel p-1.5) */}
								<div className="-mx-1.5 mt-1 -mb-1.5 rounded-b-xl border-border/60 border-t bg-muted/40 px-3 py-2">
									<p className="text-[11px] text-muted-foreground leading-snug">
										{pb.engineResetHint}
									</p>
								</div>
							</DropdownMenuContent>
						</DropdownMenu>
					) : (
						<span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground">
							<Languages className="size-3 shrink-0" aria-hidden />
							{pb.hint}
						</span>
					)}
					<div className="flex items-center gap-2">
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										type="button"
										variant="outline"
										size="icon"
										aria-label={pb.micLabel}
										className={cn(
											"rounded-full",
											isHero ? "size-10" : "size-9",
										)}
									>
										<Mic />
									</Button>
								</TooltipTrigger>
								<TooltipContent>{pb.micLabel}</TooltipContent>
							</Tooltip>
						</TooltipProvider>
						{showPriceTag ? (
							<Button
								type="button"
								onClick={handleSubmit}
								disabled={!canSubmit}
								className={cn(
									"rounded-full shadow-[0_4px_16px_-4px_color-mix(in_oklab,var(--color-primary)_50%,transparent)]",
									isHero ? "h-10 px-4" : "h-9 px-3.5",
								)}
							>
								{isSubmitting ? (
									<Loader2 data-icon="inline-start" className="animate-spin" />
								) : (
									<WandSparkles data-icon="inline-start" />
								)}
								{pb.generate}
								<span aria-hidden className="text-primary-foreground/70">
									—
								</span>
								<PriceTag
									cost={CREDIT_COSTS.generation}
									className="text-primary-foreground/85"
								/>
							</Button>
						) : (
							<Button
								type="button"
								size="icon"
								aria-label={pb.submitLabel}
								onClick={handleSubmit}
								disabled={!canSubmit}
								className={cn(
									"rounded-full shadow-[0_4px_16px_-4px_color-mix(in_oklab,var(--color-primary)_50%,transparent)]",
									isHero ? "size-10" : "size-9",
								)}
							>
								{isSubmitting ? (
									<Loader2 className="animate-spin" />
								) : (
									<WandSparkles />
								)}
							</Button>
						)}
					</div>
				</InputGroupAddon>
			</InputGroup>
		</div>
	);

	return (
		<div className={className}>
			{showBanner ? (
				<div className="rounded-[1.25rem] bg-primary/10 p-1 pt-0">
					<div className="flex items-center gap-1.5 px-4 py-2 text-muted-foreground text-xs">
						<Sparkles className="size-3 text-primary" />
						{pb.banner}
					</div>
					{box}
				</div>
			) : (
				box
			)}
			{showModes ? (
				<div className="mt-3 flex justify-center">
					<ToggleGroup
						type="single"
						value={mode.id}
						onValueChange={handleModeValueChange}
						variant="outline"
						size="sm"
						spacing={2}
						className="flex-wrap justify-center"
						aria-label={pb.creationTypeLabel}
					>
						{MODES.map((item) => (
							<ToggleGroupItem
								key={item.id}
								value={item.id}
								aria-label={pb.modes[item.id].label}
								className="rounded-full border-border bg-card/50 px-3 aria-pressed:border-primary/50 aria-pressed:bg-primary/10 aria-pressed:text-foreground"
							>
								<item.icon data-icon="inline-start" />
								{pb.modes[item.id].label}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</div>
			) : null}
		</div>
	);
}
