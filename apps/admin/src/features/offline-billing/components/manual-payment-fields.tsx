/**
 * Payment fields of the "Record top-up" dialog: method, amount, currency, reference, note.
 * Called by RecordTopupDialog. Uses the offline billing labels and the minor-unit converter.
 */
import { preferredPaymentMethodSchema } from "@wandit/contracts";

import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
	amountToMinorUnits,
	MANUAL_PAYMENT_CURRENCIES,
	MANUAL_PAYMENT_METHOD_LABELS,
	type RecordTopupFormInput,
} from "@/features/offline-billing/lib/offline-billing";

type ManualPaymentFieldsProps = {
	idPrefix: string;
	value: RecordTopupFormInput;
	onChange: (value: RecordTopupFormInput) => void;
	submitted: boolean;
	disabled?: boolean;
};

export function ManualPaymentFields({
	idPrefix,
	value,
	onChange,
	submitted,
	disabled = false,
}: ManualPaymentFieldsProps) {
	const amountMinor = amountToMinorUnits(value.majorAmount, value.currency);
	// A top-up always receives money, so zero is not a valid amount.
	const amountIsValid = amountMinor !== null && amountMinor > 0;

	function update<Key extends keyof RecordTopupFormInput>(
		key: Key,
		nextValue: RecordTopupFormInput[Key],
	) {
		onChange({ ...value, [key]: nextValue });
	}

	return (
		<div className="grid gap-5 sm:grid-cols-2">
			<Field>
				<FieldLabel htmlFor={`${idPrefix}-method`}>Payment method</FieldLabel>
				<Select
					value={value.method}
					onValueChange={(method) =>
						update("method", preferredPaymentMethodSchema.parse(method))
					}
					disabled={disabled}
				>
					<SelectTrigger id={`${idPrefix}-method`} className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{/* SlickPay is not in the list: SlickPay payments record their own receipts. */}
						{preferredPaymentMethodSchema.options.map((method) => (
							<SelectItem key={method} value={method}>
								{MANUAL_PAYMENT_METHOD_LABELS[method]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</Field>

			<div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
				<Field data-invalid={submitted && !amountIsValid}>
					<FieldLabel htmlFor={`${idPrefix}-amount`}>Amount</FieldLabel>
					<Input
						id={`${idPrefix}-amount`}
						type="number"
						inputMode="decimal"
						min={0.01}
						max={10_000_000}
						step={0.01}
						value={value.majorAmount}
						onChange={(event) => update("majorAmount", event.target.value)}
						disabled={disabled}
						aria-invalid={submitted && !amountIsValid}
						placeholder="0.00"
					/>
					<FieldError>
						{submitted && !amountIsValid
							? "Enter an amount above zero, up to 10,000,000."
							: null}
					</FieldError>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${idPrefix}-currency`}>Currency</FieldLabel>
					<Select
						value={value.currency}
						onValueChange={(currency) => update("currency", currency)}
						disabled={disabled}
					>
						<SelectTrigger id={`${idPrefix}-currency`} className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{MANUAL_PAYMENT_CURRENCIES.map((currency) => (
								<SelectItem key={currency} value={currency}>
									{currency}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>
			</div>

			<Field>
				<FieldLabel htmlFor={`${idPrefix}-reference`}>
					Reference
					<span className="font-normal text-muted-foreground"> (optional)</span>
				</FieldLabel>
				<Input
					id={`${idPrefix}-reference`}
					value={value.reference}
					onChange={(event) => update("reference", event.target.value)}
					disabled={disabled}
					maxLength={120}
					placeholder="Receipt, transfer, or CCP reference"
				/>
				<FieldDescription>Recorded with this payment.</FieldDescription>
			</Field>

			<Field>
				<FieldLabel htmlFor={`${idPrefix}-note`}>
					Payment note
					<span className="font-normal text-muted-foreground"> (optional)</span>
				</FieldLabel>
				<Textarea
					id={`${idPrefix}-note`}
					value={value.note}
					onChange={(event) => update("note", event.target.value)}
					disabled={disabled}
					maxLength={1000}
					placeholder="Collection or reconciliation details"
					className="min-h-20"
				/>
			</Field>
		</div>
	);
}
