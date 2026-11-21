// The page of one entry, in the kit profile anatomy: a profile card, a settlement bar, and labels in the start column;
// the status timeline, the history with the same party, and the other entries of the same day in the end column.
// The /app/transactions/$transactionId route renders it after its loader. It reads only the detail query.
import {
	AddressBookIcon,
	ArrowLeftIcon,
	BankIcon,
	CalendarBlankIcon,
	CheckCircleIcon,
	CreditCardIcon,
	HashIcon,
	HourglassIcon,
	NoteIcon,
	XCircleIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import {
	accountOf,
	addMonths,
	countLabel,
	DetailProfileCard,
	DetailProgressCard,
	DetailTagsCard,
	DetailTimelineCard,
	dayFormat,
	dayToDate,
	directionOf,
	EntryHistoryCard,
	fillMessage,
	findCard,
	findPayee,
	initialsOf,
	MoneyText,
	monthStartOf,
	RelatedListCard,
	STATEMENT_MONTHS,
	type TimelineEvent,
	TransactionStatusBadge,
	todayIsoDay,
} from "~/features/bank";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import { transactionDetailQueryOptions } from "../api/transactions.queries";
import type { StatusStep } from "../lib/transaction-detail";

// The icon of each step state: a check, an hourglass, or a cross.
const STEP_ICONS = {
	done: CheckCircleIcon,
	upcoming: HourglassIcon,
	failed: XCircleIcon,
} satisfies Record<StatusStep["state"], KitIcon>;

type TransactionDetailPageProps = {
	/** The id of the URL. It can be any text; an unknown id shows the not-found state. */
	transactionId: string;
};

/** Three columns from the @4xl width: the start column is 1/3, the end column 2/3. */
export function TransactionDetailPage({
	transactionId,
}: TransactionDetailPageProps) {
	const { t, locale } = useT();
	const { data: detail } = useSuspenseQuery(
		transactionDetailQueryOptions(transactionId),
	);
	const longDay = dayFormat(locale, "long");
	const backLink = (
		<Button variant="ghost" size="sm" className="-ms-3 w-fit" asChild>
			<Link to="/app/transactions">
				<ArrowLeftIcon className="rtl:rotate-180" />
				{t("transactions.title")}
			</Link>
		</Button>
	);
	if (!detail) {
		return (
			<div className="grid gap-4">
				{backLink}
				<Card>
					<CardContent>
						<p role="alert">{t("transactionDetail.notFound")}</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	const { transaction, linked, history, historyCount, sameDay, steps } = detail;
	const account = accountOf(transaction.accountId);
	const accountName = `${t(`accounts.${transaction.accountId}`)} ••${account.numberEnding}`;
	const card = transaction.cardId ? findCard(transaction.cardId) : undefined;
	const payee = transaction.payeeId
		? findPayee(transaction.payeeId)
		: undefined;
	const direction = directionOf(transaction);
	const doneCount = steps.filter((step) => step.state === "done").length;
	const lastStep = steps.at(-1);
	const month = monthStartOf(transaction.day);
	// An entry older than the oldest statement has no statement page.
	const hasStatement =
		month >= addMonths(todayIsoDay(), -(STATEMENT_MONTHS - 1));

	// The newest step comes first, as the newest event of the kit timeline.
	const events: TimelineEvent[] = [...steps].reverse().map((step, index) => ({
		id: step.id,
		icon: STEP_ICONS[step.state],
		title: t(`transactionDetail.steps.${step.id}`),
		badge:
			index === 0 ? (
				<Badge variant={step.state === "upcoming" ? "info" : "outline"}>
					{t(
						step.state === "upcoming"
							? "transactionDetail.expected"
							: "transactionDetail.latest",
					)}
				</Badge>
			) : undefined,
		day: step.day,
		dayLabel: longDay.format(dayToDate(step.day)),
		text: fillMessage(t(`transactionDetail.stepText.${step.id}`), {
			account: accountName,
			method: t(`methods.${transaction.method}`),
		}),
		action:
			index === 0 && linked ? (
				<Button variant="outline" size="sm" asChild>
					<Link
						to="/app/transactions/$transactionId"
						params={{ transactionId: linked.id }}
					>
						{t("transactionDetail.openOtherSide")}
					</Link>
				</Button>
			) : undefined,
	}));

	return (
		<div className="grid gap-4">
			<div className="grid gap-2">
				{backLink}
				<PageHeader
					title={transaction.counterparty}
					description={`${transaction.memo} · ${accountName}`}
					actions={
						hasStatement ? (
							<Button asChild>
								<Link
									to="/app/statements/$statementId"
									params={{
										statementId: `${transaction.accountId}-${month.slice(0, 7)}`,
									}}
								>
									{t("transactionDetail.openStatement")}
								</Link>
							</Button>
						) : null
					}
				/>
			</div>
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<div className="grid content-start gap-4">
					<DetailProfileCard
						initials={initialsOf(transaction.counterparty)}
						name={transaction.counterparty}
						badge={<TransactionStatusBadge status={transaction.status} />}
						subtitle={t(`categories.${transaction.category}`)}
						stats={[
							{
								label: t("entries.amount"),
								value: (
									<MoneyText
										amountCents={transaction.amountCents}
										withCents={false}
										isSigned
										// A transfer keeps its sign but stays neutral: the money stays inside the business.
										className={
											direction === "transfer" ? "text-foreground" : undefined
										}
									/>
								),
							},
							{
								label: t("entries.method"),
								value: t(`methods.${transaction.method}`),
							},
							{
								label: t("entries.account"),
								value: t(`accounts.${transaction.accountId}`),
							},
						]}
						facts={[
							{
								id: "day",
								icon: CalendarBlankIcon,
								label: t("entries.date"),
								content: fillMessage(t("transactionDetail.bookedOn"), {
									day: longDay.format(dayToDate(transaction.day)),
								}),
							},
							{
								id: "account",
								icon: BankIcon,
								label: t("entries.account"),
								content: accountName,
							},
							{
								id: "reference",
								icon: HashIcon,
								label: t("entries.reference"),
								content: fillMessage(t("transactionDetail.traceLine"), {
									reference: transaction.reference,
								}),
							},
							{
								id: "memo",
								icon: NoteIcon,
								label: t("entries.memo"),
								content: <span dir="auto">{transaction.memo}</span>,
							},
							...(card
								? [
										{
											id: "card",
											icon: CreditCardIcon,
											label: t("transactionDetail.card"),
											content: (
												<Link
													to="/app/cards/$cardId"
													params={{ cardId: card.id }}
													className="hover:text-primary hover:underline"
												>
													{`${card.holderName} ••${card.numberEnding}`}
												</Link>
											),
										},
									]
								: []),
							...(payee
								? [
										{
											id: "payee",
											icon: AddressBookIcon,
											label: t("transactionDetail.payee"),
											content: (
												<Link
													to="/app/payees/$payeeId"
													params={{ payeeId: payee.id }}
													className="hover:text-primary hover:underline"
												>
													{payee.name}
												</Link>
											),
										},
									]
								: []),
						]}
					/>
					<DetailProgressCard
						title={t("transactionDetail.settlement")}
						description={
							lastStep
								? fillMessage(
										t(
											lastStep.state === "upcoming"
												? "transactionDetail.settlementExpected"
												: "transactionDetail.settlementDone",
										),
										{ day: longDay.format(dayToDate(lastStep.day)) },
									)
								: ""
						}
						percent={(doneCount / steps.length) * 100}
						valueLabel={fillMessage(
							countLabel(
								steps.length,
								t("transactionDetail.stepsDoneOne"),
								t("transactionDetail.stepsDoneOther"),
								locale,
							),
							{ done: String(doneCount) },
						)}
					/>
					<DetailTagsCard
						title={t("transactionDetail.labels")}
						tags={[
							{ id: "direction", label: t(`directions.${direction}`) },
							{ id: "method", label: t(`methods.${transaction.method}`) },
							{
								id: "category",
								label: t(`categories.${transaction.category}`),
							},
							{
								id: "account",
								label: t(`accounts.types.${account.type}`),
							},
						]}
					/>
				</div>
				<div className="@4xl/main:col-span-2 grid content-start gap-4">
					<DetailTimelineCard
						title={t("transactionDetail.statusTitle")}
						events={events}
						emptyText={t("transactionDetail.noSteps")}
					/>
					<div className="grid @2xl/main:grid-cols-2 gap-4">
						<EntryHistoryCard
							title={t("transactionDetail.history")}
							description={fillMessage(
								t(
									historyCount > history.length
										? "transactionDetail.historyNewest"
										: "transactionDetail.historyAll",
								),
								{
									shown: String(history.length),
									count: String(historyCount),
								},
							)}
							rows={history}
							labelOf={(row) => row.memo}
							emptyText={t("transactionDetail.noHistory")}
						/>
						<RelatedListCard
							title={t("transactionDetail.sameDay")}
							description={longDay.format(dayToDate(transaction.day))}
							items={sameDay.map((row) => ({
								id: row.id,
								initials: initialsOf(row.counterparty),
								name: row.counterparty,
								detail: (
									<>
										<MoneyText amountCents={row.amountCents} isSigned />
										{` · ${t(`categories.${row.category}`)}`}
									</>
								),
								action: (
									<Button variant="outline" size="sm" asChild>
										<Link
											to="/app/transactions/$transactionId"
											params={{ transactionId: row.id }}
										>
											{t("entries.openShort")}
										</Link>
									</Button>
								),
							}))}
							emptyText={t("transactionDetail.noSameDay")}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
