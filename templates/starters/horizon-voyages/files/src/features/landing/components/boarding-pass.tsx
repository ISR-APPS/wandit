// The quote request drawn as a boarding pass: a stub with two holes, three choices, a live request code, and a tear rule.
// QuoteSection renders it. It posts no data: the ticket is a "mailto:" link with the request written in the body.
// STARTER.md says how to replace it with a real form that follows the public form contract.
import { MinusIcon, PlusIcon } from "@phosphor-icons/react";
import { useId, useState } from "react";
import { type TranslationKey, useT } from "~/shared/i18n";
import { CaretDownIcon } from "~/shared/ui/icons";
import { CIRCUITS } from "../lib/circuits";
import { FIGURE, META_SMALL } from "../lib/type-styles";
import { TicketLink } from "./ticket-link";

/** One choice of a select: its text and the short code that the request code shows. */
type PassOption = {
	labelKey: TranslationKey;
	codeKey: TranslationKey;
};

/** The circuits of the page, then the two circuits that the agency sells on request. Codes are airport codes. */
const CIRCUIT_OPTIONS: readonly PassOption[] = [
	...CIRCUITS.map((circuit) => ({
		labelKey: circuit.nameKey,
		codeKey: circuit.codeKey,
	})),
	{
		labelKey: "quote.circuitOptions.tassili",
		codeKey: "quote.circuitCodes.tassili",
	},
	{
		labelKey: "quote.circuitOptions.custom",
		codeKey: "quote.circuitCodes.custom",
	},
];

/** The next four seasons, then "not sure yet". */
const PERIOD_OPTIONS: readonly PassOption[] = [
	{
		labelKey: "quote.periodOptions.winter",
		codeKey: "quote.periodCodes.winter",
	},
	{
		labelKey: "quote.periodOptions.spring",
		codeKey: "quote.periodCodes.spring",
	},
	{
		labelKey: "quote.periodOptions.summer",
		codeKey: "quote.periodCodes.summer",
	},
	{
		labelKey: "quote.periodOptions.autumn",
		codeKey: "quote.periodCodes.autumn",
	},
	{ labelKey: "quote.periodOptions.open", codeKey: "quote.periodCodes.open" },
];

/** The agency takes eight travellers per departure, not nine. */
const MAX_TRAVELLERS = 8;

/** Underlined select with a capital label above it. The value is the index of the choice. */
const SELECT_CLASS =
	"h-12 w-full cursor-pointer appearance-none truncate border-(--hz-hair-strong) border-b bg-transparent py-0 pe-7 text-[15.5px] text-foreground transition-colors duration-200 hover:border-(--hz-sun-deep) focus:border-(--hz-sun-deep) focus:outline-none";

/** The boarding pass. Each choice changes the request code and the email body at once. */
export function BoardingPass() {
	const { t } = useT();
	const circuitId = useId();
	const periodId = useId();
	const [circuitIndex, setCircuitIndex] = useState(0);
	const [periodIndex, setPeriodIndex] = useState(0);
	const [travellers, setTravellers] = useState(2);
	// The select values are indexes of these lists, so a lookup finds an option. The ternaries below satisfy the index type.
	const circuit = CIRCUIT_OPTIONS[circuitIndex];
	const period = PERIOD_OPTIONS[periodIndex];
	const paxCode = `${String(travellers).padStart(2, "0")} ${t("quote.paxUnit")}`;
	const requestCode = [
		t("site.ticketCode"),
		circuit ? t(circuit.codeKey) : "",
		paxCode,
		period ? t(period.codeKey) : "",
	].join(" · ");
	// The visitor completes the name and the telephone in the email. "%0A" is a line break in a mailto body.
	const mailBody = [
		`${t("quote.mailCode")} ${requestCode}`,
		`${t("quote.mailCircuit")} ${circuit ? t(circuit.labelKey) : ""}`,
		`${t("quote.mailPeriod")} ${period ? t(period.labelKey) : ""}`,
		`${t("quote.mailTravellers")} ${travellers}`,
		`${t("quote.mailName")} `,
		`${t("quote.mailPhone")} `,
	]
		.map((line) => encodeURIComponent(line))
		.join("%0A");
	const mailHref = `${t("site.emailHref")}?subject=${encodeURIComponent(t("quote.mailSubject"))}&body=${mailBody}`;
	return (
		<div className="hz-pass">
			<div className="hz-pass-stub" aria-hidden="true">
				<span className="hz-pass-hole" />
				<span className="hz-pass-stub-code font-semibold text-(--hz-ink-soft) text-[10px] uppercase tracking-[0.24em]">
					{t("quote.stub")}
				</span>
				<span className="hz-pass-hole" />
			</div>
			<div className="p-[clamp(22px,3vw,38px)]">
				<p className={`${META_SMALL} mb-6`}>{t("quote.passLabel")}</p>
				<div className="grid gap-x-[26px] gap-y-[22px] min-[640px]:grid-cols-2">
					<div className="grid min-w-0 content-start gap-2 min-[640px]:col-span-2">
						<label htmlFor={circuitId} className={META_SMALL}>
							{t("quote.circuitField")}
						</label>
						<div className="relative">
							<select
								id={circuitId}
								value={circuitIndex}
								onChange={(event) =>
									setCircuitIndex(Number(event.target.value))
								}
								className={SELECT_CLASS}
							>
								{CIRCUIT_OPTIONS.map((option, index) => (
									<option key={option.labelKey} value={index}>
										{t(option.labelKey)}
									</option>
								))}
							</select>
							<CaretDownIcon className="pointer-events-none absolute end-1 top-1/2 size-3.5 -translate-y-1/2 text-(--hz-ink-soft)" />
						</div>
					</div>
					<div className="grid min-w-0 content-start gap-2">
						<label htmlFor={periodId} className={META_SMALL}>
							{t("quote.periodField")}
						</label>
						<div className="relative">
							<select
								id={periodId}
								value={periodIndex}
								onChange={(event) => setPeriodIndex(Number(event.target.value))}
								className={SELECT_CLASS}
							>
								{PERIOD_OPTIONS.map((option, index) => (
									<option key={option.labelKey} value={index}>
										{t(option.labelKey)}
									</option>
								))}
							</select>
							<CaretDownIcon className="pointer-events-none absolute end-1 top-1/2 size-3.5 -translate-y-1/2 text-(--hz-ink-soft)" />
						</div>
					</div>
					<fieldset className="m-0 min-w-0 border-0 p-0">
						<legend className={`${META_SMALL} mb-2 p-0`}>
							{t("quote.travellersField")}
						</legend>
						<div className="flex h-12 items-center justify-between border-(--hz-hair-strong) border-b">
							<button
								type="button"
								aria-label={t("quote.fewer")}
								disabled={travellers <= 1}
								onClick={() => setTravellers((count) => Math.max(1, count - 1))}
								className="hz-step-button"
							>
								<MinusIcon aria-hidden="true" className="size-4" />
							</button>
							<output
								aria-live="polite"
								className={`${FIGURE} text-[1.35rem] tabular-nums`}
							>
								{travellers}
							</output>
							<button
								type="button"
								aria-label={t("quote.more")}
								disabled={travellers >= MAX_TRAVELLERS}
								onClick={() =>
									setTravellers((count) => Math.min(MAX_TRAVELLERS, count + 1))
								}
								className="hz-step-button"
							>
								<PlusIcon aria-hidden="true" className="size-4" />
							</button>
						</div>
						<p className="mt-2 text-(--hz-ink-soft) text-[12.5px] leading-[1.5]">
							{t("quote.travellersHint")}
						</p>
					</fieldset>
				</div>
				<div className="mt-7 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-(--hz-hair) border-t pt-4">
					<span className={META_SMALL}>{t("quote.codeLabel")}</span>
					<output
						aria-live="polite"
						className={`${FIGURE} text-[clamp(1.05rem,1.7vw,1.35rem)] tabular-nums tracking-[0.04em]`}
					>
						{requestCode}
					</output>
				</div>
				<div aria-hidden="true" className="hz-tear mt-6 mb-6" />
				<div className="flex flex-wrap items-center gap-x-5 gap-y-3">
					<TicketLink href={mailHref} code={t("site.ticketCode")}>
						{t("quote.send")}
					</TicketLink>
					<p className={META_SMALL}>{t("quote.sendHint")}</p>
				</div>
				<p className="mt-5 max-w-[48ch] text-(--hz-ink-soft) text-[13px] leading-[1.55]">
					{t("quote.privacy")}
				</p>
			</div>
		</div>
	);
}
