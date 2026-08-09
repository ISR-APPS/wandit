/**
 * example.constants.ts — fixed values for this feature.
 *
 * Constants that more than one file in the feature needs live here so there is a
 * single source of truth (endpoints, page sizes, limits, default filters, …).
 */

// Endpoint base for this feature. base-service adds the /api/v1 prefix, so we only
// write the feature-relative part. Result: GET /api/v1/examples.
export const EXAMPLE_BASE_PATH = "/examples";

// How many records a list request should ask for at a time.
export const EXAMPLES_PAGE_SIZE = 20;
