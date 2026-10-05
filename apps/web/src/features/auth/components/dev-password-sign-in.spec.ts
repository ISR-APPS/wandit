// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { DEV_USER } from "@wandit/auth/dev-password-login";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

// The Better Auth client keeps the global fetch when its module loads, so
// the component loads after the stub.
const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

const { env } = await import("@wandit/env/web");
const originalServerUrl = env.VITE_SERVER_URL;
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
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: vi.fn(),
		children: createElement(DevPasswordSignIn, {
			nextPath,
			onClearError: vi.fn(),
			onError,
		}),
	};
	render(createElement(I18nProvider, providerProps));
	return { onError };
}

function expectButtonEnabled() {
	expect(screen.getByRole("button", { name: "Dev sign-in" })).toHaveProperty(
		"disabled",
		false,
	);
}

beforeEach(() => {
	vi.stubEnv("DEV", true);
	Reflect.set(env, "VITE_SERVER_URL", "http://localhost:3000");
	vi.stubGlobal("location", {
		assign: assignMock,
		origin: "http://localhost:3301",
	});
});

afterAll(() => {
	Reflect.set(env, "VITE_SERVER_URL", originalServerUrl);
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

afterEach(() => {
	cleanup();
	fetchMock.mockReset();
	assignMock.mockReset();
});

describe("DevPasswordSignIn", () => {
	it("hides the form in a production build", () => {
		vi.stubEnv("DEV", false);
		renderForm();
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("hides the form on a public browser host", () => {
		vi.stubGlobal("location", { origin: "https://public.trycloudflare.com" });
		renderForm();
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("hides the form when the API has a public host", () => {
		Reflect.set(env, "VITE_SERVER_URL", "https://api.wandit.dev");
		expect(env.VITE_SERVER_URL).toBe("https://api.wandit.dev");
		renderForm();
		expect(screen.queryByRole("button")).toBeNull();
	});

	it.each([
		"/",
		"//evil.example",
		"/\\evil.example",
	])("keeps destination %s on the dashboard", async (path) => {
		stubSignInResponse(200, SIGNED_IN_JSON);
		renderForm(path);
		fireEvent.click(screen.getByRole("button", { name: "Dev sign-in" }));
		await waitFor(() =>
			expect(assignMock).toHaveBeenCalledWith(
				"http://localhost:3301/dashboard",
			),
		);
	});

	it("disables another submission until the request completes", async () => {
		let resolveResponse: ((response: Response) => void) | undefined;
		fetchMock.mockImplementationOnce(
			() =>
				new Promise<Response>((resolve) => {
					resolveResponse = resolve;
				}),
		);
		renderForm();
		const button = screen.getByRole("button", { name: "Dev sign-in" });
		fireEvent.click(button);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
		expect(button).toHaveProperty("disabled", true);
		const form = button.closest("form");
		if (!form) throw new Error("The sign-in button must belong to a form.");
		fireEvent.submit(form);
		expect(fetchMock).toHaveBeenCalledOnce();
		if (!resolveResponse)
			throw new Error("The request must start before it completes.");
		resolveResponse(
			new Response(SIGNED_IN_JSON, {
				headers: { "content-type": "application/json" },
			}),
		);
		await waitFor(() => expect(assignMock).toHaveBeenCalledOnce());
	});

	it("posts the prefilled dev credentials and opens the dashboard", async () => {
		stubSignInResponse(200, SIGNED_IN_JSON);

		const { onError } = renderForm();
		fireEvent.click(screen.getByRole("button", { name: "Dev sign-in" }));

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
		fireEvent.click(screen.getByRole("button", { name: "Dev sign-in" }));

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
		fireEvent.click(screen.getByRole("button", { name: "Dev sign-in" }));

		await waitFor(() =>
			expect(onError).toHaveBeenCalledWith("Invalid email or password"),
		);
		expectButtonEnabled();
		expect(assignMock).not.toHaveBeenCalled();
	});

	it("shows the translated fallback when an API failure has no message", async () => {
		stubSignInResponse(
			401,
			JSON.stringify({ code: "INVALID_EMAIL_OR_PASSWORD", message: "" }),
		);
		const { onError } = renderForm();
		fireEvent.click(screen.getByRole("button", { name: "Dev sign-in" }));
		await waitFor(() =>
			expect(onError).toHaveBeenCalledWith("Dev sign-in failed."),
		);
		expectButtonEnabled();
	});

	it("shows the translated fallback for a non-Error network rejection", async () => {
		fetchMock.mockRejectedValueOnce("offline");
		const { onError } = renderForm();
		fireEvent.click(screen.getByRole("button", { name: "Dev sign-in" }));
		await waitFor(() =>
			expect(onError).toHaveBeenCalledWith("Dev sign-in failed."),
		);
		expectButtonEnabled();
	});

	it("shows the network error when the API is down", async () => {
		fetchMock.mockRejectedValueOnce(new Error("offline"));

		const { onError } = renderForm();
		fireEvent.click(screen.getByRole("button", { name: "Dev sign-in" }));

		await waitFor(() => expect(onError).toHaveBeenCalledWith("offline"));
		expectButtonEnabled();
		expect(assignMock).not.toHaveBeenCalled();
	});
});
