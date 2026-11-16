// The money-path diagram of a wide screen: five node cards, dashed relations, and one lit path.
// PathSection renders it from 1024px. landing.css draws the lit path from the variable --fw-path,
// places each node and chip in percent of the canvas, and moves the payment dot.
// With no script the variable is 1, so the diagram is complete.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { PATH_NODES } from "../lib/path-nodes";
import { BrandGlyph } from "./brand-glyph";
import { NodeGlyph } from "./node-glyph";
import { ResultChip } from "./result-chip";

// The canvas is 1100 by 540 units. Each curve ends at the center of a node:
// shop (154, 130), Fawtara (550, 270), customer (946, 108), bank (924, 420), accountant (176, 432).
const SHOP_TO_FAWTARA = "M154 130 C 300 190, 400 250, 550 270";
const FAWTARA_TO_CUSTOMER = "M550 270 C 700 220, 820 150, 946 108";
const CUSTOMER_TO_BANK = "M946 108 C 985 210, 970 330, 924 420";
const BANK_TO_FAWTARA = "M924 420 C 790 390, 680 330, 550 270";
const FAWTARA_TO_ACCOUNTANT = "M550 270 C 420 330, 300 390, 176 432";
// The read access of the accountant. No beat lights it, so one dashed relation stays in the complete diagram.
const SHOP_TO_ACCOUNTANT = "M154 130 C 96 230, 104 350, 176 432";

const BASE_LINKS = [
	SHOP_TO_FAWTARA,
	FAWTARA_TO_CUSTOMER,
	CUSTOMER_TO_BANK,
	BANK_TO_FAWTARA,
	FAWTARA_TO_ACCOUNTANT,
	SHOP_TO_ACCOUNTANT,
];

// The first two beats of the lit path. Each one joins two of the curves above.
const SEND_PATH =
	"M154 130 C 300 190, 400 250, 550 270 C 700 220, 820 150, 946 108";
// landing.css moves the payment dot along this curve, so it holds the same text.
const PAY_PATH =
	"M946 108 C 985 210, 970 330, 924 420 C 790 390, 680 330, 550 270";

/** One drawing for a screen reader: `path.diagramLabel` tells the whole path in a sentence. */
export function PathDiagram() {
	const { t } = useT();
	return (
		<div
			role="img"
			aria-label={t("path.diagramLabel")}
			className="fw-path-canvas relative mx-auto max-w-[1080px]"
		>
			<svg
				viewBox="0 0 1100 540"
				preserveAspectRatio="none"
				aria-hidden="true"
				className="fw-path-links absolute inset-0 size-full"
			>
				{BASE_LINKS.map((curve) => (
					<path key={curve} d={curve} className="fw-base-link" />
				))}
				<path d={SEND_PATH} pathLength={1} className="fw-lit fw-lit-send" />
				<path d={PAY_PATH} pathLength={1} className="fw-lit fw-lit-pay" />
				<path
					d={FAWTARA_TO_ACCOUNTANT}
					pathLength={1}
					className="fw-lit fw-lit-g50"
				/>
				<circle r="9" className="fw-pay-dot" />
			</svg>

			{PATH_NODES.map((node) => (
				<div
					key={node.id}
					className={cn(
						"fw-card fw-node whitespace-nowrap px-4.5 py-3",
						`fw-node-${node.id}`,
						node.id === "fawtara" && "fw-card-featured",
					)}
				>
					<p
						className={cn(
							"flex items-center gap-2 font-bold font-display",
							node.id === "fawtara"
								? "text-(--fw-blue-deep) text-base"
								: "text-[0.92rem]",
						)}
					>
						{node.id === "fawtara" ? (
							<BrandGlyph className="size-5 shrink-0" />
						) : (
							<NodeGlyph name={node.id} />
						)}
						{t(node.titleKey)}
					</p>
					<p className="mt-0.5 text-[0.78rem] text-muted-foreground">
						{t(node.noteKey)}
					</p>
				</div>
			))}

			<ResultChip kind="sent" className="fw-node fw-chip-sent" />
			<ResultChip kind="received" className="fw-node fw-chip-received" />
			<ResultChip kind="ready" className="fw-node fw-chip-ready" />
		</div>
	);
}
