/**
 * Orchestration behind the V2 app-project routes: create, get, and the
 * project cost caps. Called by `app-projects.controller.ts` and
 * `cost-caps.controller.ts`. Create order: platform and attachment
 * checks, the settled-balance gate, one transaction (project, chat,
 * first message, builder session), then the first builder turn — which
 * adopts the already-written message row — the title job, and the
 * `v2_project_created` event.
 */
import { randomUUID } from "node:crypto";
import {
	BadRequestException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import type {
	AppProject,
	CreateAppProjectRequest,
	CreateAppProjectResponse,
	ProjectCostCaps,
	UpdateProjectCostCapsRequest,
} from "@wandit/contracts";

import { AnalyticsService } from "../../../../infrastructure/analytics/analytics.service";
import { CreditsService } from "../../../credits/application/services/credits.service";
import { subjectPayer } from "../../../credits/domain/credit-owner";
import { InsufficientCreditsError } from "../../../credits/domain/errors/insufficient-credits.error";
import {
	assertWanditHostedAttachments,
	deriveProjectName,
	ProjectsService,
} from "../../../projects/application/services/projects.service";
import {
	meteringSubjectFrom,
	type ProjectScope,
} from "../../../projects/domain/project-scope";
import { ProjectsRepository } from "../../../projects/infrastructure/persistence/projects.repository";
import { DEFAULT_PER_TURN_CAP_CREDITS } from "../../domain/turn-caps";
import { V2_ENV, type V2EnvSource } from "../../infrastructure/env/v2-env";
import { mapAppProjectRow } from "../../infrastructure/mappers/app-project.mapper";
import { ProjectCostCapsRepository } from "../../infrastructure/persistence/project-cost-caps.repository";
import { TemplateVersionService } from "../../infrastructure/template/template-version.service";
import {
	HARNESS_BY_ENV,
	TURN_HOLD_DEFAULT_CREDITS,
	TurnsService,
} from "./turns.service";

@Injectable()
export class AppProjectsService {
	private readonly logger = new Logger(AppProjectsService.name);

	constructor(
		@Inject(ProjectsRepository)
		private readonly projects: Pick<
			ProjectsRepository,
			| "createWithChatAndFirstMessage"
			| "findByIdForScope"
			| "findEngineByIdForScope"
		>,
		@Inject(ProjectsService)
		private readonly projectsService: Pick<
			ProjectsService,
			"startBackgroundTitle"
		>,
		@Inject(TurnsService)
		private readonly turns: Pick<TurnsService, "create">,
		@Inject(CreditsService)
		private readonly credits: Pick<CreditsService, "getSettledBalance">,
		@Inject(TemplateVersionService)
		private readonly templateVersion: Pick<TemplateVersionService, "current">,
		@Inject(AnalyticsService)
		private readonly analytics: Pick<AnalyticsService, "capture">,
		@Inject(V2_ENV)
		private readonly v2Env: V2EnvSource,
		@Inject(ProjectCostCapsRepository)
		private readonly costCaps: Pick<
			ProjectCostCapsRepository,
			"findByProjectId" | "upsert"
		>,
	) {}

	/**
	 * `POST /v2/projects`. Answers the ids of the project, its first chat,
	 * and the first builder turn (null when the turn could not start).
	 */
	async create(
		scope: ProjectScope,
		body: CreateAppProjectRequest,
		request: { countryCode: string | null },
	): Promise<CreateAppProjectResponse> {
		// WANDIT-192 adds mobile; until then the contract accepts "mobile"
		// but the create path refuses it.
		if (body.targetPlatform !== "web") {
			throw new BadRequestException({
				code: "V2_TARGET_PLATFORM_UNSUPPORTED",
				message: "Mobile apps are not available yet",
			});
		}

		assertWanditHostedAttachments(scope.userId, body.attachments);

		// D-C: the create path holds nothing; it only refuses a user with no
		// credits, before any row exists.
		const balance = await this.credits.getSettledBalance(
			subjectPayer(meteringSubjectFrom(scope)),
		);
		if (balance.settledBalance <= 0) {
			throw new InsufficientCreditsError(
				TURN_HOLD_DEFAULT_CREDITS,
				balance.balance,
				balance.settledBalance,
			);
		}

		const projectId = randomUUID();
		const chatId = randomUUID();
		const messageId = randomUUID();
		const derivedName = deriveProjectName(body.prompt);
		const templateVersion = this.templateVersion.current;
		const harness = HARNESS_BY_ENV[this.v2Env.V2_HARNESS];

		await this.projects.createWithChatAndFirstMessage({
			app: {
				framework: "web-app",
				harness,
				languages: body.languages,
				model: this.v2Env.V2_DEFAULT_MODEL ?? null,
				targetPlatform: "web",
				templateVersion,
			},
			attachments: body.attachments,
			chatId,
			composer: body.composer,
			messageId,
			name: derivedName,
			projectId,
			prompt: body.prompt,
			scope,
		});

		// WANDIT-183 adds here: backendsService.provisionBackend(projectId, { countryCode }) before the first turn.

		// WANDIT-166 builder-turn task creates the sandbox on the first turn;
		// no eager start here (request latency).
		let turnId: string | null = null;
		try {
			const turn = await this.turns.create(
				scope,
				projectId,
				{
					attachments: body.attachments,
					chatId,
					composer: body.composer,
					message: body.prompt,
				},
				{ existingMessageId: messageId },
			);
			turnId = turn.turnId;
		} catch (error) {
			// A failed first turn must not lose the project; the web app retries
			// the message through POST .../turns.
			this.logger.error(
				`First builder turn failed for project ${projectId}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}

		// Best-effort rename like V1 create: never throws, never delays the
		// response.
		void this.projectsService
			.startBackgroundTitle({
				attachments: body.attachments,
				derivedName,
				projectId,
				prompt: body.prompt,
				scope,
			})
			.catch((error: unknown) => {
				const message = error instanceof Error ? error.message : String(error);
				this.logger.warn(`Background project title update failed: ${message}`);
			});

		this.analytics.capture(scope.userId, "v2_project_created", {
			countryCode: request.countryCode,
			framework: "web-app",
			languages: body.languages,
			organizationId: scope.kind === "org" ? scope.organizationId : null,
			projectId,
			targetPlatform: "web",
			templateVersion,
			turnStarted: turnId !== null,
		});

		return { chatId, projectId, turnId };
	}

	/** `GET /v2/projects/:id`. A V1 row in scope answers 404, same as missing. */
	async get(scope: ProjectScope, projectId: string): Promise<AppProject> {
		const row = await this.projects.findByIdForScope(scope, projectId);
		if (row?.engine !== "v2_app") {
			throw new NotFoundException();
		}

		return mapAppProjectRow(row);
	}

	/**
	 * `GET /v2/projects/:id/cost-caps`. Called by `cost-caps.controller.ts`
	 * behind a `limits:manage` role gate. A missing row answers the plan
	 * default so the settings form has a number to edit.
	 */
	async getCostCaps(
		scope: ProjectScope,
		projectId: string,
	): Promise<ProjectCostCaps> {
		await this.requireV2AppProject(scope, projectId);

		const row = await this.costCaps.findByProjectId(projectId);
		return (
			row ?? {
				monthlyCapCredits: null,
				perTurnCapCredits: DEFAULT_PER_TURN_CAP_CREDITS,
			}
		);
	}

	/**
	 * `PUT /v2/projects/:id/cost-caps`. Called by `cost-caps.controller.ts`
	 * behind the same `limits:manage` role gate. Writes the caps row and
	 * answers it; `scope.userId` is the acting user stored on the row.
	 */
	async updateCostCaps(
		scope: ProjectScope,
		projectId: string,
		body: UpdateProjectCostCapsRequest,
	): Promise<ProjectCostCaps> {
		await this.requireV2AppProject(scope, projectId);

		return this.costCaps.upsert(projectId, body, scope.userId);
	}

	/**
	 * The cost-cap routes share the turn routes' rule: one 404 for
	 * "missing", "out of scope", and "not a V2 project".
	 */
	private async requireV2AppProject(
		scope: ProjectScope,
		projectId: string,
	): Promise<void> {
		const engine = await this.projects.findEngineByIdForScope(scope, projectId);
		if (engine !== "v2_app") {
			throw new NotFoundException();
		}
	}
}
