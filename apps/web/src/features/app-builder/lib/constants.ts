/**
 * Fixed values of the V2 app builder workspace: views, More panels, devices,
 * and composer modes. Also the storage keys and panel widths of the chat card.
 * Read by the route search schema, the shell, and the More view.
 * No logic and no React here.
 */

import type { LucideIcon } from "lucide-react";
import {
	Cable,
	ChartLine,
	CreditCard,
	Database,
	Globe,
	Lock,
	Settings,
	Shield,
	Sparkles,
	Store,
} from "lucide-react";

import type { TranslationKey } from "@/lib/i18n";
import type { AppProjectKind } from "../api/dto";

/** Main views of the workspace. `more` opens the settings-like panels. */
export const BUILDER_VIEWS = ["preview", "code", "more"] as const;
export type BuilderView = (typeof BUILDER_VIEWS)[number];

/** Panels of the More view, in nav order. `domains` is web only, `appStores` is mobile only. */
export const MORE_PANELS = [
	"analytics",
	"backend",
	"signIn",
	"ai",
	"payments",
	"integrations",
	"domains",
	"appStores",
	"security",
	"settings",
] as const;
export type MorePanel = (typeof MORE_PANELS)[number];

/** Phone frames of the mobile preview. */
export const PHONE_DEVICES = ["ios", "android"] as const;
export type PhoneDevice = (typeof PHONE_DEVICES)[number];

/** Frame widths of the web preview. `tablet` sits between `desktop` and `mobile`. */
export const WEB_VIEWPORTS = ["desktop", "tablet", "mobile"] as const;
export type WebViewport = (typeof WEB_VIEWPORTS)[number];

/** `build` changes the code. `plan` only answers in the chat. */
export const COMPOSER_MODES = ["build", "plan"] as const;
export type ComposerMode = (typeof COMPOSER_MODES)[number];

type MorePanelMeta = {
	icon: LucideIcon;
	/** Project kinds that list the panel in the More nav. */
	kinds: readonly AppProjectKind[];
	title: TranslationKey;
	description: TranslationKey;
};

const ALL_KINDS: readonly AppProjectKind[] = ["web", "mobile"];

/** Icon, visibility, and copy keys of each More panel. */
export const MORE_PANEL_META: Record<MorePanel, MorePanelMeta> = {
	analytics: {
		icon: ChartLine,
		kinds: ALL_KINDS,
		title: "appBuilder.panels.analytics.title",
		description: "appBuilder.panels.analytics.description",
	},
	backend: {
		icon: Database,
		kinds: ALL_KINDS,
		title: "appBuilder.panels.backend.title",
		description: "appBuilder.panels.backend.description",
	},
	signIn: {
		icon: Lock,
		kinds: ALL_KINDS,
		title: "appBuilder.panels.signIn.title",
		description: "appBuilder.panels.signIn.description",
	},
	ai: {
		icon: Sparkles,
		kinds: ALL_KINDS,
		title: "appBuilder.panels.ai.title",
		description: "appBuilder.panels.ai.description",
	},
	payments: {
		icon: CreditCard,
		kinds: ALL_KINDS,
		title: "appBuilder.panels.payments.title",
		description: "appBuilder.panels.payments.description",
	},
	integrations: {
		icon: Cable,
		kinds: ALL_KINDS,
		title: "appBuilder.panels.integrations.title",
		description: "appBuilder.panels.integrations.description",
	},
	domains: {
		icon: Globe,
		kinds: ["web"],
		title: "appBuilder.panels.domains.title",
		description: "appBuilder.panels.domains.description",
	},
	appStores: {
		icon: Store,
		kinds: ["mobile"],
		title: "appBuilder.panels.appStores.title",
		description: "appBuilder.panels.appStores.description",
	},
	security: {
		icon: Shield,
		kinds: ALL_KINDS,
		title: "appBuilder.panels.security.title",
		description: "appBuilder.panels.security.description",
	},
	settings: {
		icon: Settings,
		kinds: ALL_KINDS,
		title: "appBuilder.panels.settings.title",
		description: "appBuilder.panels.settings.description",
	},
};

/** localStorage key of the chat pane open state. Not the V1 key, so each workspace keeps its own choice. */
export const CHAT_OPEN_STORAGE_KEY = "wandit-app-builder-chat-open";

/** localStorage key of the chat | main split. Holds the react-resizable-panels layout, panel id to percent. */
export const CHAT_LAYOUT_STORAGE_KEY = "wandit-app-builder-chat-layout";

/** Start width of the chat card. The width of the design (400 px) fits the composer row and every card. */
export const CHAT_PANEL_DEFAULT_WIDTH = "400px";

/** Narrowest chat card. The composer row (add, credits, mode, mic, send) needs about 300 px. */
export const CHAT_PANEL_MIN_WIDTH = "320px";

/** Width of the web preview iframe in the tablet viewport, CSS px. The iPad portrait logical width. */
export const TABLET_VIEWPORT_WIDTH_PX = 768;

/** Width of the web preview iframe in the mobile viewport, CSS px. The logical width of an iPhone 15. */
export const MOBILE_VIEWPORT_WIDTH_PX = 393;

/** Round-trip delay of a mock service call, ms. Long enough to show pending states, short enough to feel local. */
export const MOCK_LATENCY_MS = 150;
