// The side panel of one budget: the spend against the limit and every expense of the category in the month.
// BudgetsPage opens it after a click on a budget row. Each expense opens its detail page.
// BudgetsPage keeps the last line after a close, so the exit animation shows the same content.
import { Link } from "@tanstack/react-router";
import {
	dayFormat,
	dayToDate,
	MoneyText,
	monthFormat,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { ArrowRightIcon } from "~/shared/ui/icons";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "~/shared/ui/sheet";
import type { BudgetLine } from "../lib/budget-report";
import { BUDGET_STATUS_BADGE } from "../lib/budget-status";
import { BudgetBar } from "./budget-bar";

type BudgetLineSheetProps = {
	/** True while `?category=` names a budget. */
	open: boolean;
	/** The budget to show. It stays set while the panel slides out, so the panel never shows empty. */
	line: BudgetLine | null;
	/** The first day of the month of the report, as `YYYY-MM-DD`. */
	monthStart: string;
	/** The share of the month that passed, from 0 to 1. null for a closed month. */
	monthShare: number | null;
	/** Runs when the user closes the panel. */
	onClose: () => void;
};

/** The list holds the same expenses that the row counts, so its sum equals the spend of the row. */
export function BudgetLineSheet({
	open,
	line,
	monthStart,
	monthShare,
	onClose,
}: BudgetLineSheetProps) {
	const { t, locale } = useT();
	const day = dayFormat(locale);
	const leftCents = line ? line.limitCents - line.spentCents : 0;

	return (
		<Sheet
			open={open}
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
		>
			<SheetContent className="w-full gap-0 sm:max-w-md">
				{line ? (
					<>
						<SheetHeader className="gap-2 border-b p-6">
							<SheetTitle className="font-display text-lg">
								{t(`categories.${line.categoryId}`)}
							</SheetTitle>
							<SheetDescription className="flex flex-wrap items-center gap-2">
								<Badge variant={BUDGET_STATUS_BADGE[line.status]}>
									{t(`budgets.statuses.${line.status}`)}
								</Badge>
								<span>{monthFormat(locale).format(dayToDate(monthStart))}</span>
								<span aria-hidden="true">·</span>
								<span>{t(`budgets.rhythms.${line.rhythm}`)}</span>
							</SheetDescription>
						</SheetHeader>
						<div className="grid flex-1 content-start gap-6 overflow-y-auto p-6">
							<div className="grid gap-3">
								<p className="flex flex-wrap items-baseline gap-x-2">
									<MoneyText
										amountCents={line.spentCents}
										className="font-medium text-3xl"
									/>
									<span className="text-muted-foreground text-sm">
										{t("budgets.of")}{" "}
										<MoneyText
											amountCents={line.limitCents}
											withCents={false}
										/>
									</span>
								</p>
								<BudgetBar
									spentCents={line.spentCents}
									limitCents={line.limitCents}
									status={line.status}
									monthShare={monthShare}
								/>
								<p className="text-muted-foreground text-sm">
									<MoneyText amountCents={Math.abs(leftCents)} />{" "}
									{t(leftCents >= 0 ? "budgets.left" : "budgets.over")}
								</p>
							</div>
							<div className="grid gap-2">
								<h3 className="label-text font-sans text-muted-foreground text-sm">
									{t("budgets.sheetEntries")}
								</h3>
								{line.transactions.length === 0 ? (
									<p className="text-muted-foreground text-sm">
										{t("budgets.sheetEmpty")}
									</p>
								) : (
									<ul className="grid">
										{line.transactions.map((row) => (
											// The whole row is the link, so its touch area is 44 px high or more.
											<li key={row.id} className="border-t first:border-t-0">
												<Link
													to="/app/transactions/$transactionId"
													params={{ transactionId: row.id }}
													className="group flex min-h-11 items-center justify-between gap-4 py-3"
												>
													<span className="grid min-w-0 gap-0.5">
														<span
															className="truncate font-medium text-sm group-hover:underline"
															dir="auto"
														>
															{row.payee}
														</span>
														<span className="truncate text-muted-foreground text-xs">
															<span className="tabular-nums">
																{day.format(dayToDate(row.day))}
															</span>
															{" · "}
															<bdi>{row.memo}</bdi>
														</span>
													</span>
													<MoneyText
														amountCents={-row.amountCents}
														className="text-sm"
													/>
												</Link>
											</li>
										))}
									</ul>
								)}
							</div>
						</div>
						<SheetFooter className="border-t p-6">
							<Button asChild variant="outline" className="max-md:h-11">
								<Link
									to="/app/transactions"
									search={{ type: "expense", category: line.categoryId }}
								>
									{t("budgets.openInTransactions")}
									<ArrowRightIcon className="rtl:rotate-180" />
								</Link>
							</Button>
						</SheetFooter>
					</>
				) : null}
			</SheetContent>
		</Sheet>
	);
}
