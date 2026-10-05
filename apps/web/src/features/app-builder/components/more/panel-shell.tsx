/**
 * Frame and shared look of every panel of the More view. PanelShell draws the
 * title and the description of the open panel above its body. The class
 * constants, PanelChip, and PanelMessage give all panels one look for cards,
 * chips, inputs, tabs, and empty states.
 * Rendered by more-view.tsx; the panels of more/ and cloud/ import the rest.
 */

import type { Icon } from "@phosphor-icons/react";
import { cn } from "@wandit/ui/lib/utils";
import type { ReactNode } from "react";

import { useTranslation } from "@/lib/i18n";
import { MORE_PANEL_META, type ProjectPanel } from "../../lib/constants";
import { isCloudPanel } from "../../lib/helpers";

/** Props of PanelShell. more-view.tsx passes the resolved open panel. */
export type PanelShellProps = {
	/** The open panel. A More panel reads its copy from MORE_PANEL_META, a Cloud panel from `workspace.cloud`. */
	panel: ProjectPanel;
	/** The open panel component. Each panel shows its own loading and error states. */
	children: ReactNode;
};

/**
 * Title, description, and body of one panel. A Cloud panel gets a wider body:
 * its tables have more columns than the cards of a More panel.
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

	return (
		<div className={cn("flex flex-col", isCloud ? "max-w-5xl" : "max-w-3xl")}>
			<h1 className="font-extrabold font-grotesk text-[1.75rem] text-night leading-tight tracking-[-0.03em] dark:text-foreground">
				{title}
			</h1>
			<p className="mt-1.5 max-w-2xl font-sans text-[15px] text-night/60 leading-relaxed dark:text-foreground/60">
				{description}
			</p>
			<div className="mt-6 flex min-w-0 flex-col gap-4">{children}</div>
		</div>
	);
}

/** Face of every card inside a panel: white with a navy hairline. On the white stage card, the hairline draws the edge. */
export const PANEL_CARD_CLASS =
	"rounded-[20px] border border-night/[0.08] bg-white dark:border-white/[0.08] dark:bg-white/[0.03]";

/** Pill text field of the panels, for the kit Input. The focus ring is a soft ember halo. */
export const PANEL_INPUT_CLASS =
	"h-10 rounded-full border-night/[0.12] bg-white px-4 shadow-none placeholder:text-night/40 focus-visible:border-primary/50 focus-visible:ring-primary/15 dark:border-white/[0.12] dark:bg-white/[0.04] dark:placeholder:text-foreground/40";

/**
 * Main ember pill of the panels, for the kit Button with the default variant.
 * A disabled pill turns navy-grey, not a faded ember, so it reads as "not yet".
 */
export const PANEL_PRIMARY_BUTTON_CLASS =
	"font-grotesk font-semibold disabled:bg-night/10 disabled:text-night/40 disabled:opacity-100 dark:disabled:bg-white/10 dark:disabled:text-foreground/40";

/**
 * Secondary pill button of the panels, for the kit Button with
 * `variant="outline"`. The kit Button is already round.
 */
export const PANEL_SECONDARY_BUTTON_CLASS =
	"border-night/[0.12] bg-white font-grotesk font-medium text-night shadow-none hover:bg-night/[0.04] hover:text-night dark:border-white/[0.12] dark:bg-white/[0.04] dark:text-foreground dark:hover:bg-white/[0.08] dark:hover:text-foreground";

/**
 * Track of a kit TabsList: the segmented pill of the dashboard filter. The
 * height repeats the group variant of the kit, because a plain h-10 loses to it.
 */
export const PANEL_TABS_LIST_CLASS =
	"rounded-full border-0 bg-night/[0.05] p-1 group-data-[orientation=horizontal]/tabs:h-10 dark:bg-white/[0.06]";

/** One kit TabsTrigger on PANEL_TABS_LIST_CLASS. The open tab is a night pill, a spark pill in dark mode. */
export const PANEL_TABS_TRIGGER_CLASS =
	"h-8 flex-none rounded-full px-3.5 font-grotesk font-medium text-night/60 hover:text-night data-[state=active]:bg-night data-[state=active]:text-paper data-[state=active]:shadow-none dark:text-foreground/60 dark:hover:text-foreground dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-spark dark:data-[state=active]:text-night";

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
	/** Grotesk title line. A short message inside a panel has none. */
	title?: string;
	/** The body line in DM Sans. */
	text: string;
	/**
	 * `feature`: the 64 px night tile, for a whole empty panel or a backend
	 * state. `inline`: a soft 48 px tile, for an empty list or a failed load.
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
				// A feature state gets a soft spark glow above its tile, like the desk of the workspace.
				isFeature
					? "bg-[radial-gradient(60%_55%_at_50%_0%,rgb(250_171_63/0.13),transparent)] py-14 dark:bg-[radial-gradient(60%_55%_at_50%_0%,rgb(250_171_63/0.07),transparent)]"
					: "py-10",
			)}
		>
			<span
				aria-hidden
				className={cn(
					"grid shrink-0 place-items-center",
					isFeature
						? "size-16 rounded-[20px] bg-night text-spark shadow-[0_12px_28px_-14px_rgb(11_16_51/0.6)] dark:bg-spark dark:text-night dark:shadow-none"
						: "size-12 rounded-[16px] bg-night/[0.05] text-night/55 dark:bg-white/[0.06] dark:text-foreground/60",
				)}
			>
				<MessageIcon
					weight="duotone"
					className={isFeature ? "size-8" : "size-6"}
				/>
			</span>
			{title ? (
				<p
					className={cn(
						"font-grotesk font-semibold text-night tracking-[-0.01em] dark:text-foreground",
						isFeature ? "mt-5 text-[20px]" : "mt-4 text-[15px]",
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
