import type { AdminAnalyticsGenerationHealth } from "@wandit/contracts";

import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { formatOverviewWholeNumber } from "@/features/overview/lib/formatters";

type TopFailuresCardProps = {
	generation: AdminAnalyticsGenerationHealth[];
};

const generationLabels = {
	pages: "Pages",
	images: "Images",
	videos: "Videos",
	marketing: "Marketing",
	connectors: "Connectors",
	leadScraping: "Lead scraping",
} satisfies Record<AdminAnalyticsGenerationHealth["key"], string>;

function TopFailuresCard({ generation }: TopFailuresCardProps) {
	const groups = generation.filter((item) => item.topFailures.length > 0);

	return (
		<Card className="gap-0 py-0 shadow-none">
			<CardHeader className="border-b pt-6">
				<CardTitle>
					<h2>Top failure codes</h2>
				</CardTitle>
				<CardDescription className="mt-1">
					Bounded codes reported by generation sources
				</CardDescription>
			</CardHeader>

			<CardContent className="py-2">
				{groups.length === 0 ? (
					<p className="py-6 text-muted-foreground text-sm leading-relaxed">
						No failure codes were recorded in this range. Page failure codes
						will appear here when they occur.
					</p>
				) : (
					<div className="divide-y">
						{groups.map((group) => (
							<section key={group.key} className="py-4 first:pt-3 last:pb-3">
								<h3 className="font-medium text-muted-foreground text-xs uppercase tracking-[0.12em]">
									{generationLabels[group.key]}
								</h3>
								<ul className="mt-2.5 flex flex-col gap-2.5">
									{group.topFailures.map((failure) => (
										<li
											key={failure.code}
											className="flex min-w-0 items-start justify-between gap-3"
										>
											<code className="min-w-0 break-all rounded bg-muted px-1.5 py-0.5 text-foreground text-xs tabular-nums leading-relaxed">
												{failure.code}
											</code>
											<Badge
												variant="outline"
												className="shrink-0 text-destructive tabular-nums"
											>
												{formatOverviewWholeNumber(failure.count)}
											</Badge>
										</li>
									))}
								</ul>
							</section>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export type { TopFailuresCardProps };
export { TopFailuresCard };
