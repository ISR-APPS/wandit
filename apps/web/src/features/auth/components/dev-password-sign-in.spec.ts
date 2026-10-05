// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { DEV_USER } from "@wandit/auth/dev-password-login";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The Better Auth client keeps the global fetch when its module loads, so
// the component loads after the stub.
const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);
const { DevPasswordSignIn } = await import("./dev-password-sign-in");

// jsdom cannot navigate. posthog-js reads location when it loads, so this
// stub comes after the import.
const assignMock = vi.fn<(url: string) => void>();
vi.stubGlobal("location", {
	assign: assignMock,
	origin: "http://localhost:3301",
});

function stubSignInResponse(status: number, responseJson: string) {
	fetchMock.mockResolvedValueOnce(
		new Response(responseJson, {
			headers: { "content-type": "application/json" },
			status,
		}),
	);
}

const SIGNED_IN_JSON = JSON.stringify({
	redirect: false,
	token: "session-token",
	user: { email: DEV_USER.email, id: "user-1" },
});

function renderForm(nextPath?: string) {
	const onError = vi.fn();
	render(
		createElement(DevPasswordSignIn, {
			nextPath,
			onClearError: vi.fn(),
			onError,
		}),
	);
	fireEvent.click(screen.getByRole("button", { name: "Dev sign-in" }));
	return { onError };
}

function expectButtonEnabled() {
	expect(screen.getByRole("button", { name: "Dev sign-in" })).toHaveProperty(
		"disabled",
		false,
	);
}

afterEach(() => {
	cleanup();
	fetchMock.mockReset();
	assignMock.mockReset();
});

describe("DevPasswordSignIn", () => {
	it("posts the prefilled dev credentials and opens the dashboard", async () => {
		stubSignInResponse(200, SIGNED_IN_JSON);

		const { onError } = renderForm();

		await waitFor(() =>
			expect(assignMock).toHaveBeenCalledWith(
				"http://localhost:3301/dashboard",
			),
		);
		const [input, init] = fetchMock.mock.calls[0] ?? [];
		expect(new URL(String(input)).pathname).toBe("/api/auth/sign-in/email");
		expect(JSON.parse(String(init?.body))).toMatchObject({
			email: DEV_USER.email,
			password: DEV_USER.password,
		});
		expect(onError).not.toHaveBeenCalled();
	});

	it("opens nextPath after sign-in", async () => {
		stubSignInResponse(200, SIGNED_IN_JSON);

		renderForm("/p/project-1");

		await waitFor(() =>
			expect(assignMock).toHaveBeenCalledWith(
				"http://localhost:3301/p/project-1",
			),
		);
	});

	it("shows the server message when the API refuses the password", async () => {
		stubSignInResponse(
			401,
			JSON.stringify({
				code: "INVALID_EMAIL_OR_PASSWORD",
				message: "Invalid email or password",
			}),
		);

		const { onError } = renderForm();

		await waitFor(() =>
			expect(onError).toHaveBeenCalledWith("Invalid email or password"),
		);
		expectButtonEnabled();
		expect(assignMock).not.toHaveBeenCalled();
	});

	it("shows the network error when the API is down", async () => {
		fetchMock.mockRejectedValueOnce(new Error("offline"));

		const { onError } = renderForm();

		await waitFor(() => expect(onError).toHaveBeenCalledWith("offline"));
		expectButtonEnabled();
		expect(assignMock).not.toHaveBeenCalled();
	});
});
