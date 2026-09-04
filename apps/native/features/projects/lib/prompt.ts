import {
	type ComposerMetadata,
	projectPromptMaxLength,
	type UploadAttachmentResponse,
} from "@wandit/contracts";

import type { WanditIconName } from "@/components/wandit-icon";

export type RouteMode = "auto" | "page" | "marketing" | "image";
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
];

// Skill ids are the EXACT server slugs the web composer sends in
// `composer.skills`. On native the chips are visual-only for now: the chat
// mutation (apps/native/features/workspace/api/chat.mutations.ts) sends the
// text only and no composer metadata, so the director does not load a skill
// from a native selection until that mutation sends composer metadata.
// Mirror of the web list in apps/web/src/features/projects/components/prompt-box.tsx.
export type SkillFileId =
	| "ads-fundamentals"
	| "ads-creative"
	| "ads-audiences"
	| "ads-measurement"
	| "ads-cod-maghreb"
	| "ads-diagnostic";

export type SkillGroupId = "ads";

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
		id: "ads",
		skills: [
			{ id: "ads-fundamentals", fileName: "ads-fundamentals", icon: "sliders" },
			{ id: "ads-creative", fileName: "ads-creative", icon: "image" },
			{ id: "ads-audiences", fileName: "ads-audiences", icon: "users" },
			{ id: "ads-measurement", fileName: "ads-measurement", icon: "check" },
			{ id: "ads-cod-maghreb", fileName: "ads-cod-maghreb", icon: "bookmark" },
			{ id: "ads-diagnostic", fileName: "ads-diagnostic", icon: "search" },
		],
	},
];

export const ALL_SKILLS: SkillFileDef[] = SKILL_GROUPS.flatMap((group) => [
	...group.skills,
]);

export type GenerationOutputId =
	| "landing-page"
	| "site-vitrine"
	| "ad-copy"
	| "marketing-strategy"
	| "video-script"
	| "creative-brief"
	| "html-asset"
	| "image-creator"
	| "product-shot"
	| "ad-creative";

export type OptionGroup = {
	id: string;
	choices: readonly { id: string }[];
	layout?: "grid" | "compact";
};

export type GenerationOutputDef = {
	id: GenerationOutputId;
	mode: ConcreteMode;
	icon: WanditIconName;
	options: readonly OptionGroup[];
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
				{
					id: "goal",
					choices: [
						{ id: "cod" },
						{ id: "leads" },
						{ id: "service" },
						{ id: "promo" },
					],
				},
			],
		},
		{
			id: "site-vitrine",
			mode: "page",
			icon: "browser",
			options: [
				{
					id: "goal",
					choices: [
						{ id: "cod" },
						{ id: "leads" },
						{ id: "service" },
						{ id: "promo" },
					],
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
					choices: [{ id: "1" }, { id: "2" }, { id: "4" }, { id: "6" }],
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
	],
};

export const ALL_OUTPUTS: GenerationOutputDef[] =
	Object.values(OUTPUTS_BY_MODE).flat();

export function getOutput(id: GenerationOutputId | null) {
	return ALL_OUTPUTS.find((output) => output.id === id) ?? null;
}

export function getDefaultOutput(mode: RouteMode) {
	return mode === "auto" ? null : (OUTPUTS_BY_MODE[mode][0] ?? null);
}

export function createDefaultOptions(output: GenerationOutputDef) {
	return Object.fromEntries(
		output.options.map((group) => [group.id, group.choices[0]?.id ?? ""]),
	);
}

export type PromptDraft = {
	text: string;
	composer: ComposerMetadata;
	/** Uploaded attachments ready to ride the message as file parts. */
	files?: UploadAttachmentResponse[];
};

export function buildComposer({
	mode,
	output,
	skills,
	options,
}: {
	mode: RouteMode;
	output: GenerationOutputId | null;
	skills: SkillFileId[];
	options: Record<string, unknown>;
}): ComposerMetadata {
	return {
		mode,
		output: output ?? undefined,
		skills: skills.length > 0 ? skills : undefined,
		options: Object.keys(options).length > 0 ? options : undefined,
	};
}

export const PROJECT_PROMPT_MAX_LENGTH = projectPromptMaxLength;
export const CHAT_PROMPT_MAX_LENGTH = 8000;
