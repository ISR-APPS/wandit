import { Skeleton } from "@/components/ui/skeleton";

const loadingRows = Array.from({ length: 7 }, (_, index) => `row-${index}`);
const presetSkeletonKeys = [
	"all",
	"active",
	"top",
	"due",
	"paused",
	"pending",
] as const;
const mobileMetricSkeletonKeys = [
	"visitors",
	"signups",
	"paid",
	"revenue",
] as const;
const tableHeaderSkeletonKeys = [
	"select",
	"affiliate",
	"status",
	"channel",
	"codes",
	"traffic",
	"signups",
	"conversion",
	"revenue",
	"commission",
	"actions",
] as const;
const tableCellSkeletonKeys = [
	"status",
	"channel",
	"codes",
	"traffic",
	"signups",
	"conversion",
	"revenue",
	"commission",
	"actions",
] as const;

function AffiliatesTableLoading() {
	return (
		<div className="space-y-4">
			<div className="space-y-3 rounded-xl border bg-background p-4">
				<div className="flex gap-2 overflow-hidden">
					{presetSkeletonKeys.map((key) => (
						<Skeleton key={key} className="h-8 w-24 shrink-0" />
					))}
				</div>
				<div className="flex flex-wrap gap-2">
					<Skeleton className="h-8 w-80" />
					<Skeleton className="h-8 w-24" />
					<Skeleton className="h-8 w-24" />
					<Skeleton className="h-8 w-28" />
				</div>
			</div>

			<div className="space-y-3 lg:hidden">
				{loadingRows.slice(0, 4).map((row) => (
					<div key={row} className="overflow-hidden rounded-xl border">
						<div className="flex items-center gap-3 border-b p-3">
							<Skeleton className="size-4" />
							<Skeleton className="size-10 rounded-full" />
							<div className="flex-1 space-y-2">
								<Skeleton className="h-4 w-32" />
								<Skeleton className="h-3 w-44" />
							</div>
						</div>
						<div className="grid grid-cols-2 gap-px bg-border">
							{mobileMetricSkeletonKeys.map((key) => (
								<div
									key={`${row}-${key}`}
									className="space-y-2 bg-background p-3"
								>
									<Skeleton className="h-3 w-20" />
									<Skeleton className="h-5 w-16" />
								</div>
							))}
						</div>
					</div>
				))}
			</div>

			<div className="hidden overflow-hidden rounded-xl border lg:block">
				<div className="grid h-10 grid-cols-[48px_310px_repeat(8,minmax(120px,1fr))_52px] items-center gap-3 border-b px-2">
					{tableHeaderSkeletonKeys.map((key, index) => (
						<Skeleton
							key={key}
							className={index === 0 ? "size-4" : "h-3 w-20"}
						/>
					))}
				</div>
				{loadingRows.map((row) => (
					<div
						key={row}
						className="grid min-h-16 grid-cols-[48px_310px_repeat(8,minmax(120px,1fr))_52px] items-center gap-3 border-b px-2 last:border-b-0"
					>
						<Skeleton className="size-4" />
						<div className="flex items-center gap-3">
							<Skeleton className="size-10 rounded-full" />
							<div className="space-y-2">
								<Skeleton className="h-4 w-28" />
								<Skeleton className="h-3 w-40" />
							</div>
						</div>
						{tableCellSkeletonKeys.map((key) => (
							<Skeleton key={`${row}-${key}`} className="h-5 w-20" />
						))}
					</div>
				))}
			</div>
		</div>
	);
}

export { AffiliatesTableLoading };
