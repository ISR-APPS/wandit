import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const metricKeys = [
	"one",
	"two",
	"three",
	"four",
	"five",
	"six",
	"seven",
] as const;
const tableRowKeys = ["one", "two", "three", "four", "five"] as const;

type AnalyticsPageSkeletonProps = {
	metricCount?: 4 | 6 | 7;
};

function AnalyticsPageSkeleton({
	metricCount = 6,
}: AnalyticsPageSkeletonProps) {
	return (
		<div
			role="status"
			aria-busy="true"
			aria-label="Loading analytics"
			className="flex flex-col gap-5"
		>
			<div className="overflow-hidden rounded-xl border bg-background">
				<div
					className={cn(
						"-mr-px -mb-px grid grid-cols-1 sm:grid-cols-2",
						metricCount === 6
							? "@[960px]/main:grid-cols-3"
							: "@[960px]/main:grid-cols-4",
					)}
				>
					{metricKeys.slice(0, metricCount).map((key) => (
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
									<Skeleton className="h-3 w-28 max-w-full" />
									<Skeleton className="h-3 w-20 max-w-full" />
								</div>
							</div>
						</div>
					))}
				</div>
			</div>

			<div className="grid gap-5 lg:grid-cols-12">
				<div className="overflow-hidden rounded-xl border bg-background lg:col-span-8">
					<div className="flex flex-col gap-2 border-b p-6">
						<Skeleton className="h-4 w-40" />
						<Skeleton className="h-3 w-64" />
					</div>
					<div className="p-6">
						<Skeleton className="h-[310px] w-full" />
					</div>
				</div>
				<div className="rounded-xl border bg-background p-6 lg:col-span-4">
					<Skeleton className="h-4 w-32" />
					<Skeleton className="mt-2 h-3 w-52" />
					<Skeleton className="mt-7 h-12 w-36" />
					<div className="mt-6 flex flex-col gap-4">
						{tableRowKeys.slice(0, 4).map((key) => (
							<Skeleton key={key} className="h-10 w-full" />
						))}
					</div>
				</div>
			</div>

			<div className="overflow-hidden rounded-xl border bg-background">
				<div className="flex flex-col gap-2 border-b p-6">
					<Skeleton className="h-4 w-44" />
					<Skeleton className="h-3 w-72 max-w-full" />
				</div>
				<div className="flex flex-col gap-4 p-6">
					{tableRowKeys.map((key) => (
						<Skeleton key={key} className="h-11 w-full" />
					))}
				</div>
			</div>
		</div>
	);
}

export type { AnalyticsPageSkeletonProps };
export { AnalyticsPageSkeleton };
