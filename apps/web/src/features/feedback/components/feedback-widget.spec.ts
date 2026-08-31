// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { TooltipProvider } from "@wandit/ui/components/tooltip";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FeedbackButton } from "./feedback-widget";

const state = vi.hoisted(() => ({
	mutateAsync: vi.fn(),
}));

vi.mock("@/features/auth", () => ({
	useSession: () => ({ data: { user: { id: "user-1" } } }),
}));

vi.mock("@/lib/i18n", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock("@/lib/api-client", () => ({
	getApiErrorMessage: () => "feedback failed",
}));

vi.mock("@wandit/internationalization/react", () => ({}));

vi.mock("../api/feedback.mutations", () => ({
	useCreateFeedback: () => ({
		isPending: false,
		mutateAsync: state.mutateAsync,
	}),
}));

vi.mock("../lib/capture-screenshot", () => ({
	captureScreenshot: () => Promise.resolve(null),
}));

vi.mock("@wandit/analytics/browser", () => ({
	captureEvent: vi.fn(),
	getAnalytics: () => null,
}));

vi.mock("@wandit/observability/browser", () => ({
	getLastCapturedError: () => null,
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

describe("FeedbackButton chat context", () => {
	beforeEach(() => {
		state.mutateAsync.mockReset();
		state.mutateAsync.mockResolvedValue({
			feedbackId: "22222222-2222-4222-8222-222222222222",
			issueId: null,
		});
	});

	afterEach(cleanup);

	it("includes the active chatId in the submitted widget payload", async () => {
		const chatId = "11111111-1111-4111-8111-111111111111";
		render(
			createElement(
				TooltipProvider,
				null,
				createElement(FeedbackButton, { chatId }),
			),
		);

		fireEvent.click(
			screen.getByRole("button", { name: "common.feedback.open" }),
		);
		const message = await screen.findByLabelText(
			"common.feedback.messageLabel",
		);
		fireEvent.change(message, { target: { value: "The preview is blank." } });
		fireEvent.click(
			screen.getByRole("button", { name: "common.feedback.submit" }),
		);

		await waitFor(() => expect(state.mutateAsync).toHaveBeenCalledOnce());
		expect(state.mutateAsync).toHaveBeenCalledWith(
			expect.objectContaining({
				chatId,
				message: "The preview is blank.",
			}),
		);
	});
});
