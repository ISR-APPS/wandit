import type { UploadAttachmentResponse } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import { toCreateAppProjectBody } from "./create-app-project-body";

const attachment: UploadAttachmentResponse = {
	url: "https://files.example/a.png",
	key: "uploads/a.png",
	mediaType: "image/png",
	filename: "a.png",
	size: 12,
};

describe("toCreateAppProjectBody", () => {
	it("maps the uploads to file refs and sends the locale as the app language", () => {
		const body = toCreateAppProjectBody({
			prompt: "Une app de courses",
			composer: undefined,
			attachments: [attachment],
			locale: "fr",
			appType: "web",
			mode: "plan",
		});

		expect(body).toEqual({
			prompt: "Une app de courses",
			composer: undefined,
			attachments: [
				{
					url: "https://files.example/a.png",
					mediaType: "image/png",
					filename: "a.png",
				},
			],
			targetPlatform: "web",
			languages: ["fr"],
			mode: "plan",
		});
	});

	it("leaves an empty attachment list out of the body", () => {
		const body = toCreateAppProjectBody({
			prompt: "A shop",
			composer: undefined,
			attachments: [],
			locale: "en",
			appType: "web",
			mode: "build",
		});

		expect(body.attachments).toBeUndefined();
	});

	it.each([
		["desktop", { targetPlatform: "desktop" }],
		[
			"desktop-electron",
			{ targetPlatform: "desktop", desktopEngine: "electron" },
		],
	] as const)("sends the app type %j as %j", (appType, expected) => {
		const body = toCreateAppProjectBody({
			prompt: "A stock tool",
			composer: undefined,
			attachments: undefined,
			locale: "en",
			appType,
			mode: "build",
		});

		expect({
			targetPlatform: body.targetPlatform,
			desktopEngine: body.desktopEngine,
		}).toEqual(expected);
	});
});
