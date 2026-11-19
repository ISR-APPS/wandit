// The balance history card of the home: an account Select, range chips, the balance line, and two actions.
// OverviewPage renders it beside the transactions card. The account and the range are local state in the card;
// each pair has its own query key. "Export CSV" downloads the points on show.
import { ArrowClockwiseIcon, DownloadSimpleIcon } from "@phosphor-icons/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import {
	ACCOUNT_IDS,
	accountOf,
	centsToUnits,
	downloadCsv,
	fillMessage,
	toCsv,
} from "~/features/bank";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { balanceLineQueryOptions } from "../api/overview.queries";
import type { BalanceScope } from "../lib/overview";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const BalanceLineChart = lazy(() =>
	import("./balance-line-chart").then((module) => ({
		default: module.BalanceLineChart,
	})),
);

// The range chips, in days. The sample history keeps 250 days, so 180 is the longest range.
const RANGES = [7, 30, 90, 180] as const;

type Range = (typeof RANGES)[number];

const SCOPES: BalanceScope[] = ["all", ...ACCOUNT_IDS];

/** The range chips use a narrow day unit, for example "30d" in English. */
export function BalanceHistoryCard() {
	const { t, locale } = useT();
	const [scope, setScope] = useState<BalanceScope>("all");
	const [range, setRange] = useState<Range>(30);
	// A new account or range keeps the old line until the new one is ready, so the card keeps its height.
	const line = useQuery({
		...balanceLineQueryOptions(scope, range),
		placeholderData: keepPreviousData,
	});
	const narrowDays = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "narrow",
	});
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const scopeLabel = (item: BalanceScope) =>
		item === "all"
			? t("overview.balance.allAccounts")
			: `${t(`accounts.${item}`)} ••${accountOf(item).numberEnding}`;

	function exportCsv() {
		const points = line.data ?? [];
		downloadCsv(
			`balance-${scope}-${range}d.csv`,
			toCsv(
				points.map((point) => ({ id: point.day, ...point })),
				[
					{ header: t("entries.date"), value: (row) => row.day },
					{
						header: scopeLabel(scope),
						value: (row) => centsToUnits(row.cents).toFixed(2),
					},
				],
			),
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.balance.title")}</CardTitle>
				<CardAction className="flex items-center gap-1 text-muted-foreground text-sm">
					{line.dataUpdatedAt > 0 ? (
						<span className="@md/main:inline hidden">
							{fillMessage(t("overview.balance.updated"), {
								time: time.format(line.dataUpdatedAt),
							})}
						</span>
					) : null}
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-8"
						aria-label={t("overview.balance.refresh")}
						disabled={line.isFetching}
						onClick={() => line.refetch()}
					>
						<ArrowClockwiseIcon />
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-6">
				<Select
					value={scope}
					onValueChange={(value) =>
						setScope(SCOPES.find((item) => item === value) ?? "all")
					}
				>
					<SelectTrigger
						aria-label={t("overview.balance.account")}
						className="w-full"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{SCOPES.map((item) => (
							<SelectItem key={item} value={item}>
								{scopeLabel(item)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<div className="flex flex-wrap gap-2">
					{RANGES.map((item) => (
						<button
							key={item}
							type="button"
							aria-pressed={item === range}
							onClick={() => setRange(item)}
							className={cn(
								"rounded-md px-3 py-1.5 font-medium text-xs tabular-nums outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
								item === range
									? "bg-primary text-primary-foreground"
									: "bg-muted text-muted-foreground hover:text-foreground",
							)}
						>
							{narrowDays.format(item)}
						</button>
					))}
				</div>
				{line.isError ? (
					<div className="grid h-64 place-content-center justify-items-center gap-3 text-center">
						<p className="text-muted-foreground text-sm" role="alert">
							{t("overview.balance.error")}
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => line.refetch()}
						>
							{t("common.retry")}
						</Button>
					</div>
				) : line.data === undefined ? (
					<Skeleton className="h-64 w-full" />
				) : (
					<Suspense fallback={<Skeleton className="h-64 w-full" />}>
						<BalanceLineChart points={line.data} label={scopeLabel(scope)} />
					</Suspense>
				)}
				<div className="grid gap-3">
					<Button size="lg" className="w-full" asChild>
						<Link to="/app/statements">{t("overview.balance.statements")}</Link>
					</Button>
					<Button
						type="button"
						variant="outline"
						size="lg"
						className="w-full"
						disabled={line.data === undefined}
						onClick={exportCsv}
					>
						<DownloadSimpleIcon />
						{t("common.exportCsv")}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
