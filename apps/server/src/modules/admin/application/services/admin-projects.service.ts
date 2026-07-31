import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { AdminProjectDetail } from "@wandit/contracts";

import { DomainsService } from "../../../domains/application/services/domains.service";
import { LeadScrapesService } from "../../../lead-scrapes/application/services/lead-scrapes.service";
import { LeadSheetSyncService } from "../../../leads/application/services/lead-sheet-sync.service";
import { LeadsService } from "../../../leads/application/services/leads.service";
import { MarketingAssetsService } from "../../../marketing-assets/application/services/marketing-assets.service";
import { PagesService } from "../../../pages/application/services/pages.service";
import { ProjectAssetsService } from "../../../project-assets/application/services/project-assets.service";
import { SitesService } from "../../../sites/application/services/sites.service";
import { AdminRepository } from "../../infrastructure/persistence/admin.repository";

const RECENT_LEADS_LIMIT = 50;

@Injectable()
export class AdminProjectsService {
	constructor(
		@Inject(AdminRepository)
		private readonly adminRepository: AdminRepository,
		@Inject(ProjectAssetsService)
		private readonly projectAssetsService: ProjectAssetsService,
		@Inject(PagesService)
		private readonly pagesService: PagesService,
		@Inject(SitesService)
		private readonly sitesService: SitesService,
		@Inject(MarketingAssetsService)
		private readonly marketingAssetsService: MarketingAssetsService,
		@Inject(LeadsService)
		private readonly leadsService: LeadsService,
		@Inject(LeadScrapesService)
		private readonly leadScrapesService: LeadScrapesService,
		@Inject(LeadSheetSyncService)
		private readonly leadSheetSyncService: LeadSheetSyncService,
		@Inject(DomainsService)
		private readonly domainsService: DomainsService,
	) {}

	async getProjectDetail(projectId: string): Promise<AdminProjectDetail> {
		// Resolve the live project and its owner before calling any owner-scoped
		// service. The acting admin's id must never be used for these reads.
		const project = await this.adminRepository.findProjectDetail(projectId);

		if (!project) {
			throw new NotFoundException();
		}

		const ownerId = project.ownerId;
		const [
			projectAssets,
			pageOverview,
			pageVersions,
			currentDeployment,
			deploymentHistory,
			marketingAssets,
			leads,
			leadsTotal,
			leadScrapeExports,
			leadScrapeExportsTotal,
			domains,
			sheets,
		] = await Promise.all([
			this.sectionOrNull(() =>
				this.projectAssetsService.listAssets(ownerId, projectId),
			),
			this.sectionOrNull(() => this.pagesService.overview(ownerId, projectId)),
			this.sectionOrNull(() =>
				this.pagesService.listVersions(ownerId, projectId),
			),
			this.sectionOrNull(() => this.sitesService.current(ownerId, projectId)),
			this.sectionOrNull(() => this.sitesService.list(ownerId, projectId)),
			this.sectionOrNull(() =>
				this.marketingAssetsService.list(ownerId, projectId),
			),
			this.sectionOrNull(() =>
				this.leadsService.list(ownerId, projectId, RECENT_LEADS_LIMIT),
			),
			this.sectionOrNull(() =>
				this.leadsService.countByProject(ownerId, projectId),
			),
			this.sectionOrNull(() =>
				this.leadScrapesService.listByProject(ownerId, projectId),
			),
			this.sectionOrNull(() =>
				this.leadScrapesService.countByProject(ownerId, projectId),
			),
			this.sectionOrNull(() => this.domainsService.list(projectId, ownerId)),
			this.sectionOrNull(() =>
				this.leadSheetSyncService.getState(ownerId, projectId),
			),
		]);

		const allLeads = leads?.leads ?? [];
		const allLeadScrapeExports = leadScrapeExports ?? [];

		return {
			assets: (projectAssets ?? []).map((asset) => ({
				createdAt: asset.createdAt,
				id: asset.id,
				kind: asset.source === "page-build" ? "build-file" : asset.kind,
				mediaType: asset.mediaType,
				name: asset.name,
				source: asset.source,
				url: asset.url,
			})),
			domains: (domains?.domains ?? []).map((domain) => ({
				id: domain.id,
				name: domain.name,
				primary: domain.isPrimary,
				status: domain.status,
			})),
			integrations: {
				sheets: {
					connected: sheets?.connected ?? false,
					lastSyncAt: sheets?.sheet?.lastSyncedAt ?? null,
					spreadsheetUrl: sheets?.sheet?.spreadsheetUrl ?? null,
				},
			},
			leadScrapeExports: {
				recent: allLeadScrapeExports,
				total: leadScrapeExportsTotal ?? 0,
			},
			leads: {
				recent: allLeads,
				total: leadsTotal ?? 0,
			},
			marketingAssets: (marketingAssets?.assets ?? []).map((asset) => ({
				createdAt: asset.createdAt,
				id: asset.id,
				name: asset.name,
				status: asset.status,
				type: asset.assetType,
			})),
			owner: {
				email: project.ownerEmail,
				id: project.ownerId,
				name: project.ownerName,
			},
			project: {
				createdAt: project.createdAt.toISOString(),
				id: project.id,
				name: project.name,
				updatedAt: project.updatedAt.toISOString(),
			},
			website: {
				activeVersionNumber: pageOverview?.activeVersion?.number ?? null,
				currentDeployment: {
					liveUrl: currentDeployment?.current.liveUrl ?? null,
					slug: currentDeployment?.current.slug ?? null,
					status: currentDeployment?.current.uiState ?? "draft",
				},
				deploymentHistoryCount: deploymentHistory?.deployments.length ?? 0,
				latestAttemptStatus: pageOverview?.latestAttempt?.status ?? null,
				versionsCount: pageVersions?.versions.length ?? 0,
			},
		};
	}

	private async sectionOrNull<T>(load: () => Promise<T>): Promise<T | null> {
		try {
			return await load();
		} catch (error) {
			// The project was resolved above. A nested ownership lookup can still
			// reasonably answer 404 when its backing section has never existed;
			// the admin detail should render that section as empty.
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}
}
