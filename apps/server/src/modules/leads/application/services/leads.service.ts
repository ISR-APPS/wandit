// Workspace-facing lead reads/updates. Ownership is proven in the repository
// joins; a miss is always a 404 (docs/api-security.md).
import type { ProjectScope } from "../../../projects/domain/project-scope";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
	LeadResponse,
	LeadStatus,
	LeadsResponse,
} from "@wandit/contracts";
import { toLeadDto } from "../../infrastructure/mappers/lead.mapper";
import { LeadsRepository } from "../../infrastructure/persistence/leads.repository";

@Injectable()
export class LeadsService {
	constructor(
		@Inject(LeadsRepository)
		private readonly leadsRepository: LeadsRepository,
	) {}

	async list(
		scope: ProjectScope,
		projectId: string,
		limit = 1_000,
	): Promise<LeadsResponse> {
		const rows = await this.leadsRepository.listForProject(
			scope,
			projectId,
			limit,
		);

		return { leads: rows.map(toLeadDto) };
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
