// Element panel — top of the inspector rail while something is targeted.
// Type-aware (inline-editor V4): section spacing/background; full typography
// for text leaves; image sizing/crop/radius; link/button surfaces; and form
// placeholders. Every control records a contract edit-op and live-applies it
// through the sandbox bridge; canonical HTML only changes on Save.

import {
	isSafeLinkHref,
	SECTION_PADDING_STEPS,
	type SectionPaddingStep,
} from "@wandit/contracts";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@wandit/ui/components/alert-dialog";
import { Button } from "@wandit/ui/components/button";
import { Input } from "@wandit/ui/components/input";
import { Separator } from "@wandit/ui/components/separator";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { Slider } from "@wandit/ui/components/slider";
import { Toggle } from "@wandit/ui/components/toggle";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@wandit/ui/components/toggle-group";
import { cn } from "@wandit/ui/lib/utils";
import {
	AlignCenter,
	AlignLeft,
	AlignRight,
	Crosshair,
	ImageIcon,
	Italic,
	Loader2,
	Minus,
	Plus,
	Trash2,
	Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { AttachmentUploadError, uploadAttachment } from "@/features/projects";
import { useTranslation } from "@/lib/i18n";
import {
	cssColorToHex,
	isFullyTransparentCssColor,
} from "../../lib/preview-editor/contrast";
import {
	type PreviewSelection,
	selectTargetMessage,
} from "../../lib/preview-editor/messages";
import { matchCuratedFontId } from "../../lib/preview-editor/parse-tokens";
import {
	type PendingElementStyle,
	usePageEditor,
} from "../../lib/use-page-editor";
import { ColorField, FontSelect } from "./inspector-controls";

/** Image types only (contract §7.2 allowlist minus documents). */
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif";

const TEXT_LEAF_TAGS = new Set([
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"p",
	"li",
	"blockquote",
	"figcaption",
	"label",
	"legend",
	"span",
]);

const IMAGE_WIDTHS = ["25%", "33%", "50%", "66%", "100%"] as const;
const FONT_WEIGHTS = [400, 500, 600, 700] as const;
const RADIUS_STEPS = [
	{ key: "none", value: "0px" },
	{ key: "s", value: "0.25rem" },
	{ key: "m", value: "0.75rem" },
	{ key: "l", value: "1.5rem" },
	{ key: "full", value: "9999px" },
] as const;

type SelectionStyles = PreviewSelection["styles"];

type PanelLoadingVariant =
	| "compact"
	| "image"
	| "section"
	| "surface"
	| "typography";

const SKELETON_CHIPS = ["one", "two", "three", "four", "five"] as const;

function PanelShimmer({ className }: { className?: string }) {
	return (
		<Skeleton
			aria-hidden
			className={cn(
				"animate-shimmer bg-[length:180%_100%] bg-[linear-gradient(90deg,var(--border)_25%,var(--secondary)_50%,var(--border)_75%)] motion-reduce:animate-none motion-reduce:bg-muted motion-reduce:bg-none",
				className,
			)}
		/>
	);
}

function LoadingField() {
	return (
		<div className="flex flex-col gap-1.5">
			<PanelShimmer className="h-2.5 w-20" />
			<PanelShimmer className="h-8 w-full" />
		</div>
	);
}

function LoadingSlider() {
	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between gap-3">
				<PanelShimmer className="h-2.5 w-20" />
				<PanelShimmer className="h-2.5 w-10" />
			</div>
			<PanelShimmer className="h-1.5 w-full rounded-full" />
		</div>
	);
}

function LoadingChoices({ columns = 5 }: { columns?: 2 | 5 }) {
	const chips = columns === 2 ? SKELETON_CHIPS.slice(0, 4) : SKELETON_CHIPS;
	return (
		<div className="flex flex-col gap-1.5">
			<PanelShimmer className="h-2.5 w-16" />
			<div
				className={cn(
					"grid gap-1",
					columns === 2 ? "grid-cols-2" : "grid-cols-5",
				)}
			>
				{chips.map((chip) => (
					<PanelShimmer key={chip} className="h-7" />
				))}
			</div>
		</div>
	);
}

function LoadingInlineControl() {
	return (
		<div className="flex items-center justify-between gap-3">
			<PanelShimmer className="h-2.5 w-20" />
			<PanelShimmer className="h-7 w-20" />
		</div>
	);
}

function AiApplyingStatus() {
	const { t } = useTranslation();
	return (
		<div
			role="status"
			aria-live="polite"
			aria-atomic="true"
			className="flex items-center gap-2 rounded-md border border-primary/15 bg-primary/5 px-2.5 py-2"
		>
			<span
				aria-hidden
				className="size-[7px] shrink-0 animate-pulse-soft rounded-full bg-primary motion-reduce:animate-none"
			/>
			<span className="font-medium text-foreground/80 text-xs">
				{t("workspace.page.editor.aiApplying")}
			</span>
		</div>
	);
}

function PanelControlSkeletons({ variant }: { variant: PanelLoadingVariant }) {
	return (
		<div
			data-slot="element-panel-skeleton"
			aria-hidden
			className="flex flex-col gap-3"
		>
			{variant === "image" ? <PanelShimmer className="h-28 w-full" /> : null}
			{variant === "typography" ? (
				<PanelShimmer className="h-12 w-full" />
			) : null}
			{variant === "section" ? (
				<>
					<LoadingChoices />
					<LoadingChoices />
				</>
			) : null}
			<LoadingField />
			{variant === "typography" ? (
				<>
					<LoadingSlider />
					<LoadingField />
					<LoadingChoices columns={2} />
					<LoadingInlineControl />
					<LoadingInlineControl />
					<LoadingSlider />
				</>
			) : null}
			{variant === "surface" ? (
				<>
					<LoadingField />
					<LoadingChoices />
				</>
			) : null}
			{variant === "image" ? (
				<>
					<LoadingChoices />
					<LoadingChoices />
					<LoadingInlineControl />
				</>
			) : null}
			{variant === "section" ? (
				<>
					<PanelShimmer className="h-20 w-full" />
					<PanelShimmer className="h-8 w-full" />
				</>
			) : null}
			{variant === "compact" ? <PanelShimmer className="h-8 w-full" /> : null}
		</div>
	);
}

export function postLadderSelection(
	post: ReturnType<typeof usePageEditor>["postToPreview"],
	wid: string,
): void {
	post(selectTargetMessage(wid));
}

// ── Link href parsing / construction (shared with the Données panel) ────────

/** What the link editor is editing: a phone number wearing one of its three
 *  href forms (rebuilt PRESERVING that form on commit), or a plain URL. */
export type LinkTarget =
	| { kind: "phone"; form: "tel"; number: string }
	| { kind: "phone"; form: "wa-me"; number: string; search: string }
	| { kind: "phone"; form: "wa-api"; number: string; href: string }
	| { kind: "url" };

/** Keep a leading +, strip every non-digit — tel: hrefs carry no spaces
 *  (isSafeLinkHref rejects whitespace outright). */
export function normalizePhone(input: string): string {
	const trimmed = input.trim();
	const digits = trimmed.replace(/\D/g, "");
	if (digits === "") return "";
	return trimmed.startsWith("+") ? `+${digits}` : digits;
}

export function parseLinkTarget(href: string): LinkTarget {
	const trimmed = href.trim();
	if (trimmed.toLowerCase().startsWith("tel:")) {
		return { kind: "phone", form: "tel", number: trimmed.slice(4) };
	}
	try {
		const url = new URL(trimmed);
		const host = url.hostname.toLowerCase().replace(/^www\./, "");
		if (host === "wa.me") {
			return {
				kind: "phone",
				form: "wa-me",
				number: url.pathname.split("/").filter(Boolean)[0] ?? "",
				search: url.search,
			};
		}
		if (host === "api.whatsapp.com") {
			return {
				kind: "phone",
				form: "wa-api",
				number: url.searchParams.get("phone") ?? "",
				href: trimmed,
			};
		}
	} catch {
		// Not parseable as a URL — treat as a plain URL field below.
	}
	return { kind: "url" };
}

/** New user input → href in the target's ORIGINAL form (contract §6):
 *  tel keeps tel:, wa.me keeps its query string, api.whatsapp.com keeps the
 *  whole URL with only the phone param swapped. Null = nothing committable. */
export function buildLinkHref(
	target: LinkTarget,
	input: string,
): string | null {
	if (target.kind === "url") {
		const value = input.trim();
		return value === "" ? null : value;
	}
	if (target.form === "tel") {
		const number = normalizePhone(input);
		return number === "" ? null : `tel:${number}`;
	}
	const digits = input.replace(/\D/g, "");
	if (digits === "") return null;
	if (target.form === "wa-me") return `https://wa.me/${digits}${target.search}`;
	try {
		const url = new URL(target.href);
		url.searchParams.set("phone", digits);
		return url.toString();
	} catch {
		return null;
	}
}

export function ElementPanel() {
	const { t } = useTranslation();
	const editor = usePageEditor();
	const selection = editor.selection;
	if (!selection) return null;

	const pending = editor.pendingStyles[selection.wid];
	const isSection = selection.kind === "section";
	const isSurface = selection.kind === "surface";
	const isImage = selection.tag === "img";
	const isLink = selection.tag === "a";
	const isButton = selection.tag === "button";
	const isFormField = selection.tag === "input" || selection.tag === "textarea";
	const isTextLeaf = TEXT_LEAF_TAGS.has(selection.tag);
	const isPlaceholderImage =
		selection.isPlaceholderImage ||
		selection.wid in editor.pendingPlaceholderImages;
	const editControlsDisabled = editor.isAskAiDispatching;
	const loadingVariant: PanelLoadingVariant = isSection
		? "section"
		: isImage
			? "image"
			: isTextLeaf
				? "typography"
				: isSurface || isLink || isButton
					? "surface"
					: "compact";
	const ladder =
		selection.ladder.length > 0
			? selection.ladder
			: [
					{
						wid: selection.wid,
						kind: selection.kind,
						tag: selection.tag,
						label: selection.excerpt ?? selection.tag,
					},
				];

	return (
		<section className="flex flex-col gap-3 p-3.5">
			<header className="flex flex-col gap-1">
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
					{isSection
						? t("workspace.page.editor.section")
						: isSurface
							? t("workspace.page.editor.surface")
							: t("workspace.page.editor.element")}
				</span>
				<nav
					className="flex min-w-0 items-center gap-1.5 text-sm"
					aria-label={t("workspace.page.editor.selectionPath")}
				>
					<Crosshair className="size-3.5 shrink-0 text-primary" aria-hidden />
					<div className="flex min-w-0 items-center gap-1 overflow-hidden">
						{ladder.map((stop, index) => {
							const active = stop.wid === selection.wid;
							return (
								<span
									key={stop.wid}
									className="flex min-w-0 items-center gap-1"
								>
									{index > 0 ? (
										<span aria-hidden className="text-muted-foreground/50">
											·
										</span>
									) : null}
									<button
										type="button"
										aria-current={active ? "true" : undefined}
										aria-label={t("workspace.page.editor.selectLevel", {
											label: stop.label,
										})}
										title={stop.wid}
										onClick={() =>
											postLadderSelection(editor.postToPreview, stop.wid)
										}
										className={cn(
											"min-w-0 truncate rounded px-1 py-0.5 font-mono text-[11px] transition-colors",
											active
												? "bg-primary/12 text-primary"
												: "text-muted-foreground hover:bg-muted hover:text-foreground",
										)}
									>
										<bdi dir="ltr">{stop.tag}</bdi>
									</button>
								</span>
							);
						})}
					</div>
				</nav>
			</header>

			{editControlsDisabled ? <AiApplyingStatus /> : null}
			<fieldset
				disabled={editControlsDisabled}
				inert={editControlsDisabled ? true : undefined}
				aria-disabled={editControlsDisabled}
				className={cn(
					"m-0 min-w-0 border-0 p-0",
					editControlsDisabled && "pointer-events-none select-none",
				)}
			>
				{editControlsDisabled ? (
					<PanelControlSkeletons variant={loadingVariant} />
				) : null}
				<div data-slot="element-panel-controls" hidden={editControlsDisabled}>
					{isSection ? (
						<SectionControls
							wid={selection.wid}
							sectionStyles={selection.sectionStyles}
							bgImage={selection.bgImage}
						/>
					) : isSurface ? (
						<SurfaceControls
							wid={selection.wid}
							styles={selection.styles}
							pending={pending}
						/>
					) : (
						<div className="flex flex-col gap-3">
							{isImage ? (
								<ImageControls
									wid={selection.wid}
									src={selection.src}
									inlineWidth={selection.inlineWidth}
									styles={selection.styles}
									pending={pending}
								/>
							) : null}
							{isLink ? (
								// Keyed per wid so the draft resets when the target changes.
								<LinkEditor
									key={selection.wid}
									wid={selection.wid}
									href={selection.href}
								/>
							) : null}
							{isLink || isButton ? (
								<InteractiveStyleControls
									wid={selection.wid}
									styles={selection.styles}
									pending={pending}
								/>
							) : null}
							{isFormField ? (
								<PlaceholderEditor
									key={selection.wid}
									wid={selection.wid}
									placeholder={selection.placeholder}
								/>
							) : null}
							{isTextLeaf ? (
								<TextStyleControls
									wid={selection.wid}
									text={selection.text}
									textEditable={selection.textEditable}
									styles={selection.styles}
									pending={pending}
								/>
							) : null}
							{selection.removable ? (
								isImage && !isPlaceholderImage ? (
									<PlaceholderImageButton
										wid={selection.wid}
										styles={selection.styles}
									/>
								) : (
									<RemoveElementButton wid={selection.wid} />
								)
							) : null}
						</div>
					)}
				</div>
			</fieldset>
			<Separator />
		</section>
	);
}

function SurfaceControls({
	wid,
	styles,
	pending,
}: {
	wid: string;
	styles: SelectionStyles;
	pending: PendingElementStyle | undefined;
}) {
	const { t } = useTranslation();
	const editor = usePageEditor();
	const computedBackground = isFullyTransparentCssColor(styles.backgroundColor)
		? ""
		: (cssColorToHex(styles.backgroundColor) ?? styles.backgroundColor);

	return (
		<div className="flex flex-col gap-3">
			<ColorField
				label={t("workspace.page.editor.backgroundColor")}
				value={pending?.backgroundColor ?? computedBackground}
				onChange={(backgroundColor) =>
					editor.applyStyle(wid, { backgroundColor })
				}
			/>
			<RadiusControl
				wid={wid}
				computed={styles.borderRadius}
				pending={pending?.borderRadius}
			/>
		</div>
	);
}

function TextStyleControls({
	wid,
	text,
	textEditable,
	styles,
	pending,
}: {
	wid: string;
	text: string | null;
	textEditable: boolean;
	styles: SelectionStyles;
	pending: PendingElementStyle | undefined;
}) {
	const { t } = useTranslation();
	const editor = usePageEditor();

	const colorValue =
		pending?.color ?? cssColorToHex(styles.color) ?? styles.color;
	const sizeValue = Math.round(
		Number.parseFloat(pending?.fontSize ?? styles.fontSize) || 16,
	);
	const fontValue = pending?.fontFamily
		? matchCuratedFontId(pending.fontFamily)
		: matchCuratedFontId(styles.fontFamily);
	const weightValue = nearestFontWeight(
		pending?.fontWeight ?? styles.fontWeight,
	);
	const italic = (pending?.fontStyle ?? styles.fontStyle) === "italic";
	const alignment = normalizeTextAlign(styles.textAlign, styles.direction);
	const alignValue = pending?.textAlign ?? alignment;
	const lineHeightValue = clamp(
		pending?.lineHeight ??
			computedLineHeight(styles.lineHeight, styles.fontSize),
		1,
		2.5,
	);
	const letterSpacingValue = clamp(
		pending?.letterSpacing !== undefined
			? Number.parseFloat(pending.letterSpacing)
			: computedLetterSpacing(styles.letterSpacing, styles.fontSize),
		-0.05,
		0.5,
	);
	const StartIcon = styles.direction === "rtl" ? AlignRight : AlignLeft;
	const EndIcon = styles.direction === "rtl" ? AlignLeft : AlignRight;
	const weightLabels = [
		t("workspace.page.editor.weightNormal"),
		t("workspace.page.editor.weightMedium"),
		t("workspace.page.editor.weightSemibold"),
		t("workspace.page.editor.weightBold"),
	];

	return (
		<div className="flex flex-col gap-3">
			{text !== null ? (
				<div className="flex flex-col gap-1">
					<p
						dir="auto"
						className="line-clamp-2 rounded-md border bg-muted/40 px-2 py-1.5 text-muted-foreground text-xs leading-snug"
					>
						{text}
					</p>
					{editor.mode === "edit" && textEditable ? (
						<p className="text-[11px] text-muted-foreground/80">
							{t("workspace.page.editor.textHint")}
						</p>
					) : null}
				</div>
			) : null}

			<ColorField
				label={t("workspace.page.editor.color")}
				value={colorValue}
				onChange={(hex) => editor.applyStyle(wid, { color: hex })}
			/>

			<div className="flex flex-col gap-1.5">
				<div className="flex items-center justify-between">
					<span className="text-foreground/80 text-xs">
						{t("workspace.page.editor.fontSize")}
					</span>
					<span dir="ltr" className="font-mono text-muted-foreground text-xs">
						{sizeValue}px
					</span>
				</div>
				<Slider
					min={8}
					max={200}
					step={1}
					value={[Math.min(200, Math.max(8, sizeValue))]}
					onValueChange={([next]) => {
						if (typeof next === "number") {
							editor.applyStyle(wid, { fontSize: `${next}px` });
						}
					}}
					aria-label={t("workspace.page.editor.fontSize")}
				/>
			</div>

			<div className="flex flex-col gap-1.5">
				<span className="text-foreground/80 text-xs">
					{t("workspace.page.editor.fontFamily")}
				</span>
				<FontSelect
					value={fontValue}
					onChange={(id) => editor.applyStyle(wid, { fontFamily: id })}
					capability="any"
					placeholder={t("workspace.page.editor.pageFont")}
					ariaLabel={t("workspace.page.editor.fontFamily")}
				/>
			</div>

			<div className="flex flex-col gap-1.5">
				<span className="text-foreground/80 text-xs">
					{t("workspace.page.editor.fontWeight")}
				</span>
				<div className="grid grid-cols-2 gap-1">
					{FONT_WEIGHTS.map((weight, index) => (
						<button
							key={weight}
							type="button"
							aria-pressed={weightValue === weight}
							onClick={() => editor.applyStyle(wid, { fontWeight: weight })}
							className={choiceClass(weightValue === weight)}
						>
							<span>{weightLabels[index]}</span>
							<span dir="ltr" className="font-mono text-[10px] opacity-65">
								{weight}
							</span>
						</button>
					))}
				</div>
			</div>

			<div className="flex items-center justify-between gap-2">
				<span className="text-foreground/80 text-xs">
					{t("workspace.page.editor.italic")}
				</span>
				<Toggle
					variant="outline"
					size="sm"
					pressed={italic}
					onPressedChange={(pressed) =>
						editor.applyStyle(wid, {
							fontStyle: pressed ? "italic" : "normal",
						})
					}
					aria-label={t("workspace.page.editor.italic")}
				>
					<Italic aria-hidden />
				</Toggle>
			</div>

			<div className="flex items-center justify-between gap-2">
				<span className="text-foreground/80 text-xs">
					{t("workspace.page.editor.textAlign")}
				</span>
				<ToggleGroup
					type="single"
					variant="outline"
					size="sm"
					spacing={0}
					value={alignValue}
					onValueChange={(value) => {
						if (value === "start" || value === "center" || value === "end") {
							editor.applyStyle(wid, { textAlign: value });
						}
					}}
				>
					<ToggleGroupItem
						value="start"
						aria-label={t("workspace.page.editor.alignStart")}
					>
						<StartIcon aria-hidden />
					</ToggleGroupItem>
					<ToggleGroupItem
						value="center"
						aria-label={t("workspace.page.editor.alignCenter")}
					>
						<AlignCenter aria-hidden />
					</ToggleGroupItem>
					<ToggleGroupItem
						value="end"
						aria-label={t("workspace.page.editor.alignEnd")}
					>
						<EndIcon aria-hidden />
					</ToggleGroupItem>
				</ToggleGroup>
			</div>

			<div className="flex flex-col gap-1.5">
				<div className="flex items-center justify-between">
					<span className="text-foreground/80 text-xs">
						{t("workspace.page.editor.lineHeight")}
					</span>
					<span dir="ltr" className="font-mono text-muted-foreground text-xs">
						{lineHeightValue.toFixed(1)}
					</span>
				</div>
				<Slider
					min={1}
					max={2.5}
					step={0.1}
					value={[lineHeightValue]}
					onValueChange={([next]) => {
						if (typeof next === "number") {
							editor.applyStyle(wid, {
								lineHeight: round(next, 1),
							});
						}
					}}
					aria-label={t("workspace.page.editor.lineHeight")}
				/>
			</div>

			<NumberStepper
				label={t("workspace.page.editor.letterSpacing")}
				value={letterSpacingValue}
				min={-0.05}
				max={0.5}
				step={0.01}
				format={(value) => `${value.toFixed(2)}em`}
				onChange={(value) =>
					editor.applyStyle(wid, {
						letterSpacing: `${round(value, 2)}em`,
					})
				}
			/>
		</div>
	);
}

function InteractiveStyleControls({
	wid,
	styles,
	pending,
}: {
	wid: string;
	styles: SelectionStyles;
	pending: PendingElementStyle | undefined;
}) {
	const { t } = useTranslation();
	const editor = usePageEditor();
	const backgroundColor = isFullyTransparentCssColor(styles.backgroundColor)
		? ""
		: (cssColorToHex(styles.backgroundColor) ?? styles.backgroundColor);
	return (
		<div className="flex flex-col gap-3">
			<ColorField
				label={t("workspace.page.editor.color")}
				value={pending?.color ?? cssColorToHex(styles.color) ?? styles.color}
				onChange={(color) => editor.applyStyle(wid, { color })}
			/>
			<ColorField
				label={t("workspace.page.editor.backgroundColor")}
				value={pending?.backgroundColor ?? backgroundColor}
				onChange={(backgroundColor) =>
					editor.applyStyle(wid, { backgroundColor })
				}
			/>
			<RadiusControl
				wid={wid}
				computed={styles.borderRadius}
				pending={pending?.borderRadius}
			/>
		</div>
	);
}

function PlaceholderEditor({
	wid,
	placeholder,
}: {
	wid: string;
	placeholder: string | null;
}) {
	const { t } = useTranslation();
	const editor = usePageEditor();
	const value = editor.pendingPlaceholders[wid] ?? placeholder ?? "";
	return (
		<div className="flex flex-col gap-1.5">
			<span className="text-foreground/80 text-xs">
				{t("workspace.page.editor.placeholder")}
			</span>
			<Input
				value={value}
				maxLength={200}
				onChange={(event) => editor.applyPlaceholder(wid, event.target.value)}
				aria-label={t("workspace.page.editor.placeholder")}
				className="h-8 px-2 text-xs"
			/>
		</div>
	);
}

/** Href editor for a targeted <a>: phone-number field when the href is one
 *  of the phone forms (tel:, wa.me, api.whatsapp.com — commit preserves the
 *  form), plain URL field otherwise. Commits on blur/Enter, and ONLY values
 *  that pass isSafeLinkHref — anything else shows the invalid hint and
 *  records nothing. */
function LinkEditor({ wid, href }: { wid: string; href: string | null }) {
	const { t } = useTranslation();
	const editor = usePageEditor();

	const effectiveHref = editor.pendingLinks[wid] ?? href ?? "";
	const target = parseLinkTarget(effectiveHref);
	const isPhone = target.kind === "phone";
	const [draft, setDraft] = useState<string | null>(null);

	const shown = draft ?? (isPhone ? target.number : effectiveHref);
	const nextHref = draft === null ? null : buildLinkHref(target, draft);
	const invalid =
		draft !== null && (nextHref === null || !isSafeLinkHref(nextHref));

	const commit = () => {
		if (draft === null) return;
		if (nextHref === null || !isSafeLinkHref(nextHref)) return;
		if (nextHref !== effectiveHref) editor.applyLinkHref(wid, nextHref);
		setDraft(null);
	};

	return (
		<div className="flex flex-col gap-1.5">
			<span className="text-foreground/80 text-xs">
				{t("workspace.page.editor.link")}
			</span>
			<Input
				dir="ltr"
				type={isPhone ? "tel" : "url"}
				value={shown}
				placeholder={
					isPhone
						? t("workspace.page.editor.linkPhone")
						: t("workspace.page.editor.linkUrl")
				}
				aria-label={
					isPhone
						? t("workspace.page.editor.linkPhone")
						: t("workspace.page.editor.linkUrl")
				}
				aria-invalid={invalid || undefined}
				onChange={(event) => setDraft(event.target.value)}
				onBlur={commit}
				onKeyDown={(event) => {
					if (event.key === "Enter") commit();
				}}
				spellCheck={false}
				className={cn(
					"h-8 px-2 font-mono text-xs",
					invalid && "border-destructive focus-visible:ring-destructive/30",
				)}
			/>
			{invalid ? (
				<p className="text-[11px] text-destructive">
					{t("workspace.page.editor.linkInvalid")}
				</p>
			) : null}
		</div>
	);
}

function ImageControls({
	wid,
	src,
	inlineWidth,
	styles,
	pending,
}: {
	wid: string;
	src: string | null;
	inlineWidth: string | null;
	styles: SelectionStyles;
	pending: PendingElementStyle | undefined;
}) {
	const { t } = useTranslation();
	const editor = usePageEditor();
	const inputRef = useRef<HTMLInputElement>(null);
	const [isUploading, setIsUploading] = useState(false);

	const currentSrc = editor.pendingImages[wid] ?? src;
	const activeWidth = pending?.width ?? normalizeImageWidth(inlineWidth ?? "");

	const handleFile = async (file: File) => {
		setIsUploading(true);
		try {
			const uploaded = await uploadAttachment(file);
			editor.applyImage(wid, uploaded.url);
		} catch (error) {
			if (error instanceof AttachmentUploadError) {
				toast.error(
					error.reason === "unsupported"
						? t("projects.promptBox.attachments.unsupported")
						: error.reason === "too-large"
							? t("projects.promptBox.attachments.tooLarge")
							: error.message,
				);
			} else {
				toast.error(error instanceof Error ? error.message : String(error));
			}
		} finally {
			setIsUploading(false);
		}
	};

	return (
		<div className="flex flex-col gap-2">
			<div className="grid h-28 place-items-center overflow-hidden rounded-lg border bg-muted/40">
				{currentSrc ? (
					// eslint-free plain img: the R2 URL is public and immutable.
					<img
						src={currentSrc}
						alt=""
						className="size-full object-cover"
						loading="lazy"
					/>
				) : (
					<ImageIcon className="size-5 text-muted-foreground" aria-hidden />
				)}
			</div>
			<input
				ref={inputRef}
				type="file"
				accept={IMAGE_ACCEPT}
				className="hidden"
				onChange={(event) => {
					const file = event.target.files?.[0];
					event.target.value = "";
					if (file) void handleFile(file);
				}}
			/>
			<Button
				variant="outline"
				size="sm"
				disabled={isUploading}
				onClick={() => inputRef.current?.click()}
			>
				{isUploading ? (
					<Loader2 className="size-3.5 animate-spin" aria-hidden />
				) : (
					<Upload className="size-3.5" aria-hidden />
				)}
				{t("workspace.page.editor.replaceImage")}
			</Button>

			<div className="flex flex-col gap-1.5">
				<span className="text-foreground/80 text-xs">
					{t("workspace.page.editor.width")}
				</span>
				<div className="grid grid-cols-5 gap-1">
					{IMAGE_WIDTHS.map((width) => (
						<button
							key={width}
							type="button"
							aria-pressed={activeWidth === width}
							onClick={() => editor.applyStyle(wid, { width })}
							className={choiceClass(activeWidth === width)}
						>
							<span dir="ltr">{width}</span>
						</button>
					))}
				</div>
			</div>

			<RadiusControl
				wid={wid}
				computed={styles.borderRadius}
				pending={pending?.borderRadius}
			/>

			<div className="flex items-center justify-between gap-2">
				<span className="text-foreground/80 text-xs">
					{t("workspace.page.editor.objectFit")}
				</span>
				<ToggleGroup
					type="single"
					variant="outline"
					size="sm"
					spacing={0}
					value={normalizeObjectFit(pending?.objectFit ?? styles.objectFit)}
					onValueChange={(value) => {
						if (value === "cover" || value === "contain") {
							editor.applyStyle(wid, { objectFit: value });
						}
					}}
				>
					<ToggleGroupItem
						value="cover"
						aria-label={t("workspace.page.editor.fitCover")}
					>
						{t("workspace.page.editor.fitCover")}
					</ToggleGroupItem>
					<ToggleGroupItem
						value="contain"
						aria-label={t("workspace.page.editor.fitContain")}
					>
						{t("workspace.page.editor.fitContain")}
					</ToggleGroupItem>
				</ToggleGroup>
			</div>
		</div>
	);
}

function RemoveElementButton({ wid }: { wid: string }) {
	const { t } = useTranslation();
	const editor = usePageEditor();

	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
				>
					<Trash2 className="size-3.5" aria-hidden />
					{t("workspace.page.editor.removeElement")}
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{t("workspace.page.editor.removeConfirmTitle")}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{t("workspace.page.editor.removeConfirmBody")}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>
						{t("workspace.page.editor.removeCancel")}
					</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						onClick={() => {
							editor.removeElement(wid);
							editor.clearSelection();
						}}
					>
						{t("workspace.page.editor.removeConfirm")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

function PlaceholderImageButton({
	wid,
	styles,
}: {
	wid: string;
	styles: SelectionStyles;
}) {
	const { t } = useTranslation();
	const editor = usePageEditor();

	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button variant="outline" size="sm">
					<ImageIcon className="size-3.5" aria-hidden />
					{t("workspace.page.editor.placeholderImage")}
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{t("workspace.page.editor.placeholderConfirmTitle")}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{t("workspace.page.editor.placeholderConfirmBody")}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>
						{t("workspace.page.editor.placeholderCancel")}
					</AlertDialogCancel>
					<AlertDialogAction
						onClick={() => {
							editor.applyImagePlaceholder(wid, measureImageDimensions(styles));
							editor.clearSelection();
						}}
					>
						{t("workspace.page.editor.placeholderConfirm")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

function measureImageDimensions(
	styles: SelectionStyles,
): { width: number; height: number } | null {
	if (!styles.width.endsWith("px") || !styles.height.endsWith("px")) {
		return null;
	}

	const width = Math.round(Number.parseFloat(styles.width));
	const height = Math.round(Number.parseFloat(styles.height));

	if (!Number.isFinite(width) || !Number.isFinite(height)) {
		return null;
	}

	if (width <= 0 || height <= 0) {
		return null;
	}

	return {
		width: clamp(width, 1, 10_000),
		height: clamp(height, 1, 10_000),
	};
}

function RadiusControl({
	wid,
	computed,
	pending,
}: {
	wid: string;
	computed: string;
	pending: string | undefined;
}) {
	const { t } = useTranslation();
	const editor = usePageEditor();
	const active = pending
		? (RADIUS_STEPS.find((step) => step.value === pending)?.key ?? null)
		: nearestRadiusStep(computed);
	const labels = {
		none: t("workspace.page.editor.radiusNone"),
		s: t("workspace.page.editor.radiusSmall"),
		m: t("workspace.page.editor.radiusMedium"),
		l: t("workspace.page.editor.radiusLarge"),
		full: t("workspace.page.editor.radiusFull"),
	};

	return (
		<div className="flex flex-col gap-1.5">
			<span className="text-foreground/80 text-xs">
				{t("workspace.page.editor.radius")}
			</span>
			<div className="grid grid-cols-5 gap-1">
				{RADIUS_STEPS.map((step) => (
					<button
						key={step.key}
						type="button"
						aria-label={labels[step.key]}
						aria-pressed={active === step.key}
						title={labels[step.key]}
						onClick={() => editor.applyStyle(wid, { borderRadius: step.value })}
						className={choiceClass(active === step.key)}
					>
						{step.key === "none"
							? "0"
							: step.key === "full"
								? labels.full
								: step.key.toUpperCase()}
					</button>
				))}
			</div>
		</div>
	);
}

function NumberStepper({
	label,
	value,
	min,
	max,
	step,
	format,
	onChange,
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	step: number;
	format: (value: number) => string;
	onChange: (value: number) => void;
}) {
	const decrement = () => onChange(round(clamp(value - step, min, max), 2));
	const increment = () => onChange(round(clamp(value + step, min, max), 2));

	return (
		<div className="flex items-center justify-between gap-2">
			<span className="text-foreground/80 text-xs">{label}</span>
			<div className="flex items-center rounded-md border">
				<button
					type="button"
					aria-label={`${label} −`}
					disabled={value <= min}
					onClick={decrement}
					className="grid size-7 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-40"
				>
					<Minus className="size-3" aria-hidden />
				</button>
				<span
					dir="ltr"
					className="min-w-16 border-x px-1 text-center font-mono text-xs"
				>
					{format(value)}
				</span>
				<button
					type="button"
					aria-label={`${label} +`}
					disabled={value >= max}
					onClick={increment}
					className="grid size-7 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-40"
				>
					<Plus className="size-3" aria-hidden />
				</button>
			</div>
		</div>
	);
}

function choiceClass(active: boolean): string {
	return cn(
		"flex min-h-7 items-center justify-center gap-1 rounded-md border px-1 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
		active
			? "border-primary/50 bg-primary/10 text-foreground"
			: "border-border text-muted-foreground hover:text-foreground",
	);
}

function clamp(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) return min;
	return Math.min(max, Math.max(min, value));
}

function round(value: number, digits: number): number {
	const factor = 10 ** digits;
	return Math.round((value + Number.EPSILON) * factor) / factor;
}

function nearestFontWeight(
	value: string | number,
): (typeof FONT_WEIGHTS)[number] {
	const normalized =
		value === "normal" ? 400 : value === "bold" ? 700 : Number(value);
	return FONT_WEIGHTS.reduce((nearest, weight) =>
		Math.abs(weight - normalized) < Math.abs(nearest - normalized)
			? weight
			: nearest,
	);
}

function normalizeTextAlign(
	value: string,
	direction: string,
): "start" | "center" | "end" {
	if (value === "center") return "center";
	if (value === "start" || value === "end") return value;
	if (value === "right") return direction === "rtl" ? "start" : "end";
	return direction === "rtl" && value === "left" ? "end" : "start";
}

function computedLineHeight(lineHeight: string, fontSize: string): number {
	const raw = Number.parseFloat(lineHeight);
	if (!Number.isFinite(raw)) return 1.5;
	if (!lineHeight.trim().endsWith("px")) return raw;
	const size = Number.parseFloat(fontSize);
	return Number.isFinite(size) && size > 0 ? raw / size : 1.5;
}

function computedLetterSpacing(
	letterSpacing: string,
	fontSize: string,
): number {
	if (letterSpacing === "normal") return 0;
	const raw = Number.parseFloat(letterSpacing);
	if (!Number.isFinite(raw)) return 0;
	if (letterSpacing.trim().endsWith("em")) return raw;
	const size = Number.parseFloat(fontSize);
	return Number.isFinite(size) && size > 0 ? raw / size : 0;
}

function nearestRadiusStep(
	value: string,
): (typeof RADIUS_STEPS)[number]["key"] | null {
	const first = value.split(/\s+/)[0] ?? value;
	const amount = Number.parseFloat(first);
	if (!Number.isFinite(amount)) return null;
	const px = first.endsWith("rem") ? amount * 16 : amount;
	if (px <= 0) return "none";
	if (px >= 100) return "full";
	if (px < 8) return "s";
	if (px < 18) return "m";
	return "l";
}

function normalizeImageWidth(value: string): string | null {
	const trimmed = value.trim();
	return IMAGE_WIDTHS.includes(trimmed as (typeof IMAGE_WIDTHS)[number])
		? trimmed
		: null;
}

function normalizeObjectFit(value: string): "cover" | "contain" | undefined {
	return value === "cover" || value === "contain" ? value : undefined;
}

/** Pull the url out of a COMPUTED background-image value ("none" → null). */
function extractCssUrl(value: string): string | null {
	const match = /url\((["']?)(.*?)\1\)/.exec(value);
	return match?.[2] ? match[2] : null;
}

/** Computed px → nearest padding step (frozen thresholds); non-px computed
 *  values highlight nothing. */
function nearestPaddingStep(computed: string): SectionPaddingStep | null {
	const match = /^(\d+(?:\.\d+)?)px$/.exec(computed.trim());
	if (!match) return null;
	const px = Number.parseFloat(match[1] ?? "0");
	if (px < 16) return "none";
	if (px < 52) return "s";
	if (px < 88) return "m";
	if (px < 120) return "l";
	return "xl";
}

function PaddingRow({
	label,
	active,
	onPick,
}: {
	label: string;
	active: SectionPaddingStep | null;
	onPick: (step: SectionPaddingStep) => void;
}) {
	const { t } = useTranslation();
	return (
		<div className="flex flex-col gap-1.5">
			<span className="text-foreground/80 text-xs">{label}</span>
			<div className="flex items-center gap-0.5 rounded-full border border-border bg-muted p-[3px]">
				{SECTION_PADDING_STEPS.map((step) => (
					<button
						key={step}
						type="button"
						aria-pressed={active === step}
						onClick={() => onPick(step)}
						className={cn(
							"h-6 flex-1 rounded-full text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
							active === step
								? "bg-background text-foreground shadow-segment"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{step === "none"
							? t("workspace.page.editor.paddingNone")
							: step.toUpperCase()}
					</button>
				))}
			</div>
		</div>
	);
}

/** Section spacing steps + background image (upload to R2 / remove). The
 *  highlighted step is the pending one, else the nearest match to the
 *  COMPUTED padding; picks record a section-style op AND live-apply. When
 *  the section owns a full-bleed IMG (bgImage, V4), the image-backed block
 *  replaces the CSS background block — img wins, never both. */
function SectionControls({
	wid,
	sectionStyles,
	bgImage,
}: {
	wid: string;
	sectionStyles: {
		paddingTop: string;
		paddingBottom: string;
		backgroundImage: string;
		backgroundColor: string;
	} | null;
	bgImage: { wid: string; src: string | null } | null;
}) {
	const { t } = useTranslation();
	const editor = usePageEditor();
	const inputRef = useRef<HTMLInputElement>(null);
	const [isUploading, setIsUploading] = useState(false);

	const pending = editor.pendingSectionStyles[wid];
	// A pending removal of the full-bleed img flips control back to the CSS
	// background block on the very next render (no selection churn needed).
	const imgRemoved =
		bgImage !== null && editor.pendingRemovals.includes(bgImage.wid);
	const activeTop =
		pending?.paddingTop ?? nearestPaddingStep(sectionStyles?.paddingTop ?? "");
	const activeBottom =
		pending?.paddingBottom ??
		nearestPaddingStep(sectionStyles?.paddingBottom ?? "");
	// Pending overlays computed: "none" pending means the image is GONE even
	// if the computed value still shows the canonical one.
	const backgroundUrl =
		pending?.backgroundImage !== undefined
			? pending.backgroundImage === "none"
				? null
				: pending.backgroundImage
			: extractCssUrl(sectionStyles?.backgroundImage ?? "");
	const computedBackground = isFullyTransparentCssColor(
		sectionStyles?.backgroundColor ?? "transparent",
	)
		? ""
		: (cssColorToHex(sectionStyles?.backgroundColor ?? "") ??
			sectionStyles?.backgroundColor ??
			"");

	const handleFile = async (file: File) => {
		setIsUploading(true);
		try {
			const uploaded = await uploadAttachment(file);
			editor.applySectionStyle(wid, { backgroundImage: uploaded.url });
		} catch (error) {
			if (error instanceof AttachmentUploadError) {
				toast.error(
					error.reason === "unsupported"
						? t("projects.promptBox.attachments.unsupported")
						: error.reason === "too-large"
							? t("projects.promptBox.attachments.tooLarge")
							: error.message,
				);
			} else {
				toast.error(error instanceof Error ? error.message : String(error));
			}
		} finally {
			setIsUploading(false);
		}
	};

	return (
		<div className="flex flex-col gap-3">
			<PaddingRow
				label={t("workspace.page.editor.paddingTop")}
				active={activeTop}
				onPick={(step) => editor.applySectionStyle(wid, { paddingTop: step })}
			/>
			<PaddingRow
				label={t("workspace.page.editor.paddingBottom")}
				active={activeBottom}
				onPick={(step) =>
					editor.applySectionStyle(wid, { paddingBottom: step })
				}
			/>
			<ColorField
				label={t("workspace.page.editor.backgroundColor")}
				value={pending?.backgroundColor ?? computedBackground}
				onChange={(backgroundColor) =>
					editor.applySectionStyle(wid, { backgroundColor })
				}
			/>

			{bgImage && !imgRemoved ? (
				<SectionBgImageControls bgImage={bgImage} />
			) : (
				<div className="flex flex-col gap-2">
					<span className="text-foreground/80 text-xs">
						{t("workspace.page.editor.background")}
					</span>
					{backgroundUrl ? (
						<div className="grid h-20 place-items-center overflow-hidden rounded-lg border bg-muted/40">
							{/* eslint-free plain img: R2/canonical URL, public + immutable. */}
							<img
								src={backgroundUrl}
								alt=""
								className="size-full object-cover"
								loading="lazy"
							/>
						</div>
					) : null}
					<input
						ref={inputRef}
						type="file"
						accept={IMAGE_ACCEPT}
						className="hidden"
						onChange={(event) => {
							const file = event.target.files?.[0];
							event.target.value = "";
							if (file) void handleFile(file);
						}}
					/>
					<Button
						variant="outline"
						size="sm"
						disabled={isUploading}
						onClick={() => inputRef.current?.click()}
					>
						{isUploading ? (
							<Loader2 className="size-3.5 animate-spin" aria-hidden />
						) : (
							<Upload className="size-3.5" aria-hidden />
						)}
						{backgroundUrl
							? t("workspace.page.editor.backgroundReplace")
							: t("workspace.page.editor.backgroundAdd")}
					</Button>
					{backgroundUrl ? (
						<Button
							variant="outline"
							size="sm"
							className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
							onClick={() =>
								editor.applySectionStyle(wid, { backgroundImage: "none" })
							}
						>
							<Trash2 className="size-3.5" aria-hidden />
							{t("workspace.page.editor.backgroundRemove")}
						</Button>
					) : null}
				</div>
			)}
		</div>
	);
}

/** Image-backed section background (V4): the section's full-bleed IMG is its
 *  de-facto background, so Remplacer/Supprimer act on the IMG's wid. The
 *  upload flow mirrors ImageControls.handleFile but commits via applyImage
 *  (image-src pending op + live swap); Supprimer stages the existing
 *  remove-element op WITHOUT clearing the section selection — imgRemoved
 *  flips in SectionControls and the CSS block takes over. */
function SectionBgImageControls({
	bgImage,
}: {
	bgImage: { wid: string; src: string | null };
}) {
	const { t } = useTranslation();
	const editor = usePageEditor();
	const inputRef = useRef<HTMLInputElement>(null);
	const [isUploading, setIsUploading] = useState(false);

	const currentSrc = editor.pendingImages[bgImage.wid] ?? bgImage.src;

	const handleFile = async (file: File) => {
		setIsUploading(true);
		try {
			const uploaded = await uploadAttachment(file);
			editor.applyImage(bgImage.wid, uploaded.url);
		} catch (error) {
			if (error instanceof AttachmentUploadError) {
				toast.error(
					error.reason === "unsupported"
						? t("projects.promptBox.attachments.unsupported")
						: error.reason === "too-large"
							? t("projects.promptBox.attachments.tooLarge")
							: error.message,
				);
			} else {
				toast.error(error instanceof Error ? error.message : String(error));
			}
		} finally {
			setIsUploading(false);
		}
	};

	return (
		<div className="flex flex-col gap-2">
			<span className="text-foreground/80 text-xs">
				{t("workspace.page.editor.background")}
			</span>
			<div className="grid h-20 place-items-center overflow-hidden rounded-lg border bg-muted/40">
				{currentSrc ? (
					// eslint-free plain img: R2/canonical URL, public + immutable.
					<img
						src={currentSrc}
						alt=""
						className="size-full object-cover"
						loading="lazy"
					/>
				) : (
					<ImageIcon className="size-5 text-muted-foreground" aria-hidden />
				)}
			</div>
			<input
				ref={inputRef}
				type="file"
				accept={IMAGE_ACCEPT}
				className="hidden"
				onChange={(event) => {
					const file = event.target.files?.[0];
					event.target.value = "";
					if (file) void handleFile(file);
				}}
			/>
			<Button
				variant="outline"
				size="sm"
				disabled={isUploading}
				onClick={() => inputRef.current?.click()}
			>
				{isUploading ? (
					<Loader2 className="size-3.5 animate-spin" aria-hidden />
				) : (
					<Upload className="size-3.5" aria-hidden />
				)}
				{t("workspace.page.editor.backgroundReplace")}
			</Button>
			<Button
				variant="outline"
				size="sm"
				className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
				onClick={() => editor.removeElement(bgImage.wid)}
			>
				<Trash2 className="size-3.5" aria-hidden />
				{t("workspace.page.editor.backgroundRemove")}
			</Button>
		</div>
	);
}
