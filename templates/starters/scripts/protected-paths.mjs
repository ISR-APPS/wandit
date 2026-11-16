// The path guard of a starter template: one function, no file access.
// starter-source.mjs calls it for each path of files/ and of "removed", so
// materialize.mjs, extract.mjs, and pack.mjs refuse the same paths.
// The list is section "Protected paths" of ../README.md.

// The sandbox hook and CLAUDE.md protect the user from the agent. The lockfile
// keeps the template snapshot valid. A starter that replaces one of them
// removes that protection, so it must never ship one.
// The base has no CLAUDE.local.md, MCP config, or pnpmfile. A starter that adds
// one gives instructions or code to the agent or to pnpm.
const PROTECTED_FILES = [
	"CLAUDE.md",
	"CLAUDE.local.md",
	"AGENTS.md",
	".mcp.json",
	"opencode.json",
	".pnpmfile.cjs",
	".pnpmfile.mjs",
	"README.md",
	".gitignore",
	".npmrc",
	"package.json",
	"pnpm-lock.yaml",
	"pnpm-workspace.yaml",
	"template_version",
	"biome.json",
	"tsconfig.json",
	"wrangler.jsonc",
	"vite.config.ts",
	"src/router.tsx",
	"src/routes/__root.tsx",
	"src/routes/app.tsx",
	"src/routes/login.tsx",
	"src/styles/theme.ts",
	"src/styles/theme-options.ts",
	"src/styles/engine.css",
].map((file) => file.toLowerCase());

/** Each folder is protected with all that it holds. */
const PROTECTED_FOLDERS = [
	".claude",
	"vite-plugins",
	"scripts",
	"supabase",
	"src/wandit",
	"src/features/auth",
	"src/shared/lib",
];

/** Refused at each depth of a path. git and pnpm own these folders. */
const HIDDEN_CODE_FOLDERS = [".git", "node_modules"];

/** A starter can add a kit file. It cannot change or remove one of the base. */
const KIT_FOLDER = "src/shared/ui";
/** A starter can change the texts of the app (messages.ts), but not the i18n code. */
const I18N_FOLDER = "src/shared/i18n";
const I18N_MESSAGES_FILE = "src/shared/i18n/messages.ts";

/**
 * The reason why a starter must not hold or remove `path`, or null when the path is allowed.
 * `path` is relative to the project root, with "/" separators.
 * `isBasePath` answers if templates/web-app holds a file or a folder at that path.
 */
export function starterPathError(path, isBasePath) {
	const segments = path.split("/");
	if (
		path.includes("\\") ||
		segments.some(
			(segment) => segment === "" || segment === "." || segment === "..",
		)
	) {
		// An empty segment also covers a leading "/", a last "/", and "a//b".
		return 'the path must be relative, with "/" separators, and with no ".", "..", or empty segment';
	}
	// macOS file systems ignore case, so "claude.md" there replaces CLAUDE.md.
	const lower = path.toLowerCase();
	const lowerSegments = lower.split("/");
	const isUnder = (folder) => lower.startsWith(`${folder}/`);
	// A "removed" entry can name a folder. A folder that holds a protected path is refused too.
	const isOrHolds = (entry) => entry === lower || entry.startsWith(`${lower}/`);
	const isProtected =
		PROTECTED_FILES.some(isOrHolds) ||
		PROTECTED_FOLDERS.some((folder) => isOrHolds(folder) || isUnder(folder)) ||
		// A git hook or a package file runs code that no commit shows.
		lowerSegments.some((segment) => HIDDEN_CODE_FOLDERS.includes(segment)) ||
		// A local env file holds secrets. It must never enter an archive.
		lower === ".env" ||
		lower.startsWith(".env.") ||
		isOrHolds(I18N_FOLDER) ||
		(isUnder(I18N_FOLDER) && lower !== I18N_MESSAGES_FILE) ||
		isOrHolds(KIT_FOLDER) ||
		(isUnder(KIT_FOLDER) && isBasePath(path));
	return isProtected
		? "the path is a protected path of the base template"
		: null;
}
