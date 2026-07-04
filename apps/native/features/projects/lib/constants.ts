// TODO: replace with DTOs derived from packages/contracts once the
// projects API is wired (features/projects/api/).
export type ProjectSummary = {
	id: string;
	name: string;
	updatedAt: string;
};

export const MOCK_PROJECTS: ProjectSummary[] = [
	{ id: "demo-project", name: "Demo project", updatedAt: "2026-07-01" },
	{ id: "sneakers-cod", name: "Sneakers COD", updatedAt: "2026-06-28" },
	{ id: "resto-hydra", name: "Resto Hydra", updatedAt: "2026-06-21" },
];
