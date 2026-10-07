import { backendToolNames } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import { createBackendToolFixture } from "./backend/fake-backend-tool-deps";
import { BuilderHostToolRegistry } from "./builder-host-tool-registry";
import type { HostToolMetering } from "./generate-image.host-tool";

// `build` only creates the tools; no metering call runs in this spec.
function unusedMetering(): HostToolMetering {
	const unused = async () => {
		throw new Error("metering is not called by build");
	};
	return {
		captureGeneration: unused,
		estimateMeasuredCost: unused,
		refund: unused,
		reserve: unused,
		settle: unused,
		usdMicrosPerCredit: 32_000,
	};
}

/** The registry with the real backend tool deps and no metering. */
async function setup() {
	const fixture = await createBackendToolFixture();
	const registry = new BuilderHostToolRegistry({
		...fixture.deps,
		imageEditModel: "edit-model-1",
		imageModel: "image-model-1",
		metering: unusedMetering(),
		networkHosts: {
			appendHost: async () => [],
			transaction: async () => undefined,
		},
	});
	return { fixture, registry };
}

describe("BuilderHostToolRegistry.build", () => {
	it("builds every tool and asks the user only for the writes that need approval", async () => {
		const { fixture, registry } = await setup();

		const toolSet = await registry.build(fixture.context);

		expect(Object.keys(toolSet.tools).sort()).toEqual(
			[
				...backendToolNames,
				"ask_user",
				"generate_image",
				"request_network_host",
			].sort(),
		);
		expect(toolSet.toolApproval).toEqual({
			apply_destructive_migration: "user-approval",
			ask_user: "not-applicable",
			apply_migration: "not-applicable",
			deploy_function: "not-applicable",
			generate_image: "not-applicable",
			get_advisors: "not-applicable",
			request_network_host: "user-approval",
			run_sql: "not-applicable",
			run_sql_write: "user-approval",
			set_secret: "not-applicable",
		});
	});

	it("gives a plan turn only the tools that ask the user", async () => {
		const { fixture, registry } = await setup();

		const toolSet = await registry.build({ ...fixture.context, mode: "plan" });

		// No tool that writes to the project, the backend, or the network.
		expect(Object.keys(toolSet.tools).sort()).toEqual([
			"ask_user",
			"present_plan",
		]);
		expect(toolSet.toolApproval).toEqual({
			ask_user: "not-applicable",
			present_plan: "not-applicable",
		});
	});
});
