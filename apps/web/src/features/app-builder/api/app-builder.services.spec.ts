import { beforeEach, describe, expect, it } from "vitest";
import {
	getAppProject,
	getBuilderThread,
	getCodeFile,
	getPaymentsSummary,
	getProjectSettings,
	getSignInSummary,
	listAppVersions,
	resetMockStore,
	sendBuilderMessage,
	setCollaboratorRole,
	setPaymentsMode,
	setSignInMethod,
	updateAppProject,
} from "./app-builder.services";

const WEB_ID = "nadi-fitness";
const MOBILE_ID = "nadi-fitness-mobile";

beforeEach(() => {
	resetMockStore();
});

describe("getAppProject", () => {
	it("returns null for an unknown id", async () => {
		expect(await getAppProject("missing")).toBeNull();
	});

	it("returns a copy, so a caller cannot change the store", async () => {
		const first = await getAppProject(WEB_ID);
		if (!first) throw new Error("fixture missing");
		first.name = "changed";
		const second = await getAppProject(WEB_ID);
		expect(second?.name).toBe("Nadi Fitness");
	});
});

describe("sendBuilderMessage", () => {
	it("appends the user message and a reply, and saves a version in build mode", async () => {
		const before = await getBuilderThread(WEB_ID);
		const after = await sendBuilderMessage(WEB_ID, {
			text: "Add a classes screen",
			mode: "build",
		});
		expect(after.messages).toHaveLength(before.messages.length + 2);
		expect(after.messages.at(-2)?.role).toBe("user");
		expect(after.messages.at(-1)?.role).toBe("assistant");
		const project = await getAppProject(WEB_ID);
		expect(project?.versionNumber).toBe(5);
		expect(project?.unpublishedChanges).toBe(4);
		expect((await listAppVersions(WEB_ID))[0]?.number).toBe(5);
	});

	it("closes the open question of the last reply with the sent text", async () => {
		const after = await sendBuilderMessage(MOBILE_ID, {
			text: "Both",
			mode: "plan",
		});
		// The mock thread ends with one open question; the reply and the user message follow it.
		const asked = after.messages.at(-3);
		const question = asked?.parts.find((part) => part.type === "data-question");
		expect(question?.type === "data-question" && question.data.answer).toBe(
			"Both",
		);
	});

	it("does not save a version in plan mode", async () => {
		await sendBuilderMessage(WEB_ID, {
			text: "How would you do it?",
			mode: "plan",
		});
		const project = await getAppProject(WEB_ID);
		expect(project?.versionNumber).toBe(4);
	});

	it("throws for an unknown project", async () => {
		await expect(
			sendBuilderMessage("missing", { text: "x", mode: "build" }),
		).rejects.toThrow("Unknown app project");
	});
});

describe("updateAppProject", () => {
	it("changes the kind", async () => {
		const project = await updateAppProject(WEB_ID, { kind: "mobile" });
		expect(project.kind).toBe("mobile");
		expect((await getAppProject(WEB_ID))?.kind).toBe("mobile");
	});
});

describe("setSignInMethod", () => {
	it("flips one method and leaves the others", async () => {
		const summary = await setSignInMethod(WEB_ID, {
			methodId: "google",
			enabled: true,
		});
		expect(summary.methods.find((m) => m.id === "google")?.enabled).toBe(true);
		expect(summary.methods.find((m) => m.id === "phoneOtp")?.enabled).toBe(
			true,
		);
		expect((await getSignInSummary(WEB_ID)).methods).toEqual(summary.methods);
	});
});

describe("setCollaboratorRole", () => {
	it("changes the role of one collaborator", async () => {
		const settings = await setCollaboratorRole(WEB_ID, {
			collaboratorId: "u2",
			role: "viewer",
		});
		expect(settings.collaborators.find((c) => c.id === "u2")?.role).toBe(
			"viewer",
		);
		expect((await getProjectSettings(WEB_ID)).collaborators[1]?.role).toBe(
			"viewer",
		);
	});
});

describe("setCollaboratorRole with an unknown id", () => {
	it("throws and changes nothing", async () => {
		await expect(
			setCollaboratorRole(WEB_ID, { collaboratorId: "nobody", role: "viewer" }),
		).rejects.toThrow("Unknown collaborator");
		expect((await getProjectSettings(WEB_ID)).collaborators[1]?.role).toBe(
			"editor",
		);
	});
});

describe("setPaymentsMode", () => {
	it("switches a connected provider to test keys", async () => {
		const summary = await setPaymentsMode(WEB_ID, "test");
		expect(summary.provider?.mode).toBe("test");
		expect((await getPaymentsSummary(WEB_ID)).provider?.mode).toBe("test");
	});

	it("leaves a project without a provider unchanged", async () => {
		const summary = await setPaymentsMode(MOBILE_ID, "live");
		expect(summary.provider).toBeNull();
	});
});

describe("getCodeFile", () => {
	it("returns null for a path outside the repository", async () => {
		expect(await getCodeFile(WEB_ID, "nope.ts")).toBeNull();
	});
});
