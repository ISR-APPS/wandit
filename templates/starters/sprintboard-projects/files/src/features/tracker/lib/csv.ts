// CSV export of table rows: builds the text and starts a download in the browser.
// The "Export" buttons of the pages and the "Export selected" bulk actions call it in their click handler.
// It uses only Blob, an object URL, and a temporary <a download>. No package.

/** One column of a CSV file. */
export type CsvColumn<Row extends { id: string }> = {
	/** The header cell, already translated. */
	header: string;
	/** The text of one cell. Format dates and amounts before: the file keeps the text as it is. */
	value: (row: Row) => string;
};

// A spreadsheet runs a cell that starts with one of these signs as a formula.
const FORMULA_START = /^[=+\-@\t\r]/;

// Quotes every field and doubles each quote inside it, as RFC 4180 says.
function csvField(text: string): string {
	// Security: a leading quote mark makes a spreadsheet show the text, not run it as a formula.
	const safe = FORMULA_START.test(text) ? `'${text}` : text;
	return `"${safe.replaceAll('"', '""')}"`;
}

/** The CSV text of `rows`: a header line, then one line per row. Lines end with CRLF. */
export function toCsv<Row extends { id: string }>(
	rows: Row[],
	columns: CsvColumn<Row>[],
): string {
	const lines = [
		columns.map((column) => csvField(column.header)).join(","),
		...rows.map((row) =>
			columns.map((column) => csvField(column.value(row))).join(","),
		),
	];
	return lines.join("\r\n");
}

/** Starts the download of `csv` as `fileName` (for example "projects.csv"). Call it in a click handler. */
export function downloadCsv(fileName: string, csv: string): void {
	// The byte order mark makes spreadsheet apps read the file as UTF-8, so accents stay correct.
	const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = fileName;
	link.click();
	// Firefox can drop a download whose URL dies in the same task as the click, so the revoke waits one task.
	setTimeout(() => URL.revokeObjectURL(url));
}
