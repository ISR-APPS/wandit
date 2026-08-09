import { Globe2Icon, ImagesIcon, MegaphoneIcon, UsersIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { AdminProjectDetail } from "@/features/projects/api/projects.dto";
import {
	formatWholeNumber,
	titleCase,
} from "@/features/projects/lib/project-detail-helpers";

type ProjectMetricsProps = {
	detail: AdminProjectDetail;
};

export function ProjectMetrics({ detail }: ProjectMetricsProps) {
	const metrics = [
		{
			label: "Assets",
			value: formatWholeNumber(detail.assets.length),
			detail: "Images, videos, and build files",
			icon: ImagesIcon,
		},
		{
			label: "Leads",
			value: formatWholeNumber(detail.leads.total),
			detail: `${formatWholeNumber(detail.leads.recent.length)} recent records loaded`,
			icon: UsersIcon,
		},
		{
			label: "Marketing assets",
			value: formatWholeNumber(detail.marketingAssets.length),
			detail: "Generated deliverables",
			icon: MegaphoneIcon,
		},
		{
			label: "Website",
			value: titleCase(detail.website.currentDeployment.status),
			detail:
				detail.website.activeVersionNumber === null
					? "No active version"
					: `Active version ${detail.website.activeVersionNumber}`,
			icon: Globe2Icon,
		},
	] as const;

	return (
		<Card className="gap-0 overflow-hidden py-0 shadow-none">
			<CardContent className="grid grid-cols-1 gap-px bg-border px-0 sm:grid-cols-2 xl:grid-cols-4">
				{metrics.map((metric) => {
					const Icon = metric.icon;

					return (
						<div
							key={metric.label}
							className="flex min-w-0 items-start gap-3 bg-card p-4"
						>
							<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
								<Icon aria-hidden="true" />
							</div>
							<dl className="min-w-0">
								<dt className="truncate text-muted-foreground text-xs">
									{metric.label}
								</dt>
								<dd
									className="mt-1 truncate font-semibold text-2xl tabular-nums tracking-tight"
									title={metric.value}
								>
									{metric.value}
								</dd>
								<dd className="mt-1 truncate text-muted-foreground text-xs">
									{metric.detail}
								</dd>
							</dl>
						</div>
					);
				})}
			</CardContent>
		</Card>
	);
}
