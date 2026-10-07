/**
 * Zod schemas for values that enter the app builder from the URL and from
 * localStorage. The route file parses
 * `?view=&panel=&device=&viewport=&file=` with them. The
 * resizable split parses its stored layout.
 * A value the schema does not know becomes undefined. A bad link or a
 * corrupt stored value still opens the workspace on its defaults.
 */

import { z } from "zod";

import {
	BUILDER_VIEWS,
	CLOUD_PANELS,
	MOBILE_PREVIEW_TARGETS,
	MORE_PANELS,
	WEB_VIEWPORTS,
} from "./constants";

// 512 characters holds any path of the generated repository with room to spare.
const FILE_PATH_MAX_LENGTH = 512;

/**
 * validateSearch of routes/_auth/app.$projectId.tsx parses the URL with it.
 * An unknown value becomes undefined, so an old `?view=cloud` or
 * `?viewport=tablet` link opens the default. `panel` holds a More panel id
 * or a Cloud panel id. `device` is the mobile preview target.
 */
export const appBuilderSearchSchema = z.object({
	view: z.enum(BUILDER_VIEWS).optional().catch(undefined),
	panel: z
		.enum([...MORE_PANELS, ...CLOUD_PANELS])
		.optional()
		.catch(undefined),
	device: z.enum(MOBILE_PREVIEW_TARGETS).optional().catch(undefined),
	viewport: z.enum(WEB_VIEWPORTS).optional().catch(undefined),
	file: z.string().max(FILE_PATH_MAX_LENGTH).optional().catch(undefined),
});

/** Search params of `/app/$projectId` after validation. Every field is optional. */
export type AppBuilderSearch = z.infer<typeof appBuilderSearchSchema>;

/** Layout stored by the resizable split: panel id to percent. */
export const chatLayoutSchema = z.record(z.string(), z.number());
