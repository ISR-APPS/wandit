// Workspace-facing lead reads/updates. Ownership is proven in the repository
// joins; a miss is always a 404 (docs/api-security.md).
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
		userId: string,
		projectId: string,
		limit = 1_000,
	): Promise<LeadsResponse> {
		const rows = await this.leadsRepository.listOwnedByProject(
			userId,
			projectId,
			limit,
		);

		return { leads: rows.map(toLeadDto) };
	}

	countByProject(userId: string, projectId: string): Promise<number> {
		return this.leadsRepository.countOwnedByProject(userId, projectId);
	}

	async updateStatus(
		userId: string,
		projectId: string,
		leadId: string,
		status: LeadStatus,
	): Promise<LeadResponse> {
		const row = await this.leadsRepository.updateOwnedLeadStatus(
			userId,
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
