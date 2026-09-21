/**
 * Zod schemas for values that enter the app builder from the URL and from
 * localStorage. The route file parses `?view=&panel=&device=&viewport=&file=`
 * with them. The resizable split parses its stored layout.
 * A value the schema does not know becomes undefined. A bad link or a
 * corrupt stored value still opens the workspace on its defaults.
 */

import { z } from "zod";

import {
	BUILDER_VIEWS,
	MORE_PANELS,
	PHONE_DEVICES,
	WEB_VIEWPORTS,
} from "./constants";

// 512 characters holds any path of the generated repository with room to spare.
const FILE_PATH_MAX_LENGTH = 512;

export const appBuilderSearchSchema = z.object({
	view: z.enum(BUILDER_VIEWS).optional().catch(undefined),
	panel: z.enum(MORE_PANELS).optional().catch(undefined),
	device: z.enum(PHONE_DEVICES).optional().catch(undefined),
	viewport: z.enum(WEB_VIEWPORTS).optional().catch(undefined),
	file: z.string().max(FILE_PATH_MAX_LENGTH).optional().catch(undefined),
});

/** Search params of `/app/$projectId` after validation. Every field is optional. */
export type AppBuilderSearch = z.infer<typeof appBuilderSearchSchema>;

/** Layout stored by the resizable split: panel id to percent. */
export const chatLayoutSchema = z.record(z.string(), z.number());
