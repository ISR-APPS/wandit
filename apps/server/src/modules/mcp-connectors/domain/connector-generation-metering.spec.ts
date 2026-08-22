import { describe, expect, it } from "vitest";

import {
	connectorGatewayCaptures,
	connectorGenerationPlan,
	connectorGenerationReference,
	connectorProviderJobId,
	sanitizeProviderReceipt,
} from "./connector-generation-metering";

describe("connector generation metering", () => {
	it("classifies explicit connector-only, image, and video generation sets", () => {
		expect(connectorGenerationPlan("generate_audio", {})).toEqual({});
		expect(connectorGenerationPlan("generate_image", { count: 3 })).toEqual({
			childOperation: "image",
			childUnits: 3,
		});
		expect(connectorGenerationPlan("outpaint-image", {})).toEqual({
			childOperation: "image",
			childUnits: 1,
		});
		expect(connectorGenerationPlan("reframe", {})).toEqual({
			childOperation: "image",
			childUnits: 1,
		});
		expect(connectorGenerationPlan("generateVideo", {})).toEqual({
			childOperation: "video",
			childUnits: 1,
		});
		expect(connectorGenerationPlan("ads_get_ad_accounts", {})).toBeNull();
	});

	it("reads the requested image count from Higgsfield's nested params", () => {
		expect(
			connectorGenerationPlan("generate_image", { params: { count: 4 } }),
		).toEqual({
			childOperation: "image",
			childUnits: 4,
		});
		expect(
			connectorGenerationPlan("generate_image", {
				params: JSON.stringify({ count: 3, prompt: "a vase" }),
			}),
		).toEqual({
			childOperation: "image",
			childUnits: 3,
		});
		// Top-level count still wins when no nested params carry one.
		expect(
			connectorGenerationPlan("generate_image", {
				count: 2,
				params: { prompt: "a vase" },
			}),
		).toEqual({
			childOperation: "image",
			childUnits: 2,
		});
	});

	it("builds a stable operation reference from the tool-call identity", () => {
		const input = {
			connectorSlug: "higgsfield",
			parentEventId: "chat-event",
			toolCallId: "call-7",
			toolName: "generateVideo",
			userId: "user-1",
		};

		expect(connectorGenerationReference(input)).toBe(
			"mcp:user-1:chat-event:higgsfield:generate_video:call-7",
		);
		expect(connectorGenerationReference(input)).toBe(
			connectorGenerationReference(input),
		);
	});

	it("captures every distinct gateway generation id from nested JSON text", () => {
		const captures = connectorGatewayCaptures({
			content: [
				{
					text: JSON.stringify({
						providerMetadata: { gateway: { generationId: "gen-1" } },
					}),
				},
			],
			providerMetadata: { gateway: { generationId: "gen-2" } },
			repeated: { gateway: { generationId: "gen-1" } },
		});

		expect(
			captures.map(
				(capture) =>
					(capture.providerMetadata as { gateway: { generationId: string } })
						.gateway.generationId,
			),
		).toEqual(["gen-1", "gen-2"]);
	});

	it("fails closed for unknown tools on monetized connectors and open elsewhere", () => {
		// Unknown Higgsfield tool: connector-billed (1 cc hold), tracked.
		expect(connectorGenerationPlan("lipsync_pro", {}, "higgsfield")).toEqual(
			{},
		);
		// Known free surfaces stay unmetered.
		expect(connectorGenerationPlan("job_status", {}, "higgsfield")).toBeNull();
		expect(
			connectorGenerationPlan("media_import_url", {}, "higgsfield"),
		).toBeNull();
		expect(
			connectorGenerationPlan("list_workspaces", {}, "higgsfield"),
		).toBeNull();
		expect(connectorGenerationPlan("get_cost", {}, "higgsfield")).toBeNull();
		// Non-monetized connectors keep the open default; recovery callers pass
		// no slug and keep it too.
		expect(connectorGenerationPlan("lipsync_pro", {}, "meta-ads")).toBeNull();
		expect(connectorGenerationPlan("lipsync_pro", {})).toBeNull();
		// Registered generations are unaffected by the slug.
		expect(connectorGenerationPlan("generate_video", {}, "higgsfield")).toEqual(
			{ childOperation: "video", childUnits: 1 },
		);
	});

	it("extracts the provider job id from a submit receipt but not echoed request ids", () => {
		expect(
			connectorProviderJobId({
				content: [
					{
						text: JSON.stringify({ job_set_id: "js-1", request_id: "req-9" }),
						type: "text",
					},
				],
			}),
		).toBe("js-1");
		expect(
			connectorProviderJobId({ jobs: [{ id: "x", job_id: "job-2" }] }),
		).toBe("job-2");
		expect(connectorProviderJobId({ request_id: "req-9" })).toBeNull();
		expect(connectorProviderJobId("not json")).toBeNull();
	});

	it("bounds the stored receipt preview", () => {
		expect(sanitizeProviderReceipt({ a: 1 })).toEqual({ a: 1 });
		expect(sanitizeProviderReceipt({ a: "x".repeat(5_000) })).toMatchObject({
			truncated: true,
		});
	});
});
