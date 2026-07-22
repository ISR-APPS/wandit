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
import { useMemo, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import { setTextMessage } from "../../lib/preview-editor/messages";
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
		});
	}
	return anchors;
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
			if (newText !== null && newText !== text) {
				editor.recordText(member.wid, newText);
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
