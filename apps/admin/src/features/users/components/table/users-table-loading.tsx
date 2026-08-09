import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_ROWS = Array.from({ length: 8 }, (_, index) => index);
const SKELETON_FILTERS = [
	"saved-view",
	"role",
	"plan",
	"provider",
	"subscription",
	"account",
] as const;

function UsersTableLoading() {
	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-3 rounded-xl border bg-background p-4">
				<div className="flex gap-2 overflow-hidden">
					{SKELETON_FILTERS.map((filter) => (
						<Skeleton key={filter} className="h-8 w-24 shrink-0" />
					))}
				</div>
				<div className="flex items-center gap-2">
					<Skeleton className="h-8 w-64 max-w-full" />
					<Skeleton className="h-8 w-24" />
					<Skeleton className="h-8 w-24" />
				</div>
			</div>
			<div className="overflow-hidden rounded-xl border bg-background">
				<div className="flex h-10 items-center gap-4 border-b px-4">
					<Skeleton className="size-4" />
					<Skeleton className="h-3 w-40" />
					<Skeleton className="h-3 w-16" />
					<Skeleton className="h-3 w-16" />
					<Skeleton className="h-3 w-24" />
				</div>
				<div className="divide-y">
					{SKELETON_ROWS.map((row) => (
						<div key={row} className="flex h-16 items-center gap-4 px-4">
							<Skeleton className="size-4" />
							<Skeleton className="size-9 rounded-full" />
							<div className="w-44 space-y-2">
								<Skeleton className="h-3 w-28" />
								<Skeleton className="h-3 w-40" />
							</div>
							<Skeleton className="h-5 w-16" />
							<Skeleton className="h-5 w-14" />
							<Skeleton className="h-3 w-24" />
							<Skeleton className="ml-auto h-8 w-8" />
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

export { UsersTableLoading };
