/**
 * Build and upload the narrower renditions of one stored image, beside the
 * primary object it belongs to. Shared by all three image paths (user
 * uploads, builder images, standalone generations) so their key naming and
 * their failure behaviour can never diverge.
 *
 * BEST EFFORT BY CONTRACT: this never throws. A rendition that fails to
 * encode or to upload is simply absent from the answer — the primary object
 * is already stored and the page it serves must not be lost over an
 * optimization.
 */
import { buildImageVariants } from "./optimize-image";
import {
	IMMUTABLE_ASSET_CACHE_CONTROL,
	publicAssetUrl,
	putSiteFile,
	variantKey,
} from "./r2";

export type StoredImageVariant = { url: string; width: number };

export async function storeImageVariants(
	baseKey: string,
	bytes: Uint8Array,
	options: { widths?: number[] } = {},
): Promise<StoredImageVariant[]> {
	const stored: StoredImageVariant[] = [];

	try {
		const variants = await buildImageVariants(bytes, options);

		for (const variant of variants) {
			const key = variantKey(baseKey, variant.width);

			try {
				await putSiteFile(
					key,
					variant.bytes,
					variant.contentType,
					IMMUTABLE_ASSET_CACHE_CONTROL,
				);
				stored.push({ url: publicAssetUrl(key), width: variant.width });
			} catch {
				// One failed upload keeps the widths that already landed: a
				// partial srcset is still narrower than no srcset.
			}
		}
	} catch {
		return stored;
	}

	return stored;
}
