// The kind facts of a file on its page: the pages of a PDF, the length of a video, the size of an image.
// FileSummaryCard calls fileFacts. The values come from the size and a hash of the id, so they stay the same.
// A later turn reads these facts from the metadata that the upload stores (STARTER.md, step 4).
import type { FileItem } from "~/features/workspace";

/** One fact: the message key of its label and its value, already formatted. */
export type FileFact = {
	labelKey:
		| "files.facts.pages"
		| "files.facts.slides"
		| "files.facts.sheets"
		| "files.facts.words"
		| "files.facts.dimensions"
		| "files.facts.duration"
		| "files.facts.frames"
		| "files.facts.items"
		| "files.facts.lines";
	value: string;
};

// The image sizes of cameras and exports that the team uses.
const IMAGE_SIZES = [
	[4032, 3024],
	[6000, 4000],
	[1080, 1350],
	[1920, 1080],
	[2400, 1600],
	[1200, 1200],
] as const;

/** A stable number from a file id (FNV-1a). A fact and a grid preview stay the same on every render. */
export function hashOf(id: string): number {
	let hash = 2166136261;
	for (const character of id) {
		hash = Math.imul(hash ^ (character.codePointAt(0) ?? 0), 16777619);
	}
	return hash >>> 0;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(Math.round(value), min), max);
}

// mm:ss, or h:mm:ss for an hour or more.
function formatDuration(totalSeconds: number): string {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	const pad = (value: number) => String(value).padStart(2, "0");
	return hours > 0
		? `${hours}:${pad(minutes)}:${pad(seconds)}`
		: `${minutes}:${pad(seconds)}`;
}

/** The facts of one file kind. An archive lists its items; a video lists its length. */
export function fileFacts(file: FileItem, locale: string): FileFact[] {
	const hash = hashOf(file.id);
	const number = new Intl.NumberFormat(locale);
	switch (file.kind) {
		case "pdf":
			// About 150 kB per page for a PDF with images.
			return [
				{
					labelKey: "files.facts.pages",
					value: number.format(clamp(file.sizeBytes / 150e3, 1, 240)),
				},
			];
		case "presentation":
			return [
				{
					labelKey: "files.facts.slides",
					value: number.format(8 + (hash % 46)),
				},
			];
		case "spreadsheet":
			return [
				{
					labelKey: "files.facts.sheets",
					value: number.format(1 + (hash % 7)),
				},
			];
		case "document":
			return [
				{
					labelKey: "files.facts.words",
					value: number.format(clamp(400 + (hash % 9000), 400, 12000)),
				},
			];
		case "image": {
			const [width, height] =
				IMAGE_SIZES[hash % IMAGE_SIZES.length] ?? IMAGE_SIZES[0];
			return [
				{
					labelKey: "files.facts.dimensions",
					value: `${number.format(width)} × ${number.format(height)} px`,
				},
			];
		}
		// A video at about 12 Mbit/s, so 1.5 MB per second.
		case "video":
			return [
				{
					labelKey: "files.facts.duration",
					value: formatDuration(clamp(file.sizeBytes / 1.5e6, 5, 4 * 3600)),
				},
			];
		// A WAV at 48 kHz stereo is about 11.5 MB per minute; an MP3 about 1 MB per minute.
		case "audio":
			return [
				{
					labelKey: "files.facts.duration",
					value: formatDuration(
						clamp(
							file.sizeBytes / (file.extension === "wav" ? 192e3 : 16e3),
							5,
							3 * 3600,
						),
					),
				},
			];
		case "design":
			return [
				{
					labelKey: "files.facts.frames",
					value: number.format(6 + (hash % 120)),
				},
			];
		// An archive of exports holds files of about 4 MB on average.
		case "archive":
			return [
				{
					labelKey: "files.facts.items",
					value: number.format(clamp(file.sizeBytes / 4e6, 3, 5000)),
				},
			];
		// About 40 bytes per line of code or data.
		case "code":
			return [
				{
					labelKey: "files.facts.lines",
					value: number.format(clamp(file.sizeBytes / 40, 20, 200000)),
				},
			];
	}
}
