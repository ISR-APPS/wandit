import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { authClient } from "@/lib/auth-client";

export class MediaDownloadError extends Error {
	constructor(options?: { cause?: unknown }) {
		super("Media download failed", options);
		this.name = "MediaDownloadError";
	}
}

export function isMediaDownloadError(
	error: unknown,
): error is MediaDownloadError {
	return error instanceof MediaDownloadError;
}

/**
 * Download a (possibly credentialed) media URL with the session cookie into
 * the cache directory, then hand it to the OS share sheet — the phone's
 * equivalent of the web's `<a download>` (generalized from the lead-scrape
 * workbook flow; the phone has no cookie jar, so the Cookie header rides
 * along by hand).
 */
export async function downloadAndShareMedia({
	url,
	filename,
	mimeType,
}: {
	url: string;
	filename: string;
	mimeType?: string;
}): Promise<void> {
	let file: File;
	try {
		const directory = new Directory(Paths.cache, "chat-media");
		directory.create({ idempotent: true, intermediates: true });
		const target = new File(directory, filename);
		const cookie = authClient.getCookie();
		file = await File.downloadFileAsync(url, target, {
			headers: cookie ? { Cookie: cookie } : undefined,
			idempotent: true,
		});
	} catch (error) {
		throw new MediaDownloadError({ cause: error });
	}

	try {
		await Sharing.shareAsync(file.uri, {
			dialogTitle: filename,
			...(mimeType ? { mimeType } : {}),
		});
	} catch {
		// Expo Sharing cannot distinguish dismissal from other share termination.
	}
}

/** Best-effort filename from a media URL, with a typed fallback. */
export function mediaFilenameFromUrl(url: string, fallback: string): string {
	try {
		const pathname = new URL(url).pathname;
		const base = pathname.split("/").filter(Boolean).at(-1);
		if (base && /\.[a-z0-9]{2,5}$/i.test(base)) return base;
	} catch {
		// Relative or malformed URL — fall through to the fallback name.
	}
	return fallback;
}
