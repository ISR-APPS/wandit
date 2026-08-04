import { describe, expect, it } from "vitest";

import {
	connectorGatewayCaptures,
	connectorGenerationPlan,
	connectorGenerationReference,
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
});
