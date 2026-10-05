import {
	ConflictException,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import type { PublishGateFinding } from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SettledCreditBalance } from "../../../credits/application/services/credits.service";
import { InsufficientCreditsError } from "../../../credits/domain/errors/insufficient-credits.error";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import type {
	AppBranchHead,
	ScopedAppProject,
} from "../../infrastructure/persistence/app-commits.repository";
import type {
	AppBuildRow,
	AppDeploymentRow,
	InsertAppBuildResult,
	NewAppBuild,
	PublishProjectRow,
} from "../../infrastructure/persistence/app-publish.repository";
import type { AuditRecord } from "./audit-events.service";
import { PublishService } from "./publish.service";

const PROJECT_ID = "0f3a9c1b-4e7d-4a2b-9c3d-1e2f3a4b5c6d";
const BUILD_ID = "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f";
const SOURCE_BUILD_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const REQUEST_KEY = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const SCOPE: ProjectScope = { kind: "personal", userId: "user-1" };
// A member of an org workspace who did not create the project ("user-1").
// The owner checks read only `userId`.
const OTHER_MEMBER: ProjectScope = {
	actorIsLimitExempt: false,
	kind: "org",
	organizationId: "org-1",
	userId: "user-2",
};
const HEAD_SHA = "b".repeat(40);
const IP = "203.0.113.9";
const ROLLBACK_BODY = { deploymentId: "deployment-1", requestKey: REQUEST_KEY };
const OVERRIDE_BODY = { buildId: BUILD_ID, requestKey: REQUEST_KEY };

// The owner may publish past an open table ("Publish anyway").
const RLS_FINDING: PublishGateFinding = {
	kind: "rls_probe",
	reason: "no_rls",
	relation: "bookings",
	severity: "block",
};
// A secret, a phishing name, and an ERROR lint never pass "Publish anyway".
const PHISHING_FINDING: PublishGateFinding = {
	kind: "phishing",
	severity: "block",
	target: "paypal-login.example.com",
	term: "paypal",
};
const SECRET_FINDING: PublishGateFinding = {
	kind: "secret",
	path: "client/assets/index.js",
	rule: "stripe_live_secret_key",
	sample: "sk_live_…a1b2",
	severity: "block",
};
const ERROR_ADVISOR_FINDING: PublishGateFinding = {
	detail: "Table public.bookings has row level security off",
	kind: "advisor",
	level: "ERROR",
	lintId: "rls_disabled_in_public",
	remediationUrl: null,
	severity: "block",
	title: "RLS disabled in public",
};

// The env values the publish guards read. Each case starts configured.
const R2_KEYS = [
	"R2_ACCOUNT_ID",
	"R2_ACCESS_KEY_ID",
	"R2_SECRET_ACCESS_KEY",
	"R2_BUCKET",
] as const;
const INITIAL_ENV = new Map(
	[...R2_KEYS, "ALLOW_PUBLISH_WITHOUT_KV"].map((key) => [
		key,
		Reflect.get(env, key),
	]),
);

beforeEach(() => {
	for (const key of R2_KEYS) {
		Reflect.set(env, key, "r2-value");
	}
	// deleteProperty, not `= false`: on process.env the assignment would
	// coerce to the truthy string "false".
	Reflect.deleteProperty(env, "ALLOW_PUBLISH_WITHOUT_KV");
});

afterEach(() => {
	for (const [key, value] of INITIAL_ENV) {
		if (value === undefined) {
			Reflect.deleteProperty(env, key);
		} else {
			Reflect.set(env, key, value);
		}
	}
});

function buildRow(overrides: Partial<AppBuildRow> = {}): AppBuildRow {
	return {
		bytes: null,
		commitSha: HEAD_SHA,
		completedAt: null,
		createdAt: new Date("2026-10-01T10:00:00.000Z"),
		errorCode: null,
		errorMessage: null,
		fileCount: null,
		gateFindings: [],
		gateOverride: false,
		id: BUILD_ID,
		organizationId: null,
		projectId: PROJECT_ID,
		requestKey: REQUEST_KEY,
		sourceBuildId: null,
		status: "queued",
		triggerRunId: null,
		updatedAt: new Date("2026-10-01T10:00:00.000Z"),
		userId: "user-1",
		...overrides,
	};
}

function projectRow(
	overrides: Partial<PublishProjectRow> = {},
): PublishProjectRow {
	return {
		deletedAt: null,
		engine: "v2_app",
		framework: "web-app",
		name: "Booking App",
		organizationId: null,
		suspendedAt: null,
		suspendedReasonCode: null,
		templateVersion: "web-app@1.0.0",
		userId: "user-1",
		...overrides,
	};
}

function deploymentRow(
	overrides: Partial<AppDeploymentRow> = {},
): AppDeploymentRow {
	return {
		buildId: SOURCE_BUILD_ID,
		commitSha: "a".repeat(40),
		createdAt: new Date("2026-09-30T10:00:00.000Z"),
		error: null,
		id: "deployment-1",
		kind: "app",
		projectId: PROJECT_ID,
		slug: "booking-app",
		status: "superseded",
		updatedAt: new Date("2026-09-30T11:00:00.000Z"),
		versionId: null,
		...overrides,
	};
}

// A settled balance snapshot in centi-credits; only the two totals matter here.
function balance(settledBalance: number): SettledCreditBalance {
	return {
		balance: settledBalance,
		plan: 0,
		promo: 0,
		settledBalance,
		settledPlan: 0,
		settledPromo: 0,
		settledTopup: settledBalance,
		topup: settledBalance,
	};
}

function setup() {
	const order: string[] = [];
	const publish = {
		failStaleLive: vi.fn(async (_projectId: string, _olderThan: Date) => 0),
		findById: vi.fn(
			async (_id: string): Promise<AppBuildRow | null> =>
				buildRow({ id: SOURCE_BUILD_ID, status: "published" }),
		),
		findByRequestKey: vi.fn(
			async (_projectId: string, _key: string): Promise<AppBuildRow | null> =>
				null,
		),
		findDeployment: vi.fn(
			async (
				_projectId: string,
				_id: string,
			): Promise<AppDeploymentRow | null> => deploymentRow(),
		),
		findLatest: vi.fn(async (): Promise<AppBuildRow | null> => null),
		findLive: vi.fn(
			async (_projectId: string): Promise<AppBuildRow | null> => null,
		),
		findLiveDeployment: vi.fn(
			async (_projectId: string): Promise<AppDeploymentRow | null> => null,
		),
		findProject: vi.fn(
			async (_projectId: string): Promise<PublishProjectRow | null> =>
				projectRow(),
		),
		insertQueued: vi.fn(
			async (input: NewAppBuild): Promise<InsertAppBuildResult> => ({
				kind: "created",
				row: buildRow({
					commitSha: input.commitSha,
					gateOverride: input.gateOverride,
					sourceBuildId: input.sourceBuildId,
				}),
			}),
		),
		listDeployments: vi.fn(
			async (
				_projectId: string,
				_limit: number,
			): Promise<AppDeploymentRow[]> => [],
		),
		setTriggerRunId: vi.fn(async (_id: string, _runId: string) => undefined),
		transition: vi.fn(async () =>
			buildRow({ errorCode: "start_failed", status: "failed" }),
		),
	};
	const deployments = {
		healStalePending: vi.fn(async (_projectId: string) => undefined),
		unpublishActive: vi.fn(async (_projectId: string) => {
			order.push("unpublish-row");
			return null;
		}),
	};
	const appCommits = {
		findBranch: vi.fn(
			async (): Promise<AppBranchHead | null> => ({ headSha: HEAD_SHA }),
		),
		findScopedProject: vi.fn(
			async (): Promise<ScopedAppProject | null> => ({
				engine: "v2_app",
				framework: "web-app",
				id: PROJECT_ID,
				organizationId: null,
				templateVersion: "web-app@1.0.0",
				userId: "user-1",
			}),
		),
	};
	const credits = {
		getSettledBalance: vi.fn(async () => balance(500)),
	};
	const routing = {
		deleteHostPointer: vi.fn(async (_host: string) => {
			order.push("pointer");
		}),
		isKvConfigured: vi.fn(() => true),
	};
	const starter = { start: vi.fn(async () => ({ runId: "run-1" })) };
	const audit = {
		record: vi.fn(async (_event: AuditRecord): Promise<void> => undefined),
	};
	const authUrlSync = {
		onProjectDomainsChanged: vi.fn(
			async (_projectId: string): Promise<void> => undefined,
		),
	};
	const workers = {
		deleteScript: vi.fn(async () => {
			order.push("worker");
			return "deleted" as const;
		}),
	};
	const service = new PublishService(
		publish,
		deployments,
		appCommits,
		credits,
		routing,
		starter,
		audit,
		authUrlSync,
		workers,
	);
	return {
		appCommits,
		audit,
		authUrlSync,
		credits,
		deployments,
		order,
		publish,
		routing,
		service,
		starter,
		workers,
	};
}

describe("PublishService.publishHead", () => {
	it("queues the head of main and starts the task", async () => {
		const { publish, service, starter } = setup();

		const build = await service.publishHead(SCOPE, PROJECT_ID, {
			requestKey: REQUEST_KEY,
		});

		expect(build).toMatchObject({ id: BUILD_ID, status: "queued" });
		expect(publish.insertQueued).toHaveBeenCalledWith({
			commitSha: HEAD_SHA,
			gateOverride: false,
			organizationId: null,
			projectId: PROJECT_ID,
			requestKey: REQUEST_KEY,
			sourceBuildId: null,
			userId: "user-1",
		});
		expect(starter.start).toHaveBeenCalledWith({
			buildId: BUILD_ID,
			projectId: PROJECT_ID,
		});
		expect(publish.setTriggerRunId).toHaveBeenCalledWith(BUILD_ID, "run-1");
	});

	it("answers the first build for a retried request key and starts nothing", async () => {
		const { publish, service, starter } = setup();
		publish.findByRequestKey.mockResolvedValue(
			buildRow({ status: "building" }),
		);

		const build = await service.publishHead(SCOPE, PROJECT_ID, {
			requestKey: REQUEST_KEY,
		});

		expect(build.status).toBe("building");
		expect(publish.insertQueued).not.toHaveBeenCalled();
		expect(starter.start).not.toHaveBeenCalled();
	});

	it("answers 503 V2_ENV_MISSING without the W4P client and writes nothing", async () => {
		const base = setup();
		const service = new PublishService(
			base.publish,
			base.deployments,
			base.appCommits,
			base.credits,
			base.routing,
			base.starter,
			base.audit,
			base.authUrlSync,
			null,
		);

		await expect(
			service.publishHead(SCOPE, PROJECT_ID, { requestKey: REQUEST_KEY }),
		).rejects.toMatchObject({
			response: { code: "V2_ENV_MISSING" },
		});
		expect(base.publish.insertQueued).not.toHaveBeenCalled();
	});

	it("answers 503 V2_ENV_MISSING without R2", async () => {
		const { service } = setup();
		Reflect.deleteProperty(env, "R2_BUCKET");

		await expect(
			service.publishHead(SCOPE, PROJECT_ID, { requestKey: REQUEST_KEY }),
		).rejects.toBeInstanceOf(ServiceUnavailableException);
	});

	it("answers 503 PUBLISH_UNAVAILABLE without KV, and allows the local switch", async () => {
		const { routing, service } = setup();
		routing.isKvConfigured.mockReturnValue(false);

		await expect(
			service.publishHead(SCOPE, PROJECT_ID, { requestKey: REQUEST_KEY }),
		).rejects.toMatchObject({ response: { code: "PUBLISH_UNAVAILABLE" } });

		Reflect.set(env, "ALLOW_PUBLISH_WITHOUT_KV", "true");
		await expect(
			service.publishHead(SCOPE, PROJECT_ID, { requestKey: REQUEST_KEY }),
		).resolves.toMatchObject({ status: "queued" });
	});

	it("answers 402 on a negative settled balance and publishes on zero", async () => {
		const { credits, publish, service } = setup();
		credits.getSettledBalance.mockResolvedValueOnce(balance(-120));

		await expect(
			service.publishHead(SCOPE, PROJECT_ID, { requestKey: REQUEST_KEY }),
		).rejects.toBeInstanceOf(InsufficientCreditsError);
		expect(publish.insertQueued).not.toHaveBeenCalled();

		credits.getSettledBalance.mockResolvedValueOnce(balance(0));
		await expect(
			service.publishHead(SCOPE, PROJECT_ID, { requestKey: REQUEST_KEY }),
		).resolves.toMatchObject({ status: "queued" });
	});

	it("answers 409 PUBLISH_NO_VERSION without a saved head", async () => {
		const { appCommits, service } = setup();
		appCommits.findBranch.mockResolvedValue({ headSha: null });

		await expect(
			service.publishHead(SCOPE, PROJECT_ID, { requestKey: REQUEST_KEY }),
		).rejects.toMatchObject({ response: { code: "PUBLISH_NO_VERSION" } });
	});

	it("answers 409 PUBLISH_ACTIVE while a publish runs, also when the live index wins", async () => {
		const { publish, service } = setup();
		publish.findLive.mockResolvedValueOnce(buildRow({ status: "building" }));

		await expect(
			service.publishHead(SCOPE, PROJECT_ID, { requestKey: REQUEST_KEY }),
		).rejects.toMatchObject({ response: { code: "PUBLISH_ACTIVE" } });

		publish.insertQueued.mockResolvedValueOnce({ kind: "live_exists" });
		await expect(
			service.publishHead(SCOPE, PROJECT_ID, { requestKey: REQUEST_KEY }),
		).rejects.toBeInstanceOf(ConflictException);
	});

	it("starts nothing when a parallel retry of the same key wrote its row first", async () => {
		const { publish, service, starter } = setup();
		publish.insertQueued.mockResolvedValueOnce({
			kind: "request_exists",
			row: buildRow({ status: "building" }),
		});

		const build = await service.publishHead(SCOPE, PROJECT_ID, {
			requestKey: REQUEST_KEY,
		});

		expect(build.status).toBe("building");
		expect(starter.start).not.toHaveBeenCalled();
	});

	it("answers the queued build when the run id write fails", async () => {
		const { publish, service } = setup();
		publish.setTriggerRunId.mockRejectedValue(new Error("db down"));

		await expect(
			service.publishHead(SCOPE, PROJECT_ID, { requestKey: REQUEST_KEY }),
		).resolves.toMatchObject({ status: "queued" });
	});

	it("fails the row start_failed when the task does not start", async () => {
		const { publish, service, starter } = setup();
		starter.start.mockRejectedValue(new Error("trigger down"));

		const build = await service.publishHead(SCOPE, PROJECT_ID, {
			requestKey: REQUEST_KEY,
		});

		expect(build).toMatchObject({
			errorCode: "start_failed",
			status: "failed",
		});
		expect(publish.transition).toHaveBeenCalledWith(BUILD_ID, {
			errorCode: "start_failed",
			errorMessage: "The publish task could not start",
			to: "failed",
		});
	});

	it("passes a 503 of the starter to the client after it fails the row", async () => {
		const { publish, service, starter } = setup();
		starter.start.mockRejectedValue(
			new ServiceUnavailableException({ code: "V2_ENV_MISSING" }),
		);

		await expect(
			service.publishHead(SCOPE, PROJECT_ID, { requestKey: REQUEST_KEY }),
		).rejects.toBeInstanceOf(ServiceUnavailableException);
		expect(publish.transition).toHaveBeenCalledOnce();
	});

	it("answers 404 for a mobile app, a V1 project, and a missing project", async () => {
		const { appCommits, service } = setup();
		for (const project of [
			{ engine: "v2_app", framework: "mobile-app" },
			{ engine: "v1_page", framework: null },
			null,
		]) {
			appCommits.findScopedProject.mockResolvedValueOnce(
				project === null
					? null
					: {
							...project,
							id: PROJECT_ID,
							organizationId: null,
							templateVersion: null,
							userId: "user-1",
						},
			);
			await expect(
				service.publishHead(SCOPE, PROJECT_ID, { requestKey: REQUEST_KEY }),
			).rejects.toBeInstanceOf(NotFoundException);
		}
	});

	// WANDIT-181: the checked slug is the live slug, else the slug of the
	// name. A rename does not clear a phishing slug that is already live.
	it.each([
		{ label: "a phishing app name", liveSlug: null, name: "PayPal Login" },
		{
			label: "a live phishing slug after a rename",
			liveSlug: "paypal-login",
			name: "Booking App",
		},
	])("answers 422 SLUG_BLOCKED for $label and queues nothing", async ({
		liveSlug,
		name,
	}) => {
		const { publish, service, starter } = setup();
		publish.findProject.mockResolvedValue(projectRow({ name }));
		publish.findLiveDeployment.mockResolvedValue(
			liveSlug === null
				? null
				: deploymentRow({ slug: liveSlug, status: "active" }),
		);

		await expect(
			service.publishHead(SCOPE, PROJECT_ID, { requestKey: REQUEST_KEY }),
		).rejects.toMatchObject({
			response: { code: "SLUG_BLOCKED" },
			status: 422,
		});
		expect(publish.insertQueued).not.toHaveBeenCalled();
		expect(starter.start).not.toHaveBeenCalled();
	});
});

describe("PublishService on a suspended project", () => {
	// WANDIT-181: no route puts a suspended app live again until staff
	// unsuspend it.
	it.each([
		{
			call: ({ service }: ReturnType<typeof setup>) =>
				service.publishHead(SCOPE, PROJECT_ID, { requestKey: REQUEST_KEY }),
			route: "publishHead",
		},
		{
			call: ({ service }: ReturnType<typeof setup>) =>
				service.rollback(SCOPE, PROJECT_ID, ROLLBACK_BODY, IP),
			route: "rollback",
		},
		{
			call: ({ publish, service }: ReturnType<typeof setup>) => {
				// A valid override target, so the call gets to the suspension check.
				const blocked = buildRow({
					gateFindings: [RLS_FINDING],
					status: "blocked",
				});
				publish.findById.mockResolvedValue(blocked);
				publish.findLatest.mockResolvedValue(blocked);
				return service.overrideGate(SCOPE, PROJECT_ID, OVERRIDE_BODY, IP);
			},
			route: "overrideGate",
		},
	])("answers 403 PROJECT_SUSPENDED on $route and queues nothing", async ({
		call,
	}) => {
		const fakes = setup();
		fakes.publish.findProject.mockResolvedValue(
			projectRow({
				suspendedAt: new Date("2026-10-02T09:00:00.000Z"),
				suspendedReasonCode: "abuse_phishing",
			}),
		);

		await expect(call(fakes)).rejects.toMatchObject({
			response: { code: "PROJECT_SUSPENDED" },
			status: 403,
		});
		expect(fakes.audit.record).not.toHaveBeenCalled();
		expect(fakes.publish.insertQueued).not.toHaveBeenCalled();
		expect(fakes.starter.start).not.toHaveBeenCalled();
	});
});

describe("PublishService.rollback", () => {
	it("queues the stored output of the target build with its commit", async () => {
		const { publish, service } = setup();

		await service.rollback(SCOPE, PROJECT_ID, ROLLBACK_BODY, IP);

		expect(publish.insertQueued).toHaveBeenCalledWith(
			expect.objectContaining({
				commitSha: "a".repeat(40),
				sourceBuildId: SOURCE_BUILD_ID,
			}),
		);
	});

	it("uploads the first stored output on a rollback of a rollback", async () => {
		const { publish, service } = setup();
		publish.findById.mockResolvedValue(
			buildRow({ id: SOURCE_BUILD_ID, sourceBuildId: "first-build" }),
		);

		await service.rollback(SCOPE, PROJECT_ID, ROLLBACK_BODY, IP);

		expect(publish.insertQueued).toHaveBeenCalledWith(
			expect.objectContaining({ sourceBuildId: "first-build" }),
		);
	});

	it("answers 404 when the build of the row belongs to another project", async () => {
		const { publish, service } = setup();
		publish.findById.mockResolvedValue(
			buildRow({ id: SOURCE_BUILD_ID, projectId: "other-project" }),
		);

		await expect(
			service.rollback(SCOPE, PROJECT_ID, ROLLBACK_BODY, IP),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(publish.insertQueued).not.toHaveBeenCalled();
	});

	it("answers 409 for the live row and 404 for a missing row", async () => {
		const { publish, service } = setup();
		publish.findDeployment.mockResolvedValueOnce(
			deploymentRow({ status: "active" }),
		);

		await expect(
			service.rollback(SCOPE, PROJECT_ID, ROLLBACK_BODY, IP),
		).rejects.toMatchObject({ response: { code: "PUBLISH_ROLLBACK_INVALID" } });

		publish.findDeployment.mockResolvedValueOnce(null);
		await expect(
			service.rollback(SCOPE, PROJECT_ID, ROLLBACK_BODY, IP),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(publish.insertQueued).not.toHaveBeenCalled();
	});
});

describe("PublishService.unpublish", () => {
	it("deletes the pointer, then the Worker, then ends the live row", async () => {
		const { order, publish, routing, service, workers } = setup();
		publish.findLiveDeployment.mockResolvedValue(
			deploymentRow({ status: "active" }),
		);

		await service.unpublish(SCOPE, PROJECT_ID, IP);

		expect(order).toEqual(["pointer", "worker", "unpublish-row"]);
		expect(routing.deleteHostPointer).toHaveBeenCalledWith(
			`booking-app.${env.SITES_DOMAIN}`,
		);
		expect(workers.deleteScript).toHaveBeenCalledWith({
			projectId: PROJECT_ID,
			scriptName: `app-${PROJECT_ID}`,
		});
	});

	it("keeps the live row when the pointer delete fails", async () => {
		const { deployments, publish, routing, service } = setup();
		publish.findLiveDeployment.mockResolvedValue(
			deploymentRow({ status: "active" }),
		);
		routing.deleteHostPointer.mockRejectedValue(new Error("kv down"));

		await expect(service.unpublish(SCOPE, PROJECT_ID, IP)).rejects.toThrow(
			"kv down",
		);
		expect(deployments.unpublishActive).not.toHaveBeenCalled();
	});

	it("ends the live row when the Worker delete fails", async () => {
		const { deployments, publish, service, workers } = setup();
		publish.findLiveDeployment.mockResolvedValue(
			deploymentRow({ status: "active" }),
		);
		workers.deleteScript.mockRejectedValue(new Error("cloudflare down"));

		await service.unpublish(SCOPE, PROJECT_ID, IP);

		expect(deployments.unpublishActive).toHaveBeenCalledWith(PROJECT_ID);
	});

	it("ends the live row without KV and without the W4P client", async () => {
		const base = setup();
		base.publish.findLiveDeployment.mockResolvedValue(
			deploymentRow({ status: "active" }),
		);
		base.routing.isKvConfigured.mockReturnValue(false);
		const service = new PublishService(
			base.publish,
			base.deployments,
			base.appCommits,
			base.credits,
			base.routing,
			base.starter,
			base.audit,
			base.authUrlSync,
			null,
		);

		await service.unpublish(SCOPE, PROJECT_ID, IP);

		expect(base.routing.deleteHostPointer).not.toHaveBeenCalled();
		expect(base.deployments.unpublishActive).toHaveBeenCalledWith(PROJECT_ID);
	});

	it("answers 409 PUBLISH_ACTIVE while a publish runs", async () => {
		const { publish, routing, service } = setup();
		publish.findLive.mockResolvedValue(buildRow({ status: "uploading" }));

		await expect(
			service.unpublish(SCOPE, PROJECT_ID, IP),
		).rejects.toMatchObject({
			response: { code: "PUBLISH_ACTIVE" },
		});
		expect(routing.deleteHostPointer).not.toHaveBeenCalled();
	});

	// Security: the freed slug host must leave the login redirect list. The
	// app is already down, so a failed sync must not fail the unpublish.
	it("asks for one auth URL sync, and a failed sync does not fail the unpublish", async () => {
		const { authUrlSync, deployments, publish, service } = setup();
		publish.findLiveDeployment.mockResolvedValue(
			deploymentRow({ status: "active" }),
		);
		authUrlSync.onProjectDomainsChanged.mockRejectedValue(
			new Error("trigger down"),
		);

		await service.unpublish(SCOPE, PROJECT_ID, IP);

		expect(deployments.unpublishActive).toHaveBeenCalledWith(PROJECT_ID);
		expect(authUrlSync.onProjectDomainsChanged).toHaveBeenCalledExactlyOnceWith(
			PROJECT_ID,
		);
	});
});

describe("PublishService.overrideGate", () => {
	it("answers 403 PUBLISH_OVERRIDE_FORBIDDEN to a member who did not create the project", async () => {
		const { audit, publish, service } = setup();
		const blocked = buildRow({
			gateFindings: [RLS_FINDING],
			status: "blocked",
		});
		publish.findById.mockResolvedValue(blocked);
		publish.findLatest.mockResolvedValue(blocked);

		await expect(
			service.overrideGate(OTHER_MEMBER, PROJECT_ID, OVERRIDE_BODY, IP),
		).rejects.toMatchObject({
			response: { code: "PUBLISH_OVERRIDE_FORBIDDEN" },
			status: 403,
		});
		expect(audit.record).not.toHaveBeenCalled();
		expect(publish.insertQueued).not.toHaveBeenCalled();
	});

	// WANDIT-190: only the newest blocked attempt can go live anyway, and
	// only when each block finding is overridable. Unreadable findings count
	// as none, so they never pass.
	it.each([
		{
			findings: [RLS_FINDING, SECRET_FINDING],
			isNewest: true,
			label: "a secret finding",
			status: "blocked",
		},
		{
			findings: [RLS_FINDING, PHISHING_FINDING],
			isNewest: true,
			label: "a phishing finding",
			status: "blocked",
		},
		{
			findings: [ERROR_ADVISOR_FINDING],
			isNewest: true,
			label: "an ERROR advisor finding",
			status: "blocked",
		},
		{
			findings: [{ kind: "old_shape" }],
			isNewest: true,
			label: "findings that do not parse",
			status: "blocked",
		},
		{
			findings: [RLS_FINDING],
			isNewest: false,
			label: "a blocked build that is not the newest",
			status: "blocked",
		},
		{
			findings: [RLS_FINDING],
			isNewest: true,
			label: "a failed build",
			status: "failed",
		},
	] as const)("answers 409 PUBLISH_OVERRIDE_INVALID for $label and queues nothing", async ({
		findings,
		isNewest,
		status,
	}) => {
		const { audit, publish, service, starter } = setup();
		const target = buildRow({ gateFindings: findings, status });
		publish.findById.mockResolvedValue(target);
		publish.findLatest.mockResolvedValue(
			isNewest
				? target
				: buildRow({ id: SOURCE_BUILD_ID, status: "published" }),
		);

		await expect(
			service.overrideGate(SCOPE, PROJECT_ID, OVERRIDE_BODY, IP),
		).rejects.toMatchObject({
			response: { code: "PUBLISH_OVERRIDE_INVALID" },
			status: 409,
		});
		expect(audit.record).not.toHaveBeenCalled();
		expect(publish.insertQueued).not.toHaveBeenCalled();
		expect(starter.start).not.toHaveBeenCalled();
	});

	it("queues the blocked commit with gateOverride and writes the audit row before the start", async () => {
		const { audit, order, publish, service, starter } = setup();
		const blocked = buildRow({
			commitSha: "c".repeat(40),
			gateFindings: [RLS_FINDING],
			status: "blocked",
		});
		publish.findById.mockResolvedValue(blocked);
		publish.findLatest.mockResolvedValue(blocked);
		audit.record.mockImplementation(async () => {
			order.push("audit");
		});
		starter.start.mockImplementation(async () => {
			order.push("start");
			return { runId: "run-1" };
		});

		await service.overrideGate(SCOPE, PROJECT_ID, OVERRIDE_BODY, IP);

		// The task builds the blocked commit, not the head of `main`.
		expect(publish.insertQueued).toHaveBeenCalledWith(
			expect.objectContaining({
				commitSha: "c".repeat(40),
				gateOverride: true,
				sourceBuildId: null,
			}),
		);
		expect(audit.record).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({
				action: "publish.gate_override",
				actorUserId: "user-1",
				ip: IP,
				targetId: BUILD_ID,
			}),
		);
		// The override stays on record even when the start fails after it.
		expect(order).toEqual(["audit", "start"]);
	});
});

describe("PublishService.status", () => {
	it("answers the live app, the latest build, and the history", async () => {
		const { publish, service } = setup();
		const live = deploymentRow({ status: "active" });
		publish.findLiveDeployment.mockResolvedValue(live);
		publish.findLatest.mockResolvedValue(buildRow({ status: "published" }));
		publish.listDeployments.mockResolvedValue([live]);

		const status = await service.status(SCOPE, PROJECT_ID);

		expect(status.live).toEqual({
			commitSha: "a".repeat(40),
			deploymentId: "deployment-1",
			publishedAt: "2026-09-30T11:00:00.000Z",
			slug: "booking-app",
			url: `https://booking-app.${env.SITES_DOMAIN}`,
		});
		expect(status.latestBuild?.status).toBe("published");
		expect(status.history).toHaveLength(1);
		expect(publish.listDeployments).toHaveBeenCalledWith(PROJECT_ID, 20);
	});

	it("ends live rows older than 30 minutes and stale pending deployments first", async () => {
		const { deployments, publish, service } = setup();
		vi.useFakeTimers({ now: new Date("2026-10-01T12:00:00.000Z") });
		try {
			await service.status(SCOPE, PROJECT_ID);
		} finally {
			vi.useRealTimers();
		}

		expect(publish.failStaleLive).toHaveBeenCalledWith(
			PROJECT_ID,
			new Date("2026-10-01T11:30:00.000Z"),
		);
		expect(deployments.healStalePending).toHaveBeenCalledWith(PROJECT_ID);
	});

	// WANDIT-190: the popover shows "Publish anyway" only to the creator of an
	// app that is not suspended, and only when the newest attempt is blocked
	// and each of its block findings is overridable.
	it.each([
		{
			allowed: true,
			label: "the creator with an open table",
			latest: buildRow({ gateFindings: [RLS_FINDING], status: "blocked" }),
			project: projectRow(),
			scope: SCOPE,
		},
		{
			allowed: false,
			label: "a member who did not create the project",
			latest: buildRow({ gateFindings: [RLS_FINDING], status: "blocked" }),
			project: projectRow(),
			scope: OTHER_MEMBER,
		},
		{
			allowed: false,
			label: "the creator with a secret finding",
			latest: buildRow({
				gateFindings: [RLS_FINDING, SECRET_FINDING],
				status: "blocked",
			}),
			project: projectRow(),
			scope: SCOPE,
		},
		// A live override build keeps its block findings in `gate_findings`.
		{
			allowed: false,
			label: "the creator after the override went live",
			latest: buildRow({
				gateFindings: [RLS_FINDING],
				gateOverride: true,
				status: "published",
			}),
			project: projectRow(),
			scope: SCOPE,
		},
		{
			allowed: false,
			label: "the creator of a suspended app",
			latest: buildRow({ gateFindings: [RLS_FINDING], status: "blocked" }),
			project: projectRow({
				suspendedAt: new Date("2026-10-02T09:00:00.000Z"),
				suspendedReasonCode: "abuse_phishing",
			}),
			scope: SCOPE,
		},
	])("answers gateOverrideAllowed $allowed to $label", async ({
		allowed,
		latest,
		project,
		scope,
	}) => {
		const { publish, service } = setup();
		publish.findLatest.mockResolvedValue(latest);
		publish.findProject.mockResolvedValue(project);

		const status = await service.status(scope, PROJECT_ID);

		expect(status.gateOverrideAllowed).toBe(allowed);
	});
});
