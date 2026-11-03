import { createServer } from "node:http";

import { describe, expect, it } from "vitest";

import {
	LangfuseExporter,
	type LangfuseResource,
	type LlmGeneration,
	langfuseOtlpBody,
} from "./langfuse-exporter";

const resource: LangfuseResource = { environment: "test", release: undefined };

function generation(overrides: Partial<LlmGeneration> = {}): LlmGeneration {
	return {
		claims: {
			runId: "run_1",
			// Upper case: the trace id must still be lower-case hex.
			turnId: "AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE",
			userId: "user_1",
			projectId: "11111111-2222-4333-8444-555555555555",
			workspaceId: null,
			plan: "pro",
			capUsd: 1,
			exp: 2_000_000_000,
		},
		provider: "anthropic",
		modelId: "anthropic/claude-sonnet-5",
		claudeSessionId: null,
		upstreamRequestId: null,
		status: "ok",
		reason: null,
		usage: {
			inputTokens: 120,
			outputTokens: 17,
			cacheReadTokens: 30,
			cacheWriteTokens: 40,
		},
		usdMicros: 576,
		startedAt: 1_700_000_000_000,
		endedAt: 1_700_000_001_000,
		forwardedBody: Buffer.from('{"model":"anthropic/claude-sonnet-5"}', "utf8"),
		message: {
			id: "msg_1",
			model: null,
			content: [{ type: "text", text: "Hi" }],
			stopReason: "end_turn",
			streamError: null,
			firstTokenAt: null,
		},
		upstreamErrorBody: null,
		...overrides,
	};
}

describe("langfuseOtlpBody", () => {
	it("puts a call in its turn's trace with the billed cost in USD", () => {
		const body = langfuseOtlpBody(generation(), resource);

		expect(JSON.parse(body)).toMatchObject({
			resourceSpans: [
				{
					scopeSpans: [
						{
							spans: [
								{
									traceId: "aaaaaaaabbbb4ccc8dddeeeeeeeeeeee",
									attributes: expect.arrayContaining([
										{
											key: "langfuse.observation.cost_details",
											value: { stringValue: '{"total":0.000576}' },
										},
									]),
								},
							],
						},
					],
				},
			],
		});
	});

	it("drops the input, not the call, when the escaped body is over the Langfuse request cap", () => {
		// 3 MB of escaped quotes: under the cap raw, about 6 MB after JSON escaping.
		const forwardedBody = Buffer.from(
			`{"messages":[{"role":"user","content":"${'\\"'.repeat(1_500_000)}"}]}`,
			"utf8",
		);

		const body = langfuseOtlpBody(generation({ forwardedBody }), resource);

		expect(Buffer.byteLength(body, "utf8")).toBeLessThan(4_500_000);
		expect(JSON.parse(body)).toMatchObject({
			resourceSpans: [
				{
					scopeSpans: [
						{
							spans: [
								{
									attributes: expect.arrayContaining([
										{
											key: "langfuse.observation.input",
											value: {
												stringValue: expect.stringMatching(/^\[input omitted/),
											},
										},
									]),
								},
							],
						},
					],
				},
			],
		});
	});
});

describe("LangfuseExporter", () => {
	it("sends at most 8 exports at once and a failed export does not reject", async () => {
		let received = 0;
		const server = createServer((request, response) => {
			received += 1;
			request.resume();
			request.on("end", () => {
				response.writeHead(500);
				response.end("down");
			});
		});
		await new Promise<void>((resolve) => {
			server.listen(0, "127.0.0.1", resolve);
		});
		const address = server.address();
		if (typeof address !== "object" || address === null) {
			throw new Error("Fake Langfuse has no address");
		}
		try {
			const exporter = new LangfuseExporter(
				`http://127.0.0.1:${address.port}/api/public/otel/v1/traces`,
				"Basic dGVzdA==",
				resource,
			);

			for (let call = 0; call < 9; call += 1) {
				exporter.send(generation());
			}
			await exporter.onApplicationShutdown();

			// The ninth call is dropped. Vitest fails the run on an unhandled rejection.
			expect(received).toBe(8);
		} finally {
			server.closeAllConnections();
			await new Promise<void>((resolve, reject) => {
				server.close((error) => (error ? reject(error) : resolve()));
			});
		}
	});
});
