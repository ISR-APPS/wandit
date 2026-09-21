import { describe, expect, it } from "vitest";

import { SandboxForkNotSupportedError } from "../../domain/errors/sandbox-fork-not-supported.error";
import type { SandboxCreateOptions } from "../../domain/ports/sandbox-provider";
import { FakeSandboxProvider } from "./fake-sandbox.provider";

const CREATE_OPTIONS: SandboxCreateOptions = {
	devCommand: "pnpm dev",
	devPort: 3000,
	env: {},
	framework: "web-app",
	organizationId: null,
	ownerUserId: "user-1",
	templateVersion: "web-app@1.0.0",
};

describe("FakeSandboxProvider", () => {
	it("returns the same handle on a second getOrCreate and adds no sandbox", async () => {
		const provider = new FakeSandboxProvider();

		const first = await provider.getOrCreate("p1", CREATE_OPTIONS);
		const second = await provider.getOrCreate("p1", CREATE_OPTIONS);

		expect(second).toBe(first);
		expect(provider.createdCount).toBe(1);
	});

	it("round-trips a file written with writeFiles", async () => {
		const provider = new FakeSandboxProvider();
		const handle = await provider.getOrCreate("p1", CREATE_OPTIONS);

		await handle.writeFiles([{ content: "hello", path: "/app/src/index.ts" }]);

		const bytes = await handle.readFile("/app/src/index.ts");
		expect(bytes).not.toBeNull();
		expect(new TextDecoder().decode(bytes ?? undefined)).toBe("hello");
	});

	it("throws SandboxForkNotSupportedError on fork", async () => {
		const provider = new FakeSandboxProvider();

		await expect(provider.fork("p1")).rejects.toBeInstanceOf(
			SandboxForkNotSupportedError,
		);
	});

	it("answers exec from the scripted list", async () => {
		const provider = new FakeSandboxProvider();
		provider.respondTo("pnpm", {
			exitCode: 0,
			stderr: "",
			stdout: "ok",
		});
		const handle = await provider.getOrCreate("p1", CREATE_OPTIONS);

		const result = await handle.exec("pnpm", ["install"]);

		expect(result.exitCode).toBe(0);
	});
});
