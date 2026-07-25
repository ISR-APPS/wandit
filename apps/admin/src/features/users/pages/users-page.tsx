import { DownloadIcon, RefreshCwIcon, UsersRoundIcon } from "lucide-react";
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
import { useUsersQuery } from "@/features/users/api/users.queries";
import { UsersDataTable } from "@/features/users/components/table/users-data-table";
import { UsersTableLoading } from "@/features/users/components/table/users-table-loading";
import {
	UsersSummaryStrip,
	UsersSummaryStripSkeleton,
} from "@/features/users/components/users-summary-strip";

function UsersPage() {
	const { data: users = [], isError, isPending, refetch } = useUsersQuery();

	return (
		<div className="mx-auto w-full max-w-[1600px] space-y-5">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div className="min-w-0">
					<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
						Access & billing
					</p>
					<h1 className="mt-1 font-semibold text-2xl tracking-tight">Users</h1>
					<p className="mt-1 max-w-2xl text-muted-foreground text-sm">
						Inspect every account, subscription, credit balance, and usage
						signal from one operational view.
					</p>
				</div>
				<Button
					type="button"
					variant="outline"
					onClick={() =>
						toast.success(
							`${users.length.toLocaleString()} users prepared for export`,
						)
					}
					disabled={isPending || users.length === 0}
				>
					<DownloadIcon data-icon="inline-start" />
					Export directory
				</Button>
			</div>

			{isPending ? (
				<>
					<UsersSummaryStripSkeleton />
					<UsersTableLoading />
				</>
			) : isError ? (
				<Empty className="min-h-[420px] border bg-background">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<UsersRoundIcon />
						</EmptyMedia>
						<EmptyTitle>Users could not be loaded</EmptyTitle>
						<EmptyDescription>
							The mock directory did not respond. Retry the request to restore
							the table.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button type="button" onClick={() => void refetch()}>
							<RefreshCwIcon data-icon="inline-start" />
							Retry
						</Button>
					</EmptyContent>
				</Empty>
			) : (
				<>
					<UsersSummaryStrip users={users} />
					<UsersDataTable data={users} />
				</>
			)}
		</div>
	);
}

export { UsersPage };
