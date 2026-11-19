// The transfer card of the home: uploads per day, week, or month as stacked bars, with a grouping select in the header.
// OverviewPage renders it in the last row. It reads transferQueryOptions with useQuery, so a new grouping keeps
// the old bars until the new ones arrive. The chart file loads with React.lazy.
import { CalendarBlankIcon } from "@phosphor-icons/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
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
import { transferQueryOptions } from "../api/overview.queries";
import {
	DEFAULT_TRANSFER_PERIOD,
	TRANSFER_PERIODS,
	type TransferPeriod,
} from "../lib/series";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const TransferChart = lazy(() =>
	import("./transfer-chart").then((module) => ({
		default: module.TransferChart,
	})),
);

/** The card holds the grouping. The description names the window of the bars. */
export function TransferCard() {
	const { t } = useT();
	const [period, setPeriod] = useState<TransferPeriod>(DEFAULT_TRANSFER_PERIOD);
	const transfer = useQuery({
		...transferQueryOptions(period),
		placeholderData: keepPreviousData,
	});
	const title = t("overview.transferTitle");

	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>
					{t(`overview.transferPeriods.${period}`)}
				</CardDescription>
				<CardAction>
					<Select
						value={period}
						onValueChange={(value) =>
							setPeriod(
								TRANSFER_PERIODS.find((option) => option === value) ?? period,
							)
						}
					>
						<SelectTrigger
							className="w-auto gap-2"
							aria-label={t("overview.grouping")}
						>
							<CalendarBlankIcon className="size-4 text-muted-foreground" />
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="end">
							{TRANSFER_PERIODS.map((option) => (
								<SelectItem key={option} value={option}>
									{t(`overview.transferPeriods.${option}`)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</CardAction>
			</CardHeader>
			<CardContent>
				{transfer.isError ? (
					<p
						role="alert"
						className="grid h-72 place-items-center text-center text-muted-foreground text-sm"
					>
						{t("overview.transferError")}
					</p>
				) : transfer.data ? (
					<Suspense fallback={<Skeleton className="h-72 w-full" />}>
						<TransferChart bars={transfer.data} period={period} title={title} />
					</Suspense>
				) : (
					<Skeleton className="h-72 w-full" />
				)}
			</CardContent>
		</Card>
	);
}
