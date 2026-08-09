import { Globe2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { AdminProjectDomain } from "@/features/projects/api/projects.dto";
import {
	statusBadgeVariant,
	titleCase,
} from "@/features/projects/lib/project-detail-helpers";

import { ProjectSectionEmpty } from "./project-section-empty";

type ProjectDomainsCardProps = {
	domains: AdminProjectDomain[];
};

export function ProjectDomainsCard({ domains }: ProjectDomainsCardProps) {
	return (
		<Card className="shadow-none">
			<CardHeader>
				<CardTitle>Domains</CardTitle>
				<CardDescription>
					Purchased and externally attached domains for this project.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{domains.length > 0 ? (
					<ul className="flex flex-col divide-y">
						{domains.map((domain) => (
							<li
								key={domain.id}
								className="flex min-w-0 flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
							>
								<div className="flex min-w-0 flex-1 items-center gap-3">
									<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
										<Globe2Icon aria-hidden="true" />
									</div>
									<span className="truncate font-medium text-sm">
										{domain.name}
									</span>
								</div>
								<div className="flex flex-wrap items-center gap-2 pl-12 sm:pl-0">
									<Badge variant={statusBadgeVariant(domain.status)}>
										{titleCase(domain.status)}
									</Badge>
									{domain.primary ? (
										<Badge variant="secondary">Primary</Badge>
									) : null}
								</div>
							</li>
						))}
					</ul>
				) : (
					<ProjectSectionEmpty
						icon={<Globe2Icon aria-hidden="true" />}
						title="No domains"
						description="Purchased and attached domains will appear here."
					/>
				)}
			</CardContent>
		</Card>
	);
}
