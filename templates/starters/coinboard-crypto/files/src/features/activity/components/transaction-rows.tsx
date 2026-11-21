// The rows of one tab of the Activity page: the date, the line and its status, the signed amount, and an open button.
// ActivityPage renders it in the Latest and the Pending tabs. A period with more than 20 rows gets pages.
import {
	fillMessage,
	formatQuantity,
	signedMoneyFormat,
	UNIT_DIRECTION,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { CaretRightIcon } from "~/shared/ui/icons";
import { Table, TableBody, TableCell, TableRow } from "~/shared/ui/table";
import type { Transaction } from "../api/transactions.queries";

// A long period shows its rows in pages of 20, so the card never grows past two screens.
const PAGE_SIZE = 20;

type TransactionRowsProps = {
	/** The rows of the tab, newest first. */
	rows: Transaction[];
	/** The page number, from 1. The page holds it, so a period change sets it back to 1. */
	page: number;
	onPageChange: (page: number) => void;
	/** The sentence when the tab has no row. */
	empty: string;
	/** Opens the side panel of the transaction with this id. */
	onOpen: (transactionId: string) => void;
};

/** The rows of one tab. A unit that comes in shows a plus and the success color; a unit that leaves shows a minus. */
export function TransactionRows({
	rows,
	page,
	onPageChange,
	empty,
	onOpen,
}: TransactionRowsProps) {
	const { t, locale } = useT();
	const signedMoney = signedMoneyFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const number = new Intl.NumberFormat(locale);
	if (rows.length === 0) {
		return (
			<p className="px-4 py-4 text-center text-muted-foreground text-sm lg:py-10">
				{empty}
			</p>
		);
	}
	// LIMIT: pages in the browser over every row of the period. Upgrade: server paging with .range() (tables-paging.md of the app-dashboard skill).
	const pageCount = Math.ceil(rows.length / PAGE_SIZE);
	// A new trade or a shorter period can shrink the list below the current page, so clamp here.
	const currentPage = Math.min(page, pageCount);
	const pageRows = rows.slice(
		(currentPage - 1) * PAGE_SIZE,
		currentPage * PAGE_SIZE,
	);
	return (
		<>
			<Table>
				<TableBody>
					{pageRows.map((row) => {
						const sign = UNIT_DIRECTION[row.type];
						return (
							<TableRow key={row.id}>
								{/* A phone has no room for the date column: the date moves into the status line. */}
								<TableCell className="hidden w-36 ps-6 tabular-nums sm:table-cell">
									{date.format(new Date(row.occurredAt))}
								</TableCell>
								{/* The text wraps on a phone, so the amount and the open button stay in view. */}
								<TableCell className="whitespace-normal max-sm:ps-4">
									<p className="font-medium text-foreground">
										{fillMessage(t(`ledger.typeLines.${row.type}`), {
											quantity: formatQuantity(row.quantity, locale),
											symbol: row.assetSymbol,
										})}
									</p>
									<p className="text-muted-foreground text-sm">
										<span className="sm:hidden">
											{`${date.format(new Date(row.occurredAt))} · `}
										</span>
										{`${t(`ledger.statuses.${row.status}`)} · ${t(`ledger.accounts.${row.account}`)}`}
									</p>
								</TableCell>
								<TableCell className="pe-4 sm:pe-6">
									<div className="flex items-center justify-end gap-2 sm:gap-4">
										{/* A failed row moved no money: its amount shows muted and struck through. */}
										<bdi
											dir="ltr"
											className={cn(
												"tabular-nums",
												row.status === "failed"
													? "text-muted-foreground line-through"
													: sign === 1
														? "text-success"
														: "text-destructive",
											)}
										>
											{signedMoney.format(sign * row.amount)}
										</bdi>
										<Button
											type="button"
											variant="outline"
											size="sm"
											aria-label={fillMessage(t("activity.open"), {
												reference: row.reference,
											})}
											onClick={() => onOpen(row.id)}
										>
											<CaretRightIcon className="rtl:rotate-180" />
										</Button>
									</div>
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
			{pageCount > 1 ? (
				<div className="flex items-center gap-2 border-t px-6 py-3">
					<p className="flex-1 text-muted-foreground text-sm tabular-nums">
						{t("table.range")
							.replace(
								"{from}",
								number.format((currentPage - 1) * PAGE_SIZE + 1),
							)
							.replace(
								"{to}",
								number.format((currentPage - 1) * PAGE_SIZE + pageRows.length),
							)
							.replace("{count}", number.format(rows.length))}
					</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={currentPage === 1}
						onClick={() => onPageChange(currentPage - 1)}
					>
						{t("table.previous")}
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={currentPage === pageCount}
						onClick={() => onPageChange(currentPage + 1)}
					>
						{t("table.next")}
					</Button>
				</div>
			) : null}
		</>
	);
}
