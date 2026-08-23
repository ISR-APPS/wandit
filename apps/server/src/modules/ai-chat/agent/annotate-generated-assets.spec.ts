import { describe, expect, it, vi } from "vitest";
import { HIGGSFIELD_MULTISHOT_AUDIO_MODEL } from "../../mcp-connectors/domain/higgsfield-models";
import {
	type AnnotateGeneratedAssetsDeps,
	annotateGeneratedAssets,
	generatedAssetsFromAnnotatedMessages,
} from "./annotate-generated-assets";
import type { WanditUIMessage } from "./chat-agent";

const IMAGE_ATTEMPT = "11111111-1111-4111-8111-111111111111";
const VIDEO_ATTEMPT = "22222222-2222-4222-8222-222222222222";
const EDIT_ATTEMPT = "22222222-2222-4222-8222-222222222223";
const EXTEND_ATTEMPT = "22222222-2222-4222-8222-222222222224";
const PRODUCT_ATTEMPT = "22222222-2222-4222-8222-222222222225";
const CONNECTOR_ATTEMPT = "33333333-3333-4333-8333-333333333333";
const IMAGE_URL = "https://assets.example.com/images/p1/a1/img-1.png";
const VIDEO_URL = "https://assets.example.com/sites/p1/assets/a2/vid-1.mp4";
const CONNECTOR_URL = "https://cdn.higgsfield.ai/renders/final.mp4";

function deps(
	overrides: Partial<{
		connector: unknown[];
		images: unknown[];
		videos: unknown[];
	}> = {},
) {
	const connectorGenerationsRepository = {
		listSucceededByIdsForScope: vi
			.fn()
			.mockResolvedValue(overrides.connector ?? []),
	};
	const imageGenerationsRepository = {
		listSucceededByIdsForProject: vi
			.fn()
			.mockResolvedValue(overrides.images ?? []),
	};
	const mediaGenerationsRepository = {
		listSucceededByIdsForProject: vi
			.fn()
			.mockResolvedValue(overrides.videos ?? []),
	};

	return {
		connectorGenerationsRepository,
		imageGenerationsRepository,
		mediaGenerationsRepository,
		resolved: {
			connectorGenerationsRepository,
			imageGenerationsRepository,
			mediaGenerationsRepository,
			projectId: "project-1",
			scope: { kind: "personal", userId: "user-1" },
		} as unknown as AnnotateGeneratedAssetsDeps,
	};
}

function assistantMessage(
	parts: WanditUIMessage["parts"],
	id = "a1",
): WanditUIMessage {
	return { id, parts, role: "assistant" };
}

function queuedImagePart(attemptId = IMAGE_ATTEMPT) {
	return {
		input: { count: 1, prompt: "a vase", title: "Vase" },
		output: { attemptId, message: "Queued.", status: "queued" },
		state: "output-available",
		toolCallId: `call-${attemptId}`,
		type: "tool-generate_image",
	} as unknown as WanditUIMessage["parts"][number];
}

function queuedConnectorPart(attemptId = CONNECTOR_ATTEMPT) {
	return {
		input: {
			params: { model: HIGGSFIELD_MULTISHOT_AUDIO_MODEL, prompt: "brief" },
		},
		output: {
			attemptId,
			connector: "higgsfield",
			kind: "wandit_background_generation",
			note: "Generation started in the background.",
			status: "queued",
			tool: "generate_video",
		},
		state: "output-available",
		toolCallId: `call-${attemptId}`,
		toolName: "mcp_higgsfield_generate_video",
		type: "dynamic-tool",
	} as unknown as WanditUIMessage["parts"][number];
}

function queuedVideoPart(
	type:
		| "tool-animate_image"
		| "tool-edit_video"
		| "tool-extend_video"
		| "tool-generate_video"
		| "tool-product_video",
	attemptId = VIDEO_ATTEMPT,
) {
	return {
		input: { title: "Video" },
		output: { attemptId, message: "Queued.", status: "queued" },
		state: "output-available",
		toolCallId: `call-${attemptId}`,
		type,
	} as unknown as WanditUIMessage["parts"][number];
}

describe("annotateGeneratedAssets", () => {
	it("follows a settled generate_image part with one marker per image URL", async () => {
		const { resolved } = deps({
			images: [
				{
					id: IMAGE_ATTEMPT,
					images: [
						{ mediaType: "image/png", url: IMAGE_URL },
						{ mediaType: "image/webp", url: `${IMAGE_URL}.webp` },
					],
				},
			],
		});

		const [message] = await annotateGeneratedAssets(
			[assistantMessage([queuedImagePart()])],
			resolved,
		);

		expect(message?.parts.map((part) => part.type)).toEqual([
			"tool-generate_image",
			"text",
		]);
		const marker = message?.parts[1];
		expect(marker?.type === "text" && marker.text).toBe(
			`[Generated image (image/png): ${IMAGE_URL}]\n[Generated image (image/webp): ${IMAGE_URL}.webp]`,
		);
	});

	it("follows a settled connector generation with kind-labeled markers", async () => {
		const { resolved } = deps({
			connector: [
				{
					id: CONNECTOR_ATTEMPT,
					media: [{ kind: "video", url: CONNECTOR_URL }],
				},
			],
		});

		const [message] = await annotateGeneratedAssets(
			[assistantMessage([queuedConnectorPart()])],
			resolved,
		);

		const marker = message?.parts[1];
		expect(marker?.type === "text" && marker.text).toBe(
			`[Generated video: ${CONNECTOR_URL}]`,
		);
	});

	it("follows a settled generate_video part with its video URL and media type", async () => {
		const { resolved } = deps({
			videos: [
				{ id: VIDEO_ATTEMPT, videoMediaType: "video/mp4", videoUrl: VIDEO_URL },
			],
		});

		const [message] = await annotateGeneratedAssets(
			[assistantMessage([queuedVideoPart("tool-generate_video")])],
			resolved,
		);

		const marker = message?.parts[1];
		expect(marker?.type === "text" && marker.text).toBe(
			`[Generated video (video/mp4): ${VIDEO_URL}]`,
		);
	});

	it("follows a settled product_video part with a reusable generated-video marker", async () => {
		const productVideoUrl = `${VIDEO_URL}?attempt=${PRODUCT_ATTEMPT}`;
		const { mediaGenerationsRepository, resolved } = deps({
			videos: [
				{
					id: PRODUCT_ATTEMPT,
					videoMediaType: "video/mp4",
					videoUrl: productVideoUrl,
				},
			],
		});

		const [message] = await annotateGeneratedAssets(
			[
				assistantMessage([
					queuedVideoPart("tool-product_video", PRODUCT_ATTEMPT),
				]),
			],
			resolved,
		);

		expect(
			mediaGenerationsRepository.listSucceededByIdsForProject,
		).toHaveBeenCalledWith("project-1", [PRODUCT_ATTEMPT]);
		const marker = message?.parts[1];
		expect(marker?.type === "text" && marker.text).toBe(
			`[Generated video (video/mp4): ${productVideoUrl}]`,
		);
	});

	it.each([
		["tool-edit_video", EDIT_ATTEMPT],
		["tool-extend_video", EXTEND_ATTEMPT],
	] as const)("follows a settled %s part so revised clips remain reusable sources", async (type, attemptId) => {
		const revisedUrl = `${VIDEO_URL}?attempt=${attemptId}`;
		const { mediaGenerationsRepository, resolved } = deps({
			videos: [
				{
					id: attemptId,
					videoMediaType: "video/mp4",
					videoUrl: revisedUrl,
				},
			],
		});

		const [message] = await annotateGeneratedAssets(
			[assistantMessage([queuedVideoPart(type, attemptId)])],
			resolved,
		);

		expect(
			mediaGenerationsRepository.listSucceededByIdsForProject,
		).toHaveBeenCalledWith("project-1", [attemptId]);
		const marker = message?.parts[1];
		expect(marker?.type === "text" && marker.text).toBe(
			`[Generated video (video/mp4): ${revisedUrl}]`,
		);
	});

	it("adds no marker while the attempt has not succeeded", async () => {
		const { imageGenerationsRepository, resolved } = deps();
		const messages = [assistantMessage([queuedImagePart()])];

		const [message] = await annotateGeneratedAssets(messages, resolved);

		expect(message?.parts).toHaveLength(1);
		expect(
			imageGenerationsRepository.listSucceededByIdsForProject,
		).toHaveBeenCalledWith("project-1", [IMAGE_ATTEMPT]);
	});

	it("caps on EMITTED markers — pending attempts never evict an older succeeded asset", async () => {
		// 1 old succeeded attempt followed by 13 newer pending ones: the cap
		// (12) counts markers, so the single succeeded marker must survive.
		const pendingParts = Array.from({ length: 13 }, (_, index) =>
			queuedImagePart(
				`44444444-4444-4444-8444-4444444444${String(index).padStart(2, "0")}`,
			),
		);
		const { resolved } = deps({
			images: [
				{
					id: IMAGE_ATTEMPT,
					images: [{ mediaType: "image/png", url: IMAGE_URL }],
				},
			],
		});

		const messages = await annotateGeneratedAssets(
			[assistantMessage([queuedImagePart(), ...pendingParts])],
			resolved,
		);

		const markers = messages.flatMap((message) =>
			message.parts.filter((part) => part.type === "text"),
		);
		expect(markers).toHaveLength(1);
		expect(markers[0]?.type === "text" && markers[0].text).toContain(IMAGE_URL);
	});

	it("emits one marker per attempt even when a dedup replay repeats the part", async () => {
		const { resolved } = deps({
			images: [
				{
					id: IMAGE_ATTEMPT,
					images: [{ mediaType: "image/png", url: IMAGE_URL }],
				},
			],
		});

		const messages = await annotateGeneratedAssets(
			[
				assistantMessage([queuedImagePart()], "a1"),
				assistantMessage([queuedImagePart()], "a2"),
			],
			resolved,
		);

		const markers = messages.flatMap((message) =>
			message.parts.filter((part) => part.type === "text"),
		);
		expect(markers).toHaveLength(1);
	});

	it("touches nothing and asks no repository when no generation part exists", async () => {
		const {
			connectorGenerationsRepository,
			imageGenerationsRepository,
			mediaGenerationsRepository,
			resolved,
		} = deps();
		const messages: WanditUIMessage[] = [
			{ id: "u1", parts: [{ text: "salut", type: "text" }], role: "user" },
		];

		const result = await annotateGeneratedAssets(messages, resolved);

		expect(result).toEqual(messages);
		expect(
			imageGenerationsRepository.listSucceededByIdsForProject,
		).not.toHaveBeenCalled();
		expect(
			mediaGenerationsRepository.listSucceededByIdsForProject,
		).not.toHaveBeenCalled();
		expect(
			connectorGenerationsRepository.listSucceededByIdsForScope,
		).not.toHaveBeenCalled();
	});
});

describe("generatedAssetsFromAnnotatedMessages", () => {
	it("reads every marker kind back out of an annotated transcript", async () => {
		const { resolved } = deps({
			connector: [
				{
					id: CONNECTOR_ATTEMPT,
					media: [{ kind: "video", url: CONNECTOR_URL }],
				},
			],
			images: [
				{
					id: IMAGE_ATTEMPT,
					images: [
						{ mediaType: "image/png", url: IMAGE_URL },
						{ mediaType: "image/webp", url: `${IMAGE_URL}.webp` },
					],
				},
			],
		});
		const annotated = await annotateGeneratedAssets(
			[
				assistantMessage([queuedImagePart()]),
				assistantMessage([queuedConnectorPart()], "a2"),
			],
			resolved,
		);

		expect(generatedAssetsFromAnnotatedMessages(annotated)).toEqual([
			{ kind: "image", url: IMAGE_URL },
			{ kind: "image", url: `${IMAGE_URL}.webp` },
			{ kind: "video", url: CONNECTOR_URL },
		]);
	});

	it("dedups repeated URLs and ignores user text that mimics a marker", () => {
		const messages: WanditUIMessage[] = [
			{
				id: "u1",
				parts: [
					{
						text: `[Generated image (image/png): ${IMAGE_URL}]`,
						type: "text",
					},
				],
				role: "user",
			},
			assistantMessage([
				{
					text: `[Generated image (image/png): ${VIDEO_URL}]\n[Generated image (image/png): ${VIDEO_URL}]`,
					type: "text",
				},
				{ text: "plain prose, no marker", type: "text" },
			]),
		];

		expect(generatedAssetsFromAnnotatedMessages(messages)).toEqual([
			{ kind: "image", url: VIDEO_URL },
		]);
	});

	it("returns an empty list for a transcript without markers", () => {
		expect(
			generatedAssetsFromAnnotatedMessages([
				assistantMessage([{ text: "bonjour", type: "text" }]),
			]),
		).toEqual([]);
	});
});
