import { execFile } from "node:child_process";
import { copyFile, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const COMMAND_OUTPUT_LIMIT_BYTES = 16 * 1024 * 1024;

export type VideoProbe = {
	durationMs: number;
	fps: number;
	formatName: string;
	hasAudio: boolean;
	height: number;
	videoCodec: string;
	width: number;
};

export type NormalizeSegmentOptions = {
	fps: number;
	height: number;
	width: number;
};

/**
 * Trigger media work must stay inside this collision-safe workspace. The
 * callback boundary guarantees source downloads and ffmpeg outputs are
 * removed after success, failure, or cancellation unwinding.
 */
export async function withVideoProcessingTempDir<T>(
	operation: (directory: string) => Promise<T>,
): Promise<T> {
	const directory = await mkdtemp(join(tmpdir(), "wandit-video-processing-"));

	try {
		return await operation(directory);
	} finally {
		await rm(directory, { force: true, recursive: true });
	}
}

export async function isFfmpegAvailable(): Promise<boolean> {
	const checks = await Promise.all([
		commandAvailable(ffmpegBinary()),
		commandAvailable(ffprobeBinary()),
	]);

	return checks.every(Boolean);
}

export async function probeVideo(path: string): Promise<VideoProbe> {
	const stdout = await runCommand(ffprobeBinary(), [
		"-v",
		"error",
		"-show_streams",
		"-show_format",
		"-of",
		"json",
		path,
	]);
	const payload = parseProbePayload(stdout, path);
	const streams = Array.isArray(payload.streams)
		? payload.streams.filter(isRecord)
		: [];
	const video = streams.find((stream) => stream.codec_type === "video");

	if (!video) {
		throw new Error(`No video stream found in ${path}.`);
	}

	const width = positiveInteger(video.width);
	const height = positiveInteger(video.height);
	const fps =
		parseFrameRate(video.avg_frame_rate) ?? parseFrameRate(video.r_frame_rate);
	const format = isRecord(payload.format) ? payload.format : null;
	const durationSeconds =
		positiveNumber(format?.duration) ?? positiveNumber(video.duration);
	const formatName =
		typeof format?.format_name === "string" ? format.format_name : "unknown";

	if (!width || !height) {
		throw new Error(`Could not determine video dimensions for ${path}.`);
	}

	if (!fps) {
		throw new Error(`Could not determine video frame rate for ${path}.`);
	}

	if (!durationSeconds) {
		throw new Error(`Could not determine video duration for ${path}.`);
	}

	return {
		durationMs: Math.max(1, Math.round(durationSeconds * 1_000)),
		fps,
		formatName,
		hasAudio: streams.some((stream) => stream.codec_type === "audio"),
		height,
		videoCodec:
			typeof video.codec_name === "string" && video.codec_name.length > 0
				? video.codec_name
				: "unknown",
		width,
	};
}

/** ffprobe reports MP4-family containers as a comma-separated format list. */
export function isMp4VideoProbe(
	probe: Pick<VideoProbe, "formatName">,
): boolean {
	return probe.formatName.split(",").includes("mp4");
}

export async function extractLastFrame(
	path: string,
	outPath: string,
): Promise<void> {
	const frameDirectory = await mkdtemp(
		join(tmpdir(), "wandit-video-final-frame-"),
	);
	let firstFailure: unknown;

	try {
		await rm(outPath, { force: true });
		const primaryPattern = join(frameDirectory, "primary-%09d.jpg");
		let primarySucceeded = false;
		try {
			await runFfmpeg([
				"-y",
				"-sseof",
				"-0.5",
				"-i",
				path,
				"-map",
				"0:v:0",
				"-fps_mode",
				"passthrough",
				"-q:v",
				"2",
				primaryPattern,
			]);
			primarySucceeded = true;
		} catch (error) {
			firstFailure = error;
		}

		const primaryFrame = primarySucceeded
			? await lastDecodedFrame(frameDirectory, "primary-")
			: null;
		if (primaryFrame) {
			await copyFile(primaryFrame, outPath);
			if (await isNonEmptyFile(outPath)) {
				return;
			}
		}

		const source = await probeVideo(path);
		const fallbackSeekSeconds = Math.max(0, source.durationMs / 1_000 - 1);
		const fallbackPattern = join(frameDirectory, "fallback-%09d.jpg");
		try {
			await runFfmpeg([
				"-y",
				"-ss",
				fallbackSeekSeconds.toFixed(3),
				"-i",
				path,
				"-map",
				"0:v:0",
				"-fps_mode",
				"passthrough",
				"-q:v",
				"2",
				fallbackPattern,
			]);
		} catch (error) {
			throw new Error(`Could not extract the final video frame from ${path}.`, {
				cause: error,
			});
		}

		const fallbackFrame = await lastDecodedFrame(frameDirectory, "fallback-");
		if (!fallbackFrame) {
			throw new Error(`Could not extract the final video frame from ${path}.`, {
				cause: firstFailure,
			});
		}

		await copyFile(fallbackFrame, outPath);
		if (!(await isNonEmptyFile(outPath))) {
			throw new Error(`Could not extract the final video frame from ${path}.`, {
				cause: firstFailure,
			});
		}
	} finally {
		await rm(frameDirectory, { force: true, recursive: true });
	}
}

export async function normalizeSegment(
	inPath: string,
	outPath: string,
	options: NormalizeSegmentOptions,
): Promise<void> {
	assertNormalizeOptions(options);
	const fps = formatFrameRate(options.fps);
	const videoFilter = canonicalVideoFilter(options, fps);

	await runFfmpeg([
		"-y",
		"-i",
		inPath,
		"-map",
		"0:v:0",
		"-vf",
		videoFilter,
		"-c:v",
		"libx264",
		"-preset",
		"medium",
		"-crf",
		"18",
		"-pix_fmt",
		"yuv420p",
		"-r",
		fps,
		"-fps_mode",
		"cfr",
		"-an",
		"-movflags",
		"+faststart",
		outPath,
	]);
}

export async function concatSegments(
	paths: string[],
	outPath: string,
): Promise<void> {
	const [firstPath] = paths;

	if (!firstPath) {
		throw new Error(
			"At least one video segment is required for concatenation.",
		);
	}

	const canonical = await probeVideo(firstPath);
	const options = {
		fps: canonical.fps,
		height: canonical.height,
		width: canonical.width,
	};
	const fps = formatFrameRate(options.fps);
	const inputs = paths.flatMap((path) => ["-i", path]);
	const normalized = paths.map(
		(_, index) =>
			`[${index}:v:0]${canonicalVideoFilter(options, fps)},settb=AVTB,setpts=PTS-STARTPTS[v${index}]`,
	);
	const labels = paths.map((_, index) => `[v${index}]`).join("");
	const filterGraph = `${normalized.join(";")};${labels}concat=n=${paths.length}:v=1:a=0[joined]`;

	await runFfmpeg([
		"-y",
		...inputs,
		"-filter_complex",
		filterGraph,
		"-map",
		"[joined]",
		"-c:v",
		"libx264",
		"-preset",
		"medium",
		"-crf",
		"18",
		"-pix_fmt",
		"yuv420p",
		"-r",
		fps,
		"-fps_mode",
		"cfr",
		"-an",
		"-movflags",
		"+faststart",
		outPath,
	]);
}

export async function muxSoundtrack(
	videoPath: string,
	audioPath: string,
	outPath: string,
): Promise<void> {
	await runFfmpeg([
		"-y",
		"-i",
		videoPath,
		"-i",
		audioPath,
		"-map",
		"0:v:0",
		"-map",
		"1:a:0",
		"-c:v",
		"copy",
		"-c:a",
		"aac",
		"-b:a",
		"192k",
		"-af",
		"apad",
		"-shortest",
		"-movflags",
		"+faststart",
		outPath,
	]);
}

function canonicalVideoFilter(
	options: NormalizeSegmentOptions,
	fps: string,
): string {
	return [
		`scale=${options.width}:${options.height}:force_original_aspect_ratio=decrease:flags=lanczos`,
		`pad=${options.width}:${options.height}:(ow-iw)/2:(oh-ih)/2`,
		"setsar=1",
		`fps=${fps}`,
		"format=yuv420p",
	].join(",");
}

function assertNormalizeOptions(options: NormalizeSegmentOptions): void {
	if (
		!Number.isInteger(options.width) ||
		options.width <= 0 ||
		!Number.isInteger(options.height) ||
		options.height <= 0 ||
		!Number.isFinite(options.fps) ||
		options.fps <= 0
	) {
		throw new Error("Video normalization dimensions and fps must be positive.");
	}
}

async function isNonEmptyFile(path: string): Promise<boolean> {
	try {
		const metadata = await stat(path);
		return metadata.isFile() && metadata.size > 0;
	} catch {
		return false;
	}
}

async function lastDecodedFrame(
	directory: string,
	prefix: string,
): Promise<string | null> {
	const frames = (await readdir(directory))
		.filter((name) => name.startsWith(prefix) && name.endsWith(".jpg"))
		.sort();
	const name = frames[frames.length - 1];
	return name ? join(directory, name) : null;
}

async function commandAvailable(command: string): Promise<boolean> {
	try {
		await execFileAsync(command, ["-version"], {
			encoding: "utf8",
			maxBuffer: COMMAND_OUTPUT_LIMIT_BYTES,
			timeout: 5_000,
		});
		return true;
	} catch {
		return false;
	}
}

async function runFfmpeg(args: string[]): Promise<void> {
	await runCommand(ffmpegBinary(), [
		"-hide_banner",
		"-loglevel",
		"error",
		...args,
	]);
}

async function runCommand(command: string, args: string[]): Promise<string> {
	const { stdout } = await execFileAsync(command, args, {
		encoding: "utf8",
		maxBuffer: COMMAND_OUTPUT_LIMIT_BYTES,
	});

	return stdout;
}

function ffmpegBinary(): string {
	return process.env.FFMPEG_PATH?.trim() || "ffmpeg";
}

function ffprobeBinary(): string {
	return process.env.FFPROBE_PATH?.trim() || "ffprobe";
}

function formatFrameRate(fps: number): string {
	return Number(fps.toFixed(6)).toString();
}

function parseProbePayload(
	stdout: string,
	path: string,
): Record<string, unknown> {
	try {
		const parsed: unknown = JSON.parse(stdout);
		if (isRecord(parsed)) {
			return parsed;
		}
	} catch {
		// The descriptive error below is more useful than a raw JSON parser error.
	}

	throw new Error(`ffprobe returned invalid metadata for ${path}.`);
}

function parseFrameRate(value: unknown): number | null {
	if (typeof value === "string" && value.includes("/")) {
		const [numerator, denominator] = value.split("/", 2).map(Number);
		if (
			Number.isFinite(numerator) &&
			Number.isFinite(denominator) &&
			(numerator ?? 0) > 0 &&
			(denominator ?? 0) > 0
		) {
			return (numerator as number) / (denominator as number);
		}
	}

	return positiveNumber(value);
}

function positiveInteger(value: unknown): number | null {
	const parsed = positiveNumber(value);
	return parsed && Number.isInteger(parsed) ? parsed : null;
}

function positiveNumber(value: unknown): number | null {
	if (typeof value !== "number" && typeof value !== "string") {
		return null;
	}

	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
