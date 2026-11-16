// The cards of the business: status tabs, one tile per card, the month spend against the limits with the card
// closest to its limit, and the spend by group. The /app/cards route renders it after its loader.
// The tabs count the cards, so each count equals the tiles that its tab shows.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	accountOf,
	addMonths,
	CARD_STATUSES,
	type CardStatus,
	countLabel,
	dayFormat,
	dayToDate,
	FilterTabs,
	fillMessage,
	MoneyText,
	todayIsoDay,
} from "~/features/bank";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	cardSpendBreakdownQueryOptions,
	cardsQueryOptions,
} from "../api/cards.queries";
import { CardTile } from "./card-tile";
import { SpendBreakdownCard } from "./spend-breakdown-card";

/** The page. The tab filters the tiles; the rail keeps the figures of all cards. */
export function CardsPage() {
	const { t, locale } = useT();
	const { data: summaries } = useSuspenseQuery(cardsQueryOptions());
	const { data: breakdown } = useSuspenseQuery(
		cardSpendBreakdownQueryOptions(),
	);
	const [status, setStatus] = useState<CardStatus | "all">("all");

	const tabs = [
		{ value: "all" as const, label: t("cards.all"), count: summaries.length },
		...CARD_STATUSES.map((value) => ({
			value,
			label: t(`cards.statuses.${value}`),
			count: summaries.filter((summary) => summary.status === value).length,
		})).filter((tab) => tab.count > 0),
	];
	const shown =
		status === "all"
			? summaries
			: summaries.filter((summary) => summary.status === status);
	const active = summaries.filter((summary) => summary.status === "active");
	// The limit sums the active cards only, so the spend does the same.
	const monthSpendCents = active.reduce(
		(sum, summary) => sum + summary.monthSpendCents,
		0,
	);
	const activeLimitCents = active.reduce(
		(sum, summary) => sum + summary.card.monthlyLimitCents,
		0,
	);
	// The active card with the largest share of its own limit used. undefined when no card is active.
	const closest = active.reduce<(typeof active)[number] | undefined>(
		(best, summary) =>
			!best ||
			summary.monthSpendCents / summary.card.monthlyLimitCents >
				best.monthSpendCents / best.card.monthlyLimitCents
				? summary
				: best,
		undefined,
	);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	// The limits reset on the 1st of the next month.
	const resetLine = fillMessage(t("cards.resetsOn"), {
		day: dayFormat(locale, "long").format(
			dayToDate(addMonths(todayIsoDay(), 1)),
		),
	});
	const operating = accountOf("operating");

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("cards.title")}
				description={fillMessage(t("cards.description"), {
					account: `${t("accounts.operating")} ••${operating.numberEnding}`,
				})}
			/>
			<div className="grid @4xl/main:grid-cols-3 items-start gap-6">
				<div className="@4xl/main:col-span-2 grid gap-4">
					<FilterTabs
						value={status}
						options={tabs}
						onValueChange={setStatus}
						label={t("transactions.status")}
					/>
					<div className="grid @2xl/main:grid-cols-2 gap-4">
						{shown.map((summary) => (
							<CardTile key={summary.card.id} summary={summary} />
						))}
					</div>
				</div>
				{/* Between 42rem and 56rem the two panels sit side by side above the tiles, with one height. A phone shows them after the tiles. */}
				<div className="@2xl/main:order-first @4xl/main:order-none grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-1 @4xl/main:items-start gap-6">
					<Card>
						<CardHeader>
							<CardTitle>{t("cards.monthTitle")}</CardTitle>
							<CardDescription>
								{countLabel(
									active.length,
									t("cards.activeCardsOne"),
									t("cards.activeCardsOther"),
									locale,
								)}
							</CardDescription>
						</CardHeader>
						<CardContent className="grid gap-3">
							<div className="flex flex-wrap items-baseline gap-x-2">
								<MoneyText
									amountCents={monthSpendCents}
									withCents={false}
									className="font-semibold text-3xl"
								/>
								<span className="text-muted-foreground text-sm">
									{`${t("cards.of")} `}
									<MoneyText amountCents={activeLimitCents} withCents={false} />
								</span>
							</div>
							<Progress
								value={monthSpendCents}
								max={activeLimitCents}
								aria-label={t("cards.monthTitle")}
							/>
							<p className="text-muted-foreground text-sm">{resetLine}</p>
							<dl className="grid grid-cols-2 gap-4 border-t pt-4 text-sm">
								<div className="grid gap-1">
									<dt className="text-muted-foreground">
										{t("cards.leftOnLimits")}
									</dt>
									<dd>
										<MoneyText
											amountCents={Math.max(
												activeLimitCents - monthSpendCents,
												0,
											)}
											withCents={false}
										/>
									</dd>
								</div>
								{closest ? (
									<div className="grid min-w-0 gap-1">
										<dt className="text-muted-foreground">
											{t("cards.closestToLimit")}
										</dt>
										<dd className="truncate">
											{`${closest.card.kind === "virtual" ? t("cards.roles.software") : closest.card.holderName} · ${percent.format(closest.monthSpendCents / closest.card.monthlyLimitCents)}`}
										</dd>
									</div>
								) : null}
							</dl>
						</CardContent>
					</Card>
					<SpendBreakdownCard
						slices={breakdown.map((slice) => ({
							label: t(`categories.${slice.label}`),
							value: slice.value,
						}))}
					/>
				</div>
			</div>
		</div>
	);
}

// Placeholder tiles of the skeleton. Fixed keys, because they never reorder.
const SKELETON_TILES = ["1", "2", "3", "4", "5", "6"];

/** Placeholder while the cards loader runs. The route sets it as pendingComponent. */
export function CardsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-4 w-80 max-w-full" />
			</div>
			<div className="grid @4xl/main:grid-cols-3 items-start gap-6">
				<div className="@4xl/main:col-span-2 grid @2xl/main:grid-cols-2 gap-4">
					{SKELETON_TILES.map((key) => (
						<Skeleton key={key} className="h-36" />
					))}
				</div>
				<Skeleton className="h-72" />
			</div>
		</div>
	);
}

/** Error state of the card pages when a loader fails. Try again runs the loader again. */
export function CardsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("cards.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
