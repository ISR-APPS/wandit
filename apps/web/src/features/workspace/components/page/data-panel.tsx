// Données panel — scans the CANONICAL page HTML for business-data links
// (téléphone / WhatsApp / e-mail / réseaux sociaux), groups them by
// normalized value, and lets ONE edit rewrite EVERY stamped occurrence at
// once: a set-link-href op per wid (live-applied via the bridge) plus the
// frozen text-sync rules for anchors whose visible text carries the old
// value. Unstamped matches (no data-wid) are listed read-only. The DOM scan
// is memoized per version html; editor.pendingLinks overlay the displayed
// values so applied-but-unsaved edits show through.

import { isSafeLinkHref } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { Input } from "@wandit/ui/components/input";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
	AttachmentUploadError,
	uploadAttachment,
	useUpdateProjectLogo,
} from "@/features/projects";
import { useTranslation } from "@/lib/i18n";
import { hasOnlyInlineFormattingTags } from "../../lib/page-editor-pending";
import { setTextMessage } from "../../lib/preview-editor/messages";
import { useWorkspace } from "../../lib/store";
import { usePageEditor } from "../../lib/use-page-editor";
import {
	buildLinkHref,
	normalizePhone,
	parseLinkTarget,
} from "./element-panel";

type ScannedAnchor = {
	wid: string | null;
	href: string;
	text: string;
	descendantWids: string[];
	textFlattenable: boolean;
};

type DataKind = "phone" | "whatsapp" | "email" | "social";

type Classified = {
	/** Group key: normalized value prefixed by its family (frozen matchers). */
	key: string;
	kind: DataKind;
	/** Displayed normalized value (also the oldDisplay of the sync rules). */
	value: string;
};

type DataGroup = Classified & { members: ScannedAnchor[] };

export type BrandTarget = {
	wid: string;
	role: "nav" | "footer";
	text: string;
	descendantWids: string[];
	explicit: boolean;
};

export type BrandPendingAction = "upload" | "remove" | null;

export function getBrandActionState(
	pendingAction: BrandPendingAction,
	mutationPending: boolean,
	askAiDispatching: boolean,
) {
	return {
		busy: pendingAction !== null || mutationPending || askAiDispatching,
		uploadPending: pendingAction === "upload",
		removePending: pendingAction === "remove",
	};
}

const BRAND_WRAPPER_TAGS = new Set(["A", "DIV", "FIGURE", "ARTICLE"]);
const BRAND_CLASS_RE = /(brand|wordmark|logo|lockup)/i;
const HOME_HREFS = new Set(["#", "#hero", "/", "./"]);
const CTA_TEXT_RE =
	/^(home|menu|about|services?|contact|shop|book|start|get started|learn more|discover|order now|buy now|accueil|menu|à propos|services?|contact|boutique|réserver|commander|acheter|الرئيسية|القائمة|من نحن|الخدمات|اتصل|احجز|اطلب الآن|اشتر الآن)$/i;
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif";
/** Mirrors the set-page-title contract bound — the op is rejected past it. */
const PAGE_TITLE_MAX_LENGTH = 120;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SOCIAL_NETWORKS = [
	{ id: "instagram", host: "instagram.com" },
	{ id: "facebook", host: "facebook.com" },
	{ id: "facebook", host: "fb.com" },
	{ id: "tiktok", host: "tiktok.com" },
] as const;

const KIND_ORDER: readonly DataKind[] = [
	"phone",
	"whatsapp",
	"email",
	"social",
];

const HEADING_KEYS = {
	phone: "workspace.page.editor.dataPhone",
	whatsapp: "workspace.page.editor.dataWhatsapp",
	email: "workspace.page.editor.dataEmail",
	social: "workspace.page.editor.dataSocial",
} as const;

function digitsOnly(value: string): string {
	return value.replace(/\D/g, "");
}

/** Frozen matchers + normalization (contract §6): tel: numbers, wa.me /
 *  api.whatsapp.com numbers, mailto: addresses, recognizable social links.
 *  Null = not business data. */
function classifyHref(href: string): Classified | null {
	const trimmed = href.trim();
	const lowered = trimmed.toLowerCase();
	if (lowered.startsWith("tel:")) {
		const value = normalizePhone(trimmed.slice(4));
		if (digitsOnly(value) === "") return null;
		return { key: `tel:${value}`, kind: "phone", value };
	}
	if (lowered.startsWith("mailto:")) {
		const address = (trimmed.slice(7).split("?")[0] ?? "").toLowerCase();
		if (address === "") return null;
		return { key: `mailto:${address}`, kind: "email", value: address };
	}
	let url: URL;
	try {
		url = new URL(trimmed);
	} catch {
		return null;
	}
	if (url.protocol !== "https:" && url.protocol !== "http:") return null;
	const host = url.hostname.toLowerCase().replace(/^www\./, "");
	if (host === "wa.me") {
		const digits = digitsOnly(url.pathname.split("/").filter(Boolean)[0] ?? "");
		if (digits === "") return null;
		return { key: `wa:${digits}`, kind: "whatsapp", value: digits };
	}
	if (host === "api.whatsapp.com") {
		const digits = digitsOnly(url.searchParams.get("phone") ?? "");
		if (digits === "") return null;
		return { key: `wa:${digits}`, kind: "whatsapp", value: digits };
	}
	const network = SOCIAL_NETWORKS.find(
		(candidate) =>
			host === candidate.host || host.endsWith(`.${candidate.host}`),
	);
	if (network) {
		// origin + pathname, lowercased, trailing "/" stripped, query dropped.
		const cleaned =
			`${url.origin}${url.pathname.replace(/\/+$/, "")}`.toLowerCase();
		return { key: `${network.id}:${cleaned}`, kind: "social", value: cleaned };
	}
	return null;
}

/** One DOMParser pass over the canonical html: every <a href> with its wid
 *  (null when unstamped → read-only) and visible text. */
function scanAnchors(html: string): ScannedAnchor[] {
	if (!html) return [];
	const doc = new DOMParser().parseFromString(html, "text/html");
	const anchors: ScannedAnchor[] = [];
	for (const anchor of doc.querySelectorAll("a[href]")) {
		anchors.push({
			wid: anchor.getAttribute("data-wid"),
			href: anchor.getAttribute("href") ?? "",
			text: (anchor.textContent ?? "").trim(),
			descendantWids: Array.from(
				anchor.querySelectorAll("[data-wid]"),
				(descendant) => descendant.getAttribute("data-wid"),
			).filter((wid): wid is string => wid !== null),
			textFlattenable: hasOnlyInlineFormattingTags(
				Array.from(anchor.querySelectorAll("*"), (descendant) =>
					descendant.tagName.toUpperCase(),
				),
			),
		});
	}
	return anchors;
}

function normalizedBrandText(element: Element): string {
	return (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
}

function descendantWids(element: Element): string[] {
	return Array.from(element.querySelectorAll("[data-wid]"), (descendant) =>
		descendant.getAttribute("data-wid"),
	).filter((wid): wid is string => wid !== null);
}

function isExcludedBrandAnchor(element: Element): boolean {
	if (element.tagName !== "A") return false;
	const href = (element.getAttribute("href") ?? "").trim();
	if (/^(tel:|mailto:)/i.test(href)) return true;
	if (
		classifyHref(href)?.kind === "social" ||
		classifyHref(href)?.kind === "whatsapp"
	) {
		return true;
	}
	return CTA_TEXT_RE.test(normalizedBrandText(element));
}

function hasInteractiveBrandDescendants(element: Element): boolean {
	if (element.tagName === "A") return false;
	return ["a", "button", "input", "textarea", "select", "form"].some(
		(selector) => element.querySelector(selector) !== null,
	);
}

function asBrandTarget(
	element: Element,
	role: "nav" | "footer",
	explicit: boolean,
): BrandTarget | null {
	const wid = element.getAttribute("data-wid");
	if (!wid || !BRAND_WRAPPER_TAGS.has(element.tagName)) return null;
	if (isExcludedBrandAnchor(element)) return null;
	if (hasInteractiveBrandDescendants(element)) return null;
	if (
		role === "nav" &&
		(!element.closest("nav, header") || element.closest("footer"))
	)
		return null;
	if (role === "footer" && !element.closest("footer")) return null;
	return {
		wid,
		role,
		text: normalizedBrandText(element),
		descendantWids: descendantWids(element),
		explicit,
	};
}

function semanticBrandCandidate(scope: Element): Element | null {
	for (const element of scope.querySelectorAll("[data-wid]")) {
		if (!BRAND_WRAPPER_TAGS.has(element.tagName)) continue;
		if (!BRAND_CLASS_RE.test(element.getAttribute("class") ?? "")) continue;
		if (isExcludedBrandAnchor(element)) continue;
		return element;
	}
	return null;
}

function homeBrandCandidate(scope: Element): Element | null {
	for (const element of scope.querySelectorAll("[data-wid]")) {
		if (element.tagName !== "A") continue;
		const href = (element.getAttribute("href") ?? "").trim().toLowerCase();
		const text = normalizedBrandText(element);
		if (!HOME_HREFS.has(href) || text === "" || text.length > 80) continue;
		if (isExcludedBrandAnchor(element)) continue;
		return element;
	}
	return null;
}

/** Conservative canonical-HTML brand scan. Explicit role markers win; legacy
 * pages are limited to nav-like scopes and a matching/semantic footer mark. */
export function scanBrandTargetsInDocument(doc: Document): BrandTarget[] {
	const explicitNav = Array.from(doc.querySelectorAll('[data-brand="nav"]'))
		.map((element) => asBrandTarget(element, "nav", true))
		.find((target): target is BrandTarget => target !== null);
	const explicitFooter = Array.from(
		doc.querySelectorAll('[data-brand="footer"]'),
	)
		.map((element) => asBrandTarget(element, "footer", true))
		.find((target): target is BrandTarget => target !== null);

	let navTarget = explicitNav ?? null;
	if (!navTarget) {
		const scopes: Element[] = [...doc.querySelectorAll("nav")].filter(
			(scope) => !scope.closest("footer"),
		);
		for (const header of doc.querySelectorAll("header")) {
			if (header.querySelector("nav") && !header.closest("footer"))
				scopes.push(header);
		}
		for (const scope of scopes) {
			const candidate =
				semanticBrandCandidate(scope) ?? homeBrandCandidate(scope);
			if (!candidate) continue;
			navTarget = asBrandTarget(candidate, "nav", false);
			if (navTarget) break;
		}
	}

	let footerTarget = explicitFooter ?? null;
	if (!footerTarget && navTarget) {
		const navText = navTarget.text.toLocaleLowerCase();
		for (const footer of doc.querySelectorAll("footer")) {
			for (const element of footer.querySelectorAll("[data-wid]")) {
				if (!BRAND_WRAPPER_TAGS.has(element.tagName)) continue;
				const text = normalizedBrandText(element);
				const semantic = BRAND_CLASS_RE.test(
					element.getAttribute("class") ?? "",
				);
				if (!semantic && (!navText || text.toLocaleLowerCase() !== navText))
					continue;
				const target = asBrandTarget(element, "footer", false);
				if (target) {
					footerTarget = target;
					break;
				}
			}
			if (footerTarget) break;
		}
	}

	const targets = [navTarget, footerTarget].filter(
		(target): target is BrandTarget => target !== null,
	);
	return targets.filter(
		(target, index) =>
			targets.findIndex((candidate) => candidate.wid === target.wid) === index,
	);
}

export function scanBrandTargets(html: string): BrandTarget[] {
	if (!html) return [];
	const doc = new DOMParser().parseFromString(html, "text/html");
	return scanBrandTargetsInDocument(doc);
}

export function availableBrandTargets(
	targets: readonly BrandTarget[],
	pendingRemovals: readonly string[],
): BrandTarget[] {
	const removed = new Set(pendingRemovals);
	return targets.filter((target) => !removed.has(target.wid));
}

/** Apply is live only for a non-empty title that actually CHANGES the
 *  effective value (the saved HTML's title, overlaid by any pending edit).
 *  The op trims too, so a pure whitespace change is never a change. */
export function canApplyPageTitle(draft: string, effective: string): boolean {
	const trimmed = draft.trim();
	return trimmed !== "" && trimmed !== effective;
}

/** Browser-tab title. Head-level like the theme tokens: no wid, no live
 *  preview (an iframe's document.title is invisible) — the field's effective
 *  value IS the feedback until Save writes the new version. */
function PageTitleCard({ html }: { html: string }) {
	const { t } = useTranslation();
	const editor = usePageEditor();
	// Draft null = show the effective value; applying drops it rather than
	// letting it dangle over the value the editor now holds.
	const [draft, setDraft] = useState<string | null>(null);
	const baseTitle = useMemo(
		() =>
			html ? new DOMParser().parseFromString(html, "text/html").title : "",
		[html],
	);
	const effective = editor.pendingPageTitle ?? baseTitle;
	// A Discard, a save, or a foreign version can change the effective title
	// while the panel stays mounted; a dangling draft would then mask the real
	// value as if it were saved data — drop it and show reality.
	const [seenEffective, setSeenEffective] = useState(effective);
	if (seenEffective !== effective) {
		setSeenEffective(effective);
		setDraft(null);
	}
	const value = draft ?? effective;
	const canApply = canApplyPageTitle(value, effective);

	const apply = () => {
		if (!canApply) return;
		editor.applyPageTitle(value.trim());
		setDraft(null);
	};

	return (
		<div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-2.5">
			<div className="min-w-0">
				<span className="text-foreground/80 text-xs">
					{t("workspace.page.editor.dataPageTitle")}
				</span>
				<p className="text-[10px] text-muted-foreground/80">
					{t("workspace.page.editor.dataPageTitleHint")}
				</p>
			</div>
			<div className="flex items-center gap-1.5">
				<Input
					value={value}
					maxLength={PAGE_TITLE_MAX_LENGTH}
					aria-label={t("workspace.page.editor.dataPageTitle")}
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") apply();
					}}
					className="h-7 min-w-0 flex-1 px-2 text-xs"
				/>
				<Button
					size="sm"
					className="h-7 shrink-0"
					disabled={!canApply}
					onClick={apply}
				>
					{t("workspace.page.editor.dataApply")}
				</Button>
			</div>
		</div>
	);
}

function BrandCard({ html }: { html: string }) {
	const { t } = useTranslation();
	const { project, projectId } = useWorkspace();
	const editor = usePageEditor();
	const updateLogo = useUpdateProjectLogo();
	const inputRef = useRef<HTMLInputElement>(null);
	const [pendingAction, setPendingAction] = useState<BrandPendingAction>(null);
	const scannedTargets = useMemo(() => scanBrandTargets(html), [html]);
	const targets = useMemo(
		() => availableBrandTargets(scannedTargets, editor.pendingRemovals),
		[editor.pendingRemovals, scannedTargets],
	);
	const unavailable = targets.length === 0 || !project;
	const actionState = getBrandActionState(
		pendingAction,
		updateLogo.isPending,
		editor.isAskAiDispatching,
	);
	const logoUrl = project?.logoUrl ?? null;

	const reportUploadError = (error: unknown) => {
		if (error instanceof AttachmentUploadError) {
			toast.error(
				error.reason === "unsupported"
					? t("projects.promptBox.attachments.unsupported")
					: error.reason === "too-large"
						? t("projects.promptBox.attachments.tooLarge")
						: error.message,
			);
			return;
		}
		toast.error(error instanceof Error ? error.message : String(error));
	};

	const applyLogo = (value: string | null) => {
		for (const target of targets) {
			editor.applyBrandLogo(target.wid, value, target.descendantWids);
		}
	};

	const handleFile = async (file: File) => {
		if (unavailable || actionState.busy) return;
		setPendingAction("upload");
		try {
			const uploaded = await uploadAttachment(file);
			// Project storage is intentionally immediate; the page brand swaps stay
			// pending until Save and can still be discarded independently.
			await updateLogo.mutateAsync({ id: projectId, logoUrl: uploaded.url });
			applyLogo(uploaded.url);
		} catch (error) {
			reportUploadError(error);
		} finally {
			setPendingAction(null);
		}
	};

	const removeLogo = async () => {
		if (unavailable || actionState.busy) return;
		setPendingAction("remove");
		try {
			await updateLogo.mutateAsync({ id: projectId, logoUrl: null });
			applyLogo(null);
		} catch (error) {
			reportUploadError(error);
		} finally {
			setPendingAction(null);
		}
	};

	return (
		<div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-2.5">
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<span className="text-foreground/80 text-xs">
						{t("workspace.page.editor.dataBrand")}
					</span>
					<p className="text-[10px] text-muted-foreground/80">
						{t("workspace.page.editor.dataBrandHint")}
					</p>
				</div>
				<span className="shrink-0 text-[10px] text-muted-foreground">
					{t("workspace.page.editor.dataBrandOccurrences", {
						count: targets.length,
					})}
				</span>
			</div>

			{logoUrl ? (
				<div className="grid h-16 place-items-center overflow-hidden rounded-md border bg-background/70 p-2">
					<img
						src={logoUrl}
						alt=""
						className="max-h-full max-w-full object-contain"
						loading="lazy"
					/>
				</div>
			) : null}

			<input
				ref={inputRef}
				type="file"
				accept={IMAGE_ACCEPT}
				disabled={unavailable || actionState.busy}
				className="hidden"
				onChange={(event) => {
					const file = event.target.files?.[0];
					event.target.value = "";
					if (file) void handleFile(file);
				}}
			/>
			<div className="flex flex-wrap gap-1.5">
				<Button
					variant="outline"
					size="sm"
					className="h-7"
					disabled={unavailable || actionState.busy}
					onClick={() => inputRef.current?.click()}
				>
					{actionState.uploadPending ? (
						<Loader2 className="size-3.5 animate-spin" aria-hidden />
					) : logoUrl ? (
						<ImageIcon className="size-3.5" aria-hidden />
					) : (
						<Upload className="size-3.5" aria-hidden />
					)}
					{actionState.uploadPending
						? t("workspace.page.editor.dataBrandUploading")
						: logoUrl
							? t("workspace.page.editor.dataBrandReplace")
							: t("workspace.page.editor.dataBrandUpload")}
				</Button>
				{logoUrl ? (
					<Button
						variant="outline"
						size="sm"
						className="h-7 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
						disabled={unavailable || actionState.busy}
						onClick={() => void removeLogo()}
					>
						{actionState.removePending ? (
							<Loader2 className="size-3.5 animate-spin" aria-hidden />
						) : (
							<Trash2 className="size-3.5" aria-hidden />
						)}
						{actionState.removePending
							? t("workspace.page.editor.dataBrandRemoving")
							: t("workspace.page.editor.dataBrandRemove")}
					</Button>
				) : null}
			</div>
			<p className="text-[10px] text-muted-foreground/80">
				{t("workspace.page.editor.dataBrandFormats")}
			</p>
			{unavailable ? (
				<p className="text-[10px] text-amber-700 dark:text-amber-300">
					{t("workspace.page.editor.dataBrandUnavailable")}
				</p>
			) : null}
		</div>
	);
}

/** New input → href preserving the MEMBER's original form (contract §6):
 *  tel/wa.me/api.whatsapp.com via the link-editor builders, mailto keeps its
 *  original ?query, social takes the typed URL verbatim. */
function buildMemberHref(
	kind: DataKind,
	memberHref: string,
	input: string,
): string | null {
	if (kind === "phone" || kind === "whatsapp") {
		const target = parseLinkTarget(memberHref);
		return target.kind === "phone" ? buildLinkHref(target, input) : null;
	}
	if (kind === "email") {
		const address = input.trim();
		if (!EMAIL_RE.test(address)) return null;
		const queryIndex = memberHref.indexOf("?");
		const query = queryIndex >= 0 ? memberHref.slice(queryIndex) : "";
		return `mailto:${address}${query}`;
	}
	return input.trim();
}

/** Frozen text-sync rules (contract §6): whole-replace when the visible text
 *  IS the old value, first-occurrence replace when it contains it, otherwise
 *  leave the text alone (null). Social links never touch text. */
function syncText(
	kind: DataKind,
	text: string,
	oldDisplay: string,
	input: string,
): string | null {
	if (text === "") return null;
	const typed = input.trim();
	if (kind === "phone" || kind === "whatsapp") {
		const textDigits = digitsOnly(text);
		if (textDigits !== "" && textDigits === digitsOnly(oldDisplay)) {
			return typed;
		}
		if (text.includes(oldDisplay)) return text.replace(oldDisplay, typed);
		return null;
	}
	if (kind === "email") {
		if (text.trim().toLowerCase() === oldDisplay) return typed;
		if (text.includes(oldDisplay)) return text.replace(oldDisplay, typed);
		return null;
	}
	return null;
}

/** Would this draft produce committable hrefs for the group's family? */
function isDraftValid(kind: DataKind, input: string): boolean {
	const trimmed = input.trim();
	if (trimmed === "") return false;
	if (kind === "phone") {
		const number = normalizePhone(trimmed);
		return number !== "" && isSafeLinkHref(`tel:${number}`);
	}
	if (kind === "whatsapp") return digitsOnly(trimmed).length >= 3;
	if (kind === "email") return EMAIL_RE.test(trimmed);
	return isSafeLinkHref(trimmed);
}

export function DataPanel({ html }: { html: string }) {
	const { t } = useTranslation();
	const editor = usePageEditor();
	const [drafts, setDrafts] = useState<Record<string, string>>({});

	// One DOM parse per version html; the overlay/grouping below is cheap.
	const anchors = useMemo(() => scanAnchors(html), [html]);

	// Effective hrefs (pendingLinks overlay) → groups in the fixed
	// Téléphone / WhatsApp / E-mail / Réseaux order.
	const sections = useMemo(() => {
		const map = new Map<string, DataGroup>();
		for (const anchor of anchors) {
			const href =
				anchor.wid !== null
					? (editor.pendingLinks[anchor.wid] ?? anchor.href)
					: anchor.href;
			const match = classifyHref(href);
			if (!match) continue;
			const member: ScannedAnchor = { ...anchor, href };
			const existing = map.get(match.key);
			if (existing) existing.members.push(member);
			else map.set(match.key, { ...match, members: [member] });
		}
		const groups = [...map.values()];
		return KIND_ORDER.map((kind) => ({
			kind,
			groups: groups.filter((group) => group.kind === kind),
		})).filter((section) => section.groups.length > 0);
	}, [anchors, editor.pendingLinks]);

	const applyGroup = (group: DataGroup) => {
		const input = (drafts[group.key] ?? "").trim();
		if (!isDraftValid(group.kind, input)) return;
		for (const member of group.members) {
			if (member.wid === null) continue; // read-only, excluded from commit
			const newHref = buildMemberHref(group.kind, member.href, input);
			if (newHref === null || !isSafeLinkHref(newHref)) continue;
			editor.applyLinkHref(member.wid, newHref);
			// Text sync: anchors whose visible text carried the old value
			// follow the edit (pending overlay so repeated edits chain).
			const text = editor.pendingText[member.wid] ?? member.text;
			const newText = syncText(group.kind, text, group.value, input);
			if (member.textFlattenable && newText !== null && newText !== text) {
				// set-text flattens the anchor exactly like the server. The canonical
				// scan is a conservative superset of its still-live stamped descendants,
				// so child-targeted pending ops cannot survive the programmatic edit.
				editor.recordText(member.wid, newText, member.descendantWids);
				editor.postToPreview(setTextMessage(member.wid, newText));
			}
		}
		// The group re-keys under its new value on the next render — drop the
		// draft rather than letting it dangle on a dead key.
		setDrafts((prev) => {
			const { [group.key]: _done, ...rest } = prev;
			return rest;
		});
	};

	return (
		<section className="flex flex-col gap-4 p-3.5">
			<header className="flex flex-col gap-0.5">
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
					{t("workspace.page.editor.data")}
				</span>
				<p className="text-[11px] text-muted-foreground/80">
					{t("workspace.page.editor.dataHint")}
				</p>
			</header>
			<PageTitleCard html={html} />
			<BrandCard html={html} />

			{sections.length === 0 ? (
				<p className="text-muted-foreground text-xs">
					{t("workspace.page.editor.dataEmpty")}
				</p>
			) : (
				sections.map((section) => (
					<div key={section.kind} className="flex flex-col gap-2">
						<span className="text-foreground/80 text-xs">
							{t(HEADING_KEYS[section.kind])}
						</span>
						{section.groups.map((group) => {
							const draft = drafts[group.key] ?? "";
							const stamped = group.members.filter(
								(member) => member.wid !== null,
							);
							const hasUnstamped = stamped.length < group.members.length;
							const valid = isDraftValid(group.kind, draft);
							const invalid = draft.trim() !== "" && !valid;
							const isPhoneField =
								group.kind === "phone" || group.kind === "whatsapp";
							return (
								<div
									key={group.key}
									className="flex flex-col gap-1.5 rounded-lg border bg-muted/20 p-2"
								>
									<div className="flex items-baseline justify-between gap-2">
										<span
											dir="ltr"
											className="min-w-0 truncate font-mono text-xs"
										>
											{group.value}
										</span>
										<span className="shrink-0 text-[10px] text-muted-foreground">
											{t("workspace.page.editor.dataOccurrences", {
												count: group.members.length,
											})}
										</span>
									</div>
									{stamped.length > 0 ? (
										<div className="flex items-center gap-1.5">
											<Input
												dir="ltr"
												type={
													isPhoneField
														? "tel"
														: group.kind === "email"
															? "email"
															: "url"
												}
												value={draft}
												placeholder={group.value}
												aria-label={t(HEADING_KEYS[group.kind])}
												aria-invalid={invalid || undefined}
												onChange={(event) =>
													setDrafts((prev) => ({
														...prev,
														[group.key]: event.target.value,
													}))
												}
												onKeyDown={(event) => {
													if (event.key === "Enter") applyGroup(group);
												}}
												spellCheck={false}
												className="h-7 min-w-0 flex-1 px-2 font-mono text-xs"
											/>
											<Button
												size="sm"
												className="h-7 shrink-0"
												disabled={!valid}
												onClick={() => applyGroup(group)}
											>
												{t("workspace.page.editor.dataApply")}
											</Button>
										</div>
									) : null}
									{invalid ? (
										<p className="text-[11px] text-destructive">
											{t("workspace.page.editor.linkInvalid")}
										</p>
									) : null}
									{hasUnstamped ? (
										<p className="text-[10px] text-muted-foreground/80">
											{t("workspace.page.editor.dataReadOnly")}
										</p>
									) : null}
								</div>
							);
						})}
					</div>
				))
			)}
		</section>
	);
}
