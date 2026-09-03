import {
	isWanditUploadUrl,
	publicAssetKeyFromUrl,
} from "../../../../infrastructure/storage/r2";

const MAX_BRIEF_USER_PHOTOS = 6;
const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/gi;
const TRAILING_URL_PUNCTUATION = /[\])},.!?:;*_~]+$/;
const IMAGE_EXTENSIONS = new Set(["jpeg", "jpg", "png", "webp"]);

function stripTrailingUrlPunctuation(url: string): string {
	return url.replace(TRAILING_URL_PUNCTUATION, "");
}

export function extractBriefUserPhotoUrls(brief: string): string[] {
	const photos: string[] = [];
	const seen = new Set<string>();

	for (const match of brief.matchAll(URL_PATTERN)) {
		const url = stripTrailingUrlPunctuation(match[0]);
		if (seen.has(url) || !isWanditUploadUrl(url)) continue;

		const key = publicAssetKeyFromUrl(url);
		if (!key) continue;

		const keyParts = key.split("/");
		if (keyParts.length !== 4) continue;

		const filename = keyParts[3];
		const extension = filename?.split(".").pop()?.toLowerCase();
		if (!extension || !IMAGE_EXTENSIONS.has(extension)) continue;

		seen.add(url);
		photos.push(url);
		if (photos.length === MAX_BRIEF_USER_PHOTOS) break;
	}

	return photos;
}
