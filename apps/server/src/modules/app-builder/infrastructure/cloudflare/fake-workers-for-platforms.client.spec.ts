import type { WorkerDeployInput } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import { assetManifest } from "./asset-manifest";
import {
	FAKE_COMPLETION_JWT,
	FAKE_SESSION_JWT,
	FakeWorkersForPlatformsClient,
} from "./fake-workers-for-platforms.client";
import { WorkersForPlatformsError } from "./workers-for-platforms.client";

const PROJECT_ID = "2b8e1d7c-4f7a-4a51-9f4e-0f7d6c1b2a3e";
const SCOPE = { projectId: PROJECT_ID, scriptName: `app-${PROJECT_ID}` };
const bytes = (text: string) => new TextEncoder().encode(text);

const INPUT: WorkerDeployInput = {
	assetsJwt: FAKE_COMPLETION_JWT,
	bindings: [],
	compatibilityDate: "2025-10-11",
	compatibilityFlags: ["nodejs_compat"],
	limits: { cpuMs: 100, subRequests: 50 },
	mainModule: "index.js",
	modules: [
		{
			content: bytes("export default {};"),
			path: "index.js",
			type: "application/javascript+module",
		},
	],
	workspaceId: "org_1",
};

describe("FakeWorkersForPlatformsClient", () => {
	it("runs a publish round trip like the real client", async () => {
		const workers = new FakeWorkersForPlatformsClient();
		const { byHash, manifest } = assetManifest(PROJECT_ID, [
			{ content: bytes("<h1>hi</h1>"), path: "/index.html" },
		]);

		const session = await workers.createAssetUploadSession(SCOPE, manifest);
		const completionJwt = await workers.uploadAssets(session, byHash);
		const deployed = await workers.deployScript(SCOPE, INPUT);

		expect(session.jwt).toBe(FAKE_SESSION_JWT);
		expect(session.buckets).toEqual([[manifest["/index.html"]?.hash]]);
		expect(completionJwt).toBe(FAKE_COMPLETION_JWT);
		expect(deployed).toEqual({
			etag: "fake-etag-1",
			scriptName: SCOPE.scriptName,
		});
		expect(await workers.listScripts(`project:${PROJECT_ID}`)).toEqual([
			{
				createdOn: "2026-01-01T00:00:00.000Z",
				scriptName: SCOPE.scriptName,
				tags: [`project:${PROJECT_ID}`, "customer:org_1"],
			},
		]);
		expect(await workers.listScripts("project:other")).toEqual([]);
		expect(await workers.deleteScript(SCOPE)).toBe("deleted");
		expect(await workers.deleteScript(SCOPE)).toBe("missing");
	});

	it("refuses what the real client refuses", async () => {
		const workers = new FakeWorkersForPlatformsClient();

		await expect(
			workers.deleteScript({ projectId: PROJECT_ID, scriptName: "app-other" }),
		).rejects.toBeInstanceOf(WorkersForPlatformsError);
		await expect(
			workers.uploadAssets(
				{ buckets: [["f".repeat(32)]], jwt: "j" },
				new Map(),
			),
		).rejects.toThrow("does not hold");
		await expect(
			workers.deployScript(SCOPE, { ...INPUT, mainModule: "server.js" }),
		).rejects.toThrow("main module server.js");
		expect(workers.scripts.size).toBe(0);
	});

	it("throws an armed failure once and records the call", async () => {
		const workers = new FakeWorkersForPlatformsClient();
		workers.failNext("listScripts", new Error("cloudflare down"));

		await expect(workers.listScripts()).rejects.toThrow("cloudflare down");
		await expect(workers.listScripts()).resolves.toEqual([]);
		expect(workers.calls).toEqual([
			{ method: "listScripts", scriptName: null },
			{ method: "listScripts", scriptName: null },
		]);
	});
});
