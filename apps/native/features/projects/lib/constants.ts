// TODO: replace with DTOs derived from packages/contracts once the
// projects API is wired (features/projects/api/).
export type ProjectSummary = {
	id: string;
	name: string;
	/** Mock relative/absolute label — backend output, not localized. */
	updatedAt: string;
	/** Drawer letter-tile gradient [from, to] (RN-parseable hex). */
	tile: readonly [string, string];
};

// Mock projects matching the light prototype's drawer (§3.3).
export const MOCK_PROJECTS: ProjectSummary[] = [
	{
		id: "montre-vintage-cod",
		name: "Montre Vintage COD",
		updatedAt: "2 min ago",
		tile: ["#F1E6DA", "#E8C2A9"],
	},
	{
		id: "serum-eclat",
		name: "Sérum Éclat",
		updatedAt: "Mar 8",
		tile: ["#F5E6EF", "#E4CBE1"],
	},
	{
		id: "cabinet-dentaire-amine",
		name: "Cabinet Dentaire Amine",
		updatedAt: "Mar 6",
		tile: ["#E0EEEF", "#BBDBE1"],
	},
	{
		id: "formation-ads-fr",
		name: "Formation Ads FR",
		updatedAt: "Nov 18, 2025",
		tile: ["#F1EEE7", "#E2D6C2"],
	},
];
