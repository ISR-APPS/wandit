import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
	AI_GATEWAY_MODELS_URL,
	parseGatewayModelsResponse,
} from "../src/modules/metering/domain/model-pricing";

const response = await fetch(AI_GATEWAY_MODELS_URL, {
	headers: { Accept: "application/json" },
	signal: AbortSignal.timeout(30_000),
});

if (!response.ok) {
	throw new Error(
		`AI Gateway models request failed (${response.status} ${response.statusText})`,
	);
}

const payload = parseGatewayModelsResponse(await response.json());
const seed = {
	data: payload.data.map((model) => ({
		id: model.id,
		owned_by: model.owned_by,
		pricing: model.pricing,
		type: model.type,
	})),
	generatedAt: new Date().toISOString(),
	object: payload.object ?? "list",
	source: AI_GATEWAY_MODELS_URL,
};
const outputPath = resolve(
	import.meta.dirname,
	"../src/modules/metering/data/model-prices.seed.json",
);

await writeFile(outputPath, `${JSON.stringify(seed, null, "\t")}\n`, "utf8");
process.stdout.write(
	`Wrote ${seed.data.length} model prices to ${outputPath}\n`,
);
