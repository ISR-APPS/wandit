// The periods of the digest home, the default one, and the search params that hold the period in the URL.
// The period tabs, the page, and the /app route (validateSearch and loader) read this file.
import { z } from "zod";

/** The period choices of the digest, in days. A digest reads a week or a month. */
export const DIGEST_PERIODS = [7, 30] as const;

/** One period of the digest. */
export type DigestPeriod = (typeof DIGEST_PERIODS)[number];

/** The period of the first load: a digest reads a week. */
export const DEFAULT_DAYS: DigestPeriod = 7;

/** /app?days=30 opens the month. No value or an unknown value gives DEFAULT_DAYS. */
export const overviewSearchSchema = z.object({
	days: z.literal(DIGEST_PERIODS).optional().catch(undefined),
});
