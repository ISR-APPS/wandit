/**
 * The secret scan publish gate (WANDIT-181). It finds live keys in the
 * build output before the upload. The `publish-app` task wires it as
 * `new SecretScanGate()`. It calls `findSecrets` of `secret-rules.ts`.
 */
import type { PublishGate, PublishGateFinding } from "../ports/publish-gate";
import { findSecrets, type SecretScanRule } from "./secret-rules";

type SecretFinding = Extract<PublishGateFinding, { kind: "secret" }>;

// LIMIT: 50 findings per build. The row stores them in jsonb, and the
// popover lists them. Upgrade: store a count of the cut findings.
const MAX_FINDINGS = 50;

// Git uses a similar test: a byte with the value 0 near the start marks a
// binary file.
const BINARY_SNIFF_BYTES = 8192;

// `data:<mime>[;<name>=<value>]*;base64,<payload>`. Vite inlines a small
// image, font, or `?url` import as a data URL in a bundle or a CSS file.
const BASE64_DATA_URL =
	/data:[\w.+-]+\/[\w.+-]+(?:;[\w.+-]+=[\w.+-]+)*;base64,([0-9A-Za-z+/]+=*)/g;

/**
 * Lists the keys in the build output, one finding per path, rule, and
 * sample. A `block` finding stops the publish. Never throws.
 */
export class SecretScanGate implements PublishGate {
	readonly id = "secret-scan";

	async run({
		files,
	}: Parameters<PublishGate["run"]>[0]): Promise<PublishGateFinding[]> {
		const decoder = new TextDecoder();
		const blocks: SecretFinding[] = [];
		const warnings: SecretFinding[] = [];
		const seen = new Set<string>();
		for (const file of files) {
			if (isBinary(file.content)) {
				continue;
			}
			// The random base64 of an image can look like a key, so the scan
			// drops a binary payload. It decodes a text payload, for example an
			// inlined JSON key file. The spaces keep the decoded text apart from
			// the text around it.
			const text = decoder
				.decode(file.content)
				.replaceAll(BASE64_DATA_URL, (_dataUrl, payload: string) => {
					const bytes = Buffer.from(payload, "base64");
					return isBinary(bytes) ? " " : ` ${decoder.decode(bytes)} `;
				});
			for (const match of findSecrets(text)) {
				const findingKey = JSON.stringify([
					file.path,
					match.rule,
					match.sample,
				]);
				if (seen.has(findingKey)) {
					continue;
				}
				seen.add(findingKey);
				const finding: SecretFinding = {
					kind: "secret",
					path: file.path,
					rule: match.rule,
					sample: match.sample,
					severity: severityOf(file.path, match.rule),
				};
				(finding.severity === "block" ? blocks : warnings).push(finding);
			}
		}
		// Block findings first, so the cap never removes the reason of a block.
		return [...blocks, ...warnings].slice(0, MAX_FINDINGS);
	}
}

// Images, fonts, and wasm modules hold a byte with the value 0 and no
// source text.
function isBinary(content: Uint8Array): boolean {
	return content.subarray(0, BINARY_SNIFF_BYTES).includes(0);
}

function severityOf(
	path: string,
	rule: SecretScanRule,
): SecretFinding["severity"] {
	// Google browser keys (Maps, Firebase) are public by design. The owner can
	// restrict them by HTTP referrer. A Gemini key has the same format, so it
	// also only warns.
	if (rule === "google_api_key") {
		return "warn";
	}
	// A server module runs only in the user Worker, and no visitor can
	// download it. The key is still in the source, so the popover lists it.
	if (path.startsWith("server/")) {
		return "warn";
	}
	// A visitor can download every client asset, so a key there leaks.
	return "block";
}
