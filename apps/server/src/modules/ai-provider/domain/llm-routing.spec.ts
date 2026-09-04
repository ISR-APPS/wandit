// The parser lives in @wandit/env (shared by the env schema, the provider
// seam, and Trigger config assertions); its tests live here because
// packages/env has no test runner.
import { LLM_TASKS, parseLlmProviderOverrides } from "@wandit/env/llm-routing";
import { describe, expect, it } from "vitest";

describe("parseLlmProviderOverrides", () => {
	it("returns no overrides for unset or blank values", () => {
		expect(parseLlmProviderOverrides(undefined)).toEqual({
			errors: [],
			overrides: {},
		});
		expect(parseLlmProviderOverrides("   ")).toEqual({
			errors: [],
			overrides: {},
		});
	});

	it("parses every routable task with surrounding whitespace", () => {
		const raw = LLM_TASKS.map((task) => ` ${task} = openrouter `).join(",");

		expect(parseLlmProviderOverrides(raw)).toEqual({
			errors: [],
			overrides: {
				chat: "openrouter",
				marketing: "openrouter",
				page_build: "openrouter",
				project_title: "openrouter",
				prompt_refine: "openrouter",
			},
		});
	});

	it("keeps valid entries while reporting the broken ones", () => {
		const { errors, overrides } = parseLlmProviderOverrides(
			"page_build=openrouter,builder=openrouter,chat=upstream,marketing",
		);

		expect(overrides).toEqual({ page_build: "openrouter" });
		expect(errors).toEqual([
			expect.stringContaining('unknown task "builder"'),
			expect.stringContaining('unknown provider "upstream"'),
			expect.stringContaining('"marketing" must use the task=provider form'),
		]);
	});

	it("rejects media tasks with the pinned-to-Vercel message", () => {
		for (const task of ["image", "transcription", "audio"]) {
			const { errors, overrides } = parseLlmProviderOverrides(
				`${task}=openrouter`,
			);

			expect(overrides).toEqual({});
			expect(errors).toEqual([
				expect.stringContaining(`"${task}" is pinned to the Vercel gateway`),
			]);
		}
	});

	it("rejects a task named twice", () => {
		const { errors, overrides } = parseLlmProviderOverrides(
			"chat=openrouter,chat=vercel",
		);

		expect(overrides).toEqual({ chat: "openrouter" });
		expect(errors).toEqual([
			expect.stringContaining('names task "chat" twice'),
		]);
	});
});
