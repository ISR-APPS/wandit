import { Button } from "@wandit/ui/components/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@wandit/ui/components/command";
import { Input } from "@wandit/ui/components/input";
import { Label } from "@wandit/ui/components/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@wandit/ui/components/popover";
import { cn } from "@wandit/ui/lib/utils";
import * as CountryFlags from "country-flag-icons/react/3x2";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { type FormEvent, useMemo, useRef, useState } from "react";

import {
	composePhoneAnswer,
	type DialCountry,
	detectDialCountry,
	dialCountries,
	dialCountryDisplayName,
	foldArabicDigits,
	internationalDigitsOf,
	isCompletePhoneAnswer,
	splitPhoneAnswer,
} from "../lib/dial-codes";

// cmdk's default scorer does no diacritic folding, so "algerie" would never
// find "Algérie" — a first-class case for the fr locale. Plain folded
// substring match is right for a 240-entry country list.
function foldDiacritics(value: string): string {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase();
}

function countryFilter(value: string, search: string): number {
	return foldDiacritics(value).includes(foldDiacritics(search)) ? 1 : 0;
}

type PhoneStepProps = {
	value: string;
	label: string;
	nextLabel: string;
	countryLabel: string;
	searchPlaceholder: string;
	emptyLabel: string;
	placeholder?: string;
	locale: string;
	onChange: (value: string) => void;
	/** Receives the composed E.164 answer, so a submit in the same tick as
	 * the last keystroke can never advance with a stale parent value. */
	onSubmit: (value: string) => void;
	disabled?: boolean;
	inputId?: string;
};

// Every listed country renders its flag, so tree shaking has nothing to drop;
// the record form also keeps lookups by arbitrary ISO code type-safe.
const flagByIso: Partial<Record<string, CountryFlags.FlagComponent>> = {
	...CountryFlags,
};

/** SVG flag at its native 3:2 ratio in a rounded rectangle, so no design is
 * cropped away (emoji flags are banned — Windows renders them as bare
 * letters, see components/language-flags.tsx). A code without a flag asset
 * falls back to its two ISO letters. */
function CountryFlag({ iso }: { iso: string }) {
	const Flag = flagByIso[iso];

	return (
		<span
			aria-hidden
			dir="ltr"
			className="inline-flex h-4 w-6 shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-muted ring-1 ring-border"
		>
			{Flag ? (
				// size-full exactly fills the 3:2 box and opts the svg out of
				// CommandItem's blanket size-4 rule.
				<Flag className="size-full" />
			) : (
				<span className="font-semibold text-[8px] text-muted-foreground tracking-wide">
					{iso}
				</span>
			)}
		</span>
	);
}

export function PhoneStep({
	value,
	label,
	nextLabel,
	countryLabel,
	searchPlaceholder,
	emptyLabel,
	placeholder,
	locale,
	onChange,
	onSubmit,
	disabled = false,
	inputId = "onboarding-phone-answer",
}: PhoneStepProps) {
	// The stored answer is one E.164 string; the split restores country and
	// national number when the user navigates back to this step.
	const [country, setCountry] = useState<DialCountry>(
		() => splitPhoneAnswer(value)?.country ?? detectDialCountry(),
	);
	const [national, setNational] = useState(
		() => splitPhoneAnswer(value)?.national ?? "",
	);
	const [pickerOpen, setPickerOpen] = useState(false);
	const numberInputRef = useRef<HTMLInputElement>(null);
	const countrySelectedRef = useRef(false);

	const countries = useMemo(() => {
		const collator = new Intl.Collator(locale);
		return dialCountries
			.map((entry) => ({
				...entry,
				name: dialCountryDisplayName(entry.iso, locale),
			}))
			.sort((a, b) => collator.compare(a.name, b.name));
	}, [locale]);

	// While the field holds an in-progress international entry ("+2…" with no
	// dial code matched yet), there is no answer — never prefix those digits.
	const pendingInternational = internationalDigitsOf(national) !== undefined;
	const composed = pendingInternational
		? ""
		: composePhoneAnswer(country, national);
	const complete = isCompletePhoneAnswer(composed);

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (disabled || !complete) return;
		onSubmit(composed);
	};

	function selectCountry(next: DialCountry) {
		setCountry(next);
		countrySelectedRef.current = true;
		setPickerOpen(false);
		onChange(composePhoneAnswer(next, national));
	}

	function updateNational(raw: string) {
		// Input in full international form — pasted "+213 661…" or typed
		// "00213…" — selects the country from its own dial code instead of
		// getting the picked dial code prepended a second time.
		const international = internationalDigitsOf(raw);
		if (international !== undefined) {
			const split = international
				? splitPhoneAnswer(`+${international}`)
				: undefined;
			if (split) {
				setCountry(split.country);
				setNational(split.national);
				onChange(composePhoneAnswer(split.country, split.national));
				return;
			}
			// Dial code still incomplete ("+2") — keep it visible, publish no
			// answer yet.
			setNational(`+${international}`);
			onChange("");
			return;
		}

		// Digits (Latin or Arabic-Indic, folded to ASCII) and spaces only;
		// everything else is dropped as typed so paste artifacts never reach
		// the answer.
		const next = foldArabicDigits(raw).replace(/[^0-9 ]/g, "");
		setNational(next);
		onChange(composePhoneAnswer(country, next));
	}

	return (
		<form onSubmit={submit} className="w-full space-y-5 text-start">
			<div className="space-y-2">
				<Label htmlFor={inputId}>{label}</Label>
				<div className="flex gap-2">
					<Popover open={pickerOpen} onOpenChange={setPickerOpen}>
						<PopoverTrigger asChild>
							<button
								type="button"
								role="combobox"
								aria-expanded={pickerOpen}
								aria-label={countryLabel}
								disabled={disabled}
								className={cn(
									"group/dial flex h-11 shrink-0 items-center gap-2 rounded-xl border border-input bg-card px-3 outline-none transition-[color,box-shadow]",
									"focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
									"disabled:pointer-events-none disabled:opacity-50",
								)}
							>
								<CountryFlag iso={country.iso} />
								<span dir="ltr" className="font-medium text-sm tabular-nums">
									+{country.dial}
								</span>
								<ChevronDownIcon className="size-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]/dial:rotate-180" />
							</button>
						</PopoverTrigger>
						<PopoverContent
							align="start"
							className="w-72 p-0"
							onCloseAutoFocus={(event) => {
								// Radix hands focus back to the trigger on close; after a
								// selection the caret belongs in the number field. Escape
								// and outside dismiss keep the default.
								if (countrySelectedRef.current) {
									countrySelectedRef.current = false;
									event.preventDefault();
									numberInputRef.current?.focus();
								}
							}}
						>
							<Command filter={countryFilter}>
								<CommandInput placeholder={searchPlaceholder} />
								<CommandList>
									<CommandEmpty>{emptyLabel}</CommandEmpty>
									<CommandGroup>
										{countries.map((entry) => (
											<CommandItem
												key={entry.iso}
												// Name, ISO code and dial code all match the cmdk
												// filter, so "Algeria", "DZ" and "+213" each find it.
												value={`${entry.name} ${entry.iso} +${entry.dial}`}
												onSelect={() => selectCountry(entry)}
												className="gap-2.5"
											>
												<CountryFlag iso={entry.iso} />
												<bdi className="flex-1 truncate">{entry.name}</bdi>
												<span
													dir="ltr"
													className="text-muted-foreground text-xs tabular-nums"
												>
													+{entry.dial}
												</span>
												<CheckIcon
													className={cn(
														"size-4 text-primary",
														entry.iso === country.iso
															? "opacity-100"
															: "opacity-0",
													)}
												/>
											</CommandItem>
										))}
									</CommandGroup>
								</CommandList>
							</Command>
						</PopoverContent>
					</Popover>
					<Input
						ref={numberInputRef}
						id={inputId}
						name={inputId}
						type="tel"
						inputMode="tel"
						dir="ltr"
						value={national}
						onChange={(event) => updateNational(event.target.value)}
						placeholder={placeholder}
						autoComplete="tel-national"
						maxLength={20}
						required
						autoFocus
						disabled={disabled}
						className="h-11 rounded-xl bg-card px-4 text-base shadow-none"
					/>
				</div>
			</div>
			<Button
				type="submit"
				size="lg"
				disabled={disabled || !complete}
				className="w-full"
			>
				{nextLabel}
			</Button>
		</form>
	);
}
