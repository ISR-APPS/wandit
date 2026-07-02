// All user-facing copy for the workspace feature (centralized so a locale
// swap is cheap) + tab/status/timing config.

import type { LucideIcon } from "lucide-react";
import { AppWindow, Images, Settings2, Users } from "lucide-react";

import type { LeadStatus, PageLang, WorkspaceTab } from "../api/dto";

export const WORKSPACE_TAB_VALUES = [
	"page",
	"assets",
	"leads",
	"settings",
] as const;

export type WorkspaceTabDef = {
	value: WorkspaceTab;
	label: string;
	icon: LucideIcon;
};

export const WORKSPACE_TABS: WorkspaceTabDef[] = [
	{ value: "page", label: "Page", icon: AppWindow },
	{ value: "assets", label: "Assets", icon: Images },
	{ value: "leads", label: "Leads", icon: Users },
	{ value: "settings", label: "Settings", icon: Settings2 },
];

/** Published sites live on {slug}.wandit.app — mirrors projects' copy. */
export const PUBLISHED_DOMAIN = ".wandit.app";

export const LEADS_PAGE_SIZE = 12;
export const CHAT_OPEN_STORAGE_KEY = "wandit-workspace-chat-open";
/** react-resizable-panels autoSaveId — persists chat/main split width. */
export const WORKSPACE_PANELS_STORAGE_ID = "wandit-workspace-panels";
/** Assets tab view mode (grid vs freeform board), mirrors chat-open persistence. */
export const ASSETS_VIEW_STORAGE_KEY = "wandit-workspace-assets-view";

// Mock job pacing (ms) — tuned to feel like a real queue without dragging.
export const THINKING_DELAY_MS = 650;
export const STREAM_WORD_INTERVAL_MS = 30;
export const BUILD_DURATION_MS = 2600;
export const PUBLISH_DURATION_MS = 2200;
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

export const LEAD_STATUS_META: Record<
	LeadStatus,
	{
		label: string;
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
		label: "To confirm",
		badgeVariant: "warning",
		dotClass: "bg-amber-500",
	},
	confirmed: {
		label: "Confirmed",
		badgeVariant: "info",
		dotClass: "bg-blue-500",
	},
	shipped: {
		label: "Shipped",
		badgeVariant: "secondary",
		dotClass: "bg-violet-500",
	},
	delivered: {
		label: "Delivered",
		badgeVariant: "success",
		dotClass: "bg-emerald-500",
	},
	returned: {
		label: "Returned",
		badgeVariant: "outline",
		dotClass: "bg-slate-400",
	},
	cancelled: {
		label: "Cancelled",
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

export const WORKSPACE_COPY = {
	backToDashboard: "Back to dashboard",
	tabsAriaLabel: "Workspace views",

	switcher: {
		menuLabel: "Projects",
		allProjects: "All projects",
	},

	publish: {
		publish: "Publish",
		publishing: "Publishing…",
		published: "Published",
		publishUpdate: (n: number) => `Publish v${n}`,
		menuLiveLabel: "Live site",
		copyLink: "Copy link",
		openLive: "Open live site",
		unpublish: "Unpublish",
		linkCopied: "Link copied",
		publishedToast: (url: string) => `Live at ${url}`,
		unpublishedToast: "Site unpublished",
		freeNote: "Publishing is always free",
	},

	chat: {
		title: "Chat",
		collapse: "Collapse chat",
		expand: "Open chat",
		placeholder: "Describe a change…",
		thinking: "Thinking…",
		generating: "Generating",
		versionCardKind: "Landing page",
		emptyTitle: "Start the conversation",
		emptyBody: "Describe your page and the AI will generate it here.",
	},

	page: {
		versionShort: (n: number) => `v${n}`,
		latestSuffix: "Latest",
		liveBadge: "Live",
		versionsMenuLabel: "Versions",
		viewportMobile: "Mobile preview",
		viewportDesktop: "Desktop preview",
		refresh: "Reload preview",
		openInNewTab: "Open in new tab",
		emptyTitle: "Nothing to preview yet",
		emptyBody:
			"Describe your page in the chat — the preview appears here as it generates.",
		generatingTitle: (n: number) => `Generating v${n}`,
		generatingSteps: [
			"Analyzing your brief…",
			"Writing the sections…",
			"Styling for mobile…",
			"Wiring the order form…",
			"Final touches…",
		],
	},

	assets: {
		title: "Assets",
		subtitle: "Every generation is saved as an immutable version.",
		kindLandingPage: "Landing page",
		liveBadge: "Live",
		currentBadge: "Viewing",
		openOnPage: "View on page",
		openInNewTab: "Open in new tab",
		versionTitle: (n: number) => `Version ${n}`,
		emptyTitle: "No assets yet",
		emptyBody: "Generated pages (and soon images and videos) appear here.",
		libraryView: "Library",
		canvasView: "Canvas",
		viewToggleAriaLabel: "Assets view",
	},

	leads: {
		title: "Leads",
		searchPlaceholder: "Search name or phone…",
		filterAll: "All statuses",
		exportCsv: "Export CSV",
		exportedToast: (count: number) =>
			count === 1 ? "Exported 1 lead" : `Exported ${count} leads`,
		counterToday: "Today",
		counterWeek: "This week",
		counterTotal: "Total leads",
		counterConfirmation: "Confirmation rate",
		confirmationHint: "confirmed ÷ (confirmed + cancelled)",
		colName: "Name",
		colPhone: "Phone",
		colLocation: "Wilaya / Commune",
		colDate: "Date",
		colStatus: "Status",
		call: "Call",
		whatsapp: "WhatsApp",
		emptyTitle: "No leads yet",
		emptyBody: "Publish your page to start collecting orders.",
		emptyCta: "Open publish settings",
		noResultsTitle: "No matching leads",
		noResultsBody: "Try another search or clear the status filter.",
		clearFilters: "Clear filters",
		statusUpdated: (name: string, status: string) => `${name} → ${status}`,
		pageInfo: (from: number, to: number, total: number) =>
			`${from}–${to} of ${total}`,
		previous: "Previous",
		next: "Next",
		freeNote: "Lead collection is always free.",
	},

	settings: {
		title: "Settings",
		generalTitle: "General",
		generalDescription: "Name and ad tracking for this project.",
		nameLabel: "Project name",
		nameSave: "Save",
		nameSaved: "Project renamed",
		pixelsTitle: "Ad pixels",
		pixelsDescription:
			"Injected into your published page at publish time — paste the IDs from Meta and TikTok.",
		metaPixelLabel: "Meta pixel ID",
		tiktokPixelLabel: "TikTok pixel ID",
		pixelPlaceholder: "1234567890123456",
		pixelsSave: "Save pixels",
		pixelsSaved: "Pixels saved",
		publishTitle: "Publishing",
		publishDescription: "Your page lives on a free wandit.app subdomain.",
		slugLabel: "Subdomain",
		slugChecking: "Checking…",
		slugAvailable: "Available",
		slugTaken: "Taken — try another",
		slugInvalid: "Lowercase letters, numbers and hyphens only",
		slugSave: "Save slug",
		slugSaved: "Subdomain saved",
		liveUrlLabel: "Live URL",
		notPublished: "Not published yet",
		publishCta: "Publish",
		unpublishCta: "Unpublish",
		historyTitle: "Version history",
		historyRollback: "Roll back",
		historyLive: "Live",
		historyRolledBackToast: (n: number) => `Rolled back — v${n} is live`,
		dangerTitle: "Danger zone",
		dangerDescription:
			"Deleting a project removes its page, chat history and leads.",
		deleteCta: "Delete project",
		deleteTitle: "Delete project?",
		deleteDescription: (name: string) =>
			`"${name}" and its leads will be gone for good. This cannot be undone.`,
		deleteConfirm: "Delete",
		deleteCancel: "Cancel",
		deleteSuccess: "Project deleted",
	},

	notFound: {
		title: "Project not found",
		body: "It may have been deleted, or the link is wrong.",
		cta: "Back to dashboard",
	},
} as const;
