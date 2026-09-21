/**
 * Mock chat thread of the app builder: the focus chip and the pre-turn
 * estimate the page still reads. The messages come from the real turn
 * routes now, so the list stays empty. Read only by api/app-builder.services.ts.
 */

import type { BuilderThread } from "../api/dto";

export const MOCK_BUILDER_THREAD: BuilderThread = {
	projectId: "",
	turnEstimateCredits: 6,
	focusLabel: "Pass screen",
	messages: [],
};
