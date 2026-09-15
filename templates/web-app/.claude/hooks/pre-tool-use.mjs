/**
 * PreToolUse guard for the coding agent inside the sandbox.
 * Claude Code runs it before every tool call; exit 2 blocks the call.
 * It reads the deny rules from .claude/settings.json. Then it checks
 * Bash commands for download-and-run pipes, restricted first words,
 * writes to denied or out-of-workspace paths, and install scripts.
 * It also checks the script text of `sh -c` and `eval`, up to three
 * levels deep. Built-ins only.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import {
	basename,
	dirname,
	isAbsolute,
	join,
	normalize,
	relative,
	resolve,
} from "node:path";
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

// Rule 3: a first word that opens a privileged, network, or container channel.
const DENIED_FIRST_WORDS = new Set([
	"sudo",
	"su",
	"doas",
	"nc",
	"ncat",
	"netcat",
	"socat",
	"telnet",
	"ssh",
	"scp",
	"sftp",
	"docker",
	"podman",
]);

// Rule 1: an interpreter turns a downloaded stream into code execution.
// `source` and `.` read a piped stream as commands.
const INTERPRETERS = new Set([
	"sh",
	"bash",
	"zsh",
	"dash",
	"ksh",
	"node",
	"perl",
	"ruby",
	"source",
	".",
]);
// `python`, `python3`, and `python3.x` all count as interpreters.
const INTERPRETER_RE = /^python\d*(\.\d+)?$/;
const DOWNLOADERS = new Set(["curl", "wget"]);

// Shells whose `-c` flag carries a command string the hook checks again.
const C_FLAG_SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh"]);

// Shell keywords skipped before the first real word of a segment.
// `case` and `function` also consume the name word after them.
const KEYWORDS = new Set([
	"if",
	"then",
	"else",
	"elif",
	"do",
	"while",
	"until",
	"fi",
	"done",
	"esac",
	"in",
	"coproc",
	"case",
	"function",
]);

// An empty set: the wrapper has no flag that takes a value.
const NO_VALUE_FLAGS = new Set();

// Wrapper commands skipped to reach the real first word.
// flagsWithArg holds the flags that consume the next token, positionals the
// bare arguments before the command (timeout takes one duration).
// The lookup runs on the basename so `/usr/bin/env` strips like `env`.
// A Map, not a plain object: a bracket lookup on a literal finds
// Object.prototype names like `constructor` and hides the real first word.
const WRAPPERS = new Map([
	[
		"env",
		{
			flagsWithArg: new Set([
				"-u",
				"--unset",
				"-C",
				"--chdir",
				"-S",
				"--split-string",
			]),
			positionals: 0,
		},
	],
	["command", { flagsWithArg: NO_VALUE_FLAGS, positionals: 0 }],
	["builtin", { flagsWithArg: NO_VALUE_FLAGS, positionals: 0 }],
	["exec", { flagsWithArg: new Set(["-a"]), positionals: 0 }],
	["nohup", { flagsWithArg: NO_VALUE_FLAGS, positionals: 0 }],
	["time", { flagsWithArg: NO_VALUE_FLAGS, positionals: 0 }],
	["nice", { flagsWithArg: new Set(["-n", "--adjustment"]), positionals: 0 }],
	[
		"stdbuf",
		{
			flagsWithArg: new Set([
				"-i",
				"-o",
				"-e",
				"--input",
				"--output",
				"--error",
			]),
			positionals: 0,
		},
	],
	["noglob", { flagsWithArg: NO_VALUE_FLAGS, positionals: 0 }],
	[
		"xargs",
		{
			flagsWithArg: new Set([
				"-I",
				"--replace",
				"-n",
				"--max-args",
				"-P",
				"--max-procs",
				"-s",
				"--max-chars",
				"-d",
				"--delimiter",
				"-E",
				"-e",
				"--eof",
				"-L",
				"-l",
				"--max-lines",
				"-J",
				"-a",
				"--arg-file",
			]),
			positionals: 0,
		},
	],
	[
		"timeout",
		{
			flagsWithArg: new Set(["-k", "--kill-after", "-s", "--signal"]),
			positionals: 1,
		},
	],
	// `npx npm install` launches npm; `-c` hides a command string (LIMIT).
	[
		"npx",
		{
			flagsWithArg: new Set(["-p", "--package", "-c", "--call"]),
			positionals: 0,
		},
	],
	["corepack", { flagsWithArg: NO_VALUE_FLAGS, positionals: 0 }],
]);

// Names on Object.prototype are never real commands. firstWord skips
// them so the word behind them meets the checks: `constructor sudo ls`
// reaches rule 3 on `sudo` instead of the segment passing unseen.
const PROTOTYPE_WORDS = new Set(Object.getOwnPropertyNames(Object.prototype));

// Git options that consume the next token before the subcommand.
const GIT_VALUE_FLAGS = new Set([
	"-C",
	"-c",
	"--git-dir",
	"--work-tree",
	"--exec-path",
	"--namespace",
]);

// Package-manager options that consume the next token before the subcommand.
const PM_VALUE_FLAGS = new Set([
	"-C",
	"--dir",
	"--prefix",
	"--cache",
	"--registry",
	"--config",
	"--store-dir",
	"--filter",
	"-F",
	"--cwd",
]);

// Rule 5b: subcommands that run dependency or lifecycle scripts.
// npm install aliases come from `npm help install`: i, in, ins, inst,
// insta, instal, isnt, isnta, isntal, isntall, add; ci and rebuild/rb too.
const PNPM_SCRIPT_SUBS = new Set(["approve-builds", "rebuild", "rb"]);
const NPM_SCRIPT_SUBS = new Set([
	"install",
	"i",
	"in",
	"ins",
	"inst",
	"insta",
	"instal",
	"isnt",
	"isnta",
	"isntal",
	"isntall",
	"add",
	"ci",
	"rebuild",
	"rb",
]);
const YARN_SCRIPT_SUBS = new Set(["install", "add"]);
const BUN_SCRIPT_SUBS = new Set(["install", "add", "i"]);

// Managers whose exec/dlx/x subcommand launches a nested command line.
const PM_BINS = new Set(["pnpm", "npm", "yarn", "bun"]);

// Rule 1a: a quoted pipeline still runs; this regex scans the raw command
// so `sh -c 'curl x | sh'` matches. The interpreter may carry a path or
// quote prefix (`/bin/sh`, `'bash'`).
const DOWNLOAD_PIPE_RE =
	/\b(?:curl|wget)\b[^|&;\n]*\|&?\s*(?:[A-Za-z0-9_./\\'"-]+\s+)*?[A-Za-z0-9_./\\'"-]*(?:sh|bash|zsh|dash|ksh|node|python\d*(?:\.\d+)?|perl|ruby)\b/;

// Sed options that consume the next token (a script or a script file).
const SED_VALUE_FLAGS = new Set(["-e", "--expression", "-f", "--file"]);

// Writing commands whose non-flag arguments are all files they change.
const MUTATING_COMMANDS = new Set([
	"truncate",
	"touch",
	"mkdir",
	"chmod",
	"chown",
	"chattr",
	"rm",
	"rmdir",
	"shred",
]);

// Rule 4b: through xargs the file operands come from stdin, so even a
// zero-argument `xargs rm` is a write of unknowable targets.
const XARGS_WRITE_COMMANDS = new Set([
	"tee",
	"cp",
	"mv",
	"install",
	"ln",
	"rsync",
	"sed",
	"dd",
	"git",
	...MUTATING_COMMANDS,
]);

// Rule 4c: `find` writes through `-delete` and through `-exec`/`-execdir`
// of a writing command. The command after all four flags gets the same
// first-word checks as a segment; `-ok` and `-okdir` ask before they run,
// so they do not mark the find as mutating.
const FIND_EXEC_FLAGS = new Set(["-exec", "-execdir", "-ok", "-okdir"]);
// `find` output flags write their file argument even on a read-only run.
const FIND_WRITE_FILE_FLAGS = new Set([
	"-fprint",
	"-fprint0",
	"-fprintf",
	"-fls",
]);
const FIND_WRITE_COMMANDS = new Set([
	"cp",
	"mv",
	"tee",
	"sed",
	"dd",
	...MUTATING_COMMANDS,
]);
// `find` global options may sit before the path operands; `-f` names a
// path itself (BSD) and `-D` takes a debug argument (GNU).
const FIND_GLOBAL_FLAGS = new Set([
	"-E",
	"-H",
	"-L",
	"-P",
	"-X",
	"-d",
	"-s",
	"-x",
]);

function readStdin() {
	try {
		return readFileSync(0, "utf8");
	} catch (error) {
		// A read error is not an empty payload: fail closed.
		const message = error instanceof Error ? error.message : String(error);
		process.stderr.write(
			`wandit pre-tool-use: could not read stdin: ${message}\n`,
		);
		process.exit(2);
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

/**
 * Expands `~`, `~/`, `$HOME`, and `${HOME}` to the user home directory.
 * A `~name` form stays unchanged: the caller decides if it is an error.
 */
function expandHome(path) {
	if (path === "~") {
		return homedir();
	}
	if (path.startsWith("~/")) {
		return join(homedir(), path.slice(2));
	}
	return path.replace(/^(\$HOME|\$\{HOME\})/, homedir());
}

function normalizePath(path) {
	return normalize(expandHome(path)).replace(/\\/g, "/");
}

/**
 * A path is denied when the pattern matches it in the project or anywhere.
 * A `X/**` pattern also covers X itself: `rm -rf .claude` removes the folder.
 * Inside the project only the relative candidate is tested, so a pattern
 * hits at any depth (`src/.env` under a `**`-prefixed form) while the
 * project folder may sit under a `.claude` directory itself. Outside the
 * project the absolute candidate is tested with the same forms.
 */
function pathDenied(pattern, filePath) {
	const patternNorm = normalizePath(pattern);
	const fileNorm = normalizePath(filePath);
	const relativeToProject = normalizePath(relative(projectDir, fileNorm));
	const insideProject =
		!relativeToProject.startsWith("..") && !isAbsolute(relativeToProject);
	const regexes = [
		globToRegex(patternNorm),
		// `**/` lets a project pattern hit the same name at any depth.
		globToRegex(`**/${patternNorm}`),
	];
	if (patternNorm.endsWith("/**")) {
		const dir = patternNorm.slice(0, -3);
		regexes.push(globToRegex(dir), globToRegex(`**/${dir}`));
	}
	const candidate = insideProject ? relativeToProject : fileNorm;
	for (const regex of regexes) {
		if (regex.test(candidate)) {
			return true;
		}
	}
	return false;
}

/**
 * A Bash deny rule is a command prefix: `git push*` denies `git push origin x`.
 * Without a star the segment must equal the pattern exactly.
 */
function commandDenied(pattern, segment) {
	const hasStar = pattern.endsWith("*");
	const prefix = hasStar ? pattern.slice(0, -1) : pattern;
	return hasStar ? segment.startsWith(prefix) : segment === prefix;
}

function deny(reason) {
	process.stderr.write(`denied by wandit rules: ${reason}\n`);
	process.exit(2);
}

/**
 * Splits a command line into words. Single and double quotes group text and
 * are removed; a backslash keeps the next character inside the word.
 */
function tokenize(text) {
	const words = [];
	let word = "";
	let quote = "";
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (quote === "'") {
			if (ch === "'") {
				quote = "";
			} else {
				word += ch;
			}
		} else if (quote === '"') {
			if (ch === '"') {
				quote = "";
			} else {
				if (ch === "\\" && i + 1 < text.length) {
					i++;
				}
				word += text[i];
			}
		} else if (ch === "'" || ch === '"') {
			quote = ch;
		} else if (ch === "\\" && i + 1 < text.length) {
			i++;
			word += text[i];
		} else if (/\s/.test(ch)) {
			if (word !== "") {
				words.push(word);
				word = "";
			}
		} else {
			word += ch;
		}
	}
	if (word !== "") {
		words.push(word);
	}
	return words;
}

/**
 * Returns { word, index, viaStdin, envChdir, envSplitString } of the
 * first real command word, or null when the segment holds only
 * assignments and keywords. Skips `(`, `{`, `!`, a bare `--`, shell
 * keywords, NAME=value assignments, `x)` case patterns, `f()`
 * definitions, Object.prototype names, and wrapper commands with
 * their flags. `sudo` is not a wrapper on purpose: it must stay
 * visible for rule 3. envChdir is true when an `env` wrapper carries
 * `-C`/`--chdir`: the child then runs in another directory.
 * envSplitString is true for `-S`: env splits the string into a
 * command line the hook cannot read, so it denies.
 */
function firstWord(words) {
	let i = 0;
	// viaStdin is true when the chain crossed xargs: the command's file
	// arguments then arrive on stdin and stay invisible to the rules.
	let viaStdin = false;
	// envChdir is true when the chain crossed `env -C`/`--chdir`: the
	// child's directory is unknown, so relative targets must fail closed.
	let envChdir = false;
	while (i < words.length) {
		const rawWord = words[i];
		// `(` and `{` open a subshell or a group; `!` is history syntax.
		let word = rawWord.replace(/^[({!]+/, "");
		// `)` closes a subshell, a case pattern, or a function definition.
		// Text after the last `)` is a new word: `a)sudo` runs `sudo`.
		const close = word.lastIndexOf(")");
		if (close !== -1) {
			const after = word.slice(close + 1);
			word =
				after !== ""
					? after
					: rawWord.startsWith("(")
						? word.slice(0, close)
						: "";
		}
		if (word === "--") {
			// A bare `--` ends a wrapper's options (`pnpm exec -- npm i`).
			i++;
			continue;
		}
		if (word === "" || KEYWORDS.has(word)) {
			// `case WORD in` and `function NAME` consume one name word.
			i += word === "case" || word === "function" ? 2 : 1;
			continue;
		}
		if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(word)) {
			i++;
			continue;
		}
		const wrapper = WRAPPERS.get(basename(word));
		if (!wrapper) {
			if (PROTOTYPE_WORDS.has(word)) {
				// A prototype name is no real command; the word after it is.
				i++;
				continue;
			}
			return { word, index: i, viaStdin, envChdir };
		}
		const wrapperName = basename(word);
		if (wrapperName === "xargs") {
			viaStdin = true;
		}
		const wordIndex = i;
		i++;
		let envSplit = false;
		while (
			i < words.length &&
			(words[i].startsWith("-") ||
				// `env` takes NAME=value assignments between its flags.
				(wrapperName === "env" && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i])))
		) {
			if (
				wrapperName === "env" &&
				(words[i].startsWith("-S") ||
					words[i] === "--split-string" ||
					words[i].startsWith("--split-string="))
			) {
				envSplit = true;
			}
			if (
				wrapperName === "env" &&
				(words[i] === "-C" ||
					words[i] === "--chdir" ||
					words[i].startsWith("--chdir="))
			) {
				envChdir = true;
			}
			i += wrapper.flagsWithArg.has(words[i]) ? 2 : 1;
		}
		if (envSplit) {
			return { word, index: wordIndex, viaStdin, envSplitString: true };
		}
		i += wrapper.positionals;
	}
	return null;
}

// LIMIT: heredoc body lines are checked as commands, so a body line
// that starts with `sudo` is denied. Not parsed:
// - `$( )` nested deeper than one level
// - `sh -c` and `eval` strings nested deeper than three levels
// - interpreter one-liners (`node -e`, `python -c`, `npx -c`) that
//   write through an API
// - `git apply` and `patch`
// - `tar -x` and `unzip` targets
// - symlinks
// - GIT_CONFIG_* env vars
// - package-run shortcuts (`npx <pkg>`, `pnpm dlx`, `bunx`)
// - a script file or a package.json script run through `sh`, `node`,
//   or `pnpm run`
// - launchers not in WRAPPERS (`setsid`, `flock`)
// - Debian binary names (`nc.openbsd`)
// - `perl -i` and `awk` file writes
// - the /private/tmp symlink on macOS
// - package.json pnpm.onlyBuiltDependencies
// Upgrade: a shell parser package in the image.

/**
 * Splits a command into segments on &&, ||, ;, |, |&, a lone & (background),
 * and newlines. The redirect operators >& <& &> >|, quotes, and the inside
 * of $( ) ` ` <( ) >( ) are not separators. Each segment keeps the index
 * of its pipeline group.
 */
function splitSegments(command) {
	const segments = [];
	let group = 0;
	let start = 0;
	let quote = "";
	let depth = 0;
	let backtick = false;
	// sameGroup=false starts a new pipeline group after the separator.
	const cut = (end, next, sameGroup) => {
		const text = command.slice(start, end).trim();
		if (text !== "") {
			segments.push({ text, group, substitution: false, subs: [] });
		}
		if (!sameGroup) {
			group++;
		}
		start = next;
	};
	for (let i = 0; i < command.length; i++) {
		const ch = command[i];
		if (backtick) {
			if (ch === "`") {
				backtick = false;
			}
			continue;
		}
		if (depth > 0) {
			if (ch === "(") {
				depth++;
			} else if (ch === ")") {
				depth--;
			}
			continue;
		}
		if (quote === "'") {
			if (ch === "'") {
				quote = "";
			}
			continue;
		}
		if (quote === '"') {
			if (ch === '"') {
				quote = "";
			} else if (ch === "\\") {
				i++;
			} else if (ch === "`") {
				// A backtick or $( ) inside " " still executes.
				backtick = true;
			} else if (ch === "$" && command[i + 1] === "(") {
				depth = 1;
				i++;
			}
			continue;
		}
		if (ch === "'" || ch === '"') {
			quote = ch;
			continue;
		}
		if (ch === "\\") {
			i++;
			continue;
		}
		if (ch === "`") {
			backtick = true;
			continue;
		}
		if ((ch === "$" || ch === "<" || ch === ">") && command[i + 1] === "(") {
			depth = 1;
			i++;
			continue;
		}
		if (ch === "&") {
			const prev = command[i - 1] ?? "";
			const next = command[i + 1] ?? "";
			if (next === "&") {
				cut(i, i + 2, false);
				i++;
			} else if (prev !== ">" && prev !== "<" && next !== ">" && next !== "|") {
				cut(i, i + 1, false);
			}
			continue;
		}
		if (ch === "|") {
			const prev = command[i - 1] ?? "";
			const next = command[i + 1] ?? "";
			if (prev === ">" || prev === "&") {
				// >| and &| are redirect syntax, not a pipe.
				continue;
			}
			if (next === "|") {
				cut(i, i + 2, false);
				i++;
			} else if (next === "&") {
				cut(i, i + 2, true);
				i++;
			} else {
				cut(i, i + 1, true);
			}
			continue;
		}
		if (ch === ";") {
			cut(i, i + 1, false);
			continue;
		}
		if (ch === "\n") {
			cut(i, i + 1, false);
		}
	}
	cut(command.length, command.length, false);
	return segments;
}

/**
 * Returns the inner text of $(...), `...`, <(...), and >(...) substitutions.
 * Only one level is read; a nested $( ) stays inside the returned text.
 */
function extractSubstitutions(text) {
	const inner = [];
	for (let i = 0; i < text.length - 1; i++) {
		const pair = text.slice(i, i + 2);
		if (pair === "$(" || pair === "<(" || pair === ">(") {
			let depth = 1;
			let j = i + 2;
			while (j < text.length && depth > 0) {
				if (text[j] === "(") {
					depth++;
				} else if (text[j] === ")") {
					depth--;
				}
				j++;
			}
			inner.push(text.slice(i + 2, j - 1));
			i = j - 1;
		} else if (text[i] === "`") {
			const end = text.indexOf("`", i + 1);
			if (end === -1) {
				break;
			}
			inner.push(text.slice(i + 1, end));
			i = end;
		}
	}
	return inner;
}

/**
 * Finds output-redirect targets in a segment. `>` `>>` `>|` `N>` `&>` `&>>`
 * write a file; `>&1` `2>&1` `>&-` duplicate a descriptor and are skipped.
 */
function redirectTargets(text) {
	const targets = [];
	for (let i = 0; i < text.length; i++) {
		if (text[i] !== ">") {
			continue;
		}
		let j = i + 1;
		if (text[j] === ">" || text[j] === "|") {
			j++;
		} else if (text[j] === "&") {
			const next = text[j + 1] ?? "";
			// `>&N` and `>&-` copy a descriptor to a descriptor, not to a file.
			if (next === "-" || /\d/.test(next)) {
				i = j + 1;
				continue;
			}
			j++;
		}
		while (j < text.length && /\s/.test(text[j])) {
			j++;
		}
		// The target ends at whitespace outside quotes. Quotes and
		// backslashes group the way tokenize does: `> "a b"` is one
		// target. ( ) close subshells and substitutions, so `> .env)`
		// stops at the ).
		let end = j;
		let quote = "";
		while (end < text.length) {
			const ch = text[end];
			if (quote === "'") {
				if (ch === "'") {
					quote = "";
				}
			} else if (quote === '"') {
				if (ch === '"') {
					quote = "";
				} else if (ch === "\\") {
					end++;
				}
			} else if (ch === "'" || ch === '"') {
				quote = ch;
			} else if (ch === "\\") {
				end++;
			} else if (/[\s><&|;()]/.test(ch)) {
				break;
			}
			end++;
		}
		if (end > j) {
			targets.push(text.slice(j, end));
		}
		i = end - 1;
	}
	return targets;
}

/** Non-flag words after fromIndex; flags in valueFlags also skip their value. */
function nonFlagArgs(words, fromIndex, valueFlags) {
	const args = [];
	for (let i = fromIndex; i < words.length; i++) {
		const word = words[i];
		if (word.startsWith("-")) {
			if (valueFlags.has(word)) {
				i++;
			}
			continue;
		}
		args.push(word);
	}
	return args;
}

/** Index of the first non-flag word at or after fromIndex, or -1. */
function operandIndex(words, fromIndex, valueFlags) {
	for (let i = fromIndex; i < words.length; i++) {
		if (words[i].startsWith("-")) {
			if (valueFlags.has(words[i])) {
				i++;
			}
			continue;
		}
		return i;
	}
	return -1;
}

/**
 * Expands quotes, ~, and $HOME, then resolves the target to an absolute path.
 * Returns { path }, { dev } for the null devices, or { error } when a
 * variable, a glob, or a broken `cd` leaves the target unknown.
 */
function resolveTarget(raw, dirState) {
	const target = expandHome(raw.replace(/^["']+|["']+$/g, ""));
	if (target.startsWith("~")) {
		// `~name` is another user's home; the hook cannot resolve it.
		return { error: `cannot resolve the target ${raw}` };
	}
	// A leftover variable, a glob, or a brace expansion makes the
	// write target unknown.
	if (/[$`*?[{]/.test(target)) {
		return { error: `cannot resolve the target ${raw}` };
	}
	// The null devices are not files a write can harm.
	if (
		target === "/dev/null" ||
		target === "/dev/stdout" ||
		target === "/dev/stderr" ||
		target === "/dev/tty" ||
		target.startsWith("/dev/fd/")
	) {
		return { dev: true };
	}
	if (isAbsolute(target)) {
		return { path: normalize(target) };
	}
	if (dirState.broken) {
		return { error: `cannot resolve the target ${raw}` };
	}
	return { path: resolve(dirState.dir, target) };
}

/** True when the path leaves both the project directory and /tmp. */
function isOutsideWorkspace(absPath) {
	const outside = (rel) => rel.startsWith("..") || isAbsolute(rel);
	return (
		outside(relative(projectDir, absPath)) && outside(relative("/tmp", absPath))
	);
}

/** Applies the deny patterns and the workspace bound to one write target. */
function checkTarget(raw, dirState, pathPatterns, checkOutside) {
	// Raw targets run through tokenize first: `.cl""aude` and `.cl\aude`
	// both spell `.claude`, and a pair of quotes never reaches a file.
	const cleaned = tokenize(raw).join(" ");
	const resolved = resolveTarget(cleaned, dirState);
	if (resolved.error) {
		deny(resolved.error);
	}
	if (resolved.dev || !resolved.path) {
		return;
	}
	for (const entry of pathPatterns) {
		if (pathDenied(entry.pattern, resolved.path)) {
			deny(`write target ${raw} matches ${entry.rule}`);
		}
	}
	if (checkOutside && isOutsideWorkspace(resolved.path)) {
		deny(`write outside the workspace: ${raw}`);
	}
	// A quoted or escaped space splits one token into names; `.env x` must
	// still hit the `.env` rule.
	const pieces = cleaned.split(/\s+/).filter((piece) => piece !== "");
	if (pieces.length > 1) {
		for (const piece of pieces) {
			const resolvedPiece = resolveTarget(piece, dirState);
			if (resolvedPiece.path === undefined) {
				continue;
			}
			for (const entry of pathPatterns) {
				if (pathDenied(entry.pattern, resolvedPiece.path)) {
					deny(`write target ${piece} matches ${entry.rule}`);
				}
			}
		}
	}
}

/**
 * Rule 4b: extracts the file targets of a writing command and checks each.
 * A copy source is a read: it may sit outside the workspace but must not
 * match a deny pattern. The destination must stay inside the workspace.
 */
function commandTargets(
	base,
	words,
	firstIndex,
	dirState,
	pathPatterns,
	viaStdin,
) {
	const after = firstIndex + 1;
	// xargs feeds the file list through stdin; the operands stay unknown.
	if (viaStdin && XARGS_WRITE_COMMANDS.has(base)) {
		deny(`xargs supplies the targets of ${base}`);
	}
	if (base === "tee") {
		for (const arg of nonFlagArgs(words, after, NO_VALUE_FLAGS)) {
			checkTarget(arg, dirState, pathPatterns, true);
		}
		return;
	}
	if (
		base === "cp" ||
		base === "mv" ||
		base === "install" ||
		base === "ln" ||
		base === "rsync"
	) {
		const operands = nonFlagArgs(words, after, NO_VALUE_FLAGS);
		for (const arg of operands) {
			checkTarget(arg, dirState, pathPatterns, false);
		}
		// `-t`, `-tDIR`, `--target-directory[=]`, and a short cluster that
		// ends in `t` name the destination; without it the last operand is.
		const tIndex = words.findIndex(
			(w, i) =>
				i >= after &&
				(w === "--target-directory" ||
					w.startsWith("--target-directory=") ||
					/^-[a-zA-Z]*t/.test(w)),
		);
		const dest =
			tIndex !== -1
				? words[tIndex].startsWith("--target-directory=")
					? words[tIndex].slice("--target-directory=".length)
					: /^-[a-zA-Z]*t./.test(words[tIndex])
						? words[tIndex].replace(/^-[a-zA-Z]*t/, "")
						: words[tIndex + 1]
				: operands[operands.length - 1];
		if (dest === undefined) {
			return;
		}
		if (base === "rsync" && /^[^\s/]+:/.test(dest)) {
			// A `host:path` destination leaves the machine; it cannot resolve.
			deny(`cannot resolve the target ${dest}`);
		}
		checkTarget(dest, dirState, pathPatterns, true);
		return;
	}
	if (base === "sed") {
		// Only `sed -i` writes; every operand after the script is a file.
		// GNU sed accepts an unambiguous long-option prefix, and only
		// --in-place starts with --i.
		const inPlace = words.some(
			(w, i) =>
				i >= after &&
				w.startsWith("-") &&
				(/^--i/.test(w) || /^-[a-zA-Z]*i/.test(w)),
		);
		if (!inPlace) {
			return;
		}
		// `-e` and `-f` supply the script: inline or from a file.
		const hasExpr = words.some(
			(w, i) =>
				i >= after &&
				(w === "-e" ||
					w === "--expression" ||
					w.startsWith("--expression=") ||
					/^-e./.test(w) ||
					w === "-f" ||
					w === "--file" ||
					w.startsWith("--file=") ||
					/^-f./.test(w)),
		);
		const operands = nonFlagArgs(words, after, SED_VALUE_FLAGS);
		// Without -e or -f the first operand is the script, not a file.
		const files = hasExpr ? operands : operands.slice(1);
		for (const file of files) {
			checkTarget(file, dirState, pathPatterns, true);
		}
		return;
	}
	if (base === "dd") {
		for (const arg of words.slice(after)) {
			const match = /^of=(.*)$/.exec(arg);
			if (match) {
				checkTarget(match[1], dirState, pathPatterns, true);
			}
		}
		return;
	}
	if (MUTATING_COMMANDS.has(base)) {
		for (const arg of nonFlagArgs(words, after, NO_VALUE_FLAGS)) {
			checkTarget(arg, dirState, pathPatterns, true);
		}
		return;
	}
	if (base === "curl" || base === "wget") {
		// The output path of a downloader is a write target. The short
		// flags take the value attached or as the next word.
		const shortFlags = base === "curl" ? "o" : "OP";
		const longFlags =
			base === "curl"
				? ["--output"]
				: ["--output-document", "--directory-prefix"];
		for (let i = after; i < words.length; i++) {
			const w = words[i];
			let target;
			if (
				(w.length === 2 && w[0] === "-" && shortFlags.includes(w[1])) ||
				longFlags.includes(w)
			) {
				target = words[i + 1];
				i++;
			} else if (longFlags.some((flag) => w.startsWith(`${flag}=`))) {
				target = w.slice(w.indexOf("=") + 1);
			} else if (
				w.length > 2 &&
				w[0] === "-" &&
				w[1] !== "-" &&
				shortFlags.includes(w[1])
			) {
				target = w.slice(2);
			}
			if (target !== undefined) {
				checkTarget(target, dirState, pathPatterns, true);
			}
		}
		return;
	}
	if (base === "git") {
		// `git rm`/`git mv` touch paths; git's own option values come first.
		const rest = words.slice(after);
		let k = 0;
		while (k < rest.length && rest[k].startsWith("-")) {
			k += GIT_VALUE_FLAGS.has(rest[k]) ? 2 : 1;
		}
		const sub = rest[k];
		if (sub === "rm" || sub === "mv") {
			for (const arg of nonFlagArgs(words, after + k + 1, NO_VALUE_FLAGS)) {
				checkTarget(arg, dirState, pathPatterns, false);
			}
		}
	}
}

/**
 * Rule 4c: `find` writes through `-delete`, through `-exec`/`-execdir`
 * of a writing command, and through the file argument of `-fprint`,
 * `-fprint0`, `-fprintf`, and `-fls`. A mutating find also denies when
 * one of its roots resolves outside /tmp: the matched files under it
 * are unknowable. The command after `-exec`, `-execdir`, `-ok`, or
 * `-okdir` runs to `;`, `\;`, or `+` and gets the same first-word
 * checks as a segment.
 */
function checkFind(
	words,
	firstIndex,
	dirState,
	bashRules,
	pathPatterns,
	segText,
	depth,
) {
	const after = words.slice(firstIndex + 1);
	let mutating = false;
	for (let i = 0; i < after.length; i++) {
		const word = after[i];
		if (FIND_WRITE_FILE_FLAGS.has(word)) {
			if (after[i + 1] !== undefined) {
				checkTarget(after[i + 1], dirState, pathPatterns, true);
			}
			i++;
			continue;
		}
		if (FIND_EXEC_FLAGS.has(word)) {
			// The executed command ends at `;` (an escaped `\;` also reads
			// as `;` after tokenize), at `+`, or at the end of the line.
			let end = i + 1;
			while (end < after.length && after[end] !== ";" && after[end] !== "+") {
				end++;
			}
			const execWords = after.slice(i + 1, end);
			const first = firstWord(execWords);
			if (first) {
				if (
					(word === "-exec" || word === "-execdir") &&
					FIND_WRITE_COMMANDS.has(basename(first.word))
				) {
					mutating = true;
				}
				checkFirstWord(
					execWords,
					first,
					segText,
					dirState,
					bashRules,
					pathPatterns,
					depth,
				);
			}
			// The scan resumes after the terminator for more find flags.
			i = end;
			continue;
		}
		if (word === "-delete") {
			mutating = true;
		}
	}
	if (!mutating) {
		return;
	}
	// A mutating find can delete protected files its path operands do
	// not name. A root denies unless it resolves under /tmp.
	const checkFindRoot = (raw) => {
		const resolved = resolveTarget(tokenize(raw).join(" "), dirState);
		if (resolved.error) {
			deny(resolved.error);
		}
		if (resolved.dev || !resolved.path) {
			return;
		}
		for (const entry of pathPatterns) {
			if (pathDenied(entry.pattern, resolved.path)) {
				deny(`write target ${raw} matches ${entry.rule}`);
			}
		}
		if (relative("/tmp", resolved.path).startsWith("..")) {
			deny(`find can delete protected files under ${raw}`);
		}
	};
	for (let i = 0; i < after.length; i++) {
		const word = after[i];
		// BSD `-f` names a path operand itself; GNU `-D` takes a debug value.
		if (word === "-f") {
			i++;
			if (after[i] !== undefined) {
				checkFindRoot(after[i]);
			}
			continue;
		}
		if (word === "-D") {
			i++;
			continue;
		}
		if (FIND_GLOBAL_FLAGS.has(word)) {
			continue;
		}
		if (word.startsWith("-")) {
			break;
		}
		checkFindRoot(word);
	}
}

/**
 * Returns the script text a `sh -c` family shell or `eval` runs, or null.
 * For `eval` every argument joins the script; for a `-c` shell it is the
 * word after the first flag that ends in `c` (`-c`, `-lc`, `-ec`).
 */
function innerScript(base, words, firstIndex) {
	const after = words.slice(firstIndex + 1);
	if (base === "eval") {
		return after.length === 0 ? null : after.join(" ");
	}
	if (!C_FLAG_SHELLS.has(base)) {
		return null;
	}
	const cIndex = after.findIndex((word) => /^-[A-Za-z]*c$/.test(word));
	if (cIndex === -1) {
		return null;
	}
	// `sh -c -- script` is legal: a `--` ends the option list.
	const scriptIndex = after[cIndex + 1] === "--" ? cIndex + 2 : cIndex + 1;
	return after[scriptIndex] ?? null;
}

// Rule 5b: package managers that run install scripts; the template uses pnpm.
function checkPackageManager(base, words, firstIndex) {
	// `corepack npm@10` names the manager with a version suffix.
	const pm = base.replace(/@.*$/, "");
	const args = nonFlagArgs(words, firstIndex + 1, PM_VALUE_FLAGS);
	const sub = args[0];
	// `config set`, `config delete`, and `config edit` write .npmrc or
	// ~/.npmrc, and both are denied paths.
	if (
		(pm === "pnpm" || pm === "npm" || pm === "yarn") &&
		sub === "config" &&
		(args[1] === "set" || args[1] === "delete" || args[1] === "edit")
	) {
		deny(`${pm} config ${args[1]} writes .npmrc`);
	}
	if (pm === "pnpm") {
		// UNVERIFIED whether `pnpm rebuild` honors onlyBuiltDependencies; deny.
		if (PNPM_SCRIPT_SUBS.has(sub)) {
			deny(`pnpm ${sub} runs dependency build scripts`);
		}
		return;
	}
	if (pm === "npm" && NPM_SCRIPT_SUBS.has(sub)) {
		deny(`npm ${sub} runs install scripts; use pnpm`);
	}
	if (pm === "yarn" && (sub === undefined || YARN_SCRIPT_SUBS.has(sub))) {
		deny(`yarn ${sub ?? "install"} runs install scripts; use pnpm`);
	}
	if (pm === "bun" && BUN_SCRIPT_SUBS.has(sub)) {
		deny(`bun ${sub} runs install scripts; use pnpm`);
	}
}

/** Tracks cd/pushd so relative targets resolve against the real directory. */
function updateDir(base, words, firstIndex, dirState) {
	if (base === "popd") {
		// The stack is not tracked; later relative targets are unresolvable.
		dirState.broken = true;
		return;
	}
	if (base !== "cd" && base !== "pushd") {
		return;
	}
	// A `cd` inside `( )` moves the subshell only; the directory is unknown
	// after it, so the state breaks and later relative targets fail closed.
	if (words.slice(0, firstIndex + 1).some((word) => /^[!{]*\(/.test(word))) {
		dirState.broken = true;
		return;
	}
	const arg = nonFlagArgs(words, firstIndex + 1, NO_VALUE_FLAGS)[0];
	if (arg === undefined) {
		// `cd` alone goes to $HOME.
		dirState.dir = homedir();
		return;
	}
	// `cd -` or a variable target leaves the directory unknown.
	if (arg === "-" || /[$`]/.test(arg)) {
		dirState.broken = true;
		return;
	}
	const resolved = resolveTarget(arg, dirState);
	if (resolved.error || resolved.dev) {
		dirState.broken = true;
		return;
	}
	dirState.dir = resolved.path;
}

/** Rule 1a: true when the segment runs an interpreter, maybe through sudo. */
function isInterpreterSeg(seg) {
	const words = tokenize(seg.text);
	const first = firstWord(words);
	if (!first) {
		return false;
	}
	let word = basename(first.word);
	if (word === "sudo") {
		// `sudo` and its flags may precede the interpreter.
		let i = first.index + 1;
		while (i < words.length && words[i].startsWith("-")) {
			i++;
		}
		word = words[i] ? basename(words[i]) : "";
	}
	return INTERPRETERS.has(word) || INTERPRETER_RE.test(word);
}

/**
 * Runs the rules a resolved first word controls: the denied first words,
 * git config, install scripts, write targets, `find`, and the script
 * text of `sh -c` and `eval` while depth stays under 3. `find` reuses
 * it for the command behind `-exec`. checkWords and first.index agree:
 * firstWord ran on checkWords. segText is the segment text in reasons.
 */
function checkFirstWord(
	checkWords,
	first,
	segText,
	dirState,
	bashRules,
	pathPatterns,
	depth,
) {
	const base = basename(first.word);
	// A `$` or a backtick in the command word is a substitution the
	// hook cannot resolve; the command stays unknown.
	if (/[$`]/.test(first.word)) {
		deny(`cannot resolve the command word ${first.word}`);
	}
	// `env -C`/`--chdir` moves the child's directory; fail closed.
	if (first.envChdir) {
		dirState.broken = true;
	}
	// `env -S` splits its string into a command the hook cannot read.
	if (first.envSplitString) {
		deny(`env -S runs a string as a command: ${segText}`);
	}
	// Rule 3: privileged, network, and container first words.
	if (DENIED_FIRST_WORDS.has(base)) {
		deny(`${base}: ${segText}`);
	}
	if (base === "git") {
		// `git -c` and `--config` set config for the whole run (rule 2).
		for (
			let i = first.index + 1;
			i < checkWords.length && checkWords[i].startsWith("-");
			i++
		) {
			if (/^-c|^--config(?:-env)?(?:=|$)/.test(checkWords[i])) {
				deny(`git config: ${segText}`);
			}
			if (GIT_VALUE_FLAGS.has(checkWords[i])) {
				i++;
			}
		}
		// Rule 2: only `git config` rewrites repo settings. Option
		// values are skipped the way commandTargets does for `git rm`,
		// so `git add vite.config.ts` and `commit -m "fix config"`
		// stay allowed.
		let i = first.index + 1;
		while (i < checkWords.length && checkWords[i].startsWith("-")) {
			i += GIT_VALUE_FLAGS.has(checkWords[i]) ? 2 : 1;
		}
		if (checkWords[i] === "config") {
			deny(`git config: ${segText}`);
		}
	}
	checkPackageManager(base, checkWords, first.index);
	commandTargets(
		base,
		checkWords,
		first.index,
		dirState,
		pathPatterns,
		first.viaStdin,
	);
	if (base === "find") {
		checkFind(
			checkWords,
			first.index,
			dirState,
			bashRules,
			pathPatterns,
			segText,
			depth,
		);
	}
	// Three levels cover every real command; deeper nesting is a LIMIT.
	if (depth < 3) {
		const script = innerScript(base, checkWords, first.index);
		if (script !== null) {
			checkBash(script, dirState, bashRules, pathPatterns, depth + 1);
		}
	}
}

/**
 * Runs the per-segment rules in order. dirState carries the directory a
 * `cd` set; substitution segments are checked with the parent's directory.
 * depth counts the `sh -c`/`eval` script levels above these segments.
 */
function checkSegments(segments, dirState, bashRules, pathPatterns, depth) {
	for (const seg of segments) {
		for (const entry of bashRules) {
			if (commandDenied(entry.pattern, seg.text)) {
				deny(`Bash command ${seg.text} matches ${entry.rule}`);
			}
		}
		// Rules 1b/1c: a downloader inside $( ) ` ` <( ) or >( ) runs
		// its result.
		if (seg.substitution) {
			const subFirst = firstWord(tokenize(seg.text));
			if (subFirst && DOWNLOADERS.has(basename(subFirst.word))) {
				deny(`download and run in a substitution: ${seg.text}`);
			}
		}
		const words = tokenize(seg.text);
		let first = firstWord(words);
		let checkWords = words;
		if (first && PM_BINS.has(basename(first.word))) {
			// `pnpm exec npm i` runs npm; drop the launcher so rules see npm.
			const subIndex = operandIndex(words, first.index + 1, PM_VALUE_FLAGS);
			const sub = subIndex === -1 ? "" : words[subIndex];
			const isExec =
				sub === "exec" ||
				sub === "dlx" ||
				(basename(first.word) === "bun" && sub === "x");
			if (isExec && operandIndex(words, subIndex + 1, NO_VALUE_FLAGS) !== -1) {
				checkWords = words.filter(
					(_, i) => i !== first.index && i !== subIndex,
				);
				first = firstWord(checkWords);
			}
		}
		const base = first ? basename(first.word) : "";
		if (first) {
			checkFirstWord(
				checkWords,
				first,
				seg.text,
				dirState,
				bashRules,
				pathPatterns,
				depth,
			);
		}
		// Rule 4a: an output redirect writes its target.
		for (const target of redirectTargets(seg.text)) {
			checkTarget(target, dirState, pathPatterns, true);
		}
		if (seg.subs.length > 0) {
			checkSegments(seg.subs, dirState, bashRules, pathPatterns, depth);
		}
		if (first && !seg.substitution) {
			updateDir(base, checkWords, first.index, dirState);
		}
	}
}

/**
 * Rule 1a: a curl/wget segment followed in its pipeline group by an
 * interpreter turns a download into code execution.
 */
function checkPipes(allSegments) {
	const groups = new Map();
	for (const seg of allSegments) {
		const list = groups.get(seg.group) ?? [];
		list.push(seg);
		groups.set(seg.group, list);
	}
	for (const segs of groups.values()) {
		for (let i = 0; i < segs.length; i++) {
			const first = firstWord(tokenize(segs[i].text));
			if (!first || !DOWNLOADERS.has(basename(first.word))) {
				continue;
			}
			for (let j = i + 1; j < segs.length; j++) {
				if (isInterpreterSeg(segs[j])) {
					deny(`download and run: ${segs[i].text} | ${segs[j].text}`);
				}
			}
		}
	}
}

/**
 * Runs all Bash rules on one command. dirState bases relative targets; the
 * checks get a copy of it, so a `cd` inside a `sh -c`/`eval` script cannot
 * move the parent. depth counts the script levels above this command.
 */
function checkBash(command, dirState, bashRules, pathPatterns, depth) {
	// Rule 5a: flags that turn dependency build scripts back on. pnpm config
	// keys are case-insensitive, so the text is matched lower-cased.
	const lowered = command.toLowerCase();
	for (const marker of [
		"dangerouslyallowallbuilds",
		"dangerously-allow-all-builds",
		"npm_config_dangerously_allow_all_builds",
		"--ignore-scripts=false",
	]) {
		if (lowered.includes(marker)) {
			deny(`install scripts enabled by ${marker}`);
		}
	}
	// Rule 1a: a download piped to an interpreter, also inside quotes.
	if (DOWNLOAD_PIPE_RE.test(command)) {
		deny(`download and run: ${command}`);
	}

	const segments = splitSegments(command);
	const all = [];
	let subGroup = 0;
	for (const seg of segments) {
		all.push(seg);
		for (const inner of extractSubstitutions(seg.text)) {
			for (const sub of splitSegments(inner)) {
				sub.substitution = true;
				sub.group = `sub${subGroup}`;
				sub.subs = [];
				seg.subs.push(sub);
				all.push(sub);
			}
			subGroup++;
		}
	}
	const state = { dir: dirState.dir, broken: dirState.broken };
	checkSegments(segments, state, bashRules, pathPatterns, depth);
	checkPipes(all);
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
	const cwd = typeof input.cwd === "string" ? input.cwd : projectDir;

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

	const bashRules = [];
	const pathPatterns = [];
	for (const rule of denyRules) {
		const match = /^(\w+)\((.+)\)$/.exec(rule);
		if (!match) {
			continue;
		}
		const [, tool, pattern] = match;
		if (tool === "Edit" || tool === "Write") {
			pathPatterns.push({ rule, pattern });
		}
		if (tool === "Bash") {
			bashRules.push({ rule, pattern });
		}
	}

	if (PATH_WRITE_TOOLS.has(toolName) && filePath) {
		for (const entry of pathPatterns) {
			if (pathDenied(entry.pattern, filePath)) {
				deny(`${toolName} ${filePath} matches ${entry.rule}`);
			}
		}
		// Writes stay inside the project or /tmp. ~ and $HOME expand like
		// the shell; a literal `$` in a name is a route file, not a
		// variable.
		const expanded = expandHome(filePath);
		const absolute = isAbsolute(expanded)
			? normalize(expanded)
			: resolve(cwd, expanded);
		if (isOutsideWorkspace(absolute)) {
			deny(`write outside the workspace: ${filePath}`);
		}
	}

	if (toolName === "Bash" && command) {
		checkBash(command, { dir: cwd, broken: false }, bashRules, pathPatterns, 0);
	}
}

try {
	main();
} catch (error) {
	// Fail closed: a hook bug must not become a permission bypass.
	const message = error instanceof Error ? error.message : String(error);
	process.stderr.write(`wandit pre-tool-use: internal error: ${message}\n`);
	process.exit(2);
}
