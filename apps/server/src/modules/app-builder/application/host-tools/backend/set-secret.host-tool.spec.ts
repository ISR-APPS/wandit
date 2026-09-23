import { describe, expect, it } from "vitest";

import { jsonResponse } from "../../../infrastructure/supabase/fake-supabase-fetch";
import {
	createBackendToolFixture,
	executeTool,
	FAKE_NOW,
} from "./fake-backend-tool-deps";
import { createSetSecretTool } from "./set-secret.host-tool";

const STORED_VALUE = "sk_test_stored_value_1";

describe("set_secret", () => {
	it("pushes the stored value, stamps the sync, and never answers or logs the value", async () => {
		const fixture = await createBackendToolFixture({
			answers: [jsonResponse(201, "")],
			storedSecrets: new Map([["STRIPE_SECRET_KEY", STORED_VALUE]]),
		});
		const tool = createSetSecretTool(fixture.deps, fixture.context);

		const output = await executeTool(tool, {
			name: "STRIPE_SECRET_KEY",
			source: "project_secret",
		});

		expect(output).toEqual({ name: "STRIPE_SECRET_KEY", status: "synced" });
		expect(fixture.requests[0]?.body).toContain(STORED_VALUE);
		for (const sink of [
			output,
			fixture.infos,
			fixture.warnings,
			fixture.audits,
		]) {
			expect(JSON.stringify(sink)).not.toContain(STORED_VALUE);
		}
		expect(fixture.syncs).toEqual([
			{ at: FAKE_NOW, name: "STRIPE_SECRET_KEY", projectId: "project-1" },
		]);
		expect(fixture.audits).toEqual([
			{
				action: "secret.synced",
				actorUserId: "user-1",
				metadata: { name: "STRIPE_SECRET_KEY", source: "project_secret" },
				organizationId: "org-1",
				projectId: "project-1",
				targetId: "backend-1",
				targetType: "app_backend",
			},
		]);
	});

	it("answers missing and sends nothing when the project has no value", async () => {
		const fixture = await createBackendToolFixture();
		const tool = createSetSecretTool(fixture.deps, fixture.context);

		expect(
			await executeTool(tool, {
				name: "RESEND_API_KEY",
				source: "project_secret",
			}),
		).toEqual({ name: "RESEND_API_KEY", status: "missing" });
		expect(fixture.requests).toEqual([]);
		expect(fixture.syncs).toEqual([]);
	});

	it("generates, stores, and pushes a 32-byte value when none exists", async () => {
		const fixture = await createBackendToolFixture({
			answers: [jsonResponse(201, "")],
		});
		const tool = createSetSecretTool(fixture.deps, fixture.context);

		const output = await executeTool(tool, {
			name: "JWT_SIGNING_KEY",
			source: "generate",
		});

		expect(output).toEqual({ name: "JWT_SIGNING_KEY", status: "synced" });
		expect(fixture.secretSets).toHaveLength(1);
		const generated = fixture.secretSets[0]?.value ?? "";
		// 32 bytes are 43 characters of base64url without padding.
		expect(generated).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(fixture.secretSets[0]?.kind).toBe("user");
		// The org scope of the turn, so the project check of `set` passes.
		expect(fixture.secretSets[0]?.actor).toEqual({
			ip: null,
			scope: {
				actorIsLimitExempt: false,
				kind: "org",
				organizationId: "org-1",
				userId: "user-1",
			},
		});
		expect(JSON.parse(fixture.requests[0]?.body ?? "null")).toEqual([
			{ name: "JWT_SIGNING_KEY", value: generated },
		]);
		expect(
			JSON.stringify([output, fixture.infos, fixture.audits]),
		).not.toContain(generated);
	});

	it("stores a generated value with the personal scope of a personal project", async () => {
		const fixture = await createBackendToolFixture({
			answers: [jsonResponse(201, "")],
		});
		const tool = createSetSecretTool(fixture.deps, {
			...fixture.context,
			organizationId: null,
		});

		await executeTool(tool, { name: "JWT_SIGNING_KEY", source: "generate" });

		expect(fixture.secretSets[0]?.actor).toEqual({
			ip: null,
			scope: { kind: "personal", userId: "user-1" },
		});
	});

	it("keeps an existing value on generate and pushes it", async () => {
		const fixture = await createBackendToolFixture({
			answers: [jsonResponse(201, "")],
			storedSecrets: new Map([["JWT_SIGNING_KEY", STORED_VALUE]]),
		});
		const tool = createSetSecretTool(fixture.deps, fixture.context);

		await executeTool(tool, { name: "JWT_SIGNING_KEY", source: "generate" });

		expect(fixture.secretSets).toEqual([]);
		expect(JSON.parse(fixture.requests[0]?.body ?? "null")).toEqual([
			{ name: "JWT_SIGNING_KEY", value: STORED_VALUE },
		]);
	});
});
