import { Link } from "@tanstack/react-router";
import {
	ArrowLeftIcon,
	CalendarDaysIcon,
	CopyIcon,
	ExternalLinkIcon,
	UserRoundIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AdminProjectDetail } from "@/features/projects/api/projects.dto";
import { formatProjectDate } from "@/features/projects/lib/project-detail-helpers";

type ProjectDetailHeaderProps = {
	detail: AdminProjectDetail;
};

function copyProjectId(projectId: string) {
	void navigator.clipboard.writeText(projectId).catch(() => undefined);
}

export function ProjectDetailHeader({ detail }: ProjectDetailHeaderProps) {
	const { owner, project, website } = detail;
	const liveUrl = website.currentDeployment.liveUrl;

	return (
		<header className="flex flex-col gap-5">
			<Button asChild variant="ghost" size="sm" className="w-fit">
				<Link to="/users/$userId" params={{ userId: owner.id }}>
					<ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
					Back to user
				</Link>
			</Button>

			<div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
				<div className="min-w-0">
					<h1 className="truncate font-semibold text-2xl tracking-tight">
						{project.name}
					</h1>
					<div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground text-sm">
						<Button
							type="button"
							variant="ghost"
							size="xs"
							onClick={() => copyProjectId(project.id)}
							title="Copy project ID"
							aria-label={`Copy project ID ${project.id}`}
							className="max-w-full font-mono text-muted-foreground"
						>
							<CopyIcon aria-hidden="true" />
							<span className="truncate">{project.id}</span>
						</Button>
						<Link
							to="/users/$userId"
							params={{ userId: owner.id }}
							className="flex min-w-0 max-w-full items-center gap-2 rounded-sm outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
						>
							<UserRoundIcon className="size-4 shrink-0" aria-hidden="true" />
							<span className="min-w-0 truncate">
								<span className="font-medium text-foreground">
									{owner.name}
								</span>
								<span className="ml-1">({owner.email})</span>
							</span>
						</Link>
						<span className="flex items-center gap-2">
							<CalendarDaysIcon className="size-4" aria-hidden="true" />
							Created {formatProjectDate(project.createdAt)}
						</span>
					</div>
				</div>

				{liveUrl ? (
					<Button asChild>
						<a href={liveUrl} target="_blank" rel="noreferrer">
							<ExternalLinkIcon data-icon="inline-start" aria-hidden="true" />
							Open live site
						</a>
					</Button>
				) : null}
			</div>
		</header>
	);
}
