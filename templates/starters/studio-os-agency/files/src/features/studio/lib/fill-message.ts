// Puts formatted values into a translated message, for example "{count} new".
// The shell, the cards, and the list pages call it after t("key"). It has no other dependency.

/**
 * fillMessage("{count} projects", { count: "4" }) gives "4 projects".
 * The values are already formatted with Intl. A name with no value stays as it is.
 */
export function fillMessage(
	template: string,
	values: Record<string, string>,
): string {
	return template.replace(
		/\{(\w+)\}/g,
		(placeholder, name: string) => values[name] ?? placeholder,
	);
}
