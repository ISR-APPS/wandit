import type { WanditIconName } from "@/components/wandit-icon";

// Composer route modes + skills, mirroring the web PromptBox
// (apps/web src/features/projects/components/prompt-box.tsx). Copy lives under
// projects.promptBox.* in @wandit/internationalization; only ids/icons here.

export type RouteMode = "auto" | "page" | "marketing" | "image" | "video";
export type ConcreteMode = Exclude<RouteMode, "auto">;

export type RouteModeDef = {
	id: RouteMode;
	icon: WanditIconName;
};

export const ROUTE_MODES: RouteModeDef[] = [
	{ id: "auto", icon: "spark" },
	{ id: "page", icon: "page" },
	{ id: "marketing", icon: "megaphone" },
	{ id: "image", icon: "image" },
	{ id: "video", icon: "play" },
];

export type SkillFileId =
	| "accessibility"
	| "seo-review"
	| "redesign"
	| "cod-algeria"
	| "brand-voice"
	| "direct-response"
	| "premium-visuals";

export type SkillGroupId = "review" | "market";

export type SkillFileDef = {
	id: SkillFileId;
	fileName: string;
	icon: WanditIconName;
};

export type SkillFileGroup = {
	id: SkillGroupId;
	skills: readonly SkillFileDef[];
};

export const SKILL_GROUPS: SkillFileGroup[] = [
	{
		id: "review",
		skills: [
			{ id: "accessibility", fileName: "accessibility.md", icon: "users" },
			{ id: "seo-review", fileName: "seo-review.md", icon: "search" },
			{ id: "redesign", fileName: "redesign.md", icon: "pencil" },
		],
	},
	{
		id: "market",
		skills: [
			{ id: "cod-algeria", fileName: "cod-algeria.md", icon: "bookmark" },
			{ id: "brand-voice", fileName: "brand-voice.md", icon: "mic" },
			{
				id: "direct-response",
				fileName: "direct-response.md",
				icon: "megaphone",
			},
			{ id: "premium-visuals", fileName: "premium-visuals.md", icon: "image" },
		],
	},
];

export const ALL_SKILLS: SkillFileDef[] = SKILL_GROUPS.flatMap((group) => [
	...group.skills,
]);

export type GenerationOutputId =
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

export type OptionGroup = {
	id: string;
	choices: readonly { id: string }[];
	/** grid = big tiles (aspect ratios); compact = short values. */
	layout?: "grid" | "compact";
};

export type GenerationOutputDef = {
	id: GenerationOutputId;
	mode: ConcreteMode;
	icon: WanditIconName;
	options: readonly OptionGroup[];
};

// Page outputs carry the composer quality tier (contracts composerQualities):
// better models burn more credits, so the user picks Standard or Max.
const PAGE_QUALITY: OptionGroup = {
	id: "quality",
	choices: [{ id: "standard" }, { id: "max" }],
	layout: "compact",
};

export const OUTPUTS_BY_MODE: Record<
	ConcreteMode,
	readonly GenerationOutputDef[]
> = {
	page: [
		{
			id: "landing-page",
			mode: "page",
			icon: "page",
			options: [
				PAGE_QUALITY,
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
			icon: "pencil",
			options: [
				PAGE_QUALITY,
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
			icon: "browser",
			options: [
				PAGE_QUALITY,
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
			icon: "megaphone",
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
			icon: "bookmark",
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
			icon: "pencil",
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
			icon: "page",
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
			icon: "browser",
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
			icon: "image",
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
			icon: "imageTile",
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
			icon: "megaphone",
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
			icon: "pencil",
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
			icon: "play",
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
			icon: "users",
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
			icon: "play",
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

export const ALL_OUTPUTS: GenerationOutputDef[] =
	Object.values(OUTPUTS_BY_MODE).flat();

export function getOutput(id: GenerationOutputId | null) {
	return ALL_OUTPUTS.find((output) => output.id === id) ?? null;
}

export function getDefaultOutput(mode: RouteMode) {
	if (mode === "auto") {
		return null;
	}
	return OUTPUTS_BY_MODE[mode][0] ?? null;
}

export function createDefaultOptions(output: GenerationOutputDef) {
	return Object.fromEntries(
		output.options.map((group) => [group.id, group.choices[0]?.id ?? ""]),
	);
}

/** Shared contract limit (packages/contracts projectPromptMaxLength). */
export const PROMPT_MAX_LENGTH = 2000;

export type MockAttachment = {
	id: string;
	fileName: string;
	/** e.g. "attached · 2.1 MB" tail is composed in the component. */
	sizeLabel: string;
};
