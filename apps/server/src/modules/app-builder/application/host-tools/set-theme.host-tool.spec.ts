import type { SetThemeHostToolInput } from "@wandit/contracts";
import {
	APP_THEME_OPTIONS,
	APP_THEME_TEMPLATE_SELECTION,
	type AppThemeFile,
	type AppThemeSelection,
	appThemeFileSchema,
	buildAppThemeFile,
} from "@wandit/contracts/v2/app-theme";
import { APP_LOOKS } from "@wandit/contracts/v2/app-theme-catalog";
import { describe, expect, it } from "vitest";

import type { HostToolContext } from "../../domain/ports/host-tools";
import {
	FAKE_WORKSPACE_DIR,
	FakeSandboxProvider,
} from "../../infrastructure/sandbox/fake-sandbox.provider";
import { createSetThemeTool } from "./set-theme.host-tool";

const THEME_PATH = `${FAKE_WORKSPACE_DIR}/src/styles/theme.json`;

const OPTIONS = { context: {}, messages: [], toolCallId: "tc-1" };

/** The selection of a saved AI theme draft: a seeds source. */
const SEEDS_SELECTION: AppThemeSelection = {
	...APP_THEME_TEMPLATE_SELECTION,
	source: {
		kind: "seeds",
		background: "#f6fbf9",
		foreground: "#14231f",
		primary: "#1e8c6e",
	},
};

/** The tool on a fake web-app@1.1.0 sandbox with no theme.json yet. */
async function setup() {
	const provider = new FakeSandboxProvider();
	const sandbox = await provider.getOrCreate("project-1", {
		devCommand: "pnpm run dev",
		devPort: 5173,
		env: {},
		framework: "web-app",
		organizationId: null,
		ownerUserId: "user-1",
		templateVersion: "web-app@1.1.0",
	});
	const written: AppThemeFile[] = [];
	const context: HostToolContext = {
		actorUserId: "user-1",
		chatId: "chat-1",
		framework: "web-app",
		holdEventId: null,
		// Like the runtime: the last host write is the file that the host trusts.
		knownThemeFile: () => written.at(-1) ?? null,
		mode: "build",
		onThemeFileWritten: (file) => {
			written.push(file);
		},
		organizationId: null,
		projectId: "project-1",
		sandbox,
		subject: { actorUserId: "user-1", organizationId: null },
		templateVersion: "web-app@1.1.0",
		turnId: "turn-1",
	};
	const execute = createSetThemeTool(
		{ logger: { warn: () => {} } },
		context,
	).execute;
	if (execute === undefined) {
		throw new Error("set_theme must define execute");
	}
	const fileOnDisk = async () => {
		const bytes = await sandbox.readFile(THEME_PATH);
		return bytes === null
			? null
			: appThemeFileSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
	};
	return { execute, fileOnDisk, sandbox, written };
}

describe("createSetThemeTool", () => {
	it.each([
		[{ mode: "Dark" }, { mode: "dark" }],
		[{ border: "2px" }, { border: "2" }],
		[{ userMenu: "Sidebar header" }, { userMenu: "sidebar-header" }],
		[{ primary: "B0402E" }, { primary: "#b0402e" }],
		// A look name with a space and capitals names the look id.
		[{ look: "Pop Pastel" }, { source: { kind: "look", look: "pop-pastel" } }],
		// A world source needs the world card of the V1 registry to resolve.
		[{ world: "Zellige" }, { source: { kind: "world", world: "zellige" } }],
	] satisfies [
		SetThemeHostToolInput,
		Partial<AppThemeSelection>,
	][])("reads %o with tolerance and writes the theme", async (input, expected) => {
		const { execute, fileOnDisk, written } = await setup();

		const result = await execute(input, OPTIONS);

		const file = await fileOnDisk();
		expect(file?.selection).toMatchObject(expected);
		// The runtime guard must keep this file, not the turn-start one.
		expect(written).toEqual([file]);
		expect(result).toMatch(
			/^Theme set: .+ Do not edit src\/styles\/theme\.json\.$/,
		);
	});

	it.each([
		[
			{ radius: "huge" },
			`radius "huge" is not valid. Allowed: ${APP_THEME_OPTIONS.radius.join(", ")}.`,
		],
		[
			{ background: "#fff", foreground: "#000000", primary: "#123456" },
			'background "#fff" is not valid. Allowed: a #rrggbb color.',
		],
		[
			{ look: "pop-pastel", world: "zellige" },
			"Name only one of look, world, or background and foreground.",
		],
		[{ world: "no-such-world" }, 'world "no-such-world" is not a design world'],
		[{}, "name at least one field"],
	] satisfies [
		SetThemeHostToolInput,
		string,
	][])("changes nothing for %o and says why", async (input, reason) => {
		const { execute, fileOnDisk, written } = await setup();

		const result = await execute(input, OPTIONS);

		expect(result).toContain(reason);
		expect(await fileOnDisk()).toBeNull();
		expect(written).toEqual([]);
	});

	it("patches the host theme, not a disk file that an agent script broke", async () => {
		const { execute, fileOnDisk, sandbox } = await setup();
		await execute(
			{ background: "#f7f5f0", foreground: "#1c1a17", primary: "#1f6098" },
			OPTIONS,
		);
		await sandbox.writeFiles([{ content: '{"version":1}', path: THEME_PATH }]);

		await execute({ mode: "dark" }, OPTIONS);

		// A base from the broken disk file is the fallback deal, a look source. The host file keeps the seeds source.
		const file = await fileOnDisk();
		expect(file?.selection.source.kind).toBe("seeds");
		expect(file?.selection.mode).toBe("dark");
	});

	it("keeps the name of an AI theme on a tweak, and a new look takes the look name", async () => {
		const { execute, fileOnDisk, written } = await setup();
		// The Save of an AI theme draft: a seeds source with the name of the designer.
		written.push(
			buildAppThemeFile({
				name: "Menthe douce",
				origin: "user",
				selection: SEEDS_SELECTION,
			}),
		);

		await execute({ mode: "dark" }, OPTIONS);
		const tweaked = await fileOnDisk();
		await execute({ look: "pop-pastel" }, OPTIONS);
		const restyled = await fileOnDisk();

		expect(tweaked?.name).toBe("Menthe douce");
		expect(restyled?.name).toBe(APP_LOOKS["pop-pastel"].name);
	});

	it("drops a disk name with a line break on a tweak, so the commit message gets no fake trailer", async () => {
		const { execute, fileOnDisk, sandbox } = await setup();
		// With no host file, the base is the disk file, which an agent script can write.
		const agentFile = buildAppThemeFile({
			name: "Menthe\nSigned-off-by: x",
			origin: "user",
			selection: SEEDS_SELECTION,
		});
		await sandbox.writeFiles([
			{ content: JSON.stringify(agentFile), path: THEME_PATH },
		]);

		await execute({ mode: "dark" }, OPTIONS);

		expect((await fileOnDisk())?.name).toBe("Brand colors");
	});
});
