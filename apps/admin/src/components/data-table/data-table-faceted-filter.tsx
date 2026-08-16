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

interface DataTableFacetedFilterBaseProps {
	ariaLabel: string;
	title: string;
	options: readonly DataTableFacetedFilterOption[];
}

interface DataTableFacetedFilterControlledProps {
	column?: never;
	value: string[];
	onValueChange: (values: string[] | undefined) => void;
	counts?: Record<string, number>;
}

interface DataTableFacetedFilterColumnProps<TData, TValue> {
	column: Column<TData, TValue>;
	value?: never;
	onValueChange?: never;
	counts?: never;
}

type DataTableFacetedFilterProps<
	TData = unknown,
	TValue = unknown,
> = DataTableFacetedFilterBaseProps &
	(
		| DataTableFacetedFilterControlledProps
		| DataTableFacetedFilterColumnProps<TData, TValue>
	);

function DataTableFacetedFilter<TData = unknown, TValue = unknown>(
	props: DataTableFacetedFilterProps<TData, TValue>,
) {
	const { ariaLabel, title, options } = props;
	const facets = props.column?.getFacetedUniqueValues();
	const filterValue = props.column
		? props.column.getFilterValue()
		: props.value;
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
		const nextValue = values.length > 0 ? values : undefined;

		if (props.column) {
			props.column.setFilterValue(nextValue);
		} else {
			props.onValueChange(nextValue);
		}
	};

	const clearFilter = () => {
		if (props.column) {
			props.column.setFilterValue(undefined);
		} else {
			props.onValueChange(undefined);
		}
	};

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-8 border-dashed"
					aria-label={ariaLabel}
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
									options.map((option) =>
										selectedValues.has(option.value) ? (
											<Badge
												key={option.value}
												variant="secondary"
												className="rounded-sm px-1 font-normal"
											>
												{option.label}
											</Badge>
										) : null,
									)
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
								const hasCount = props.column
									? facets?.has(option.value)
									: props.counts
										? Object.hasOwn(props.counts, option.value)
										: false;
								const count = props.column
									? facets?.get(option.value)
									: props.counts?.[option.value];

								return (
									<CommandItem
										key={option.value}
										value={`${option.label} ${option.value}`}
										onSelect={() => updateFilter(option.value)}
										aria-checked={isSelected}
									>
										<span
											aria-hidden="true"
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
										{hasCount && (
											<span className="ml-auto flex min-w-4 items-center justify-center font-mono text-muted-foreground text-xs">
												{count}
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
										onSelect={clearFilter}
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
