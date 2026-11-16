// One field of the reply card: a label in capitals above an underline-only control.
// ReplyCard renders seven of them. The control comes from a render function, so it gets the id that the label points to.
// The field settles into place with the others (.voeu-card-settle in landing.css).
import type { ReactNode } from "react";
import { useId } from "react";
import { cn } from "~/shared/lib/utils";
import { settleOrder } from "../lib/settle-order";

type CardFieldProps = {
	/** Translated label in capitals above the field. */
	label: string;
	/** Settle order of the field in the card. */
	order: number;
	/** True when the field takes the two columns. */
	isWide?: boolean;
	/** Renders the control with the id that the label points to. */
	children: (fieldId: string) => ReactNode;
};

/** The label and its control. */
export function CardField({
	label,
	order,
	isWide = false,
	children,
}: CardFieldProps) {
	const fieldId = useId();
	return (
		<div
			style={settleOrder(order)}
			className={cn("voeu-card-settle mt-5 min-w-0", isWide && "sm:col-span-2")}
		>
			<label
				htmlFor={fieldId}
				className="mb-[9px] block font-bold text-[10.5px] text-foreground/68 uppercase leading-none tracking-[0.19em]"
			>
				{label}
			</label>
			{children(fieldId)}
		</div>
	);
}
