// The cards page, in the kit product list anatomy: the title and the export, four KPI cards with a badge,
// then the card table with a filter field, Status and Kind filters, a column menu, row checkboxes, and pages.
// The /app/cards route renders it after its loader. The filters are local state; RecordTable holds the rest.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	accountOf,
	CARD_STATUSES,
	ChangeLine,
	type CsvColumn,
	centsToUnits,
	changeRatio,
	copyToClipboard,
	countLabel,
	dayFormat,
	dayToDate,
	downloadCsv,
	fillMessage,
	moneyFormat,
	NEAR_LIMIT_SHARE,
	toCsv,
} from "~/features/bank";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import { Progress } from "~/shared/ui/progress";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	cardsQueryOptions,
	cardTotalsQueryOptions,
} from "../api/cards.queries";
import type { CardSummary } from "../lib/card-spend";
import { CardChip } from "./card-chip";
import { CardKpi } from "./card-kpi";
import { CardStatusBadge } from "./card-status-badge";

// The two kinds of card, in the order of the Kind filter.
const CARD_KINDS = ["physical", "virtual"] as const;

/** A table row: RecordTable keys its rows by `id`, so the card id is copied up. */
type CardRow = CardSummary & { id: string };

/** Every control works on the 7 sample cards in the browser. */
export function CardsPage() {
	const { t, locale } = useT();
	const { data: summaries } = useSuspenseQuery(cardsQueryOptions());
	const { data: totals } = useSuspenseQuery(cardTotalsQueryOptions());
	const [status, setStatus] = useState<string | null>(null);
	const [kind, setKind] = useState<string | null>(null);
	const money = moneyFormat(locale, 0);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const number = new Intl.NumberFormat(locale);
	const shortDay = dayFormat(locale);
	const operating = accountOf("operating");
	const rows: CardRow[] = summaries
		.filter((summary) => status === null || summary.status === status)
		.filter((summary) => kind === null || summary.card.kind === kind)
		.map((summary) => ({ ...summary, id: summary.card.id }));
	const usedShare =
		totals.activeLimitCents === 0
			? 0
			: totals.activeSpendCents / totals.activeLimitCents;

	const columns: RecordColumn<CardRow>[] = [
		{
			id: "card",
			header: t("cards.card"),
			cell: (row) => (
				<Link
					to="/app/cards/$cardId"
					params={{ cardId: row.card.id }}
					className="flex items-center gap-3"
				>
					<CardChip card={row.card} />
					<span className="grid min-w-0">
						<span className="truncate font-medium hover:underline">
							{row.card.holderName}
						</span>
						<span className="truncate text-muted-foreground text-xs">
							{fillMessage(t(`cards.kindLine.${row.card.kind}`), {
								ending: row.card.numberEnding,
							})}
						</span>
					</span>
				</Link>
			),
			sortValue: (row) => row.card.holderName,
		},
		{
			id: "role",
			header: t("cards.role"),
			cell: (row) => t(`cards.roles.${row.card.role}`),
			sortValue: (row) => t(`cards.roles.${row.card.role}`),
			hideable: true,
		},
		{
			id: "limit",
			header: t("cards.limit"),
			cell: (row) => money.format(centsToUnits(row.card.monthlyLimitCents)),
			sortValue: (row) => row.card.monthlyLimitCents,
			align: "end",
			hideable: true,
		},
		{
			id: "spent",
			header: t("cards.spentThisMonth"),
			cell: (row) => money.format(centsToUnits(row.monthSpendCents)),
			sortValue: (row) => row.monthSpendCents,
			align: "end",
		},
		{
			id: "used",
			header: t("cards.used"),
			cell: (row) => {
				const share = row.monthSpendCents / row.card.monthlyLimitCents;
				return (
					<span className="flex items-center gap-2">
						<Progress
							value={share * 100}
							aria-label={`${t("cards.used")}: ${percent.format(share)}`}
							className="h-1.5 w-16"
						/>
						<span className="text-muted-foreground text-xs tabular-nums">
							{percent.format(share)}
						</span>
					</span>
				);
			},
			sortValue: (row) => row.monthSpendCents / row.card.monthlyLimitCents,
			hideable: true,
		},
		{
			id: "status",
			header: t("cards.status"),
			cell: (row) => <CardStatusBadge status={row.status} />,
			sortValue: (row) => CARD_STATUSES.indexOf(row.status),
		},
		{
			id: "lastUsed",
			header: t("cards.lastUsedColumn"),
			cell: (row) =>
				row.lastUsedDay ? (
					<span className="text-muted-foreground tabular-nums">
						{shortDay.format(dayToDate(row.lastUsedDay))}
					</span>
				) : (
					<span className="text-muted-foreground">{t("cards.neverUsed")}</span>
				),
			sortValue: (row) => row.lastUsedDay ?? "",
			hideable: true,
		},
	];

	const csvColumns: CsvColumn<CardRow>[] = [
		{ header: t("cards.holder"), value: (row) => row.card.holderName },
		{ header: t("cards.ending"), value: (row) => row.card.numberEnding },
		{
			header: t("cards.role"),
			value: (row) => t(`cards.roles.${row.card.role}`),
		},
		{
			header: t("cards.status"),
			value: (row) => t(`cards.statuses.${row.status}`),
		},
		{
			header: t("cards.limit"),
			value: (row) => centsToUnits(row.card.monthlyLimitCents).toFixed(2),
		},
		{
			header: t("cards.spentThisMonth"),
			value: (row) => centsToUnits(row.monthSpendCents).toFixed(2),
		},
		{
			header: t("cards.lastUsedColumn"),
			value: (row) => row.lastUsedDay ?? "",
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("cards.title")}
				description={fillMessage(t("cards.description"), {
					account: `${t("accounts.operating")} ••${operating.numberEnding}`,
				})}
				actions={
					<Button
						type="button"
						onClick={() =>
							downloadCsv("northbank-cards.csv", toCsv(rows, csvColumns))
						}
					>
						<DownloadSimpleIcon />
						{t("common.exportCsv")}
					</Button>
				}
			/>
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				<CardKpi
					label={t("cards.kpis.spent")}
					value={money.format(centsToUnits(totals.monthSpendCents))}
					badge={
						<Badge variant="outline">
							<ChangeLine
								change={changeRatio(
									totals.monthSpendCents,
									totals.previousSpendCents,
								)}
								goodWhen="down"
								className="text-xs [&_svg]:size-3"
							/>
						</Badge>
					}
				/>
				<CardKpi
					label={t("cards.kpis.payments")}
					value={number.format(totals.paymentCount)}
					badge={
						<Badge variant="outline">
							<ChangeLine
								change={changeRatio(
									totals.paymentCount,
									totals.previousPaymentCount,
								)}
								goodWhen="down"
								className="text-xs [&_svg]:size-3"
							/>
						</Badge>
					}
				/>
				<CardKpi
					label={t("cards.kpis.limits")}
					value={money.format(centsToUnits(totals.activeLimitCents))}
					badge={
						<Badge variant="outline">
							{countLabel(
								totals.activeCount,
								t("cards.kpis.activeOne"),
								t("cards.kpis.activeOther"),
								locale,
							)}
						</Badge>
					}
				/>
				<CardKpi
					label={t("cards.kpis.left")}
					// The sample rows do not stop a payment at the limit, so "left" stops at 0.
					value={money.format(
						centsToUnits(
							Math.max(0, totals.activeLimitCents - totals.activeSpendCents),
						),
					)}
					badge={
						<Badge
							variant={usedShare >= NEAR_LIMIT_SHARE ? "warning" : "outline"}
						>
							{fillMessage(t("cards.kpis.used"), {
								share: percent.format(usedShare),
							})}
						</Badge>
					}
				/>
			</div>
			<RecordTable
				rows={rows}
				columns={columns}
				searchText={(row) =>
					`${row.card.holderName} ${row.card.numberEnding} ${t(`cards.roles.${row.card.role}`)}`
				}
				searchPlaceholder={t("cards.search")}
				toolbar={
					<>
						<RecordFilter
							label={t("cards.status")}
							options={CARD_STATUSES.map((value) => ({
								value,
								label: t(`cards.statuses.${value}`),
							}))}
							value={status}
							onValueChange={setStatus}
						/>
						<RecordFilter
							label={t("cards.kind")}
							options={CARD_KINDS.map((value) => ({
								value,
								label: t(`cards.kinds.${value}`),
							}))}
							value={kind}
							onValueChange={setKind}
						/>
					</>
				}
				rowMenu={(row) => (
					<>
						<DropdownMenuItem asChild>
							<Link to="/app/cards/$cardId" params={{ cardId: row.card.id }}>
								{t("entries.openShort")}
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(row.card.numberEnding, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("cards.copyEnding")}
						</DropdownMenuItem>
					</>
				)}
				selectable
				bulkActions={(selected) => (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-9"
						onClick={() =>
							downloadCsv(
								"northbank-cards-selected.csv",
								toCsv(selected, csvColumns),
							)
						}
					>
						<DownloadSimpleIcon />
						{t("table.exportSelected")}
					</Button>
				)}
				pageSize={10}
				noResults={t("cards.noResults")}
			/>
		</div>
	);
}

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function CardsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-32" />
					<Skeleton className="h-4 w-80 max-w-full" />
				</div>
				<Skeleton className="h-9 w-32" />
			</div>
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				<Skeleton className="h-28" />
				<Skeleton className="h-28" />
				<Skeleton className="h-28" />
				<Skeleton className="h-28" />
			</div>
			<Skeleton className="h-112" />
		</div>
	);
}

/** Error state when a loader of the cards pages fails. Try again runs the loader again. */
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
