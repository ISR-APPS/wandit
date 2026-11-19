/**
 * Frame and shared look of every panel of the More view, except the code
 * screen. The code screen fills the view with no shell. PanelShell draws the
 * icon tile, the title, and the description of the open panel above its body. The class
 * constants, PanelChip, and PanelMessage give all panels one look for cards,
 * chips, inputs, tabs, and empty states.
 * Rendered by more-view.tsx; the panels of more/ and cloud/ import the rest.
 * The feature barrel exports some class constants for features/coding-agents, which also renders outside the workspace.
 * So a `studio:` class holds each look that only the workspace has.
 */

import type { Icon } from "@phosphor-icons/react";
import { cn } from "@wandit/ui/lib/utils";
import type { ReactNode } from "react";

import { useTranslation } from "@/lib/i18n";
import {
	CLOUD_PANEL_ICONS,
	MORE_PANEL_META,
	type ShellPanel,
} from "../../lib/constants";
import { isCloudPanel } from "../../lib/helpers";

/** Props of PanelShell. more-view.tsx passes the last open panel that is not `code`. */
export type PanelShellProps = {
	/** The open panel. A More panel reads its copy from MORE_PANEL_META, a Cloud panel from `workspace.cloud`. */
	panel: ShellPanel;
	/** The open panel component. Each panel shows its own loading and error states. */
	children: ReactNode;
};

/**
 * Icon tile, title, description, and body of one panel. The tile repeats the
 * icon of the open nav row, so each panel has its own face. A Cloud panel
 * gets a wider body: its tables have more columns than the cards of a More
 * panel.
 */
export function PanelShell({ panel, children }: PanelShellProps) {
	const { t } = useTranslation();
	const isCloud = isCloudPanel(panel);
	const title = isCloud
		? t(`workspace.cloud.panels.${panel}`)
		: t(MORE_PANEL_META[panel].title);
	const description = isCloud
		? t(`workspace.cloud.descriptions.${panel}`)
		: t(MORE_PANEL_META[panel].description);
	const PanelIcon = isCloud
		? CLOUD_PANEL_ICONS[panel]
		: MORE_PANEL_META[panel].icon;

	return (
		// The column sits in the middle of a wide stage, so no empty band stays at the end side.
		<div
			className={cn(
				"mx-auto flex w-full flex-col",
				isCloud ? "max-w-5xl" : "max-w-3xl",
			)}
		>
			<header className="flex items-start gap-4">
				{/* On a phone the nav strip above already shows the icon, and the title needs the width. */}
				<span
					aria-hidden
					className="hidden size-10 shrink-0 place-items-center rounded-[16px] bg-night text-spark shadow-key sm:grid dark:bg-spark dark:text-night"
				>
					<PanelIcon weight="duotone" className="size-5" />
				</span>
				<div className="min-w-0">
					<h1 className="font-grotesk font-semibold text-[1.5rem] text-night leading-[1.2] tracking-[-0.02em] dark:text-foreground">
						{title}
					</h1>
					<p className="mt-1 max-w-2xl font-sans text-[14px] text-night/60 leading-relaxed dark:text-foreground/60">
						{description}
					</p>
				</div>
			</header>
			<div className="mt-7 flex min-w-0 flex-col gap-4">{children}</div>
		</div>
	);
}

/**
 * Face of every card inside a panel: white with a navy hairline and no shadow.
 * The corner is 20 px, the card corner of the app.
 * The card reads on the off-white ground that more-view.tsx puts under the panel.
 */
export const PANEL_CARD_CLASS =
	"rounded-[20px] border border-night/[0.08] bg-white dark:border-white/[0.08] dark:bg-white/[0.03]";

/** Title of a card. The Settings and Integrations panels use it. */
export const PANEL_CARD_TITLE_CLASS =
	"font-grotesk font-semibold text-[15px] text-night dark:text-foreground";

/** Hint line under a card title or a field. Navy at 60 % keeps 13 px text over 4.5:1 on the white card. */
export const PANEL_HINT_CLASS =
	"font-sans text-[13px] text-night/60 dark:text-foreground/60";

/** Label above a field of a card. */
export const PANEL_FIELD_LABEL_CLASS =
	"font-grotesk font-medium text-[13px] text-night/70 dark:text-foreground/70";

/** Hairline above a row of a card. The caller adds the top margin and padding. */
export const PANEL_CARD_ROW_CLASS =
	"border-night/[0.07] border-t dark:border-white/[0.07]";

/**
 * Pill text field of the workspace panels and popovers, for the kit Input and Select trigger. It is 36 px high.
 * The focus ring is a soft ember halo. A Textarea that uses it sets its own corner.
 * The last class keeps the red invalid border in dark mode. The dark border class is stronger than the kit one.
 */
export const PANEL_INPUT_CLASS =
	"h-9 rounded-full border-night/[0.12] bg-white px-4 shadow-none placeholder:text-night/40 focus-visible:border-primary/50 focus-visible:ring-primary/15 dark:border-white/[0.12] dark:bg-white/[0.04] dark:placeholder:text-foreground/40 dark:aria-invalid:border-destructive";

/**
 * Main ember pill of the panels, for the kit Button with the default variant. It has the ember glow of the app.
 * In the workspace the `studio:` classes give it medium 13 px text.
 * A disabled pill turns flat navy-grey, not a faded ember, so it reads as "not yet".
 */
export const PANEL_PRIMARY_BUTTON_CLASS =
	"font-grotesk font-semibold shadow-ember hover:bg-ember-deep active:translate-y-px disabled:bg-night/10 disabled:text-night/40 disabled:opacity-100 disabled:shadow-none dark:hover:bg-primary/90 dark:disabled:bg-white/10 dark:disabled:text-foreground/40 studio:font-medium studio:text-[13px]";

/**
 * Second action of the panels, for the kit Button with `variant="outline"`: a raised white pill outside the workspace.
 * In the workspace the `studio:` classes make it a flat outline with 13 px text and an ink hover tint.
 * The kit Button gives the pill corner.
 */
export const PANEL_SECONDARY_BUTTON_CLASS =
	"border-night/[0.1] bg-white font-grotesk font-medium text-night shadow-raised hover:border-night/20 hover:bg-white hover:text-night active:translate-y-px disabled:shadow-none dark:border-white/[0.12] dark:bg-white/[0.04] dark:text-foreground dark:hover:bg-white/[0.08] dark:hover:text-foreground studio:shadow-none studio:hover:border-night/[0.12] studio:hover:bg-night/[0.04] dark:studio:hover:border-white/[0.12] dark:studio:hover:bg-white/[0.08] studio:text-[13px]";

/**
 * Track of a kit TabsList: a pill with an ink tint. Outside the workspace it is recessed and 40 px high.
 * In the workspace the `studio:` classes make it flat and 32 px high.
 * Each height repeats the group variant of the kit, because a plain h-10 loses to it.
 */
export const PANEL_TABS_LIST_CLASS =
	"rounded-full border-0 bg-night/[0.055] p-1 shadow-well group-data-[orientation=horizontal]/tabs:h-10 dark:bg-white/[0.06] studio:p-0.5 studio:shadow-none studio:group-data-[orientation=horizontal]/tabs:h-8";

/**
 * One kit TabsTrigger on PANEL_TABS_LIST_CLASS. The open tab is a night key, a spark key in dark mode.
 * In the workspace each tab is 28 px high with 13 px text. The open tab is a white pill there, like the active segment of shell/segmented-control.tsx.
 * Each shadow class repeats the variant chain of the kit trigger. A shorter class can lose to the shadow it replaces.
 */
export const PANEL_TABS_TRIGGER_CLASS =
	"h-8 flex-none rounded-full px-3.5 font-grotesk font-medium text-night/60 hover:text-night data-[state=active]:bg-night data-[state=active]:text-paper group-data-[variant=default]/tabs-list:data-[state=active]:shadow-key dark:text-foreground/60 dark:hover:text-foreground dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-spark dark:data-[state=active]:text-night studio:h-7 studio:text-[13px] studio:data-[state=active]:bg-white studio:data-[state=active]:text-night studio:group-data-[variant=default]/tabs-list:data-[state=active]:shadow-raised dark:studio:data-[state=active]:bg-spark";

/** Text and ground of each chip tone. Each tone keeps its text readable on the white card. */
const CHIP_TONE_CLASS = {
	neutral:
		"bg-night/[0.05] text-night/65 dark:bg-white/[0.07] dark:text-foreground/70",
	success: "bg-success/[0.12] text-success-text",
	warning: "bg-spark/[0.18] text-ember-deep dark:bg-spark/15 dark:text-spark",
	danger: "bg-destructive/10 text-destructive",
	ember: "bg-primary/10 text-ember-text",
} as const;

/** Tone of a PanelChip. The logs panel maps each log level to one. */
export type PanelChipTone = keyof typeof CHIP_TONE_CLASS;

/** A small status pill: "Soon", "Live", a log level, a bucket access. The text carries the meaning, the tone only helps. */
export function PanelChip({
	tone = "neutral",
	className,
	children,
}: {
	tone?: PanelChipTone;
	/** Extra classes, for example `font-mono` for a status code. */
	className?: string;
	children: ReactNode;
}) {
	return (
		<span
			className={cn(
				"inline-flex h-6 w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 font-grotesk font-medium text-xs",
				CHIP_TONE_CLASS[tone],
				className,
			)}
		>
			{children}
		</span>
	);
}

/** Props of PanelMessage. The empty panels, the backend gate, and the empty lists pass them. */
export type PanelMessageProps = {
	icon: Icon;
	/** Title line, in semibold. A short message inside a panel has none. */
	title?: string;
	/** The body line, in ink at 60 %. */
	text: string;
	/**
	 * `feature`: the 48 px night tile with a spark icon, for a whole empty panel or a
	 * backend state. `inline`: a dim 40 px tile, for an empty list or a failed load.
	 */
	tone?: "feature" | "inline";
	/** Buttons or notes under the text. */
	children?: ReactNode;
};

/** A centered state card: an icon tile, a title, one text line, and its actions. */
export function PanelMessage({
	icon: MessageIcon,
	title,
	text,
	tone = "inline",
	children,
}: PanelMessageProps) {
	const isFeature = tone === "feature";

	return (
		<div
			className={cn(
				PANEL_CARD_CLASS,
				"flex flex-col items-center px-6 text-center",
				// A feature state gets a soft spark glow above its tile.
				isFeature
					? "bg-[radial-gradient(60%_55%_at_50%_0%,rgb(250_171_63/0.13),transparent)] py-14 dark:bg-[radial-gradient(60%_55%_at_50%_0%,rgb(250_171_63/0.07),transparent)]"
					: "py-10",
			)}
		>
			<span
				aria-hidden
				className={cn(
					"grid shrink-0 place-items-center rounded-[16px]",
					// The feature tile is the night key with a spark icon. The inline tile is a dim ink tint.
					isFeature
						? "size-12 bg-night text-spark shadow-key dark:bg-spark dark:text-night"
						: "size-10 bg-night/[0.05] text-night/55 dark:bg-white/[0.06] dark:text-foreground/60",
				)}
			>
				<MessageIcon
					weight="duotone"
					className={isFeature ? "size-6" : "size-5"}
				/>
			</span>
			{title ? (
				<p
					className={cn(
						"font-grotesk font-semibold text-night tracking-[-0.01em] dark:text-foreground",
						isFeature ? "mt-5 text-[17px]" : "mt-4 text-[15px]",
					)}
				>
					{title}
				</p>
			) : null}
			<p
				className={cn(
					"max-w-sm font-sans text-[14px] text-night/60 leading-relaxed dark:text-foreground/60",
					title ? "mt-1.5" : "mt-4",
				)}
			>
				{text}
			</p>
			{children ? (
				<div className="mt-5 flex flex-col items-center gap-3">{children}</div>
			) : null}
		</div>
	);
}
