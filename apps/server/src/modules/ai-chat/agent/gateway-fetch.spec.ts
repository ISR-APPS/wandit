import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { chatGatewayFetch } from "./gateway-fetch";

// Regression for WANDIT-SERVER-A: the wrapper once handed a raw npm undici
// v8 Agent to Node's BUILT-IN fetch, whose bundled undici speaks the legacy
// dispatch-handler interface — every request threw InvalidArgumentError
// ("invalid onRequestStart method") before reaching the network, so no chat
// turn could start. Types could not catch it (the dispatcher option is
// casted); only a real dispatch exercises the handler handshake.
describe("chatGatewayFetch", () => {
	let server: Server;
	let baseUrl: string;

	beforeAll(async () => {
		server = createServer((request, response) => {
			let body = "";
			request.on("data", (chunk: Buffer) => {
				body += chunk.toString();
			});
			request.on("end", () => {
				response.writeHead(200, { "content-type": "application/json" });
				response.end(JSON.stringify({ body, method: request.method }));
			});
		});
		await new Promise<void>((resolve) => {
			server.listen(0, "127.0.0.1", resolve);
		});
		const address = server.address();

		if (address === null || typeof address === "string") {
			throw new Error("expected the test server to bind a TCP port");
		}

		baseUrl = `http://127.0.0.1:${address.port}`;
	});

	afterAll(async () => {
		await new Promise<void>((resolve, reject) => {
			server.close((error) => (error ? reject(error) : resolve()));
		});
	});

	it("completes a real dispatch through the long-idle agent", async () => {
		const response = await chatGatewayFetch(`${baseUrl}/v1/ai/language`, {
			body: JSON.stringify({ prompt: "ping" }),
			headers: { "content-type": "application/json" },
			method: "POST",
		});

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			body: JSON.stringify({ prompt: "ping" }),
			method: "POST",
		});
	});

	it("honors abort signals like the AI SDK expects", async () => {
		const controller = new AbortController();

		controller.abort();

		await expect(
			chatGatewayFetch(`${baseUrl}/v1/ai/language`, {
				method: "POST",
				signal: controller.signal,
			}),
		).rejects.toMatchObject({ name: "AbortError" });
	});
});
