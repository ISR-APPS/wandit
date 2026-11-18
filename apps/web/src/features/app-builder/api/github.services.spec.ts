import { AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";

import { decodeCodeArchiveError } from "./github.services";

const envelope = {
	error: {
		code: "CODE_ARCHIVE_EMPTY",
		message: "The project has no saved code.",
		path: "/api/v2/projects/p1/code/archive",
		requestId: "req-1",
		statusCode: 404,
		timestamp: "2026-11-17T10:00:00.000Z",
	},
};

const bytes = (text: string) => new TextEncoder().encode(text).buffer;

describe("decodeCodeArchiveError", () => {
	it("decodes the error envelope of a 404, so BaseService keeps CODE_ARCHIVE_EMPTY", () => {
		const result = decodeCodeArchiveError(
			bytes(JSON.stringify(envelope)),
			new AxiosHeaders(),
			404,
		);
		expect(result).toEqual(envelope);
	});

	it.each([
		["a 200 that holds an envelope", JSON.stringify(envelope), 200],
		["an error that is not JSON", "<html>Bad gateway</html>", 502],
		["a JSON error that is not an envelope", '{"message":"no"}', 413],
	])("keeps the bytes of %s", (_name, text, status) => {
		const body = bytes(text);
		expect(decodeCodeArchiveError(body, new AxiosHeaders(), status)).toBe(body);
	});
});
