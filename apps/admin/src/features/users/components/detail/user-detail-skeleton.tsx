import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const METRIC_SKELETON_KEYS = [
	"credit-balance",
	"credits-used",
	"projects",
	"plan",
	"ai-spend",
] as const;

const SUBSCRIPTION_ROWS = [
	"plan",
	"status",
	"provider",
	"amount",
	"renewal",
	"cost",
] as const;

const ACTIVITY_ROWS = ["row-1", "row-2", "row-3", "row-4", "row-5"] as const;

export function UserDetailSkeleton() {
	return (
		<div
			className="flex flex-col gap-6"
			role="status"
			aria-label="Loading user details"
		>
			<Skeleton className="h-8 w-28" />
			<div className="flex flex-col justify-between gap-4 xl:flex-row">
				<div className="flex items-center gap-4">
					<Skeleton className="size-12 rounded-full" />
					<div className="flex flex-col gap-2">
						<Skeleton className="h-7 w-48" />
						<Skeleton className="h-4 w-64 max-w-[70vw]" />
						<Skeleton className="h-6 w-52" />
					</div>
				</div>
				<Skeleton className="h-9 w-80 max-w-full" />
			</div>
			<Card className="py-0 shadow-none">
				<CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5">
					{METRIC_SKELETON_KEYS.map((key) => (
						<div
							key={key}
							className="flex flex-col gap-2 sm:last:col-span-2 lg:last:col-span-1"
						>
							<Skeleton className="h-3 w-24" />
							<Skeleton className="h-8 w-20" />
							<Skeleton className="h-3 w-28" />
						</div>
					))}
				</CardContent>
			</Card>
			<Card className="shadow-none">
				<CardHeader>
					<Skeleton className="h-5 w-32" />
					<Skeleton className="h-4 w-52" />
				</CardHeader>
				<CardContent className="grid grid-cols-2 gap-4">
					{SUBSCRIPTION_ROWS.map((row) => (
						<Skeleton key={row} className="h-10 w-full" />
					))}
				</CardContent>
			</Card>
			<Card className="shadow-none">
				<CardHeader className="gap-4">
					<div className="space-y-2">
						<Skeleton className="h-5 w-24" />
						<Skeleton className="h-4 w-64" />
					</div>
					<Skeleton className="h-9 w-72 max-w-full" />
				</CardHeader>
				<CardContent className="flex flex-col gap-3">
					{ACTIVITY_ROWS.map((row) => (
						<Skeleton key={row} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}
