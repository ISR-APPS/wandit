import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const SETTINGS_SKELETON_ROWS = [
	"organizations",
	"signup-grant",
	"subscriptions",
	"topups",
	"grant-amount",
] as const;

export function SettingsPageSkeleton() {
	return (
		<div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
			<div className="flex flex-col gap-3">
				<Skeleton className="h-8 w-56" />
				<Skeleton className="h-4 w-full max-w-xl" />
				<Skeleton className="h-5 w-72" />
			</div>

			<div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.75fr)]">
				<Card className="gap-0 py-0 shadow-none">
					<CardHeader className="border-b py-6">
						<Skeleton className="h-5 w-44" />
						<Skeleton className="h-4 w-full max-w-lg" />
					</CardHeader>
					<CardContent className="flex flex-col gap-0 px-0">
						{SETTINGS_SKELETON_ROWS.map((row) => (
							<div
								key={row}
								className="flex items-center justify-between gap-6 border-b px-5 py-5 last:border-b-0"
							>
								<div className="flex min-w-0 flex-1 flex-col gap-2">
									<Skeleton className="h-4 w-40" />
									<Skeleton className="h-3.5 w-full max-w-md" />
								</div>
								<Skeleton className="h-5 w-8 rounded-full" />
							</div>
						))}
					</CardContent>
				</Card>

				<Card className="shadow-none">
					<CardHeader>
						<Skeleton className="h-5 w-28" />
						<Skeleton className="h-4 w-full" />
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-9 w-full" />
						<Skeleton className="h-9 w-40" />
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
