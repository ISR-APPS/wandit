import { CalendarRangeIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
	type AdminDateRangeQuery,
	adminDateRangeLabels,
	adminDateRangeOptions,
	createAdminCustomDateRangeQuery,
	formatAdminDateRangeLabel,
	getAdminCalendarRange,
	getUtcTodayAsLocalCalendarDate,
} from "@/lib/admin-date-range";

type AdminDateRangePickerProps = {
	value: AdminDateRangeQuery;
	onChange: (value: AdminDateRangeQuery) => void;
};

function AdminDateRangePicker({ value, onChange }: AdminDateRangePickerProps) {
	const [open, setOpen] = useState(false);
	const [activeRange, setActiveRange] = useState(value.range);
	const [draft, setDraft] = useState<DateRange | undefined>(() =>
		getAdminCalendarRange(value),
	);
	const today = getUtcTodayAsLocalCalendarDate();
	const firstDisplayedMonth =
		draft?.from ?? new Date(today.getFullYear(), today.getMonth() - 1, 1);
	const customQuery = useMemo(
		() => createAdminCustomDateRangeQuery(draft),
		[draft],
	);

	function restoreCommittedSelection() {
		setActiveRange(value.range);
		setDraft(getAdminCalendarRange(value));
	}

	function handleOpenChange(nextOpen: boolean) {
		restoreCommittedSelection();
		setOpen(nextOpen);
	}

	function handleRangeChange(nextRange: string) {
		const selectedRange = adminDateRangeOptions.find(
			(range) => range === nextRange,
		);
		if (!selectedRange) return;

		setActiveRange(selectedRange);
		if (selectedRange === "custom") {
			setDraft(getAdminCalendarRange(value));
			return;
		}

		onChange({ range: selectedRange });
		setOpen(false);
	}

	function handleCancel() {
		restoreCommittedSelection();
		setOpen(false);
	}

	function handleClear() {
		setDraft(undefined);
	}

	function handleApply() {
		if (!customQuery) return;

		onChange(customQuery);
		setOpen(false);
	}

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					className="min-w-38 justify-start bg-background font-normal tabular-nums"
					aria-label={`Date range: ${formatAdminDateRangeLabel(value)}`}
				>
					<CalendarRangeIcon data-icon="inline-start" aria-hidden="true" />
					{formatAdminDateRangeLabel(value)}
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				aria-label="Reporting period"
				className="max-h-[min(680px,calc(100dvh-2rem))] w-auto max-w-[calc(100vw-2rem)] overflow-auto p-0"
			>
				<PopoverHeader className="sr-only">
					<PopoverTitle>Reporting period</PopoverTitle>
				</PopoverHeader>
				<div className="flex flex-col items-stretch sm:min-w-max sm:flex-row">
					<nav
						aria-label="Reporting period presets"
						className="w-full shrink-0 border-b bg-muted/25 p-2 sm:w-44 sm:border-r sm:border-b-0"
					>
						<ToggleGroup
							type="single"
							orientation="vertical"
							value={activeRange}
							onValueChange={handleRangeChange}
							className="w-full flex-col items-stretch gap-1"
							aria-label="Choose a reporting period"
						>
							{adminDateRangeOptions.map((range) => (
								<ToggleGroupItem
									key={range}
									value={range}
									className="h-8 w-full justify-start rounded-md px-2.5 text-left text-sm data-[state=on]:bg-background data-[state=on]:shadow-xs"
								>
									{adminDateRangeLabels[range]}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
					</nav>

					{activeRange === "custom" ? (
						<div className="flex flex-col">
							<div className="border-b px-4 py-3">
								<p className="font-medium text-sm">Custom range</p>
								<p className="mt-0.5 text-muted-foreground text-xs">
									Select a start and end date, up to two years.
								</p>
							</div>
							<Calendar
								mode="range"
								numberOfMonths={2}
								max={730}
								selected={draft}
								onSelect={setDraft}
								resetOnSelect
								defaultMonth={firstDisplayedMonth}
								disabled={{ after: today }}
								excludeDisabled
								className="tabular-nums"
							/>
							<div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
								<div className="flex min-w-0 items-center gap-2">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										disabled={!draft?.from && !draft?.to}
										onClick={handleClear}
									>
										Clear
									</Button>
									<p className="min-w-0 text-muted-foreground text-xs tabular-nums">
										{customQuery
											? formatAdminDateRangeLabel(customQuery)
											: "Choose both dates to apply"}
									</p>
								</div>
								<div className="flex shrink-0 items-center gap-2">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={handleCancel}
									>
										Cancel
									</Button>
									<Button
										type="button"
										size="sm"
										disabled={!customQuery}
										onClick={handleApply}
									>
										Apply
									</Button>
								</div>
							</div>
						</div>
					) : null}
				</div>
			</PopoverContent>
		</Popover>
	);
}

export type { AdminDateRangePickerProps };
export { AdminDateRangePicker };
