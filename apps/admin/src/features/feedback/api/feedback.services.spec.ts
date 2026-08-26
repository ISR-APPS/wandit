import { adminListFeedbackQuerySchema, adminRoutes } from "@wandit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiGet } from "@/lib/api-client";

import { listFeedback } from "./feedback.services";

vi.mock("@/lib/api-client", () => ({
	apiGet: vi.fn(),
	apiPatch: vi.fn(),
}));

const apiGetMock = vi.mocked(apiGet);

afterEach(() => {
	vi.clearAllMocks();
});

describe("listFeedback", () => {
	it("serializes filters as CSV params the contract accepts", async () => {
		apiGetMock.mockResolvedValueOnce({
			items: [],
			page: 2,
			pageSize: 20,
			total: 0,
		});

		await listFeedback({
			page: 2,
			pageSize: 20,
			q: "publish",
			sort: "priority",
			status: ["new", "reviewing"],
			category: ["bug", "idea"],
			priority: ["urgent", "high"],
		});

		expect(apiGetMock).toHaveBeenCalledWith(adminRoutes.feedback, {
			page: 2,
			pageSize: 20,
			q: "publish",
			sort: "priority",
			status: "new,reviewing",
			category: "bug,idea",
			priority: "urgent,high",
		});

		// The params the client sends must survive the server-side schema.
		const [, sentParams] = apiGetMock.mock.calls[0] as [string, object];
		const parsed = adminListFeedbackQuerySchema.parse(sentParams);

		expect(parsed).toMatchObject({
			status: ["new", "reviewing"],
			category: ["bug", "idea"],
			priority: ["urgent", "high"],
		});
	});

	it("omits empty search and unset filters", async () => {
		apiGetMock.mockResolvedValueOnce({
			items: [],
			page: 1,
			pageSize: 20,
			total: 0,
		});

		await listFeedback({
			page: 1,
			pageSize: 20,
			q: "",
			sort: "newest",
		});

		expect(apiGetMock).toHaveBeenCalledWith(adminRoutes.feedback, {
			page: 1,
			pageSize: 20,
			q: undefined,
			sort: "newest",
			status: undefined,
			category: undefined,
			priority: undefined,
		});
	});
});
