import { projectPromptMaxLength } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItemBare,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@wandit/ui/components/dropdown-menu";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupTextarea,
} from "@wandit/ui/components/input-group";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { cn } from "@wandit/ui/lib/utils";
import {
	ArrowUp,
	BadgeCheck,
	Brush,
	Captions,
	Check,
	ChevronDown,
	Clapperboard,
	FileText,
	ImageIcon,
	Loader2,
	type LucideIcon,
	Megaphone,
	Mic,
	Paperclip,
	Plus,
	SearchCheck,
	ShieldCheck,
	SlidersHorizontal,
	Sparkles,
	Target,
	WandSparkles,
	X,
} from "lucide-react";
import type * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CREDIT_COSTS, PriceTag } from "@/features/credits";
import { useDictionary, useTranslation } from "@/lib/i18n";

type RouteMode = "auto" | "page" | "marketing" | "image" | "video";
type ConcreteMode = Exclude<RouteMode, "auto">;

// Non-copy option config: ids + layout. Group labels and choice labels live in
// the `projects.promptBox.outputs.<id>.options` dictionary namespace.
type Choice = {
	id: string;
};

type OptionGroup = {
	id: string;
	choices: readonly Choice[];
	layout?: "grid" | "compact";
};

// Non-copy route-mode config: id + icon. Label/description/placeholder live in
// the `projects.promptBox.routeModes` dictionary namespace.
type RouteModeDef = {
	id: RouteMode;
	icon: LucideIcon;
};

type SkillFileId =
	| "accessibility"
	| "redesign"
	| "seo-review"
	| "cod-algeria"
	| "brand-voice"
	| "direct-response"
	| "premium-visuals";

type SkillGroupId = "review" | "market";

// Non-copy skill config: id + fileName + icon. Label/description live in the
// `projects.promptBox.skills` dictionary namespace.
type SkillFileDef = {
	id: SkillFileId;
	fileName: string;
	icon: LucideIcon;
};

type SkillFileGroup = {
	id: SkillGroupId;
	skills: readonly SkillFileDef[];
};

type GenerationOutputId =
	| "landing-page"
	| "page-edit"
	| "html-section"
	| "ad-copy"
	| "marketing-strategy"
	| "video-script"
	| "creative-brief"
	| "html-asset"
	| "image-creator"
	| "product-shot"
	| "ad-creative"
	| "background-edit"
	| "video-creator"
	| "ugc-video"
	| "product-demo";

// Non-copy output config: id + mode + icon + option groups. Label/shortLabel/
// description/placeholder + option copy live in the
// `projects.promptBox.outputs` dictionary namespace.
type GenerationOutputDef = {
	id: GenerationOutputId;
	mode: ConcreteMode;
	icon: LucideIcon;
	options: readonly OptionGroup[];
};

// Shape of the localized option copy read via useDictionary(); ids are matched
// against the non-copy config above so ordering stays in code.
type OptionCopy = { label: string; choices: Record<string, string> };

const ROUTE_MODES: readonly RouteModeDef[] = [
	{ id: "auto", icon: Sparkles },
	{ id: "page", icon: FileText },
	{ id: "marketing", icon: Megaphone },
	{ id: "image", icon: ImageIcon },
	{ id: "video", icon: Clapperboard },
];

const SKILL_FILE_GROUPS: readonly SkillFileGroup[] = [
	{
		id: "review",
		skills: [
			{ id: "accessibility", fileName: "accessibility.md", icon: ShieldCheck },
			{ id: "seo-review", fileName: "seo-review.md", icon: SearchCheck },
			{ id: "redesign", fileName: "redesign.md", icon: Brush },
		],
	},
	{
		id: "market",
		skills: [
			{ id: "cod-algeria", fileName: "cod-algeria.md", icon: Target },
			{ id: "brand-voice", fileName: "brand-voice.md", icon: Captions },
			{
				id: "direct-response",
				fileName: "direct-response.md",
				icon: BadgeCheck,
			},
			{
				id: "premium-visuals",
				fileName: "premium-visuals.md",
				icon: ImageIcon,
			},
		],
	},
];

const OUTPUTS_BY_MODE: Record<ConcreteMode, readonly GenerationOutputDef[]> = {
	page: [
		{
			id: "landing-page",
			mode: "page",
			icon: FileText,
			options: [
				{
					id: "goal",
					choices: [
						{ id: "cod" },
						{ id: "leads" },
						{ id: "promo" },
						{ id: "service" },
					],
				},
				{
					id: "language",
					choices: [
						{ id: "auto" },
						{ id: "arabic" },
						{ id: "french" },
						{ id: "ar-fr" },
					],
				},
				{
					id: "shape",
					choices: [{ id: "landing" }, { id: "product" }, { id: "service" }],
				},
			],
		},
		{
			id: "page-edit",
			mode: "page",
			icon: Brush,
			options: [
				{
					id: "scope",
					choices: [
						{ id: "hero" },
						{ id: "offer" },
						{ id: "form" },
						{ id: "full" },
					],
				},
				{
					id: "intensity",
					choices: [{ id: "light" }, { id: "medium" }, { id: "rewrite" }],
				},
			],
		},
		{
			id: "html-section",
			mode: "page",
			icon: FileText,
			options: [
				{
					id: "section",
					choices: [
						{ id: "comparison" },
						{ id: "faq" },
						{ id: "testimonials" },
						{ id: "offer" },
					],
				},
				{
					id: "style",
					choices: [{ id: "match" }, { id: "clean" }, { id: "direct" }],
				},
			],
		},
	],
	marketing: [
		{
			id: "ad-copy",
			mode: "marketing",
			icon: BadgeCheck,
			options: [
				{
					id: "platform",
					choices: [
						{ id: "meta" },
						{ id: "tiktok" },
						{ id: "google" },
						{ id: "whatsapp" },
					],
				},
				{
					id: "variants",
					choices: [{ id: "3" }, { id: "5" }, { id: "10" }],
					layout: "compact",
				},
				{
					id: "angle",
					choices: [
						{ id: "auto" },
						{ id: "pain" },
						{ id: "offer" },
						{ id: "proof" },
						{ id: "urgency" },
					],
				},
				{
					id: "length",
					choices: [{ id: "short" }, { id: "medium" }],
					layout: "compact",
				},
			],
		},
		{
			id: "marketing-strategy",
			mode: "marketing",
			icon: Target,
			options: [
				{
					id: "strategy",
					choices: [
						{ id: "launch" },
						{ id: "campaign" },
						{ id: "offer" },
						{ id: "audit" },
					],
				},
				{
					id: "channel",
					choices: [
						{ id: "auto" },
						{ id: "meta" },
						{ id: "tiktok" },
						{ id: "whatsapp" },
					],
				},
				{
					id: "depth",
					choices: [{ id: "quick" }, { id: "detailed" }],
					layout: "compact",
				},
			],
		},
		{
			id: "video-script",
			mode: "marketing",
			icon: Captions,
			options: [
				{
					id: "format",
					choices: [
						{ id: "ugc" },
						{ id: "demo" },
						{ id: "problem" },
						{ id: "testimonial" },
					],
				},
				{
					id: "duration",
					choices: [{ id: "15" }, { id: "30" }, { id: "60" }],
					layout: "compact",
				},
				{
					id: "detail",
					choices: [
						{ id: "hook" },
						{ id: "voiceover" },
						{ id: "shots" },
						{ id: "cta" },
					],
				},
			],
		},
		{
			id: "creative-brief",
			mode: "marketing",
			icon: FileText,
			options: [
				{
					id: "channel",
					choices: [{ id: "meta" }, { id: "tiktok" }, { id: "mixed" }],
				},
				{
					id: "depth",
					choices: [{ id: "simple" }, { id: "detailed" }],
					layout: "compact",
				},
			],
		},
		{
			id: "html-asset",
			mode: "marketing",
			icon: FileText,
			options: [
				{
					id: "asset",
					choices: [
						{ id: "comparison" },
						{ id: "one-pager" },
						{ id: "faq" },
						{ id: "offer" },
					],
				},
				{
					id: "format",
					choices: [{ id: "standalone" }, { id: "embed" }],
					layout: "compact",
				},
			],
		},
	],
	image: [
		{
			id: "image-creator",
			mode: "image",
			icon: ImageIcon,
			options: [
				{
					id: "quality",
					choices: [
						{ id: "auto" },
						{ id: "high" },
						{ id: "medium" },
						{ id: "low" },
					],
				},
				{
					id: "size",
					choices: [
						{ id: "1-1" },
						{ id: "3-2" },
						{ id: "2-3" },
						{ id: "4-3" },
						{ id: "9-16" },
						{ id: "16-9" },
					],
					layout: "grid",
				},
				{
					id: "count",
					choices: [{ id: "1" }, { id: "2" }, { id: "4" }, { id: "8" }],
				},
			],
		},
		{
			id: "product-shot",
			mode: "image",
			icon: ImageIcon,
			options: [
				{
					id: "scene",
					choices: [
						{ id: "studio" },
						{ id: "lifestyle" },
						{ id: "packshot" },
						{ id: "before-after" },
					],
				},
				{
					id: "size",
					choices: [
						{ id: "1-1" },
						{ id: "4-5" },
						{ id: "9-16" },
						{ id: "16-9" },
					],
				},
			],
		},
		{
			id: "ad-creative",
			mode: "image",
			icon: Megaphone,
			options: [
				{
					id: "platform",
					choices: [
						{ id: "meta" },
						{ id: "tiktok" },
						{ id: "story" },
						{ id: "display" },
					],
				},
				{
					id: "text",
					choices: [{ id: "none" }, { id: "light" }, { id: "offer" }],
				},
				{
					id: "count",
					choices: [{ id: "1" }, { id: "3" }, { id: "5" }],
					layout: "compact",
				},
			],
		},
		{
			id: "background-edit",
			mode: "image",
			icon: Brush,
			options: [
				{
					id: "background",
					choices: [
						{ id: "studio" },
						{ id: "premium" },
						{ id: "home" },
						{ id: "outdoor" },
					],
				},
				{
					id: "preserve",
					choices: [{ id: "product" }, { id: "lighting" }, { id: "shadow" }],
				},
			],
		},
	],
	video: [
		{
			id: "video-creator",
			mode: "video",
			icon: Clapperboard,
			options: [
				{
					id: "method",
					choices: [{ id: "reference" }, { id: "edit" }, { id: "frames" }],
				},
				{
					id: "size",
					choices: [
						{ id: "auto" },
						{ id: "16-9" },
						{ id: "4-3" },
						{ id: "1-1" },
						{ id: "9-16" },
						{ id: "21-9" },
					],
					layout: "grid",
				},
				{
					id: "resolution",
					choices: [{ id: "720" }, { id: "1080" }, { id: "4k" }],
				},
				{
					id: "duration",
					choices: [{ id: "4" }, { id: "5" }, { id: "8" }, { id: "10" }],
				},
			],
		},
		{
			id: "ugc-video",
			mode: "video",
			icon: Captions,
			options: [
				{
					id: "structure",
					choices: [{ id: "problem" }, { id: "demo" }, { id: "testimonial" }],
				},
				{
					id: "duration",
					choices: [{ id: "15" }, { id: "30" }, { id: "45" }],
					layout: "compact",
				},
			],
		},
		{
			id: "product-demo",
			mode: "video",
			icon: Clapperboard,
			options: [
				{
					id: "pace",
					choices: [{ id: "fast" }, { id: "balanced" }, { id: "slow" }],
				},
				{
					id: "ratio",
					choices: [{ id: "9-16" }, { id: "1-1" }, { id: "16-9" }],
				},
			],
		},
	],
};

const ALL_SKILL_FILES = SKILL_FILE_GROUPS.flatMap((group) => group.skills);
const ALL_OUTPUTS = Object.values(OUTPUTS_BY_MODE).flat();

function getMode(id: RouteMode) {
	return ROUTE_MODES.find((mode) => mode.id === id) ?? ROUTE_MODES[0];
}

function getSkillFile(id: SkillFileId) {
	return ALL_SKILL_FILES.find((skill) => skill.id === id);
}

function getOutput(id: GenerationOutputId | null) {
	return ALL_OUTPUTS.find((output) => output.id === id) ?? null;
}

function getDefaultOutput(mode: RouteMode) {
	if (mode === "auto") return null;
	return OUTPUTS_BY_MODE[mode][0] ?? null;
}

function createDefaultOptions(output: GenerationOutputDef) {
	return Object.fromEntries(
		output.options.map((group) => [group.id, group.choices[0]?.id ?? ""]),
	);
}

function IconTile({
	icon: Icon,
	active = false,
}: {
	icon: LucideIcon;
	active?: boolean;
}) {
	return (
		<span
			aria-hidden
			className={cn(
				"flex size-7 shrink-0 items-center justify-center rounded-lg border transition-colors",
				active
					? "border-primary/30 bg-primary/10 text-primary"
					: "border-border/70 bg-muted/60 text-muted-foreground",
			)}
		>
			<Icon className="size-3.5" />
		</span>
	);
}

function SkillFileRows({
	selectedIds,
	onToggleSkill,
}: {
	selectedIds: readonly SkillFileId[];
	onToggleSkill: (skill: SkillFileDef) => void;
}) {
	const pb = useDictionary().projects.promptBox;
	return (
		<>
			{SKILL_FILE_GROUPS.map((group, groupIndex) => (
				<div key={group.id}>
					{groupIndex > 0 ? (
						<DropdownMenuSeparator className="my-1 bg-border/70" />
					) : null}
					<DropdownMenuLabel className="px-2 pt-2 pb-1 font-mono font-normal text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
						{pb.skillGroups[group.id].label}
					</DropdownMenuLabel>
					{group.skills.map((skill) => {
						const selected = selectedIds.includes(skill.id);
						const skillCopy = pb.skills[skill.id];
						return (
							<DropdownMenuItem
								key={skill.id}
								className="items-start gap-2.5 rounded-lg px-2 py-2"
								onSelect={() => onToggleSkill(skill)}
							>
								<IconTile icon={skill.icon} active={selected} />
								<span className="min-w-0">
									<span className="flex items-center gap-2 font-medium text-sm leading-tight">
										{skillCopy.label}
										<span className="font-mono text-[10px] text-muted-foreground">
											{skill.fileName}
										</span>
									</span>
									<span className="mt-0.5 block text-muted-foreground text-xs leading-snug">
										{skillCopy.description}
									</span>
								</span>
								<Check
									className={cn(
										"ms-auto size-4 shrink-0 text-primary transition-opacity",
										selected ? "opacity-100" : "opacity-0",
									)}
								/>
							</DropdownMenuItem>
						);
					})}
				</div>
			))}
		</>
	);
}

function AddContextMenu({
	selectedSkillIds,
	onToggleSkill,
	isHero,
}: {
	selectedSkillIds: readonly SkillFileId[];
	onToggleSkill: (skill: SkillFileDef) => void;
	isHero: boolean;
}) {
	const { t } = useTranslation();
	const addMenuLabel = t("projects.promptBox.addMenuLabel");
	return (
		<DropdownMenu>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<Button
							type="button"
							variant="outline"
							size="icon-sm"
							aria-label={addMenuLabel}
							className={cn(
								"rounded-full border-border/80 bg-background/70 text-muted-foreground shadow-none transition-[transform,color,background-color,border-color] duration-200 hover:border-primary/30 hover:bg-primary/10 hover:text-foreground active:translate-y-px",
								isHero ? "size-9" : "size-8",
							)}
						>
							<Plus className="size-4" />
						</Button>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent>{addMenuLabel}</TooltipContent>
			</Tooltip>
			<DropdownMenuContent
				align="start"
				sideOffset={8}
				collisionPadding={12}
				className="w-64 rounded-2xl border-border/80 p-1.5 shadow-[0_18px_50px_-24px_rgb(0_0_0/0.36)]"
			>
				<DropdownMenuSub>
					<DropdownMenuSubTrigger className="rounded-xl px-2 py-2">
						<WandSparkles className="size-4 text-primary" />
						<span>{t("projects.promptBox.addSkillLabel")}</span>
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent
						sideOffset={10}
						className="w-[22rem] max-w-[calc(100vw-1.5rem)] rounded-2xl border-border/80 p-1.5 shadow-[0_18px_50px_-24px_rgb(0_0_0/0.36)]"
					>
						<div className="flex items-center justify-between px-2 pt-1 pb-1.5">
							<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
								{t("projects.promptBox.skillLibraryLabel")}
							</span>
						</div>
						<SkillFileRows
							selectedIds={selectedSkillIds}
							onToggleSkill={onToggleSkill}
						/>
					</DropdownMenuSubContent>
				</DropdownMenuSub>
				<DropdownMenuItem
					className="rounded-xl px-2 py-2"
					onSelect={(event) => event.preventDefault()}
				>
					<Paperclip className="size-4" />
					<span className="flex min-w-0 flex-col">
						<span>{t("projects.promptBox.attachLabel")}</span>
						<span className="truncate text-muted-foreground text-xs">
							{t("projects.promptBox.attachHint")}
						</span>
					</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function AttachedSkillChips({
	skills,
	onRemove,
}: {
	skills: readonly SkillFileDef[];
	onRemove: (id: SkillFileId) => void;
}) {
	const { t } = useTranslation();
	const pb = useDictionary().projects.promptBox;
	if (skills.length === 0) return null;

	return (
		<div className="flex flex-wrap gap-1.5 px-4 pt-3 sm:px-5">
			{skills.map((skill) => {
				const SkillIcon = skill.icon;
				const label = pb.skills[skill.id].label;
				return (
					<span
						key={skill.id}
						className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 text-foreground text-xs"
					>
						<SkillIcon className="size-3.5 shrink-0 text-primary" />
						<span className="truncate">{label}</span>
						<span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
							{skill.fileName}
						</span>
						<button
							type="button"
							aria-label={t("projects.promptBox.removeSkillLabel", {
								name: label,
							})}
							onClick={() => onRemove(skill.id)}
							className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
						>
							<X className="size-3" />
						</button>
					</span>
				);
			})}
		</div>
	);
}

function ModePicker({
	value,
	onValueChange,
	isHero,
}: {
	value: RouteMode;
	onValueChange: (mode: RouteMode) => void;
	isHero: boolean;
}) {
	const { t } = useTranslation();
	const pb = useDictionary().projects.promptBox;
	const selectedMode = getMode(value);
	const SelectedIcon = selectedMode.icon;
	const selectedModeCopy = pb.routeModes[value];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					aria-label={`${t("projects.promptBox.modeLabel")}: ${selectedModeCopy.label}`}
					className={cn(
						"group/trigger rounded-full border-border/75 bg-background/55 text-muted-foreground shadow-none transition-colors hover:border-primary/25 hover:bg-accent/70 hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground",
						isHero ? "h-9" : "h-8",
					)}
				>
					<SelectedIcon className="size-3.5 text-primary" />
					<span className="max-w-24 truncate">{selectedModeCopy.label}</span>
					<ChevronDown className="size-3.5 transition-transform duration-200 group-data-[state=open]/trigger:rotate-180" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				sideOffset={8}
				collisionPadding={12}
				className="w-72 rounded-2xl border-border/80 p-1.5 shadow-[0_18px_50px_-24px_rgb(0_0_0/0.36)]"
			>
				<DropdownMenuLabel className="px-2 pt-1 pb-1.5 font-mono font-normal text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
					{t("projects.promptBox.modeLabel")}
				</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={value}
					onValueChange={(next) => onValueChange(next as RouteMode)}
				>
					{ROUTE_MODES.map((mode) => {
						const modeCopy = pb.routeModes[mode.id];
						return (
							<DropdownMenuRadioItemBare
								key={mode.id}
								value={mode.id}
								className="data-[state=checked]:bg-primary/10"
							>
								<IconTile icon={mode.icon} active={value === mode.id} />
								<span className="min-w-0">
									<span className="block font-medium text-sm leading-tight">
										{modeCopy.label}
									</span>
									<span className="mt-0.5 block text-muted-foreground text-xs leading-snug">
										{modeCopy.description}
									</span>
								</span>
								<Check className="ms-auto size-4 shrink-0 scale-90 text-primary opacity-0 transition-[opacity,transform] group-data-[state=checked]/row:scale-100 group-data-[state=checked]/row:opacity-100" />
							</DropdownMenuRadioItemBare>
						);
					})}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function OutputPicker({
	mode,
	output,
	onSelectOutput,
	isHero,
}: {
	mode: RouteMode;
	output: GenerationOutputDef | null;
	onSelectOutput: (output: GenerationOutputDef) => void;
	isHero: boolean;
}) {
	const { t } = useTranslation();
	const pb = useDictionary().projects.promptBox;
	if (mode === "auto" || !output) return null;
	const OutputIcon = output.icon;
	const outputs = OUTPUTS_BY_MODE[mode];
	const outputCopy = pb.outputs[output.id];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					aria-label={`${t("projects.promptBox.outputLabel")}: ${outputCopy.label}`}
					className={cn(
						"group/trigger rounded-full border-primary/30 bg-primary/10 text-foreground shadow-none transition-colors hover:bg-primary/15 data-[state=open]:bg-primary/15",
						isHero ? "h-9" : "h-8",
					)}
				>
					<OutputIcon className="size-3.5 text-primary" />
					<span className="max-w-32 truncate font-medium">
						{outputCopy.shortLabel}
					</span>
					<ChevronDown className="size-3.5 transition-transform duration-200 group-data-[state=open]/trigger:rotate-180" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				sideOffset={8}
				collisionPadding={12}
				className="w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl border-border/80 p-1.5 shadow-[0_18px_50px_-24px_rgb(0_0_0/0.36)]"
			>
				<DropdownMenuLabel className="px-2 pt-1 pb-1.5 font-mono font-normal text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
					{t("projects.promptBox.outputsHeading", {
						mode: pb.routeModes[mode].label,
					})}
				</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={output.id}
					onValueChange={(next) => {
						const nextOutput = getOutput(next as GenerationOutputId);
						if (nextOutput) onSelectOutput(nextOutput);
					}}
				>
					{outputs.map((item) => {
						const itemCopy = pb.outputs[item.id];
						return (
							<DropdownMenuRadioItemBare
								key={item.id}
								value={item.id}
								className="data-[state=checked]:bg-primary/10"
							>
								<IconTile icon={item.icon} active={item.id === output.id} />
								<span className="min-w-0">
									<span className="block font-medium text-sm leading-tight">
										{itemCopy.label}
									</span>
									<span className="mt-0.5 block text-muted-foreground text-xs leading-snug">
										{itemCopy.description}
									</span>
								</span>
								<Check className="ms-auto size-4 shrink-0 scale-90 text-primary opacity-0 transition-[opacity,transform] group-data-[state=checked]/row:scale-100 group-data-[state=checked]/row:opacity-100" />
							</DropdownMenuRadioItemBare>
						);
					})}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function OutputSettings({
	output,
	values,
	onValueChange,
	isHero,
}: {
	output: GenerationOutputDef | null;
	values: Record<string, string>;
	onValueChange: (groupId: string, choiceId: string) => void;
	isHero: boolean;
}) {
	const { t } = useTranslation();
	const pb = useDictionary().projects.promptBox;
	if (!output) return null;
	const OutputIcon = output.icon;
	const outputCopy = pb.outputs[output.id];
	const optionsCopy = outputCopy.options as unknown as Record<
		string,
		OptionCopy
	>;
	const modeLabel = pb.routeModes[output.mode].label;

	return (
		<DropdownMenu>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<Button
							type="button"
							variant="outline"
							size="icon-sm"
							aria-label={t("projects.promptBox.settingsLabel")}
							className={cn(
								"rounded-full border-border/75 bg-background/55 text-muted-foreground shadow-none transition-colors hover:border-primary/25 hover:bg-accent/70 hover:text-foreground data-[state=open]:border-primary/30 data-[state=open]:bg-primary/10 data-[state=open]:text-foreground",
								isHero ? "size-9" : "size-8",
							)}
						>
							<SlidersHorizontal className="size-4" />
						</Button>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent>{t("projects.promptBox.settingsLabel")}</TooltipContent>
			</Tooltip>
			<DropdownMenuContent
				align="start"
				sideOffset={8}
				collisionPadding={12}
				className="w-[22rem] max-w-[calc(100vw-1.5rem)] rounded-2xl border-border/80 p-0 shadow-[0_22px_70px_-28px_rgb(0_0_0/0.42)]"
			>
				<div className="border-border/70 border-b px-4 py-3">
					<div className="flex items-center gap-2">
						<IconTile icon={OutputIcon} active />
						<div className="min-w-0">
							<p className="font-medium text-sm leading-tight">
								{outputCopy.label}
							</p>
							<p className="mt-0.5 text-muted-foreground text-xs">
								{t("projects.promptBox.settingsSubtitle", {
									mode: modeLabel.toLowerCase(),
								})}
							</p>
						</div>
					</div>
				</div>
				<div className="space-y-4 p-4">
					{output.options.map((group) => {
						const groupCopy = optionsCopy[group.id];
						return (
							<div key={group.id}>
								<p className="mb-2 text-muted-foreground text-xs">
									{groupCopy.label}
								</p>
								<div
									className={cn(
										"grid gap-2",
										group.layout === "grid"
											? "grid-cols-3"
											: group.layout === "compact"
												? "grid-cols-4"
												: "grid-cols-2",
									)}
								>
									{group.choices.map((choice) => {
										const selected = values[group.id] === choice.id;
										return (
											<button
												key={choice.id}
												type="button"
												onClick={() => onValueChange(group.id, choice.id)}
												className={cn(
													"min-h-9 rounded-xl border px-3 py-2 text-center text-xs transition-[transform,color,background-color,border-color] duration-200 active:translate-y-px",
													selected
														? "border-primary/35 bg-primary/10 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]"
														: "border-border/80 bg-background/60 text-muted-foreground hover:border-primary/25 hover:bg-accent/70 hover:text-foreground",
													group.layout === "grid" && "min-h-14",
												)}
											>
												{groupCopy.choices[choice.id]}
											</button>
										);
									})}
								</div>
							</div>
						);
					})}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export type PromptBoxProps = {
	/** A sync `false` return means nothing was sent (e.g. insufficient
	 * credits) - the box then keeps the draft even with clearOnSubmit. */
	// biome-ignore lint/suspicious/noConfusingVoidType: void keeps fire-and-forget callers assignable
	onSubmit: (prompt: string) => void | boolean | Promise<void | boolean>;
	variant?: "hero" | "compact";
	placeholder?: string;
	/** Show the generation cost as a quiet mono tag next to the actions. */
	showPriceTag?: boolean;
	/** Tinted strip above the card (ai-chat-v2 style). */
	showBanner?: boolean;
	/** Legacy prop kept for call sites; the composer always exposes modes. */
	showModes?: boolean;
	/** Legacy prop kept for call sites; model selection is not shown for pages. */
	showEngines?: boolean;
	isSubmitting?: boolean;
	initialValue?: string;
	/** Clear the textarea after submitting (chat-style usage). */
	clearOnSubmit?: boolean;
	className?: string;
};

export function PromptBox({
	onSubmit,
	variant = "hero",
	placeholder,
	showPriceTag = false,
	showBanner = false,
	isSubmitting = false,
	initialValue = "",
	clearOnSubmit = false,
	className,
}: PromptBoxProps) {
	const { t } = useTranslation();
	const pb = useDictionary().projects.promptBox;
	const [value, setValue] = useState(initialValue);
	const [routeMode, setRouteMode] = useState<RouteMode>("auto");
	const [selectedOutputId, setSelectedOutputId] =
		useState<GenerationOutputId | null>(null);
	const [outputOptions, setOutputOptions] = useState<Record<string, string>>(
		{},
	);
	const [selectedSkillIds, setSelectedSkillIds] = useState<SkillFileId[]>([]);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const isHero = variant === "hero";
	const maxHeight = isHero ? 240 : 160;
	const canSubmit = value.trim().length > 0 && !isSubmitting;
	const selectedOutput = useMemo(
		() => getOutput(selectedOutputId),
		[selectedOutputId],
	);
	const attachedSkills = useMemo(
		() =>
			selectedSkillIds
				.map((id) => getSkillFile(id))
				.filter((skill): skill is SkillFileDef => Boolean(skill)),
		[selectedSkillIds],
	);

	const resize = useCallback(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
	}, [maxHeight]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: value is an intentional re-measure trigger
	useEffect(() => {
		resize();
	}, [resize, value, attachedSkills.length]);

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

	const selectOutput = (output: GenerationOutputDef) => {
		setRouteMode(output.mode);
		setSelectedOutputId(output.id);
		setOutputOptions(createDefaultOptions(output));
		textareaRef.current?.focus();
	};

	const handleModeChange = (mode: RouteMode) => {
		setRouteMode(mode);
		const defaultOutput = getDefaultOutput(mode);
		setSelectedOutputId(defaultOutput?.id ?? null);
		setOutputOptions(defaultOutput ? createDefaultOptions(defaultOutput) : {});
		textareaRef.current?.focus();
	};

	const toggleSkillFile = (skill: SkillFileDef) => {
		setSelectedSkillIds((current) =>
			current.includes(skill.id)
				? current.filter((id) => id !== skill.id)
				: [...current, skill.id],
		);
		textareaRef.current?.focus();
	};

	const removeSkillFile = (id: SkillFileId) => {
		setSelectedSkillIds((current) => current.filter((item) => item !== id));
		textareaRef.current?.focus();
	};

	const updateOutputOption = (groupId: string, choiceId: string) => {
		setOutputOptions((current) => ({ ...current, [groupId]: choiceId }));
	};

	const resolvedPlaceholder =
		placeholder ??
		(selectedOutput ? pb.outputs[selectedOutput.id].placeholder : undefined) ??
		(isHero ? pb.routeModes[routeMode].placeholder : pb.placeholderCompact);

	const box = (
		<div className="group/prompt relative">
			<div
				aria-hidden
				className="pointer-events-none absolute -inset-px rounded-[calc(1rem+1px)] bg-border"
			/>
			<div
				aria-hidden
				className="pointer-events-none absolute -inset-[1.5px] rounded-[calc(1rem+2px)] bg-gradient-ember opacity-0 shadow-[0_0_20px_-2px_color-mix(in_oklab,var(--color-primary)_30%,transparent),0_8px_48px_-8px_color-mix(in_oklab,var(--color-primary)_25%,transparent)] transition-opacity duration-300 group-focus-within/prompt:opacity-100"
			/>
			<InputGroup
				className="relative h-auto flex-col items-stretch rounded-2xl border-0 bg-card shadow-xs dark:bg-card dark:shadow-[inset_0_1px_0_0_oklch(1_0_0_/_0.04)]"
				data-disabled={isSubmitting}
			>
				<AttachedSkillChips
					skills={attachedSkills}
					onRemove={removeSkillFile}
				/>
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
							? "min-h-[78px] px-5 pb-1 text-base"
							: "min-h-11 px-4 pb-1 text-sm",
						attachedSkills.length > 0 ? "pt-2" : isHero ? "pt-4" : "pt-3",
					)}
				/>
				<InputGroupAddon
					align="block-end"
					className={cn(
						"flex w-full cursor-default flex-wrap items-center gap-2",
						isHero ? "px-4 pb-4" : "px-3 pb-3",
					)}
				>
					<TooltipProvider>
						<AddContextMenu
							selectedSkillIds={selectedSkillIds}
							onToggleSkill={toggleSkillFile}
							isHero={isHero}
						/>
						<ModePicker
							value={routeMode}
							onValueChange={handleModeChange}
							isHero={isHero}
						/>
						<OutputPicker
							mode={routeMode}
							output={selectedOutput}
							onSelectOutput={selectOutput}
							isHero={isHero}
						/>
						<OutputSettings
							output={selectedOutput}
							values={outputOptions}
							onValueChange={updateOutputOption}
							isHero={isHero}
						/>
						<div className="ms-auto flex items-center gap-1">
							{showPriceTag ? (
								<PriceTag
									cost={CREDIT_COSTS.generation}
									withIcon
									showUnit={false}
									className="me-1.5 text-[11px]"
								/>
							) : null}
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										aria-label={t("projects.promptBox.micLabel")}
										className={cn(
											"rounded-full text-muted-foreground hover:text-foreground",
											isHero ? "size-9" : "size-8",
										)}
									>
										<Mic />
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									{t("projects.promptBox.micLabel")}
								</TooltipContent>
							</Tooltip>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										type="button"
										size="icon"
										aria-label={t("projects.promptBox.submitLabel")}
										onClick={handleSubmit}
										disabled={!canSubmit}
										className={cn(
											"rounded-full shadow-[0_4px_16px_-4px_color-mix(in_oklab,var(--color-primary)_50%,transparent)] transition-opacity disabled:opacity-40",
											isHero ? "size-9" : "size-8",
										)}
									>
										{isSubmitting ? (
											<Loader2 className="animate-spin" />
										) : (
											<ArrowUp strokeWidth={2.5} />
										)}
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									{t("projects.promptBox.submitLabel")}
								</TooltipContent>
							</Tooltip>
						</div>
					</TooltipProvider>
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
						{t("projects.promptBox.banner")}
					</div>
					{box}
				</div>
			) : (
				box
			)}
		</div>
	);
}
