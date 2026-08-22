import type { AffiliateUserIdentity } from "@wandit/contracts";
import {
	AlertTriangleIcon,
	ChevronDownIcon,
	Loader2Icon,
	SearchIcon,
	UnlinkIcon,
	UserRoundCheckIcon,
	UserRoundXIcon,
} from "lucide-react";
import { useId, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { AdminUserSummary } from "@/features/users";
import { useUsersQuery } from "@/features/users";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { titleCaseAffiliateValue } from "../lib/formatters";
import {
	findExactEmailUser,
	isValidAffiliateEmail,
} from "../lib/user-matching";

const USER_SEARCH_PAGE_SIZE = 6;
const EXACT_EMAIL_SEARCH_PAGE_SIZE = 50;

export function PortalAccessControl({
	dialogOpen,
	linkedUser,
	affiliateEmail,
	suggestExactMatch,
	onLinkedUserChange,
}: {
	dialogOpen: boolean;
	linkedUser: AffiliateUserIdentity | null;
	affiliateEmail: string;
	suggestExactMatch: boolean;
	onLinkedUserChange: (user: AffiliateUserIdentity | null) => void;
}) {
	const triggerId = useId();
	const resultsId = `${triggerId}-results`;
	const headingId = `${triggerId}-heading`;
	const [pickerOpen, setPickerOpen] = useState(false);
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search);
	const trimmedSearch = search.trim();
	const settledSearch = debouncedSearch.trim();
	const waitingForSearch =
		trimmedSearch.length >= 2 && trimmedSearch !== settledSearch;
	const canSearch =
		dialogOpen && settledSearch.length >= 2 && !waitingForSearch;
	const trimmedEmail = affiliateEmail.trim();
	const debouncedEmail = useDebouncedValue(trimmedEmail);
	const canSuggestExactMatch =
		dialogOpen &&
		suggestExactMatch &&
		trimmedEmail === debouncedEmail &&
		isValidAffiliateEmail(debouncedEmail);

	function selectUser(user: AdminUserSummary) {
		onLinkedUserChange(toLinkedUser(user));
		setSearch("");
		setPickerOpen(false);
	}

	return (
		<section
			aria-labelledby={headingId}
			className="space-y-4 rounded-lg border bg-muted/10 p-4"
		>
			<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h3 id={headingId} className="font-semibold text-sm">
						Portal access
					</h3>
					<p className="mt-1 max-w-xl text-muted-foreground text-xs">
						The linked user sees an Affiliates page in the web app with their
						links, referrals, commissions and payouts.
					</p>
				</div>
				<Badge variant="outline" className="shrink-0">
					Portal access after save: {linkedUser ? "On" : "Off"}
				</Badge>
			</div>

			{linkedUser ? (
				<div className="flex flex-col gap-3 rounded-md border bg-background p-3 sm:flex-row sm:items-center">
					<UserRoundCheckIcon
						aria-hidden="true"
						className="size-5 shrink-0 text-emerald-600"
					/>
					<div className="min-w-0 flex-1">
						<p className="truncate font-medium text-sm">{linkedUser.name}</p>
						<p className="truncate text-muted-foreground text-xs">
							{linkedUser.email}
						</p>
					</div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="shrink-0"
						onClick={() => onLinkedUserChange(null)}
					>
						<UnlinkIcon />
						Unlink
					</Button>
				</div>
			) : (
				<div className="flex items-start gap-3 rounded-md border border-dashed bg-background/70 p-3 text-muted-foreground">
					<UserRoundXIcon
						aria-hidden="true"
						className="mt-0.5 size-4 shrink-0"
					/>
					<p className="text-xs">
						No account will be linked after save — the partner will not be able
						to open the Affiliates page in the web app.
					</p>
				</div>
			)}

			<div className="space-y-2">
				<Label htmlFor={triggerId}>
					Link a user account (search by name or email)
				</Label>
				<Popover open={pickerOpen} onOpenChange={setPickerOpen}>
					<PopoverTrigger asChild>
						<Button
							id={triggerId}
							type="button"
							variant="outline"
							role="combobox"
							aria-autocomplete="list"
							aria-controls={resultsId}
							aria-expanded={pickerOpen}
							className="w-full justify-between font-normal"
						>
							<span className="flex min-w-0 items-center gap-2 text-muted-foreground">
								<SearchIcon aria-hidden="true" className="size-4 shrink-0" />
								<span className="truncate">
									{linkedUser
										? "Search for another account…"
										: "Search user accounts…"}
								</span>
							</span>
							<ChevronDownIcon
								aria-hidden="true"
								className="size-4 shrink-0 opacity-50"
							/>
						</Button>
					</PopoverTrigger>
					<PopoverContent
						align="start"
						className="w-(--radix-popover-trigger-width) max-w-[calc(100vw-2rem)] p-0"
					>
						<Command shouldFilter={false} loop>
							<CommandInput
								value={search}
								onValueChange={setSearch}
								placeholder="Search by name or email…"
								aria-label="Search users by name or email"
							/>
							<CommandList
								id={resultsId}
								aria-label="User account search results"
							>
								{trimmedSearch.length < 2 ? (
									<SearchStateMessage>
										Type at least 2 characters to search.
									</SearchStateMessage>
								) : waitingForSearch ? (
									<SearchLoadingState />
								) : canSearch ? (
									<UserSearchResults
										query={settledSearch}
										onSelect={selectUser}
									/>
								) : null}
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>
			</div>

			{canSuggestExactMatch ? (
				<ExactEmailSuggestion email={debouncedEmail} onSelect={selectUser} />
			) : null}
		</section>
	);
}

function UserSearchResults({
	query,
	onSelect,
}: {
	query: string;
	onSelect: (user: AdminUserSummary) => void;
}) {
	const usersQuery = useUsersQuery({
		page: 1,
		pageSize: USER_SEARCH_PAGE_SIZE,
		q: query,
		sort: "newest",
	});

	if (usersQuery.isFetching) {
		return <SearchLoadingState />;
	}
	if (usersQuery.isError || !usersQuery.data) {
		return (
			<div className="space-y-2 px-3 py-4 text-center" role="alert">
				<p className="text-destructive text-sm">
					User accounts could not be loaded.
				</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => void usersQuery.refetch()}
				>
					Retry
				</Button>
			</div>
		);
	}
	if (usersQuery.data.items.length === 0) {
		return <SearchStateMessage>No user accounts found.</SearchStateMessage>;
	}
	const exactMatch = findExactEmailUser(usersQuery.data.items, query);
	const sortedUsers = exactMatch
		? [
				exactMatch,
				...usersQuery.data.items.filter((user) => user.id !== exactMatch.id),
			]
		: usersQuery.data.items;
	const hasMoreResults = usersQuery.data.total > usersQuery.data.items.length;

	return (
		<>
			<CommandGroup heading="User accounts">
				{sortedUsers.map((user) => (
					<CommandItem
						key={user.id}
						value={user.id}
						className="items-start py-2.5"
						onSelect={() => onSelect(user)}
						aria-label={`Link ${user.name} (${user.email})`}
					>
						<UserRoundCheckIcon
							aria-hidden="true"
							className="mt-0.5 size-4 shrink-0"
						/>
						<div className="min-w-0 flex-1">
							<p className="truncate font-medium">{user.name}</p>
							<p className="truncate text-muted-foreground text-xs">
								{user.email}
							</p>
							<UserAccountBadges user={user} />
						</div>
					</CommandItem>
				))}
			</CommandGroup>
			{hasMoreResults ? (
				<div className="border-t px-3 py-2 text-center text-muted-foreground text-xs">
					Showing {usersQuery.data.items.length} of {usersQuery.data.total} —
					type more to narrow the search
				</div>
			) : null}
		</>
	);
}

function ExactEmailSuggestion({
	email,
	onSelect,
}: {
	email: string;
	onSelect: (user: AdminUserSummary) => void;
}) {
	const usersQuery = useUsersQuery({
		page: 1,
		pageSize: EXACT_EMAIL_SEARCH_PAGE_SIZE,
		q: email,
		sort: "newest",
	});
	const exactMatch = findExactEmailUser(usersQuery.data?.items ?? [], email);

	if (usersQuery.isFetching || usersQuery.isError || !exactMatch) {
		return null;
	}

	return (
		<div className="flex flex-col gap-3 rounded-md border border-blue-500/20 bg-blue-500/5 p-3 sm:flex-row sm:items-center">
			<div className="min-w-0 flex-1">
				<p className="font-medium text-xs">Matching user account</p>
				<p className="mt-1 truncate text-sm">
					{exactMatch.name} · {exactMatch.email}
				</p>
				<UserAccountBadges user={exactMatch} />
			</div>
			<Button
				type="button"
				size="sm"
				className="shrink-0"
				onClick={() => onSelect(exactMatch)}
			>
				Link to this account
			</Button>
		</div>
	);
}

function UserAccountBadges({ user }: { user: AdminUserSummary }) {
	return (
		<div className="mt-1.5 flex flex-wrap gap-1">
			<Badge variant="secondary" className="rounded-sm px-1.5 font-normal">
				{titleCaseAffiliateValue(user.role)} ·{" "}
				{titleCaseAffiliateValue(user.plan)}
			</Badge>
			{user.banned ? (
				<Badge variant="destructive" className="rounded-sm px-1.5 font-normal">
					<AlertTriangleIcon aria-hidden="true" />
					Banned
				</Badge>
			) : null}
		</div>
	);
}

function SearchLoadingState() {
	return (
		<SearchStateMessage>
			<span className="inline-flex items-center gap-2" aria-live="polite">
				<Loader2Icon aria-hidden="true" className="size-4 animate-spin" />
				Searching user accounts…
			</span>
		</SearchStateMessage>
	);
}

function SearchStateMessage({ children }: { children: React.ReactNode }) {
	return (
		<div className="px-3 py-6 text-center text-muted-foreground text-sm">
			{children}
		</div>
	);
}

function toLinkedUser(user: AdminUserSummary): AffiliateUserIdentity {
	return {
		id: user.id,
		name: user.name,
		email: user.email,
	};
}
