/**
 * Plain domain error: a committed file is larger than the byte ceiling of
 * the read. `GitFileReader.readFile` throws it only when the caller gives a
 * ceiling. `CodeService.file` turns it into 413 `CODE_FILE_TOO_LARGE`.
 */

/** Thrown before the reader keeps the bytes of the file in memory. */
export class GitFileTooLargeError extends Error {
	constructor(path: string) {
		super(`Committed file ${path} is larger than the read ceiling`);
		this.name = "GitFileTooLargeError";
	}
}
