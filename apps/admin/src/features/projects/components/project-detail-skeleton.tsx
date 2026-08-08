import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const METRIC_KEYS = ["assets", "leads", "marketing", "website"] as const;

const SECTION_SKELETONS = [
	{ key: "website", rows: ["deployment", "versions"] },
	{ key: "variations", rows: ["one", "two", "three"] },
	{ key: "marketing", rows: ["one", "two", "three", "four"] },
	{ key: "leads", rows: ["one", "two", "three", "four", "five"] },
	{ key: "exports", rows: ["one", "two", "three", "four"] },
	{ key: "domains", rows: ["one", "two", "three"] },
	{ key: "integrations", rows: ["sheets", "connectors"] },
] as const;

export function ProjectDetailSkeleton() {
	return (
		<div
			className="flex flex-col gap-6"
			role="status"
			aria-label="Loading project details"
		>
			<Skeleton className="h-8 w-32" />
			<div className="flex flex-col justify-between gap-4 xl:flex-row">
				<div className="flex min-w-0 flex-col gap-3">
					<Skeleton className="h-8 w-80 max-w-[75vw]" />
					<Skeleton className="h-7 w-[36rem] max-w-[80vw]" />
				</div>
				<Skeleton className="h-9 w-36" />
			</div>

			<Card className="gap-0 overflow-hidden py-0 shadow-none">
				<CardContent className="grid grid-cols-1 gap-px bg-border px-0 sm:grid-cols-2 xl:grid-cols-4">
					{METRIC_KEYS.map((key) => (
						<div key={key} className="flex gap-3 bg-card p-4">
							<Skeleton className="size-9 rounded-lg" />
							<div className="flex flex-1 flex-col gap-2">
								<Skeleton className="h-3 w-24" />
								<Skeleton className="h-7 w-20" />
								<Skeleton className="h-3 w-full max-w-36" />
							</div>
						</div>
					))}
				</CardContent>
			</Card>

			<Card className="shadow-none">
				<CardHeader>
					<Skeleton className="h-5 w-24" />
					<Skeleton className="h-4 w-80 max-w-full" />
				</CardHeader>
				<CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
					{METRIC_KEYS.map((key) => (
						<Skeleton key={key} className="aspect-square w-full rounded-lg" />
					))}
				</CardContent>
			</Card>

			{SECTION_SKELETONS.map((section) => (
				<Card key={section.key} className="shadow-none">
					<CardHeader>
						<Skeleton className="h-5 w-36" />
						<Skeleton className="h-4 w-72 max-w-full" />
					</CardHeader>
					<CardContent className="flex flex-col gap-3">
						{section.rows.map((row) => (
							<Skeleton key={`${section.key}-${row}`} className="h-11 w-full" />
						))}
					</CardContent>
				</Card>
			))}
		</div>
	);
}
