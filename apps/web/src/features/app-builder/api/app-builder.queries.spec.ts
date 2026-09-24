import type { CloudBackendResponse } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import { cloudBackendPollMs } from "./app-builder.queries";

function backend(status: CloudBackendResponse["status"]): CloudBackendResponse {
	return { status, ref: null, region: null, failureCode: null };
}

describe("cloudBackendPollMs", () => {
	it("polls every 5 s while Supabase creates the project, and not after", () => {
		expect(cloudBackendPollMs(backend("creating"))).toBe(5_000);
		expect(cloudBackendPollMs(backend("active"))).toBe(false);
		expect(cloudBackendPollMs(backend("error"))).toBe(false);
		expect(cloudBackendPollMs(undefined)).toBe(false);
	});
});
