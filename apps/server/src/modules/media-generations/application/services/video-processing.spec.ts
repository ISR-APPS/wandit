import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import {
	concatSegments,
	extractLastFrame,
	isFfmpegAvailable,
	muxSoundtrack,
	normalizeSegment,
	probeVideo,
	withVideoProcessingTempDir,
} from "./video-processing";

const execFileAsync = promisify(execFile);
const ffmpegAvailable = await isFfmpegAvailable();

describe.skipIf(!ffmpegAvailable)("video processing", () => {
	it("probes duration, dimensions, fps, codec, and audio presence", async () => {
		await withVideoProcessingTempDir(async (directory) => {
			const clip = join(directory, "source.mp4");
			await createFixture(clip, {
				color: "red",
				fps: 24,
				height: 90,
				withAudio: true,
				width: 160,
			});

			const metadata = await probeVideo(clip);

			expect(metadata.durationMs).toBeGreaterThanOrEqual(900);
			expect(metadata.durationMs).toBeLessThanOrEqual(1_100);
			expect(metadata.width).toBe(160);
			expect(metadata.height).toBe(90);
			expect(metadata.fps).toBeCloseTo(24, 2);
			expect(metadata.videoCodec).toBe("h264");
			expect(metadata.hasAudio).toBe(true);
		});
	});

	it("extracts the true final frame instead of the first frame from an early seek", async () => {
		await withVideoProcessingTempDir(async (directory) => {
			const clip = join(directory, "source.mp4");
			const frame = join(directory, "last-frame.jpg");
			const expected = join(directory, "expected-last-frame.jpg");
			const early = join(directory, "early-frame.jpg");
			await createFrameCounterFixture(clip);
			await extractReferenceFrame(clip, expected, "-0.034");
			await extractReferenceFrame(clip, early, "-0.25");

			await extractLastFrame(clip, frame);

			expect(await readFile(frame)).toEqual(await readFile(expected));
			expect(await readFile(frame)).not.toEqual(await readFile(early));
		});
	});

	it("normalizes and concatenates differing one-second clips", async () => {
		await withVideoProcessingTempDir(async (directory) => {
			const first = join(directory, "first.mp4");
			const second = join(directory, "second.mp4");
			const normalizedFirst = join(directory, "normalized-first.mp4");
			const normalizedSecond = join(directory, "normalized-second.mp4");
			const joined = join(directory, "joined.mp4");
			await createFixture(first, {
				color: "red",
				fps: 24,
				height: 90,
				withAudio: true,
				width: 160,
			});
			await createFixture(second, {
				color: "green",
				fps: 30,
				height: 96,
				withAudio: false,
				width: 128,
			});

			const canonical = { fps: 24, height: 90, width: 160 };
			await normalizeSegment(first, normalizedFirst, canonical);
			await normalizeSegment(second, normalizedSecond, canonical);
			await expect(probeVideo(normalizedFirst)).resolves.toMatchObject({
				fps: expect.closeTo(24, 2),
				hasAudio: false,
				height: 90,
				width: 160,
			});
			await concatSegments([normalizedFirst, normalizedSecond], joined);

			const metadata = await probeVideo(joined);
			expect(metadata.durationMs).toBeGreaterThanOrEqual(1_850);
			expect(metadata.durationMs).toBeLessThanOrEqual(2_150);
			expect(metadata).toMatchObject({
				fps: expect.closeTo(24, 2),
				hasAudio: false,
				height: 90,
				videoCodec: "h264",
				width: 160,
			});
		});
	});

	it("replaces segment audio with one AAC soundtrack", async () => {
		await withVideoProcessingTempDir(async (directory) => {
			const video = join(directory, "video.mp4");
			const audio = join(directory, "soundtrack.m4a");
			const output = join(directory, "muxed.mp4");
			await createFixture(video, {
				color: "purple",
				fps: 24,
				height: 90,
				withAudio: true,
				width: 160,
			});
			await createSoundtrack(audio);

			await muxSoundtrack(video, audio, output);

			const metadata = await probeVideo(output);
			expect(metadata.hasAudio).toBe(true);
			expect(metadata.durationMs).toBeGreaterThanOrEqual(900);
			expect(metadata.durationMs).toBeLessThanOrEqual(1_100);
		});
	});

	it("removes its temporary workspace when the callback fails", async () => {
		let directory = "";

		await expect(
			withVideoProcessingTempDir(async (createdDirectory) => {
				directory = createdDirectory;
				throw new Error("fixture failure");
			}),
		).rejects.toThrow("fixture failure");
		await expect(access(directory)).rejects.toThrow();
	});
});

async function createFixture(
	path: string,
	options: {
		color: string;
		fps: number;
		height: number;
		width: number;
		withAudio: boolean;
	},
): Promise<void> {
	const args = [
		"-hide_banner",
		"-loglevel",
		"error",
		"-y",
		"-f",
		"lavfi",
		"-i",
		`color=c=${options.color}:s=${options.width}x${options.height}:r=${options.fps}:d=1`,
	];

	if (options.withAudio) {
		args.push(
			"-f",
			"lavfi",
			"-i",
			"sine=frequency=440:sample_rate=44100:duration=1",
			"-shortest",
		);
	}

	args.push("-c:v", "libx264", "-pix_fmt", "yuv420p");

	if (options.withAudio) {
		args.push("-c:a", "aac");
	} else {
		args.push("-an");
	}

	args.push(path);
	await runFixtureCommand(args);
}

async function createSoundtrack(path: string): Promise<void> {
	await runFixtureCommand([
		"-hide_banner",
		"-loglevel",
		"error",
		"-y",
		"-f",
		"lavfi",
		"-i",
		"sine=frequency=880:sample_rate=44100:duration=1",
		"-c:a",
		"aac",
		path,
	]);
}

async function createFrameCounterFixture(path: string): Promise<void> {
	await runFixtureCommand([
		"-hide_banner",
		"-loglevel",
		"error",
		"-y",
		"-f",
		"lavfi",
		"-i",
		"testsrc=size=160x90:rate=30:duration=2",
		"-c:v",
		"libx264",
		"-pix_fmt",
		"yuv420p",
		"-an",
		path,
	]);
}

async function extractReferenceFrame(
	videoPath: string,
	outPath: string,
	seekFromEnd: string,
): Promise<void> {
	await runFixtureCommand([
		"-hide_banner",
		"-loglevel",
		"error",
		"-y",
		"-sseof",
		seekFromEnd,
		"-i",
		videoPath,
		"-map",
		"0:v:0",
		"-frames:v",
		"1",
		"-q:v",
		"2",
		outPath,
	]);
}

async function runFixtureCommand(args: string[]): Promise<void> {
	await execFileAsync(process.env.FFMPEG_PATH?.trim() || "ffmpeg", args, {
		encoding: "utf8",
		maxBuffer: 4 * 1024 * 1024,
	});
}
