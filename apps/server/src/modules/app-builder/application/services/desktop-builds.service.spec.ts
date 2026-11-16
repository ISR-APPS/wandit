import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	type DesktopPlatform,
	desktopUpdateManifestSchema,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ObjectHeaders } from "../../../../infrastructure/storage/r2";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import type { AiUsageEvent } from "../../../metering/domain/metering";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import type { DesktopBuildRunner } from "../../domain/ports/desktop-build-runner";
import type { DesktopBuildTaskStarter } from "../../domain/ports/desktop-build-task-starter";
import {
	decryptDesktopUpdaterKey,
	signUpdaterArtifact,
	verifyUpdaterSignature,
} from "../../infrastructure/desktop/updater-signature";
import type { V2EnvSource } from "../../infrastructure/env/v2-env";
import type { AppCommitsRepository } from "../../infrastructure/persistence/app-commits.repository";
import type {
	DesktopAppRow,
	DesktopBuildRow,
	DesktopBuildsRepository,
	DesktopProject,
} from "../../infrastructure/persistence/desktop-builds.repository";
import { parseSecretKeyRing } from "../../infrastructure/secrets/secret-crypto";
import type { AuditRecord } from "./audit-events.service";
import { DesktopBuildsService } from "./desktop-builds.service";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const BUILD_ID = "22222222-2222-4222-8222-222222222222";
const OLDER_BUILD_ID = "44444444-4444-4444-8444-444444444444";
const OLDER_SHA = "b".repeat(40);
const REQUEST_KEY = "33333333-3333-4333-8333-333333333333";
const HEAD_SHA = "a".repeat(40);
const CREATED_AT = new Date("2026-11-04T10:00:00.000Z");
const PERSONAL: ProjectScope = {
	actorIsLimitExempt: true,
	actorRoles: ["owner"],
	actorUserId: "user_1",
	kind: "personal",
	ownerUserId: "user_1",
};
const IP = "203.0.113.9";
const HOLD_KEY = `desktop_build:${PROJECT_ID}:${REQUEST_KEY}`;
const KEY_RING = `v1:${Buffer.alloc(32, 7).toString("base64")}`;
const V2_ENV_VALUES: V2EnvSource = {
	APP_SECRETS_ENCRYPTION_KEY: KEY_RING,
	DESKTOP_BUILD_GITHUB_TOKEN: "github-token",
	DESKTOP_BUILD_REPO: "wandit/desktop-builder",
	V2_HARNESS: "claude-code",
};
const INSTALLER_KEY = `desktop/${PROJECT_ID}/builds/${BUILD_ID}/stock-1.0.2-setup.exe`;
const DMG_KEY = `desktop/${PROJECT_ID}/builds/${BUILD_ID}/stock-1.0.2.dmg`;
const ARCHIVE_KEY = `desktop/${PROJECT_ID}/builds/${BUILD_ID}/stock-1.0.2.app.tar.gz`;
const INITIAL_GENERATION_BILLING_MODE = env.GENERATION_BILLING_MODE;
const INITIAL_MACOS_BUILDS_ENABLED = env.DESKTOP_MACOS_BUILDS_ENABLED;

beforeEach(() => {
	Reflect.set(env, "GENERATION_BILLING_MODE", "enforce");
});

afterEach(() => {
	// The env object can be process.env; restore it so the billing mode does
	// not leak into other spec files on the same worker.
	if (INITIAL_GENERATION_BILLING_MODE === undefined) {
		Reflect.deleteProperty(env, "GENERATION_BILLING_MODE");
	} else {
		Reflect.set(
			env,
			"GENERATION_BILLING_MODE",
			INITIAL_GENERATION_BILLING_MODE,
		);
	}
	if (INITIAL_MACOS_BUILDS_ENABLED === undefined) {
		Reflect.deleteProperty(env, "DESKTOP_MACOS_BUILDS_ENABLED");
	} else {
		Reflect.set(
			env,
			"DESKTOP_MACOS_BUILDS_ENABLED",
			INITIAL_MACOS_BUILDS_ENABLED,
		);
	}
});

function buildRow(overrides: Partial<DesktopBuildRow> = {}): DesktopBuildRow {
	return {
		ciRunId: null,
		commitSha: HEAD_SHA,
		completedAt: null,
		createdAt: CREATED_AT,
		errorCode: null,
		errorMessage: null,
		findings: [],
		id: BUILD_ID,
		installerBytes: null,
		installerKey: null,
		installerSha256: null,
		notes: null,
		organizationId: null,
		platform: "windows",
		productName: "Stock",
		projectId: PROJECT_ID,
		releasedAt: null,
		releaseNumber: 2,
		requestKey: REQUEST_KEY,
		status: "queued",
		triggerRunId: null,
		updateArchiveKey: null,
		updatedAt: CREATED_AT,
		updaterSignature: null,
		userId: "user_1",
		version: "1.0.2",
		...overrides,
	};
}

function readyRow(overrides: Partial<DesktopBuildRow> = {}): DesktopBuildRow {
	return buildRow({
		completedAt: CREATED_AT,
		installerBytes: 1_024,
		installerKey: INSTALLER_KEY,
		installerSha256: "b".repeat(64),
		notes: "Faster search",
		status: "ready",
		updaterSignature: "c2lnbmF0dXJlIHRleHQ=",
		...overrides,
	});
}

function macReadyRow(
	overrides: Partial<DesktopBuildRow> = {},
): DesktopBuildRow {
	return readyRow({
		installerKey: DMG_KEY,
		platform: "macos",
		updateArchiveKey: ARCHIVE_KEY,
		...overrides,
	});
}

function appRow(overrides: Partial<DesktopAppRow> = {}): DesktopAppRow {
	return {
		binaryName: "stock",
		createdAt: CREATED_AT,
		currentMacosBuildId: null,
		currentWindowsBuildId: null,
		organizationId: null,
		productName: "Stock",
		projectId: PROJECT_ID,
		updatedAt: CREATED_AT,
		updaterKeyId: "AC4D707207A118C2",
		updaterKeyVersion: 1,
		updaterPrivateKeyCiphertext: "ciphertext",
		updaterPublicKey: "public-key",
		userId: "user_1",
		...overrides,
	};
}

function desktopProject(
	overrides: Partial<DesktopProject> = {},
): DesktopProject {
	return {
		desktopEngine: null,
		engine: "v2_app",
		framework: "desktop-app",
		id: PROJECT_ID,
		name: "Stock Manager",
		suspendedAt: null,
		suspendedReasonCode: null,
		...overrides,
	};
}

function holdEvent(overrides: Partial<AiUsageEvent> = {}): AiUsageEvent {
	return {
		attemptRef: null,
		cacheReadTokens: null,
		cacheWriteTokens: null,
		chatId: null,
		createdAt: CREATED_AT,
		estimatedCostUsdMicros: null,
		executionLeaseExpiresAt: null,
		executionLeaseToken: null,
		finalCredits: null,
		id: "hold_1",
		idempotencyKey: HOLD_KEY,
		inputTokens: null,
		messageId: null,
		model: null,
		nextReconcileAttemptAt: null,
		operation: "desktop_build",
		organizationId: null,
		outputTokens: null,
		parentEventId: null,
		payerUserId: null,
		pricingSnapshot: {},
		projectId: PROJECT_ID,
		provider: null,
		rawUsage: null,
		reconcileAttempts: 0,
		reconciledAt: null,
		reconciledCostUsdMicros: null,
		reservedCredits: 2_500,
		settledAt: null,
		status: "reserved",
		userId: "user_1",
		...overrides,
	};
}

function setup() {
	const audits: AuditRecord[] = [];
	const puts: { key: string; text: string; headers: ObjectHeaders }[] = [];
	const copies: { source: string; destination: string }[] = [];
	const removed: string[] = [];
	// What the release transaction reads under the app row lock. A case changes it.
	const releaseState: {
		/** The release number of the current build of each platform, as the repository reads it. */
		currentReleaseNumbers: Record<DesktopPlatform, number | null>;
		isProjectActive: boolean;
	} = {
		currentReleaseNumbers: { macos: null, windows: null },
		isProjectActive: true,
	};
	const builds = {
		findApp: vi.fn<DesktopBuildsRepository["findApp"]>(async () => null),
		findById: vi.fn<DesktopBuildsRepository["findById"]>(async () =>
			buildRow(),
		),
		findByRequestKey: vi.fn<DesktopBuildsRepository["findByRequestKey"]>(
			async () => null,
		),
		findLive: vi.fn<DesktopBuildsRepository["findLive"]>(async () => null),
		findProject: vi.fn<DesktopBuildsRepository["findProject"]>(async () =>
			desktopProject(),
		),
		insertQueued: vi.fn<DesktopBuildsRepository["insertQueued"]>(
			async (input) => ({ kind: "created", row: buildRow({ id: input.id }) }),
		),
		listRecent: vi.fn<DesktopBuildsRepository["listRecent"]>(async () => []),
		release: vi.fn<DesktopBuildsRepository["release"]>(
			async (_projectId, buildId, platform, publishObjects) => {
				await publishObjects({
					currentReleaseNumber: releaseState.currentReleaseNumbers[platform],
					isProjectActive: async () => releaseState.isProjectActive,
				});
				return readyRow({ id: buildId, platform, releasedAt: CREATED_AT });
			},
		),
		setTriggerRunId: vi.fn<DesktopBuildsRepository["setTriggerRunId"]>(
			async () => undefined,
		),
		transition: vi.fn<DesktopBuildsRepository["transition"]>(
			async (id, change) =>
				buildRow({ completedAt: CREATED_AT, id, status: change.to }),
		),
	};
	const appCommits = {
		findBranch: vi.fn<AppCommitsRepository["findBranch"]>(async () => ({
			headSha: HEAD_SHA,
		})),
	};
	const metering = {
		findByIdempotencyKey: vi.fn<MeteringService["findByIdempotencyKey"]>(
			async () => holdEvent(),
		),
		refund: vi.fn<MeteringService["refund"]>(async () =>
			holdEvent({ status: "refunded" }),
		),
		reserveWithReplay: vi.fn<MeteringService["reserveWithReplay"]>(
			async () => ({ event: holdEvent(), replay: "none", replayed: false }),
		),
	};
	const starter = {
		start: vi.fn<DesktopBuildTaskStarter["start"]>(async () => ({
			runId: "run_1",
		})),
	};
	const runner = {
		cancel: vi.fn<DesktopBuildRunner["cancel"]>(async () => undefined),
		dispatch: vi.fn<DesktopBuildRunner["dispatch"]>(),
		getRun: vi.fn<DesktopBuildRunner["getRun"]>(),
		hasFailedSelfTest: vi.fn<DesktopBuildRunner["hasFailedSelfTest"]>(),
	};
	const service = new DesktopBuildsService(
		builds,
		appCommits,
		{
			record: async (event) => {
				audits.push(event);
			},
		},
		metering,
		starter,
		runner,
		V2_ENV_VALUES,
		{
			copy: async (source, destination) => {
				copies.push({ destination, source });
			},
			isConfigured: () => true,
			publicUrl: (key) => `https://updates.example/${key}`,
			putText: async (key, text, headers) => {
				puts.push({ headers, key, text });
			},
			removeRelease: async (projectId) => {
				removed.push(projectId);
				return 2;
			},
		},
	);
	return {
		appCommits,
		audits,
		builds,
		copies,
		metering,
		puts,
		releaseState,
		removed,
		runner,
		service,
		starter,
	};
}

describe("DesktopBuildsService.create", () => {
	it("holds with the request key and writes the first app row with a working encrypted key", async () => {
		const { audits, builds, metering, service, starter } = setup();

		const build = await service.create(
			PERSONAL,
			PROJECT_ID,
			{ platform: "windows", requestKey: REQUEST_KEY },
			IP,
		);

		expect(build.status).toBe("queued");
		expect(metering.reserveWithReplay).toHaveBeenCalledWith(
			"desktop_build",
			{ actorIsLimitExempt: true, actorUserId: "user_1" },
			{ credits: 2_500, idempotencyKey: HOLD_KEY, projectId: PROJECT_ID },
		);
		const firstApp = builds.insertQueued.mock.calls[0]?.[1];
		if (!firstApp) {
			throw new Error("The first build wrote no app row");
		}
		expect(firstApp).toMatchObject({
			binaryName: "stock-manager",
			productName: "Stock Manager",
		});
		// The key decrypts only for this project, and it signs what the
		// public key of the installers verifies.
		const ring = parseSecretKeyRing(KEY_RING);
		const encrypted = {
			updaterKeyVersion: firstApp.updaterPrivateKey.keyVersion,
			updaterPrivateKeyCiphertext: firstApp.updaterPrivateKey.ciphertext,
		};
		expect(() =>
			decryptDesktopUpdaterKey(ring, { ...encrypted, projectId: BUILD_ID }),
		).toThrow();
		const filePath = join(tmpdir(), `desktop-build-${randomUUID()}.exe`);
		await writeFile(filePath, "MZ test");
		try {
			const signature = await signUpdaterArtifact({
				fileName: "stock-manager-1.0.1-setup.exe",
				filePath,
				keyId: firstApp.updaterKeyId,
				privateKeyPkcs8: decryptDesktopUpdaterKey(ring, {
					...encrypted,
					projectId: PROJECT_ID,
				}),
				timestamp: 1_790_000_000,
				version: "1.0.1",
			});
			await expect(
				verifyUpdaterSignature({
					filePath,
					publicKey: firstApp.updaterPublicKey,
					signature,
					version: "1.0.1",
				}),
			).resolves.toBe(true);
		} finally {
			await rm(filePath, { force: true });
		}
		expect(starter.start).toHaveBeenCalledTimes(1);
		expect(audits.map((audit) => audit.action)).toEqual(["desktop.build"]);
	});

	// Workspaces: the owner of a personal project pays, also for the build of
	// a member. The row and the audit name the member; the cap counts the owner.
	it("writes the member as the actor and holds and caps on the owner's pool for a shared personal project", async () => {
		const { audits, builds, metering, service } = setup();
		const member: ProjectScope = {
			actorIsLimitExempt: false,
			actorRoles: ["member"],
			actorUserId: "user_member",
			kind: "personal",
			ownerUserId: "user_1",
		};

		await service.create(
			member,
			PROJECT_ID,
			{ platform: "windows", requestKey: REQUEST_KEY },
			IP,
		);

		expect(metering.reserveWithReplay.mock.calls[0]?.[1]).toEqual({
			actorIsLimitExempt: false,
			actorUserId: "user_member",
			payerUserId: "user_1",
		});
		const [row, firstApp, payer] = builds.insertQueued.mock.calls[0] ?? [];
		expect(row).toMatchObject({ organizationId: null, userId: "user_member" });
		expect(firstApp).toMatchObject({ organizationId: null, userId: "user_1" });
		expect(payer).toEqual({ type: "user", userId: "user_1" });
		expect(audits[0]?.actorUserId).toBe("user_member");
	});

	// A rename would move the install folder and the data folder of every
	// installed app (section 8).
	it("keeps the identity of an existing app and ignores the product name of the body", async () => {
		const { builds, service } = setup();
		builds.findApp.mockResolvedValue(appRow());

		await service.create(
			PERSONAL,
			PROJECT_ID,
			{ platform: "windows", productName: "New Name", requestKey: REQUEST_KEY },
			IP,
		);

		expect(builds.insertQueued.mock.calls[0]?.[1]).toBeNull();
	});

	it("answers the first build of a replayed request key and holds nothing", async () => {
		const { builds, metering, service, starter } = setup();
		builds.findByRequestKey.mockResolvedValue(buildRow({ status: "building" }));

		const build = await service.create(
			PERSONAL,
			PROJECT_ID,
			{ platform: "windows", requestKey: REQUEST_KEY },
			IP,
		);

		expect(build).toMatchObject({ id: BUILD_ID, status: "building" });
		expect(metering.reserveWithReplay).not.toHaveBeenCalled();
		expect(starter.start).not.toHaveBeenCalled();
	});

	// D36: the flag stops new macOS runner minutes. A refused create must hold nothing.
	it("answers 403 DESKTOP_PLATFORM_UNAVAILABLE for a macOS create while the flag is off and holds nothing", async () => {
		const { metering, service, starter } = setup();
		// The flag is off when unset. process.env turns `false` into the truthy text "false".
		Reflect.deleteProperty(env, "DESKTOP_MACOS_BUILDS_ENABLED");

		await expect(
			service.create(
				PERSONAL,
				PROJECT_ID,
				{ platform: "macos", requestKey: REQUEST_KEY },
				IP,
			),
		).rejects.toMatchObject({
			response: { code: "DESKTOP_PLATFORM_UNAVAILABLE" },
			status: 403,
		});
		expect(metering.reserveWithReplay).not.toHaveBeenCalled();
		expect(starter.start).not.toHaveBeenCalled();
	});

	// The flag check follows the replay: a retry of a macOS build that the API
	// accepted before the flag went off still answers that build.
	it("answers the macOS build of a replayed request key while the flag is off", async () => {
		const { builds, service } = setup();
		Reflect.deleteProperty(env, "DESKTOP_MACOS_BUILDS_ENABLED");
		builds.findByRequestKey.mockResolvedValue(
			buildRow({ platform: "macos", status: "building" }),
		);

		await expect(
			service.create(
				PERSONAL,
				PROJECT_ID,
				{ platform: "macos", requestKey: REQUEST_KEY },
				IP,
			),
		).resolves.toMatchObject({
			id: BUILD_ID,
			platform: "macos",
			status: "building",
		});
	});

	// Both requests of one key share one hold, so a refund here would make
	// the build of the first request free.
	it("answers the row of a parallel retry and keeps the shared hold", async () => {
		const { builds, metering, service, starter } = setup();
		builds.insertQueued.mockResolvedValue({
			kind: "request_exists",
			row: buildRow({ status: "preparing" }),
		});

		const build = await service.create(
			PERSONAL,
			PROJECT_ID,
			{ platform: "windows", requestKey: REQUEST_KEY },
			IP,
		);

		expect(build.status).toBe("preparing");
		expect(metering.refund).not.toHaveBeenCalled();
		expect(starter.start).not.toHaveBeenCalled();
	});

	// The fast path holds nothing. The insert path holds first, so it must
	// release that hold.
	it.each([
		{ holds: 0, liveRow: true, name: "the live row check" },
		{ holds: 1, liveRow: false, name: "the live index at insert" },
	])("answers DESKTOP_BUILD_ACTIVE from $name and keeps no hold", async ({
		holds,
		liveRow,
	}) => {
		const { builds, metering, service } = setup();
		if (liveRow) {
			builds.findLive.mockResolvedValue(buildRow({ status: "building" }));
		} else {
			builds.insertQueued.mockResolvedValue({ kind: "live_exists" });
		}

		await expect(
			service.create(
				PERSONAL,
				PROJECT_ID,
				{ platform: "windows", requestKey: REQUEST_KEY },
				IP,
			),
		).rejects.toMatchObject({
			response: { code: "DESKTOP_BUILD_ACTIVE" },
			status: 409,
		});
		expect(metering.reserveWithReplay).toHaveBeenCalledTimes(holds);
		expect(metering.refund).toHaveBeenCalledTimes(holds);
	});

	// The hold of a refused create belongs to no build, so it must go back.
	it("answers DESKTOP_BUILD_LIMIT_REACHED for a payer with two live builds and releases the hold", async () => {
		const { builds, metering, service, starter } = setup();
		builds.insertQueued.mockResolvedValue({ kind: "payer_limit" });

		await expect(
			service.create(
				PERSONAL,
				PROJECT_ID,
				{ platform: "windows", requestKey: REQUEST_KEY },
				IP,
			),
		).rejects.toMatchObject({
			response: { code: "DESKTOP_BUILD_LIMIT_REACHED" },
			status: 409,
		});
		expect(metering.refund).toHaveBeenCalledWith(
			"hold_1",
			"desktop_build_create_failed",
		);
		expect(starter.start).not.toHaveBeenCalled();
	});

	// A rollback is a new build of older code with the next version (section 10).
	it("builds the commit of an earlier ready build for a rebuild", async () => {
		const { builds, service } = setup();
		builds.findById.mockResolvedValue(
			readyRow({ commitSha: OLDER_SHA, id: OLDER_BUILD_ID }),
		);

		await service.create(
			PERSONAL,
			PROJECT_ID,
			{
				platform: "windows",
				rebuildOfBuildId: OLDER_BUILD_ID,
				requestKey: REQUEST_KEY,
			},
			IP,
		);

		expect(builds.insertQueued.mock.calls[0]?.[0].commitSha).toBe(OLDER_SHA);
	});

	// A build id of another project must never lend its commit, and only a
	// ready build passed the gate and the CI.
	it.each([
		{
			name: "a build of another project",
			row: readyRow({ id: OLDER_BUILD_ID, projectId: BUILD_ID }),
			expected: { status: 404 },
		},
		{
			name: "a failed build",
			row: buildRow({ id: OLDER_BUILD_ID, status: "failed" }),
			expected: { response: { code: "DESKTOP_BUILD_NOT_READY" }, status: 409 },
		},
	])("refuses a rebuild of $name and holds nothing", async ({
		expected,
		row,
	}) => {
		const { builds, metering, service } = setup();
		builds.findById.mockResolvedValue(row);

		await expect(
			service.create(
				PERSONAL,
				PROJECT_ID,
				{
					platform: "windows",
					rebuildOfBuildId: OLDER_BUILD_ID,
					requestKey: REQUEST_KEY,
				},
				IP,
			),
		).rejects.toMatchObject(expected);
		expect(metering.reserveWithReplay).not.toHaveBeenCalled();
	});

	it("answers DESKTOP_BUILD_NO_VERSION without a saved version and holds nothing", async () => {
		const { appCommits, metering, service } = setup();
		appCommits.findBranch.mockResolvedValue({ headSha: null });

		await expect(
			service.create(
				PERSONAL,
				PROJECT_ID,
				{ platform: "windows", requestKey: REQUEST_KEY },
				IP,
			),
		).rejects.toMatchObject({
			response: { code: "DESKTOP_BUILD_NO_VERSION" },
			status: 409,
		});
		expect(metering.reserveWithReplay).not.toHaveBeenCalled();
	});

	it.each([
		{
			name: "a mobile app",
			project: desktopProject({ framework: "mobile-app" }),
		},
		{ name: "a V1 page", project: desktopProject({ engine: "v1_page" }) },
		{ name: "a project of another workspace", project: null },
	])("answers 404 for $name and holds nothing", async ({ project }) => {
		const { builds, metering, service } = setup();
		builds.findProject.mockResolvedValue(project);

		await expect(
			service.create(
				PERSONAL,
				PROJECT_ID,
				{ platform: "windows", requestKey: REQUEST_KEY },
				IP,
			),
		).rejects.toMatchObject({ status: 404 });
		expect(metering.reserveWithReplay).not.toHaveBeenCalled();
	});
});

describe("DesktopBuildsService.overview", () => {
	// A staff take-down (WANDIT-181) must not keep the installers one click away.
	// The web needs the suspension to disable Build and Release and to say why.
	const SUSPENDED_AT = new Date("2026-10-20T08:00:00.000Z");
	it.each([
		{
			installerUrl: `https://updates.example/${INSTALLER_KEY}`,
			suspendedAt: null,
			suspendedReasonCode: null,
			suspension: null,
		},
		{
			installerUrl: null,
			suspendedAt: SUSPENDED_AT,
			suspendedReasonCode: "abuse_malware" as const,
			suspension: {
				reasonCode: "abuse_malware",
				suspendedAt: SUSPENDED_AT.toISOString(),
			},
		},
	])("answers installerUrl $installerUrl and the suspension when the reason is $suspendedReasonCode", async ({
		installerUrl,
		suspendedAt,
		suspendedReasonCode,
		suspension,
	}) => {
		const { builds, service } = setup();
		builds.findProject.mockResolvedValue(
			desktopProject({ suspendedAt, suspendedReasonCode }),
		);
		builds.listRecent.mockResolvedValue([readyRow()]);

		const overview = await service.overview(PERSONAL, PROJECT_ID, {
			limit: 10,
		});

		expect(overview.builds.map((build) => build.installerUrl)).toEqual([
			installerUrl,
		]);
		expect(overview.suspension).toEqual(suspension);
	});
});

describe("DesktopBuildsService.release", () => {
	it.each([
		"building",
		"failed",
	] as const)("answers DESKTOP_BUILD_NOT_READY for a %s build and writes nothing", async (status) => {
		const { builds, copies, puts, service } = setup();
		builds.findById.mockResolvedValue(buildRow({ status }));

		await expect(
			service.release(PERSONAL, PROJECT_ID, BUILD_ID, IP),
		).rejects.toMatchObject({
			response: { code: "DESKTOP_BUILD_NOT_READY" },
			status: 409,
		});
		expect([...puts, ...copies]).toEqual([]);
		expect(builds.release).not.toHaveBeenCalled();
	});

	it("writes a manifest that parses and carries the stored signature, then the stable copy", async () => {
		const { audits, builds, copies, puts, releaseState, service } = setup();
		builds.findApp.mockResolvedValue(appRow());
		// Build 2 is newer than current build 1, so the release goes through.
		builds.findById.mockResolvedValue(readyRow());
		releaseState.currentReleaseNumbers.windows = 1;

		const build = await service.release(PERSONAL, PROJECT_ID, BUILD_ID, IP);

		expect(copies).toEqual([
			{
				destination: `desktop/${PROJECT_ID}/stock-setup.exe`,
				source: INSTALLER_KEY,
			},
		]);
		expect(puts).toHaveLength(1);
		expect(puts[0]).toMatchObject({
			headers: { cacheControl: "no-cache" },
			key: `desktop/${PROJECT_ID}/latest.json`,
		});
		const manifest = desktopUpdateManifestSchema.parse(
			JSON.parse(puts[0]?.text ?? ""),
		);
		const entry = {
			signature: "c2lnbmF0dXJlIHRleHQ=",
			url: `https://updates.example/${INSTALLER_KEY}`,
		};
		expect(manifest).toMatchObject({
			notes: "Faster search",
			platforms: { "windows-x86_64": entry, "windows-x86_64-nsis": entry },
			version: "1.0.2",
		});
		expect(build.isCurrent).toBe(true);
		expect(audits[0]).toMatchObject({
			action: "desktop.release",
			metadata: { version: "1.0.2" },
		});
	});

	// A Mac app reads only latest-macos.json. A write to latest.json would
	// offer the archive to Windows apps.
	it("releases a macOS build to latest-macos.json with the archive URL and copies the disk image", async () => {
		const { builds, copies, puts, service } = setup();
		builds.findApp.mockResolvedValue(appRow());
		builds.findById.mockResolvedValue(macReadyRow());

		const build = await service.release(PERSONAL, PROJECT_ID, BUILD_ID, IP);

		expect(copies).toEqual([
			{ destination: `desktop/${PROJECT_ID}/stock.dmg`, source: DMG_KEY },
		]);
		expect(puts.map((put) => put.key)).toEqual([
			`desktop/${PROJECT_ID}/latest-macos.json`,
		]);
		const entry = {
			signature: "c2lnbmF0dXJlIHRleHQ=",
			url: `https://updates.example/${ARCHIVE_KEY}`,
		};
		expect(
			desktopUpdateManifestSchema.parse(JSON.parse(puts[0]?.text ?? ""))
				.platforms,
		).toEqual({ "darwin-aarch64": entry, "darwin-aarch64-app": entry });
		expect(build).toMatchObject({ isCurrent: true, platform: "macos" });
	});

	// An Electron Mac app installs from the disk image, and its build has no
	// archive. A Tauri build without its archive has no update file.
	it.each([
		{ desktopEngine: "electron" as const, isReleased: true },
		{ desktopEngine: "tauri" as const, isReleased: false },
		{ desktopEngine: null, isReleased: false },
	])("releases a macOS build without an archive with the disk image URL only for the electron engine ($desktopEngine)", async ({
		desktopEngine,
		isReleased,
	}) => {
		const { builds, puts, service } = setup();
		builds.findProject.mockResolvedValue(desktopProject({ desktopEngine }));
		builds.findApp.mockResolvedValue(appRow());
		builds.findById.mockResolvedValue(macReadyRow({ updateArchiveKey: null }));

		const release = service.release(PERSONAL, PROJECT_ID, BUILD_ID, IP);

		if (!isReleased) {
			await expect(release).rejects.toMatchObject({
				response: { code: "DESKTOP_BUILD_NOT_READY" },
			});
			expect(puts).toEqual([]);
			return;
		}
		await release;
		const entry = {
			signature: "c2lnbmF0dXJlIHRleHQ=",
			url: `https://updates.example/${DMG_KEY}`,
		};
		expect(puts.map((put) => put.key)).toEqual([
			`desktop/${PROJECT_ID}/latest-macos.json`,
		]);
		expect(
			desktopUpdateManifestSchema.parse(JSON.parse(puts[0]?.text ?? ""))
				.platforms,
		).toEqual({ "darwin-aarch64": entry, "darwin-aarch64-app": entry });
	});

	// Installed apps accept only a newer version, so an older build would
	// reach only new installs. The owner rebuilds it instead.
	it.each([
		{ platform: "windows" as const, row: readyRow({ releaseNumber: 2 }) },
		{ platform: "macos" as const, row: macReadyRow({ releaseNumber: 2 }) },
	])("refuses a $platform build older than the current build of its platform and writes nothing", async ({
		platform,
		row,
	}) => {
		const { builds, copies, puts, releaseState, service } = setup();
		builds.findApp.mockResolvedValue(appRow());
		builds.findById.mockResolvedValue(row);
		releaseState.currentReleaseNumbers[platform] = 3;

		await expect(
			service.release(PERSONAL, PROJECT_ID, BUILD_ID, IP),
		).rejects.toMatchObject({
			response: { code: "DESKTOP_BUILD_OLDER_THAN_CURRENT" },
			status: 409,
		});
		expect([...puts, ...copies]).toEqual([]);
	});

	// Each platform has its own pointer: a newer Windows release must not
	// block a macOS build of an older commit.
	it("releases a macOS build that is older than the current Windows build", async () => {
		const { builds, releaseState, service } = setup();
		builds.findApp.mockResolvedValue(appRow());
		builds.findById.mockResolvedValue(macReadyRow({ releaseNumber: 2 }));
		releaseState.currentReleaseNumbers.windows = 3;

		await expect(
			service.release(PERSONAL, PROJECT_ID, BUILD_ID, IP),
		).resolves.toMatchObject({ isCurrent: true, platform: "macos" });
	});

	// A suspended app must not reach installed apps again (WANDIT-181).
	it("refuses a suspended project and writes nothing", async () => {
		const { builds, copies, puts, service } = setup();
		builds.findProject.mockResolvedValue(
			desktopProject({ suspendedReasonCode: "abuse_malware" }),
		);
		builds.findById.mockResolvedValue(readyRow());

		await expect(
			service.release(PERSONAL, PROJECT_ID, BUILD_ID, IP),
		).rejects.toMatchObject({
			response: { code: "PROJECT_SUSPENDED" },
			status: 403,
		});
		expect([...puts, ...copies]).toEqual([]);
	});

	// The release transaction reads the project again, and a suspend in
	// between must not leave a live manifest.
	it("deletes its own objects when staff suspend the project during the writes", async () => {
		const { builds, releaseState, removed, service } = setup();
		builds.findApp.mockResolvedValue(appRow());
		builds.findById.mockResolvedValue(readyRow());
		releaseState.isProjectActive = false;

		await expect(
			service.release(PERSONAL, PROJECT_ID, BUILD_ID, IP),
		).rejects.toMatchObject({ status: 403 });
		expect(removed).toEqual([PROJECT_ID]);
	});
});

describe("DesktopBuildsService.cancel", () => {
	it("cancels a live build and its CI run, and releases the reserved hold", async () => {
		const { audits, builds, metering, runner, service } = setup();
		builds.findById.mockResolvedValue(
			buildRow({ ciRunId: "987", status: "building" }),
		);
		builds.transition.mockResolvedValue(
			buildRow({ ciRunId: "987", status: "canceled" }),
		);

		const build = await service.cancel(PERSONAL, PROJECT_ID, BUILD_ID, IP);

		expect(build.status).toBe("canceled");
		expect(builds.transition).toHaveBeenCalledWith(BUILD_ID, {
			by: "user",
			to: "canceled",
		});
		expect(runner.cancel).toHaveBeenCalledWith("987");
		expect(metering.refund).toHaveBeenCalledWith(
			"hold_1",
			"desktop_build_canceled",
		);
		expect(audits.map((audit) => audit.action)).toEqual(["desktop.cancel"]);
	});

	it("answers a build that already ended as it is and releases nothing", async () => {
		const { builds, metering, runner, service } = setup();
		builds.findById.mockResolvedValue(readyRow());
		builds.transition.mockResolvedValue(null);

		const build = await service.cancel(PERSONAL, PROJECT_ID, BUILD_ID, IP);

		expect(build.status).toBe("ready");
		expect(metering.refund).not.toHaveBeenCalled();
		expect(runner.cancel).not.toHaveBeenCalled();
	});
});
