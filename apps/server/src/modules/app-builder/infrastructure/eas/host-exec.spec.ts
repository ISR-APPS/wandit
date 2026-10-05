import { afterEach, describe, expect, it, vi } from "vitest";

import { hostExec } from "./host-exec";

// The absolute path of this Node binary, so the spec never depends on PATH.
const NODE = process.execPath;

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("hostExec", () => {
	it("answers the exit code, stdout, and stderr of a failed child without a rejection", async () => {
		const result = await hostExec(NODE, [
			"-e",
			"process.stdout.write('out'); process.stderr.write('err'); process.exit(3)",
		]);

		expect(result).toEqual({ exitCode: 3, stdout: "out", stderr: "err" });
	});

	it("gives the child the fixed env and options.env, never the worker env", async () => {
		vi.stubEnv("WANDIT_HOST_EXEC_SPEC_SECRET", "database-password");

		const result = await hostExec(
			NODE,
			["-e", "process.stdout.write(Object.keys(process.env).sort().join(','))"],
			{ env: { STEP_VALUE: "1" } },
		);

		expect(result.exitCode).toBe(0);
		// macOS adds `__CF_USER_TEXT_ENCODING` to every process it starts.
		const names = result.stdout
			.split(",")
			.filter((name) => name !== "__CF_USER_TEXT_ENCODING");
		expect(names).toEqual([
			"CI",
			"GIT_TERMINAL_PROMPT",
			"HOME",
			"PATH",
			"STEP_VALUE",
		]);
	});

	it("answers 124 when the timeout stops the child", async () => {
		const result = await hostExec(NODE, ["-e", "setTimeout(() => {}, 10000)"], {
			timeoutMs: 200,
		});

		expect(result.exitCode).toBe(124);
		expect(result.stderr).toContain("timed out after 200 ms");
	});

	it("answers 124 when the timeout stops a child that traps SIGTERM", async () => {
		const result = await hostExec(
			NODE,
			[
				"-e",
				"process.on('SIGTERM', () => process.exit(1)); setTimeout(() => {}, 10000)",
			],
			{ timeoutMs: 200 },
		);

		expect(result.exitCode).toBe(124);
	});

	it("answers 137 when a signal from outside stops the child", async () => {
		const result = await hostExec(NODE, [
			"-e",
			"process.kill(process.pid, 'SIGKILL')",
		]);

		expect(result.exitCode).toBe(137);
		expect(result.stderr).toContain("stopped by SIGKILL");
	});

	it("answers 127 with a fixed stderr when the command does not exist, never the argv", async () => {
		const result = await hostExec("wandit-no-such-command", [
			"--token",
			"secret-jwt",
		]);

		expect(result).toEqual({
			exitCode: 127,
			stdout: "",
			stderr: "wandit-no-such-command failed before exit (ENOENT)",
		});
	});
});
