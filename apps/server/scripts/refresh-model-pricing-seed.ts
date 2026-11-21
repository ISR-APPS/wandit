/**
 * Writes the checked-in model price seed from the public AI Gateway catalog.
 * A developer runs it by hand with tsx. It keeps the old entries that the
 * catalog no longer lists, because repo defaults and old events still name them.
 */
import { readFile, writeFile } from "node:fs/promises";
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

const outputPath = resolve(
	import.meta.dirname,
	"../src/modules/metering/data/model-prices.seed.json",
);
const payload = parseGatewayModelsResponse(await response.json());
const previous = parseGatewayModelsResponse(
	JSON.parse(await readFile(outputPath, "utf8")),
);
const liveIds = new Set(payload.data.map((model) => model.id));
// A retired id keeps its last price: a builder default or an old usage
// event can still name it, and the seed is the fallback price source.
const retired = previous.data.filter((model) => !liveIds.has(model.id));
const seed = {
	data: [...payload.data, ...retired].map((model) => ({
		id: model.id,
		owned_by: model.owned_by,
		pricing: model.pricing,
		type: model.type,
	})),
	generatedAt: new Date().toISOString(),
	object: payload.object ?? "list",
	source: AI_GATEWAY_MODELS_URL,
};

await writeFile(outputPath, `${JSON.stringify(seed, null, "\t")}\n`, "utf8");
process.stdout.write(
	`Wrote ${seed.data.length} model prices (${retired.length} retired) to ${outputPath}\n`,
);
