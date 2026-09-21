// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BuilderDiffLine } from "../../api/dto";
import { DiffCard, type DiffCardProps } from "./diff-card";

const LINES: BuilderDiffLine[] = [
	{ kind: "context", text: "export function PassScreen() {" },
	{ kind: "remove", text: "  const token = member.id;" },
	{ kind: "add", text: "  const token = useSignedPassToken(member.id);" },
	{ kind: "remove", text: "  const size = 120;" },
	{ kind: "add", text: "  const size = 240;" },
	{ kind: "add", text: "  const expiry = member.expiresAt;" },
	{ kind: "context", text: "  return null;" },
];

function renderCard(props: Partial<DiffCardProps> = {}) {
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(DiffCard, {
			path: "app/(tabs)/pass.tsx",
			lines: LINES,
			...props,
		}),
	};
	return render(createElement(I18nProvider, providerProps));
}

/** True when sonner added a toast with this title after the first `skip` history entries. */
function hasToastAfter(skip: number, title: string): boolean {
	return toast
		.getHistory()
		.slice(skip)
		.some((item) => "title" in item && item.title === title);
}

afterEach(cleanup);

describe("DiffCard", () => {
	it("renders the path, the counts, and one row per line with its kind", () => {
		const { container } = renderCard();
		expect(screen.getByText("app/(tabs)/pass.tsx")).toBeTruthy();
		expect(screen.getByText("+3")).toBeTruthy();
		expect(screen.getByText("-2")).toBeTruthy();
		expect(container.querySelectorAll("[data-line-kind]")).toHaveLength(7);
		expect(container.querySelectorAll('[data-line-kind="add"]')).toHaveLength(
			3,
		);
		expect(
			container.querySelectorAll('[data-line-kind="remove"]'),
		).toHaveLength(2);
		expect(
			container.querySelectorAll('[data-line-kind="context"]'),
		).toHaveLength(2);
		expect(
			container.querySelector('[data-line-kind="add"]')?.className,
		).toContain("bg-success/10");
		expect(
			container.querySelector('[data-line-kind="remove"]')?.className,
		).toContain("bg-destructive/10");
	});

	it("hides the removed count when no line is removed", () => {
		renderCard({
			lines: LINES.filter((line) => line.kind !== "remove"),
		});
		expect(screen.getByText("+3")).toBeTruthy();
		expect(screen.queryByText(/^-\d+$/)).toBeNull();
	});

	it("writes the signed diff to the clipboard and shows the copied toast", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			value: { writeText },
			configurable: true,
		});
		const seenToasts = toast.getHistory().length;
		renderCard();
		fireEvent.click(screen.getByRole("button", { name: "Copy" }));
		await waitFor(() => expect(hasToastAfter(seenToasts, "Copied")).toBe(true));
		expect(writeText).toHaveBeenCalledWith(
			[
				" export function PassScreen() {",
				"-  const token = member.id;",
				"+  const token = useSignedPassToken(member.id);",
				"-  const size = 120;",
				"+  const size = 240;",
				"+  const expiry = member.expiresAt;",
				"   return null;",
			].join("\n"),
		);
		Reflect.deleteProperty(navigator, "clipboard");
	});
});
