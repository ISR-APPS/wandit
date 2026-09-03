import { NotFoundException } from "@nestjs/common";
import { adminProjectVersionsQuerySchema } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import type { DomainsService } from "../../../domains/application/services/domains.service";
import type { LeadScrapesService } from "../../../lead-scrapes/application/services/lead-scrapes.service";
import type { LeadSheetSyncService } from "../../../leads/application/services/lead-sheet-sync.service";
import type { LeadsService } from "../../../leads/application/services/leads.service";
import type { MarketingAssetsService } from "../../../marketing-assets/application/services/marketing-assets.service";
import type { PagesService } from "../../../pages/application/services/pages.service";
import type { ProjectAssetsService } from "../../../project-assets/application/services/project-assets.service";
import type { SitesService } from "../../../sites/application/services/sites.service";
import type { AdminRepository } from "../../infrastructure/persistence/admin.repository";
import { AdminProjectsService } from "./admin-projects.service";

vi.mock("../../../../infrastructure/analytics/analytics.service", () => ({
	AnalyticsService: class AnalyticsService {},
}));

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const OWNER_ID = "owner_1";
const OWNER_SCOPE = { kind: "personal", userId: OWNER_ID } as const;

const PROJECT = {
	createdAt: new Date("2026-07-01T10:00:00.000Z"),
	id: PROJECT_ID,
	name: "Launch page",
	ownerEmail: "owner@example.com",
	ownerId: OWNER_ID,
	ownerName: "Owner",
	updatedAt: new Date("2026-07-02T11:00:00.000Z"),
};

function setup() {
	const adminRepository = {
		findProjectDetail: vi.fn().mockResolvedValue(PROJECT),
	};
	const projectAssetsService = {
		listAssets: vi.fn().mockResolvedValue([]),
	};
	const pagesService = {
		countVersions: vi.fn().mockResolvedValue(0),
		listVersions: vi.fn(),
		listVersionsPaginated: vi.fn().mockResolvedValue({
			items: [],
			page: 1,
			pageSize: 8,
			total: 0,
		}),
		overview: vi.fn().mockResolvedValue({
			activeVersion: null,
			artifactId: null,
			latestAttempt: null,
		}),
	};
	const sitesService = {
		current: vi.fn().mockResolvedValue({
			current: {
				activeDeploymentId: null,
				error: null,
				liveUrl: null,
				pendingVersionId: null,
				publishedAt: null,
				publishedVersionId: null,
				slug: null,
				uiState: "draft",
			},
		}),
		list: vi.fn().mockResolvedValue({ deployments: [] }),
	};
	const marketingAssetsService = {
		list: vi.fn().mockResolvedValue({ assets: [] }),
	};
	const leadsService = {
		countByProject: vi.fn().mockResolvedValue(1_234),
		list: vi.fn().mockResolvedValue({ leads: [] }),
	};
	const leadScrapesService = {
		countByProject: vi.fn().mockResolvedValue(321),
		listByProject: vi.fn().mockResolvedValue([]),
	};
	const leadSheetSyncService = {
		getState: vi.fn().mockResolvedValue({ connected: false, sheet: null }),
	};
	const domainsService = {
		list: vi.fn().mockResolvedValue({ domains: [] }),
	};
	const service = new AdminProjectsService(
		adminRepository as unknown as AdminRepository,
		projectAssetsService as unknown as ProjectAssetsService,
		pagesService as unknown as PagesService,
		sitesService as unknown as SitesService,
		marketingAssetsService as unknown as MarketingAssetsService,
		leadsService as unknown as LeadsService,
		leadScrapesService as unknown as LeadScrapesService,
		leadSheetSyncService as unknown as LeadSheetSyncService,
		domainsService as unknown as DomainsService,
	);

	return {
		adminRepository,
		domainsService,
		leadScrapesService,
		leadSheetSyncService,
		leadsService,
		marketingAssetsService,
		pagesService,
		projectAssetsService,
		service,
		sitesService,
	};
}

describe("adminProjectVersionsQuerySchema", () => {
	it("defaults to eight items and enforces the 24-item maximum", () => {
		expect(adminProjectVersionsQuerySchema.parse({})).toEqual({
			page: 1,
			pageSize: 8,
		});
		expect(
			adminProjectVersionsQuerySchema.parse({ page: "3", pageSize: "24" }),
		).toEqual({ page: 3, pageSize: 24 });
		expect(
			adminProjectVersionsQuerySchema.safeParse({ pageSize: "25" }).success,
		).toBe(false);
		expect(
			adminProjectVersionsQuerySchema.safeParse({ pageSize: "0" }).success,
		).toBe(false);
	});
});

describe("AdminProjectsService", () => {
	it("resolves the owner first and uses that owner for every scoped read", async () => {
		const {
			domainsService,
			leadScrapesService,
			leadSheetSyncService,
			leadsService,
			marketingAssetsService,
			pagesService,
			projectAssetsService,
			service,
			sitesService,
		} = setup();

		const detail = await service.getProjectDetail(PROJECT_ID);

		expect(detail.project).toEqual({
			createdAt: "2026-07-01T10:00:00.000Z",
			id: PROJECT_ID,
			name: "Launch page",
			updatedAt: "2026-07-02T11:00:00.000Z",
		});
		expect(detail.owner).toEqual({
			email: "owner@example.com",
			id: OWNER_ID,
			name: "Owner",
		});
		expect(projectAssetsService.listAssets).toHaveBeenCalledWith(
			OWNER_SCOPE,
			PROJECT_ID,
		);
		expect(pagesService.overview).toHaveBeenCalledWith(OWNER_SCOPE, PROJECT_ID);
		expect(pagesService.countVersions).toHaveBeenCalledWith(
			OWNER_SCOPE,
			PROJECT_ID,
		);
		expect(pagesService.listVersions).not.toHaveBeenCalled();
		expect(sitesService.current).toHaveBeenCalledWith(OWNER_SCOPE, PROJECT_ID);
		expect(sitesService.list).toHaveBeenCalledWith(OWNER_SCOPE, PROJECT_ID);
		expect(marketingAssetsService.list).toHaveBeenCalledWith(
			OWNER_SCOPE,
			PROJECT_ID,
		);
		expect(leadsService.list).toHaveBeenCalledWith(OWNER_SCOPE, PROJECT_ID, 50);
		expect(leadsService.countByProject).toHaveBeenCalledWith(
			OWNER_SCOPE,
			PROJECT_ID,
		);
		expect(leadScrapesService.listByProject).toHaveBeenCalledWith(
			OWNER_SCOPE,
			PROJECT_ID,
		);
		expect(leadScrapesService.countByProject).toHaveBeenCalledWith(
			OWNER_SCOPE,
			PROJECT_ID,
		);
		expect(leadSheetSyncService.getState).toHaveBeenCalledWith(
			OWNER_SCOPE,
			PROJECT_ID,
		);
		expect(domainsService.list).toHaveBeenCalledWith(PROJECT_ID, OWNER_SCOPE);
		expect(detail.leads).toEqual({ recent: [], total: 1_234 });
		expect(detail.leadScrapeExports).toEqual({
			recent: [],
			total: 321,
		});
	});

	it("uses the cheap version count without changing the detail total", async () => {
		const { pagesService, service } = setup();
		pagesService.countVersions.mockResolvedValue(17);

		const detail = await service.getProjectDetail(PROJECT_ID);

		expect(detail.website.versionsCount).toBe(17);
		expect(pagesService.listVersions).not.toHaveBeenCalled();
	});

	it("lists project versions through the resolved owner scope", async () => {
		const { pagesService, service } = setup();
		const response = {
			items: [],
			page: 3,
			pageSize: 8,
			total: 17,
		};
		pagesService.listVersionsPaginated.mockResolvedValue(response);

		await expect(
			service.listProjectVersions(PROJECT_ID, { page: 3, pageSize: 8 }),
		).resolves.toBe(response);
		expect(pagesService.listVersionsPaginated).toHaveBeenCalledWith(
			OWNER_SCOPE,
			PROJECT_ID,
			{ page: 3, pageSize: 8 },
		);
	});

	it("returns 404 before scoped reads when the project is missing or deleted", async () => {
		const { adminRepository, pagesService, projectAssetsService, service } =
			setup();
		adminRepository.findProjectDetail.mockResolvedValue(null);

		await expect(service.getProjectDetail(PROJECT_ID)).rejects.toBeInstanceOf(
			NotFoundException,
		);
		expect(projectAssetsService.listAssets).not.toHaveBeenCalled();
		await expect(
			service.listProjectVersions(PROJECT_ID, { page: 1, pageSize: 8 }),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(pagesService.listVersionsPaginated).not.toHaveBeenCalled();
	});

	it("turns nested not-found responses into empty project sections", async () => {
		const {
			domainsService,
			leadScrapesService,
			leadSheetSyncService,
			leadsService,
			marketingAssetsService,
			pagesService,
			projectAssetsService,
			service,
			sitesService,
		} = setup();
		const notFound = () => new NotFoundException();

		projectAssetsService.listAssets.mockRejectedValue(notFound());
		pagesService.overview.mockRejectedValue(notFound());
		pagesService.countVersions.mockRejectedValue(notFound());
		sitesService.current.mockRejectedValue(notFound());
		sitesService.list.mockRejectedValue(notFound());
		marketingAssetsService.list.mockRejectedValue(notFound());
		leadsService.list.mockRejectedValue(notFound());
		leadsService.countByProject.mockRejectedValue(notFound());
		leadScrapesService.listByProject.mockRejectedValue(notFound());
		leadScrapesService.countByProject.mockRejectedValue(notFound());
		domainsService.list.mockRejectedValue(notFound());
		leadSheetSyncService.getState.mockRejectedValue(notFound());

		const detail = await service.getProjectDetail(PROJECT_ID);

		expect(detail.assets).toEqual([]);
		expect(detail.marketingAssets).toEqual([]);
		expect(detail.leads).toEqual({ recent: [], total: 0 });
		expect(detail.leadScrapeExports).toEqual({ recent: [], total: 0 });
		expect(detail.domains).toEqual([]);
		expect(detail.integrations).toEqual({
			sheets: {
				connected: false,
				lastSyncAt: null,
				spreadsheetUrl: null,
			},
		});
		expect(detail.website).toEqual({
			activeVersionNumber: null,
			currentDeployment: {
				liveUrl: null,
				slug: null,
				status: "draft",
			},
			deploymentHistoryCount: 0,
			latestAttemptStatus: null,
			versionsCount: 0,
		});
	});
});
