import {
	type ComposerMetadata,
	projectPromptMaxLength,
	type UploadAttachmentResponse,
} from "@wandit/contracts";
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
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@wandit/ui/components/popover";
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
	BrainCircuit,
	Captions,
	ChartLine,
	Check,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	FileText,
	Gauge,
	ImageIcon,
	Layers,
	LayoutTemplate,
	Loader2,
	type LucideIcon,
	Megaphone,
	Mic,
	Palette,
	Paperclip,
	Plug,
	Plus,
	RefreshCw,
	SlidersHorizontal,
	Sparkles,
	Stethoscope,
	Target,
	Truck,
	Users,
	WandSparkles,
	X,
} from "lucide-react";
import { motion } from "motion/react";
import type * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/features/auth";
import { ConnectorsDialog } from "@/features/connectors";
import { useDictionary, useTranslation } from "@/lib/i18n";
import {
	BUILDER_MODEL_STORAGE_KEY,
	BUILDER_MODELS,
	BUILDER_REASONING_LEVELS,
	BUILDER_REASONING_STORAGE_KEY,
	DEFAULT_BUILDER_MODEL,
	DEFAULT_BUILDER_REASONING,
	getBuilderModelOption,
	getBuilderReasoningOption,
	readStoredBuilderModel,
	readStoredBuilderReasoning,
} from "@/lib/model-labels";
import {
	ATTACHMENT_ACCEPT,
	AttachmentUploadError,
	attachmentMaxBytesFor,
	uploadAttachment,
} from "../api/attachments.services";
import { MAX_VISIBLE_SKILLS } from "../lib/constants";
import { useVoiceDictation } from "../lib/use-voice-dictation";

type RouteMode = "auto" | "page" | "marketing" | "image";
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

// Skill ids are the EXACT server slugs: the director loads the matching ads
// skill when the id arrives in `composer.skills`. Keep them in sync with the
// server skill registry and with apps/native/features/projects/lib/prompt.ts.
type SkillFileId =
	| "ads-fundamentals"
	| "ads-creative"
	| "ads-audiences"
	| "ads-measurement"
	| "ads-cod-maghreb"
	| "ads-diagnostic";

type SkillGroupId = "ads";

// Non-copy skill config: id + fileName + icon. Label/description live in the
// `projects.promptBox.skills` dictionary namespace. `fileName` is the slug
// shown as a mono hint next to the label (it equals the id).
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
	| "site-vitrine"
	| "ad-copy"
	| "marketing-strategy"
	| "video-script"
	| "creative-brief"
	| "html-asset"
	| "image-creator"
	| "product-shot"
	| "ad-creative";

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

/** One user asset attached to the draft (V2 spec §11). Uploads start the
 *  moment the file is picked — submit only forwards the `ready` ones. */
export type ComposerAttachment = {
	id: string; // local uuid
	filename: string;
	mediaType: string;
	previewUrl: string | null; // object URL for images
	status: "uploading" | "ready" | "error";
	uploaded?: UploadAttachmentResponse;
	/** Failure reason key (maps to promptBox.attachments.* copy). */
	error?: string;
	/** Kept so a failed upload can be retried without re-picking. */
	file?: File;
};

/** Contract §7.2 allowlist mirrored client-side for instant feedback. */
const ALLOWED_ATTACHMENT_TYPES = new Set(ATTACHMENT_ACCEPT.split(","));

/** createProject caps `attachments` at 6 (contract Appendix C). */
const MAX_ATTACHMENTS = 6;

/** Browsers report CSV and Office documents inconsistently (empty type,
 *  octet-stream, or the legacy Excel type) — fall back to the extension. */
const AMBIGUOUS_FILE_TYPES = new Set([
	"",
	"application/octet-stream",
	"application/vnd.ms-excel",
]);

const EXTENSION_MEDIA_TYPES: Record<string, string> = {
	csv: "text/csv",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function effectiveMediaType(file: File): string {
	if (!AMBIGUOUS_FILE_TYPES.has(file.type)) {
		return file.type;
	}

	const dotIndex = file.name.lastIndexOf(".");
	const extension =
		dotIndex > 0 ? file.name.slice(dotIndex + 1).toLowerCase() : "";

	return EXTENSION_MEDIA_TYPES[extension] ?? file.type;
}

function toComposerAttachment(file: File): ComposerAttachment {
	const mediaType = effectiveMediaType(file);
	const unsupported = !ALLOWED_ATTACHMENT_TYPES.has(mediaType);
	const tooLarge = file.size > attachmentMaxBytesFor(mediaType);
	return {
		id: crypto.randomUUID(),
		filename: file.name,
		mediaType,
		previewUrl: file.type.startsWith("image/")
			? URL.createObjectURL(file)
			: null,
		status: unsupported || tooLarge ? "error" : "uploading",
		error: unsupported ? "unsupported" : tooLarge ? "too-large" : undefined,
		file,
	};
}

function isFileDrag(dataTransfer: DataTransfer): boolean {
	return dataTransfer.types.includes("Files");
}

const ROUTE_MODES: readonly RouteModeDef[] = [
	{ id: "auto", icon: Sparkles },
	{ id: "page", icon: FileText },
	{ id: "marketing", icon: Megaphone },
	{ id: "image", icon: ImageIcon },
];

const SKILL_FILE_GROUPS: readonly SkillFileGroup[] = [
	{
		id: "ads",
		skills: [
			{ id: "ads-fundamentals", fileName: "ads-fundamentals", icon: Layers },
			{ id: "ads-creative", fileName: "ads-creative", icon: Palette },
			{ id: "ads-audiences", fileName: "ads-audiences", icon: Users },
			{ id: "ads-measurement", fileName: "ads-measurement", icon: ChartLine },
			{ id: "ads-cod-maghreb", fileName: "ads-cod-maghreb", icon: Truck },
			{ id: "ads-diagnostic", fileName: "ads-diagnostic", icon: Stethoscope },
		],
	},
];

const OUTPUTS_BY_MODE: Record<ConcreteMode, readonly GenerationOutputDef[]> = {
	// Mode "page" (FR label "Site web") — two outputs only (spec §10): the
	// single-page COD-style funnel and the multi-section vitrine site. `goal`
	// choice ids are the frozen vocabulary (contract §10.2).
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
						{ id: "service" },
						{ id: "promo" },
					],
				},
				{
					id: "codMode",
					choices: [{ id: "auto" }, { id: "simple" }, { id: "max" }],
				},
			],
		},
		{
			id: "site-vitrine",
			mode: "page",
			icon: LayoutTemplate,
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
					// Server cap: MAX_IMAGES_PER_GENERATION = 6 (contracts); every image is
					// generated separately, never as a grid inside one picture.
					id: "count",
					choices: [{ id: "1" }, { id: "2" }, { id: "4" }, { id: "6" }],
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

/** Keep cross-option dependencies in one place so new conditional groups do
 * not leak product-specific branches into the settings-panel markup. */
function isGroupVisible(
	group: OptionGroup,
	options: Readonly<Record<string, string>>,
) {
	if (group.id === "codMode") return options.goal === "cod";
	return true;
}

function restoreOutputOptions(
	output: GenerationOutputDef,
	stored: Record<string, unknown> | undefined,
) {
	const restored = createDefaultOptions(output);
	for (const group of output.options) {
		const choice = stored?.[group.id];
		if (
			typeof choice === "string" &&
			group.choices.some((item) => item.id === choice)
		) {
			restored[group.id] = choice;
		}
	}
	return restored;
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
					: "border-border bg-muted/60 text-muted-foreground",
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
	attachmentsEnabled,
	onAttach,
	connectorsEnabled,
	onConnectApps,
	isHero,
}: {
	selectedSkillIds: readonly SkillFileId[];
	onToggleSkill: (skill: SkillFileDef) => void;
	/** False on the signed-out hero — the row stays visible but inert with the
	 *  signInFirst hint (attachments cannot survive the auth redirect). */
	attachmentsEnabled: boolean;
	onAttach: () => void;
	connectorsEnabled: boolean;
	onConnectApps: () => void;
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
								"rounded-full border-border bg-transparent shadow-none transition-[transform,color,background-color,border-color] duration-200 hover:border-primary/30 hover:bg-primary/10 hover:text-foreground active:translate-y-px",
								// Compact = ink plus icon on a plain hairline circle (dc reference).
								isHero
									? "size-9 text-muted-foreground"
									: "size-[30px] text-foreground",
							)}
						>
							<Plus className={isHero ? "size-4" : "size-[15px]"} />
						</Button>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent>{addMenuLabel}</TooltipContent>
			</Tooltip>
			<DropdownMenuContent
				align="start"
				sideOffset={8}
				collisionPadding={12}
				className="w-64 rounded-2xl border-border p-1.5 shadow-[0_18px_50px_-24px_rgb(0_0_0/0.36)]"
			>
				<DropdownMenuSub>
					<DropdownMenuSubTrigger className="rounded-xl px-2 py-2">
						<WandSparkles className="size-4 text-primary" />
						<span>{t("projects.promptBox.addSkillLabel")}</span>
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent
						sideOffset={10}
						className="w-[22rem] max-w-[calc(100vw-1.5rem)] rounded-2xl border-border p-1.5 shadow-[0_18px_50px_-24px_rgb(0_0_0/0.36)]"
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
					disabled={!attachmentsEnabled}
					onSelect={(event) => {
						if (!attachmentsEnabled) {
							event.preventDefault();
							return;
						}
						onAttach();
					}}
				>
					<Paperclip className="size-4" />
					<span className="flex min-w-0 flex-col">
						<span>{t("projects.promptBox.attachLabel")}</span>
						<span className="truncate text-muted-foreground text-xs">
							{attachmentsEnabled
								? t("projects.promptBox.attachHint")
								: t("projects.promptBox.attachments.signInFirst")}
						</span>
					</span>
				</DropdownMenuItem>
				<DropdownMenuItem
					className="rounded-xl px-2 py-2"
					disabled={!connectorsEnabled}
					onSelect={(event) => {
						if (!connectorsEnabled) {
							event.preventDefault();
							return;
						}
						onConnectApps();
					}}
				>
					<Plug className="size-4" />
					<span className="flex min-w-0 flex-col">
						<span>{t("projects.promptBox.connectApps")}</span>
						{!connectorsEnabled ? (
							<span className="truncate text-muted-foreground text-xs">
								{t("projects.connectors.signInFirst")}
							</span>
						) : null}
					</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function AttachedSkillChips({
	skills,
	selectedSkillIds,
	onToggleSkill,
	onRemove,
}: {
	skills: readonly SkillFileDef[];
	selectedSkillIds: readonly SkillFileId[];
	onToggleSkill: (skill: SkillFileDef) => void;
	onRemove: (id: SkillFileId) => void;
}) {
	const { t } = useTranslation();
	const pb = useDictionary().projects.promptBox;
	if (skills.length === 0) return null;

	const hasOverflow = skills.length > MAX_VISIBLE_SKILLS;
	const visibleSkills = hasOverflow
		? skills.slice(0, MAX_VISIBLE_SKILLS)
		: skills;
	const hiddenSkills = hasOverflow ? skills.slice(MAX_VISIBLE_SKILLS) : [];

	return (
		<div className="flex flex-wrap gap-1.5 px-4 pt-3 sm:px-5">
			{visibleSkills.map((skill) => {
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
			{hiddenSkills.length > 0 ? (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							aria-label={t("projects.promptBox.moreSkillsLabel", {
								count: hiddenSkills.length,
							})}
							title={hiddenSkills
								.map((skill) => pb.skills[skill.id].label)
								.join(", ")}
							className="inline-flex h-7 items-center rounded-full border border-border bg-muted/60 px-2.5 font-medium text-muted-foreground text-xs tabular-nums transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-foreground data-[state=open]:border-primary/30 data-[state=open]:bg-primary/10 data-[state=open]:text-foreground"
						>
							+{hiddenSkills.length}
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="start"
						sideOffset={8}
						collisionPadding={12}
						className="w-[22rem] max-w-[calc(100vw-1.5rem)] rounded-2xl border-border p-1.5 shadow-[0_18px_50px_-24px_rgb(0_0_0/0.36)]"
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
					</DropdownMenuContent>
				</DropdownMenu>
			) : null}
		</div>
	);
}

function AttachmentChips({
	attachments,
	onRemove,
	onRetry,
}: {
	attachments: readonly ComposerAttachment[];
	onRemove: (id: string) => void;
	onRetry: (id: string) => void;
}) {
	const pb = useDictionary().projects.promptBox;
	if (attachments.length === 0) return null;

	return (
		<div className="flex flex-wrap gap-1.5 px-4 pt-3 sm:px-5">
			{attachments.map((attachment) => {
				const isError = attachment.status === "error";
				const errorLabel =
					attachment.error === "unsupported"
						? pb.attachments.unsupported
						: attachment.error === "too-large"
							? pb.attachments.tooLarge
							: pb.attachments.failed;
				return (
					<span
						key={attachment.id}
						className={cn(
							"inline-flex h-9 max-w-full items-center gap-2 rounded-xl border px-1.5 text-xs",
							isError
								? "border-destructive/40 bg-destructive/10 text-destructive"
								: "border-border bg-muted/60 text-foreground",
						)}
					>
						{attachment.previewUrl ? (
							<span className="relative size-6 shrink-0 overflow-hidden rounded-lg">
								<img
									src={attachment.previewUrl}
									alt=""
									className="size-full object-cover"
								/>
								{attachment.status === "uploading" ? (
									<span className="absolute inset-0 grid place-items-center bg-black/40">
										<Loader2 className="size-3 animate-spin text-white" />
									</span>
								) : null}
							</span>
						) : (
							<span className="grid size-6 shrink-0 place-items-center rounded-lg border border-border bg-background text-muted-foreground">
								{attachment.status === "uploading" ? (
									<Loader2 className="size-3 animate-spin" />
								) : (
									<FileText className="size-3" />
								)}
							</span>
						)}
						<span className="min-w-0">
							<span dir="auto" className="block max-w-36 truncate">
								{attachment.filename}
							</span>
							{attachment.status === "uploading" ? (
								<span className="block text-[10px] text-muted-foreground">
									{pb.attachments.uploading}
								</span>
							) : isError ? (
								<span className="block max-w-36 truncate text-[10px]">
									{errorLabel}
								</span>
							) : null}
						</span>
						{isError && attachment.error === "failed" && attachment.file ? (
							<button
								type="button"
								aria-label={pb.attachments.retry}
								title={pb.attachments.retry}
								onClick={() => onRetry(attachment.id)}
								className="rounded-full p-0.5 text-destructive transition-colors hover:bg-destructive/15"
							>
								<RefreshCw className="size-3" />
							</button>
						) : null}
						<button
							type="button"
							aria-label={pb.attachments.remove}
							onClick={() => onRemove(attachment.id)}
							className={cn(
								"rounded-full p-0.5 transition-colors",
								isError
									? "text-destructive hover:bg-destructive/15"
									: "text-muted-foreground hover:bg-primary/10 hover:text-foreground",
							)}
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
						// The mode chip is a small jewel: an ember medallion nested at the
						// start of a parchment pill. Hover tints the hairline and lifts it
						// a touch; open blooms a soft ember halo around it.
						"group/trigger rounded-full border-border bg-background shadow-none transition-[border-color,box-shadow,background-color] duration-200",
						"hover:border-primary/35 hover:text-foreground hover:shadow-[0_2px_10px_-4px_rgb(0_0_0_/_0.2)]",
						"data-[state=open]:border-primary/40 data-[state=open]:text-foreground data-[state=open]:ring-[3px] data-[state=open]:ring-primary/10",
						isHero
							? "h-9 gap-2 ps-[5px] pe-3 text-muted-foreground"
							: "h-[30px] gap-1.5 ps-1 pe-2.5 text-[13px] text-foreground",
					)}
				>
					<span
						aria-hidden
						className={cn(
							"grid shrink-0 place-items-center rounded-full bg-primary/10 text-primary transition-colors duration-200 group-hover/trigger:bg-primary/15 group-data-[state=open]/trigger:bg-primary/15",
							isHero ? "size-[26px]" : "size-[22px]",
						)}
					>
						<SelectedIcon className={isHero ? "size-3.5" : "size-3"} />
					</span>
					<span className="max-w-24 truncate">{selectedModeCopy.label}</span>
					<ChevronDown
						className={cn(
							"transition-transform duration-200 group-data-[state=open]/trigger:rotate-180",
							isHero ? "size-3.5" : "size-[11px] opacity-50",
						)}
					/>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				sideOffset={8}
				collisionPadding={12}
				className="w-72 rounded-2xl border-border p-1.5 shadow-[0_18px_50px_-24px_rgb(0_0_0/0.36)]"
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

// Dev-only chip next to the mode picker: overrides the page-builder model per
// message (composer options.builderModel). Hidden outside local dev builds.
function BuilderModelPicker({
	value,
	onValueChange,
	isHero,
}: {
	value: string;
	onValueChange: (id: string) => void;
	isHero: boolean;
}) {
	const selected = getBuilderModelOption(value);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					aria-label={`Builder model: ${selected.label}`}
					className={cn(
						"group/trigger rounded-full border-border bg-background shadow-none transition-[border-color,box-shadow,background-color] duration-200",
						"hover:border-primary/35 hover:text-foreground",
						"data-[state=open]:border-primary/40 data-[state=open]:text-foreground",
						isHero
							? "h-9 gap-1.5 px-3 text-muted-foreground"
							: "h-[30px] gap-1.5 px-2.5 text-[13px] text-foreground",
					)}
				>
					<Gauge className={isHero ? "size-3.5" : "size-3"} />
					<span className="max-w-32 truncate">{selected.label}</span>
					<ChevronDown
						className={cn(
							"transition-transform duration-200 group-data-[state=open]/trigger:rotate-180",
							isHero ? "size-3.5" : "size-[11px] opacity-50",
						)}
					/>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				sideOffset={8}
				collisionPadding={12}
				className="w-60 rounded-2xl border-border p-1.5 shadow-[0_18px_50px_-24px_rgb(0_0_0/0.36)]"
			>
				<DropdownMenuLabel className="px-2 pt-1 pb-1.5 font-mono font-normal text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
					Builder model (dev)
				</DropdownMenuLabel>
				<DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
					{BUILDER_MODELS.map((model) => (
						<DropdownMenuRadioItemBare
							key={model.id}
							value={model.id}
							className="data-[state=checked]:bg-primary/10"
						>
							<span className="min-w-0 flex-1 truncate text-sm">
								{model.label}
							</span>
							<Check className="ms-auto size-4 shrink-0 scale-90 text-primary opacity-0 transition-[opacity,transform] group-data-[state=checked]/row:scale-100 group-data-[state=checked]/row:opacity-100" />
						</DropdownMenuRadioItemBare>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// Dev-only chip next to the builder-model picker: overrides the page-builder
// reasoning effort per message (composer options.builderReasoning). "Auto"
// sends nothing — the provider decides. Hidden outside local dev builds.
function BuilderReasoningPicker({
	value,
	onValueChange,
	isHero,
}: {
	value: string;
	onValueChange: (id: string) => void;
	isHero: boolean;
}) {
	const selected = getBuilderReasoningOption(value);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					aria-label={`Builder reasoning: ${selected.label}`}
					className={cn(
						"group/trigger rounded-full border-border bg-background shadow-none transition-[border-color,box-shadow,background-color] duration-200",
						"hover:border-primary/35 hover:text-foreground",
						"data-[state=open]:border-primary/40 data-[state=open]:text-foreground",
						isHero
							? "h-9 gap-1.5 px-3 text-muted-foreground"
							: "h-[30px] gap-1.5 px-2.5 text-[13px] text-foreground",
					)}
				>
					<BrainCircuit className={isHero ? "size-3.5" : "size-3"} />
					<span className="max-w-32 truncate">{selected.label}</span>
					<ChevronDown
						className={cn(
							"transition-transform duration-200 group-data-[state=open]/trigger:rotate-180",
							isHero ? "size-3.5" : "size-[11px] opacity-50",
						)}
					/>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				sideOffset={8}
				collisionPadding={12}
				className="w-52 rounded-2xl border-border p-1.5 shadow-[0_18px_50px_-24px_rgb(0_0_0/0.36)]"
			>
				<DropdownMenuLabel className="px-2 pt-1 pb-1.5 font-mono font-normal text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
					Builder reasoning (dev)
				</DropdownMenuLabel>
				<DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
					{BUILDER_REASONING_LEVELS.map((level) => (
						<DropdownMenuRadioItemBare
							key={level.id}
							value={level.id}
							className="data-[state=checked]:bg-primary/10"
						>
							<span className="min-w-0 flex-1 truncate text-sm">
								{level.label}
							</span>
							<Check className="ms-auto size-4 shrink-0 scale-90 text-primary opacity-0 transition-[opacity,transform] group-data-[state=checked]/row:scale-100 group-data-[state=checked]/row:opacity-100" />
						</DropdownMenuRadioItemBare>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// Same calm, no-bounce ease as the chat tray's TRAY_EASE — the settings
// wizard is composer chrome, so its motion stays quiet.
const STEP_EASE = [0.32, 0.72, 0, 1] as const;
const STEP_TRANSITION = { duration: 0.34, ease: STEP_EASE };

type SettingsStep = "type" | "options";
const SETTINGS_STEPS: readonly SettingsStep[] = ["type", "options"];

/**
 * Height of a wizard panel, measured through a callback ref: Radix mounts the
 * popover content one commit AFTER `open` flips, so a layout effect keyed on
 * `open` sees null refs — a callback ref fires at the actual mount instead.
 * A ResizeObserver keeps the value honest while the panel is on screen.
 */
function usePanelHeight(): [number, (el: HTMLDivElement | null) => void] {
	const [height, setHeight] = useState(0);
	const observerRef = useRef<ResizeObserver | null>(null);

	const measureRef = useCallback((el: HTMLDivElement | null) => {
		observerRef.current?.disconnect();
		observerRef.current = null;
		if (!el) return;
		const measure = () => setHeight(el.offsetHeight);
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		observerRef.current = observer;
	}, []);

	return [height, measureRef];
}

/**
 * The composer's one generation-config surface: a settings popover that walks
 * two steps — 1) the output TYPE for the active mode, 2) that output's
 * options. Replaces the old standalone output chip so the footer stays to one
 * pill. Panels slide horizontally (direction-aware for RTL) and the popover
 * height glides between the two panels' heights. Modes with a single output
 * skip the type step; auto mode has no settings surface.
 */
function OutputSettings({
	outputs,
	output,
	onSelectOutput,
	values,
	onValueChange,
	isHero,
}: {
	/** Every output of the active mode — the wizard's type step. */
	outputs: readonly GenerationOutputDef[];
	output: GenerationOutputDef | null;
	/** Applied live on the type step; must NOT steal focus from the popover. */
	onSelectOutput: (output: GenerationOutputDef) => void;
	values: Record<string, string>;
	onValueChange: (groupId: string, choiceId: string) => void;
	isHero: boolean;
}) {
	const { t, dir } = useTranslation();
	const pb = useDictionary().projects.promptBox;
	const hasTypeStep = outputs.length > 1;
	const [open, setOpen] = useState(false);
	const [step, setStep] = useState<SettingsStep>("type");
	// The popover height follows the ACTIVE panel's measured height so it
	// glides between steps instead of holding the taller panel's size.
	const [typeHeight, typePanelRef] = usePanelHeight();
	const [optionsHeight, optionsPanelRef] = usePanelHeight();
	const activeHeight = step === "type" ? typeHeight : optionsHeight;

	if (!output) return null;

	const OutputIcon = output.icon;
	const outputCopy = pb.outputs[output.id];
	const optionsCopy = outputCopy.options as unknown as Record<
		string,
		OptionCopy
	>;
	const modeCopy = pb.routeModes[output.mode];
	const settingsLabel = t("projects.promptBox.settingsLabel");

	const handleOpenChange = (next: boolean) => {
		setOpen(next);
		if (next) {
			setStep(hasTypeStep ? "type" : "options");
		}
	};

	const typePanel = hasTypeStep ? (
		<>
			<div className="border-border border-b px-4 py-3">
				<div className="flex items-center gap-2">
					<IconTile icon={getMode(output.mode).icon} active />
					<div className="min-w-0">
						<p className="font-medium text-sm leading-tight">
							{t("projects.promptBox.outputsHeading", {
								mode: modeCopy.label,
							})}
						</p>
						<p className="mt-0.5 text-muted-foreground text-xs">
							{modeCopy.description}
						</p>
					</div>
				</div>
			</div>
			<div className="p-1.5">
				{outputs.map((item) => {
					const itemCopy = pb.outputs[item.id];
					const selected = item.id === output.id;
					return (
						<button
							key={item.id}
							type="button"
							aria-pressed={selected}
							onClick={() => onSelectOutput(item)}
							className={cn(
								"flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-start transition-colors",
								selected ? "bg-primary/10" : "hover:bg-accent/70",
							)}
						>
							<IconTile icon={item.icon} active={selected} />
							<span className="min-w-0 flex-1">
								<span className="block font-medium text-sm leading-tight">
									{itemCopy.label}
								</span>
								<span className="mt-0.5 block text-muted-foreground text-xs leading-snug">
									{itemCopy.description}
								</span>
							</span>
							<Check
								className={cn(
									"ms-auto size-4 shrink-0 text-primary transition-[opacity,transform]",
									selected ? "scale-100 opacity-100" : "scale-90 opacity-0",
								)}
							/>
						</button>
					);
				})}
			</div>
		</>
	) : null;

	const optionsPanel = (
		<>
			<div className="border-border border-b px-4 py-3">
				<div className="flex items-center gap-2">
					<IconTile icon={OutputIcon} active />
					<div className="min-w-0">
						<p className="font-medium text-sm leading-tight">
							{outputCopy.label}
						</p>
						<p className="mt-0.5 text-muted-foreground text-xs">
							{t("projects.promptBox.settingsSubtitle", {
								mode: modeCopy.label.toLowerCase(),
							})}
						</p>
					</div>
				</div>
			</div>
			<div className="space-y-4 p-4">
				{output.options.map((group) => {
					if (!isGroupVisible(group, values)) return null;
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
													: "border-border bg-background/60 text-muted-foreground hover:border-primary/25 hover:bg-accent/70 hover:text-foreground",
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
		</>
	);

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<Tooltip>
				<TooltipTrigger asChild>
					<PopoverTrigger asChild>
						{/* Quiet icon-only trigger — the chosen output stays inside the
						    settings panel (and in the aria-label for screen readers)
						    instead of crowding the composer with a labeled pill. */}
						<Button
							type="button"
							variant="outline"
							size="icon-sm"
							aria-label={`${settingsLabel}: ${outputCopy.label}`}
							className={cn(
								"rounded-full border-border bg-transparent text-muted-foreground shadow-none transition-colors hover:border-primary/25 hover:bg-accent/70 hover:text-foreground data-[state=open]:border-primary/30 data-[state=open]:bg-primary/10 data-[state=open]:text-foreground",
								isHero ? "size-9" : "size-[30px]",
							)}
						>
							<SlidersHorizontal className="size-4" />
						</Button>
					</PopoverTrigger>
				</TooltipTrigger>
				<TooltipContent>{settingsLabel}</TooltipContent>
			</Tooltip>
			<PopoverContent
				align="start"
				sideOffset={8}
				collisionPadding={12}
				className="w-[22rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border-border p-0 shadow-[0_22px_70px_-28px_rgb(0_0_0/0.42)]"
			>
				{hasTypeStep ? (
					<>
						<motion.div
							initial={false}
							animate={{ height: activeHeight > 0 ? activeHeight : "auto" }}
							transition={STEP_TRANSITION}
							className="overflow-hidden"
						>
							<motion.div
								initial={false}
								// -50% of the 200%-wide track = one popover width. Flex
								// order flips under dir="rtl", so the offset flips too.
								animate={{
									x: step === "type" ? "0%" : dir === "rtl" ? "50%" : "-50%",
								}}
								transition={STEP_TRANSITION}
								className="flex w-[200%] items-start"
							>
								<div
									ref={typePanelRef}
									inert={step !== "type"}
									className="w-1/2"
								>
									{typePanel}
								</div>
								<div
									ref={optionsPanelRef}
									inert={step !== "options"}
									className="w-1/2"
								>
									{optionsPanel}
								</div>
							</motion.div>
						</motion.div>
						<div className="flex items-center gap-2 border-border border-t px-3 py-2.5">
							<div aria-hidden className="flex items-center gap-1">
								{SETTINGS_STEPS.map((id) => (
									<span
										key={id}
										className={cn(
											"h-1.5 rounded-full transition-all duration-300",
											id === step ? "w-4 bg-primary" : "w-1.5 bg-border",
										)}
									/>
								))}
							</div>
							<span aria-live="polite" className="sr-only">
								{t("projects.promptBox.stepLabel", {
									current: step === "type" ? 1 : 2,
									total: SETTINGS_STEPS.length,
								})}
							</span>
							<div className="ms-auto flex items-center gap-1.5">
								{step === "options" ? (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => setStep("type")}
										className="rounded-full text-muted-foreground hover:text-foreground"
									>
										<ChevronLeft className="size-3.5 rtl:rotate-180" />
										{t("projects.promptBox.stepBack")}
									</Button>
								) : null}
								{step === "type" ? (
									<Button
										type="button"
										size="sm"
										onClick={() => setStep("options")}
										className="rounded-full"
									>
										{t("projects.promptBox.stepNext")}
										<ChevronRight className="size-3.5 rtl:rotate-180" />
									</Button>
								) : (
									<Button
										type="button"
										size="sm"
										onClick={() => setOpen(false)}
										className="rounded-full"
									>
										<Check className="size-3.5" />
										{t("projects.promptBox.stepDone")}
									</Button>
								)}
							</div>
						</div>
					</>
				) : (
					<>
						{optionsPanel}
						<div className="flex items-center justify-end border-border border-t px-3 py-2.5">
							<Button
								type="button"
								size="sm"
								onClick={() => setOpen(false)}
								className="rounded-full"
							>
								<Check className="size-3.5" />
								{t("projects.promptBox.stepDone")}
							</Button>
						</div>
					</>
				)}
			</PopoverContent>
		</Popover>
	);
}

export type PromptBoxSubmitOverride = {
	/** Visible copy for the ember action that replaces the send arrow. */
	label: string;
	/** The caller owns answer validity; PromptBox still also respects isSubmitting. */
	disabled: boolean;
	/** Confirm the caller's current draft with its successfully uploaded
	 * attachments. A false return or rejection keeps the textarea and files. */
	onSubmit: (
		attachments: UploadAttachmentResponse[],
		// biome-ignore lint/suspicious/noConfusingVoidType: void keeps fire-and-forget overrides assignable
	) => void | boolean | Promise<void | boolean>;
};

export type PromptBoxProps = {
	/** A `false` return or rejected Promise means nothing was sent, so the box
	 * keeps its draft even with clearOnSubmit. The composer metadata mirrors the
	 * current mode/output/skills/option UI state; attachments are the
	 * successfully uploaded assets (empty when disabled or not attached). */
	onSubmit: (
		prompt: string,
		composer: ComposerMetadata,
		attachments: UploadAttachmentResponse[],
		// biome-ignore lint/suspicious/noConfusingVoidType: void keeps fire-and-forget callers assignable
	) => void | boolean | Promise<void | boolean>;
	/** Enables the "+" attach flow (upload to R2, chips, submit forwarding).
	 * Leave false on signed-out surfaces — uploads require a session. */
	attachmentsEnabled?: boolean;
	variant?: "hero" | "compact";
	placeholder?: string;
	/** Tinted strip above the card (ai-chat-v2 style). */
	showBanner?: boolean;
	/** Legacy prop kept for call sites; the composer always exposes modes. */
	showModes?: boolean;
	/** Legacy prop kept for call sites; model selection is not shown for pages. */
	showEngines?: boolean;
	isSubmitting?: boolean;
	/** Hard-disable the composer (e.g. the workspace is out of credits).
	 * Blocks typing, dictation and every submit path; the caller renders its
	 * own notice above the box explaining why. */
	disabled?: boolean;
	initialValue?: string;
	/** Restores the selected workflow after an auth redirect. Uploaded files are
	 * intentionally not serialized. */
	initialComposer?: ComposerMetadata;
	/** Clear the textarea after submitting (chat-style usage). */
	clearOnSubmit?: boolean;
	/** Rendered inside the rounded card, ABOVE the textarea — the chat's
	 * request tray docks here so it fuses into the composer (the slot content
	 * brings its own background + bottom divider). */
	topSlot?: React.ReactNode;
	/** Replace the normal send action in-place for contextual flows such as an
	 * ask_user answer. Omit it to preserve the standard prompt behavior. */
	submitOverride?: PromptBoxSubmitOverride;
	/** Observe the draft as it changes (and when it clears on submit) — lets
	 * the chat pane derive tray states like "typing overrides the chips"
	 * without taking over this component's own value state. */
	onValueChange?: (value: string) => void;
	/** Reports the dev builder pick as a gateway model id (or "default") so
	 * chat chrome can use it only when the transcript has no build truth yet. */
	onBuilderModelChange?: (modelId: string) => void;
	className?: string;
};

export function PromptBox({
	onSubmit,
	attachmentsEnabled = false,
	variant = "hero",
	placeholder,
	showBanner = false,
	isSubmitting = false,
	disabled = false,
	initialValue = "",
	initialComposer,
	clearOnSubmit = false,
	topSlot,
	submitOverride,
	onValueChange,
	onBuilderModelChange,
	className,
}: PromptBoxProps) {
	const { t } = useTranslation();
	const { data: session } = useSession();
	const pb = useDictionary().projects.promptBox;
	const initialRouteMode = initialComposer?.mode ?? "auto";
	const requestedInitialOutput = initialComposer?.output
		? getOutput(initialComposer.output as GenerationOutputId)
		: null;
	const initialOutput =
		requestedInitialOutput?.mode === initialRouteMode
			? requestedInitialOutput
			: getDefaultOutput(initialRouteMode);
	const initialOptions = initialOutput
		? restoreOutputOptions(initialOutput, initialComposer?.options)
		: {};
	const [value, setValue] = useState(initialValue);
	const [routeMode, setRouteMode] = useState<RouteMode>(initialRouteMode);
	const [selectedOutputId, setSelectedOutputId] =
		useState<GenerationOutputId | null>(initialOutput?.id ?? null);
	const [outputOptions, setOutputOptions] =
		useState<Record<string, string>>(initialOptions);
	// Dev-only builder override (see BUILDER_MODELS); localStorage-backed so
	// the choice survives the remounts between hero and chat composers.
	const [builderModel, setBuilderModelState] = useState(() =>
		readStoredBuilderModel(initialComposer?.options?.builderModel),
	);
	const setBuilderModel = useCallback(
		(id: string) => {
			const selection = getBuilderModelOption(id);
			setBuilderModelState(selection.id);
			try {
				window.localStorage.setItem(BUILDER_MODEL_STORAGE_KEY, selection.id);
			} catch {
				// Private-mode storage failures just lose persistence, not the pick.
			}
			onBuilderModelChange?.(selection.gatewayModelId);
		},
		[onBuilderModelChange],
	);
	// Dev-only builder reasoning override; same localStorage persistence
	// pattern as the model pick. "auto" = send nothing, provider decides.
	const [builderReasoning, setBuilderReasoningState] = useState(() =>
		readStoredBuilderReasoning(initialComposer?.options?.builderReasoning),
	);
	const setBuilderReasoning = useCallback((id: string) => {
		const selection = getBuilderReasoningOption(id);
		setBuilderReasoningState(selection.id);
		try {
			window.localStorage.setItem(BUILDER_REASONING_STORAGE_KEY, selection.id);
		} catch {
			// Private-mode storage failures just lose persistence, not the pick.
		}
	}, []);
	const [selectedSkillIds, setSelectedSkillIds] = useState<SkillFileId[]>(() =>
		(initialComposer?.skills ?? []).filter((id): id is SkillFileId =>
			Boolean(getSkillFile(id as SkillFileId)),
		),
	);
	const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
	const [isDraggingFiles, setIsDraggingFiles] = useState(false);
	const [isLocallySubmitting, setIsLocallySubmitting] = useState(false);
	const [connectorsOpen, setConnectorsOpen] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const submitInFlightRef = useRef(false);
	const fileDragDepthRef = useRef(0);

	// Mirror for unmount cleanup — object URLs leak without an explicit revoke.
	const attachmentsRef = useRef(attachments);
	useEffect(() => {
		attachmentsRef.current = attachments;
	}, [attachments]);
	useEffect(
		() => () => {
			for (const attachment of attachmentsRef.current) {
				if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
			}
		},
		[],
	);

	const isHero = variant === "hero";
	const maxHeight = isHero ? 240 : 160;
	const readyAttachments = useMemo(
		() => attachments.filter((attachment) => attachment.status === "ready"),
		[attachments],
	);
	const selectedOutput = useMemo(
		() => getOutput(selectedOutputId),
		[selectedOutputId],
	);
	const hasUploadingAttachment = attachments.some(
		(attachment) => attachment.status === "uploading",
	);
	const submissionPending = isSubmitting || isLocallySubmitting;
	const hasAttachmentCapacity = attachments.length < MAX_ATTACHMENTS;
	const canAcceptDroppedFiles =
		attachmentsEnabled &&
		!disabled &&
		!submissionPending &&
		hasAttachmentCapacity;
	const hasRequiredInput =
		value.trim().length > 0 || readyAttachments.length > 0;
	const canSubmit =
		!disabled &&
		(submitOverride
			? !submitOverride.disabled &&
				!submissionPending &&
				!hasUploadingAttachment
			: hasRequiredInput && !submissionPending && !hasUploadingAttachment);
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

	// biome-ignore lint/correctness/useExhaustiveDependencies: value/chip counts are intentional re-measure triggers
	useEffect(() => {
		resize();
	}, [resize, value, attachedSkills.length, attachments.length]);

	const runUpload = useCallback(async (id: string, file: File) => {
		try {
			const uploaded = await uploadAttachment(file);
			setAttachments((current) =>
				current.map((attachment) =>
					attachment.id === id
						? { ...attachment, status: "ready", uploaded, error: undefined }
						: attachment,
				),
			);
		} catch (error) {
			const reason =
				error instanceof AttachmentUploadError ? error.reason : "failed";
			setAttachments((current) =>
				current.map((attachment) =>
					attachment.id === id
						? { ...attachment, status: "error", error: reason }
						: attachment,
				),
			);
		}
	}, []);

	const handleFilesPicked = useCallback(
		(files: FileList | File[]) => {
			const room = MAX_ATTACHMENTS - attachmentsRef.current.length;
			if (room <= 0) return;
			const picked = Array.from(files).slice(0, room);
			if (picked.length === 0) return;
			const next = picked.map(toComposerAttachment);
			setAttachments((current) =>
				[...current, ...next].slice(0, MAX_ATTACHMENTS),
			);
			for (const attachment of next) {
				if (attachment.status === "uploading" && attachment.file) {
					void runUpload(attachment.id, attachment.file);
				}
			}
		},
		[runUpload],
	);

	const handleFileDragEnter = useCallback(
		(event: React.DragEvent<HTMLDivElement>) => {
			if (!isFileDrag(event.dataTransfer)) return;
			event.preventDefault();
			fileDragDepthRef.current += 1;
		},
		[],
	);

	const handleFileDragOver = useCallback(
		(event: React.DragEvent<HTMLDivElement>) => {
			if (!isFileDrag(event.dataTransfer)) return;
			const handledByChild = event.defaultPrevented;
			event.preventDefault();

			if (handledByChild) {
				setIsDraggingFiles(false);
				return;
			}

			event.dataTransfer.dropEffect = canAcceptDroppedFiles ? "copy" : "none";
			setIsDraggingFiles(canAcceptDroppedFiles);
		},
		[canAcceptDroppedFiles],
	);

	const handleFileDragLeave = useCallback(() => {
		fileDragDepthRef.current = Math.max(0, fileDragDepthRef.current - 1);
		if (fileDragDepthRef.current === 0) {
			setIsDraggingFiles(false);
		}
	}, []);

	const handleFileDrop = useCallback(
		(event: React.DragEvent<HTMLDivElement>) => {
			if (
				!isFileDrag(event.dataTransfer) &&
				event.dataTransfer.files.length === 0
			) {
				return;
			}

			const handledByChild = event.defaultPrevented;
			event.preventDefault();
			fileDragDepthRef.current = 0;
			setIsDraggingFiles(false);

			if (
				handledByChild ||
				!canAcceptDroppedFiles ||
				submitInFlightRef.current ||
				event.dataTransfer.files.length === 0
			) {
				return;
			}

			handleFilesPicked(event.dataTransfer.files);
		},
		[canAcceptDroppedFiles, handleFilesPicked],
	);

	const removeAttachment = useCallback((id: string) => {
		const found = attachmentsRef.current.find(
			(attachment) => attachment.id === id,
		);
		if (found?.previewUrl) URL.revokeObjectURL(found.previewUrl);
		setAttachments((current) =>
			current.filter((attachment) => attachment.id !== id),
		);
	}, []);

	const retryAttachment = useCallback(
		(id: string) => {
			const found = attachmentsRef.current.find(
				(attachment) => attachment.id === id,
			);
			if (!found?.file || found.error !== "failed") return;
			setAttachments((current) =>
				current.map((attachment) =>
					attachment.id === id
						? { ...attachment, status: "uploading", error: undefined }
						: attachment,
				),
			);
			void runUpload(id, found.file);
		},
		[runUpload],
	);

	const clearAttachments = useCallback(() => {
		for (const attachment of attachmentsRef.current) {
			if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
		}
		setAttachments([]);
	}, []);

	const {
		isRecording,
		isTranscribing,
		toggle: toggleRecording,
		supported: micSupported,
	} = useVoiceDictation(
		(text) => {
			setValue((prev) => {
				return prev ? `${prev.trimEnd()} ${text}` : text;
			});
			textareaRef.current?.focus();
		},
		{
			permissionDenied: t("projects.promptBox.micPermissionDenied"),
			transcribeError: t("projects.promptBox.micError"),
		},
	);

	// Snapshot of the composer chips (mode/output/skills/options) sent alongside
	// the prompt so the backend routes the generation the same way the UI shows.
	const buildComposer = (): ComposerMetadata => {
		const options: Record<string, unknown> = { ...outputOptions };
		const codMode = options.codMode;
		// `auto` delegates the choice to the Brain, while a hidden value from a
		// previous COD selection must not leak into another landing-page goal.
		if (options.goal !== "cod" || (codMode !== "simple" && codMode !== "max")) {
			delete options.codMode;
		}

		// Dev-only builder override: rides as a composer option so each
		// generate_page call snapshots the picked model — no server restart.
		if (builderModel !== DEFAULT_BUILDER_MODEL.id) {
			options.builderModel = builderModel;
		}

		// Dev-only reasoning override: "auto" is the server default, so only a
		// real pick is worth sending.
		if (builderReasoning !== DEFAULT_BUILDER_REASONING.id) {
			options.builderReasoning = builderReasoning;
		}

		return {
			mode: routeMode,
			output: selectedOutputId ?? undefined,
			skills: selectedSkillIds.length > 0 ? selectedSkillIds : undefined,
			options: Object.keys(options).length > 0 ? options : undefined,
		};
	};

	const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const next = e.target.value;
		setValue(next);
		onValueChange?.(next);
		resize();
	};

	const handleSubmit = async () => {
		if (disabled || submitInFlightRef.current) return;

		if (submitOverride) {
			if (
				submitOverride.disabled ||
				submissionPending ||
				hasUploadingAttachment
			) {
				return;
			}
			const uploadedAttachments = readyAttachments.flatMap((attachment) =>
				attachment.uploaded ? [attachment.uploaded] : [],
			);
			submitInFlightRef.current = true;
			setIsLocallySubmitting(true);
			try {
				const result = await submitOverride.onSubmit(uploadedAttachments);
				if (clearOnSubmit && result !== false) {
					setValue("");
					onValueChange?.("");
					clearAttachments();
					setSelectedSkillIds([]);
				}
			} catch {
				// The caller owns error presentation. Keeping the draft makes the
				// failed action retryable without reconstructing the answer.
			} finally {
				submitInFlightRef.current = false;
				setIsLocallySubmitting(false);
			}
			return;
		}

		const prompt = value.trim();
		if (
			submissionPending ||
			hasUploadingAttachment ||
			(prompt.length === 0 && readyAttachments.length === 0)
		) {
			return;
		}
		const uploadedAttachments = readyAttachments.flatMap((attachment) =>
			attachment.uploaded ? [attachment.uploaded] : [],
		);
		submitInFlightRef.current = true;
		setIsLocallySubmitting(true);
		try {
			const result = await onSubmit(
				prompt,
				buildComposer(),
				uploadedAttachments,
			);
			if (result !== false) {
				if (clearOnSubmit) {
					setValue("");
					onValueChange?.("");
					clearAttachments();
					// A skill applies to the message it was picked for. Dropping the
					// chips keeps the playbooks out of every later system prompt; the
					// director can still load one through read_skill.
					setSelectedSkillIds([]);
				}
			}
		} catch {
			// Chat and project callers surface their own localized error. Do not
			// discard a prompt or attachment that the server did not accept.
		} finally {
			submitInFlightRef.current = false;
			setIsLocallySubmitting(false);
		}
	};

	const micAriaLabel = isTranscribing
		? t("projects.promptBox.micTranscribing")
		: isRecording
			? t("projects.promptBox.micStop")
			: t("projects.promptBox.micLabel");
	const submitLabel =
		submitOverride?.label ?? t("projects.promptBox.submitLabel");

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			void handleSubmit();
		}
	};

	// Fired from the settings wizard's type step, which stays open — so no
	// textarea refocus here, and re-picking the same output keeps its options.
	const chooseOutput = (output: GenerationOutputDef) => {
		if (output.id === selectedOutputId) return;
		setSelectedOutputId(output.id);
		setOutputOptions(createDefaultOptions(output));
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

	const selectedOutputPlaceholder = selectedOutput
		? pb.outputs[selectedOutput.id].placeholder
		: undefined;
	const resolvedPlaceholder =
		placeholder ??
		selectedOutputPlaceholder ??
		(isHero ? pb.routeModes[routeMode].placeholder : pb.placeholderCompact);

	const box = (
		// biome-ignore lint/a11y/noStaticElementInteractions: file drag-and-drop enhances the existing keyboard-accessible attachment picker
		<div
			className="group/prompt relative"
			onDragEnter={handleFileDragEnter}
			onDragOver={handleFileDragOver}
			onDragLeave={handleFileDragLeave}
			onDrop={handleFileDrop}
		>
			{/* Soft ember focus ring (DESIGN.md --wd-ring) — the composer itself is
			    the one richly-shadowed surface, so focus stays quiet. */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 shadow-[0_0_0_3px_oklch(0.62_0.16_45_/_0.10)] transition-opacity duration-300 group-focus-within/prompt:opacity-100"
			/>
			<InputGroup
				className="relative h-auto flex-col items-stretch rounded-3xl border-0 bg-background shadow-composer dark:bg-card dark:shadow-[inset_0_1px_0_0_oklch(1_0_0_/_0.04)]"
				data-disabled={submissionPending || disabled}
			>
				{topSlot ? (
					// Clip the slot to the card's top radius — its content (the tray)
					// paints its own full-bleed background.
					<div className="w-full overflow-hidden rounded-t-3xl">{topSlot}</div>
				) : null}
				<AttachedSkillChips
					skills={attachedSkills}
					selectedSkillIds={selectedSkillIds}
					onToggleSkill={toggleSkillFile}
					onRemove={removeSkillFile}
				/>
				<AttachmentChips
					attachments={attachments}
					onRemove={removeAttachment}
					onRetry={retryAttachment}
				/>
				{attachmentsEnabled ? (
					<input
						ref={fileInputRef}
						type="file"
						multiple
						accept={ATTACHMENT_ACCEPT}
						className="hidden"
						onChange={(event) => {
							if (event.target.files) handleFilesPicked(event.target.files);
							// Reset so picking the same file again re-fires onChange.
							event.target.value = "";
						}}
					/>
				) : null}
				<InputGroupTextarea
					ref={textareaRef}
					dir="auto"
					value={value}
					onChange={handleChange}
					onKeyDown={handleKeyDown}
					placeholder={resolvedPlaceholder}
					rows={1}
					maxLength={projectPromptMaxLength}
					disabled={submissionPending || disabled}
					className={cn(
						"w-full overflow-y-auto py-0 text-foreground placeholder:text-muted-foreground disabled:opacity-60",
						isHero
							? "min-h-[78px] px-5 pb-1 text-base"
							: "min-h-[38px] px-4 pb-0 text-[15px] leading-[1.5]",
						attachedSkills.length > 0 || attachments.length > 0
							? "pt-2"
							: "pt-4",
					)}
				/>
				<InputGroupAddon
					align="block-end"
					className={cn(
						"flex w-full cursor-default flex-wrap items-center gap-2",
						isHero ? "px-4 pb-4" : "px-4 pt-1.5 pb-3",
					)}
				>
					<TooltipProvider>
						<AddContextMenu
							selectedSkillIds={selectedSkillIds}
							onToggleSkill={toggleSkillFile}
							attachmentsEnabled={attachmentsEnabled}
							onAttach={() => fileInputRef.current?.click()}
							connectorsEnabled={Boolean(session)}
							onConnectApps={() => setConnectorsOpen(true)}
							isHero={isHero}
						/>
						<ModePicker
							value={routeMode}
							onValueChange={handleModeChange}
							isHero={isHero}
						/>
						{import.meta.env.DEV ? (
							<>
								<BuilderModelPicker
									value={builderModel}
									onValueChange={setBuilderModel}
									isHero={isHero}
								/>
								<BuilderReasoningPicker
									value={builderReasoning}
									onValueChange={setBuilderReasoning}
									isHero={isHero}
								/>
							</>
						) : null}
						<OutputSettings
							outputs={routeMode === "auto" ? [] : OUTPUTS_BY_MODE[routeMode]}
							output={selectedOutput}
							onSelectOutput={chooseOutput}
							values={outputOptions}
							onValueChange={updateOutputOption}
							isHero={isHero}
						/>
						<div className="ms-auto flex items-center gap-1">
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										aria-label={micAriaLabel}
										aria-pressed={isRecording}
										onClick={toggleRecording}
										disabled={
											!micSupported ||
											submissionPending ||
											isTranscribing ||
											disabled
										}
										className={cn(
											"rounded-full text-muted-foreground hover:text-foreground",
											isHero ? "size-9" : "size-[30px]",
											isRecording &&
												"animate-pulse bg-destructive/10 text-destructive hover:text-destructive",
										)}
									>
										{isTranscribing ? (
											<Loader2 className="animate-spin" />
										) : (
											<Mic />
										)}
									</Button>
								</TooltipTrigger>
								<TooltipContent>{micAriaLabel}</TooltipContent>
							</Tooltip>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										type="button"
										size="icon"
										aria-label={submitLabel}
										onClick={() => void handleSubmit()}
										disabled={!canSubmit}
										className={cn(
											// The send circle is the gradient's one licensed cameo
											// on a control (DESIGN.md, Gradient System).
											"rounded-full bg-gradient-ember shadow-[0_2px_8px_-2px_rgb(0_0_0_/_0.3)] transition-opacity disabled:opacity-40",
											submitOverride
												? isHero
													? "h-9 w-auto gap-1.5 px-3"
													: "h-[30px] w-auto gap-1.5 px-3"
												: isHero
													? "size-9"
													: "size-[30px]",
										)}
									>
										{submitOverride ? (
											<>
												{submissionPending ? (
													<Loader2 className="size-3.5 animate-spin" />
												) : (
													<Check className="size-3.5" strokeWidth={2.4} />
												)}
												<span className="font-medium text-xs">
													{submitOverride.label}
												</span>
											</>
										) : submissionPending ? (
											<Loader2 className="animate-spin" />
										) : (
											<ArrowUp className="size-3.5" strokeWidth={2.2} />
										)}
									</Button>
								</TooltipTrigger>
								<TooltipContent>{submitLabel}</TooltipContent>
							</Tooltip>
						</div>
					</TooltipProvider>
				</InputGroupAddon>
			</InputGroup>
			{isDraggingFiles && canAcceptDroppedFiles ? (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-3xl border-[1.5px] border-primary/45 border-dashed bg-primary/8 text-primary backdrop-blur-[2px]"
				>
					<span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-background/90 px-3.5 py-2 font-medium text-sm shadow-sm">
						<Paperclip className="size-4" />
						{pb.attachments.dropHint}
					</span>
				</div>
			) : null}
		</div>
	);

	return (
		<>
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
			<ConnectorsDialog
				open={connectorsOpen}
				onOpenChange={setConnectorsOpen}
			/>
		</>
	);
}
