import { MagnifyingGlassIcon } from "@phosphor-icons/react/MagnifyingGlass";
import { XIcon } from "@phosphor-icons/react/X";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { FeedbackStats } from "@/features/feedback/api/feedback.dto";
import {
	countFeedbackByStatus,
	FEEDBACK_SORT_OPTIONS,
	FEEDBACK_STATUS_OPTIONS,
	FEEDBACK_TYPE_OPTIONS,
} from "@/features/feedback/lib/feedback";
import type {
	FeedbackSort,
	FeedbackStatusFilter,
	FeedbackTypeFilter,
} from "@/features/feedback/types";
import { cn } from "@/lib/utils";

type FeedbackToolbarProps = {
	stats: FeedbackStats | undefined;
	query: string;
	status: FeedbackStatusFilter;
	type: FeedbackTypeFilter;
	sort: FeedbackSort;
	onQueryChange: (value: string) => void;
	onStatusChange: (value: FeedbackStatusFilter) => void;
	onTypeChange: (value: FeedbackTypeFilter) => void;
	onSortChange: (value: FeedbackSort) => void;
};

function FeedbackToolbar({
	stats,
	query,
	status,
	type,
	sort,
	onQueryChange,
	onStatusChange,
	onTypeChange,
	onSortChange,
}: FeedbackToolbarProps) {
	return (
		<div className="border-b p-3 sm:px-4">
			<div className="flex flex-col gap-3">
				<div className="-mx-1 overflow-x-auto px-1 pb-0.5">
					<fieldset className="inline-flex min-w-max items-center gap-1 rounded-full border bg-muted/35 p-1">
						<legend className="sr-only">Filter feedback by status</legend>
						{FEEDBACK_STATUS_OPTIONS.map((option) => {
							const isActive = status === option.value;
							const count = countFeedbackByStatus(stats, option.value);

							return (
								<button
									key={option.value}
									type="button"
									aria-pressed={isActive}
									className={cn(
										"flex h-7 items-center gap-1.5 rounded-full px-3 font-medium text-muted-foreground text-xs outline-none transition-[background-color,color,box-shadow,transform] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 active:scale-[0.98]",
										isActive &&
											"bg-background text-foreground shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.16)] dark:shadow-[inset_0_0_0_0.5px_rgb(255_255_255/0.18)]",
									)}
									onClick={() => onStatusChange(option.value)}
								>
									{option.label}
									<span className="font-mono text-xs opacity-65">{count}</span>
								</button>
							);
						})}
					</fieldset>
				</div>

				<div className="flex flex-col gap-2 md:flex-row md:items-center">
					<div className="relative min-w-0 flex-1 md:max-w-md">
						<MagnifyingGlassIcon
							aria-hidden="true"
							className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
							size={15}
						/>
						<Input
							type="search"
							value={query}
							maxLength={200}
							aria-label="Search reports, people, or Linear id"
							placeholder="Search reports, people, or Linear id…"
							className="pr-9 pl-9 shadow-none"
							onChange={(event) => onQueryChange(event.target.value)}
						/>
						{query ? (
							<Button
								type="button"
								variant="ghost"
								size="icon-xs"
								aria-label="Clear search"
								className="absolute top-1/2 right-2 -translate-y-1/2"
								onClick={() => onQueryChange("")}
							>
								<XIcon aria-hidden="true" />
							</Button>
						) : null}
					</div>

					<div className="grid grid-cols-2 gap-2 md:flex">
						<Select
							value={type}
							onValueChange={(value) =>
								onTypeChange(value as FeedbackTypeFilter)
							}
						>
							<SelectTrigger
								aria-label="Filter by feedback type"
								className="w-full md:w-[132px]"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{FEEDBACK_TYPE_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<Select
							value={sort}
							onValueChange={(value) => onSortChange(value as FeedbackSort)}
						>
							<SelectTrigger
								aria-label="Sort feedback"
								className="w-full md:w-[150px]"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{FEEDBACK_SORT_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
			</div>
		</div>
	);
}

export { FeedbackToolbar };
