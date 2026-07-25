import { CalendarRangeIcon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { OverviewRange } from "@/features/overview/api/overview.dto";

type OverviewHeaderProps = {
	range: OverviewRange;
	generatedAt?: string;
	isRefreshing: boolean;
	onRangeChange: (range: OverviewRange) => void;
	onRefresh: () => void;
};

const rangeLabels: Record<OverviewRange, string> = {
	"7d": "Last 7 days",
	"30d": "Last 30 days",
	"90d": "Last 90 days",
};

function isOverviewRange(value: string): value is OverviewRange {
	return value === "7d" || value === "30d" || value === "90d";
}

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
	range,
	generatedAt,
	isRefreshing,
	onRangeChange,
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
				<Select
					value={range}
					onValueChange={(value) => {
						if (isOverviewRange(value)) {
							onRangeChange(value);
						}
					}}
				>
					<SelectTrigger
						className="min-w-38 bg-background"
						aria-label="Date range"
					>
						<CalendarRangeIcon />
						<SelectValue>{rangeLabels[range]}</SelectValue>
					</SelectTrigger>
					<SelectContent align="end">
						{Object.entries(rangeLabels).map(([value, label]) => (
							<SelectItem key={value} value={value}>
								{label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
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
