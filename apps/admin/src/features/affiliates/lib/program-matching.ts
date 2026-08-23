type ProgramMatchItem = {
	program: {
		name: string;
		status: "active" | "archived";
	};
};

const programStatusRank = {
	active: 0,
	archived: 1,
} as const;

export function normalizeProgramSearch(value: string): string {
	return value
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.trim();
}

export function filterPrograms<T extends ProgramMatchItem>(
	items: readonly T[],
	query: string,
	limit = 10,
): { items: T[]; total: number } {
	const normalizedQuery = normalizeProgramSearch(query);
	const matches = items
		.map((item, index) => ({
			index,
			item,
			normalizedName: normalizeProgramSearch(item.program.name),
		}))
		.filter(
			({ normalizedName }) =>
				!query || normalizedName.includes(normalizedQuery),
		)
		.sort((left, right) => {
			if (normalizedQuery) {
				const prefixDifference =
					Number(!left.normalizedName.startsWith(normalizedQuery)) -
					Number(!right.normalizedName.startsWith(normalizedQuery));
				if (prefixDifference !== 0) {
					return prefixDifference;
				}
			}

			const statusDifference =
				programStatusRank[left.item.program.status] -
				programStatusRank[right.item.program.status];
			if (statusDifference !== 0) {
				return statusDifference;
			}

			return (
				left.normalizedName.localeCompare(right.normalizedName) ||
				left.index - right.index
			);
		});

	return {
		items: matches.slice(0, Math.max(0, limit)).map(({ item }) => item),
		total: matches.length,
	};
}
