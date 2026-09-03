import { RefreshCwIcon } from "lucide-react";

import { AdminDateRangePicker } from "@/components/admin-date-range-picker";
import { Button } from "@/components/ui/button";
import type { AnalyticsQuery } from "@/features/analytics/api/analytics.dto";
import { AnalyticsFilterControl } from "@/features/analytics/components/analytics-filter-control";
import { formatOverviewUpdatedAt } from "@/features/overview/lib/formatters";
import { mergeAdminAnalyticsDateRangeQuery } from "@/lib/admin-date-range";

type AnalyticsFilterMode = "standard" | "engagement";

type AnalyticsPageHeaderProps = {
	eyebrow: string;
	title: string;
	description: string;
	query: AnalyticsQuery;
	filterMode?: AnalyticsFilterMode;
	updatedAt?: string;
	isRefreshing: boolean;
	onQueryChange: (query: AnalyticsQuery) => void;
	onRefresh: () => void;
};

function AnalyticsPageHeader({
	eyebrow,
	title,
	description,
	query,
	filterMode,
	updatedAt,
	isRefreshing,
	onQueryChange,
	onRefresh,
}: AnalyticsPageHeaderProps) {
	return (
		<header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
			<div className="min-w-0">
				<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
					{eyebrow}
				</p>
				<h1 className="mt-1 font-semibold text-2xl tracking-tight">{title}</h1>
				<p className="mt-1 max-w-2xl text-muted-foreground text-sm">
					{description}
				</p>
			</div>

			<div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
				<span className="mr-1 text-muted-foreground text-xs tabular-nums">
					{updatedAt
						? formatOverviewUpdatedAt(updatedAt)
						: "Preparing snapshot"}
				</span>
				{filterMode ? (
					<AnalyticsFilterControl
						value={query}
						includeCohortOnly={filterMode === "engagement"}
						onChange={onQueryChange}
					/>
				) : null}
				<AdminDateRangePicker
					value={query}
					onChange={(dateQuery) => {
						onQueryChange(
							mergeAdminAnalyticsDateRangeQuery(
								query,
								dateQuery,
								filterMode === "engagement",
							),
						);
					}}
				/>
				<Button
					type="button"
					variant="outline"
					size="icon"
					aria-label={`Refresh ${title.toLowerCase()}`}
					disabled={isRefreshing}
					onClick={onRefresh}
				>
					<span className={isRefreshing ? "animate-spin" : undefined}>
						<RefreshCwIcon />
					</span>
				</Button>
			</div>
		</header>
	);
}

export type { AnalyticsFilterMode, AnalyticsPageHeaderProps };
export { AnalyticsPageHeader };
