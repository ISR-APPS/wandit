// The status card of the transaction page, in the kit activity timeline form: one step per status of the entry,
// on a vertical rule with an icon dot. TransactionDetailPage renders it at the top of the wide column.
// The newest step that happened gets a "Latest" badge. The first step holds the export of the entry.
import {
	BankIcon,
	CheckCircleIcon,
	ClockIcon,
	DownloadSimpleIcon,
	NotePencilIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	dayFormat,
	dayToDate,
	downloadCsv,
	fillMessage,
	type TransactionStatus,
	toCsv,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import type { TransactionRow } from "../api/transactions.queries";
import { transactionCsvColumns } from "../lib/transaction-csv";
import type { TimelineStep } from "../lib/transaction-detail";

// The icon of each step: the note of the bookkeeper, the bank, and the check against the statement.
const STEP_ICONS = {
	pending: NotePencilIcon,
	cleared: BankIcon,
	reconciled: CheckCircleIcon,
} satisfies Record<TransactionStatus, KitIcon>;

type StatusHistoryCardProps = {
	transaction: TransactionRow;
	/** The three steps, in the order of the work. A step that did not happen has no day. */
	timeline: TimelineStep[];
};

/** A step with no day says what it waits for. */
export function StatusHistoryCard({
	transaction,
	timeline,
}: StatusHistoryCardProps) {
	const { t, locale } = useT();
	const longDay = dayFormat(locale, "long");
	// The steps are in time order, so the last done step is the first one from the end.
	const latestDone = [...timeline].reverse().find((step) => step.day !== null);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("transactions.statusTitle")}</CardTitle>
				<CardAction>
					<Link
						to="/app/accounts/$accountId"
						params={{ accountId: transaction.accountId }}
						className="text-muted-foreground text-sm hover:text-foreground hover:underline"
					>
						{t("transactions.openAccount")}
					</Link>
				</CardAction>
			</CardHeader>
			<CardContent className="ps-8">
				<ol className="relative grid gap-10 border-s">
					{timeline.map((step, index) => {
						const Icon = STEP_ICONS[step.status];
						return (
							<li key={step.status} className="grid gap-2 ps-6">
								<span
									aria-hidden="true"
									className="absolute -start-3 flex size-6 items-center justify-center rounded-full border bg-muted"
								>
									<Icon className="size-3 text-primary" />
								</span>
								<h3 className="flex flex-wrap items-center gap-2 font-semibold">
									{t(`transactions.steps.${step.status}`)}
									{step === latestDone ? (
										<Badge variant="outline">
											{t("transactions.latestStep")}
										</Badge>
									) : null}
								</h3>
								<p className="flex items-center gap-1.5 text-muted-foreground text-sm leading-none">
									<ClockIcon aria-hidden="true" className="size-3" />
									{step.day === null
										? t(
												step.status === "cleared"
													? "transactions.waitingCleared"
													: "transactions.waitingReconciled",
											)
										: fillMessage(t("transactions.onDay"), {
												day: longDay.format(dayToDate(step.day)),
											})}
								</p>
								{/* The text says what happened, so a step that waits shows only its date line. */}
								{step.day === null ? null : (
									<p className="text-muted-foreground text-sm">
										{t(`transactions.stepText.${step.status}`)}
									</p>
								)}
								{index === 0 ? (
									<Button
										type="button"
										variant="outline"
										className="justify-self-start"
										onClick={() =>
											downloadCsv(
												`entry-${transaction.id}.csv`,
												toCsv([transaction], transactionCsvColumns(t)),
											)
										}
									>
										<DownloadSimpleIcon />
										{t("transactions.exportEntry")}
									</Button>
								) : null}
							</li>
						);
					})}
				</ol>
			</CardContent>
		</Card>
	);
}
