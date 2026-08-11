import { connectorGenerationMediaSchema } from "@wandit/contracts";
import { z } from "zod";

import type { ConnectorGenerationsRepository } from "../../connector-generations/infrastructure/persistence/connector-generations.repository";
import type { ImageGenerationsRepository } from "../../image-generations/infrastructure/persistence/image-generations.repository";
import type { MediaGenerationsRepository } from "../../media-generations/infrastructure/persistence/media-generations.repository";
import type { ProjectScope } from "../../projects/domain/project-scope";
import type { WanditUIMessage } from "./chat-agent";

/**
 * Every generation tool answers with a queue receipt — the finished asset
 * lands on a database row that only the browser reads. The model therefore
 * never sees a generated asset's URL, and when asked to "put the video in
 * the page" it can only ask the user to re-attach something Wandit itself
 * produced. Mirror of annotate-file-parts: follow every SETTLED generation
 * tool part with one text marker exposing the finished hosted URL(s) as
 * readable text. Applied to the MODEL-BOUND copy only; the persisted
 * transcript is untouched.
 */
export type AnnotateGeneratedAssetsDeps = {
	connectorGenerationsRepository: ConnectorGenerationsRepository;
	imageGenerationsRepository: ImageGenerationsRepository;
	mediaGenerationsRepository: MediaGenerationsRepository;
	projectId: string;
	/** Chat scope — connector attempts follow the payer snapshot, so a
	    teammate's transcript resolves markers in a shared org chat. */
	scope: ProjectScope;
};

// Markers are resubmitted with the whole transcript on every request — keep
// only the newest attempts' MARKERS so a media-heavy chat stays cheap. The
// cap counts emitted markers, never marker-less (pending/failed) attempts.
const MAX_ANNOTATED_ATTEMPTS = 12;
// Bound for the id lookups themselves in a generation-heavy transcript.
const MAX_LOOKUP_ATTEMPTS = 60;

const connectorMediaListSchema = z.array(connectorGenerationMediaSchema);

type GenerationFamily = "connector" | "image" | "video";

type GenerationRef = {
	attemptId: string;
	family: GenerationFamily;
};

export async function annotateGeneratedAssets(
	messages: readonly WanditUIMessage[],
	deps: AnnotateGeneratedAssetsDeps,
): Promise<WanditUIMessage[]> {
	const referenced = new Map<string, GenerationRef>();

	for (const message of messages) {
		if (message.role !== "assistant") {
			continue;
		}

		for (const part of message.parts) {
			const ref = generationRef(part);

			if (ref && !referenced.has(ref.attemptId)) {
				referenced.set(ref.attemptId, ref);
			}
		}
	}

	if (referenced.size === 0) {
		return [...messages];
	}

	// Transcript order === insertion order; the newest attempts win when
	// either bound applies.
	const lookup = new Set([...referenced.keys()].slice(-MAX_LOOKUP_ATTEMPTS));
	const refs = [...referenced.values()].filter((ref) =>
		lookup.has(ref.attemptId),
	);
	const idsOf = (family: GenerationFamily) =>
		refs.filter((ref) => ref.family === family).map((ref) => ref.attemptId);

	const imageIds = idsOf("image");
	const videoIds = idsOf("video");
	const connectorIds = idsOf("connector");
	const [imageRows, videoRows, connectorRows] = await Promise.all([
		imageIds.length > 0
			? deps.imageGenerationsRepository.listSucceededByIdsForProject(
					deps.projectId,
					imageIds,
				)
			: [],
		videoIds.length > 0
			? deps.mediaGenerationsRepository.listSucceededByIdsForProject(
					deps.projectId,
					videoIds,
				)
			: [],
		connectorIds.length > 0
			? deps.connectorGenerationsRepository.listSucceededByIdsForScope(
					deps.scope,
					connectorIds,
				)
			: [],
	]);

	const markersByAttempt = new Map<string, string>();

	for (const row of imageRows) {
		const lines = (row.images ?? [])
			.filter((image) => typeof image.url === "string" && image.url)
			.map((image) => `[Generated image (${image.mediaType}): ${image.url}]`);

		if (lines.length > 0) {
			markersByAttempt.set(row.id, lines.join("\n"));
		}
	}

	for (const row of videoRows) {
		if (row.videoUrl) {
			markersByAttempt.set(
				row.id,
				`[Generated video (${row.videoMediaType ?? "video/mp4"}): ${row.videoUrl}]`,
			);
		}
	}

	for (const row of connectorRows) {
		const media = connectorMediaListSchema.safeParse(row.media);

		if (!media.success) {
			continue;
		}

		const lines = media.data.map(
			(item) => `[Generated ${item.kind}: ${item.url}]`,
		);

		if (lines.length > 0) {
			markersByAttempt.set(row.id, lines.join("\n"));
		}
	}

	if (markersByAttempt.size === 0) {
		return [...messages];
	}

	// The marker cap counts attempts that actually produced markers — a run
	// of pending/failed attempts must never evict an older succeeded asset's
	// URL. Newest markers win, in transcript order.
	const kept = [...referenced.keys()]
		.filter((attemptId) => markersByAttempt.has(attemptId))
		.slice(-MAX_ANNOTATED_ATTEMPTS);

	for (const attemptId of [...markersByAttempt.keys()]) {
		if (!kept.includes(attemptId)) {
			markersByAttempt.delete(attemptId);
		}
	}

	// One marker per attempt, after the FIRST part that referenced it (a
	// dedup replay of the same attempt must not duplicate the marker).
	const emitted = new Set<string>();

	return messages.map((message) => {
		if (
			message.role !== "assistant" ||
			!message.parts.some((part) => {
				const ref = generationRef(part);
				return ref ? markersByAttempt.has(ref.attemptId) : false;
			})
		) {
			return message;
		}

		const parts = message.parts.flatMap<WanditUIMessage["parts"][number]>(
			(part) => {
				const ref = generationRef(part);
				const marker = ref ? markersByAttempt.get(ref.attemptId) : undefined;

				if (!ref || !marker || emitted.has(ref.attemptId)) {
					return [part];
				}

				emitted.add(ref.attemptId);
				return [part, { text: marker, type: "text" }];
			},
		);

		return { ...message, parts };
	});
}

export type ConversationGeneratedAsset = {
	/** Marker kind: "image", "video", or a connector media kind. */
	kind: string;
	url: string;
};

// Exact shape of the marker lines emitted above — kind, optional media type,
// then the hosted URL. Parser and emitter live in this file on purpose: a
// format change must update both or the specs below fail.
const generatedMarkerLineRegex =
	/^\[Generated ([a-z-]+)(?: \(([^)]+)\))?: (https?:\/\/\S+)\]$/;

/**
 * Read the [Generated …] markers back out of an annotated (model-bound)
 * transcript. This is the ONE list of finished, project-verified asset URLs
 * the conversation produced — generate_page appends it to the brief so a
 * build can never lose the user's generated media to a forgetful brief.
 */
export function generatedAssetsFromAnnotatedMessages(
	messages: readonly WanditUIMessage[],
): ConversationGeneratedAsset[] {
	const assets: ConversationGeneratedAsset[] = [];
	const seen = new Set<string>();

	for (const message of messages) {
		if (message.role !== "assistant") {
			continue;
		}

		for (const part of message.parts) {
			if (part.type !== "text") {
				continue;
			}

			for (const line of part.text.split("\n")) {
				const match = generatedMarkerLineRegex.exec(line.trim());

				if (match?.[1] && match[3] && !seen.has(match[3])) {
					seen.add(match[3]);
					assets.push({ kind: match[1], url: match[3] });
				}
			}
		}
	}

	return assets;
}

function generationRef(
	part: WanditUIMessage["parts"][number],
): GenerationRef | null {
	if (part.type === "tool-generate_image") {
		const attemptId =
			part.state === "output-available" ? queuedAttemptId(part.output) : null;

		return attemptId ? { attemptId, family: "image" } : null;
	}

	if (
		part.type === "tool-generate_video" ||
		part.type === "tool-animate_image"
	) {
		const attemptId =
			part.state === "output-available" ? queuedAttemptId(part.output) : null;

		return attemptId ? { attemptId, family: "video" } : null;
	}

	if (part.type === "dynamic-tool" && part.state === "output-available") {
		const attemptId = queuedAttemptId(part.output);

		return attemptId ? { attemptId, family: "connector" } : null;
	}

	return null;
}

// The queue receipts share one shape marker: status "queued" + attemptId.
// (The connector receipt carries more fields; they are irrelevant here.)
function queuedAttemptId(output: unknown): string | null {
	if (typeof output !== "object" || output === null) {
		return null;
	}

	const record = output as { attemptId?: unknown; status?: unknown };

	return record.status === "queued" && typeof record.attemptId === "string"
		? record.attemptId
		: null;
}
