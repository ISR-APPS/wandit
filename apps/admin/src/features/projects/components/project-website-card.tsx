import { ExternalLinkIcon, Globe2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { AdminProjectWebsite } from "@/features/projects/api/projects.dto";
import {
	formatWholeNumber,
	statusBadgeVariant,
	titleCase,
} from "@/features/projects/lib/project-detail-helpers";

type ProjectWebsiteCardProps = {
	website: AdminProjectWebsite;
};

export function ProjectWebsiteCard({ website }: ProjectWebsiteCardProps) {
	const deployment = website.currentDeployment;

	const facts: {
		label: string;
		status?: string;
		value: string;
	}[] = [
		{
			label: "Active version",
			value:
				website.activeVersionNumber === null
					? "None"
					: `v${website.activeVersionNumber}`,
		},
		{
			label: "Total versions",
			value: formatWholeNumber(website.versionsCount),
		},
		{
			label: "Latest generation",
			value: website.latestAttemptStatus
				? titleCase(website.latestAttemptStatus)
				: "No attempt",
			status: website.latestAttemptStatus ?? undefined,
		},
		{
			label: "Deployment history",
			value: formatWholeNumber(website.deploymentHistoryCount),
		},
	] as const;

	return (
		<Card className="shadow-none">
			<CardHeader>
				<CardTitle>Website</CardTitle>
				<CardDescription>
					Current generation, version, and deployment state.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex min-w-0 items-start gap-3">
						<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
							<Globe2Icon aria-hidden="true" />
						</div>
						<div className="min-w-0">
							<div className="flex flex-wrap items-center gap-2">
								<p className="font-medium text-sm">Current deployment</p>
								<Badge variant={statusBadgeVariant(deployment.status)}>
									{titleCase(deployment.status)}
								</Badge>
							</div>
							<p
								className="mt-1 truncate font-mono text-muted-foreground text-xs"
								title={deployment.slug ?? undefined}
							>
								{deployment.slug ?? "No deployment slug"}
							</p>
						</div>
					</div>
					{deployment.liveUrl ? (
						<Button asChild variant="outline" size="sm">
							<a href={deployment.liveUrl} target="_blank" rel="noreferrer">
								<ExternalLinkIcon data-icon="inline-start" aria-hidden="true" />
								Open site
							</a>
						</Button>
					) : null}
				</div>

				<div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 xl:grid-cols-4">
					{facts.map((fact) => (
						<dl key={fact.label} className="min-w-0 bg-card p-4">
							<dt className="text-muted-foreground text-xs">{fact.label}</dt>
							<dd className="mt-1">
								{fact.status ? (
									<Badge variant={statusBadgeVariant(fact.status)}>
										{fact.value}
									</Badge>
								) : (
									<span className="block truncate font-semibold text-lg tabular-nums">
										{fact.value}
									</span>
								)}
							</dd>
						</dl>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
