// PreToolUse guard for the coding agent inside the sandbox.
// Claude Code runs it before every tool call; exit 2 blocks the call.
// It reads the deny rules from .claude/settings.json so both stay in sync.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectDir =
	process.env.CLAUDE_PROJECT_DIR ??
	resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Write-capable tools share the Edit/Write deny rules.
const PATH_WRITE_TOOLS = new Set([
	"Edit",
	"MultiEdit",
	"Write",
	"NotebookEdit",
]);

function readStdin() {
	try {
		return readFileSync(0, "utf8");
	} catch {
		// No stdin means no hook payload; the empty input exits 0 in main().
		return "";
	}
}

/**
 * Turns a deny glob into a RegExp. `**` crosses folders; `*` stays in one.
 * The stars are replaced in one pass so the `.*` from `**` is not re-read.
 */
function globToRegex(pattern) {
	const source = pattern
		.replace(/[.+^${}()|[\]\\?]/g, "\\$&")
		.replace(/\*\*|\*/g, (star) => (star === "**" ? ".*" : "[^/]*"));
	return new RegExp(`^${source}$`);
}

function expandTilde(path) {
	return path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;
}

function normalizePath(path) {
	return normalize(expandTilde(path)).replace(/\\/g, "/");
}

/** A path is denied when the pattern matches it in the project or anywhere. */
function pathDenied(pattern, filePath) {
	const patternNorm = normalizePath(pattern);
	const fileNorm = normalizePath(filePath);
	const relativeToProject = normalizePath(relative(projectDir, fileNorm));
	const regexes = [
		globToRegex(patternNorm),
		// `**/` prefix lets a project pattern hit the same path anywhere else.
		globToRegex(`**/${patternNorm}`),
	];
	const candidates = new Set([fileNorm, relativeToProject]);
	for (const candidate of candidates) {
		for (const regex of regexes) {
			if (regex.test(candidate)) {
				return true;
			}
		}
	}
	return false;
}

/**
 * A Bash rule is a command prefix: `git push*` denies `git push origin feat/x`.
 * Without a star the segment must equal the pattern exactly.
 */
function commandDenied(pattern, command) {
	const hasStar = pattern.endsWith("*");
	const prefix = hasStar ? pattern.slice(0, -1) : pattern;
	// LIMIT: plain chains only. Upgrade: WANDIT-180 hardened hook.
	const segments = command.split(/&&|;|\|\|?|\n/).map((part) => part.trim());
	return segments.some(
		(segment) =>
			segment.length > 0 &&
			(hasStar ? segment.startsWith(prefix) : segment === prefix),
	);
}

function deny(reason) {
	process.stderr.write(`denied by wandit rules: ${reason}\n`);
	process.exit(2);
}

function main() {
	const raw = readStdin();
	if (!raw.trim()) {
		return;
	}

	let input;
	try {
		input = JSON.parse(raw);
	} catch {
		// Malformed input cannot be checked. Warn but do not block the call.
		process.stderr.write("wandit pre-tool-use: could not parse tool input\n");
		return;
	}

	const toolName = typeof input.tool_name === "string" ? input.tool_name : "";
	const toolInput =
		typeof input.tool_input === "object" && input.tool_input !== null
			? input.tool_input
			: {};

	let denyRules;
	try {
		const settings = JSON.parse(
			readFileSync(join(projectDir, ".claude", "settings.json"), "utf8"),
		);
		denyRules = settings?.permissions?.deny;
	} catch {
		denyRules = undefined;
	}
	// Fail closed: without the deny list no tool call is safe to allow.
	if (!Array.isArray(denyRules)) {
		process.stderr.write("wandit pre-tool-use: could not read deny rules\n");
		process.exit(2);
	}

	const filePath =
		typeof toolInput.file_path === "string"
			? toolInput.file_path
			: typeof toolInput.notebook_path === "string"
				? toolInput.notebook_path
				: undefined;
	const command =
		typeof toolInput.command === "string" ? toolInput.command : undefined;

	for (const rule of denyRules) {
		const match = /^(\w+)\((.+)\)$/.exec(rule);
		if (!match) {
			continue;
		}
		const [, tool, pattern] = match;

		const isWriteRule = tool === "Edit" || tool === "Write";
		if (isWriteRule && PATH_WRITE_TOOLS.has(toolName) && filePath) {
			if (pathDenied(pattern, filePath)) {
				deny(`${toolName} ${filePath} matches ${rule}`);
			}
		}
		if (tool === "Bash" && toolName === "Bash" && command) {
			if (commandDenied(pattern, command)) {
				deny(`Bash command matches ${rule}`);
			}
		}
	}
}

main();
