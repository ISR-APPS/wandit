/**
 * The shared frame of the four portal tables: the white table card with its
 * title row, the header and row classes, and the loading, empty, and error
 * states inside the card. The links, referrals, commissions, and payouts
 * tables render these parts. The portal page renders PortalTableError and
 * PortalRetryIcon for its own load error and refresh button.
 */
import type { Icon } from "@phosphor-icons/react";
import { ArrowClockwiseIcon } from "@phosphor-icons/react/ArrowClockwise";
import { WarningIcon } from "@phosphor-icons/react/Warning";
import { Button } from "@wandit/ui/components/button";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
import type * as React from "react";

import { useTranslation } from "@/lib/i18n";

const SKELETON_KEYS = ["one", "two", "three", "four", "five"];

/**
 * Goes on <TableHeader>. The `[&_th]` rules give every header cell the small
 * grotesk capitals, so each <TableHead> keeps only its alignment classes.
 * Arabic letters join, so `rtl:` removes the letter spacing that breaks the words.
 */
export const PORTAL_TABLE_HEADER_CLASS =
	"[&_tr]:border-night/[0.06] dark:[&_tr]:border-white/[0.06] [&_th]:h-11 [&_th]:font-grotesk [&_th]:font-semibold [&_th]:text-[11px] [&_th]:text-night/60 [&_th]:uppercase [&_th]:tracking-[0.08em] rtl:[&_th]:tracking-normal dark:[&_th]:text-foreground/60";

/** Goes on each body <TableRow>: a hairline border and a faint hover tint. */
export const PORTAL_TABLE_ROW_CLASS =
	"border-night/[0.06] hover:bg-night/[0.025] dark:border-white/[0.06] dark:hover:bg-white/[0.03]";

/** The white card around one portal table. The title row stays 64 px high with or without a filter. */
export function PortalTableCard({
	title,
	action,
	children,
}: {
	/** Translated table title, for example "Referral links". */
	title: string;
	/** A control at the end of the title row, for example the status filter. */
	action?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<section className="overflow-hidden rounded-[1.5rem] bg-white shadow-[0_2px_0_rgb(11_16_51/0.06)] ring-1 ring-night/[0.08] dark:bg-card dark:shadow-[0_2px_0_rgb(0_0_0/0.35)] dark:ring-white/10">
			<div className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-night/[0.06] border-b px-4 py-3.5 sm:px-6 dark:border-white/[0.06]">
				<h3 className="font-grotesk font-semibold text-[15px] text-night tracking-[-0.01em] dark:text-foreground">
					{title}
				</h3>
				{action}
			</div>
			{children}
		</section>
	);
}

/** Five row bars inside the table card while the first page loads. */
export function PortalTableSkeleton() {
	return (
		<div className="flex flex-col gap-3 p-4 sm:p-6" aria-hidden>
			<Skeleton className="h-8 w-full rounded-xl" />
			{SKELETON_KEYS.map((key) => (
				<Skeleton key={key} className="h-11 w-full rounded-xl" />
			))}
		</div>
	);
}

/** The empty body of a table card: an icon circle and one line. The card is the frame. */
export function PortalTableEmpty({
	icon: EmptyIcon,
	title,
}: {
	/** Phosphor icon of the table, drawn in duotone. */
	icon: Icon;
	/** Translated empty text, for example "No payouts yet". */
	title: string;
}) {
	return (
		<div className="flex min-h-56 flex-col items-center justify-center px-6 py-12 text-center">
			<span
				aria-hidden
				className="grid size-12 place-items-center rounded-full bg-night/[0.05] text-night/70 dark:bg-white/10 dark:text-foreground/70"
			>
				<EmptyIcon weight="duotone" className="size-5" />
			</span>
			<p className="mt-4 font-bold font-grotesk text-lg text-night tracking-[-0.02em] dark:text-foreground">
				{title}
			</p>
		</div>
	);
}

/** The error body of a table card and of the page load error, with a retry pill. The retry icon spins while the query refetches. */
export function PortalTableError({
	onRetry,
	retrying,
}: {
	onRetry: () => void;
	/** True while the query refetches. It locks the button, so a second click does not stack requests. */
	retrying: boolean;
}) {
	const { t } = useTranslation();

	return (
		<div
			role="alert"
			className="flex min-h-56 flex-col items-center justify-center bg-destructive/[0.035] px-6 py-12 text-center"
		>
			<span
				aria-hidden
				className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive"
			>
				<WarningIcon weight="duotone" className="size-5" />
			</span>
			<p className="mt-4 font-grotesk font-semibold text-night text-sm dark:text-foreground">
				{t("affiliates.loadError")}
			</p>
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="mt-4 rounded-full font-grotesk"
				disabled={retrying}
				onClick={onRetry}
			>
				<PortalRetryIcon spinning={retrying} />
				{t("affiliates.retry")}
			</Button>
		</div>
	);
}

/** The arrow of every retry and refresh button of the portal. It spins while the query refetches. */
export function PortalRetryIcon({ spinning }: { spinning: boolean }) {
	return (
		<ArrowClockwiseIcon
			aria-hidden
			weight="bold"
			className={cn(
				"size-4",
				spinning && "animate-spin motion-reduce:animate-none",
			)}
		/>
	);
}
