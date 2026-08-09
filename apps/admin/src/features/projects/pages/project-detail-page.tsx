import { Link } from "@tanstack/react-router";
import { AlertCircleIcon, ArrowLeftIcon, FolderSearchIcon } from "lucide-react";
import type { PropsWithChildren } from "react";

import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { useAdminProjectQuery } from "@/features/projects/api/projects.queries";
import { ProjectAssetsCard } from "@/features/projects/components/project-assets-card";
import { ProjectDetailHeader } from "@/features/projects/components/project-detail-header";
import { ProjectDetailSkeleton } from "@/features/projects/components/project-detail-skeleton";
import { ProjectDomainsCard } from "@/features/projects/components/project-domains-card";
import { ProjectIntegrationsCard } from "@/features/projects/components/project-integrations-card";
import { ProjectLandingPageVariationsCard } from "@/features/projects/components/project-landing-page-variations-card";
import { ProjectLeadExportsCard } from "@/features/projects/components/project-lead-exports-card";
import { ProjectLeadsCard } from "@/features/projects/components/project-leads-card";
import { ProjectMarketingAssetsCard } from "@/features/projects/components/project-marketing-assets-card";
import { ProjectMetrics } from "@/features/projects/components/project-metrics";
import { ProjectWebsiteCard } from "@/features/projects/components/project-website-card";
import { isApiClientError } from "@/lib/api-client";

type ProjectDetailPageProps = {
	projectId: string;
	userId: string;
};

export function ProjectDetailPage({
	projectId,
	userId,
}: ProjectDetailPageProps) {
	const projectQuery = useAdminProjectQuery(projectId);

	if (projectQuery.isLoading) {
		return (
			<ProjectDetailContainer>
				<ProjectDetailSkeleton />
			</ProjectDetailContainer>
		);
	}

	if (projectQuery.isError) {
		const isMissing =
			isApiClientError(projectQuery.error) && projectQuery.error.status === 404;

		if (isMissing) {
			return (
				<ProjectDetailContainer>
					<MissingProjectState userId={userId} />
				</ProjectDetailContainer>
			);
		}

		return (
			<ProjectDetailContainer>
				<Empty className="min-h-(--content-full-height) border bg-background">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<AlertCircleIcon aria-hidden="true" />
						</EmptyMedia>
						<EmptyTitle>Could not load this project</EmptyTitle>
						<EmptyDescription>
							The project record could not be read. Try the request again.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button type="button" onClick={() => projectQuery.refetch()}>
							Try again
						</Button>
						<Button asChild variant="outline">
							<Link to="/users/$userId" params={{ userId }}>
								<ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
								Back to user
							</Link>
						</Button>
					</EmptyContent>
				</Empty>
			</ProjectDetailContainer>
		);
	}

	if (!projectQuery.data) {
		return (
			<ProjectDetailContainer>
				<MissingProjectState userId={userId} />
			</ProjectDetailContainer>
		);
	}

	const detail = projectQuery.data;

	return (
		<ProjectDetailContainer>
			<ProjectDetailHeader detail={detail} />
			<ProjectMetrics detail={detail} />
			<ProjectAssetsCard assets={detail.assets} />
			<ProjectWebsiteCard website={detail.website} />
			<ProjectLandingPageVariationsCard
				projectId={detail.project.id}
				projectName={detail.project.name}
				liveUrl={detail.website.currentDeployment.liveUrl}
			/>
			<ProjectMarketingAssetsCard assets={detail.marketingAssets} />
			<ProjectLeadsCard leads={detail.leads} />
			<ProjectLeadExportsCard exports={detail.leadScrapeExports} />
			<ProjectDomainsCard domains={detail.domains} />
			<ProjectIntegrationsCard sheets={detail.integrations.sheets} />
		</ProjectDetailContainer>
	);
}

function ProjectDetailContainer({ children }: PropsWithChildren) {
	return (
		<div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
			{children}
		</div>
	);
}

function MissingProjectState({ userId }: { userId: string }) {
	return (
		<Empty className="min-h-(--content-full-height) border bg-background">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<FolderSearchIcon aria-hidden="true" />
				</EmptyMedia>
				<EmptyTitle>Project not found</EmptyTitle>
				<EmptyDescription>
					This project may have been removed, or the project ID is incorrect.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button asChild>
					<Link to="/users/$userId" params={{ userId }}>
						<ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
						Back to user
					</Link>
				</Button>
			</EmptyContent>
		</Empty>
	);
}
