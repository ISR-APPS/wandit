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
			targetPlatform: "web",
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
		});
	});

	it("leaves an empty attachment list out of the body", () => {
		const body = toCreateAppProjectBody({
			prompt: "A shop",
			composer: undefined,
			attachments: [],
			locale: "en",
			targetPlatform: "web",
		});

		expect(body.attachments).toBeUndefined();
	});
});
