import { Skeleton } from "@/components/ui/skeleton";

const metricSkeletonKeys = [
	"revenue",
	"mrr",
	"tokens",
	"websites",
	"signups",
	"users",
	"healthy-trials",
	"images",
] as const;

function OverviewPageSkeleton() {
	return (
		<div
			role="status"
			aria-busy="true"
			aria-label="Loading overview"
			className="space-y-5"
		>
			<div className="overflow-hidden rounded-xl border bg-background">
				<div className="-mr-px -mb-px grid @[960px]/main:grid-cols-4 grid-cols-1 sm:grid-cols-2">
					{metricSkeletonKeys.map((key) => (
						<div
							key={key}
							className="flex min-w-[200px] items-start gap-3 border-r border-b px-5 py-5"
						>
							<Skeleton className="size-8 shrink-0" />
							<div className="w-full">
								<Skeleton className="h-3 w-20" />
								<div className="mt-1.5 flex min-h-7 items-center justify-between gap-2">
									<Skeleton className="h-6 w-24" />
									<Skeleton className="h-4 w-12 rounded-full" />
								</div>
								<div className="mt-1.5 space-y-1.5">
									<Skeleton className="h-3 w-32 max-w-full" />
									<Skeleton className="h-3 w-20 max-w-full" />
								</div>
							</div>
						</div>
					))}
				</div>
			</div>

			<div className="grid gap-5 xl:grid-cols-12">
				<div className="overflow-hidden rounded-xl border bg-background xl:col-span-8">
					<div className="space-y-3 border-b p-6">
						<Skeleton className="h-4 w-36" />
						<Skeleton className="h-3 w-56" />
						<Skeleton className="h-8 w-32" />
					</div>
					<div className="p-6">
						<Skeleton className="h-[310px] w-full" />
					</div>
				</div>
				<div className="rounded-xl border bg-background p-6 xl:col-span-4">
					<Skeleton className="h-4 w-24" />
					<Skeleton className="mt-2 h-3 w-52" />
					<Skeleton className="mx-auto mt-7 size-[210px] rounded-full" />
					<div className="mt-5 space-y-3">
						{metricSkeletonKeys.slice(0, 4).map((key) => (
							<Skeleton key={key} className="h-14 w-full" />
						))}
					</div>
				</div>
			</div>

			<div className="grid gap-5 xl:grid-cols-12">
				<div className="overflow-hidden rounded-xl border bg-background xl:col-span-7">
					<div className="space-y-2 border-b p-6">
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-3 w-64" />
					</div>
					<div className="p-6">
						<div className="mb-5 flex gap-8">
							<Skeleton className="h-12 w-28" />
							<Skeleton className="h-12 w-28" />
						</div>
						<Skeleton className="h-[290px] w-full" />
					</div>
					<Skeleton className="h-16 w-full rounded-none border-t" />
				</div>
				<div className="rounded-xl border bg-background p-6 xl:col-span-5">
					<div className="flex justify-between gap-4">
						<div className="space-y-2">
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-3 w-56" />
						</div>
						<Skeleton className="h-5 w-24 rounded-full" />
					</div>
					<Skeleton className="mt-6 h-14 w-full" />
					<Skeleton className="mt-5 h-[82px] w-full" />
					<Skeleton className="mt-5 h-28 w-full" />
					<div className="mt-5 space-y-3 border-t pt-5">
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
					</div>
				</div>
			</div>
		</div>
	);
}

export { OverviewPageSkeleton };
