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

const COPY = {
	placeholderHero: "Describe what you want Wandit to create or change...",
	placeholderCompact:
		"Ask for a page edit, a marketing asset, an image or a video...",
	banner: "Beta - your first 10 pages are on us, no card needed",
	submitLabel: "Generate",
	micLabel: "Voice input - coming soon",
	addMenuLabel: "Add context",
	addSkillLabel: "Add skill",
	attachLabel: "Attach",
	attachHint: "Upload files and references - coming soon",
	modeLabel: "Mode",
	outputLabel: "Output",
	settingsLabel: "Generation settings",
	skillLibraryLabel: "Built by Wandit",
	removeSkillLabel: (name: string) => `Remove ${name}`,
} as const;

type RouteMode = "auto" | "page" | "marketing" | "image" | "video";
type ConcreteMode = Exclude<RouteMode, "auto">;

type Choice = {
	id: string;
	label: string;
};

type OptionGroup = {
	id: string;
	label: string;
	choices: readonly Choice[];
	layout?: "grid" | "compact";
};

type RouteModeDef = {
	id: RouteMode;
	label: string;
	icon: LucideIcon;
	description: string;
	placeholder: string;
};

type SkillFileId =
	| "accessibility"
	| "redesign"
	| "seo-review"
	| "cod-algeria"
	| "brand-voice"
	| "direct-response"
	| "premium-visuals";

type SkillFileDef = {
	id: SkillFileId;
	label: string;
	fileName: string;
	icon: LucideIcon;
	description: string;
};

type SkillFileGroup = {
	id: string;
	label: string;
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

type GenerationOutputDef = {
	id: GenerationOutputId;
	mode: ConcreteMode;
	label: string;
	shortLabel: string;
	icon: LucideIcon;
	description: string;
	placeholder: string;
	options: readonly OptionGroup[];
};

const ROUTE_MODES: readonly RouteModeDef[] = [
	{
		id: "auto",
		label: "Auto",
		icon: Sparkles,
		description: "Wandit decides the right workflow.",
		placeholder: COPY.placeholderHero,
	},
	{
		id: "page",
		label: "Page",
		icon: FileText,
		description: "Create or edit the publishable page.",
		placeholder: "Describe the page you want to build or improve...",
	},
	{
		id: "marketing",
		label: "Marketing",
		icon: Megaphone,
		description: "Copy, strategy, scripts and HTML support assets.",
		placeholder: "Ask for ad copy, strategy, scripts or a campaign asset...",
	},
	{
		id: "image",
		label: "Image",
		icon: ImageIcon,
		description: "Generate product visuals and ad images.",
		placeholder: "Describe the product image, ratio, style and setting...",
	},
	{
		id: "video",
		label: "Video",
		icon: Clapperboard,
		description: "Generate short ad videos and scene plans.",
		placeholder: "Describe the video ad, scenes, format and duration...",
	},
];

const SKILL_FILE_GROUPS: readonly SkillFileGroup[] = [
	{
		id: "review",
		label: "Review skills",
		skills: [
			{
				id: "accessibility",
				label: "Accessibility",
				fileName: "accessibility.md",
				icon: ShieldCheck,
				description: "Adds contrast, forms and keyboard review guidance.",
			},
			{
				id: "seo-review",
				label: "SEO Review",
				fileName: "seo-review.md",
				icon: SearchCheck,
				description:
					"Adds search structure, metadata and copy review guidance.",
			},
			{
				id: "redesign",
				label: "Redesign",
				fileName: "redesign.md",
				icon: Brush,
				description: "Adds visual refresh and layout critique guidance.",
			},
		],
	},
	{
		id: "market",
		label: "Market context",
		skills: [
			{
				id: "cod-algeria",
				label: "COD Algeria",
				fileName: "cod-algeria.md",
				icon: Target,
				description: "Adds Algerian COD, wilaya and mobile-first context.",
			},
			{
				id: "brand-voice",
				label: "Brand Voice",
				fileName: "brand-voice.md",
				icon: Captions,
				description: "Keeps generated copy aligned to the brand tone.",
			},
			{
				id: "direct-response",
				label: "Direct Response",
				fileName: "direct-response.md",
				icon: BadgeCheck,
				description: "Adds offer, proof, objection and CTA pressure.",
			},
			{
				id: "premium-visuals",
				label: "Premium Visuals",
				fileName: "premium-visuals.md",
				icon: ImageIcon,
				description: "Adds higher-end art direction for visual outputs.",
			},
		],
	},
];

const OUTPUTS_BY_MODE: Record<ConcreteMode, readonly GenerationOutputDef[]> = {
	page: [
		{
			id: "landing-page",
			mode: "page",
			label: "Landing Page",
			shortLabel: "Landing Page",
			icon: FileText,
			description: "Creates the publishable project page.",
			placeholder: "Describe the product, offer, price, proof and COD flow...",
			options: [
				{
					id: "goal",
					label: "Goal",
					choices: [
						{ id: "cod", label: "COD sales" },
						{ id: "leads", label: "Lead capture" },
						{ id: "promo", label: "Promo" },
						{ id: "service", label: "Service" },
					],
				},
				{
					id: "language",
					label: "Language",
					choices: [
						{ id: "auto", label: "Auto" },
						{ id: "arabic", label: "Arabic" },
						{ id: "french", label: "French" },
						{ id: "ar-fr", label: "AR + FR" },
					],
				},
				{
					id: "shape",
					label: "Page type",
					choices: [
						{ id: "landing", label: "Landing" },
						{ id: "product", label: "Product page" },
						{ id: "service", label: "Service page" },
					],
				},
			],
		},
		{
			id: "page-edit",
			mode: "page",
			label: "Page Edit",
			shortLabel: "Page Edit",
			icon: Brush,
			description: "Updates copy, layout or sections in the current page.",
			placeholder: "Tell Wandit which part of the page should change...",
			options: [
				{
					id: "scope",
					label: "Scope",
					choices: [
						{ id: "hero", label: "Hero" },
						{ id: "offer", label: "Offer block" },
						{ id: "form", label: "Order form" },
						{ id: "full", label: "Full page" },
					],
				},
				{
					id: "intensity",
					label: "Change level",
					choices: [
						{ id: "light", label: "Light" },
						{ id: "medium", label: "Medium" },
						{ id: "rewrite", label: "Rewrite" },
					],
				},
			],
		},
		{
			id: "html-section",
			mode: "page",
			label: "HTML Section",
			shortLabel: "HTML Section",
			icon: FileText,
			description: "Creates an embeddable section for the page.",
			placeholder: "Describe the section you want to add to the page...",
			options: [
				{
					id: "section",
					label: "Section type",
					choices: [
						{ id: "comparison", label: "Comparison" },
						{ id: "faq", label: "FAQ" },
						{ id: "testimonials", label: "Testimonials" },
						{ id: "offer", label: "Offer block" },
					],
				},
				{
					id: "style",
					label: "Style",
					choices: [
						{ id: "match", label: "Match page" },
						{ id: "clean", label: "Clean" },
						{ id: "direct", label: "Direct response" },
					],
				},
			],
		},
	],
	marketing: [
		{
			id: "ad-copy",
			mode: "marketing",
			label: "Ad Copy",
			shortLabel: "Ad Copy",
			icon: BadgeCheck,
			description: "Creates hooks, primary text, headlines and CTAs.",
			placeholder: "Describe the product and the ad angle you want to test...",
			options: [
				{
					id: "platform",
					label: "Platform",
					choices: [
						{ id: "meta", label: "Meta" },
						{ id: "tiktok", label: "TikTok" },
						{ id: "google", label: "Google" },
						{ id: "whatsapp", label: "WhatsApp" },
					],
				},
				{
					id: "variants",
					label: "Variants",
					choices: [
						{ id: "3", label: "3" },
						{ id: "5", label: "5" },
						{ id: "10", label: "10" },
					],
					layout: "compact",
				},
				{
					id: "angle",
					label: "Angle",
					choices: [
						{ id: "auto", label: "Auto" },
						{ id: "pain", label: "Pain" },
						{ id: "offer", label: "Offer" },
						{ id: "proof", label: "Social proof" },
						{ id: "urgency", label: "Urgency" },
					],
				},
				{
					id: "length",
					label: "Length",
					choices: [
						{ id: "short", label: "Short" },
						{ id: "medium", label: "Medium" },
					],
					layout: "compact",
				},
			],
		},
		{
			id: "marketing-strategy",
			mode: "marketing",
			label: "Strategy",
			shortLabel: "Strategy",
			icon: Target,
			description: "Plans angles, funnel moves and campaign flow.",
			placeholder:
				"Describe the product and ask for a launch or campaign plan...",
			options: [
				{
					id: "strategy",
					label: "Strategy type",
					choices: [
						{ id: "launch", label: "Launch plan" },
						{ id: "campaign", label: "Campaign plan" },
						{ id: "offer", label: "Offer strategy" },
						{ id: "audit", label: "Funnel audit" },
					],
				},
				{
					id: "channel",
					label: "Channel",
					choices: [
						{ id: "auto", label: "Auto" },
						{ id: "meta", label: "Meta" },
						{ id: "tiktok", label: "TikTok" },
						{ id: "whatsapp", label: "WhatsApp" },
					],
				},
				{
					id: "depth",
					label: "Depth",
					choices: [
						{ id: "quick", label: "Quick" },
						{ id: "detailed", label: "Detailed" },
					],
					layout: "compact",
				},
			],
		},
		{
			id: "video-script",
			mode: "marketing",
			label: "Video Script",
			shortLabel: "Video Script",
			icon: Captions,
			description: "Scripts UGC, demos and short-form ads.",
			placeholder: "Describe the product and the video structure you want...",
			options: [
				{
					id: "format",
					label: "Format",
					choices: [
						{ id: "ugc", label: "UGC" },
						{ id: "demo", label: "Product demo" },
						{ id: "problem", label: "Problem-solution" },
						{ id: "testimonial", label: "Testimonial" },
					],
				},
				{
					id: "duration",
					label: "Duration",
					choices: [
						{ id: "15", label: "15s" },
						{ id: "30", label: "30s" },
						{ id: "60", label: "60s" },
					],
					layout: "compact",
				},
				{
					id: "detail",
					label: "Include",
					choices: [
						{ id: "hook", label: "Hook" },
						{ id: "voiceover", label: "Voiceover" },
						{ id: "shots", label: "Shot list" },
						{ id: "cta", label: "CTA" },
					],
				},
			],
		},
		{
			id: "creative-brief",
			mode: "marketing",
			label: "Creative Brief",
			shortLabel: "Brief",
			icon: FileText,
			description: "Creates a structured brief for designers or creators.",
			placeholder: "Describe the campaign and what the creative team needs...",
			options: [
				{
					id: "channel",
					label: "Channel",
					choices: [
						{ id: "meta", label: "Meta" },
						{ id: "tiktok", label: "TikTok" },
						{ id: "mixed", label: "Mixed" },
					],
				},
				{
					id: "depth",
					label: "Depth",
					choices: [
						{ id: "simple", label: "Simple" },
						{ id: "detailed", label: "Detailed" },
					],
					layout: "compact",
				},
			],
		},
		{
			id: "html-asset",
			mode: "marketing",
			label: "HTML Asset",
			shortLabel: "HTML Asset",
			icon: FileText,
			description: "Creates a supporting HTML artifact saved to assets.",
			placeholder:
				"Describe the support asset: table, one-pager, FAQ or brief...",
			options: [
				{
					id: "asset",
					label: "Asset type",
					choices: [
						{ id: "comparison", label: "Comparison table" },
						{ id: "one-pager", label: "Product one-pager" },
						{ id: "faq", label: "FAQ block" },
						{ id: "offer", label: "Offer block" },
					],
				},
				{
					id: "format",
					label: "Format",
					choices: [
						{ id: "standalone", label: "Standalone" },
						{ id: "embed", label: "Embed-ready" },
					],
					layout: "compact",
				},
			],
		},
	],
	image: [
		{
			id: "image-creator",
			mode: "image",
			label: "Auto",
			shortLabel: "Auto",
			icon: ImageIcon,
			description: "Wandit chooses the best image format from the prompt.",
			placeholder:
				"Describe the image, product, background, style and ratio...",
			options: [
				{
					id: "quality",
					label: "Quality",
					choices: [
						{ id: "auto", label: "Auto" },
						{ id: "high", label: "High" },
						{ id: "medium", label: "Medium" },
						{ id: "low", label: "Low" },
					],
				},
				{
					id: "size",
					label: "Size",
					choices: [
						{ id: "1-1", label: "1:1" },
						{ id: "3-2", label: "3:2" },
						{ id: "2-3", label: "2:3" },
						{ id: "4-3", label: "4:3" },
						{ id: "9-16", label: "9:16" },
						{ id: "16-9", label: "16:9" },
					],
					layout: "grid",
				},
				{
					id: "count",
					label: "Images",
					choices: [
						{ id: "1", label: "1 img" },
						{ id: "2", label: "2 img" },
						{ id: "4", label: "4 img" },
						{ id: "8", label: "8 img" },
					],
				},
			],
		},
		{
			id: "product-shot",
			mode: "image",
			label: "Product Shot",
			shortLabel: "Product Shot",
			icon: ImageIcon,
			description: "Creates clean product-led visuals for commerce.",
			placeholder: "Describe the product shot, angle, background and props...",
			options: [
				{
					id: "scene",
					label: "Scene",
					choices: [
						{ id: "studio", label: "Studio" },
						{ id: "lifestyle", label: "Lifestyle" },
						{ id: "packshot", label: "Packshot" },
						{ id: "before-after", label: "Before/after" },
					],
				},
				{
					id: "size",
					label: "Size",
					choices: [
						{ id: "1-1", label: "1:1" },
						{ id: "4-5", label: "4:5" },
						{ id: "9-16", label: "9:16" },
						{ id: "16-9", label: "16:9" },
					],
				},
			],
		},
		{
			id: "ad-creative",
			mode: "image",
			label: "Ad Creative",
			shortLabel: "Ad Creative",
			icon: Megaphone,
			description: "Creates static ad visuals with offer-first composition.",
			placeholder: "Describe the ad creative, offer, headline and platform...",
			options: [
				{
					id: "platform",
					label: "Platform",
					choices: [
						{ id: "meta", label: "Meta" },
						{ id: "tiktok", label: "TikTok" },
						{ id: "story", label: "Story" },
						{ id: "display", label: "Display" },
					],
				},
				{
					id: "text",
					label: "Text amount",
					choices: [
						{ id: "none", label: "No text" },
						{ id: "light", label: "Light" },
						{ id: "offer", label: "Offer-heavy" },
					],
				},
				{
					id: "count",
					label: "Variants",
					choices: [
						{ id: "1", label: "1" },
						{ id: "3", label: "3" },
						{ id: "5", label: "5" },
					],
					layout: "compact",
				},
			],
		},
		{
			id: "background-edit",
			mode: "image",
			label: "Background Edit",
			shortLabel: "BG Edit",
			icon: Brush,
			description: "Changes the environment around an existing product image.",
			placeholder:
				"Attach a product photo, then describe the new background...",
			options: [
				{
					id: "background",
					label: "Background",
					choices: [
						{ id: "studio", label: "Studio" },
						{ id: "premium", label: "Premium" },
						{ id: "home", label: "Home" },
						{ id: "outdoor", label: "Outdoor" },
					],
				},
				{
					id: "preserve",
					label: "Preserve",
					choices: [
						{ id: "product", label: "Product" },
						{ id: "lighting", label: "Lighting" },
						{ id: "shadow", label: "Shadow" },
					],
				},
			],
		},
	],
	video: [
		{
			id: "video-creator",
			mode: "video",
			label: "Auto",
			shortLabel: "Auto",
			icon: Clapperboard,
			description: "Wandit chooses the best video format from the prompt.",
			placeholder:
				"Describe the video, scenes, movement, mood and aspect ratio...",
			options: [
				{
					id: "method",
					label: "Generate method",
					choices: [
						{ id: "reference", label: "Reference" },
						{ id: "edit", label: "Edit" },
						{ id: "frames", label: "Frames" },
					],
				},
				{
					id: "size",
					label: "Size",
					choices: [
						{ id: "auto", label: "Auto" },
						{ id: "16-9", label: "16:9" },
						{ id: "4-3", label: "4:3" },
						{ id: "1-1", label: "1:1" },
						{ id: "9-16", label: "9:16" },
						{ id: "21-9", label: "21:9" },
					],
					layout: "grid",
				},
				{
					id: "resolution",
					label: "Resolution",
					choices: [
						{ id: "720", label: "720p" },
						{ id: "1080", label: "1080p" },
						{ id: "4k", label: "4k" },
					],
				},
				{
					id: "duration",
					label: "Duration",
					choices: [
						{ id: "4", label: "4s" },
						{ id: "5", label: "5s" },
						{ id: "8", label: "8s" },
						{ id: "10", label: "10s" },
					],
				},
			],
		},
		{
			id: "ugc-video",
			mode: "video",
			label: "UGC Video",
			shortLabel: "UGC Video",
			icon: Captions,
			description: "Creates creator-style short-form video ads.",
			placeholder: "Describe the UGC ad, creator vibe, hook and proof...",
			options: [
				{
					id: "structure",
					label: "Structure",
					choices: [
						{ id: "problem", label: "Problem" },
						{ id: "demo", label: "Demo" },
						{ id: "testimonial", label: "Testimonial" },
					],
				},
				{
					id: "duration",
					label: "Duration",
					choices: [
						{ id: "15", label: "15s" },
						{ id: "30", label: "30s" },
						{ id: "45", label: "45s" },
					],
					layout: "compact",
				},
			],
		},
		{
			id: "product-demo",
			mode: "video",
			label: "Product Demo",
			shortLabel: "Demo",
			icon: Clapperboard,
			description: "Shows product use, result and order action.",
			placeholder: "Describe the product demo sequence and final CTA...",
			options: [
				{
					id: "pace",
					label: "Pace",
					choices: [
						{ id: "fast", label: "Fast" },
						{ id: "balanced", label: "Balanced" },
						{ id: "slow", label: "Slow" },
					],
				},
				{
					id: "ratio",
					label: "Ratio",
					choices: [
						{ id: "9-16", label: "9:16" },
						{ id: "1-1", label: "1:1" },
						{ id: "16-9", label: "16:9" },
					],
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
	return (
		<>
			{SKILL_FILE_GROUPS.map((group, groupIndex) => (
				<div key={group.id}>
					{groupIndex > 0 ? (
						<DropdownMenuSeparator className="my-1 bg-border/70" />
					) : null}
					<DropdownMenuLabel className="px-2 pt-2 pb-1 font-mono font-normal text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
						{group.label}
					</DropdownMenuLabel>
					{group.skills.map((skill) => {
						const selected = selectedIds.includes(skill.id);
						return (
							<DropdownMenuItem
								key={skill.id}
								className="items-start gap-2.5 rounded-lg px-2 py-2"
								onSelect={() => onToggleSkill(skill)}
							>
								<IconTile icon={skill.icon} active={selected} />
								<span className="min-w-0">
									<span className="flex items-center gap-2 font-medium text-sm leading-tight">
										{skill.label}
										<span className="font-mono text-[10px] text-muted-foreground">
											{skill.fileName}
										</span>
									</span>
									<span className="mt-0.5 block text-muted-foreground text-xs leading-snug">
										{skill.description}
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
	return (
		<DropdownMenu>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<Button
							type="button"
							variant="outline"
							size="icon-sm"
							aria-label={COPY.addMenuLabel}
							className={cn(
								"rounded-full border-border/80 bg-background/70 text-muted-foreground shadow-none transition-[transform,color,background-color,border-color] duration-200 hover:border-primary/30 hover:bg-primary/10 hover:text-foreground active:translate-y-px",
								isHero ? "size-9" : "size-8",
							)}
						>
							<Plus className="size-4" />
						</Button>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent>{COPY.addMenuLabel}</TooltipContent>
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
						<span>{COPY.addSkillLabel}</span>
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent
						sideOffset={10}
						className="w-[22rem] max-w-[calc(100vw-1.5rem)] rounded-2xl border-border/80 p-1.5 shadow-[0_18px_50px_-24px_rgb(0_0_0/0.36)]"
					>
						<div className="flex items-center justify-between px-2 pt-1 pb-1.5">
							<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
								{COPY.skillLibraryLabel}
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
						<span>{COPY.attachLabel}</span>
						<span className="truncate text-muted-foreground text-xs">
							{COPY.attachHint}
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
	if (skills.length === 0) return null;

	return (
		<div className="flex flex-wrap gap-1.5 px-4 pt-3 sm:px-5">
			{skills.map((skill) => {
				const SkillIcon = skill.icon;
				return (
					<span
						key={skill.id}
						className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 text-foreground text-xs"
					>
						<SkillIcon className="size-3.5 shrink-0 text-primary" />
						<span className="truncate">{skill.label}</span>
						<span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
							{skill.fileName}
						</span>
						<button
							type="button"
							aria-label={COPY.removeSkillLabel(skill.label)}
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
	const selectedMode = getMode(value);
	const SelectedIcon = selectedMode.icon;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					aria-label={`${COPY.modeLabel}: ${selectedMode.label}`}
					className={cn(
						"group/trigger rounded-full border-border/75 bg-background/55 text-muted-foreground shadow-none transition-colors hover:border-primary/25 hover:bg-accent/70 hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground",
						isHero ? "h-9" : "h-8",
					)}
				>
					<SelectedIcon className="size-3.5 text-primary" />
					<span className="max-w-24 truncate">{selectedMode.label}</span>
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
					{COPY.modeLabel}
				</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={value}
					onValueChange={(next) => onValueChange(next as RouteMode)}
				>
					{ROUTE_MODES.map((mode) => (
						<DropdownMenuRadioItemBare
							key={mode.id}
							value={mode.id}
							className="data-[state=checked]:bg-primary/10"
						>
							<IconTile icon={mode.icon} active={value === mode.id} />
							<span className="min-w-0">
								<span className="block font-medium text-sm leading-tight">
									{mode.label}
								</span>
								<span className="mt-0.5 block text-muted-foreground text-xs leading-snug">
									{mode.description}
								</span>
							</span>
							<Check className="ms-auto size-4 shrink-0 scale-90 text-primary opacity-0 transition-[opacity,transform] group-data-[state=checked]/row:scale-100 group-data-[state=checked]/row:opacity-100" />
						</DropdownMenuRadioItemBare>
					))}
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
	if (mode === "auto" || !output) return null;
	const OutputIcon = output.icon;
	const outputs = OUTPUTS_BY_MODE[mode];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					aria-label={`${COPY.outputLabel}: ${output.label}`}
					className={cn(
						"group/trigger rounded-full border-primary/30 bg-primary/10 text-foreground shadow-none transition-colors hover:bg-primary/15 data-[state=open]:bg-primary/15",
						isHero ? "h-9" : "h-8",
					)}
				>
					<OutputIcon className="size-3.5 text-primary" />
					<span className="max-w-32 truncate font-medium">
						{output.shortLabel}
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
					{getMode(mode).label} outputs
				</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={output.id}
					onValueChange={(next) => {
						const nextOutput = getOutput(next as GenerationOutputId);
						if (nextOutput) onSelectOutput(nextOutput);
					}}
				>
					{outputs.map((item) => (
						<DropdownMenuRadioItemBare
							key={item.id}
							value={item.id}
							className="data-[state=checked]:bg-primary/10"
						>
							<IconTile icon={item.icon} active={item.id === output.id} />
							<span className="min-w-0">
								<span className="block font-medium text-sm leading-tight">
									{item.label}
								</span>
								<span className="mt-0.5 block text-muted-foreground text-xs leading-snug">
									{item.description}
								</span>
							</span>
							<Check className="ms-auto size-4 shrink-0 scale-90 text-primary opacity-0 transition-[opacity,transform] group-data-[state=checked]/row:scale-100 group-data-[state=checked]/row:opacity-100" />
						</DropdownMenuRadioItemBare>
					))}
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
	if (!output) return null;
	const OutputIcon = output.icon;

	return (
		<DropdownMenu>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<Button
							type="button"
							variant="outline"
							size="icon-sm"
							aria-label={COPY.settingsLabel}
							className={cn(
								"rounded-full border-border/75 bg-background/55 text-muted-foreground shadow-none transition-colors hover:border-primary/25 hover:bg-accent/70 hover:text-foreground data-[state=open]:border-primary/30 data-[state=open]:bg-primary/10 data-[state=open]:text-foreground",
								isHero ? "size-9" : "size-8",
							)}
						>
							<SlidersHorizontal className="size-4" />
						</Button>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent>{COPY.settingsLabel}</TooltipContent>
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
								{output.label}
							</p>
							<p className="mt-0.5 text-muted-foreground text-xs">
								Options for this {getMode(output.mode).label.toLowerCase()}{" "}
								output.
							</p>
						</div>
					</div>
				</div>
				<div className="space-y-4 p-4">
					{output.options.map((group) => (
						<div key={group.id}>
							<p className="mb-2 text-muted-foreground text-xs">
								{group.label}
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
											{choice.label}
										</button>
									);
								})}
							</div>
						</div>
					))}
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
	const selectedMode = getMode(routeMode);
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
		selectedOutput?.placeholder ??
		(isHero ? selectedMode.placeholder : COPY.placeholderCompact);

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
										aria-label={COPY.micLabel}
										className={cn(
											"rounded-full text-muted-foreground hover:text-foreground",
											isHero ? "size-9" : "size-8",
										)}
									>
										<Mic />
									</Button>
								</TooltipTrigger>
								<TooltipContent>{COPY.micLabel}</TooltipContent>
							</Tooltip>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										type="button"
										size="icon"
										aria-label={COPY.submitLabel}
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
								<TooltipContent>{COPY.submitLabel}</TooltipContent>
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
						{COPY.banner}
					</div>
					{box}
				</div>
			) : (
				box
			)}
		</div>
	);
}
