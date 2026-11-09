/**
 * Application service behind the theme design route of the builder Thème sheet.
 * `ThemeController` calls `design`. One structured model call designs a whole theme, and the service answers
 * it as a theme.json draft. It saves nothing: the user saves the draft with the theme PUT.
 * Each design holds credits through MeteringService (operation "theme_design") and settles them from the tokens.
 */
import { randomUUID } from "node:crypto";

import {
	BadGatewayException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import {
	type AppThemeDesign,
	type AppThemeFile,
	appThemeDesignSchema,
	buildAppThemeFile,
	type DesignAppThemeBody,
	type DesignAppThemeResponse,
	resolveAppTheme,
} from "@wandit/contracts/v2/app-theme";
import { env } from "@wandit/env/server";
import { getErrorMessage } from "@wandit/observability/error";
import { type GenerateObjectResult, generateObject } from "ai";

import { worldCardOf } from "../../../ai-chat/agent/worlds";
import {
	createLlmModel,
	hasLlmProviderKey,
	withLlmAttribution,
} from "../../../ai-provider/domain/llm-provider";
import {
	createMeasuredOperationBilling,
	type MeasuredOperationBillingDependencies,
} from "../../../metering/application/services/fixed-operation-billing";
import { MeteringService } from "../../../metering/application/services/metering.service";
import {
	fixedGenerationStepUsage,
	llmGenerationCaptureFromError,
} from "../../../metering/domain/gateway-metering";
import type { CapturedGeneration } from "../../../metering/domain/metering";
import {
	meteringSubjectFrom,
	type ProjectScope,
} from "../../../projects/domain/project-scope";
import { isThemeEditable } from "../../domain/app-theme-deal";
import {
	designedThemeName,
	designedThemeSelection,
	THEME_DESIGNER_SYSTEM_PROMPT,
	themeDesignerUserPrompt,
} from "../../domain/app-theme-design";
import { AppCommitsRepository } from "../../infrastructure/persistence/app-commits.repository";

/** 45 s. The answer is about 800 tokens, which takes 10 to 20 s. The user waits on a spinner. */
const THEME_DESIGN_TIMEOUT_MS = 45_000;

/** 4 000 tokens. The answer needs about 800. The rest is room for the thinking tokens of a reasoning model. */
const THEME_DESIGN_MAX_OUTPUT_TOKENS = 4_000;

/**
 * Answers a theme.json draft and saves nothing. Holds 50 cc per design (operation theme_design)
 * and settles from the tokens. A failed design costs the user 0.
 */
@Injectable()
export class AppThemeDesignService {
	private readonly logger = new Logger(AppThemeDesignService.name);

	constructor(
		// The Pick types keep each seam at the methods the service needs.
		// A spec passes plain fakes. Nest still injects by the class token.
		@Inject(AppCommitsRepository)
		private readonly appCommits: Pick<
			AppCommitsRepository,
			"findScopedProject"
		>,
		@Inject(MeteringService)
		private readonly metering: MeasuredOperationBillingDependencies["meteringService"],
	) {}

	/**
	 * A theme.json draft for the words of the user, with origin "user" and the name of the model.
	 * Errors: 404 for a project outside the scope, not V2, or before web-app@1.1.0; 503 THEME_DESIGN_UNAVAILABLE
	 * without a provider key; 402 INSUFFICIENT_CREDITS from the hold; 502 THEME_DESIGN_FAILED when the model fails.
	 */
	async design(
		scope: ProjectScope,
		projectId: string,
		body: DesignAppThemeBody,
	): Promise<DesignAppThemeResponse> {
		await this.requireThemeProject(scope, projectId);
		// The check runs before the hold, so a server with no key holds no credits.
		if (!hasLlmProviderKey("theme_design")) {
			throw new ServiceUnavailableException({
				code: "THEME_DESIGN_UNAVAILABLE",
				message: "The theme designer is not configured on this server",
			});
		}
		const { selection } = body.current;
		const world =
			selection.source.kind === "world"
				? worldCardOf(selection.source.world)
				: undefined;
		// A world that left the registry has no poles to resolve. The summary then has no colors.
		const resolved =
			selection.source.kind === "world" && world === undefined
				? null
				: resolveAppTheme(selection, world);
		const prompt = themeDesignerUserPrompt({
			name: body.current.name,
			request: body.prompt,
			resolved,
			selection,
		});

		const billing = createMeasuredOperationBilling("theme_design", {
			// GENERATION_BILLING_MODE=off is the local dev bypass: no hold.
			isBillingDisabled: () => env.GENERATION_BILLING_MODE === "off",
			meteringService: this.metering,
		});
		const subject = meteringSubjectFrom(scope);
		// The design id is the idempotency key of the hold. Each click is a new design.
		const designId = randomUUID();
		// InsufficientCreditsError passes through unchanged: 402 INSUFFICIENT_CREDITS, and nothing is held.
		const reservation = await billing.reserve(subject, designId, {});
		// The gateway records the actor. The hold above already names the pool that pays.
		const meteringContext = {
			operation: "theme_design" as const,
			organizationId: subject.organizationId ?? null,
			userId: subject.actorUserId,
		};
		// The provider call of a failed design. onStepEnd sets it before the schema check.
		let stepCapture: CapturedGeneration | null = null;
		let theme: AppThemeFile;
		let generation: Pick<
			GenerateObjectResult<AppThemeDesign>,
			"providerMetadata" | "usage"
		>;
		try {
			const result = await generateObject({
				abortSignal: AbortSignal.timeout(THEME_DESIGN_TIMEOUT_MS),
				instructions: THEME_DESIGNER_SYSTEM_PROMPT,
				maxOutputTokens: THEME_DESIGN_MAX_OUTPUT_TOKENS,
				model: createLlmModel(env.AI_THEME_MODEL, {
					context: meteringContext,
					reasoningEffort: "low",
					task: "theme_design",
				}),
				// An answer that the schema rejects throws an error with no generation id, so the hook keeps the call.
				// The AI SDK runs this hook inside an empty catch, so the hook does no I/O.
				onStepEnd: ({ providerMetadata, usage: stepUsage }) => {
					stepCapture = { providerMetadata, stepUsage };
				},
				prompt,
				// A design needs taste, not long thinking. Only OpenAI models read this key.
				providerOptions: withLlmAttribution(
					{ openai: { reasoningEffort: "low" } },
					meteringContext,
					"theme_design",
				),
				schema: appThemeDesignSchema,
				telemetry: { functionId: "theme_design" },
			});
			theme = buildAppThemeFile({
				name: designedThemeName(result.object.name),
				origin: "user",
				selection: designedThemeSelection(result.object, selection),
			});
			generation = result;
		} catch (error) {
			const failedCall = stepCapture ?? llmGenerationCaptureFromError(error);
			try {
				// Product rule: a failed design costs the user 0. A call that ended keeps its ref with the
				// refunded_failure marker, so the admin spend sums still hold its real cost.
				if (failedCall === null) {
					await billing.refund(subject, designId, "theme_design_failed");
				} else {
					await billing.capture(reservation, {
						providerMetadata: failedCall.providerMetadata,
						stepUsage: fixedGenerationStepUsage(
							failedCall.stepUsage,
							0,
							"refunded_failure",
						),
					});
					await billing.settle(reservation, 0);
				}
			} catch (billingError) {
				// The stranded sweep refunds a hold with no ref and prices a refunded_failure ref at 0.
				this.logger.warn("theme.design-billing-failed", {
					designId,
					error: getErrorMessage(billingError),
					projectId,
				});
			}
			this.logger.warn("theme.design-failed", {
				designId,
				error: getErrorMessage(error),
				projectId,
			});
			throw new BadGatewayException({
				code: "THEME_DESIGN_FAILED",
				message: "The theme designer could not design a theme",
			});
		}

		// The user gets the design, so a billing failure only logs. A settle with no ref keeps the local token price.
		try {
			await billing.capture(reservation, {
				providerMetadata: generation.providerMetadata,
				stepUsage: generation.usage,
			});
		} catch (error) {
			this.logger.warn("theme.design-capture-failed", {
				designId,
				error: getErrorMessage(error),
				projectId,
			});
		}
		try {
			await billing.settle(reservation, {
				completedUnits: 1,
				tokenUsage: {
					modelId: env.AI_THEME_MODEL,
					rawUsage: generation.usage,
					usage: generation.usage,
				},
			});
		} catch (error) {
			// The hold stays reserved. The stranded sweep prices it from its ref, or refunds it with no ref.
			this.logger.warn("theme.design-settle-failed", {
				designId,
				error: getErrorMessage(error),
				projectId,
			});
		}
		return { theme };
	}

	// A project outside the scope, a V1 project, or a project before web-app@1.1.0 answers 404, like the theme PUT.
	private async requireThemeProject(
		scope: ProjectScope,
		projectId: string,
	): Promise<void> {
		const project = await this.appCommits.findScopedProject(scope, projectId);
		if (project?.engine !== "v2_app" || !isThemeEditable(project)) {
			throw new NotFoundException();
		}
	}
}
