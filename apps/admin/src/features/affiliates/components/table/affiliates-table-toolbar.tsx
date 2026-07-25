import type { Table } from "@tanstack/react-table";
import { SearchIcon, XIcon } from "lucide-react";

import { DataTableFacetedFilter } from "@/components/data-table/data-table-faceted-filter";
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Affiliate } from "@/features/affiliates/api/affiliates.dto";
import {
	AFFILIATE_CHANNEL_OPTIONS,
	AFFILIATE_PAYOUT_METHOD_OPTIONS,
	AFFILIATE_PERFORMANCE_OPTIONS,
	AFFILIATE_STATUS_OPTIONS,
} from "@/features/affiliates/lib/constants";
import { cn } from "@/lib/utils";

import {
	AFFILIATE_TABLE_PRESETS,
	type AffiliateTablePresetId,
	matchesAffiliatePreset,
} from "./affiliates-table-utils";

type AffiliatesTableToolbarProps = {
	table: Table<Affiliate>;
	data: Affiliate[];
	searchValue: string;
	activePreset: AffiliateTablePresetId | null;
	onSearchChange: (value: string) => void;
	onPresetChange: (preset: AffiliateTablePresetId) => void;
	onReset: () => void;
};

const columnLabels = {
	affiliate: "Affiliate",
	status: "Status",
	channel: "Channel",
	codes: "Referral codes",
	traffic: "Traffic",
	signups: "Signups",
	conversion: "Paid rate",
	revenue: "Revenue",
	commissionDue: "Commission due",
	payoutMethod: "Payout method",
	lastConversion: "Last conversion",
	joinedAt: "Joined",
};

const payoutOptions = [
	...AFFILIATE_PAYOUT_METHOD_OPTIONS,
	{ label: "Not set", value: "not-set" },
];

function AffiliatesTableToolbar({
	table,
	data,
	searchValue,
	activePreset,
	onSearchChange,
	onPresetChange,
	onReset,
}: AffiliatesTableToolbarProps) {
	const isFiltered =
		searchValue.length > 0 || table.getState().columnFilters.length > 0;

	return (
		<div className="space-y-3">
			<fieldset className="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1 pb-1">
				<legend className="sr-only">Saved affiliate views</legend>
				{AFFILIATE_TABLE_PRESETS.map((preset) => {
					const count = data.filter((affiliate) =>
						matchesAffiliatePreset(affiliate, preset.id),
					).length;
					const isActive = activePreset === preset.id;

					return (
						<Button
							key={preset.id}
							type="button"
							size="sm"
							variant={isActive ? "secondary" : "ghost"}
							className={cn(
								"h-8 shrink-0 px-2.5 text-muted-foreground active:scale-[0.98]",
								isActive && "text-foreground",
							)}
							aria-pressed={isActive}
							onClick={() => onPresetChange(preset.id)}
						>
							{preset.label}
							<span
								className={cn(
									"rounded-sm px-1.5 py-0.5 font-mono text-[10px]",
									isActive ? "bg-background/80" : "bg-muted",
								)}
							>
								{count}
							</span>
						</Button>
					);
				})}
			</fieldset>

			<div className="flex flex-col gap-2 lg:flex-row lg:items-center">
				<div className="relative w-full sm:w-[320px]">
					<SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={searchValue}
						onChange={(event) => onSearchChange(event.target.value)}
						placeholder="Search partner, email, ID, or code..."
						aria-label="Search affiliates"
						className="h-8 pl-9"
					/>
				</div>

				<div className="flex flex-1 flex-wrap items-center gap-2">
					{table.getColumn("status") ? (
						<DataTableFacetedFilter
							column={table.getColumn("status")}
							title="Status"
							options={[...AFFILIATE_STATUS_OPTIONS]}
						/>
					) : null}
					{table.getColumn("channel") ? (
						<DataTableFacetedFilter
							column={table.getColumn("channel")}
							title="Channel"
							options={[...AFFILIATE_CHANNEL_OPTIONS]}
						/>
					) : null}
					{table.getColumn("payoutMethod") ? (
						<DataTableFacetedFilter
							column={table.getColumn("payoutMethod")}
							title="Payout"
							options={payoutOptions}
						/>
					) : null}
					{table.getColumn("performanceBand") ? (
						<DataTableFacetedFilter
							column={table.getColumn("performanceBand")}
							title="Performance"
							options={[...AFFILIATE_PERFORMANCE_OPTIONS]}
						/>
					) : null}
					{isFiltered ? (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-8"
							onClick={onReset}
						>
							<XIcon data-icon="inline-start" />
							Reset
						</Button>
					) : null}
				</div>

				<DataTableViewOptions table={table} columnLabels={columnLabels} />
			</div>
		</div>
	);
}

export type { AffiliatesTableToolbarProps };
export { AffiliatesTableToolbar };
