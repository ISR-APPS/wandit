/**
 * Orchestration behind the V2 app-project routes: create, get, the
 * conversations of a project, the cost of one chat, and the project cost
 * caps. Called by `app-projects.controller.ts`, `cost-caps.controller.ts`,
 * and the MCP tools (`mcp-tools.ts`). Create order: 1. the template version of the
 * platform. 2. the attachment and model checks. 3. the settled-balance gate. 4. one
 * transaction (project, chat, first message, builder session). 5. the
 * backend provision handoff. 6. the first builder turn, which adopts the
 * message row; when it fails, one stored error reply. 7. the title job and
 * `v2_project_created`. A create from a starter template has no turn: step 6
 * queues the `apply-starter-template` task, and no title job runs.
 */
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import {
	HttpException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	Optional,
} from "@nestjs/common";
import {
	type AppLanguage,
	type AppProject,
	type ChatCostResponse,
	type CreateAppProjectFromStarterTemplateRequest,
	type CreateAppProjectRequest,
	type CreateAppProjectResponse,
	type CreateProjectChatResponse,
	type ProjectChatListResponse,
	type ProjectCostCaps,
	type TurnErrorData,
	turnErrorDataSchema,
	type UpdateProjectCostCapsRequest,
} from "@wandit/contracts";
import { findStarterTemplate } from "@wandit/contracts/v2/starter-template-catalog";
import type { StarterTemplate } from "@wandit/contracts/v2/starter-templates";
import { getErrorMessage } from "@wandit/observability/error";

import { AnalyticsService } from "../../../../infrastructure/analytics/analytics.service";
import { CreditsService } from "../../../credits/application/services/credits.service";
import {
	creditPayerOf,
	subjectPayer,
} from "../../../credits/domain/credit-owner";
import { InsufficientCreditsError } from "../../../credits/domain/errors/insufficient-credits.error";
import { ChatsRepository } from "../../../generation/infrastructure/persistence/chats.repository";
import {
	assertWanditHostedAttachments,
	deriveProjectName,
	ProjectsService,
} from "../../../projects/application/services/projects.service";
import {
	meteringSubjectFrom,
	type ProjectScope,
	projectOwnerColumns,
} from "../../../projects/domain/project-scope";
import { ProjectsRepository } from "../../../projects/infrastructure/persistence/projects.repository";
import { BackendLimitReachedError } from "../../domain/errors/backend-limit-reached.error";
import { starterTemplateNoteMessage } from "../../domain/starter-template-note";
import { DEFAULT_PER_TURN_CAP_CREDITS } from "../../domain/turn-caps";
import { V2_ENV, type V2EnvSource } from "../../infrastructure/env/v2-env";
import { mapAppProjectRow } from "../../infrastructure/mappers/app-project.mapper";
import { AppCommitsRepository } from "../../infrastructure/persistence/app-commits.repository";
import { LlmProxyRequestsRepository } from "../../infrastructure/persistence/llm-proxy-requests.repository";
import { ProjectCostCapsRepository } from "../../infrastructure/persistence/project-cost-caps.repository";
import { starterTemplateArchivePath } from "../../infrastructure/sandbox/starter-template-archive";
import { TEMPLATE_ARCHIVE_DIR } from "../../infrastructure/sandbox/template-init";
import { TEMPLATE_PROFILES } from "../../infrastructure/sandbox/template-profiles";
import { TemplateVersionService } from "../../infrastructure/template/template-version.service";
import { TriggerApplyStarterTemplateTaskStarter } from "../../infrastructure/trigger/trigger-apply-starter-template-task-starter";
import { BackendsService } from "./backends.service";
import {
	assertPickableModel,
	HARNESS_BY_ENV,
	TURN_HOLD_DEFAULT_CREDITS,
	TurnsService,
} from "./turns.service";

/**
 * Where `createFromStarterTemplate` reads the starter templates. The API uses
 * the catalog and the archive folder of this server. A spec passes a fake,
 * because the catalog content changes with each new starter template.
 */
export type StarterTemplateSource = {
	/** The catalog entry of an id, or undefined when the catalog does not hold it. */
	find: (starterTemplateId: string) => StarterTemplate | undefined;
	/** True when this server holds the archive `starter-<id>.tar.gz`. */
	hasArchive: (starterTemplateId: string) => boolean;
};

/**
 * 35 min: 3 attempts of 600 s, plus the waits. Longer than the longest run of
 * the apply task. `get` counts it from the create of the project.
 */
const STARTER_TEMPLATE_APPLY_MAX_MS = 35 * 60_000;

const STARTER_TEMPLATE_SOURCE: StarterTemplateSource = {
	find: findStarterTemplate,
	hasArchive: (starterTemplateId) =>
		existsSync(
			starterTemplateArchivePath(TEMPLATE_ARCHIVE_DIR, starterTemplateId),
		),
};

@Injectable()
export class AppProjectsService {
	private readonly logger = new Logger(AppProjectsService.name);

	constructor(
		@Inject(ProjectsRepository)
		private readonly projects: Pick<
			ProjectsRepository,
			| "clearStarterTemplateId"
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
		private readonly templateVersion: Pick<
			TemplateVersionService,
			"versionFor"
		>,
		@Inject(AnalyticsService)
		private readonly analytics: Pick<AnalyticsService, "capture">,
		@Inject(V2_ENV)
		private readonly v2Env: V2EnvSource,
		@Inject(ProjectCostCapsRepository)
		private readonly costCaps: Pick<
			ProjectCostCapsRepository,
			"findByProjectId" | "upsert"
		>,
		@Inject(BackendsService)
		private readonly backends: Pick<BackendsService, "provisionBackend">,
		@Inject(AppCommitsRepository)
		private readonly appCommits: Pick<
			AppCommitsRepository,
			"countVersions" | "hasFileChanges"
		>,
		@Inject(ChatsRepository)
		private readonly chats: Pick<
			ChatsRepository,
			| "createProjectChat"
			| "findAccessibleChatById"
			| "findAccessibleChatByProjectId"
			| "findEmptyProjectChat"
			| "insertUiMessagesIfAbsent"
			| "listProjectChats"
		>,
		/** Sums the proxy rows of one chat for `chatCost`. */
		@Inject(LlmProxyRequestsRepository)
		private readonly proxyRequests: Pick<
			LlmProxyRequestsRepository,
			"sumByChat"
		>,
		/** Queues the `apply-starter-template` task of a new starter template project. */
		@Inject(TriggerApplyStarterTemplateTaskStarter)
		private readonly starterTemplateTasks: Pick<
			TriggerApplyStarterTemplateTaskStarter,
			"start"
		>,
		/** Nest passes nothing, so the API gets the catalog and the archive folder. */
		@Optional()
		private readonly starterTemplates: StarterTemplateSource = STARTER_TEMPLATE_SOURCE,
	) {}

	/**
	 * `POST /v2/projects` and the MCP `create_project` tool. Answers the ids of the project,
	 * its first chat, and the first builder turn (null when the turn could not start).
	 * A second create with the same `request.ids` fails on the project primary key, before any credit hold.
	 */
	async create(
		scope: ProjectScope,
		body: CreateAppProjectRequest,
		request: {
			/** Edge geo header of the request, or null. It picks the backend region. */
			countryCode: string | null;
			/** Fixed ids from the MCP `create_project` request key. The web route passes none: each create gets new ids. */
			ids?: { projectId: string; chatId: string };
			/** Dedupe key of the first builder turn, for the replay of `create_project`. Default: the new turn id. */
			firstTurnRequestKey?: string;
		},
	): Promise<CreateAppProjectResponse> {
		// First, before any row: a server without the mobile or desktop
		// template answers 503 for a create of that platform.
		const templateVersion = this.templateVersion.versionFor(
			body.targetPlatform,
		);
		const templateProfile = TEMPLATE_PROFILES[body.targetPlatform];

		assertWanditHostedAttachments(scope.actorUserId, body.attachments);
		// Before any row: an unpriced pick must not leave a project whose
		// first turn already failed.
		if (body.model !== undefined) {
			assertPickableModel(body.model);
		}

		await this.assertPayerHasCredits(scope);

		const projectId = request.ids?.projectId ?? randomUUID();
		const chatId = request.ids?.chatId ?? randomUUID();
		const messageId = randomUUID();
		const derivedName = deriveProjectName(body.prompt);
		const harness = HARNESS_BY_ENV[this.v2Env.V2_HARNESS];

		// Only a desktop app has a native shell. Its engine never changes after
		// this insert, and a create with no engine gets the Tauri shell.
		const desktopEngine =
			body.targetPlatform === "desktop"
				? (body.desktopEngine ?? "tauri")
				: null;

		await this.projects.createWithChatAndFirstMessage({
			app: {
				desktopEngine,
				framework: templateProfile.framework,
				harness,
				languages: body.languages,
				model: body.model ?? this.v2Env.V2_DEFAULT_MODEL ?? null,
				targetPlatform: body.targetPlatform,
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

		await this.provisionBackendOrLog(scope, projectId, request.countryCode);

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
					mode: body.mode,
					model: body.model,
					thinking: body.thinking,
				},
				{
					existingMessageId: messageId,
					requestKey: request.firstTurnRequestKey,
				},
			);
			turnId = turn.turnId;
		} catch (error) {
			// A failed first turn must not lose the project. The stored error
			// reply gives the chat its error card and Retry, which sends the
			// prompt again through POST .../turns.
			this.logger.error(
				`First builder turn failed for project ${projectId}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			await this.storeFirstTurnError(chatId, projectId, error);
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

		this.analytics.capture(scope.actorUserId, "v2_project_created", {
			countryCode: request.countryCode,
			framework: templateProfile.framework,
			languages: body.languages,
			// The Plan toggle of the first prompt; absent means a build.
			mode: body.mode ?? "build",
			organizationId: scope.kind === "org" ? scope.organizationId : null,
			projectId,
			targetPlatform: body.targetPlatform,
			templateVersion,
			turnStarted: turnId !== null,
		});

		return { chatId, projectId, turnId };
	}

	/**
	 * `POST /v2/projects/from-starter-template`. Writes the project, its chat,
	 * and one user message that names the starter template. Then it queues the
	 * `apply-starter-template` task, which puts the files in the sandbox. No
	 * turn runs and no credit is spent, so `turnId` is always null. An unknown
	 * id answers 404 STARTER_TEMPLATE_NOT_FOUND before any row.
	 */
	async createFromStarterTemplate(
		scope: ProjectScope,
		body: CreateAppProjectFromStarterTemplateRequest,
		request: { countryCode: string | null },
	): Promise<CreateAppProjectResponse> {
		const starterTemplate = this.starterTemplates.find(body.starterTemplateId);
		if (starterTemplate === undefined) {
			throw starterTemplateNotFound();
		}
		if (!this.starterTemplates.hasArchive(starterTemplate.id)) {
			// The catalog and the archives come from one deploy. A missing archive
			// is a deploy problem, so it goes to the error log.
			this.logger.error(
				`Starter template ${starterTemplate.id} is in the catalog but its archive is missing`,
			);
			throw starterTemplateNotFound();
		}
		// A starter template is a set of files on top of the web template.
		const templateVersion = this.templateVersion.versionFor("web");
		const templateProfile = TEMPLATE_PROFILES.web;
		// Product rule: the text of every starter template is English.
		const languages: AppLanguage[] = ["en"];

		await this.assertPayerHasCredits(scope);

		const projectId = randomUUID();
		const chatId = randomUUID();
		const messageId = randomUUID();

		await this.projects.createWithChatAndFirstMessage({
			app: {
				// Every starter template is a web app, so it has no desktop shell.
				desktopEngine: null,
				framework: templateProfile.framework,
				harness: HARNESS_BY_ENV[this.v2Env.V2_HARNESS],
				languages,
				model: this.v2Env.V2_DEFAULT_MODEL ?? null,
				starterTemplateId: starterTemplate.id,
				targetPlatform: "web",
				templateVersion,
			},
			chatId,
			messageId,
			// The name is final, so no title job runs.
			name: starterTemplate.name,
			projectId,
			// The first chat message and the project card show this text.
			prompt: `${starterTemplate.name} - ${starterTemplate.tagline[body.locale]}`,
			scope,
		});

		await this.provisionBackendOrLog(scope, projectId, request.countryCode);

		try {
			await this.starterTemplateTasks.start({
				chatId,
				messageId,
				projectId,
				starterTemplateId: starterTemplate.id,
			});
		} catch (error) {
			// A failed handoff must not lose the project. Without the task, the
			// project is an empty project, and the chat says so.
			this.logger.error(
				`Starter template ${starterTemplate.id} was not queued for project ${projectId}: ${getErrorMessage(error)}`,
			);
			await this.storeStarterTemplateFailure(
				projectId,
				chatId,
				starterTemplate.id,
			);
		}

		this.analytics.capture(scope.actorUserId, "v2_project_created", {
			countryCode: request.countryCode,
			framework: templateProfile.framework,
			languages,
			// This path has no Plan toggle.
			mode: "build",
			organizationId: scope.kind === "org" ? scope.organizationId : null,
			projectId,
			starterTemplateId: starterTemplate.id,
			targetPlatform: "web",
			templateVersion,
			turnStarted: false,
		});

		return { chatId, projectId, turnId: null };
	}

	/**
	 * D-C: a create holds nothing and debits nothing. It only refuses a payer
	 * with no credits, before any row exists. Throws `InsufficientCreditsError` (402).
	 */
	private async assertPayerHasCredits(scope: ProjectScope): Promise<void> {
		const payer = subjectPayer(meteringSubjectFrom(scope));
		const balance = await this.credits.getSettledBalance(payer);
		if (balance.settledBalance <= 0) {
			throw new InsufficientCreditsError(
				TURN_HOLD_DEFAULT_CREDITS,
				balance.balance,
				balance.settledBalance,
				creditPayerOf(payer, scope.actorUserId),
			);
		}
	}

	/**
	 * D18 and D3: a V2 project gets one backend at creation when the payer
	 * is a paid owner with a free backend slot. A failure here must not lose the project: the
	 * `app_backends` row stays `error` or absent, and the first turn still
	 * runs. `BackendsService` gives a desktop project no backend.
	 */
	private async provisionBackendOrLog(
		scope: ProjectScope,
		projectId: string,
		countryCode: string | null,
	): Promise<void> {
		try {
			await this.backends.provisionBackend(projectId, {
				countryCode,
				// The payer decides the backend slot: the project owner columns.
				...projectOwnerColumns(scope),
			});
		} catch (error) {
			// A payer without a free backend slot is a product rule, not a
			// failure: `BackendsService` already logged it.
			if (!(error instanceof BackendLimitReachedError)) {
				this.logger.error(
					`Backend provisioning failed for project ${projectId}: ${getErrorMessage(error)}`,
				);
			}
		}
	}

	/**
	 * Stores the failed note, then clears `starter_template_id`, in the order of the task.
	 * When the note write throws, the column stays set, so the next `get` tries again.
	 * A failed write only logs: the create still answers 201, and `get` still answers the project.
	 */
	private async storeStarterTemplateFailure(
		projectId: string,
		/** The first chat of the project, or null when `get` finds no chat. No note is stored then. */
		chatId: string | null,
		starterTemplateId: string,
	): Promise<void> {
		try {
			if (chatId !== null) {
				await this.chats.insertUiMessagesIfAbsent(
					chatId,
					[
						starterTemplateNoteMessage(projectId, {
							starterTemplateId,
							status: "failed",
						}),
					],
					null,
				);
			}
			await this.projects.clearStarterTemplateId(projectId, starterTemplateId);
		} catch (error) {
			this.logger.error(
				`Starter template failure write failed for project ${projectId}: ${getErrorMessage(error)}`,
			);
		}
	}

	/**
	 * Stores one assistant message with a single `data-turn-error` part after
	 * the chat's first message. A failed write only logs: the create still
	 * answers 201.
	 */
	private async storeFirstTurnError(
		chatId: string,
		projectId: string,
		error: unknown,
	): Promise<void> {
		// Our HTTP errors carry a code and a user sentence, for example 429
		// TOO_MANY_ACTIVE_TURNS. Any other error text can be internal, so it
		// stays in the log.
		const known =
			error instanceof HttpException
				? turnErrorDataSchema
						.pick({ code: true, message: true })
						.safeParse(error.getResponse())
				: null;
		const data: TurnErrorData = {
			code: known?.success ? known.data.code : "create_failed",
			message: known?.success
				? known.data.message
				: "The build did not start. Send your message again.",
			retryable: true,
		};
		try {
			await this.chats.insertUiMessagesIfAbsent(
				chatId,
				[
					{
						id: randomUUID(),
						parts: [{ data, id: "turn-error", type: "data-turn-error" }],
						role: "assistant",
					},
				],
				null,
			);
		} catch (insertError) {
			this.logger.error(
				`First turn error reply failed for project ${projectId}: ${getErrorMessage(insertError)}`,
			);
		}
	}

	/**
	 * `GET /v2/projects/:id`. A V1 row in scope answers 404, same as missing.
	 * `hasCodeChanges` and the version counts read the commits only after
	 * the scope check. It also ends a starter template apply that is too old:
	 * the answer then has `starterTemplateId: null`.
	 */
	async get(scope: ProjectScope, projectId: string): Promise<AppProject> {
		const row = await this.projects.findByIdForScope(scope, projectId);
		if (row?.engine !== "v2_app") {
			throw new NotFoundException();
		}

		const [hasCodeChanges, versions] = await Promise.all([
			this.appCommits.hasFileChanges(projectId),
			this.appCommits.countVersions(projectId),
		]);
		// State rule: the web waits while the id is set and the project has no
		// code. The task clears the id after a failure, but a crashed run and a
		// failed write do not. After the time limit, this read ends the wait.
		// LIMIT: the time counts from the create, not from the start of the run.
		// A run that is still active after the limit puts its files in with the
		// failed note. Upgrade: store the start time of the run.
		if (
			row.starterTemplateId !== null &&
			!hasCodeChanges &&
			Date.now() - row.createdAt.getTime() > STARTER_TEMPLATE_APPLY_MAX_MS
		) {
			// The oldest chat is the chat of the create. It holds the note.
			const chat = await this.chats.findAccessibleChatByProjectId(
				scope,
				projectId,
			);
			await this.storeStarterTemplateFailure(
				projectId,
				chat?.id ?? null,
				row.starterTemplateId,
			);
			return mapAppProjectRow(
				{ ...row, starterTemplateId: null },
				hasCodeChanges,
				versions,
			);
		}
		return mapAppProjectRow(row, hasCodeChanges, versions);
	}

	/**
	 * `GET /v2/projects/:id/chats`: every conversation of the project, the
	 * most recent activity first. All members of the project read the same
	 * list. Same 404 rule as the turn routes.
	 */
	async listChats(
		scope: ProjectScope,
		projectId: string,
	): Promise<ProjectChatListResponse> {
		await this.requireV2AppProject(scope, projectId);

		const rows = await this.chats.listProjectChats(projectId);
		return {
			chats: rows.map((row) => ({
				createdAt: row.createdAt.toISOString(),
				id: row.id,
				lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
				model: row.model,
				title: row.title,
			})),
		};
	}

	/**
	 * `POST /v2/projects/:id/chats`: a new, empty conversation. It writes no
	 * `builder_sessions` row: the first turn of the chat creates it. Same 404
	 * rule as the turn routes.
	 */
	async createChat(
		scope: ProjectScope,
		projectId: string,
	): Promise<CreateProjectChatResponse> {
		await this.requireV2AppProject(scope, projectId);

		// Product rule: a chat with no message is the "new conversation". A
		// second click answers the same row, so the list gets no empty twin.
		// LIMIT: no lock, so two creates at the same instant can insert two empty rows. Upgrade: a lock on the project row.
		const chat =
			(await this.chats.findEmptyProjectChat(projectId)) ??
			(await this.chats.createProjectChat(projectId));
		return {
			chat: {
				createdAt: chat.createdAt.toISOString(),
				id: chat.id,
				lastMessageAt: null,
				// A chat with no message has no turn, so no locked model.
				model: null,
				title: null,
			},
		};
	}

	/**
	 * `GET /v2/projects/:id/chats/:chatId/cost`: the full cost of one chat,
	 * so a user can compare models. Same 404 rule as the turn routes.
	 */
	async chatCost(
		scope: ProjectScope,
		projectId: string,
		chatId: string,
	): Promise<ChatCostResponse> {
		await this.requireV2AppProject(scope, projectId);
		// Security check, the same as `TurnsService.create`: the chat must be
		// in scope and belong to this project. A foreign chat id answers 404.
		const chat = await this.chats.findAccessibleChatById(scope, chatId);
		if (!chat || chat.projectId !== projectId) {
			throw new NotFoundException();
		}

		return this.proxyRequests.sumByChat(projectId, chatId);
	}

	/**
	 * `GET /v2/projects/:id/cost-caps`. Called by `cost-caps.controller.ts`
	 * behind its project role gate (team admin, personal owner). A missing row answers the plan
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
	 * behind the same project role gate. Writes the caps row and
	 * answers it; `scope.actorUserId` is the acting user stored on the row.
	 */
	async updateCostCaps(
		scope: ProjectScope,
		projectId: string,
		body: UpdateProjectCostCapsRequest,
	): Promise<ProjectCostCaps> {
		await this.requireV2AppProject(scope, projectId);

		return this.costCaps.upsert(projectId, body, scope.actorUserId);
	}

	/**
	 * The cost-cap and chat routes share the turn routes' rule: one 404 for
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

// The 404 of an id that the catalog does not hold, and of a catalog entry with no archive on this server.
function starterTemplateNotFound(): NotFoundException {
	return new NotFoundException({
		code: "STARTER_TEMPLATE_NOT_FOUND",
		message: "This template is not available",
	});
}
