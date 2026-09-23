import { describe, expect, it } from "vitest";

import { FAKE_WORKSPACE_DIR } from "../../../infrastructure/sandbox/fake-sandbox.provider";
import { jsonResponse } from "../../../infrastructure/supabase/fake-supabase-fetch";
import { createDeployFunctionTool } from "./deploy-function.host-tool";
import {
	createBackendToolFixture,
	executeTool,
	FAKE_REF,
} from "./fake-backend-tool-deps";

const FUNCTION_DIR = `${FAKE_WORKSPACE_DIR}/supabase/functions/hello-world`;
const DEPLOYED = {
	id: "fn-1",
	name: "hello-world",
	slug: "hello-world",
	status: "ACTIVE",
	version: 3,
};

describe("deploy_function", () => {
	it("sends the folder files as one multipart deploy and answers the function URL", async () => {
		const fixture = await createBackendToolFixture({
			answers: [jsonResponse(201, JSON.stringify(DEPLOYED))],
		});
		await fixture.sandbox.writeFiles([
			{
				content: "Deno.serve(() => new Response('hi'));",
				path: `${FUNCTION_DIR}/index.ts`,
			},
			{ content: "export const cors = {};", path: `${FUNCTION_DIR}/cors.ts` },
		]);
		const tool = createDeployFunctionTool(fixture.deps, fixture.context);

		const output = await executeTool(tool, { slug: "hello-world" });

		expect(output).toEqual({
			status: "deployed",
			url: `https://${FAKE_REF}.supabase.co/functions/v1/hello-world`,
		});
		expect(fixture.requests).toHaveLength(1);
		const files = fixture.requests[0]?.form?.getAll("file") ?? [];
		expect(
			files.map((file) => (file instanceof File ? file.name : null)).sort(),
		).toEqual(["cors.ts", "index.ts"]);
		expect(fixture.audits).toEqual([
			{
				action: "backend.function_deployed",
				actorUserId: "user-1",
				metadata: { slug: "hello-world", version: 3 },
				organizationId: "org-1",
				projectId: "project-1",
				targetId: "backend-1",
				targetType: "app_backend",
			},
		]);
	});

	it("answers failed without index.ts and sends nothing", async () => {
		const fixture = await createBackendToolFixture();
		await fixture.sandbox.writeFiles([
			{ content: "export {};", path: `${FUNCTION_DIR}/main.ts` },
		]);
		const tool = createDeployFunctionTool(fixture.deps, fixture.context);

		expect(await executeTool(tool, { slug: "hello-world" })).toEqual({
			reason: "supabase/functions/hello-world/index.ts is missing",
			status: "failed",
		});
		expect(fixture.requests).toEqual([]);
	});

	it("answers failed above 50 files and sends nothing", async () => {
		const fixture = await createBackendToolFixture();
		await fixture.sandbox.writeFiles(
			Array.from({ length: 51 }, (_, index) => ({
				content: "export {};",
				path: `${FUNCTION_DIR}/${index === 0 ? "index" : `part-${index}`}.ts`,
			})),
		);
		const tool = createDeployFunctionTool(fixture.deps, fixture.context);

		expect(await executeTool(tool, { slug: "hello-world" })).toEqual({
			reason: "A function has at most 50 files",
			status: "failed",
		});
		expect(fixture.requests).toEqual([]);
	});

	it("answers failed above 5 MB and sends nothing", async () => {
		const fixture = await createBackendToolFixture();
		await fixture.sandbox.writeFiles([
			{
				content: new Uint8Array(5 * 1024 * 1024 + 1),
				path: `${FUNCTION_DIR}/index.ts`,
			},
		]);
		const tool = createDeployFunctionTool(fixture.deps, fixture.context);

		expect(await executeTool(tool, { slug: "hello-world" })).toEqual({
			reason: "The function files are larger than 5 MB",
			status: "failed",
		});
		expect(fixture.requests).toEqual([]);
	});

	it("answers failed when a file read answers null and sends nothing", async () => {
		const fixture = await createBackendToolFixture();
		await fixture.sandbox.writeFiles([
			{
				content: "Deno.serve(() => new Response('hi'));",
				path: `${FUNCTION_DIR}/index.ts`,
			},
		]);
		// The Vercel read of a folder entry fails; the fake answers null.
		fixture.sandbox.readFile = async () => null;
		const tool = createDeployFunctionTool(fixture.deps, fixture.context);

		expect(await executeTool(tool, { slug: "hello-world" })).toEqual({
			reason:
				"Could not read supabase/functions/hello-world/index.ts. Keep the function files in one flat folder",
			status: "failed",
		});
		expect(fixture.requests).toEqual([]);
	});

	it("answers failed and warns when the folder list throws", async () => {
		const fixture = await createBackendToolFixture();
		fixture.sandbox.listFiles = async () => {
			throw new Error("ENOENT");
		};
		const tool = createDeployFunctionTool(fixture.deps, fixture.context);

		expect(await executeTool(tool, { slug: "hello-world" })).toEqual({
			reason: "supabase/functions/hello-world/ has no files",
			status: "failed",
		});
		expect(fixture.requests).toEqual([]);
		expect(fixture.warnings.map((line) => line.message)).toEqual([
			"host-tool.deploy_function.list-failed",
		]);
	});

	it("answers failed for a function folder with no files", async () => {
		const fixture = await createBackendToolFixture();
		const tool = createDeployFunctionTool(fixture.deps, fixture.context);

		expect(await executeTool(tool, { slug: "hello-world" })).toEqual({
			reason: "supabase/functions/hello-world/ has no files",
			status: "failed",
		});
		expect(fixture.requests).toEqual([]);
	});
});
