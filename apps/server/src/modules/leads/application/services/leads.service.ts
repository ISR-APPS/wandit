// Workspace-facing lead reads/updates. Ownership is proven in the repository
// joins; a miss is always a 404 (docs/api-security.md).

import {
	BadRequestException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type {
	LeadResponse,
	LeadStatus,
	LeadsQuery,
	LeadsResponse,
} from "@wandit/contracts";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import { toLeadDto } from "../../infrastructure/mappers/lead.mapper";
import {
	InvalidLeadCursorError,
	LeadsRepository,
} from "../../infrastructure/persistence/leads.repository";

@Injectable()
export class LeadsService {
	constructor(
		@Inject(LeadsRepository)
		private readonly leadsRepository: LeadsRepository,
	) {}

	list(
		scope: ProjectScope,
		projectId: string,
		limit: number,
	): Promise<LeadsResponse>;
	list(
		scope: ProjectScope,
		projectId: string,
		query?: LeadsQuery,
	): Promise<LeadsResponse>;
	async list(
		scope: ProjectScope,
		projectId: string,
		queryOrLimit: LeadsQuery | number = { pageSize: 20 },
	): Promise<LeadsResponse> {
		// Admin project detail intentionally asks for a small recent slice. Keep
		// that internal numeric call compatible while the workspace API uses cursors.
		if (typeof queryOrLimit === "number") {
			const [rows, totals] = await Promise.all([
				this.leadsRepository.listForProject(scope, projectId, queryOrLimit),
				this.leadsRepository.getTotalsForProject(scope, projectId),
			]);

			return {
				leads: rows.map(toLeadDto),
				nextCursor: null,
				total: totals.total,
				totals,
			};
		}

		try {
			const [page, total, totals] = await Promise.all([
				this.leadsRepository.listForProjectPage(scope, projectId, queryOrLimit),
				this.leadsRepository.countForProject(scope, projectId, {
					q: queryOrLimit.q,
					status: queryOrLimit.status,
				}),
				this.leadsRepository.getTotalsForProject(scope, projectId),
			]);

			return {
				leads: page.rows.map(toLeadDto),
				nextCursor: page.nextCursor,
				total,
				totals,
			};
		} catch (error) {
			if (error instanceof InvalidLeadCursorError) {
				throw new BadRequestException("Invalid lead cursor");
			}

			throw error;
		}
	}

	countByProject(scope: ProjectScope, projectId: string): Promise<number> {
		return this.leadsRepository.countForProject(scope, projectId);
	}

	async updateStatus(
		scope: ProjectScope,
		projectId: string,
		leadId: string,
		status: LeadStatus,
	): Promise<LeadResponse> {
		const row = await this.leadsRepository.updateAccessibleLeadStatus(
			scope,
			projectId,
			leadId,
			status,
		);

		if (!row) {
			throw new NotFoundException("Lead not found");
		}

		return { lead: toLeadDto(row) };
	}
}
