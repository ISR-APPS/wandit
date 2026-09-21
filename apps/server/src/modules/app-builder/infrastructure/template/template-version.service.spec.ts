import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
	TEMPLATE_VERSION_FILE_PATH,
	TemplateVersionService,
} from "./template-version.service";

describe("TemplateVersionService", () => {
	it("answers the trimmed first line of the version file", () => {
		const dir = mkdtempSync(join(tmpdir(), "template-version-"));
		const file = join(dir, "template_version");
		writeFileSync(file, "  web-app@9.9.9\n2026-09-14\n");

		expect(new TemplateVersionService(file).current).toBe("web-app@9.9.9");
	});

	it("throws with the path in the message when the file is missing", () => {
		const missing = join(tmpdir(), "no-such-template_version");

		expect(() => new TemplateVersionService(missing)).toThrow(
			`templates/web-app/template_version is missing or empty at ${missing}`,
		);
	});

	it("reads the real repo file by default", () => {
		expect(new TemplateVersionService().current).toBe("web-app@1.0.0");
		expect(TEMPLATE_VERSION_FILE_PATH).toContain(
			"templates/web-app/template_version",
		);
	});
});
