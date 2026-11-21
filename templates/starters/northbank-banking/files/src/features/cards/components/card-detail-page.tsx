// The page of one card, in the kit profile anatomy: the holder card, the monthly limit bar, and the spend groups
// in the start column; the latest payments, the payment table, and the other cards in the end column.
// The /app/cards/$cardId route renders it after its loader. It reads the card detail and the card list.
import {
	ArrowLeftIcon,
	BankIcon,
	CalendarBlankIcon,
	CalendarCheckIcon,
	ClockCounterClockwiseIcon,
	CopyIcon,
	CreditCardIcon,
	ReceiptIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import {
	accountOf,
	addMonths,
	centsToUnits,
	copyToClipboard,
	countLabel,
	DetailProfileCard,
	DetailProgressCard,
	DetailTagsCard,
	DetailTimelineCard,
	dayFormat,
	dayToDate,
	EntryHistoryCard,
	fillMessage,
	initialsOf,
	moneyFormat,
	monthStartOf,
	RelatedListCard,
	todayIsoDay,
} from "~/features/bank";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import {
	cardDetailQueryOptions,
	cardsQueryOptions,
} from "../api/cards.queries";
import { CardStatusBadge } from "./card-status-badge";

// The timeline shows the newest payments, as the 3 events of the kit activity card.
const TIMELINE_PAYMENTS = 3;

// The payment table shows this many rows, as the history table of the kit profile page.
const TABLE_PAYMENTS = 6;

type CardDetailPageProps = {
	/** The id of the URL. It can be any text; an unknown id shows the not-found state. */
	cardId: string;
};

/** Three columns from the @4xl width: the start column is 1/3, the end column 2/3. */
export function CardDetailPage({ cardId }: CardDetailPageProps) {
	const { t, locale } = useT();
	const { data: detail } = useSuspenseQuery(cardDetailQueryOptions(cardId));
	const { data: summaries } = useSuspenseQuery(cardsQueryOptions());
	const money = moneyFormat(locale, 0);
	// One entry shows its cents, as the table beside it does.
	const exactMoney = moneyFormat(locale, 2);
	const longDay = dayFormat(locale, "long");
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const backLink = (
		<Button variant="ghost" size="sm" className="-ms-3 w-fit" asChild>
			<Link to="/app/cards">
				<ArrowLeftIcon className="rtl:rotate-180" />
				{t("cards.title")}
			</Link>
		</Button>
	);
	if (!detail) {
		return (
			<div className="grid gap-4">
				{backLink}
				<Card>
					<CardContent>
						<p role="alert">{t("cards.notFound")}</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	const { summary, transactions, topMerchants } = detail;
	const { card } = summary;
	const today = todayIsoDay();
	const monthStart = monthStartOf(today);
	const monthPayments = transactions.filter(
		(row) => row.day >= monthStart && row.status !== "returned",
	).length;
	const share = summary.monthSpendCents / card.monthlyLimitCents;
	const operating = accountOf("operating");
	const cardName = `${card.holderName} ••${card.numberEnding}`;
	const others = summaries.filter((item) => item.card.id !== card.id);

	return (
		<div className="grid gap-4">
			<div className="grid gap-2">
				{backLink}
				<PageHeader
					title={cardName}
					description={fillMessage(t(`cards.kindLine.${card.kind}`), {
						ending: card.numberEnding,
					})}
					actions={
						<Button
							type="button"
							onClick={() =>
								copyToClipboard(card.numberEnding, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							<CopyIcon />
							{t("cards.copyEnding")}
						</Button>
					}
				/>
			</div>
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<div className="grid content-start gap-4">
					<DetailProfileCard
						initials={initialsOf(card.holderName)}
						name={card.holderName}
						badge={<CardStatusBadge status={summary.status} />}
						subtitle={t(`cards.roles.${card.role}`)}
						stats={[
							{
								label: t("cards.spentShort"),
								value: money.format(centsToUnits(summary.monthSpendCents)),
							},
							{
								label: t("cards.paymentsShort"),
								value: new Intl.NumberFormat(locale).format(monthPayments),
							},
							{
								label: t("cards.limit"),
								value: money.format(centsToUnits(card.monthlyLimitCents)),
							},
						]}
						facts={[
							{
								id: "kind",
								icon: CreditCardIcon,
								label: t("cards.kind"),
								content: fillMessage(t(`cards.kindLine.${card.kind}`), {
									ending: card.numberEnding,
								}),
							},
							{
								id: "account",
								icon: BankIcon,
								label: t("entries.account"),
								content: fillMessage(t("cards.paysFrom"), {
									account: `${t("accounts.operating")} ••${operating.numberEnding}`,
								}),
							},
							{
								id: "since",
								icon: CalendarBlankIcon,
								label: t("cards.status"),
								content: fillMessage(t(`cards.statusSince.${summary.status}`), {
									day: longDay.format(dayToDate(summary.statusSince)),
								}),
							},
							{
								id: "expiry",
								icon: CalendarCheckIcon,
								label: t("cards.expires"),
								content: fillMessage(t("cards.expiresOn"), {
									expiry: summary.expiry,
								}),
							},
							{
								id: "lastUsed",
								icon: ClockCounterClockwiseIcon,
								label: t("cards.lastUsedColumn"),
								content: summary.lastUsedDay
									? fillMessage(t("cards.lastUsed"), {
											when: longDay.format(dayToDate(summary.lastUsedDay)),
										})
									: t("cards.neverUsed"),
							},
						]}
					/>
					<DetailProgressCard
						title={t("cards.limitTitle")}
						description={fillMessage(t("cards.limitDescription"), {
							spent: money.format(centsToUnits(summary.monthSpendCents)),
							limit: money.format(centsToUnits(card.monthlyLimitCents)),
							// The limit resets on the 1st of the next month.
							day: longDay.format(dayToDate(monthStartOf(addMonths(today, 1)))),
						})}
						percent={share * 100}
						valueLabel={percent.format(share)}
					/>
					<DetailTagsCard
						title={t("cards.groupsTitle")}
						tags={card.spendCategories.map((category) => ({
							id: category,
							label: t(`categories.${category}`),
						}))}
					/>
				</div>
				<div className="@4xl/main:col-span-2 grid content-start gap-4">
					<DetailTimelineCard
						title={t("cards.latestTitle")}
						headerAction={
							<Link
								to="/app/transactions"
								className="text-muted-foreground text-sm hover:text-primary hover:underline"
							>
								{t("overview.recent.viewAll")}
							</Link>
						}
						events={transactions
							.slice(0, TIMELINE_PAYMENTS)
							.map((row, index) => ({
								id: row.id,
								icon: ReceiptIcon,
								title: row.counterparty,
								badge:
									index === 0 ? (
										<Badge variant="outline">
											{t("transactionDetail.latest")}
										</Badge>
									) : undefined,
								day: row.day,
								dayLabel: longDay.format(dayToDate(row.day)),
								text: fillMessage(t("cards.paymentLine"), {
									amount: exactMoney.format(
										centsToUnits(Math.abs(row.amountCents)),
									),
									category: t(`categories.${row.category}`),
									status: t(`statuses.${row.status}`),
								}),
								action:
									index === 0 ? (
										<Button variant="outline" size="sm" asChild>
											<Link
												to="/app/transactions/$transactionId"
												params={{ transactionId: row.id }}
											>
												{t("cards.openPayment")}
											</Link>
										</Button>
									) : undefined,
							}))}
						emptyText={t("cards.noPayments")}
					/>
					<div className="grid @2xl/main:grid-cols-2 gap-4">
						<EntryHistoryCard
							title={t("cards.paymentsTitle")}
							description={
								topMerchants[0]
									? fillMessage(t("cards.topMerchant"), {
											name: topMerchants[0].name,
											count: countLabel(
												topMerchants[0].count,
												t("cards.paymentOne"),
												t("cards.paymentOther"),
												locale,
											),
										})
									: undefined
							}
							rows={transactions.slice(0, TABLE_PAYMENTS)}
							labelOf={(row) => row.counterparty}
							emptyText={t("cards.noPayments")}
						/>
						<RelatedListCard
							title={t("cards.otherTitle")}
							items={others.map((item) => ({
								id: item.card.id,
								initials: initialsOf(item.card.holderName),
								name: `${item.card.holderName} ••${item.card.numberEnding}`,
								detail: `${t(`cards.statuses.${item.status}`)} · ${money.format(centsToUnits(item.monthSpendCents))}`,
								action: (
									<Button variant="outline" size="sm" asChild>
										<Link
											to="/app/cards/$cardId"
											params={{ cardId: item.card.id }}
										>
											{t("entries.openShort")}
										</Link>
									</Button>
								),
							}))}
							emptyText={t("cards.noOthers")}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
