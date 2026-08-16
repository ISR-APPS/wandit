import { RefreshCwIcon } from "lucide-react";

import { AdminDateRangePicker } from "@/components/admin-date-range-picker";
import { Button } from "@/components/ui/button";
import type { OverviewQuery } from "@/features/overview/api/overview.dto";

type OverviewHeaderProps = {
	query: OverviewQuery;
	generatedAt?: string;
	isRefreshing: boolean;
	onQueryChange: (query: OverviewQuery) => void;
	onRefresh: () => void;
};

function formatUpdatedAt(value: string | undefined) {
	if (!value) {
		return "Preparing snapshot";
	}

	return `Updated ${new Intl.DateTimeFormat("en", {
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(value))}`;
}

function OverviewHeader({
	query,
	generatedAt,
	isRefreshing,
	onQueryChange,
	onRefresh,
}: OverviewHeaderProps) {
	return (
		<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
			<div className="min-w-0">
				<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
					Platform pulse
				</p>
				<h1 className="mt-1 font-semibold text-2xl tracking-tight">Overview</h1>
				<p className="mt-1 max-w-2xl text-muted-foreground text-sm">
					Revenue, usage, and generation health across Wandit.
				</p>
			</div>

			<div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
				<span className="mr-1 text-muted-foreground text-xs tabular-nums">
					{formatUpdatedAt(generatedAt)}
				</span>
				<AdminDateRangePicker value={query} onChange={onQueryChange} />
				<Button
					type="button"
					variant="outline"
					size="icon"
					aria-label="Refresh overview"
					disabled={isRefreshing}
					onClick={onRefresh}
				>
					<span className={isRefreshing ? "animate-spin" : undefined}>
						<RefreshCwIcon />
					</span>
				</Button>
			</div>
		</div>
	);
}

export type { OverviewHeaderProps };
export { OverviewHeader };
