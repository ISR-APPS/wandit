/**
 * Backfill the narrower WebP renditions (`.w480/.w960/.w1600.webp`) beside
 * images that were stored before the variant pipeline existed.
 *
 * WHY. `emitResponsiveImages` (pages/domain/optimize-image-markup.ts) only
 * writes a `srcset` from renditions it can PROVE exist in R2. Renditions are
 * written on new writes alone (uploads.service.ts, generate-image.ts,
 * image-generator.ts), so without this script the srcset half of the image
 * pipeline reaches only sites built after that deploy — every already
 * published page keeps paying full-size bytes on a phone.
 *
 * SAFE BY CONSTRUCTION:
 * - It NEVER rewrites an existing key. Renditions are new sibling keys, and
 *   the primary object is only read. (Rewriting a stored key in place is
 *   forbidden: every asset key is served `immutable` for a year.)
 * - It skips a key that already has a rendition, so a repeat run is cheap and
 *   an interrupted run resumes. An image too narrow for ANY rendition (under
 *   480 px) has nothing to skip on and is re-read on the next run — the cost
 *   is one GET of a small object.
 * - `storeImageVariants` never throws: an image sharp cannot read, an
 *   animation, or a failed upload is counted as skipped and the walk goes on.
 *
 * Usage (from apps/server, env from apps/server/.env like the other scripts):
 *   pnpm images:backfill-variants                       # uploads/ and sites/
 *   pnpm images:backfill-variants -- --dry-run          # list, change nothing
 *   pnpm images:backfill-variants -- --prefix uploads/user_1/
 *   pnpm images:backfill-variants -- --limit 200 --concurrency 4
 */
import {
	getObjectBytes,
	isR2Configured,
	listObjectsByPrefix,
	r2ObjectExists,
	VARIANT_FILENAME_PATTERN,
	variantKey,
} from "../src/infrastructure/storage/r2";
import { storeImageVariants } from "../src/infrastructure/storage/store-image-variants";

// The two prefixes that hold page images: user attachments and per-project
// build assets (generated images and videos land under sites/ too).
const DEFAULT_PREFIXES = ["uploads/", "sites/"];

// Mirrors DEFAULT_VARIANT_WIDTHS in infrastructure/storage/optimize-image.ts.
// Only used to ASK whether a rendition is already there; the widths that get
// written are the pipeline's own.
const VARIANT_WIDTHS = [480, 960, 1600];

// Raster types the optimizer can re-encode. Everything else (svg, gif, pdf,
// html, mp4) has no meaningful rendition.
const RASTER_EXTENSIONS = new Set(["avif", "jpeg", "jpg", "png", "webp"]);

// One object at a time is slow at fleet scale, and R2 is happy with a handful.
// Kept low by default: this competes with live publish traffic for bandwidth.
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_LIMIT = 5_000;

type Options = {
	concurrency: number;
	dryRun: boolean;
	limit: number;
	prefixes: string[];
};

type Totals = {
	failed: number;
	present: number;
	scanned: number;
	skipped: number;
	written: number;
};

function parseOptions(argv: string[]): Options {
	const prefixes: string[] = [];
	let concurrency = DEFAULT_CONCURRENCY;
	let dryRun = false;
	let limit = DEFAULT_LIMIT;

	for (let index = 0; index < argv.length; index += 1) {
		const flag = argv[index];
		const value = argv[index + 1];

		if (flag === "--dry-run") {
			dryRun = true;
		} else if (flag === "--prefix" && value) {
			prefixes.push(value);
			index += 1;
		} else if (flag === "--limit" && value) {
			limit = Number.parseInt(value, 10);
			index += 1;
		} else if (flag === "--concurrency" && value) {
			concurrency = Number.parseInt(value, 10);
			index += 1;
		}
	}

	return {
		concurrency: Number.isFinite(concurrency) ? Math.max(1, concurrency) : 1,
		dryRun,
		limit: Number.isFinite(limit) ? Math.max(1, limit) : DEFAULT_LIMIT,
		prefixes: prefixes.length > 0 ? prefixes : DEFAULT_PREFIXES,
	};
}

function isRasterKey(key: string): boolean {
	const extension = (key.split(".").pop() ?? "").toLowerCase();

	return RASTER_EXTENSIONS.has(extension);
}

/** Is any rendition of this key already stored? */
async function hasVariant(key: string): Promise<boolean> {
	for (const width of VARIANT_WIDTHS) {
		if (await r2ObjectExists(variantKey(key, width))) {
			return true;
		}
	}

	return false;
}

async function backfillKey(
	key: string,
	options: Options,
	totals: Totals,
): Promise<void> {
	if (await hasVariant(key)) {
		totals.present += 1;

		return;
	}

	if (options.dryRun) {
		totals.written += 1;
		console.log(`would backfill ${key}`);

		return;
	}

	const bytes = await getObjectBytes(key);

	if (bytes === null) {
		totals.failed += 1;
		console.warn(`unreadable ${key}`);

		return;
	}

	const stored = await storeImageVariants(key, bytes);

	if (stored.length === 0) {
		totals.skipped += 1;

		return;
	}

	totals.written += 1;
	console.log(
		`backfilled ${key} → ${stored.map((variant) => variant.width).join(", ")}`,
	);
}

async function run(): Promise<void> {
	if (!isR2Configured()) {
		throw new Error("R2 is not configured — set the R2_* env vars first");
	}

	const options = parseOptions(process.argv.slice(2));
	const totals: Totals = {
		failed: 0,
		present: 0,
		scanned: 0,
		skipped: 0,
		written: 0,
	};

	for (const prefix of options.prefixes) {
		const objects = await listObjectsByPrefix(prefix, options.limit);
		const keys = objects
			.map((object) => object.key)
			.filter((key) => !VARIANT_FILENAME_PATTERN.test(key) && isRasterKey(key));

		totals.scanned += keys.length;
		console.log(`${prefix}: ${keys.length} candidate images`);

		let next = 0;
		const worker = async (): Promise<void> => {
			while (next < keys.length) {
				const key = keys[next] as string;
				next += 1;

				try {
					await backfillKey(key, options, totals);
				} catch (error) {
					totals.failed += 1;
					console.warn(
						`failed ${key}: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			}
		};

		await Promise.all(
			Array.from({ length: Math.min(options.concurrency, keys.length) }, () =>
				worker(),
			),
		);
	}

	console.log(
		`scanned=${totals.scanned} written=${totals.written} already-present=${totals.present} no-rendition=${totals.skipped} failed=${totals.failed}`,
	);
}

run().catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
