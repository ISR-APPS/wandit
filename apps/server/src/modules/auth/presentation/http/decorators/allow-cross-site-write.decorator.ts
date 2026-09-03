import { SetMetadata } from "@nestjs/common";

export const ALLOW_CROSS_SITE_WRITE_KEY = Symbol("ALLOW_CROSS_SITE_WRITE_KEY");

/**
 * Lets a write route accept requests from any browser origin.
 *
 * Only for routes that are cross-origin BY DESIGN and carry no session
 * authority — the public lead-capture POST embedded in merchant sites. Every
 * other write keeps the CrossSiteWriteGuard's Origin check.
 */
export const AllowCrossSiteWrite = () =>
	SetMetadata(ALLOW_CROSS_SITE_WRITE_KEY, true);
