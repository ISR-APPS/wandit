import { RefreshCwIcon, UsersRoundIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import type {
	AdminListUsersSort,
	UserCreditsUsedRange,
	UserPlanFilter,
	UserRoleFilter,
	UserStatusFilter,
	UserVerifiedFilter,
} from "@/features/users/api/users.dto";
import { useUsersQuery } from "@/features/users/api/users.queries";
import { UsersDataTable } from "@/features/users/components/table/users-data-table";
import { UsersTableLoading } from "@/features/users/components/table/users-table-loading";
import { USER_TABLE_DEFAULT_PAGE_SIZE } from "@/features/users/lib/constants";
import { exportUsersToExcel } from "@/features/users/lib/users-export";

const SEARCH_DEBOUNCE_MS = 300;

function UsersPage() {
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(USER_TABLE_DEFAULT_PAGE_SIZE);
	const [sort, setSort] = useState<AdminListUsersSort>("newest");
	const [plan, setPlan] = useState<UserPlanFilter>();
	const [role, setRole] = useState<UserRoleFilter>();
	const [status, setStatus] = useState<UserStatusFilter>();
	const [verified, setVerified] = useState<UserVerifiedFilter>();
	const [creditsUsed, setCreditsUsed] = useState<UserCreditsUsedRange>();
	const [searchValue, setSearchValue] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [isExporting, setIsExporting] = useState(false);

	useEffect(() => {
		const handle = setTimeout(() => {
			setDebouncedQuery(searchValue.trim());
		}, SEARCH_DEBOUNCE_MS);

		return () => clearTimeout(handle);
	}, [searchValue]);

	// New search text, sort, filters, or page size restart from the first page.
	// biome-ignore lint/correctness/useExhaustiveDependencies: page reset is intentional
	useEffect(() => {
		setPage(1);
	}, [
		debouncedQuery,
		sort,
		pageSize,
		plan,
		role,
		status,
		verified,
		creditsUsed,
	]);

	const usersQuery = useUsersQuery({
		page,
		pageSize,
		sort,
		q: debouncedQuery || undefined,
		plan,
		role,
		status,
		verified,
		creditsUsedMin: creditsUsed?.min,
		creditsUsedMax: creditsUsed?.max,
	});

	const result = usersQuery.data;
	const hasActiveFilters = Boolean(
		plan?.length ||
			role?.length ||
			status?.length ||
			verified?.length ||
			creditsUsed,
	);
	const isEmptyDirectory =
		result !== undefined &&
		result.total === 0 &&
		!usersQuery.isFetching &&
		debouncedQuery.length === 0 &&
		!hasActiveFilters;
	const clearAllFilters = () => {
		setSearchValue("");
		setPlan(undefined);
		setRole(undefined);
		setStatus(undefined);
		setVerified(undefined);
		setCreditsUsed(undefined);
	};
	const handleExport = async () => {
		if (isExporting) {
			return;
		}

		setIsExporting(true);
		try {
			await exportUsersToExcel({
				q: debouncedQuery || undefined,
				sort,
				plan,
				role,
				status,
				verified,
				creditsUsedMin: creditsUsed?.min,
				creditsUsedMax: creditsUsed?.max,
			});
		} catch {
			toast.error("Users could not be exported");
		} finally {
			setIsExporting(false);
		}
	};

	return (
		<div className="mx-auto w-full max-w-[1600px] space-y-5">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div className="min-w-0">
					<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
						Access & billing
					</p>
					<h1 className="mt-1 font-semibold text-2xl tracking-tight">Users</h1>
					<p className="mt-1 max-w-2xl text-muted-foreground text-sm">
						Inspect every account, subscription, credit balance, and project
						from one operational view.
					</p>
				</div>
			</div>

			{/* Stale rows stay on screen so the search, filter, and sort controls — which live
			    in the table toolbar — remain available to undo the failing params. */}
			{usersQuery.isError && result ? (
				<div
					role="alert"
					className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-destructive text-sm"
				>
					<span>
						These results could not be refreshed and may be out of date.
					</span>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => void usersQuery.refetch()}
					>
						<RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
						Retry
					</Button>
				</div>
			) : null}

			{usersQuery.isPending ? (
				<UsersTableLoading />
			) : usersQuery.isError && !result ? (
				<Empty className="min-h-[420px] border bg-background">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<UsersRoundIcon />
						</EmptyMedia>
						<EmptyTitle>Users could not be loaded</EmptyTitle>
						<EmptyDescription>
							The server did not respond. Retry the request to restore the
							table.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button type="button" onClick={() => void usersQuery.refetch()}>
							<RefreshCwIcon data-icon="inline-start" />
							Retry
						</Button>
					</EmptyContent>
				</Empty>
			) : isEmptyDirectory ? (
				<Empty className="min-h-[420px] border bg-background">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<UsersRoundIcon />
						</EmptyMedia>
						<EmptyTitle>No users yet</EmptyTitle>
						<EmptyDescription>
							Accounts will appear here as soon as people sign up for Wandit.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : result ? (
				<UsersDataTable
					data={result.items}
					page={page}
					pageSize={pageSize}
					total={result.total}
					sort={sort}
					plan={plan}
					role={role}
					status={status}
					verified={verified}
					creditsUsed={creditsUsed}
					searchValue={searchValue}
					isFetching={usersQuery.isFetching}
					isExporting={isExporting}
					onSearchChange={setSearchValue}
					onSortChange={setSort}
					onPlanChange={setPlan}
					onRoleChange={setRole}
					onStatusChange={setStatus}
					onVerifiedChange={setVerified}
					onCreditsUsedChange={setCreditsUsed}
					onClearAllFilters={clearAllFilters}
					onExport={() => void handleExport()}
					onPageChange={setPage}
					onPageSizeChange={setPageSize}
				/>
			) : null}
		</div>
	);
}

export { UsersPage };
