/**
 * Fixed values of the V2 app builder workspace: views, More and Cloud panels,
 * devices, and composer modes. Also the storage keys and panel widths of the
 * chat column, and the easing and detail pace of the start-up screens. Read by
 * the route search schema, the shell, the More view, the Cloud panels, the
 * preview, and the chat. No logic and no React here.
 */

import type { Icon } from "@phosphor-icons/react";
import { CalendarDotsIcon } from "@phosphor-icons/react/CalendarDots";
import { ChartLineUpIcon } from "@phosphor-icons/react/ChartLineUp";
import { CreditCardIcon } from "@phosphor-icons/react/CreditCard";
import { DatabaseIcon } from "@phosphor-icons/react/Database";
import { FunctionIcon } from "@phosphor-icons/react/Function";
import { GearSixIcon } from "@phosphor-icons/react/GearSix";
import { GlobeIcon } from "@phosphor-icons/react/Globe";
import { HardDrivesIcon } from "@phosphor-icons/react/HardDrives";
import { KeyIcon } from "@phosphor-icons/react/Key";
import { LockKeyIcon } from "@phosphor-icons/react/LockKey";
import { PlugsConnectedIcon } from "@phosphor-icons/react/PlugsConnected";
import { ScrollIcon } from "@phosphor-icons/react/Scroll";
import { ShieldCheckIcon } from "@phosphor-icons/react/ShieldCheck";
import { SparkleIcon } from "@phosphor-icons/react/Sparkle";
import { StorefrontIcon } from "@phosphor-icons/react/Storefront";
import { UsersIcon } from "@phosphor-icons/react/Users";

import type { TranslationKey } from "@/lib/i18n";
import type { AppProjectKind } from "../api/dto";

/**
 * Main views of the workspace. `more` opens the project panels: the More
 * panels and, behind the Cloud rollout gate, the Cloud panels.
 */
export const BUILDER_VIEWS = ["preview", "code", "more"] as const;
export type BuilderView = (typeof BUILDER_VIEWS)[number];

/** Panels of the More view, in nav order. `domains` is web only, `appStores` is mobile only. */
export const MORE_PANELS = [
	"analytics",
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

/**
 * A More panel that the More view can open. The nav lists Integrations muted,
 * with a "Soon" badge, and never opens it. Payments opens its coming-soon page.
 */
export type EnabledMorePanel = Exclude<MorePanel, "integrations">;

/**
 * Panels of the Backend group of the More view, in nav order (WANDIT-188).
 * Every panel except `secrets` needs a running backend; secrets live in the
 * Wandit database. No id is also in MORE_PANELS, so `?panel=` holds both.
 */
export const CLOUD_PANELS = [
	"database",
	"users",
	"storage",
	"secrets",
	"logs",
	"functions",
	"jobs",
] as const;
export type CloudPanel = (typeof CLOUD_PANELS)[number];

/** A panel that the More view can open: an enabled More panel, or a Cloud panel behind the gate. */
export type ProjectPanel = EnabledMorePanel | CloudPanel;

/** Phosphor icon of each Cloud panel in the More nav. The label is `workspace.cloud.panels.<id>`. */
export const CLOUD_PANEL_ICONS: Record<CloudPanel, Icon> = {
	database: DatabaseIcon,
	users: UsersIcon,
	storage: HardDrivesIcon,
	secrets: KeyIcon,
	logs: ScrollIcon,
	functions: FunctionIcon,
	jobs: CalendarDotsIcon,
};

/** Rows per page of the Cloud table grid and of the users list. Both routes accept at most 100. */
export const CLOUD_ROWS_PAGE_SIZE = 50;

/**
 * Largest file the Storage panel uploads: 50 MB, the default file size limit
 * of a Supabase project. The browser checks it before it asks for an upload URL.
 */
export const CLOUD_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

/** Cell text of a Cloud panel for a value the API does not give: no email, a folder size, a run without a start. */
export const CLOUD_EMPTY_CELL = "—";

/** Date and time style of the Cloud panels, for example "Oct 3, 2026, 2:15 AM" in English. */
export const CLOUD_DATE_TIME_FORMAT = {
	dateStyle: "medium",
	timeStyle: "short",
} as const satisfies Intl.DateTimeFormatOptions;

/** Phone frames of the mobile preview, and the platforms of an Appetize device. */
export const PHONE_DEVICES = ["ios", "android"] as const;
export type PhoneDevice = (typeof PHONE_DEVICES)[number];

/**
 * What the mobile preview shows. `web` is the live web build of the app in a
 * phone frame, the default. `ios` and `android` stream a real device from
 * Appetize into the frame, behind useDevicePreviewEnabled.
 */
export const MOBILE_PREVIEW_TARGETS = ["web", ...PHONE_DEVICES] as const;
export type MobilePreviewTarget = (typeof MOBILE_PREVIEW_TARGETS)[number];

/** Frame widths of the web preview. One button switches between the two. */
export const WEB_VIEWPORTS = ["desktop", "mobile"] as const;
export type WebViewport = (typeof WEB_VIEWPORTS)[number];

/** `build` changes the code. `plan` only answers in the chat. */
export const COMPOSER_MODES = ["build", "plan"] as const;
export type ComposerMode = (typeof COMPOSER_MODES)[number];

type MorePanelMeta = {
	/** Phosphor icon of the nav row and of the empty state of the panel. */
	icon: Icon;
	/** Project kinds that list the panel in the More nav. */
	kinds: readonly AppProjectKind[];
	title: TranslationKey;
	description: TranslationKey;
};

const ALL_KINDS: readonly AppProjectKind[] = ["web", "mobile"];

/** Icon, visibility, and copy keys of each More panel. */
export const MORE_PANEL_META: Record<MorePanel, MorePanelMeta> = {
	analytics: {
		icon: ChartLineUpIcon,
		kinds: ALL_KINDS,
		title: "appBuilder.panels.analytics.title",
		description: "appBuilder.panels.analytics.description",
	},
	signIn: {
		icon: LockKeyIcon,
		kinds: ALL_KINDS,
		title: "appBuilder.panels.signIn.title",
		description: "appBuilder.panels.signIn.description",
	},
	ai: {
		icon: SparkleIcon,
		kinds: ALL_KINDS,
		title: "appBuilder.panels.ai.title",
		description: "appBuilder.panels.ai.description",
	},
	payments: {
		icon: CreditCardIcon,
		kinds: ALL_KINDS,
		title: "appBuilder.panels.payments.title",
		description: "appBuilder.panels.payments.description",
	},
	integrations: {
		icon: PlugsConnectedIcon,
		kinds: ALL_KINDS,
		title: "appBuilder.panels.integrations.title",
		description: "appBuilder.panels.integrations.description",
	},
	domains: {
		icon: GlobeIcon,
		kinds: ["web"],
		title: "appBuilder.panels.domains.title",
		description: "appBuilder.panels.domains.description",
	},
	appStores: {
		icon: StorefrontIcon,
		kinds: ["mobile"],
		title: "appBuilder.panels.appStores.title",
		description: "appBuilder.panels.appStores.description",
	},
	security: {
		icon: ShieldCheckIcon,
		kinds: ALL_KINDS,
		title: "appBuilder.panels.security.title",
		description: "appBuilder.panels.security.description",
	},
	settings: {
		icon: GearSixIcon,
		kinds: ALL_KINDS,
		title: "appBuilder.panels.settings.title",
		description: "appBuilder.panels.settings.description",
	},
};

/** localStorage key of the chat pane open state. Not the V1 key, so each workspace keeps its own choice. */
export const CHAT_OPEN_STORAGE_KEY = "wandit-app-builder-chat-open";

/** localStorage key of the chat | main split. Holds the react-resizable-panels layout, panel id to percent. */
export const CHAT_LAYOUT_STORAGE_KEY = "wandit-app-builder-chat-layout";

/** Start width of the chat column. The width of the design (400 px) fits the composer row and every card. */
export const CHAT_PANEL_DEFAULT_WIDTH = "400px";

/** Narrowest chat column. The composer row (add, credits, mode, mic, send) needs about 300 px. */
export const CHAT_PANEL_MIN_WIDTH = "320px";

/** Width of the web preview iframe in the mobile viewport, CSS px. The logical width of an iPhone 15. */
export const MOBILE_VIEWPORT_WIDTH_PX = 393;

/**
 * Height of the web preview iframe in the mobile viewport, CSS px. The
 * logical height of an iPhone 15. A shorter stage makes the phone smaller.
 * The phone frame of mobile projects uses it for the iOS screen too.
 */
export const MOBILE_VIEWPORT_HEIGHT_PX = 852;

/**
 * Layout width of the app in the phone frame, CSS px: the iPhone 15 and the
 * Pixel 8 logical widths. The frame scales the app down to its screen.
 */
export const PHONE_VIEWPORT_WIDTH_PX: Record<PhoneDevice, number> = {
	ios: MOBILE_VIEWPORT_WIDTH_PX,
	android: 412,
};

/** localStorage key of the Expo Go username that the user typed for the iPhone. Sent with each phone link mint. */
export const EXPO_GO_USERNAME_STORAGE_KEY =
	"wandit-app-builder-expo-go-username";

/** Expo SDK of the mobile-app template (templates/mobile-app/package.json). The store Expo Go must run the same SDK. */
export const EXPO_GO_SDK_VERSION = 57;

/** Store pages of Expo Go. The labels are brand names, so they stay out of the dictionaries. */
export const EXPO_GO_STORE_LINKS = [
	{ label: "App Store", url: "https://apps.apple.com/app/expo-go/id982107779" },
	{
		label: "Google Play",
		url: "https://play.google.com/store/apps/details?id=host.exp.exponent",
	},
] as const;

/** Round-trip delay of a mock service call, ms. Long enough to show pending states, short enough to feel local. */
export const MOCK_LATENCY_MS = 150;

/** Easing of the preview boot screen and its exit, as a motion cubic bezier. It is the `cubic-bezier(0.4, 0, 0.2, 1)` of DESIGN.md. */
export const BOOT_EASE = [0.4, 0, 0.2, 1] as const;

/**
 * Time each start-up detail line stays before the next one, ms. The preview
 * boot screen and the chat working row both use it, so the two lists keep
 * the same pace. The last line then stays.
 */
export const DETAIL_STEP_MS = 3200;
