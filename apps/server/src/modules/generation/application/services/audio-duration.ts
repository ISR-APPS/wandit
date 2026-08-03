const NANOSECONDS_PER_SECOND = 1_000_000_000;
const OPUS_SAMPLE_RATE = 48_000;
const WAV_FORMAT_PCM = 0x0001;
const WAV_FORMAT_IEEE_FLOAT = 0x0003;
const UINT32_MAX = 0xffff_ffff;

type WavFormat = {
	bitsPerSample: number;
	blockAlign: number;
	channels: number;
	formatTag: number;
	sampleRate: number;
};

/**
 * Reads duration from the uploaded container before any provider call. The
 * recorder formats used by our web/native clients are deliberately handled
 * without ffprobe so this remains deterministic in API containers.
 */
export function readAudioDurationSeconds(
	audio: Buffer,
	mimeType: string,
): number | null {
	const bareType = mimeType.split(";")[0]?.trim().toLowerCase();

	if (bareType === "audio/wav" || bareType === "audio/x-wav") {
		return readWavDuration(audio);
	}

	if (
		bareType === "audio/mp4" ||
		bareType === "audio/m4a" ||
		bareType === "audio/x-m4a" ||
		bareType === "audio/aac"
	) {
		return readMp4Duration(audio);
	}

	if (bareType === "audio/webm" || bareType === "video/webm") {
		return readWebmDuration(audio);
	}

	if (bareType === "audio/ogg" || bareType === "application/ogg") {
		return readOggDuration(audio);
	}

	return null;
}

function readWavDuration(audio: Buffer): number | null {
	if (
		audio.length < 44 ||
		audio.toString("ascii", 0, 4) !== "RIFF" ||
		audio.toString("ascii", 8, 12) !== "WAVE"
	) {
		return null;
	}

	const riffEnd = audio.readUInt32LE(4) + 8;

	if (riffEnd < 12 || riffEnd !== audio.length) {
		return null;
	}

	let format: WavFormat | null = null;
	const dataChunks: number[] = [];
	let offset = 12;

	while (offset + 8 <= riffEnd) {
		const chunkType = audio.toString("ascii", offset, offset + 4);
		const chunkSize = audio.readUInt32LE(offset + 4);
		const payloadOffset = offset + 8;
		const payloadEnd = payloadOffset + chunkSize;

		if (payloadEnd > riffEnd || payloadEnd > audio.length) {
			return null;
		}

		if (chunkType === "fmt ") {
			const parsed = readWavFormat(audio, payloadOffset, chunkSize);

			if (!parsed || (format && !sameWavFormat(format, parsed))) {
				return null;
			}

			format = parsed;
		}

		if (chunkType === "data") {
			dataChunks.push(chunkSize);
		}

		const paddedEnd = payloadEnd + (chunkSize % 2);

		if (paddedEnd > riffEnd) {
			return null;
		}

		offset = paddedEnd;
	}

	if (offset !== riffEnd || !format || dataChunks.length === 0) {
		return null;
	}

	let dataBytes = 0;
	for (const chunkSize of dataChunks) {
		if (chunkSize % format.blockAlign !== 0) {
			return null;
		}
		dataBytes += chunkSize;
		if (!Number.isSafeInteger(dataBytes)) {
			return null;
		}
	}

	return validDuration(dataBytes / format.blockAlign / format.sampleRate);
}

function readWavFormat(
	audio: Buffer,
	offset: number,
	chunkSize: number,
): WavFormat | null {
	if (chunkSize < 16 || offset + 16 > audio.length) {
		return null;
	}

	const formatTag = audio.readUInt16LE(offset);
	const channels = audio.readUInt16LE(offset + 2);
	const sampleRate = audio.readUInt32LE(offset + 4);
	const byteRate = audio.readUInt32LE(offset + 8);
	const blockAlign = audio.readUInt16LE(offset + 12);
	const bitsPerSample = audio.readUInt16LE(offset + 14);
	const supportedBits =
		formatTag === WAV_FORMAT_PCM
			? bitsPerSample === 8 ||
				bitsPerSample === 16 ||
				bitsPerSample === 24 ||
				bitsPerSample === 32
			: formatTag === WAV_FORMAT_IEEE_FLOAT &&
				(bitsPerSample === 32 || bitsPerSample === 64);

	if (!supportedBits || channels === 0 || sampleRate === 0) {
		return null;
	}

	const bytesPerSample = bitsPerSample / 8;
	const expectedBlockAlign = channels * bytesPerSample;
	const expectedByteRate = sampleRate * expectedBlockAlign;

	if (
		!Number.isSafeInteger(expectedBlockAlign) ||
		expectedBlockAlign <= 0 ||
		expectedBlockAlign > 0xffff ||
		expectedByteRate > UINT32_MAX ||
		blockAlign !== expectedBlockAlign ||
		byteRate !== expectedByteRate
	) {
		return null;
	}

	return { bitsPerSample, blockAlign, channels, formatTag, sampleRate };
}

function sameWavFormat(left: WavFormat, right: WavFormat): boolean {
	return (
		left.bitsPerSample === right.bitsPerSample &&
		left.blockAlign === right.blockAlign &&
		left.channels === right.channels &&
		left.formatTag === right.formatTag &&
		left.sampleRate === right.sampleRate
	);
}

function readMp4Duration(audio: Buffer): number | null {
	const topLevel = readIsoBoxes(audio, 0, audio.length);

	if (!topLevel?.some((box) => box.type === "ftyp")) {
		return null;
	}

	const durations: number[] = [];
	let hasAudioTrackDuration = false;

	for (const moov of topLevel.filter((box) => box.type === "moov")) {
		const movieBoxes = readIsoBoxes(audio, moov.dataOffset, moov.end);

		if (!movieBoxes) {
			return null;
		}

		for (const movieHeader of movieBoxes.filter((box) => box.type === "mvhd")) {
			const clock = readIsoClock(audio, movieHeader);

			if (
				clock?.durationSeconds !== null &&
				clock?.durationSeconds !== undefined
			) {
				durations.push(clock.durationSeconds);
			}
		}

		for (const track of movieBoxes.filter((box) => box.type === "trak")) {
			const duration = readIsoAudioTrackDuration(audio, track);

			if (duration !== null) {
				durations.push(duration);
				hasAudioTrackDuration = true;
			}
		}
	}

	return hasAudioTrackDuration ? maximumValidDuration(durations) : null;
}

function readWebmDuration(audio: Buffer): number | null {
	const header = readEbmlElement(audio, 0, audio.length);

	if (header?.id !== 0x1a45dfa3 || header.unknownSize) {
		return null;
	}

	const headerChildren = readKnownEbmlChildren(audio, header);
	const docType = headerChildren?.find((element) => element.id === 0x4282);
	const docTypeValue = docType
		? audio.toString("ascii", docType.dataOffset, docType.end).toLowerCase()
		: null;

	if (docTypeValue !== "webm" && docTypeValue !== "matroska") {
		return null;
	}

	const segment = findEbmlSegment(audio, header.end);

	if (!segment) {
		return null;
	}

	const elements = readSegmentElements(audio, segment);

	if (!elements) {
		return null;
	}

	let timecodeScale = 1_000_000;
	let declaredDuration: number | null = null;
	const info = elements.find((element) => element.id === 0x1549a966);

	if (info) {
		const infoChildren = readKnownEbmlChildren(audio, info);

		if (!infoChildren) {
			return null;
		}

		const scale = infoChildren.find((element) => element.id === 0x2ad7b1);
		if (scale) {
			const parsedScale = readEbmlUnsigned(audio, scale);

			if (parsedScale === null || parsedScale <= 0) {
				return null;
			}
			timecodeScale = parsedScale;
		}

		const duration = infoChildren.find((element) => element.id === 0x4489);
		if (duration) {
			const durationUnits = readEbmlFloat(audio, duration);

			if (durationUnits === null) {
				return null;
			}
			declaredDuration = validDuration(
				(durationUnits * timecodeScale) / NANOSECONDS_PER_SECOND,
			);
		}
	}

	const tracksElement = elements.find((element) => element.id === 0x1654ae6b);
	const tracks = tracksElement ? readWebmTracks(audio, tracksElement) : null;

	if (!tracks || ![...tracks.values()].some((track) => track.isOpusAudio)) {
		return null;
	}

	let packetDurationSeconds = 0;
	let timelineEndSeconds = 0;

	for (const cluster of elements.filter(
		(element) => element.id === 0x1f43b675,
	)) {
		const timing = readWebmClusterTiming(audio, cluster, tracks, timecodeScale);

		if (!timing) {
			return null;
		}

		packetDurationSeconds += timing.packetDurationSeconds;
		timelineEndSeconds = Math.max(
			timelineEndSeconds,
			timing.timelineEndSeconds,
		);
	}

	return maximumValidDuration([
		declaredDuration,
		packetDurationSeconds,
		timelineEndSeconds,
	]);
}

function readOggDuration(audio: Buffer): number | null {
	const packets: Buffer[] = [];
	let packetParts: Buffer[] = [];
	let expectedSequence = 0;
	let offset = 0;
	let serial: number | null = null;
	let finalGranule: bigint | null = null;
	let sawEos = false;

	while (offset < audio.length) {
		if (
			sawEos ||
			offset + 27 > audio.length ||
			audio.toString("ascii", offset, offset + 4) !== "OggS" ||
			audio[offset + 4] !== 0
		) {
			return null;
		}

		const headerType = audio[offset + 5] ?? 0;
		const continued = (headerType & 0x01) !== 0;
		const bos = (headerType & 0x02) !== 0;
		const eos = (headerType & 0x04) !== 0;
		const pageSerial = audio.readUInt32LE(offset + 14);
		const pageSequence = audio.readUInt32LE(offset + 18);

		if (
			continued !== packetParts.length > 0 ||
			(expectedSequence === 0 ? !bos : bos) ||
			pageSequence !== expectedSequence ||
			(serial !== null && serial !== pageSerial)
		) {
			return null;
		}

		serial ??= pageSerial;
		expectedSequence += 1;
		const segmentCount = audio[offset + 26] ?? 0;
		const tableOffset = offset + 27;
		const payloadOffset = tableOffset + segmentCount;

		if (payloadOffset > audio.length) {
			return null;
		}

		let payloadCursor = payloadOffset;
		for (let index = 0; index < segmentCount; index += 1) {
			const length = audio[tableOffset + index] ?? 0;
			const end = payloadCursor + length;

			if (end > audio.length) {
				return null;
			}

			packetParts.push(audio.subarray(payloadCursor, end));
			payloadCursor = end;

			if (length < 255) {
				packets.push(Buffer.concat(packetParts));
				packetParts = [];
			}
		}

		const granule = audio.readBigUInt64LE(offset + 6);
		if (eos && granule === 0xffff_ffff_ffff_ffffn) {
			return null;
		}
		if (granule !== 0xffff_ffff_ffff_ffffn) {
			finalGranule = granule;
		}

		sawEos = eos;
		offset = payloadCursor;
	}

	if (!sawEos || packetParts.length > 0 || packets.length < 2) {
		return null;
	}

	const opusHead = packets[0];
	const opusTags = packets[1];

	if (
		!opusHead ||
		opusHead.length < 19 ||
		opusHead.toString("ascii", 0, 8) !== "OpusHead" ||
		!opusTags ||
		opusTags.toString("ascii", 0, 8) !== "OpusTags" ||
		finalGranule === null
	) {
		return null;
	}

	const preSkip = opusHead.readUInt16LE(10);
	if (finalGranule < BigInt(preSkip)) {
		return null;
	}

	let packetDurationSeconds = 0;
	for (const packet of packets.slice(2)) {
		const duration = readOpusPacketDurationSeconds(packet);

		if (duration === null) {
			return null;
		}
		packetDurationSeconds += duration;
	}

	const granuleDuration =
		Number(finalGranule - BigInt(preSkip)) / OPUS_SAMPLE_RATE;

	return maximumValidDuration([granuleDuration, packetDurationSeconds]);
}

type IsoBox = { dataOffset: number; end: number; type: string };

function readIsoBoxes(
	audio: Buffer,
	start: number,
	end: number,
): IsoBox[] | null {
	const boxes: IsoBox[] = [];
	let offset = start;

	while (offset < end) {
		if (offset + 8 > end) {
			return null;
		}

		const size32 = audio.readUInt32BE(offset);
		const type = audio.toString("ascii", offset + 4, offset + 8);
		let headerSize = 8;
		let size: number;

		if (size32 === 1) {
			if (offset + 16 > end) {
				return null;
			}
			const extended = audio.readBigUInt64BE(offset + 8);
			if (extended > BigInt(Number.MAX_SAFE_INTEGER)) {
				return null;
			}
			headerSize = 16;
			size = Number(extended);
		} else {
			size = size32 === 0 ? end - offset : size32;
		}

		const boxEnd = offset + size;
		if (size < headerSize || boxEnd > end || boxEnd <= offset) {
			return null;
		}

		boxes.push({ dataOffset: offset + headerSize, end: boxEnd, type });
		offset = boxEnd;
	}

	return boxes;
}

function readIsoClock(
	audio: Buffer,
	box: IsoBox,
): { durationSeconds: number | null; timescale: number } | null {
	const version = audio[box.dataOffset];

	if (version === 0 && box.dataOffset + 20 <= box.end) {
		const timescale = audio.readUInt32BE(box.dataOffset + 12);
		const duration = audio.readUInt32BE(box.dataOffset + 16);
		return {
			durationSeconds:
				duration === UINT32_MAX ? null : validDuration(duration / timescale),
			timescale,
		};
	}

	if (version === 1 && box.dataOffset + 32 <= box.end) {
		const timescale = audio.readUInt32BE(box.dataOffset + 20);
		const duration = audio.readBigUInt64BE(box.dataOffset + 24);
		return {
			durationSeconds:
				duration === 0xffff_ffff_ffff_ffffn ||
				duration > BigInt(Number.MAX_SAFE_INTEGER)
					? null
					: validDuration(Number(duration) / timescale),
			timescale,
		};
	}

	return null;
}

function readIsoAudioTrackDuration(
	audio: Buffer,
	track: IsoBox,
): number | null {
	const trackChildren = readIsoBoxes(audio, track.dataOffset, track.end);
	const media = trackChildren?.find((box) => box.type === "mdia");

	if (!media) {
		return null;
	}

	const mediaChildren = readIsoBoxes(audio, media.dataOffset, media.end);
	const handler = mediaChildren?.find((box) => box.type === "hdlr");
	const mediaHeader = mediaChildren?.find((box) => box.type === "mdhd");

	if (
		!mediaChildren ||
		!handler ||
		handler.dataOffset + 12 > handler.end ||
		audio.toString("ascii", handler.dataOffset + 8, handler.dataOffset + 12) !==
			"soun" ||
		!mediaHeader
	) {
		return null;
	}

	const clock = readIsoClock(audio, mediaHeader);
	if (!clock || clock.timescale <= 0) {
		return null;
	}

	const durations: Array<number | null> = [clock.durationSeconds];
	const mediaInfo = mediaChildren.find((box) => box.type === "minf");
	const mediaInfoChildren = mediaInfo
		? readIsoBoxes(audio, mediaInfo.dataOffset, mediaInfo.end)
		: null;
	const sampleTable = mediaInfoChildren?.find((box) => box.type === "stbl");
	const sampleTableChildren = sampleTable
		? readIsoBoxes(audio, sampleTable.dataOffset, sampleTable.end)
		: null;
	const timeToSample = sampleTableChildren?.find((box) => box.type === "stts");

	if (timeToSample && timeToSample.dataOffset + 8 <= timeToSample.end) {
		const entryCount = audio.readUInt32BE(timeToSample.dataOffset + 4);
		if (entryCount > (timeToSample.end - timeToSample.dataOffset - 8) / 8) {
			return null;
		}

		let ticks = 0n;
		for (let index = 0; index < entryCount; index += 1) {
			const entryOffset = timeToSample.dataOffset + 8 + index * 8;
			ticks +=
				BigInt(audio.readUInt32BE(entryOffset)) *
				BigInt(audio.readUInt32BE(entryOffset + 4));
		}

		if (ticks <= BigInt(Number.MAX_SAFE_INTEGER)) {
			durations.push(validDuration(Number(ticks) / clock.timescale));
		}
	}

	return maximumValidDuration(durations);
}

type EbmlElement = {
	dataOffset: number;
	end: number;
	id: number;
	unknownSize: boolean;
};

type WebmTrack = { isOpusAudio: boolean };

const SEGMENT_LEVEL_IDS = new Set([
	0x114d9b74, 0x1549a966, 0x1654ae6b, 0x1c53bb6b, 0x1f43b675, 0x1941a469,
	0x1043a770, 0x1254c367,
]);

function readEbmlElement(
	audio: Buffer,
	offset: number,
	bound: number,
): EbmlElement | null {
	const id = readEbmlId(audio, offset, bound);
	if (!id) {
		return null;
	}
	const size = readEbmlSize(audio, offset + id.length, bound);
	if (!size) {
		return null;
	}
	const dataOffset = offset + id.length + size.length;
	const end = size.unknown ? bound : dataOffset + size.value;

	if (dataOffset > bound || end > bound || end < dataOffset) {
		return null;
	}

	return { dataOffset, end, id: id.value, unknownSize: size.unknown };
}

function readEbmlId(
	audio: Buffer,
	offset: number,
	bound: number,
): { length: number; value: number } | null {
	const first = audio[offset];
	if (first === undefined || first === 0) {
		return null;
	}
	let mask = 0x80;
	let length = 1;
	while ((first & mask) === 0 && length <= 4) {
		mask >>= 1;
		length += 1;
	}
	if (length > 4 || offset + length > bound) {
		return null;
	}
	return {
		length,
		value: readUnsignedBigEndian(audio, offset, length),
	};
}

function readEbmlSize(
	audio: Buffer,
	offset: number,
	bound: number,
): { length: number; unknown: boolean; value: number } | null {
	const first = audio[offset];
	if (first === undefined || first === 0) {
		return null;
	}
	let mask = 0x80;
	let length = 1;
	while ((first & mask) === 0 && length <= 8) {
		mask >>= 1;
		length += 1;
	}
	if (length > 8 || offset + length > bound) {
		return null;
	}
	let value = BigInt(first & (mask - 1));
	for (let index = 1; index < length; index += 1) {
		value = value * 256n + BigInt(audio[offset + index] ?? 0);
	}
	const unknown = value === (1n << BigInt(7 * length)) - 1n;
	if (!unknown && value > BigInt(Number.MAX_SAFE_INTEGER)) {
		return null;
	}
	return { length, unknown, value: unknown ? 0 : Number(value) };
}

function readKnownEbmlChildren(
	audio: Buffer,
	container: EbmlElement,
): EbmlElement[] | null {
	const children: EbmlElement[] = [];
	let offset = container.dataOffset;
	while (offset < container.end) {
		const child = readEbmlElement(audio, offset, container.end);
		if (!child || child.unknownSize || child.end <= offset) {
			return null;
		}
		children.push(child);
		offset = child.end;
	}
	return children;
}

function findEbmlSegment(audio: Buffer, offset: number): EbmlElement | null {
	let cursor = offset;

	while (cursor < audio.length) {
		const element = readEbmlElement(audio, cursor, audio.length);
		if (!element) {
			return null;
		}
		if (element.id === 0x18538067) {
			return element;
		}
		if (element.unknownSize || element.end <= cursor) {
			return null;
		}
		cursor = element.end;
	}
	return null;
}

function readSegmentElements(
	audio: Buffer,
	segment: EbmlElement,
): EbmlElement[] | null {
	const elements: EbmlElement[] = [];
	let offset = segment.dataOffset;
	while (offset < segment.end) {
		const element = readEbmlElement(audio, offset, segment.end);
		if (!element) {
			return null;
		}
		if (element.unknownSize) {
			if (element.id !== 0x1f43b675) {
				return null;
			}
			const end = findUnknownClusterEnd(audio, element, segment.end);
			if (end === null || end <= offset) {
				return null;
			}
			elements.push({ ...element, end });
			offset = end;
			continue;
		}
		elements.push(element);
		offset = element.end;
	}
	return elements;
}

function findUnknownClusterEnd(
	audio: Buffer,
	cluster: EbmlElement,
	segmentEnd: number,
): number | null {
	let offset = cluster.dataOffset;
	while (offset < segmentEnd) {
		const child = readEbmlElement(audio, offset, segmentEnd);
		if (!child) {
			return null;
		}
		if (SEGMENT_LEVEL_IDS.has(child.id)) {
			return offset;
		}
		if (child.unknownSize || child.end <= offset) {
			return null;
		}
		offset = child.end;
	}
	return segmentEnd;
}

function readWebmTracks(
	audio: Buffer,
	tracksElement: EbmlElement,
): Map<number, WebmTrack> | null {
	const entries = readKnownEbmlChildren(audio, tracksElement);
	if (!entries) {
		return null;
	}
	const tracks = new Map<number, WebmTrack>();
	for (const entry of entries.filter((element) => element.id === 0xae)) {
		const fields = readKnownEbmlChildren(audio, entry);
		if (!fields) {
			return null;
		}
		const numberElement = fields.find((element) => element.id === 0xd7);
		const typeElement = fields.find((element) => element.id === 0x83);
		const codecElement = fields.find((element) => element.id === 0x86);
		if (!numberElement || !typeElement || !codecElement) {
			continue;
		}
		const trackNumber = readEbmlUnsigned(audio, numberElement);
		const trackType = readEbmlUnsigned(audio, typeElement);
		const codec = audio.toString(
			"ascii",
			codecElement.dataOffset,
			codecElement.end,
		);
		if (trackNumber === null || trackNumber <= 0) {
			return null;
		}
		tracks.set(trackNumber, {
			isOpusAudio: trackType === 2 && codec === "A_OPUS",
		});
	}
	return tracks;
}

function readWebmClusterTiming(
	audio: Buffer,
	cluster: EbmlElement,
	tracks: ReadonlyMap<number, WebmTrack>,
	timecodeScale: number,
): { packetDurationSeconds: number; timelineEndSeconds: number } | null {
	const children = readKnownEbmlChildren(audio, {
		...cluster,
		unknownSize: false,
	});
	if (!children) {
		return null;
	}
	const timecodeElement = children.find((element) => element.id === 0xe7);
	const clusterTimecode = timecodeElement
		? readEbmlUnsigned(audio, timecodeElement)
		: null;
	if (clusterTimecode === null) {
		return null;
	}

	let packetDurationSeconds = 0;
	let timelineEndSeconds = 0;
	for (const child of children) {
		const blocks: EbmlElement[] = [];
		if (child.id === 0xa3) {
			blocks.push(child);
		} else if (child.id === 0xa0) {
			const group = readKnownEbmlChildren(audio, child);
			if (!group) {
				return null;
			}
			blocks.push(...group.filter((element) => element.id === 0xa1));
		}

		for (const block of blocks) {
			const parsed = readWebmOpusBlock(audio, block, tracks);
			if (!parsed) {
				return null;
			}
			if (!parsed.audio) {
				continue;
			}
			const startUnits = clusterTimecode + parsed.relativeTimecode;
			if (startUnits < 0) {
				return null;
			}
			const startSeconds =
				(startUnits * timecodeScale) / NANOSECONDS_PER_SECOND;
			packetDurationSeconds += parsed.durationSeconds;
			timelineEndSeconds = Math.max(
				timelineEndSeconds,
				startSeconds + parsed.durationSeconds,
			);
		}
	}
	return { packetDurationSeconds, timelineEndSeconds };
}

function readWebmOpusBlock(
	audio: Buffer,
	block: EbmlElement,
	tracks: ReadonlyMap<number, WebmTrack>,
):
	| { audio: false; durationSeconds: 0; relativeTimecode: number }
	| { audio: true; durationSeconds: number; relativeTimecode: number }
	| null {
	const trackNumber = readEbmlSize(audio, block.dataOffset, block.end);
	if (!trackNumber || trackNumber.unknown) {
		return null;
	}
	const timecodeOffset = block.dataOffset + trackNumber.length;
	if (timecodeOffset + 3 > block.end) {
		return null;
	}
	const relativeTimecode = audio.readInt16BE(timecodeOffset);
	const flags = audio[timecodeOffset + 2] ?? 0;
	const track = tracks.get(trackNumber.value);
	if (!track?.isOpusAudio) {
		return { audio: false, durationSeconds: 0, relativeTimecode };
	}
	if ((flags & 0x06) !== 0) {
		return null;
	}
	const durationSeconds = readOpusPacketDurationSeconds(
		audio.subarray(timecodeOffset + 3, block.end),
	);
	return durationSeconds === null
		? null
		: { audio: true, durationSeconds, relativeTimecode };
}

function readEbmlUnsigned(audio: Buffer, element: EbmlElement): number | null {
	const length = element.end - element.dataOffset;
	if (length <= 0 || length > 7) {
		return null;
	}
	return readUnsignedBigEndian(audio, element.dataOffset, length);
}

function readEbmlFloat(audio: Buffer, element: EbmlElement): number | null {
	const length = element.end - element.dataOffset;
	const value =
		length === 4
			? audio.readFloatBE(element.dataOffset)
			: length === 8
				? audio.readDoubleBE(element.dataOffset)
				: Number.NaN;
	return Number.isFinite(value) && value > 0 ? value : null;
}

function readOpusPacketDurationSeconds(packet: Buffer): number | null {
	const toc = packet[0];
	if (toc === undefined) {
		return null;
	}
	const config = toc >> 3;
	const frameDurationMs =
		config < 12
			? ([10, 20, 40, 60] as const)[config & 0x03]
			: config < 16
				? ([10, 20] as const)[config & 0x01]
				: ([2.5, 5, 10, 20] as const)[config & 0x03];
	const countCode = toc & 0x03;
	const frameCount =
		countCode === 0
			? 1
			: countCode === 1 || countCode === 2
				? 2
				: (packet[1] ?? 0) & 0x3f;
	const durationMs = (frameDurationMs ?? 0) * frameCount;
	return frameCount > 0 && durationMs > 0 && durationMs <= 120
		? durationMs / 1000
		: null;
}

function readUnsignedBigEndian(
	audio: Buffer,
	offset: number,
	length: number,
): number {
	let value = 0;

	for (let index = 0; index < length; index += 1) {
		value = value * 256 + (audio[offset + index] ?? 0);
	}

	return value;
}

function maximumValidDuration(
	values: readonly (number | null | undefined)[],
): number | null {
	const valid = values.filter(
		(value): value is number => validDuration(value ?? Number.NaN) !== null,
	);
	return valid.length > 0 ? Math.max(...valid) : null;
}

function validDuration(value: number): number | null {
	return Number.isFinite(value) && value > 0 ? value : null;
}
