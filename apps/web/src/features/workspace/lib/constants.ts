// All user-facing copy for the workspace feature (centralized so a locale
// swap is cheap) + tab/status/timing config.

/**
 * WORKSPACE CONSTANTS — the feature's central "settings file".
 *
 * What this file is: a grab-bag of plain values (no logic, no React) that the
 * rest of the workspace feature imports: tab definitions, localStorage keys,
 * page sizes, canvas geometry, lead-status styling, and some leftover
 * mock-generation timing/copy. Keeping them in one file means a designer or
 * translator can retune the workspace without hunting through components.
 *
 * Where it sits in the AI-chat flow: two constants matter for chat UI
 * persistence — CHAT_OPEN_STORAGE_KEY (is the chat pane open or closed?) and
 * WORKSPACE_PANELS_STORAGE_ID (how wide is the chat/main split?). Both are
 * localStorage keys. "localStorage" is the browser's tiny built-in key/value
 * store that survives page reloads, so when you come back to a project the
 * workspace looks exactly how you left it. store.tsx reads/writes the first
 * key; helpers.ts + pages/workspace-page.tsx read/write the second. Nothing
 * here talks to the server — the actual chat traffic lives in
 * use-project-chat.tsx and api/chat.*.
 *
 * NOTE (dead code): FIRST_GENERATION_REPLIES, ITERATION_REPLIES,
 * THINKING_DELAY_MS, STREAM_WORD_INTERVAL_MS, BUILD_DURATION_MS and
 * GENERATING_STEP_INTERVAL_MS are no longer imported anywhere — they powered
 * the old fake "typing" chat before the real server-backed chat (SSE
 * streaming) replaced it. They are safe-to-delete leftovers; only
 * PUBLISH_DURATION_MS and SLUG_CHECK_DEBOUNCE_MS from the timing block are
 * still used (by the still-mocked publish flow).
 */

// LucideIcon is just the TypeScript type for one icon component from the
// lucide-react icon library (each icon is a small React component that
// renders an SVG).
import type { LucideIcon } from "lucide-react";
import { File, Image, Settings2, Users, Volume2 } from "lucide-react";

import type { LeadStatus, PageLang, WorkspaceTab } from "../api/dto";

export const WORKSPACE_TAB_VALUES = [
	"page",
	"assets",
	"marketing",
	"leads",
	"settings",
] as const;

export type WorkspaceTabDef = {
	value: WorkspaceTab;
	icon: LucideIcon;
};

// Tab value + icon; the label is localized (workspace.tabs.<value>).
export const WORKSPACE_TABS: WorkspaceTabDef[] = [
	{ value: "page", icon: File },
	{ value: "assets", icon: Image },
	{ value: "marketing", icon: Volume2 },
	{ value: "leads", icon: Users },
	{ value: "settings", icon: Settings2 },
];

/** Published sites live on {slug}.wandit.app — mirrors projects' copy. */
export const PUBLISHED_DOMAIN = ".wandit.app";

export const LEADS_PAGE_SIZE = 12;
export const CHAT_OPEN_STORAGE_KEY = "wandit-workspace-chat-open";
/** react-resizable-panels autoSaveId — persists chat/main split width. */
export const WORKSPACE_PANELS_STORAGE_ID = "wandit-workspace-panels";

// Mock job pacing (ms) — tuned to feel like a real queue without dragging.
export const THINKING_DELAY_MS = 650;
export const STREAM_WORD_INTERVAL_MS = 30;
export const BUILD_DURATION_MS = 2600;
// Long enough for the publish panel's deploy checklist to read step by step.
export const PUBLISH_DURATION_MS = 5200;
export const GENERATING_STEP_INTERVAL_MS = 1400;
export const SLUG_CHECK_DEBOUNCE_MS = 500;

/** Badge variant + select dot per lead status, in pipeline order. */
export const LEAD_STATUS_ORDER: LeadStatus[] = [
	"to_confirm",
	"confirmed",
	"shipped",
	"delivered",
	"returned",
	"cancelled",
];

// Badge variant + select dot per lead status; the label is localized
// (leads.status.<enum_value>).
export const LEAD_STATUS_META: Record<
	LeadStatus,
	{
		badgeVariant:
			| "default"
			| "secondary"
			| "destructive"
			| "outline"
			| "warning"
			| "info"
			| "success";
		dotClass: string;
	}
> = {
	to_confirm: {
		badgeVariant: "warning",
		dotClass: "bg-amber-500",
	},
	confirmed: {
		badgeVariant: "info",
		dotClass: "bg-blue-500",
	},
	shipped: {
		badgeVariant: "secondary",
		dotClass: "bg-violet-500",
	},
	delivered: {
		badgeVariant: "success",
		dotClass: "bg-emerald-500",
	},
	returned: {
		badgeVariant: "outline",
		dotClass: "bg-slate-400",
	},
	cancelled: {
		badgeVariant: "destructive",
		dotClass: "bg-red-500",
	},
};

/** Streamed assistant openers for a project's very first generation, keyed
 * by the language of the page being generated so replies match the thread. */
export const FIRST_GENERATION_REPLIES: Record<
	PageLang,
	((name: string) => string)[]
> = {
	en: [
		(name) =>
			`Nice brief. I'm building “${name}” as a mobile-first landing page: a sharp hero, benefits that sell, social proof, and a cash-on-delivery order form. Generating the first version now.`,
		(name) =>
			`Got it — “${name}”. I'll structure the page for paid traffic: a strong hook above the fold, trust signals through the middle, and a frictionless COD form to close. Building v1 now.`,
	],
	fr: [
		(name) =>
			`Très bon brief. Je construis « ${name} » en mobile-first : un hero fort, des bénéfices qui vendent, de la preuve sociale et un formulaire de commande à la livraison. Première version en cours.`,
		(name) =>
			`C'est noté — « ${name} ». Je structure la page pour le trafic payant : une accroche forte au-dessus de la ligne de flottaison, des signaux de confiance, et un formulaire COD sans friction. La v1 arrive.`,
	],
	ar: [
		(name) =>
			`ممتاز — أبني «${name}» كصفحة هبوط للهاتف أولاً: مقدمة قوية، فوائد تبيع، دليل اجتماعي، ثم استمارة طلب بالدفع عند الاستلام. النسخة الأولى قيد الإنشاء.`,
		(name) =>
			`تم — «${name}». سأهيكل الصفحة لحملات الإعلانات: جملة قوية في الأعلى، إشارات ثقة في الوسط، واستمارة طلب سلسة في الأسفل. جاري إنشاء النسخة الأولى.`,
	],
};

/** Streamed assistant replies for iteration prompts, keyed by page language. */
export const ITERATION_REPLIES: Record<PageLang, string[]> = {
	en: [
		"Done — I applied that across the page and kept the design consistent. Generating the updated version now.",
		"Good call. I reworked that section and tightened the flow around it so the page still reads as one piece. Building the new version now.",
		"On it — change applied, plus a small spacing and contrast pass to keep everything aligned. Generating now.",
	],
	fr: [
		"C'est fait — j'ai appliqué le changement sur toute la page en gardant un design cohérent. Génération de la nouvelle version en cours.",
		"Bien vu. J'ai retravaillé cette section et resserré le flux autour pour que la page reste homogène. Nouvelle version en cours.",
		"C'est appliqué, avec une petite passe d'espacement et de contraste pour garder l'ensemble aligné. Génération en cours.",
	],
	ar: [
		"تم — طبّقت التعديل على كامل الصفحة مع الحفاظ على تناسق التصميم. جاري إنشاء النسخة الجديدة.",
		"فكرة جيدة. أعدت صياغة هذا القسم وشددت التدفق حوله لتبقى الصفحة قطعة واحدة. جاري الإنشاء.",
		"طبّقت التغيير مع لمسة خفيفة على المسافات والتباين ليبقى كل شيء متناسقًا. النسخة الجديدة قيد الإنشاء.",
	],
};
