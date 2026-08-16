import { Button } from "@wandit/ui/components/button";
import { Input } from "@wandit/ui/components/input";
import { Label } from "@wandit/ui/components/label";
import type { FormEvent } from "react";

type TextStepProps = {
	value: string;
	label: string;
	nextLabel: string;
	placeholder?: string;
	skipLabel?: string;
	optional?: boolean;
	onChange: (value: string) => void;
	onSubmit: () => void;
	onSkip?: () => void;
	disabled?: boolean;
	inputId?: string;
	autoComplete?: string;
	maxLength?: number;
};

export function TextStep({
	value,
	label,
	nextLabel,
	placeholder,
	skipLabel,
	optional = false,
	onChange,
	onSubmit,
	onSkip,
	disabled = false,
	inputId = "onboarding-text-answer",
	autoComplete = "name",
	maxLength = 100,
}: TextStepProps) {
	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (disabled) return;
		if (!value.trim()) {
			if (optional) onSkip?.();
			return;
		}
		onSubmit();
	};

	return (
		<form onSubmit={submit} className="w-full space-y-5 text-start">
			<div className="space-y-2">
				<Label htmlFor={inputId}>{label}</Label>
				<Input
					id={inputId}
					name={inputId}
					type="text"
					dir="auto"
					value={value}
					onChange={(event) => onChange(event.target.value)}
					placeholder={placeholder}
					autoComplete={autoComplete}
					maxLength={maxLength}
					required={!optional}
					autoFocus
					disabled={disabled}
					className="h-11 rounded-xl bg-card px-4 text-base shadow-none"
				/>
			</div>
			<Button
				type="submit"
				size="lg"
				disabled={disabled || (!optional && !value.trim())}
				className="w-full"
			>
				{nextLabel}
			</Button>
			{optional && skipLabel ? (
				<Button
					type="button"
					size="lg"
					variant="ghost"
					disabled={disabled}
					onClick={onSkip}
					className="w-full"
				>
					{skipLabel}
				</Button>
			) : null}
		</form>
	);
}
