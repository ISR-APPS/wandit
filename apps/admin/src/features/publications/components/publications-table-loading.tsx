import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_ROWS = Array.from({ length: 8 }, (_, index) => index);

function PublicationsTableLoading() {
	return (
		<div className="overflow-hidden rounded-xl border bg-background">
			<div className="flex h-10 items-center gap-4 border-b px-4">
				<Skeleton className="h-3 w-32" />
				<Skeleton className="h-3 w-40" />
				<Skeleton className="h-3 w-24" />
				<Skeleton className="h-3 w-28" />
				<Skeleton className="h-3 w-16" />
			</div>
			<div className="divide-y">
				{SKELETON_ROWS.map((row) => (
					<div key={row} className="flex h-16 items-center gap-4 px-4">
						<div className="w-36 space-y-2">
							<Skeleton className="h-3 w-32" />
							<Skeleton className="h-3 w-16" />
						</div>
						<Skeleton className="size-9 rounded-full" />
						<div className="w-44 space-y-2">
							<Skeleton className="h-3 w-28" />
							<Skeleton className="h-3 w-40" />
						</div>
						<Skeleton className="h-3 w-28" />
						<Skeleton className="h-3 w-36" />
						<Skeleton className="ml-auto h-5 w-20" />
					</div>
				))}
			</div>
		</div>
	);
}

export { PublicationsTableLoading };
