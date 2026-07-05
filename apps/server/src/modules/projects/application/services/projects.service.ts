import { randomUUID } from "node:crypto";
import {
	type HttpException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import type {
	CreateProjectBody,
	CreateProjectResponse,
	ListProjectsResponse,
	Project,
	UpdateProjectBody,
} from "@wandit/contracts";

import { GenerationActivityService } from "../../../generation/application/services/generation-activity.service";
import { GenerationPolicyService } from "../../../generation/application/services/generation-policy.service";
import { GenerationQueueService } from "../../../generation/application/services/generation-queue.service";
import { GenerationActiveError } from "../../../generation/domain/errors/generation-active.error";
import { mapProjectRow } from "../../infrastructure/mappers/project.mapper";
import { ProjectsRepository } from "../../infrastructure/persistence/projects.repository";

@Injectable()
export class ProjectsService {
	private readonly logger = new Logger(ProjectsService.name);

	constructor(
		@Inject(ProjectsRepository)
		private readonly projectsRepository: ProjectsRepository,
		@Inject(GenerationPolicyService)
		private readonly generationPolicyService: GenerationPolicyService,
		@Inject(GenerationQueueService)
		private readonly generationQueueService: GenerationQueueService,
		@Inject(GenerationActivityService)
		private readonly generationActivityService: GenerationActivityService,
	) {}

	async list(userId: string): Promise<ListProjectsResponse> {
		const rows = await this.projectsRepository.listByUser(userId);

		return rows.map(mapProjectRow);
	}

	async get(userId: string, projectId: string): Promise<Project> {
		const row = await this.projectsRepository.findByIdForUser(
			userId,
			projectId,
		);

		if (!row) {
			throw new NotFoundException();
		}

		return mapProjectRow(row);
	}

	async create(
		userId: string,
		body: CreateProjectBody,
	): Promise<CreateProjectResponse> {
		await this.generationPolicyService.assertCanGenerate(
			userId,
			"landingPageGeneration",
		);

		const jobId = randomUUID();
		const created = await this.projectsRepository.createWithChatAndFirstMessage(
			{
				composer: body.composer,
				name: deriveProjectName(body.prompt),
				prompt: body.prompt,
				userId,
			},
		);
		const reserved = await this.generationActivityService.reserveActive(
			created.chatId,
			jobId,
		);

		if (!reserved) {
			throw new GenerationActiveError();
		}

		try {
			await this.generationQueueService.enqueueGenerateCopy({
				action: "landingPageGeneration",
				chatId: created.chatId,
				composer: body.composer,
				jobId,
				messageId: created.messageId,
				projectId: created.projectId,
				prompt: body.prompt,
				userId,
			});
		} catch (error) {
			// Keep the created workspace and first prompt; the user can retry from chat.
			await this.releaseReservation(created.chatId, jobId);
			throw this.queueUnavailable(error);
		}

		return {
			chatId: created.chatId,
			projectId: created.projectId,
		};
	}

	async update(
		userId: string,
		projectId: string,
		body: UpdateProjectBody,
	): Promise<Project> {
		const row = await this.projectsRepository.updateByIdForUser(
			userId,
			projectId,
			body,
		);

		if (!row) {
			throw new NotFoundException();
		}

		return mapProjectRow(row);
	}

	async delete(userId: string, projectId: string): Promise<void> {
		const deleted = await this.projectsRepository.softDeleteByIdForUser(
			userId,
			projectId,
		);

		if (!deleted) {
			throw new NotFoundException();
		}
	}

	private async releaseReservation(
		chatId: string,
		jobId: string,
	): Promise<void> {
		try {
			await this.generationActivityService.releaseActive(chatId, jobId);
		} catch (error) {
			this.logger.error(
				`Failed to release project generation reservation ${jobId}`,
				error instanceof Error ? error.stack : String(error),
			);
		}
	}

	private queueUnavailable(error: unknown): HttpException {
		if (error instanceof ServiceUnavailableException) {
			return error;
		}

		return new ServiceUnavailableException({
			code: "GENERATION_QUEUE_UNAVAILABLE",
			message: "Generation queue could not be reached",
		});
	}
}

export function deriveProjectName(prompt: string): string {
	const normalized = prompt.replace(/\s+/g, " ").trim();

	if (!normalized) {
		return "Untitled project";
	}

	if (normalized.length <= 40) {
		return normalized;
	}

	const words = normalized.split(" ");
	let name = "";

	for (const word of words) {
		const next = name ? `${name} ${word}` : word;

		if (next.length > 40) {
			break;
		}

		name = next;
	}

	return name || normalized.slice(0, 40).trim();
}
