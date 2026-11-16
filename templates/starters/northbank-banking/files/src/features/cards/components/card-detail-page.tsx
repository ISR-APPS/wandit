// The detail page of one card: the running spend against the period before, every payment of the card,
// the card face with its facts, the month limit, and the top merchants.
// The /app/cards/$cardId route renders it after its loader. An unknown id shows a not-found block.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import { fillMessage } from "~/features/bank";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { cardDetailQueryOptions } from "../api/cards.queries";
import { CardFactsCard } from "./card-facts-card";
import { CardLimitCard } from "./card-limit-card";
import { CardPaymentsCard } from "./card-payments-card";
import { CardSpendTrend } from "./card-spend-trend";
import { CardStatusBadge } from "./card-status-badge";
import { TopMerchantsCard } from "./top-merchants-card";

type CardDetailPageProps = {
	/** The `$cardId` param of the URL. An unknown id shows the not-found block. */
	cardId: string;
};

/**
 * From the 4xl container width: the chart in 2/3 beside the card in 1/3.
 * The limit and the merchants share the next row. The long payments table takes the full width last.
 */
export function CardDetailPage({ cardId }: CardDetailPageProps) {
	const { t } = useT();
	const { data: detail } = useSuspenseQuery(cardDetailQueryOptions(cardId));

	const backLink = (
		<Button
			asChild
			variant="ghost"
			size="sm"
			className="-ms-3 justify-self-start max-md:h-11"
		>
			<Link to="/app/cards">
				<CaretLeftIcon className="rtl:rotate-180" />
				{t("cards.title")}
			</Link>
		</Button>
	);
	if (!detail) {
		return (
			<div className="grid gap-4">
				{backLink}
				<p className="text-muted-foreground text-sm">{t("cards.notFound")}</p>
			</div>
		);
	}
	const { card } = detail.summary;

	return (
		<div className="grid gap-6">
			{backLink}
			<PageHeader
				title={
					card.kind === "virtual" ? t("cards.roles.software") : card.holderName
				}
				description={
					<span className="flex flex-wrap items-center gap-2">
						<CardStatusBadge status={detail.summary.status} />
						<span>
							{fillMessage(t(`cards.kindLine.${card.kind}`), {
								ending: card.numberEnding,
							})}
						</span>
					</span>
				}
			/>
			<div className="grid @4xl/main:grid-cols-3 gap-6">
				{/* A grid wrapper stretches its card, so the chart and the card face end on one line. */}
				<div className="@4xl/main:col-span-2 grid min-w-0">
					<CardSpendTrend cardId={card.id} />
				</div>
				<div className="grid min-w-0">
					<CardFactsCard detail={detail} />
				</div>
				{/* From 42rem the limit and the merchants sit side by side, with one height, above the long table. */}
				<div className="@4xl/main:col-span-3 grid min-w-0 @2xl/main:grid-cols-2 gap-6">
					<CardLimitCard detail={detail} />
					<TopMerchantsCard detail={detail} />
				</div>
				<div className="@4xl/main:col-span-3 min-w-0">
					<CardPaymentsCard detail={detail} />
				</div>
			</div>
		</div>
	);
}

/** Placeholder while the card loader runs. The route sets it as pendingComponent. */
export function CardDetailPageSkeleton() {
	return (
		<div className="grid gap-6">
			<Skeleton className="h-8 w-28" />
			<div className="grid gap-2">
				<Skeleton className="h-8 w-56" />
				<Skeleton className="h-5 w-64 max-w-full" />
			</div>
			<div className="grid @4xl/main:grid-cols-3 items-start gap-6">
				<Skeleton className="@4xl/main:col-span-2 h-96" />
				<Skeleton className="h-96" />
			</div>
		</div>
	);
}
