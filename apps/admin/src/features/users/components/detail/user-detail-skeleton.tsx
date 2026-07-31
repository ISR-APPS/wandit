import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const METRIC_SKELETON_KEYS = [
	"credits",
	"tokens",
	"websites",
	"assets",
] as const;

const DETAIL_SKELETONS = [
	{
		key: "account",
		rows: ["role", "email", "country", "locale", "signup", "activity"],
	},
	{
		key: "subscription",
		rows: ["plan", "status", "provider", "amount", "renewal", "cost"],
	},
] as const;

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
				<CardContent className="grid grid-cols-2 gap-4 p-4 xl:grid-cols-4">
					{METRIC_SKELETON_KEYS.map((key) => (
						<div key={key} className="flex flex-col gap-2">
							<Skeleton className="h-3 w-24" />
							<Skeleton className="h-8 w-20" />
							<Skeleton className="h-3 w-28" />
						</div>
					))}
				</CardContent>
			</Card>
			<Skeleton className="h-9 w-96 max-w-full" />
			<div className="grid gap-6 xl:grid-cols-2">
				{DETAIL_SKELETONS.map((section) => (
					<Card key={section.key} className="shadow-none">
						<CardHeader>
							<Skeleton className="h-5 w-32" />
							<Skeleton className="h-4 w-52" />
						</CardHeader>
						<CardContent className="grid grid-cols-2 gap-4">
							{section.rows.map((row) => (
								<Skeleton key={row} className="h-10 w-full" />
							))}
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}
