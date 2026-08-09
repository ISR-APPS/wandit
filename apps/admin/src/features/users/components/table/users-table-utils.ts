function getInitials(name: string) {
	return (
		name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part.charAt(0))
			.join("")
			.toUpperCase() || "?"
	);
}

function titleCase(value: string) {
	return value
		.replaceAll("-", " ")
		.replaceAll("_", " ")
		.replace(/\b\w/g, (character) => character.toUpperCase());
}

export { getInitials, titleCase };
