// The page of one monthly statement, in the kit profile anatomy: the statement card, a "money out of money in" bar,
// and its categories in the start column; the key moments, the newest lines, and the other months in the end column.
// The /app/statements/$statementId route renders it after its loader. It reads the statement detail and the list.
import {
	ArrowDownLeftIcon,
	ArrowLeftIcon,
	ArrowUpRightIcon,
	BankIcon,
	CalendarBlankIcon,
	DownloadSimpleIcon,
	FlagCheckeredIcon,
	FlagIcon,
	ScalesIcon,
	WalletIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import {
	accountOf,
	centsToUnits,
	countLabel,
	DetailProfileCard,
	DetailProgressCard,
	DetailTagsCard,
	DetailTimelineCard,
	dayFormat,
	daysBetween,
	dayToDate,
	downloadCsv,
	EntryHistoryCard,
	fillMessage,
	moneyFormat,
	monthEndOf,
	monthFormat,
	RelatedListCard,
	type TimelineEvent,
	type TransactionCategory,
	toCsv,
	todayIsoDay,
} from "~/features/bank";
import { transactionCsvColumns } from "~/features/transactions";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import {
	statementDetailQueryOptions,
	statementsQueryOptions,
} from "../api/statements.queries";
import type { StatementLine } from "../lib/statements";
import { StatementStatusBadge } from "./statement-status-badge";

// The line table shows the newest lines, as the history table of the kit profile page.
const TABLE_LINES = 6;

// The tag card lists the categories with the most lines, so it keeps the height of a kit tag card.
const TOP_CATEGORIES = 6;

// The month list shows this many neighbor months, so it keeps the height of the line table beside it.
const OTHER_MONTHS = 5;

type StatementDetailPageProps = {
	/** The id of the URL, `<account>-<YYYY-MM>`. An unknown id shows the not-found state. */
	statementId: string;
};

// The line with the largest amount in one direction: "in" for the largest credit, "out" for the largest debit.
function largestLine(
	lines: StatementLine[],
	direction: "in" | "out",
): StatementLine | undefined {
	const sign = direction === "in" ? 1 : -1;
	return lines
		.filter((line) => line.amountCents * sign > 0)
		.reduce<StatementLine | undefined>(
			(best, line) =>
				!best || line.amountCents * sign > best.amountCents * sign
					? line
					: best,
			undefined,
		);
}

/** Three columns from the @4xl width: the start column is 1/3, the end column 2/3. */
export function StatementDetailPage({ statementId }: StatementDetailPageProps) {
	const { t, locale } = useT();
	const { data: detail } = useSuspenseQuery(
		statementDetailQueryOptions(statementId),
	);
	const { data: statements } = useSuspenseQuery(statementsQueryOptions());
	const money = moneyFormat(locale, 0);
	// One entry shows its cents, as the table beside it does.
	const exactMoney = moneyFormat(locale, 2);
	const month = monthFormat(locale);
	// The avatar of a month shows its short name, for example "Oct".
	const shortMonth = new Intl.DateTimeFormat(locale, {
		month: "short",
		timeZone: "UTC",
	});
	const longDay = dayFormat(locale, "long");
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const backLink = (
		<Button variant="ghost" size="sm" className="-ms-3 w-fit" asChild>
			<Link to="/app/statements">
				<ArrowLeftIcon className="rtl:rotate-180" />
				{t("statements.title")}
			</Link>
		</Button>
	);
	if (!detail) {
		return (
			<div className="grid gap-4">
				{backLink}
				<Card>
					<CardContent>
						<p role="alert">{t("statements.notFound")}</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	const { statement, lines } = detail;
	const account = accountOf(statement.accountId);
	const accountLabel = t(`accounts.${statement.accountId}`);
	const accountName = `${accountLabel} ••${account.numberEnding}`;
	const monthLabel = month.format(dayToDate(statement.month));
	const isOpen = statement.status === "open";
	const today = todayIsoDay();
	const daysLeft = daysBetween(today, monthEndOf(today));
	const outShare =
		statement.moneyInCents === 0
			? 0
			: statement.moneyOutCents / statement.moneyInCents;
	const lineCounts = new Map<TransactionCategory, number>();
	for (const line of lines) {
		lineCounts.set(line.category, (lineCounts.get(line.category) ?? 0) + 1);
	}
	const topCategories = [...lineCounts.keys()]
		.sort(
			(first, second) =>
				(lineCounts.get(second) ?? 0) - (lineCounts.get(first) ?? 0),
		)
		.slice(0, TOP_CATEGORIES);
	const largestIn = largestLine(lines, "in");
	const largestOut = largestLine(lines, "out");
	// The months of the account, newest first. The list shows the months around this one, without it.
	const accountMonths = statements.filter(
		(item) => item.accountId === statement.accountId,
	);
	const position = accountMonths.findIndex((item) => item.id === statement.id);
	const windowStart = Math.max(
		0,
		Math.min(
			position - Math.floor(OTHER_MONTHS / 2),
			accountMonths.length - OTHER_MONTHS - 1,
		),
	);
	const others = accountMonths
		.slice(windowStart, windowStart + OTHER_MONTHS + 1)
		.filter((item) => item.id !== statement.id);

	const openLink = (line: StatementLine) => (
		<Button variant="outline" size="sm" asChild>
			<Link
				to="/app/transactions/$transactionId"
				params={{ transactionId: line.id }}
			>
				{t("entries.openShort")}
			</Link>
		</Button>
	);
	const lineEvent = (
		line: StatementLine,
		titleKey: "statements.largestIn" | "statements.largestOut",
	): TimelineEvent => ({
		id: line.id,
		icon:
			titleKey === "statements.largestIn"
				? ArrowDownLeftIcon
				: ArrowUpRightIcon,
		title: t(titleKey),
		day: line.day,
		dayLabel: longDay.format(dayToDate(line.day)),
		text: fillMessage(t("statements.lineText"), {
			amount: exactMoney.format(centsToUnits(Math.abs(line.amountCents))),
			party: line.counterparty,
		}),
		action: openLink(line),
	});
	// The newest moment comes first, as the newest event of the kit timeline.
	const events: TimelineEvent[] = [
		{
			id: "closing",
			icon: FlagCheckeredIcon,
			title: t(isOpen ? "statements.balance" : "statements.closing"),
			badge: (
				<StatementStatusBadge status={statement.status} daysLeft={daysLeft} />
			),
			day: statement.endDay,
			dayLabel: longDay.format(dayToDate(statement.endDay)),
			text: money.format(centsToUnits(statement.closingCents)),
		},
		...[
			largestIn ? lineEvent(largestIn, "statements.largestIn") : null,
			largestOut ? lineEvent(largestOut, "statements.largestOut") : null,
		]
			.filter((event) => event !== null)
			.sort((first, second) => second.day.localeCompare(first.day)),
		{
			id: "opening",
			icon: FlagIcon,
			title: t("statements.opening"),
			day: statement.month,
			dayLabel: longDay.format(dayToDate(statement.month)),
			text: money.format(centsToUnits(statement.openingCents)),
		},
	];

	return (
		<div className="grid gap-4">
			<div className="grid gap-2">
				{backLink}
				<PageHeader
					title={fillMessage(t("statements.detailTitle"), {
						month: monthLabel,
					})}
					description={accountName}
					actions={
						<Button
							type="button"
							onClick={() =>
								downloadCsv(
									`northbank-${statement.id}.csv`,
									toCsv(lines, transactionCsvColumns(t)),
								)
							}
						>
							<DownloadSimpleIcon />
							{t("common.exportCsv")}
						</Button>
					}
				/>
			</div>
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<div className="grid content-start gap-4">
					<DetailProfileCard
						initials={shortMonth.format(dayToDate(statement.month))}
						name={accountName}
						badge={
							<StatementStatusBadge
								status={statement.status}
								daysLeft={daysLeft}
							/>
						}
						subtitle={monthLabel}
						stats={[
							{
								label: t("statements.moneyIn"),
								value: money.format(centsToUnits(statement.moneyInCents)),
							},
							{
								label: t("statements.moneyOut"),
								value: money.format(centsToUnits(statement.moneyOutCents)),
							},
							{
								label: t("statements.lines"),
								value: new Intl.NumberFormat(locale).format(
									statement.lineCount,
								),
							},
						]}
						facts={[
							{
								id: "period",
								icon: CalendarBlankIcon,
								label: t("statements.period"),
								content: `${longDay.format(dayToDate(statement.month))} – ${longDay.format(dayToDate(statement.endDay))}`,
							},
							{
								id: "opening",
								icon: WalletIcon,
								label: t("statements.opening"),
								content: fillMessage(t("statements.openingLine"), {
									amount: money.format(centsToUnits(statement.openingCents)),
								}),
							},
							{
								id: "closing",
								icon: ScalesIcon,
								label: t(isOpen ? "statements.balance" : "statements.closing"),
								content: fillMessage(
									t(
										isOpen
											? "statements.balanceLine"
											: "statements.closingLine",
									),
									{
										amount: money.format(centsToUnits(statement.closingCents)),
									},
								),
							},
							{
								id: "account",
								icon: BankIcon,
								label: t("entries.account"),
								content: fillMessage(t("statements.accountLine"), {
									type: t(`accounts.types.${account.type}`),
								}),
							},
						]}
					/>
					<DetailProgressCard
						title={t("statements.outOfIn")}
						description={fillMessage(t("statements.outOfInDescription"), {
							out: money.format(centsToUnits(statement.moneyOutCents)),
							in: money.format(centsToUnits(statement.moneyInCents)),
						})}
						percent={outShare * 100}
						valueLabel={percent.format(outShare)}
					/>
					<DetailTagsCard
						title={t("statements.categoriesTitle")}
						tags={topCategories.map((category) => ({
							id: category,
							label: t(`categories.${category}`),
						}))}
					/>
				</div>
				<div className="@4xl/main:col-span-2 grid content-start gap-4">
					<DetailTimelineCard
						title={t("statements.momentsTitle")}
						events={events}
						emptyText={t("statements.noLines")}
					/>
					<div className="grid @2xl/main:grid-cols-2 gap-4">
						<EntryHistoryCard
							title={t("statements.linesTitle")}
							description={fillMessage(t("statements.linesDescription"), {
								shown: String(Math.min(TABLE_LINES, lines.length)),
								count: countLabel(
									lines.length,
									t("statements.lineOne"),
									t("statements.lineOther"),
									locale,
								),
							})}
							// The lines are oldest first. The table shows the newest ones on top.
							rows={lines.slice(-TABLE_LINES).reverse()}
							labelOf={(line) => line.counterparty}
							emptyText={t("statements.noLines")}
						/>
						<RelatedListCard
							title={t("statements.otherTitle")}
							description={accountName}
							items={others.map((item) => ({
								id: item.id,
								initials: shortMonth.format(dayToDate(item.month)),
								name: month.format(dayToDate(item.month)),
								detail: `${t(`statements.statuses.${item.status}`)} · ${money.format(centsToUnits(item.closingCents))}`,
								action: (
									<Button variant="outline" size="sm" asChild>
										<Link
											to="/app/statements/$statementId"
											params={{ statementId: item.id }}
										>
											{t("entries.openShort")}
										</Link>
									</Button>
								),
							}))}
							emptyText={t("statements.noOthers")}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
