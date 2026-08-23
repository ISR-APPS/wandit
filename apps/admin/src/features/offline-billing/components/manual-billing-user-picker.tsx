import { CheckIcon, ChevronsUpDownIcon, Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { ManualBillingUserReference } from "@/features/offline-billing/api/offline-billing.dto";
import { useUsersQuery } from "@/features/users/api/users.queries";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;

type ManualBillingUserPickerProps = {
	id: string;
	value: ManualBillingUserReference | null;
	onChange: (value: ManualBillingUserReference) => void;
	disabled?: boolean;
	invalid?: boolean;
};

export function ManualBillingUserPicker({
	id,
	value,
	onChange,
	disabled = false,
	invalid = false,
}: ManualBillingUserPickerProps) {
	const [open, setOpen] = useState(false);
	const [searchValue, setSearchValue] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const usersQuery = useUsersQuery({
		page: 1,
		pageSize: 12,
		sort: "name",
		q: debouncedQuery || undefined,
	});

	useEffect(() => {
		const handle = setTimeout(() => {
			setDebouncedQuery(searchValue.trim());
		}, SEARCH_DEBOUNCE_MS);

		return () => clearTimeout(handle);
	}, [searchValue]);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					id={id}
					type="button"
					variant="outline"
					role="combobox"
					aria-expanded={open}
					aria-invalid={invalid}
					disabled={disabled}
					className="h-auto min-h-9 w-full justify-between py-2 text-start font-normal"
				>
					<span className="min-w-0 truncate">
						{value
							? `${value.name ?? value.id} · ${value.email ?? value.id}`
							: "Search by name or email"}
					</span>
					<ChevronsUpDownIcon
						className="shrink-0 opacity-50"
						aria-hidden="true"
					/>
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="w-[min(28rem,var(--radix-popover-trigger-width))] p-0"
			>
				<Command shouldFilter={false}>
					<CommandInput
						value={searchValue}
						onValueChange={setSearchValue}
						placeholder="Search users…"
						maxLength={200}
					/>
					<CommandList>
						{usersQuery.isFetching ? (
							<div className="flex items-center justify-center gap-2 py-6 text-muted-foreground text-sm">
								<Loader2Icon
									className="size-4 animate-spin"
									aria-hidden="true"
								/>
								Searching users…
							</div>
						) : null}
						{!usersQuery.isFetching && usersQuery.isError ? (
							<div
								role="alert"
								className="flex flex-col items-center gap-2 py-5 text-center text-destructive text-sm"
							>
								<p>Users could not be loaded.</p>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => void usersQuery.refetch()}
								>
									Retry
								</Button>
							</div>
						) : null}
						{!usersQuery.isFetching && !usersQuery.isError ? (
							<CommandEmpty>No users found.</CommandEmpty>
						) : null}
						<CommandGroup>
							{usersQuery.data?.items.map((user) => (
								<CommandItem
									key={user.id}
									value={user.id}
									onSelect={() => {
										onChange({
											id: user.id,
											name: user.name,
											email: user.email,
										});
										setOpen(false);
									}}
								>
									<CheckIcon
										className={cn(
											"size-4",
											value?.id === user.id ? "opacity-100" : "opacity-0",
										)}
										aria-hidden="true"
									/>
									<span className="min-w-0 flex-1">
										<span className="block truncate font-medium">
											{user.name}
										</span>
										<span className="block truncate text-muted-foreground text-xs">
											{user.email}
										</span>
									</span>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
