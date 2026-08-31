import { aiErrorDataSchema } from "@wandit/contracts";
import {
	BookOpenTextIcon,
	BracesIcon,
	ChevronRightIcon,
	CopyIcon,
	FileIcon,
	ImageIcon,
	MegaphoneIcon,
	PanelsTopLeftIcon,
	PlugZapIcon,
	UsersRoundIcon,
	VideoIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { titleCaseIdentifier } from "@/features/conversations/lib/conversation-formatters";
import { cn } from "@/lib/utils";

import { AiErrorAlert, type InspectorAiError } from "./ai-error-alert";

export type ToolFamily =
	| "image"
	| "video"
	| "page"
	| "marketing"
	| "leads"
	| "mcp"
	| "read"
	| "file"
	| "generic";

export type ToolPartSummary = {
	type: string;
	name: string;
	family: ToolFamily;
	kind: "tool" | "data" | "file" | "reasoning" | "step" | "generic";
	state: string | null;
	stateLabel: string | null;
	digest: string | null;
	input: unknown;
	output: unknown;
};

type ToolPartCardProps = {
	part: unknown;
	index: number;
	failure?: InspectorAiError | null;
};

type MediaPreview = {
	kind: "image" | "video";
	url: string;
	label: string;
};

const DIGEST_MAX_LENGTH = 90;
const MEDIA_PREVIEW_LIMIT = 6;

const familyIcons = {
	file: FileIcon,
	generic: BracesIcon,
	image: ImageIcon,
	leads: UsersRoundIcon,
	marketing: MegaphoneIcon,
	mcp: PlugZapIcon,
	page: PanelsTopLeftIcon,
	read: BookOpenTextIcon,
	video: VideoIcon,
} as const;

export function ToolPartCard({ part, index, failure }: ToolPartCardProps) {
	const summary = getToolPartSummary(part);

	if (summary.kind === "step") {
		return null;
	}

	if (summary.kind === "reasoning") {
		return (
			<p className="flex items-center gap-1.5 py-0.5 text-muted-foreground/60 text-xs italic">
				<span aria-hidden="true" className="size-1 rounded-full bg-current" />
				Thought for a moment
			</p>
		);
	}

	const detectedFailure = failure ?? getToolPartFailure(part);
	const stateLabel = detectedFailure ? "Failed" : summary.stateLabel;
	const previews = detectedFailure
		? []
		: collectMediaPreviews(mediaPreviewSource(part, summary));
	const FamilyIcon = familyIcons[summary.family];
	const hasInputOutputDetails = summary.kind === "tool";

	return (
		<div
			className={cn(
				"overflow-hidden rounded-md border bg-muted/15",
				detectedFailure && "border-destructive/35 border-s-2",
			)}
			data-part-type={summary.type}
			data-tool-failure={detectedFailure ? "true" : undefined}
		>
			<details className="group">
				<summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 px-2.5 py-2 text-sm outline-none marker:content-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset">
					<span className="flex size-6 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
						<FamilyIcon aria-hidden="true" className="size-3.5" />
					</span>
					<span
						className="max-w-28 shrink-0 truncate font-medium text-xs sm:max-w-52"
						title={summary.name}
					>
						{summary.name}
					</span>
					{stateLabel ? <StateBadge label={stateLabel} /> : null}
					{summary.digest ? (
						<span
							className="min-w-0 flex-1 truncate text-muted-foreground text-xs"
							title={summary.digest}
						>
							{summary.digest}
						</span>
					) : (
						<span className="flex-1" />
					)}
					<ChevronRightIcon
						aria-hidden="true"
						className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
					/>
				</summary>

				<section
					className="border-t bg-background/60 p-2.5"
					aria-label={`Message part ${index + 1} details`}
				>
					{hasInputOutputDetails ? (
						<div className="grid items-start gap-2.5 md:grid-cols-2">
							<JsonBlock label="Input JSON" value={summary.input} />
							<JsonBlock label="Output JSON" value={summary.output} />
						</div>
					) : (
						<JsonBlock label="Part JSON" value={part} />
					)}
				</section>
			</details>

			{detectedFailure ? (
				<div className="border-destructive/20 border-t">
					<AiErrorAlert
						failure={detectedFailure}
						label={`${summary.name} failed`}
						compact
					/>
				</div>
			) : null}

			{previews.length > 0 ? <MediaPreviews previews={previews} /> : null}
		</div>
	);
}

/** Normalize any stored part without trusting its runtime shape. */
function getToolPartSummary(part: unknown): ToolPartSummary {
	const record = asRecord(part);
	const type = safeString(safeGet(record, "type")) ?? "unknown";
	const input = safeGet(record, "input");
	const output = safeGet(record, "output");
	const state = safeString(safeGet(record, "state"));
	const kind = partKind(type);
	const rawToolName =
		type === "dynamic-tool"
			? safeString(safeGet(record, "toolName"))
			: type.startsWith("tool-")
				? type.slice("tool-".length)
				: null;
	const identifier =
		rawToolName ??
		(type.startsWith("data-") ? type.slice("data-".length) : type);
	const family = toolFamily(type, rawToolName, record);
	const failed = isToolPartFailure(part);

	return {
		type,
		name: partName(type, identifier),
		family,
		kind,
		state,
		stateLabel: toolStateLabel(state, record, output, failed),
		digest: toolDigest({ family, input, record, toolName: rawToolName, type }),
		input,
		output,
	};
}

/** True for failed tool lifecycles and failure-shaped outputs. */
function isToolPartFailure(part: unknown): boolean {
	return getToolPartFailure(part) !== null;
}

/** Returns a structured failure, synthesizing a safe fallback when needed. */
function getToolPartFailure(part: unknown): InspectorAiError | null {
	const record = asRecord(part);
	if (!record) {
		return null;
	}

	const output = asRecord(safeGet(record, "output"));
	const candidates = [
		safeGet(record, "aiError"),
		safeGet(output, "wanditError"),
		safeGet(output, "aiError"),
		safeGet(record, "error"),
		safeGet(output, "error"),
	];

	for (const candidate of candidates) {
		const parsed = parseAiError(candidate);
		if (parsed) {
			return {
				...parsed,
				sentryEventId:
					safeString(safeGet(asRecord(candidate), "sentryEventId")) ??
					safeString(safeGet(record, "sentryEventId")) ??
					safeString(safeGet(output, "sentryEventId")),
			};
		}
	}

	const state = safeString(safeGet(record, "state"));
	const outputStatus = safeString(safeGet(output, "status"));
	const errorText = safeString(safeGet(record, "errorText"));
	const outputErrorText = safeString(safeGet(output, "errorText"));
	const hasFailureSignal =
		state === "output-error" ||
		state === "failed" ||
		outputStatus?.toLowerCase() === "failed" ||
		safeGet(output, "isError") === true ||
		hasValue(safeGet(output, "wanditError")) ||
		hasValue(safeGet(record, "aiError")) ||
		Boolean(errorText || outputErrorText) ||
		hasValue(safeGet(record, "error")) ||
		hasValue(safeGet(output, "error"));

	if (!hasFailureSignal) {
		return null;
	}

	const message = firstMeaningfulString([
		errorText,
		outputErrorText,
		findStringByKeys(safeGet(output, "wanditError"), [
			"providerMessage",
			"message",
			"errorText",
			"error",
		]),
		findStringByKeys(safeGet(record, "aiError"), [
			"providerMessage",
			"message",
			"errorText",
			"error",
		]),
		findStringByKeys(safeGet(output, "error"), [
			"providerMessage",
			"message",
			"errorText",
		]),
		safeString(safeGet(output, "error")),
		safeString(safeGet(record, "error")),
		safeString(safeGet(output, "message")),
	]);

	return {
		kind: "unknown",
		source: "unknown",
		providerLabel: firstMeaningfulString([
			safeString(safeGet(record, "providerLabel")),
			safeString(safeGet(output, "providerLabel")),
			safeString(safeGet(record, "provider")),
			safeString(safeGet(output, "provider")),
		]),
		retryable: false,
		terminal: true,
		refunded: null,
		moderationStage: null,
		providerMessage: message
			? truncateText(message, 240)
			: "The tool did not complete successfully.",
		requestId: firstMeaningfulString([
			safeString(safeGet(record, "requestId")),
			safeString(safeGet(output, "requestId")),
			safeString(safeGet(record, "toolCallId")),
		]),
		sentryEventId:
			safeString(safeGet(record, "sentryEventId")) ??
			safeString(safeGet(output, "sentryEventId")),
	};
}

function StateBadge({ label }: { label: string }) {
	return (
		<Badge
			variant={
				label === "Failed" || label === "Denied" ? "destructive" : "outline"
			}
			className={cn(
				"h-5 px-1.5 py-0 font-mono text-xs",
				label === "Running" && "bg-muted text-muted-foreground",
			)}
		>
			{label}
		</Badge>
	);
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
	const json = stringifyPart(value);

	return (
		<div className="min-w-0">
			<div className="mb-1.5 flex items-center justify-between gap-2">
				<p className="font-medium text-muted-foreground text-xs">{label}</p>
				<Button
					type="button"
					variant="ghost"
					size="icon-xs"
					className="text-muted-foreground"
					aria-label={`Copy ${label.toLowerCase()}`}
					onClick={() => void copyText(json)}
				>
					<CopyIcon aria-hidden="true" />
				</Button>
			</div>
			<pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2.5 font-mono text-xs leading-5">
				{json}
			</pre>
		</div>
	);
}

function MediaPreviews({ previews }: { previews: MediaPreview[] }) {
	return (
		<section
			className="flex gap-2 overflow-x-auto border-t px-2.5 py-2"
			aria-label="Tool output previews"
		>
			{previews.map((preview, previewIndex) => (
				<a
					key={preview.url}
					href={preview.url}
					target="_blank"
					rel="noreferrer"
					referrerPolicy="no-referrer"
					className="group/preview relative block h-20 w-28 shrink-0 overflow-hidden rounded border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
					aria-label={`Open ${preview.kind} preview ${previewIndex + 1} in a new tab`}
					title={preview.label}
				>
					{preview.kind === "image" ? (
						<img
							src={preview.url}
							alt=""
							width={112}
							height={80}
							loading="lazy"
							referrerPolicy="no-referrer"
							className="size-full object-cover transition-opacity group-hover/preview:opacity-85"
						/>
					) : (
						<video
							src={preview.url}
							preload="metadata"
							muted
							playsInline
							className="size-full object-cover transition-opacity group-hover/preview:opacity-85"
						/>
					)}
					<span className="absolute end-1 bottom-1 rounded bg-background/85 px-1 py-0.5 font-medium text-xs">
						{preview.kind}
					</span>
				</a>
			))}
		</section>
	);
}

function partKind(type: string): ToolPartSummary["kind"] {
	if (type === "reasoning") return "reasoning";
	if (type === "step-start") return "step";
	if (type === "file") return "file";
	if (type === "dynamic-tool" || type.startsWith("tool-")) return "tool";
	if (type.startsWith("data-")) return "data";
	return "generic";
}

function partName(type: string, identifier: string): string {
	if (type === "file") return "Attachment";
	if (type === "reasoning") return "Reasoning";
	if (type === "step-start") return "Step";
	if (type === "unknown") return "Unknown part";
	if (type === "dynamic-tool" && identifier === type) return "MCP tool";

	return humanizeIdentifier(identifier);
}

function humanizeIdentifier(value: string): string {
	return titleCaseIdentifier(
		value
			.replace(/^mcp(?:[_:./-]+)?/i, "")
			.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
			.replaceAll(/[.:/]+/g, "_"),
	)
		.replace(/\bAi\b/g, "AI")
		.replace(/\bMcp\b/g, "MCP")
		.replace(/\bId\b/g, "ID")
		.replace(/\bUrl\b/g, "URL")
		.trim();
}

function toolFamily(
	type: string,
	toolName: string | null,
	record: Record<string, unknown> | null,
): ToolFamily {
	if (type === "dynamic-tool") return "mcp";

	const mediaType = safeString(safeGet(record, "mediaType"))?.toLowerCase();
	if (type === "file" && mediaType?.startsWith("image/")) return "image";
	if (type === "file" && mediaType?.startsWith("video/")) return "video";
	if (type === "file") return "file";

	const identifier = `${type} ${toolName ?? ""}`.toLowerCase();
	if (identifier.includes("image")) return "image";
	if (identifier.includes("video") || identifier.includes("animate")) {
		return "video";
	}
	if (identifier.includes("marketing")) return "marketing";
	if (identifier.includes("lead")) return "leads";
	if (/\b(?:read|inspect|get)_/.test(identifier)) return "read";
	if (
		identifier.includes("page") ||
		identifier.includes("section") ||
		identifier.includes("element") ||
		identifier.includes("theme")
	) {
		return "page";
	}

	return "generic";
}

function toolStateLabel(
	state: string | null,
	record: Record<string, unknown> | null,
	output: unknown,
	failed: boolean,
): string | null {
	if (failed) return "Failed";

	const approval = asRecord(safeGet(record, "approval"));
	switch (state) {
		case "input-streaming":
			return "Running";
		case "input-available":
			return "Ready";
		case "approval-requested":
			return "Approval needed";
		case "approval-responded":
			if (safeGet(approval, "approved") === true) return "Approved";
			if (safeGet(approval, "approved") === false) return "Denied";
			return "Approval answered";
		case "approval-approved":
			return "Approved";
		case "approval-denied":
		case "output-denied":
			return "Denied";
		case "output-available":
			return "Done";
		case "output-error":
		case "failed":
			return "Failed";
		default:
			break;
	}

	if (state) return humanizeIdentifier(state);

	const outputStatus = safeString(safeGet(asRecord(output), "status"));
	return outputStatus ? humanizeIdentifier(outputStatus) : null;
}

function toolDigest({
	family,
	input,
	record,
	toolName,
	type,
}: {
	family: ToolFamily;
	input: unknown;
	record: Record<string, unknown> | null;
	toolName: string | null;
	type: string;
}): string | null {
	if (type === "dynamic-tool") {
		return toolName ? truncateDigest(toolName) : null;
	}

	if (type === "file") {
		return truncateDigest(
			firstMeaningfulString([
				safeString(safeGet(record, "filename")),
				safeString(safeGet(record, "mediaType")),
			]) ?? "Attachment",
		);
	}

	if (isSectionOrPageOperation(type)) {
		const target = findTarget(input);
		if (target) {
			return truncateDigest(
				target.key.toLowerCase().includes("anchor")
					? `Anchor ${target.value}`
					: `Section ${target.value}`,
			);
		}
	}

	if (type.includes("scrape_leads")) {
		const query = findStringByKeys(input, ["query"]);
		const location = findStringByKeys(input, ["location"]);
		return truncateDigest([query, location].filter(Boolean).join(" · "));
	}

	const promptKeys =
		family === "image" || family === "video"
			? ["prompt", "brief", "instruction", "continuationBrief", "title"]
			: family === "page" || family === "marketing"
				? ["brief", "prompt", "title"]
				: ["prompt", "brief", "query", "question", "title", "url", "skill"];
	const digest = findStringByKeys(input, promptKeys);
	if (digest) return truncateDigest(digest);

	if (type.startsWith("data-")) {
		return truncateDigest(
			findStringByKeys(safeGet(record, "data"), [
				"message",
				"status",
				"kind",
			]) ?? "",
		);
	}

	return null;
}

function isSectionOrPageOperation(type: string): boolean {
	return (
		/(?:section|element|theme|page_outline)/.test(type) &&
		!type.includes("generate_page")
	);
}

function findTarget(value: unknown): { key: string; value: string } | null {
	return findFieldByKeys(value, [
		"wid",
		"wids",
		"sectionWid",
		"sectionId",
		"anchorWid",
	]);
}

function findFieldByKeys(
	value: unknown,
	keys: string[],
	depth = 0,
	seen = new Set<unknown>(),
): { key: string; value: string } | null {
	if (depth > 6 || !isTraversable(value) || seen.has(value)) return null;
	seen.add(value);

	const record = asRecord(value);
	if (record) {
		for (const key of keys) {
			const candidate = safeGet(record, key);
			const candidateString =
				safeString(candidate) ??
				(Array.isArray(candidate)
					? candidate
							.map(safeString)
							.filter((entry): entry is string => Boolean(entry))
							.slice(0, 3)
							.join(", ")
					: null);
			if (candidateString) return { key, value: candidateString };
		}
	}

	for (const [, child] of safeEntries(value)) {
		const match = findFieldByKeys(child, keys, depth + 1, seen);
		if (match) return match;
	}

	return null;
}

function findStringByKeys(
	value: unknown,
	keys: string[],
	depth = 0,
	seen = new Set<unknown>(),
): string | null {
	if (depth > 6 || !isTraversable(value) || seen.has(value)) return null;
	seen.add(value);

	const record = asRecord(value);
	if (record) {
		for (const key of keys) {
			const match = safeString(safeGet(record, key));
			if (match) return normalizeWhitespace(match);
		}
	}

	for (const [, child] of safeEntries(value)) {
		const match = findStringByKeys(child, keys, depth + 1, seen);
		if (match) return match;
	}

	return null;
}

function mediaPreviewSource(part: unknown, summary: ToolPartSummary): unknown {
	if (summary.kind === "tool") return summary.output;
	if (summary.kind === "data") return safeGet(asRecord(part), "data");
	return part;
}

function collectMediaPreviews(value: unknown): MediaPreview[] {
	const previews: MediaPreview[] = [];
	const urls = new Set<string>();
	const seen = new Set<unknown>();

	function visit(
		candidate: unknown,
		hint: string,
		mediaType: string | null,
		depth: number,
	) {
		if (previews.length >= MEDIA_PREVIEW_LIMIT || depth > 7) return;

		if (typeof candidate === "string") {
			const url = safeHttpsUrl(candidate);
			if (!url || urls.has(url)) return;
			const kind = mediaKind(url, hint, mediaType);
			if (!kind) return;
			urls.add(url);
			previews.push({ kind, url, label: mediaLabel(url, kind) });
			return;
		}

		if (!isTraversable(candidate) || seen.has(candidate)) return;
		seen.add(candidate);
		const record = asRecord(candidate);
		const nestedMediaType =
			safeString(safeGet(record, "mediaType")) ??
			safeString(safeGet(record, "mimeType")) ??
			safeString(safeGet(record, "contentType")) ??
			mediaType;
		const discriminator = firstMeaningfulString([
			safeString(safeGet(record, "type")),
			safeString(safeGet(record, "kind")),
			safeString(safeGet(record, "assetType")),
		]);
		const nestedHint = discriminator ? `${hint} ${discriminator}` : hint;

		for (const [key, child] of safeEntries(candidate)) {
			visit(child, `${nestedHint} ${key}`.trim(), nestedMediaType, depth + 1);
		}
	}

	visit(value, "", null, 0);
	return previews;
}

function mediaKind(
	url: string,
	hint: string,
	mediaType: string | null,
): MediaPreview["kind"] | null {
	const normalizedType = mediaType?.toLowerCase();
	if (normalizedType?.startsWith("image/")) return "image";
	if (normalizedType?.startsWith("video/")) return "video";

	const urlWithoutHash = url.split("#", 1)[0] ?? url;
	const context = hint.toLowerCase();
	if (/\.(?:avif|gif|jpe?g|png|svg|webp)(?:$|\?)/i.test(urlWithoutHash)) {
		return "image";
	}
	if (/\.(?:m4v|mov|mp4|webm)(?:$|\?)/i.test(urlWithoutHash)) {
		return "video";
	}
	if (/(?:image|images|thumbnail|poster|frame|shot)/.test(context)) {
		return "image";
	}
	if (/(?:video|videos|clip|render)/.test(context)) return "video";
	return null;
}

function mediaLabel(url: string, kind: MediaPreview["kind"]): string {
	try {
		const pathname = new URL(url).pathname;
		const filename = pathname.split("/").filter(Boolean).at(-1);
		return filename ? decodeURIComponent(filename) : `${kind} preview`;
	} catch {
		return `${kind} preview`;
	}
}

function safeHttpsUrl(value: string): string | null {
	try {
		const url = new URL(value);
		return url.protocol === "https:" ? url.href : null;
	} catch {
		return null;
	}
}

function parseAiError(value: unknown): InspectorAiError | null {
	try {
		const parsed = aiErrorDataSchema.safeParse(value);
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

function hasValue(value: unknown): boolean {
	return (
		value !== null && value !== undefined && value !== false && value !== ""
	);
}

function truncateDigest(value: string): string | null {
	const normalized = normalizeWhitespace(value);
	return normalized ? truncateText(normalized, DIGEST_MAX_LENGTH) : null;
}

function truncateText(value: string, maxLength: number): string {
	if (value.length <= maxLength) return value;
	return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function normalizeWhitespace(value: string): string {
	return value.replaceAll(/\s+/g, " ").trim();
}

function firstMeaningfulString(values: Array<string | null>): string | null {
	for (const value of values) {
		if (value?.trim()) return normalizeWhitespace(value);
	}
	return null;
}

function stringifyPart(part: unknown): string {
	if (part === undefined) return "Not recorded";

	try {
		const seen = new WeakSet<object>();
		return (
			JSON.stringify(
				part,
				(_key, value: unknown) => {
					if (typeof value === "bigint") return value.toString();
					if (typeof value === "object" && value !== null) {
						if (seen.has(value)) return "[Circular]";
						seen.add(value);
					}
					return value;
				},
				2,
			) ?? String(part)
		);
	} catch {
		try {
			return String(part);
		} catch {
			return "Unserializable value";
		}
	}
}

async function copyText(value: string) {
	if (typeof navigator === "undefined" || !navigator.clipboard) return;
	await navigator.clipboard.writeText(value).catch(() => undefined);
}

function safeString(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function safeGet(record: Record<string, unknown> | null, key: string): unknown {
	if (!record) return undefined;
	try {
		return record[key];
	} catch {
		return undefined;
	}
}

function safeEntries(value: unknown): Array<[string, unknown]> {
	if (!isTraversable(value)) return [];
	try {
		return Array.isArray(value)
			? value.map((entry, index) => [String(index), entry])
			: Object.entries(value);
	} catch {
		return [];
	}
}

function isTraversable(value: unknown): value is object {
	return typeof value === "object" && value !== null;
}
