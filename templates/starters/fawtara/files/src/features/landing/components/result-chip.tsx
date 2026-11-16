// A result chip of the money path: the status that a node shows when its beat ends.
// PathDiagram places the three chips on the canvas. PathRail puts them in the cards of a phone.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { CHIP } from "../lib/class-names";

/** "sent": the invoice left. "received": the payment came home. "ready": the G50 is filled in. */
export type ResultChipKind = "sent" | "received" | "ready";

// The green of "received" is a status color. It lives only in drawn product UI, at chip size.
// Warm moment 2 of 3: the "ready" chip is the end state of the diagram.
const CHIPS = {
	sent: {
		textKey: "path.sentChip",
		toneClassName: "bg-accent text-(--fw-blue-deep)",
	},
	received: {
		textKey: "path.receivedChip",
		toneClassName: "bg-success/12 text-success",
	},
	ready: { textKey: "path.readyChip", toneClassName: "dark fw-warm" },
} as const;

type ResultChipProps = {
	/** Which result the chip reports. It sets the text and the tone. */
	kind: ResultChipKind;
	/** Place classes. PathDiagram gives the canvas place of the chip. */
	className?: string;
};

/** The figures of a chip are tabular, like every figure of a drawn product card. */
export function ResultChip({ kind, className }: ResultChipProps) {
	const { t } = useT();
	const chip = CHIPS[kind];
	return (
		<span className={cn(CHIP, "tabular-nums", chip.toneClassName, className)}>
			{t(chip.textKey)}
		</span>
	);
}
