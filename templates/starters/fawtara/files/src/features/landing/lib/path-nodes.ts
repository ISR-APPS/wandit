// The five nodes of the money path, in the order that the money takes.
// PathDiagram places them on its canvas. PathRail lists them on a phone.
import type { TranslationKey } from "~/shared/i18n";

/** The id of one node. landing.css has one place class for each id: fw-node-<id>. */
export type PathNodeId =
	| "shop"
	| "fawtara"
	| "customer"
	| "bank"
	| "accountant";

/** One node of the path. */
type PathNode = {
	id: PathNodeId;
	/** The name of the node, for example "Your shop". */
	titleKey: TranslationKey;
	/** The short note under the title in the diagram, a few words. */
	noteKey: TranslationKey;
	/** The full sentence of the phone rail. */
	detailKey: TranslationKey;
};

/** The shop issues, Fawtara sends, the customer pays, the bank confirms, the accountant receives. */
export const PATH_NODES: readonly PathNode[] = [
	{
		id: "shop",
		titleKey: "path.shopTitle",
		noteKey: "path.shopNote",
		detailKey: "path.shopDetail",
	},
	{
		id: "fawtara",
		titleKey: "path.fawtaraTitle",
		noteKey: "path.fawtaraNote",
		detailKey: "path.fawtaraDetail",
	},
	{
		id: "customer",
		titleKey: "path.customerTitle",
		noteKey: "path.customerNote",
		detailKey: "path.customerDetail",
	},
	{
		id: "bank",
		titleKey: "path.bankTitle",
		noteKey: "path.bankNote",
		detailKey: "path.bankDetail",
	},
	{
		id: "accountant",
		titleKey: "path.accountantTitle",
		noteKey: "path.accountantNote",
		detailKey: "path.accountantDetail",
	},
];
