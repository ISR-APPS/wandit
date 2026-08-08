import { BadRequestException } from "@nestjs/common";
import type {
	LeadsQuery,
	LeadTotals,
	WorkspaceLeadsQuery,
} from "@wandit/contracts";
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
			cursor: "current-page",
			pageSize: 12,
			q: "amina",
			status: "confirmed",
		};

		await expect(service.list(SCOPE, PROJECT_ID, query)).resolves.toEqual({
			leads: [
				{
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
			{ q: "amina", status: "confirmed" },
		);
		expect(leadsRepository.getTotalsForProject).toHaveBeenCalledWith(
			SCOPE,
			PROJECT_ID,
		);
	});

	it("returns the workspace-wide page with each lead's project attached", async () => {
		const { leadsRepository, service } = setup();
		const query: WorkspaceLeadsQuery = {
			pageSize: 20,
			projectId: PROJECT_ID,
			q: "amina",
			source: "facebook",
			status: "confirmed",
		};

		await expect(service.listForWorkspace(SCOPE, query)).resolves.toEqual({
			leads: [
				{
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
				cursor,
				pageSize: 20,
			}),
		).rejects.toBeInstanceOf(InvalidLeadCursorError);
		await expect(
			repository.listForWorkspacePage(SCOPE, { cursor, pageSize: 20 }),
		).rejects.toBeInstanceOf(InvalidLeadCursorError);
		expect(db.select).not.toHaveBeenCalled();
	});
});
