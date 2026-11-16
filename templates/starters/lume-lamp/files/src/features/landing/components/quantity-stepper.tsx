// The quantity control of the reserve section: minus, the number, plus. No number input.
// ReserveSection renders it and holds the quantity. The cap and its reason come from lib/offer.ts and the hint.
import { MinusIcon, PlusIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import { MAX_QUANTITY } from "../lib/offer";
import { MICRO } from "../lib/type-styles";

type QuantityStepperProps = {
	/** Lamps chosen, from 1 to MAX_QUANTITY. */
	quantity: number;
	onQuantityChange: (quantity: number) => void;
};

const STEP_BUTTON =
	"lume-step grid size-11 cursor-pointer place-items-center rounded-full text-[1.1rem]";

/** A pill with two 44px round buttons. A button that would leave the range is disabled. */
export function QuantityStepper({
	quantity,
	onQuantityChange,
}: QuantityStepperProps) {
	const { t } = useT();
	return (
		<fieldset className="mb-8">
			<legend className={`${MICRO} mb-[0.6rem]`}>
				{t("reserve.quantity")}
			</legend>
			<div className="inline-flex items-center rounded-full border border-foreground/16 bg-card/55">
				<button
					type="button"
					className={STEP_BUTTON}
					aria-label={t("reserve.decrease")}
					disabled={quantity <= 1}
					onClick={() => onQuantityChange(quantity - 1)}
				>
					<MinusIcon />
				</button>
				<output
					aria-live="polite"
					className="min-w-[2.6rem] text-center font-display font-medium text-[1.25rem] tabular-nums"
				>
					{quantity}
				</output>
				<button
					type="button"
					className={STEP_BUTTON}
					aria-label={t("reserve.increase")}
					disabled={quantity >= MAX_QUANTITY}
					onClick={() => onQuantityChange(quantity + 1)}
				>
					<PlusIcon />
				</button>
			</div>
			<p className="mt-[0.55rem] text-[0.78rem] text-foreground/52">
				{t("reserve.quantityHint")}
			</p>
		</fieldset>
	);
}
