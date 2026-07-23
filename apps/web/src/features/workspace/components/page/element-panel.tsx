// Element panel — top of the inspector rail while something is targeted.
// Type-aware (inline-editor V3): sections get spacing steps + a background
// image block, images get swap + remove, links get an href editor (phone
// field for tel:/WhatsApp forms) above the usual style controls. Style edits
// (color / size / curated font) are recorded as element-style ops pinned to
// the wid AND live-applied through the bridge; image/background uploads go
// to R2 first (WS1 attachments service) then record their op. Text editing
// itself happens IN the preview (contentEditable — contract §11 edit mode);
// the panel only hints at it.

import {
	isSafeLinkHref,
	SECTION_PADDING_STEPS,
	type SectionPaddingStep,
} from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { Input } from "@wandit/ui/components/input";
import { Separator } from "@wandit/ui/components/separator";
import { Slider } from "@wandit/ui/components/slider";
import { cn } from "@wandit/ui/lib/utils";
import { Crosshair, ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { AttachmentUploadError, uploadAttachment } from "@/features/projects";
import { useTranslation } from "@/lib/i18n";
import { cssColorToHex } from "../../lib/preview-editor/contrast";
import { matchCuratedFontId } from "../../lib/preview-editor/parse-tokens";
import { usePageEditor } from "../../lib/use-page-editor";
import { ColorField, FontSelect } from "./inspector-controls";

/** Image types only (contract §7.2 allowlist minus documents). */
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif";

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
	const isImage = selection.tag === "img";
	const isLink = selection.tag === "a";

	return (
		<section className="flex flex-col gap-3 p-3.5">
			<header className="flex flex-col gap-1">
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
					{isSection
						? t("workspace.page.editor.section")
						: t("workspace.page.editor.element")}
				</span>
				<span className="flex min-w-0 items-center gap-1.5 text-sm">
					<Crosshair className="size-3.5 shrink-0 text-primary" aria-hidden />
					<span dir="ltr" className="min-w-0 truncate font-mono">
						{selection.wid}
						<span className="text-muted-foreground"> · {selection.tag}</span>
					</span>
				</span>
				{selection.kind === "element" && selection.sectionWid ? (
					<span dir="ltr" className="truncate text-muted-foreground text-xs">
						{t("workspace.page.editor.inSection", {
							wid: selection.sectionWid,
						})}
					</span>
				) : null}
			</header>

			{isSection ? (
				<SectionControls
					wid={selection.wid}
					sectionStyles={selection.sectionStyles}
					bgImage={selection.bgImage}
				/>
			) : isImage ? (
				<ImageControls wid={selection.wid} src={selection.src} />
			) : (
				<>
					{isLink ? (
						// Keyed per wid so the draft resets when the target changes.
						<LinkEditor
							key={selection.wid}
							wid={selection.wid}
							href={selection.href}
						/>
					) : null}
					<StyleControls
						wid={selection.wid}
						text={selection.text}
						styles={selection.styles}
						pending={pending}
					/>
				</>
			)}
			<Separator />
		</section>
	);
}

function StyleControls({
	wid,
	text,
	styles,
	pending,
}: {
	wid: string;
	text: string | null;
	styles: { color: string; fontSize: string; fontFamily: string };
	pending:
		| { color?: string; fontSize?: string; fontFamily?: string }
		| undefined;
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

	return (
		<div className="flex flex-col gap-3">
			{text ? (
				<div className="flex flex-col gap-1">
					<p
						dir="auto"
						className="line-clamp-2 rounded-md border bg-muted/40 px-2 py-1.5 text-muted-foreground text-xs leading-snug"
					>
						{text}
					</p>
					{editor.mode === "edit" ? (
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

function ImageControls({ wid, src }: { wid: string; src: string | null }) {
	const { t } = useTranslation();
	const editor = usePageEditor();
	const inputRef = useRef<HTMLInputElement>(null);
	const [isUploading, setIsUploading] = useState(false);

	const currentSrc = editor.pendingImages[wid] ?? src;

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
			<Button
				variant="outline"
				size="sm"
				className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
				onClick={() => {
					// Records the removal (dropping the wid's other pending edits),
					// live-removes the node, then clears the now-dangling selection.
					editor.removeElement(wid);
					editor.clearSelection();
				}}
			>
				<Trash2 className="size-3.5" aria-hidden />
				{t("workspace.page.editor.removeImage")}
			</Button>
		</div>
	);
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
