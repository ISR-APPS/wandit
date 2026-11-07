import { BadGatewayException, NotFoundException } from "@nestjs/common";
import {
	APP_THEME_TEMPLATE_SELECTION,
	type AppThemeDesign,
	type DesignAppThemeBody,
} from "@wandit/contracts/v2/app-theme";
import { generateObject, type LanguageModelUsage } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MeteringService } from "../../../metering/application/services/metering.service";
import type { AiUsageEvent } from "../../../metering/domain/metering";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import type { ScopedAppProject } from "../../infrastructure/persistence/app-commits.repository";
import { AppThemeDesignService } from "./app-theme-design.service";

// The model call is the third-party AI SDK. The rest of the package stays real.
vi.mock("ai", async (importOriginal) => ({
	...(await importOriginal<typeof import("ai")>()),
	generateObject: vi.fn(),
}));

const SCOPE: ProjectScope = {
	actorIsLimitExempt: true,
	actorRoles: ["owner"],
	actorUserId: "user-1",
	kind: "personal",
	ownerUserId: "user-1",
};
const MODEL = "test-provider/theme-model";
const PROJECT: ScopedAppProject = {
	engine: "v2_app",
	framework: "web-app",
	id: "p-1",
	organizationId: null,
	templateVersion: "web-app@1.1.0",
	userId: "user-1",
};
const BODY: DesignAppThemeBody = {
	current: { name: "Ardoise", selection: APP_THEME_TEMPLATE_SELECTION },
	prompt: "A calm dental clinic, mint and white",
};
const DESIGN: AppThemeDesign = {
	name: "Menthe douce",
	mode: "light",
	background: "#F6FBF9",
	foreground: "#14231F",
	primary: "#1E8C6E",
	font: "dm-sans",
	displayFont: "fraunces",
	radius: "xl",
	border: "1",
	shadow: "sm",
	shadowStyle: "soft",
	sidebarStyle: "inset",
	sidebarTone: "tint",
	activeItem: "pill",
	header: "blur",
	frame: "flat",
	icons: "regular",
	navIcon: "soft",
};
const USAGE: LanguageModelUsage = {
	inputTokens: 4_000,
	inputTokenDetails: {
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		noCacheTokens: 4_000,
	},
	outputTokens: 800,
	outputTokenDetails: { reasoningTokens: 0, textTokens: 800 },
	totalTokens: 4_800,
};

/** The hold that the fake metering writes on reserve: a fresh token-priced hold with no snapshot. */
const HOLD: AiUsageEvent = {
	attemptRef: "design-1",
	cacheReadTokens: null,
	cacheWriteTokens: null,
	chatId: null,
	createdAt: new Date(0),
	estimatedCostUsdMicros: null,
	executionLeaseExpiresAt: null,
	executionLeaseToken: null,
	finalCredits: null,
	id: "hold-1",
	idempotencyKey: "theme_design:design-1",
	inputTokens: null,
	messageId: null,
	model: null,
	nextReconcileAttemptAt: null,
	operation: "theme_design",
	organizationId: null,
	outputTokens: null,
	parentEventId: null,
	payerUserId: null,
	pricingSnapshot: null,
	projectId: null,
	provider: null,
	rawUsage: null,
	reconcileAttempts: 0,
	reconciledAt: null,
	reconciledCostUsdMicros: null,
	reservedCredits: 50,
	settledAt: null,
	status: "reserved",
	userId: "user-1",
};

/**
 * The service with a metering fake that holds one event. `project` is the row of the scoped lookup:
 * a web-app@1.1.0 project by default, null for a project outside the scope.
 */
function setup(project: ScopedAppProject | null = PROJECT) {
	let held: AiUsageEvent | null = null;
	const metering = {
		captureGeneration: vi.fn<MeteringService["captureGeneration"]>(
			async (usageEventId) => ({
				gatewayGenerationId: "gen-1",
				id: "ref-1",
				providerSource: "vercel",
				reconciledAt: null,
				reconciledCostUsdMicros: null,
				stepUsage: null,
				usageEventId,
			}),
		),
		findByIdempotencyKey: vi.fn<MeteringService["findByIdempotencyKey"]>(
			async () => held,
		),
		refund: vi.fn<MeteringService["refund"]>(async () => HOLD),
		reserveWithReplay: vi.fn<MeteringService["reserveWithReplay"]>(async () => {
			held = HOLD;
			return { event: HOLD, replay: "none", replayed: false };
		}),
		settle: vi.fn<MeteringService["settle"]>(async () => HOLD),
		settleMeasuredFromEvidence: vi.fn<
			MeteringService["settleMeasuredFromEvidence"]
		>(async () => HOLD),
	};
	const service = new AppThemeDesignService(
		{ findScopedProject: async () => project },
		metering,
	);
	return { metering, service };
}

beforeEach(() => {
	// The service reads these through @wandit/env/server. The specs run with SKIP_ENV_VALIDATION, so
	// the env object is process.env and a stub reaches it.
	vi.stubEnv("AI_GATEWAY_API_KEY", "test-gateway-key");
	vi.stubEnv("AI_PROVIDER", "vercel");
	vi.stubEnv("AI_PROVIDER_OVERRIDES", "");
	vi.stubEnv("AI_THEME_MODEL", MODEL);
	vi.stubEnv("GENERATION_BILLING_MODE", "enforce");
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.mocked(generateObject).mockReset();
});

describe("AppThemeDesignService.design", () => {
	it.each([
		["outside the scope", null],
		["a V1 project", { ...PROJECT, engine: "v1_page" }],
		["before web-app@1.1.0", { ...PROJECT, templateVersion: "web-app@1.0.0" }],
	])("answers 404 and holds no credits for a project %s", async (_case, project) => {
		const { metering, service } = setup(project);

		await expect(service.design(SCOPE, "p-1", BODY)).rejects.toBeInstanceOf(
			NotFoundException,
		);
		expect(metering.reserveWithReplay).not.toHaveBeenCalled();
		expect(generateObject).not.toHaveBeenCalled();
	});

	it("refunds the hold and answers 502 THEME_DESIGN_FAILED when the model call fails", async () => {
		const { metering, service } = setup();
		vi.mocked(generateObject).mockRejectedValue(new Error("provider down"));

		const failure = await service
			.design(SCOPE, "p-1", BODY)
			.catch((error: unknown) => error);

		if (!(failure instanceof BadGatewayException)) {
			throw new Error("The design must fail with a 502");
		}
		expect(failure.getResponse()).toMatchObject({
			code: "THEME_DESIGN_FAILED",
		});
		expect(metering.refund).toHaveBeenCalledWith(
			"hold-1",
			"theme_design_failed",
		);
		expect(metering.settle).not.toHaveBeenCalled();
	});

	it("bills a design at 0 when the provider call ends and the schema then rejects the answer", async () => {
		const { metering, service } = setup();
		vi.mocked(generateObject).mockImplementation(async (options) => {
			// Like the AI SDK: the step ends before the schema check, and the schema error has no generation id.
			await options.onStepEnd?.({
				callId: "call-1",
				finishReason: "stop",
				modelId: MODEL,
				msToFirstChunk: undefined,
				objectText: "{}",
				provider: "gateway",
				providerMetadata: { gateway: { generationId: "gen-1" } },
				reasoning: undefined,
				request: {},
				response: { id: "res-1", modelId: MODEL, timestamp: new Date(0) },
				stepNumber: 0,
				usage: USAGE,
				warnings: undefined,
			});
			throw new Error("No object generated: response did not match schema.");
		});

		await expect(service.design(SCOPE, "p-1", BODY)).rejects.toBeInstanceOf(
			BadGatewayException,
		);

		expect(metering.captureGeneration).toHaveBeenCalledTimes(1);
		expect(metering.captureGeneration).toHaveBeenCalledWith("hold-1", {
			providerMetadata: { gateway: { generationId: "gen-1" } },
			stepUsage: {
				metering: { customerBilling: "refunded_failure", fixedUnits: 0 },
				providerUsage: USAGE,
			},
		});
		expect(metering.settle).toHaveBeenCalledWith(
			"hold-1",
			expect.objectContaining({ finalCredits: 0 }),
		);
		expect(metering.refund).not.toHaveBeenCalled();
	});

	it("answers the designed theme and settles the hold from the model tokens", async () => {
		const { metering, service } = setup();
		vi.mocked(generateObject).mockResolvedValue({
			finishReason: "stop",
			object: DESIGN,
			providerMetadata: { gateway: { generationId: "gen-1" } },
			reasoning: undefined,
			request: {},
			response: { id: "res-1", modelId: MODEL, timestamp: new Date(0) },
			toJsonResponse: () => Response.json(DESIGN),
			usage: USAGE,
			warnings: undefined,
		});

		const { theme } = await service.design(SCOPE, "p-1", BODY);

		expect(theme).toMatchObject({
			name: "Menthe douce",
			origin: "user",
			selection: {
				source: { kind: "seeds", primary: "#1e8c6e" },
				userMenu: APP_THEME_TEMPLATE_SELECTION.userMenu,
			},
		});
		expect(metering.captureGeneration).toHaveBeenCalledTimes(1);
		expect(metering.settle).toHaveBeenCalledWith("hold-1", {
			modelId: MODEL,
			pricing: "token",
			provider: undefined,
			rawUsage: USAGE,
			usage: USAGE,
		});
		expect(metering.refund).not.toHaveBeenCalled();
	});
});
