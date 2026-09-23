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

describe("BuilderHostToolRegistry.build", () => {
	it("builds every tool and asks the user only for the writes that need approval", async () => {
		const fixture = await createBackendToolFixture();
		const registry = new BuilderHostToolRegistry({
			...fixture.deps,
			imageEditModel: null,
			imageModel: null,
			metering: unusedMetering(),
			networkHosts: { appendHost: async () => [] },
		});

		const toolSet = await registry.build(fixture.context);

		expect(Object.keys(toolSet.tools).sort()).toEqual(
			[...backendToolNames, "generate_image", "request_network_host"].sort(),
		);
		expect(toolSet.toolApproval).toEqual({
			apply_destructive_migration: "user-approval",
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
});
