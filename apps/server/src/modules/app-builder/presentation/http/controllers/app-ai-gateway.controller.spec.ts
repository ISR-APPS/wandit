import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { readAudioUpload } from "./app-ai-gateway.controller";

const BOUNDARY = "app-ai-test-boundary";
// 5 MiB: large enough that the parser pauses inside the file part.
const FILE_BYTES = 5 * 1024 * 1024;

describe("readAudioUpload", () => {
	// Money: a lost model field makes the default model serve and bill the call.
	it("reads a model field that comes after a large file", async () => {
		const app = Fastify();
		await app.register(multipart, {
			limits: { fileSize: 15 * 1024 * 1024, files: 1 },
		});
		app.post("/transcriptions", async (request) => {
			const upload = await readAudioUpload(request);
			return { model: upload.model, bytes: upload.audio.length };
		});
		const body = Buffer.concat([
			Buffer.from(
				`--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="a.wav"\r\nContent-Type: audio/wav\r\n\r\n`,
			),
			Buffer.alloc(FILE_BYTES, 1),
			Buffer.from(
				`\r\n--${BOUNDARY}\r\nContent-Disposition: form-data; name="model"\r\n\r\nopenai/gpt-transcribe\r\n--${BOUNDARY}--\r\n`,
			),
		]);
		try {
			// A real socket, not `inject`: the bug shows only when the body comes in many chunks.
			const address = await app.listen({ port: 0, host: "127.0.0.1" });
			const response = await fetch(`${address}/transcriptions`, {
				method: "POST",
				headers: {
					"content-type": `multipart/form-data; boundary=${BOUNDARY}`,
				},
				body,
			});
			expect(await response.json()).toEqual({
				model: "openai/gpt-transcribe",
				bytes: FILE_BYTES,
			});
		} finally {
			await app.close();
		}
	});
});
