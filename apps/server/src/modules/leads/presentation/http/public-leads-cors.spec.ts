import { describe, expect, it } from "vitest";

import { publicLeadCaptureCorsOptions } from "./public-leads-cors";

describe("publicLeadCaptureCorsOptions", () => {
	it.each([
		"/api/public/leads/0b0e8b1e-4a6f-4a5e-9a34-2f4dfd7f2c11",
		"/api/public/leads/form-id?source=published%20page",
	])("allows the exact public capture URL: %s", (url) => {
		expect(publicLeadCaptureCorsOptions(url)).toEqual({
			allowedHeaders: ["Content-Type"],
			credentials: false,
			exposedHeaders: ["Retry-After"],
			maxAge: 86_400,
			methods: ["POST"],
			origin: "*",
		});
	});

	it.each([
		"/api/public/leads",
		"/api/public/leads/",
		"/api/public/leads/form-id/extra",
		"/api/public/leads-other/form-id",
		"/api/v1/projects/project-id/leads",
	])("does not broaden wildcard CORS beyond the capture route: %s", (url) => {
		expect(publicLeadCaptureCorsOptions(url)).toBeNull();
	});
});
