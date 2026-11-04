/**
 * Guarded file writes and deletes of the MCP `apply_changes` tool in a running sandbox.
 * `McpChangesService` calls `stageGuardedWrites`, then `applyGuardedWrites`, while it holds the project turn lock.
 * The contents go to /tmp through `writeFiles`, then one bash script moves each file into the worktree.
 */
import { randomUUID } from "node:crypto";

import type { SandboxReader } from "../../domain/ports/sandbox-provider";

/** One change of `apply_changes`. `path` is relative to the worktree and passed `isWritableCodePath`. */
export type GuardedFileChange =
	| { path: string; content: string }
	| { path: string; delete: true };

/** A path that `GUARDED_WRITE_SCRIPT` refused, and the pass that refused it. */
export type GuardedWriteRefusal = {
	/** The worktree path as the agent sent it. */
	path: string;
	/** "check": the script wrote nothing. "apply": earlier changes of the call can be in the worktree. */
	pass: "check" | "apply";
};

/** The exit code of `GUARDED_WRITE_SCRIPT` when the check pass refuses a path. The script prints the path. */
const CHECK_REFUSED_EXIT_CODE = 45;
/** The exit code when the apply pass refuses a path. The script prints the path. */
const APPLY_REFUSED_EXIT_CODE = 46;

/**
 * 30 s. One call moves at most 50 files of at most 512 KiB each, so a few seconds is normal.
 * The vendor kills the command at this timeout, and the caller undoes the writes.
 */
const WRITE_TIMEOUT_MS = 30_000;

/**
 * Applies the records `w <path> <staged index>` and `d <path>` in `$2...` to the worktree, the cwd.
 * `$1` is the prefix of the staged files. The check pass writes nothing; the apply pass writes.
 * Security: the script prints the path when it finds one of these:
 * - a symlink in the folder path
 * - a symlink or a folder at the path
 * - a file in the place of a folder
 *
 * The script then exits 45 in the check pass, or 46 in the apply pass.
 * So no write or delete leaves the worktree. Each new file lands with a rename inside its real folder.
 * A symlink that appears later cannot redirect the write. A failure in the apply pass can leave earlier changes.
 */
const GUARDED_WRITE_SCRIPT = [
	"set -o pipefail",
	"staging=$1; shift",
	"root=$(realpath -e -- .) || exit 1",
	"tmp=",
	`trap 'if [ -n "$tmp" ]; then rm -f -- "$tmp"; fi; rm -f -- "$staging"-*' EXIT`,
	// The apply pass sets its own code, so the caller knows that earlier changes can be written.
	`refused_code=${CHECK_REFUSED_EXIT_CODE}`,
	`refuse() { printf '%s' "$1"; exit "$refused_code"; }`,
	// Prints the real folder of $1. Fails when a symlink is in the folder path, or a file is in its place.
	"folder_of() {",
	"  local dir want",
	'  dir=$(dirname -- "$1")',
	'  if [ "$dir" = . ]; then want=$root; else want=$root/$dir; fi',
	'  [ "$(realpath -m -- "$dir")" = "$want" ] || return 1',
	'  [ ! -e "$want" ] || [ -d "$want" ] || return 1',
	"  printf '%s' \"$want\"",
	"}",
	"check() {",
	'  folder_of "$1" >/dev/null || refuse "$1"',
	'  if [ -L "$1" ] || { [ -e "$1" ] && [ ! -f "$1" ]; }; then refuse "$1"; fi',
	"}",
	// $1 is the path, $2 the index of its staged file.
	"write() {",
	"  local want name",
	'  name=$(basename -- "$1")',
	// Security: check again just before mkdir. A folder swapped for a symlink after the check pass stops here.
	// A swap between this check and mkdir can still make empty folders. The checks below stop the file.
	'  folder_of "$1" >/dev/null || refuse "$1"',
	'  mkdir -p -- "$(dirname -- "$1")" || refuse "$1"',
	'  want=$(folder_of "$1") || refuse "$1"',
	'  cd -- "$want" || exit 1',
	// A folder swapped for a symlink after the check shows here: the real cwd is not the checked folder.
	'  [ "$(pwd -P)" = "$want" ] || refuse "$1"',
	'  [ ! -L "$name" ] || refuse "$1"',
	'  tmp=$(mktemp -p "$want" .wandit-mcp.XXXXXX) || exit 1',
	'  cat -- "$staging-$2" > "$tmp" || exit 1',
	// A changed file keeps its mode, for example an executable script. A new file gets 644.
	'  if [ -f "$name" ]; then chmod --reference="$name" -- "$tmp"; else chmod 644 -- "$tmp"; fi || exit 1',
	'  mv -f -T -- "$tmp" "$name" || exit 1',
	"  tmp=",
	'  cd -- "$root" || exit 1',
	"}",
	"remove() {",
	"  local want",
	'  if [ -e "$1" ] || [ -L "$1" ]; then',
	'    want=$(folder_of "$1") || refuse "$1"',
	'    rm -f -- "$want/$(basename -- "$1")" || exit 1',
	"  fi",
	"}",
	// $1 is the pass, "check" or "apply". The records follow.
	"run() {",
	"  local pass=$1; shift",
	"  while [ $# -gt 0 ]; do",
	'    if [ "$1" = w ]; then',
	'      if [ "$pass" = check ]; then check "$2"; else write "$2" "$3"; fi',
	"      shift 3",
	"    else",
	'      if [ "$pass" = check ]; then check "$2"; else remove "$2"; fi',
	"      shift 2",
	"    fi",
	"  done",
	"}",
	'run check "$@"',
	`refused_code=${APPLY_REFUSED_EXIT_CODE}`,
	'run apply "$@"',
].join("\n");

/**
 * Copies the new contents to /tmp in the sandbox and returns the prefix of the staged files.
 * It does not touch the worktree, so a throw here needs no undo.
 */
export async function stageGuardedWrites(
	sandbox: Pick<SandboxReader, "writeFiles">,
	changes: GuardedFileChange[],
): Promise<string> {
	// One flat file per write, next to no other file: the vendor write needs no new folder.
	const staging = `/tmp/wandit-mcp-${randomUUID()}`;
	const writes = changes.flatMap((change, index) =>
		"content" in change
			? [
					{
						content: new TextEncoder().encode(change.content),
						path: `${staging}-${index}`,
					},
				]
			: [],
	);
	if (writes.length > 0) {
		await sandbox.writeFiles(writes);
	}
	return staging;
}

/**
 * Writes and deletes the files in the sandbox worktree. Returns the first refusal, or null when every
 * change landed. `changes` is the array that `stageGuardedWrites` staged: its index names the staged file.
 * After a throw, a timeout, or an apply-pass refusal, earlier changes can be written, so the caller undoes the paths.
 */
export async function applyGuardedWrites(
	sandbox: Pick<SandboxReader, "exec" | "workspaceDir">,
	staging: string,
	changes: GuardedFileChange[],
): Promise<GuardedWriteRefusal | null> {
	const records = changes.flatMap((change, index) =>
		"content" in change
			? ["w", change.path, String(index)]
			: ["d", change.path],
	);
	const result = await sandbox.exec(
		"bash",
		["-c", GUARDED_WRITE_SCRIPT, "bash", staging, ...records],
		{ cwd: sandbox.workspaceDir, timeoutMs: WRITE_TIMEOUT_MS },
	);
	if (result.exitCode === CHECK_REFUSED_EXIT_CODE) {
		return { pass: "check", path: result.stdout };
	}
	if (result.exitCode === APPLY_REFUSED_EXIT_CODE) {
		return { pass: "apply", path: result.stdout };
	}
	if (result.exitCode !== 0) {
		throw new Error(
			`Guarded file write failed (${result.exitCode}): ${result.stderr}`,
		);
	}
	return null;
}
