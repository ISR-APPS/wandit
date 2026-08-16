import { BadRequestException, NotFoundException } from "@nestjs/common";
import type {
	LeadsQuery,
	LeadTotals,
	WorkspaceLeadsQuery,
} from "@wandit/contracts";
import { leadsQuerySchema, workspaceLeadsQuerySchema } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import type { ProjectScope } from "../../../projects/domain/project-scope";
import {
	InvalidLeadCursorError,
	type LeadRow,
	LeadsRepository,
	type WorkspaceLeadRow,
} from "../../infrastructure/persistence/leads.repository";
import { LeadsService } from "./leads.service";

const USER_ID = "user-1";
const SCOPE: ProjectScope = { kind: "personal", userId: USER_ID };
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const LEAD_ID = "22222222-2222-4222-8222-222222222222";

const TOTALS: LeadTotals = {
	cancelled: 2,
	confirmed: 6,
	last7Days: 9,
	today: 3,
	total: 17,
};

function leadRow(overrides: Partial<LeadRow> = {}): LeadRow {
	return {
		archivedAt: null,
		attribution: { utm_source: "facebook" },
		commune: "Bab Ezzouar",
		createdAt: new Date("2026-08-02T10:00:00.000Z"),
		extras: { bundle: "Duo" },
		id: LEAD_ID,
		name: "Amina",
		phone: "+213550000000",
		status: "confirmed",
		wilaya: "Alger",
		...overrides,
	};
}

function workspaceLeadRow(
	overrides: Partial<WorkspaceLeadRow> = {},
): WorkspaceLeadRow {
	return {
		...leadRow(),
		projectId: PROJECT_ID,
		projectName: "Sahara Serum",
		...overrides,
	};
}

function setup() {
	const leadsRepository = {
		countForProject: vi.fn().mockResolvedValue(4),
		countForWorkspace: vi.fn().mockResolvedValue(7),
		getTotalsForProject: vi.fn().mockResolvedValue(TOTALS),
		listForProject: vi.fn().mockResolvedValue([leadRow()]),
		listForProjectPage: vi.fn().mockResolvedValue({
			nextCursor: "next-page",
			rows: [leadRow()],
		}),
		listForWorkspacePage: vi.fn().mockResolvedValue({
			nextCursor: "workspace-next",
			rows: [workspaceLeadRow()],
		}),
		updateAccessibleLeadArchived: vi.fn().mockResolvedValue(leadRow()),
	};
	const service = new LeadsService(
		leadsRepository as unknown as LeadsRepository,
	);

	return { leadsRepository, service };
}

describe("LeadsService", () => {
	it("returns a keyset page with filtered total and unfiltered counters", async () => {
		const { leadsRepository, service } = setup();
		const query: LeadsQuery = {
			archived: "only",
			createdFrom: "2026-07-01",
			createdTo: "2026-07-31",
			cursor: "current-page",
			pageSize: 12,
			q: "amina",
			source: "facebook",
			status: "confirmed",
		};

		await expect(service.list(SCOPE, PROJECT_ID, query)).resolves.toEqual({
			leads: [
				{
					archivedAt: null,
					campaign: null,
					commune: "Bab Ezzouar",
					createdAt: "2026-08-02T10:00:00.000Z",
					extras: { bundle: "Duo" },
					id: LEAD_ID,
					name: "Amina",
					phone: "+213550000000",
					source: "facebook",
					status: "confirmed",
					wilaya: "Alger",
				},
			],
			nextCursor: "next-page",
			total: 4,
			totals: TOTALS,
		});
		expect(leadsRepository.listForProjectPage).toHaveBeenCalledWith(
			SCOPE,
			PROJECT_ID,
			query,
		);
		expect(leadsRepository.countForProject).toHaveBeenCalledWith(
			SCOPE,
			PROJECT_ID,
			{
				archived: "only",
				createdFrom: "2026-07-01",
				createdTo: "2026-07-31",
				q: "amina",
				source: "facebook",
				status: "confirmed",
			},
		);
		expect(leadsRepository.getTotalsForProject).toHaveBeenCalledWith(
			SCOPE,
			PROJECT_ID,
		);
	});

	it("returns the workspace-wide page with each lead's project attached", async () => {
		const { leadsRepository, service } = setup();
		const query: WorkspaceLeadsQuery = {
			archived: "include",
			createdFrom: "2026-06-01",
			createdTo: "2026-06-30",
			pageSize: 20,
			projectId: PROJECT_ID,
			q: "amina",
			source: "facebook",
			status: "confirmed",
		};

		await expect(service.listForWorkspace(SCOPE, query)).resolves.toEqual({
			leads: [
				{
					archivedAt: null,
					campaign: null,
					commune: "Bab Ezzouar",
					createdAt: "2026-08-02T10:00:00.000Z",
					extras: { bundle: "Duo" },
					id: LEAD_ID,
					name: "Amina",
					phone: "+213550000000",
					projectId: PROJECT_ID,
					projectName: "Sahara Serum",
					source: "facebook",
					status: "confirmed",
					wilaya: "Alger",
				},
			],
			nextCursor: "workspace-next",
			total: 7,
		});
		expect(leadsRepository.listForWorkspacePage).toHaveBeenCalledWith(
			SCOPE,
			query,
		);
		// The total honors every active filter, cursor excluded.
		expect(leadsRepository.countForWorkspace).toHaveBeenCalledWith(SCOPE, {
			archived: "include",
			createdFrom: "2026-06-01",
			createdTo: "2026-06-30",
			projectId: PROJECT_ID,
			q: "amina",
			source: "facebook",
			status: "confirmed",
		});
	});

	it("maps an invalid workspace cursor to a 400", async () => {
		const { leadsRepository, service } = setup();
		leadsRepository.listForWorkspacePage.mockRejectedValue(
			new InvalidLeadCursorError(),
		);

		await expect(
			service.listForWorkspace(SCOPE, {
				archived: "exclude",
				cursor: "not-a-valid-cursor",
				pageSize: 20,
			}),
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it("maps an invalid opaque cursor to a 400", async () => {
		const { leadsRepository, service } = setup();
		leadsRepository.listForProjectPage.mockRejectedValue(
			new InvalidLeadCursorError(),
		);

		await expect(
			service.list(SCOPE, PROJECT_ID, {
				archived: "exclude",
				cursor: "not-a-valid-cursor",
				pageSize: 20,
			}),
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it("keeps the bounded recent-leads path used by admin detail", async () => {
		const { leadsRepository, service } = setup();

		const result = await service.list(SCOPE, PROJECT_ID, 50);

		expect(leadsRepository.listForProject).toHaveBeenCalledWith(
			SCOPE,
			PROJECT_ID,
			50,
		);
		expect(leadsRepository.listForProjectPage).not.toHaveBeenCalled();
		expect(leadsRepository.countForProject).not.toHaveBeenCalled();
		expect(result.nextCursor).toBeNull();
		expect(result.total).toBe(TOTALS.total);
		expect(result.totals).toEqual(TOTALS);
	});

	it.each([
		{ archived: true, archivedAt: new Date("2026-08-02T11:00:00.000Z") },
		{ archived: false, archivedAt: null },
	])("updates archive visibility when archived=$archived", async (testCase) => {
		const { leadsRepository, service } = setup();
		leadsRepository.updateAccessibleLeadArchived.mockResolvedValue(
			leadRow({ archivedAt: testCase.archivedAt }),
		);

		await expect(
			service.archive(SCOPE, PROJECT_ID, LEAD_ID, testCase.archived),
		).resolves.toMatchObject({
			lead: {
				archivedAt: testCase.archivedAt?.toISOString() ?? null,
				id: LEAD_ID,
			},
		});
		expect(leadsRepository.updateAccessibleLeadArchived).toHaveBeenCalledWith(
			SCOPE,
			PROJECT_ID,
			LEAD_ID,
			testCase.archived,
		);
	});

	it("returns 404 when the archive target is outside the project scope", async () => {
		const { leadsRepository, service } = setup();
		leadsRepository.updateAccessibleLeadArchived.mockResolvedValue(null);

		await expect(
			service.archive(SCOPE, PROJECT_ID, LEAD_ID, true),
		).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe("lead list query contracts", () => {
	it.each([
		leadsQuerySchema,
		workspaceLeadsQuerySchema,
	])("defaults to active leads and rejects a reversed date range", (schema) => {
		expect(schema.parse({})).toMatchObject({
			archived: "exclude",
			pageSize: 20,
		});
		expect(() =>
			schema.parse({
				createdFrom: "2026-08-03",
				createdTo: "2026-08-02",
			}),
		).toThrow();
	});
});

describe("LeadsRepository cursor validation", () => {
	it.each([
		"0000-01-01T00:00:00.000000Z",
		"2026-02-30T00:00:00.000000Z",
		"2026-01-01T24:00:00.000000Z",
	])("rejects noncanonical timestamp %s before querying", async (createdAt) => {
		const db = { select: vi.fn() };
		const repository = new LeadsRepository(db as never);
		const cursor = Buffer.from(
			JSON.stringify({ createdAt, id: LEAD_ID, v: 1 }),
			"utf8",
		).toString("base64url");

		await expect(
			repository.listForProjectPage(SCOPE, PROJECT_ID, {
				archived: "exclude",
				cursor,
				pageSize: 20,
			}),
		).rejects.toBeInstanceOf(InvalidLeadCursorError);
		await expect(
			repository.listForWorkspacePage(SCOPE, {
				archived: "exclude",
				cursor,
				pageSize: 20,
			}),
		).rejects.toBeInstanceOf(InvalidLeadCursorError);
		expect(db.select).not.toHaveBeenCalled();
	});
});
