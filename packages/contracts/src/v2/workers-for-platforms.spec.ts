import { describe, expect, it } from "vitest";

import {
	appWorkerTags,
	assetManifestEntrySchema,
	assetUploadResultSchema,
	assetUploadSessionResultSchema,
	cloudflareEnvelopeSchema,
	cloudflareErrorBodySchema,
	namespaceScriptSchema,
	workerScriptUploadResultSchema,
} from "./workers-for-platforms";

const HASH = "08f1dfda4574284ab3c21666d1ee8c7d";

describe("assetUploadSessionResultSchema", () => {
	it("reads the jwt and the buckets", () => {
		const parsed = cloudflareEnvelopeSchema(
			assetUploadSessionResultSchema,
		).parse({
			success: true,
			errors: [],
			messages: [],
			result: { jwt: "session-jwt", buckets: [[HASH]] },
		});

		expect(parsed.result).toEqual({ jwt: "session-jwt", buckets: [[HASH]] });
	});

	it("gives empty buckets when Cloudflare has every file", () => {
		expect(assetUploadSessionResultSchema.parse({ jwt: "done-jwt" })).toEqual({
			jwt: "done-jwt",
			buckets: [],
		});
	});
});

describe("assetUploadResultSchema", () => {
	const envelope = cloudflareEnvelopeSchema(assetUploadResultSchema);

	it("reads no jwt from a 202 answer", () => {
		const parsed = envelope.parse({
			success: true,
			errors: [],
			messages: [],
			result: {},
		});

		expect(parsed.result?.jwt).toBeUndefined();
	});

	it("reads the completion jwt from the 201 answer", () => {
		const parsed = envelope.parse({
			success: true,
			errors: [],
			messages: [],
			result: { jwt: "completion-jwt" },
		});

		expect(parsed.result?.jwt).toBe("completion-jwt");
	});
});

describe("workerScriptUploadResultSchema", () => {
	it("reads the documented upload answer with null tags", () => {
		const parsed = workerScriptUploadResultSchema.parse({
			created_on: "2022-05-05T05:15:11.602148Z",
			etag: "777f24a43bef5f69174aa69ceaf1dea67968d510a31d1vw3e49d34a0187c06d1",
			handlers: ["fetch"],
			id: "app-2b8e1d7c-4f7a-4a51-9f4e-0f7d6c1b2a3e",
			modified_on: "2022-05-20T19:02:56.446492Z",
			startup_time_ms: 10,
			tags: null,
		});

		expect(parsed.id).toBe("app-2b8e1d7c-4f7a-4a51-9f4e-0f7d6c1b2a3e");
		expect(parsed.tags).toBeNull();
	});
});

describe("namespaceScriptSchema", () => {
	it("reads the script name and the tags of one list item", () => {
		const parsed = namespaceScriptSchema.parse({
			created_on: "2026-09-20T10:00:00Z",
			dispatch_namespace: "production",
			modified_on: "2026-09-21T10:00:00Z",
			script: { id: "app-p1", tags: ["project:p1", "customer:w1"] },
		});

		expect(parsed.script).toEqual({
			id: "app-p1",
			tags: ["project:p1", "customer:w1"],
		});
	});
});

describe("assetManifestEntrySchema", () => {
	it("parses a 32-hex hash with a zero size", () => {
		expect(assetManifestEntrySchema.parse({ hash: HASH, size: 0 })).toEqual({
			hash: HASH,
			size: 0,
		});
	});

	it("refuses a 64-character hash", () => {
		const parsed = assetManifestEntrySchema.safeParse({
			hash: HASH.repeat(2),
			size: 12,
		});

		expect(parsed.success).toBe(false);
	});
});

describe("cloudflareEnvelopeSchema", () => {
	it("yields the error list of a failure answer", () => {
		const parsed = cloudflareEnvelopeSchema(
			workerScriptUploadResultSchema,
		).parse({
			success: false,
			errors: [{ code: 10007, message: "workers.api.error.script_not_found" }],
			messages: [],
			result: null,
		});

		expect(parsed.success).toBe(false);
		expect(parsed.result).toBeNull();
		expect(parsed.errors).toEqual([
			{ code: 10007, message: "workers.api.error.script_not_found" },
		]);
	});

	it("reads the errors of a non-2xx body", () => {
		expect(
			cloudflareErrorBodySchema.parse({
				success: false,
				errors: [{ code: 10000, message: "Authentication error" }],
				messages: [],
				result: null,
			}).errors,
		).toEqual([{ code: 10000, message: "Authentication error" }]);
	});
});

describe("appWorkerTags", () => {
	it("tags the Worker with its project and its workspace", () => {
		expect(appWorkerTags("p1", "w1")).toEqual(["project:p1", "customer:w1"]);
	});
});
