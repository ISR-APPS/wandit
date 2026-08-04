import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	getObjectBytes,
	publicAssetKeyFromUrl,
} from "../../../../infrastructure/storage/r2";
import {
	type AvailableDocument,
	createReadAttachmentTool,
} from "./read-attachment.tool";

vi.mock("../../../../infrastructure/storage/r2", () => ({
	getObjectBytes: vi.fn(),
	publicAssetKeyFromUrl: vi.fn(),
}));

const DOCUMENT_URL = "https://assets.example.com/uploads/user_1/uuid/leads.csv";

const DOCUMENT: AvailableDocument = {
	filename: "leads.csv",
	mediaType: "text/csv",
	url: DOCUMENT_URL,
};

function setup(availableDocuments: AvailableDocument[] = [DOCUMENT]) {
	const run = createReadAttachmentTool({ availableDocuments }).execute;

	if (!run) {
		throw new Error("read_attachment tool must have execute");
	}

	return (url: string) =>
		run({ url }, {
			messages: [],
			toolCallId: "call_1",
		} as unknown as Parameters<typeof run>[1]);
}

beforeEach(() => {
	vi.mocked(publicAssetKeyFromUrl)
		.mockReset()
		.mockReturnValue("uploads/user_1/uuid/leads.csv");
	vi.mocked(getObjectBytes).mockReset();
});

describe("read_attachment tool", () => {
	it("refuses a URL that is not an attachment of this conversation", async () => {
		const execute = setup();

		const output = await execute("https://evil.example.com/steal.csv");

		expect(output).toEqual({
			message: "This URL is not an attachment in this conversation.",
			status: "unavailable",
		});
		expect(getObjectBytes).not.toHaveBeenCalled();
	});

	it("answers unavailable when storage has no such object", async () => {
		const execute = setup();
		vi.mocked(getObjectBytes).mockResolvedValue(null);

		const output = await execute(DOCUMENT_URL);

		expect(output).toEqual({
			message: expect.stringContaining("could not be loaded"),
			status: "unavailable",
		});
	});

	it("returns the extracted text for an attached document", async () => {
		const execute = setup();
		vi.mocked(getObjectBytes).mockResolvedValue(
			new TextEncoder().encode("name,phone\nSalon Lila,0555"),
		);

		const output = await execute(DOCUMENT_URL);

		expect(output).toEqual({
			filename: "leads.csv",
			mediaType: "text/csv",
			status: "ok",
			text: "name,phone\nSalon Lila,0555",
			truncated: false,
		});
		expect(getObjectBytes).toHaveBeenCalledWith(
			"uploads/user_1/uuid/leads.csv",
		);
	});
});
