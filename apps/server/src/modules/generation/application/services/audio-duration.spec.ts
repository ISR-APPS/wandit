import { describe, expect, it } from "vitest";

import { readAudioDurationSeconds } from "./audio-duration";

describe("readAudioDurationSeconds", () => {
	it("derives PCM WAV duration from validated sample frames", () => {
		const audio = wav({ durationSeconds: 1 });

		expect(readAudioDurationSeconds(audio, "audio/wav")).toBe(1);
	});

	it("supports structurally valid IEEE-float WAV audio", () => {
		const audio = wav({
			bitsPerSample: 32,
			channels: 2,
			durationSeconds: 0.5,
			formatTag: 3,
			sampleRate: 48_000,
		});

		expect(readAudioDurationSeconds(audio, "audio/x-wav")).toBe(0.5);
	});

	it("rejects a forged WAV byte rate", () => {
		const audio = wav({ durationSeconds: 1 });
		audio.writeUInt32LE(1, 28);

		expect(readAudioDurationSeconds(audio, "audio/wav")).toBeNull();
	});

	it("reads an M4A version-zero movie header", () => {
		const movieHeader = Buffer.alloc(20);
		movieHeader.writeUInt32BE(48_000, 12);
		movieHeader.writeUInt32BE(144_000, 16);
		const audio = Buffer.concat([
			isoBox("ftyp", Buffer.from("M4A \0\0\0\0", "ascii")),
			isoBox(
				"moov",
				Buffer.concat([
					isoBox("mvhd", movieHeader),
					audioTrack({ durationSeconds: 2 }),
				]),
			),
		]);

		expect(readAudioDurationSeconds(audio, "audio/mp4")).toBe(3);
	});

	it("sums every WAV data chunk before accepting the duration", () => {
		const audio = wavWithDataChunks([1, 2]);

		expect(readAudioDurationSeconds(audio, "audio/wav")).toBe(3);
	});

	it("rejects trailing bytes and a truncated trailing WAV chunk", () => {
		const audio = wav({ durationSeconds: 1 });
		const outsideRiff = Buffer.concat([audio, Buffer.from("hidden")]);
		const truncated = Buffer.concat([
			audio,
			Buffer.from("data\n\0\0\0", "binary"),
		]);
		truncated.writeUInt32LE(truncated.length - 8, 4);

		expect(readAudioDurationSeconds(outsideRiff, "audio/wav")).toBeNull();
		expect(readAudioDurationSeconds(truncated, "audio/wav")).toBeNull();
	});

	it("uses the audio sample table instead of an mvhd marker in media", () => {
		const audio = Buffer.concat([
			isoBox("ftyp", Buffer.from("M4A \0\0\0\0", "ascii")),
			isoBox("mdat", Buffer.from("untrusted mvhd marker", "ascii")),
			isoBox("moov", audioTrack({ durationSeconds: 301 })),
		]);

		expect(readAudioDurationSeconds(audio, "audio/m4a")).toBe(301);
		expect(
			readAudioDurationSeconds(Buffer.from("mvhd only"), "audio/mp4"),
		).toBeNull();
	});

	it("reads WebM Duration using TimecodeScale", () => {
		const duration = Buffer.alloc(8);
		duration.writeDoubleBE(2_500);
		const audio = webm([
			ebmlElement(
				[0x15, 0x49, 0xa9, 0x66],
				[
					ebmlElement([0x2a, 0xd7, 0xb1], Buffer.from([0x0f, 0x42, 0x40])),
					ebmlElement([0x44, 0x89], duration),
				],
			),
			webmTracks(),
		]);

		expect(readAudioDurationSeconds(audio, "audio/webm;codecs=opus")).toBe(2.5);
	});

	it("derives MediaRecorder WebM duration when Info/Duration is absent", () => {
		const audio = webm(
			[
				webmTracks(),
				webmCluster({ relativeTimecodes: [0], unknownSize: true }),
				webmCluster({
					clusterTimecode: 980,
					relativeTimecodes: [0],
					unknownSize: true,
				}),
			],
			true,
		);

		expect(readAudioDurationSeconds(audio, "audio/webm")).toBe(1);
	});

	it("uses the WebM Opus timeline over forged short metadata", () => {
		const duration = Buffer.alloc(8);
		duration.writeDoubleBE(1);
		const audio = webm([
			ebmlElement(
				[0x15, 0x49, 0xa9, 0x66],
				ebmlElement([0x44, 0x89], duration),
			),
			webmTracks(),
			webmCluster({ clusterTimecode: 300_000, relativeTimecodes: [0] }),
		]);

		expect(readAudioDurationSeconds(audio, "audio/webm")).toBe(300.02);
	});

	it("walks exact Ogg Opus pages and ignores OggS inside a packet", () => {
		const audio = oggPage({
			granule: 48_312n,
			headerType: 0x06,
			packets: [
				opusHead(312),
				Buffer.from("OpusTags"),
				Buffer.concat([Buffer.from([0x98]), Buffer.from("OggS")]),
			],
		});

		expect(readAudioDurationSeconds(audio, "audio/ogg")).toBe(1);
	});

	it("returns null for an unsupported or malformed container", () => {
		expect(
			readAudioDurationSeconds(Buffer.from("not audio"), "audio/mpeg"),
		).toBeNull();
		expect(readAudioDurationSeconds(Buffer.alloc(12), "audio/wav")).toBeNull();
	});
});

function isoBox(type: string, payload: Buffer): Buffer {
	const box = Buffer.alloc(8 + payload.length);
	box.writeUInt32BE(box.length, 0);
	box.write(type, 4, "ascii");
	payload.copy(box, 8);
	return box;
}

function audioTrack({ durationSeconds }: { durationSeconds: number }): Buffer {
	const timescale = 48_000;
	const mediaHeader = Buffer.alloc(20);
	mediaHeader.writeUInt32BE(timescale, 12);
	mediaHeader.writeUInt32BE(durationSeconds * timescale, 16);
	const handler = Buffer.alloc(12);
	handler.write("soun", 8, "ascii");
	const timeToSample = Buffer.alloc(16);
	timeToSample.writeUInt32BE(1, 4);
	timeToSample.writeUInt32BE(durationSeconds * 100, 8);
	timeToSample.writeUInt32BE(480, 12);

	return isoBox(
		"trak",
		isoBox(
			"mdia",
			Buffer.concat([
				isoBox("mdhd", mediaHeader),
				isoBox("hdlr", handler),
				isoBox("minf", isoBox("stbl", isoBox("stts", timeToSample))),
			]),
		),
	);
}

function ebmlElement(
	id: readonly number[],
	payload: Buffer | Buffer[],
): Buffer {
	const bytes = Array.isArray(payload) ? Buffer.concat(payload) : payload;
	if (bytes.length >= 127) {
		throw new Error("test EBML payload is too large for one-byte size");
	}
	return Buffer.concat([
		Buffer.from(id),
		Buffer.from([0x80 | bytes.length]),
		bytes,
	]);
}

function webm(elements: Buffer[], unknownSegment = false): Buffer {
	const header = ebmlElement(
		[0x1a, 0x45, 0xdf, 0xa3],
		ebmlElement([0x42, 0x82], Buffer.from("webm")),
	);
	const segmentPayload = Buffer.concat(elements);
	const segment = unknownSegment
		? Buffer.concat([
				Buffer.from([0x18, 0x53, 0x80, 0x67, 0xff]),
				segmentPayload,
			])
		: ebmlElement([0x18, 0x53, 0x80, 0x67], segmentPayload);
	return Buffer.concat([header, segment]);
}

function webmTracks(): Buffer {
	return ebmlElement(
		[0x16, 0x54, 0xae, 0x6b],
		ebmlElement(
			[0xae],
			[
				ebmlElement([0xd7], Buffer.from([1])),
				ebmlElement([0x83], Buffer.from([2])),
				ebmlElement([0x86], Buffer.from("A_OPUS")),
			],
		),
	);
}

function webmCluster({
	clusterTimecode = 0,
	relativeTimecodes,
	unknownSize = false,
}: {
	clusterTimecode?: number;
	relativeTimecodes: number[];
	unknownSize?: boolean;
}): Buffer {
	const payload = Buffer.concat([
		ebmlElement([0xe7], unsignedBytes(clusterTimecode)),
		...relativeTimecodes.map((relative) => {
			const block = Buffer.alloc(5);
			block[0] = 0x81;
			block.writeInt16BE(relative, 1);
			block[4] = 0x98;
			return ebmlElement([0xa3], block);
		}),
	]);
	return unknownSize
		? Buffer.concat([Buffer.from([0x1f, 0x43, 0xb6, 0x75, 0xff]), payload])
		: ebmlElement([0x1f, 0x43, 0xb6, 0x75], payload);
}

function unsignedBytes(value: number): Buffer {
	if (value <= 0xff) {
		return Buffer.from([value]);
	}
	if (value <= 0xffff) {
		const bytes = Buffer.alloc(2);
		bytes.writeUInt16BE(value);
		return bytes;
	}
	const bytes = Buffer.alloc(4);
	bytes.writeUInt32BE(value);
	return bytes;
}

function oggPage(input: {
	granule: bigint;
	headerType: number;
	packets: Buffer[];
}): Buffer {
	const lacing = input.packets.map((packet) => packet.length);
	if (lacing.some((length) => length >= 255)) {
		throw new Error("test Ogg packet must fit one lacing segment");
	}
	const payload = Buffer.concat(input.packets);
	const page = Buffer.alloc(27 + lacing.length + payload.length);
	page.write("OggS", 0, "ascii");
	page[5] = input.headerType;
	page.writeBigUInt64LE(input.granule, 6);
	page.writeUInt32LE(7, 14);
	page.writeUInt32LE(0, 18);
	page[26] = lacing.length;
	for (const [index, length] of lacing.entries()) {
		page[27 + index] = length;
	}
	payload.copy(page, 27 + lacing.length);
	return page;
}

function opusHead(preSkip: number): Buffer {
	const head = Buffer.alloc(19);
	head.write("OpusHead", 0, "ascii");
	head[8] = 1;
	head[9] = 1;
	head.writeUInt16LE(preSkip, 10);
	head.writeUInt32LE(48_000, 12);
	return head;
}

function wavWithDataChunks(durations: number[]): Buffer {
	const formatChunk = wav({ durationSeconds: 1 }).subarray(12, 36);
	const byteRate = 16_000 * 2;
	const chunks = durations.map((duration) => {
		const payload = Buffer.alloc(duration * byteRate);
		const chunk = Buffer.alloc(8 + payload.length);
		chunk.write("data", 0, "ascii");
		chunk.writeUInt32LE(payload.length, 4);
		payload.copy(chunk, 8);
		return chunk;
	});
	const payload = Buffer.concat([formatChunk, ...chunks]);
	const audio = Buffer.alloc(12 + payload.length);
	audio.write("RIFF", 0, "ascii");
	audio.writeUInt32LE(audio.length - 8, 4);
	audio.write("WAVE", 8, "ascii");
	payload.copy(audio, 12);
	return audio;
}

function wav({
	bitsPerSample = 16,
	channels = 1,
	durationSeconds,
	formatTag = 1,
	sampleRate = 16_000,
}: {
	bitsPerSample?: number;
	channels?: number;
	durationSeconds: number;
	formatTag?: number;
	sampleRate?: number;
}): Buffer {
	const blockAlign = channels * (bitsPerSample / 8);
	const byteRate = sampleRate * blockAlign;
	const dataSize = durationSeconds * byteRate;
	const audio = Buffer.alloc(44 + dataSize);
	audio.write("RIFF", 0, "ascii");
	audio.writeUInt32LE(audio.length - 8, 4);
	audio.write("WAVE", 8, "ascii");
	audio.write("fmt ", 12, "ascii");
	audio.writeUInt32LE(16, 16);
	audio.writeUInt16LE(formatTag, 20);
	audio.writeUInt16LE(channels, 22);
	audio.writeUInt32LE(sampleRate, 24);
	audio.writeUInt32LE(byteRate, 28);
	audio.writeUInt16LE(blockAlign, 32);
	audio.writeUInt16LE(bitsPerSample, 34);
	audio.write("data", 36, "ascii");
	audio.writeUInt32LE(dataSize, 40);

	return audio;
}
