import { Skeleton } from "@/components/ui/skeleton";

const metricKeys = ["clicks", "visitors", "active", "all-time"] as const;
const tableRowKeys = ["one", "two", "three", "four", "five"] as const;

function StoryLinksPageSkeleton() {
	return (
		<div
			role="status"
			aria-busy="true"
			aria-label="Loading links"
			className="flex flex-col gap-5"
		>
			<div className="overflow-hidden rounded-xl border bg-background">
				<div className="-mr-px -mb-px grid @[960px]/main:grid-cols-4 grid-cols-1 sm:grid-cols-2">
					{metricKeys.map((key) => (
						<div
							key={key}
							className="flex min-w-[200px] items-start gap-3 border-r border-b px-5 py-5"
						>
							<Skeleton className="size-8 shrink-0" />
							<div className="w-full">
								<Skeleton className="h-3 w-28" />
								<Skeleton className="mt-2 h-6 w-20" />
								<Skeleton className="mt-2 h-3 w-24" />
							</div>
						</div>
					))}
				</div>
			</div>

			<div className="overflow-hidden rounded-xl border bg-background">
				<div className="flex flex-col gap-2 border-b p-6">
					<Skeleton className="h-4 w-28" />
					<Skeleton className="h-3 w-72 max-w-full" />
				</div>
				<div className="flex flex-col gap-4 p-6">
					{tableRowKeys.map((key) => (
						<Skeleton key={key} className="h-11 w-full" />
					))}
				</div>
			</div>

			<div className="overflow-hidden rounded-xl border bg-background">
				<div className="flex flex-col gap-2 border-b p-6">
					<Skeleton className="h-4 w-32" />
					<Skeleton className="h-3 w-64 max-w-full" />
				</div>
				<div className="p-6">
					<Skeleton className="h-[310px] w-full" />
				</div>
			</div>
		</div>
	);
}

export { StoryLinksPageSkeleton };
