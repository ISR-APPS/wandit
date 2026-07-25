import type { Column } from "@tanstack/react-table";
import { CheckIcon, PlusCircleIcon } from "lucide-react";
import type * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface DataTableFacetedFilterOption {
	label: string;
	value: string;
	icon?: React.ComponentType<{ className?: string }>;
}

interface DataTableFacetedFilterProps<TData, TValue> {
	column?: Column<TData, TValue>;
	title: string;
	options: DataTableFacetedFilterOption[];
}

function DataTableFacetedFilter<TData, TValue>({
	column,
	title,
	options,
}: DataTableFacetedFilterProps<TData, TValue>) {
	const facets = column?.getFacetedUniqueValues();
	const filterValue = column?.getFilterValue();
	const selectedValues = new Set(
		Array.isArray(filterValue) ? (filterValue as string[]) : [],
	);

	const updateFilter = (value: string) => {
		const nextValues = new Set(selectedValues);

		if (nextValues.has(value)) {
			nextValues.delete(value);
		} else {
			nextValues.add(value);
		}

		const values = Array.from(nextValues);
		column?.setFilterValue(values.length > 0 ? values : undefined);
	};

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-8 border-dashed"
				>
					<PlusCircleIcon data-icon="inline-start" />
					{title}
					{selectedValues.size > 0 && (
						<>
							<Separator orientation="vertical" className="mx-2 h-4" />
							<Badge
								variant="secondary"
								className="rounded-sm px-1 font-normal lg:hidden"
							>
								{selectedValues.size}
							</Badge>
							<span className="hidden gap-1 lg:flex">
								{selectedValues.size > 2 ? (
									<Badge
										variant="secondary"
										className="rounded-sm px-1 font-normal"
									>
										{selectedValues.size} selected
									</Badge>
								) : (
									options
										.filter((option) => selectedValues.has(option.value))
										.map((option) => (
											<Badge
												key={option.value}
												variant="secondary"
												className="rounded-sm px-1 font-normal"
											>
												{option.label}
											</Badge>
										))
								)}
							</span>
						</>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[200px] p-0" align="start">
				<Command>
					<CommandInput placeholder={title} />
					<CommandList>
						<CommandEmpty>No results found.</CommandEmpty>
						<CommandGroup>
							{options.map((option) => {
								const isSelected = selectedValues.has(option.value);

								return (
									<CommandItem
										key={option.value}
										value={`${option.label} ${option.value}`}
										onSelect={() => updateFilter(option.value)}
									>
										<span
											className={cn(
												"flex size-4 items-center justify-center rounded-[4px] border",
												isSelected
													? "border-primary bg-primary text-primary-foreground"
													: "border-input [&_svg]:invisible",
											)}
										>
											<CheckIcon className="size-3.5 text-primary-foreground" />
										</span>
										{option.icon && (
											<option.icon className="size-4 text-muted-foreground" />
										)}
										<span>{option.label}</span>
										{facets?.has(option.value) && (
											<span className="ml-auto flex min-w-4 items-center justify-center font-mono text-muted-foreground text-xs">
												{facets.get(option.value)}
											</span>
										)}
									</CommandItem>
								);
							})}
						</CommandGroup>
						{selectedValues.size > 0 && (
							<>
								<CommandSeparator />
								<CommandGroup>
									<CommandItem
										value={`clear-${title}`}
										className="justify-center text-center"
										onSelect={() => column?.setFilterValue(undefined)}
									>
										Clear filters
									</CommandItem>
								</CommandGroup>
							</>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

export type { DataTableFacetedFilterOption, DataTableFacetedFilterProps };
export { DataTableFacetedFilter };
