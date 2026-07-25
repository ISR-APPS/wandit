import { getMockOverviewSnapshot } from "../lib/mock-overview";
import type { OverviewRange, OverviewSnapshot } from "./overview.dto";

const MOCK_LATENCY_MS = 180;

export async function getOverview(
	range: OverviewRange,
): Promise<OverviewSnapshot> {
	await mockLatency();
	return {
		...getMockOverviewSnapshot(range),
		generatedAt: new Date().toISOString(),
	};
}

function mockLatency() {
	return new Promise<void>((resolve) => {
		globalThis.setTimeout(resolve, MOCK_LATENCY_MS);
	});
}
