// Fails when a React effect has no written reason. `pnpm run typecheck` runs it.
// Rule (CLAUDE.md "Effects"): the line directly above every useEffect,
// useLayoutEffect, or useFocusEffect call is a `// effect: <reason>` comment.
// Usage: node scripts/check-effects.mjs [folder]. The folder defaults to src.
// The web template has the same check; this copy also covers useFocusEffect.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const folder = resolve(root, process.argv[2] ?? "src");

// A call, not an import: `useEffect(`, `useLayoutEffect (`, `React.useEffect(`.
// expo-router's useFocusEffect runs an effect each time a screen gets focus.
const EFFECT_CALL = /\buse(?:Layout|Focus)?Effect\s*\(/;
// The reason must hold at least one word after the colon.
const EFFECT_REASON = /^\s*\/\/\s*effect:\s*\S/;
// A line that is only a comment can name an effect without calling it.
const COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*)/;
// Biome reads its suppression only on the line directly above the call,
// so a `// biome-ignore` line may sit between the reason and the effect.
const BIOME_IGNORE = /^\s*\/\/\s*biome-ignore/;

const files = readdirSync(folder, { recursive: true })
	.filter((path) => /\.tsx?$/.test(path))
	.sort();

const violations = [];
let effectCount = 0;
for (const path of files) {
	const lines = readFileSync(join(folder, path), "utf8").split("\n");
	lines.forEach((line, index) => {
		if (!EFFECT_CALL.test(line) || COMMENT_LINE.test(line)) {
			return;
		}
		effectCount += 1;
		let above = index - 1;
		if (BIOME_IGNORE.test(lines[above] ?? "")) {
			above -= 1;
		}
		if (!EFFECT_REASON.test(lines[above] ?? "")) {
			violations.push(`${relative(root, join(folder, path))}:${index + 1}`);
		}
	});
}

if (violations.length > 0) {
	console.error(
		`check-effects: ${violations.length} effect(s) without a reason:\n` +
			violations.map((location) => `  ${location}`).join("\n") +
			'\nRemove the effect (CLAUDE.md "Effects" lists the alternatives), ' +
			'or put "// effect: <reason>" on the line above it.',
	);
	process.exit(1);
}
console.log(`check-effects: ok, ${effectCount} effect(s), each with a reason`);
