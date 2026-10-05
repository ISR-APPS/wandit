/**
 * Mock chat thread of the app builder: the pre-turn estimate and the empty
 * focus label that the page still reads. The messages come from the real turn
 * routes now, so the list stays empty. Read only by api/app-builder.services.ts.
 */

import type { BuilderThread } from "../api/dto";

export const MOCK_BUILDER_THREAD: BuilderThread = {
	projectId: "",
	turnEstimateCredits: 6,
	// No preview selection exists yet, so the composer shows no focus chip.
	focusLabel: null,
	messages: [],
};
