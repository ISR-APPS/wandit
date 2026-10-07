import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Logger } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { MobileTemplateUnavailableError } from "../../domain/errors/mobile-template-unavailable.error";
import { TEMPLATE_ARCHIVE_DIR } from "../sandbox/template-init";
import {
	TEMPLATE_VERSION_FILE_PATHS,
	TemplateVersionService,
} from "./template-version.service";

/** Writes one version file into a fresh temp folder and answers its path. */
function versionFile(content: string): string {
	const file = join(mkdtempSync(join(tmpdir(), "template-version-")), "v");
	writeFileSync(file, content);
	return file;
}

const MISSING = join(tmpdir(), "no-such-template_version");

describe("TemplateVersionService", () => {
	it("answers the trimmed first line of each version file", () => {
		const service = new TemplateVersionService({
			mobile: versionFile("mobile-app@2.0.0\n2026-09-25\nexpo-sdk@57\n"),
			web: versionFile("  web-app@9.9.9\n2026-09-14\n"),
		});

		expect(service.versionFor("web")).toBe("web-app@9.9.9");
		expect(service.versionFor("mobile")).toBe("mobile-app@2.0.0");
	});

	it("boots without the mobile file, warns once, and still answers web", () => {
		const warn = vi
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => undefined);

		const service = new TemplateVersionService({
			mobile: MISSING,
			web: versionFile("web-app@1.0.0\n"),
		});

		expect(service.versionFor("web")).toBe("web-app@1.0.0");
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining(MISSING));
		warn.mockRestore();
	});

	it("throws MobileTemplateUnavailableError for mobile when the mobile file is empty", () => {
		const warn = vi
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => undefined);
		const service = new TemplateVersionService({
			mobile: versionFile("\n"),
			web: versionFile("web-app@1.0.0\n"),
		});

		expect(() => service.versionFor("mobile")).toThrow(
			MobileTemplateUnavailableError,
		);
		warn.mockRestore();
	});

	it("throws with the path in the message when the web file is missing", () => {
		expect(
			() =>
				new TemplateVersionService({
					mobile: versionFile("mobile-app@1.0.0\n"),
					web: MISSING,
				}),
		).toThrow(
			`templates/web-app/template_version is missing or empty at ${MISSING}`,
		);
	});

	it("reads the real repo web file by default", () => {
		const warn = vi
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => undefined);

		expect(new TemplateVersionService().versionFor("web")).toBe(
			"web-app@1.0.0",
		);
		expect(TEMPLATE_VERSION_FILE_PATHS).toEqual({
			mobile: join(TEMPLATE_ARCHIVE_DIR, "mobile-app/template_version"),
			web: join(TEMPLATE_ARCHIVE_DIR, "web-app/template_version"),
		});
		warn.mockRestore();
	});
});
