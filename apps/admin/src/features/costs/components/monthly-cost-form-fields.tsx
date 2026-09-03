import { PlusIcon, Trash2Icon } from "lucide-react";
import { type Dispatch, type SetStateAction, useId } from "react";
import type { ZodError } from "zod";

import { Button } from "@/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
	formIssueMessage,
	type MonthlyCostFormValues,
	type SourceSpendFormRow,
	SUGGESTED_COST_SOURCE_KEYS,
} from "@/features/costs/lib/monthly-cost-form";

type MonthlyCostFormFieldsProps = {
	isEditing: boolean;
	values: MonthlyCostFormValues;
	formError: ZodError | null;
	setValues: Dispatch<SetStateAction<MonthlyCostFormValues>>;
};

export function MonthlyCostFormFields({
	isEditing,
	values,
	formError,
	setValues,
}: MonthlyCostFormFieldsProps) {
	const monthError = formError
		? formIssueMessage(formError, ["month"])
		: undefined;
	const infrastructureError = formError
		? (formIssueMessage(formError, ["infrastructureDollars"]) ??
			formIssueMessage(formError, ["infrastructureCostCents"]))
		: undefined;
	const otherError = formError
		? (formIssueMessage(formError, ["otherDollars"]) ??
			formIssueMessage(formError, ["otherCostCents"]))
		: undefined;

	return (
		<FieldGroup className="gap-6">
			<Field data-invalid={Boolean(monthError)}>
				<FieldLabel htmlFor="monthly-cost-month">Month</FieldLabel>
				<Input
					id="monthly-cost-month"
					type="month"
					value={values.month}
					disabled={isEditing}
					onChange={(event) =>
						setValues((current) => ({
							...current,
							month: event.target.value,
						}))
					}
					autoFocus={!isEditing}
					aria-invalid={Boolean(monthError)}
				/>
				<FieldDescription>
					The month cannot change after it is created.
				</FieldDescription>
				<FieldError>{monthError}</FieldError>
			</Field>

			<SourceSpendFields
				rows={values.sourceRows}
				formError={formError}
				onChange={(sourceRows) =>
					setValues((current) => ({ ...current, sourceRows }))
				}
			/>

			<div className="grid gap-5 sm:grid-cols-2">
				<MoneyField
					id="monthly-cost-infrastructure"
					label="Infrastructure (USD)"
					value={values.infrastructureDollars}
					error={infrastructureError}
					onChange={(infrastructureDollars) =>
						setValues((current) => ({
							...current,
							infrastructureDollars,
						}))
					}
					description="Include hosting, infrastructure, and AI-provider spend."
				/>
				<MoneyField
					id="monthly-cost-other"
					label="Other costs (USD)"
					value={values.otherDollars}
					error={otherError}
					onChange={(otherDollars) =>
						setValues((current) => ({ ...current, otherDollars }))
					}
				/>
			</div>

			<Field>
				<FieldLabel htmlFor="monthly-cost-notes">
					Notes{" "}
					<span className="font-normal text-muted-foreground">(optional)</span>
				</FieldLabel>
				<Textarea
					id="monthly-cost-notes"
					value={values.notes}
					onChange={(event) =>
						setValues((current) => ({
							...current,
							notes: event.target.value,
						}))
					}
					placeholder="Annual contract true-up, campaign launch…"
				/>
			</Field>
		</FieldGroup>
	);
}

type SourceSpendFieldsProps = {
	rows: SourceSpendFormRow[];
	formError: ZodError | null;
	onChange: (rows: SourceSpendFormRow[]) => void;
};

function SourceSpendFields({
	rows,
	formError,
	onChange,
}: SourceSpendFieldsProps) {
	const suggestionsId = useId();

	function updateRow(
		rowId: string,
		field: "source" | "dollars",
		value: string,
	) {
		onChange(
			rows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)),
		);
	}

	return (
		<div className="flex flex-col gap-3 rounded-lg border p-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex flex-col gap-1">
					<p className="font-medium text-sm">Ad spend by source</p>
					<p className="text-muted-foreground text-xs leading-relaxed">
						Choose a suggested acquisition key or enter a lowercase utm_source.
						Free text is allowed.
					</p>
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() =>
						onChange([
							...rows,
							{ id: crypto.randomUUID(), source: "", dollars: "" },
						])
					}
				>
					<PlusIcon aria-hidden="true" />
					Add source
				</Button>
			</div>

			<datalist id={suggestionsId}>
				{SUGGESTED_COST_SOURCE_KEYS.map((source) => (
					<option key={source} value={source} />
				))}
			</datalist>

			{rows.length === 0 ? (
				<p className="rounded-md bg-muted/40 px-3 py-2 text-muted-foreground text-sm">
					No source spend. Add a row when this month includes ad spend.
				</p>
			) : (
				<div className="flex flex-col gap-3">
					{rows.map((row, index) => (
						<SourceSpendRow
							key={row.id}
							row={row}
							index={index}
							suggestionsId={suggestionsId}
							sourceError={
								formError
									? formIssueMessage(formError, ["sourceRows", index, "source"])
									: undefined
							}
							dollarsError={
								formError
									? formIssueMessage(formError, [
											"sourceRows",
											index,
											"dollars",
										])
									: undefined
							}
							onUpdate={updateRow}
							onRemove={(rowId) =>
								onChange(rows.filter((candidate) => candidate.id !== rowId))
							}
						/>
					))}
				</div>
			)}
		</div>
	);
}

type SourceSpendRowProps = {
	row: SourceSpendFormRow;
	index: number;
	suggestionsId: string;
	sourceError?: string;
	dollarsError?: string;
	onUpdate: (rowId: string, field: "source" | "dollars", value: string) => void;
	onRemove: (rowId: string) => void;
};

function SourceSpendRow({
	row,
	index,
	suggestionsId,
	sourceError,
	dollarsError,
	onUpdate,
	onRemove,
}: SourceSpendRowProps) {
	return (
		<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_auto] sm:items-start">
			<Field data-invalid={Boolean(sourceError)}>
				<FieldLabel htmlFor={`cost-source-${row.id}`}>Source key</FieldLabel>
				<Input
					id={`cost-source-${row.id}`}
					list={suggestionsId}
					value={row.source}
					onChange={(event) => onUpdate(row.id, "source", event.target.value)}
					placeholder="google"
					aria-invalid={Boolean(sourceError)}
				/>
				<FieldError>{sourceError}</FieldError>
			</Field>
			<Field data-invalid={Boolean(dollarsError)}>
				<FieldLabel htmlFor={`cost-source-spend-${row.id}`}>
					Spend (USD)
				</FieldLabel>
				<Input
					id={`cost-source-spend-${row.id}`}
					type="number"
					inputMode="decimal"
					min={0}
					step="0.01"
					value={row.dollars}
					onChange={(event) => onUpdate(row.id, "dollars", event.target.value)}
					placeholder="0.00"
					aria-invalid={Boolean(dollarsError)}
				/>
				<FieldError>{dollarsError}</FieldError>
			</Field>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="sm:mt-6"
				onClick={() => onRemove(row.id)}
				aria-label={`Remove source row ${index + 1}`}
			>
				<Trash2Icon aria-hidden="true" />
			</Button>
		</div>
	);
}

type MoneyFieldProps = {
	id: string;
	label: string;
	value: string;
	error?: string;
	description?: string;
	onChange: (value: string) => void;
};

function MoneyField({
	id,
	label,
	value,
	error,
	description,
	onChange,
}: MoneyFieldProps) {
	return (
		<Field data-invalid={Boolean(error)}>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Input
				id={id}
				type="number"
				inputMode="decimal"
				min={0}
				step="0.01"
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder="0.00"
				aria-invalid={Boolean(error)}
			/>
			{description ? <FieldDescription>{description}</FieldDescription> : null}
			<FieldError>{error}</FieldError>
		</Field>
	);
}
