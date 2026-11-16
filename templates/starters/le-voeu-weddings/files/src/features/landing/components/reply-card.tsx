// The reply card, the showpiece of the home page: a mount-white card with two gold frames that draw themselves on the scroll.
// ReplySection renders it. The card carries data-scrub="card", and landing.css draws the frames, the ampersand, and the fields from --voeu-scrub.
// It posts no data. The fields stay in local state and write the body of a "mailto:" link. STARTER.md says how to make it a real form.
import { useState } from "react";
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { settleOrder } from "../lib/settle-order";
import {
	BUTTON,
	H2,
	LABEL_CENTRED,
	TEXT_LINK,
	TEXT_LINK_RULE,
} from "../lib/type-styles";
import { CardField } from "./card-field";
import { CardFrame } from "./card-frame";
import { CardSelect } from "./card-select";

/** The values of the card, as the visitor types them. */
type ReplyFields = {
	names: string;
	phone: string;
	email: string;
	date: string;
	/** Index in PLACE_KEYS. */
	placeIndex: number;
	/** Index in GUEST_KEYS. */
	guestsIndex: number;
	matters: string;
};

/** The places the studio works in. The last one is for a couple with no venue yet. */
const PLACE_KEYS: readonly TranslationKey[] = [
	"reply.placeAlgiers",
	"reply.placeTipaza",
	"reply.placeBlida",
	"reply.placeBoumerdes",
	"reply.placeUndecided",
];

/** Guest ranges, from 60 to 400: the sizes the studio takes on. */
const GUEST_KEYS: readonly TranslationKey[] = [
	"reply.guests60",
	"reply.guests120",
	"reply.guests200",
	"reply.guests300",
];

/** The card is empty at first. The two choices start on Algiers and 60 to 120 guests. */
const EMPTY_FIELDS: ReplyFields = {
	names: "",
	phone: "",
	email: "",
	date: "",
	placeIndex: 0,
	guestsIndex: 0,
	matters: "",
};

/** The card. The send link holds what the fields show. It opens the email only when the names and telephone have a value. */
export function ReplyCard() {
	const { t } = useT();
	const [fields, setFields] = useState<ReplyFields>(EMPTY_FIELDS);
	// True after a click on "Send" with an empty name or telephone. The alert then stays until both have a value.
	const [hasTriedToSend, setHasTriedToSend] = useState(false);
	// The studio calls the couple back, so the card needs at least the names and a telephone.
	const isMissingContact =
		fields.names.trim() === "" || fields.phone.trim() === "";
	const update = <Name extends keyof ReplyFields>(
		name: Name,
		value: ReplyFields[Name],
	) => setFields((current) => ({ ...current, [name]: value }));

	const placeKey = PLACE_KEYS[fields.placeIndex] ?? "reply.placeUndecided";
	const guestsKey = GUEST_KEYS[fields.guestsIndex] ?? "reply.guests60";
	// The email repeats each label with its value. The visitor reads it once more before sending.
	const mailBody = [
		t("reply.mailGreeting"),
		"",
		`${t("reply.namesLabel")}: ${fields.names}`,
		`${t("reply.phoneLabel")}: ${fields.phone}`,
		`${t("reply.emailLabel")}: ${fields.email}`,
		`${t("reply.dateLabel")}: ${fields.date}`,
		`${t("reply.placeLabel")}: ${t(placeKey)}`,
		`${t("reply.guestsLabel")}: ${t(guestsKey)}`,
		`${t("reply.mattersLabel")}: ${fields.matters}`,
	].join("\n");
	const mailHref = `${t("site.emailHref")}?subject=${encodeURIComponent(t("reply.mailSubject"))}&body=${encodeURIComponent(mailBody)}`;

	return (
		<div
			data-scrub="card"
			className="relative mx-auto max-w-[790px] bg-card px-[clamp(22px,3.4vw,58px)] py-[clamp(30px,4vw,60px)]"
		>
			<CardFrame inset={0} delay={0} />
			<CardFrame inset={6} delay={0.07} />
			<div className="relative text-center">
				<p
					aria-hidden="true"
					className="voeu-card-amp mb-[10px] font-display text-[clamp(3rem,5.4vw,4.4rem)] text-primary leading-[0.8]"
				>
					&amp;
				</p>
				<p
					style={settleOrder(0)}
					className={`${LABEL_CENTRED} voeu-card-settle`}
				>
					{t("reply.label")}
				</p>
				<h2
					id="reply-title"
					style={settleOrder(1)}
					className={cn(
						H2,
						"voeu-card-settle mt-4 text-[clamp(1.9rem,3.4vw,2.8rem)] leading-[1.08]",
					)}
				>
					{t("reply.title")}
				</h2>
				<p
					style={settleOrder(2)}
					className="voeu-card-settle mx-auto mt-4 max-w-[44ch] text-pretty text-[0.97rem] text-foreground/78 leading-[1.74]"
				>
					{t("reply.lede")}
				</p>
			</div>
			<div className="relative mt-[clamp(18px,2.4vw,30px)] grid sm:grid-cols-2 sm:gap-x-[clamp(18px,2.4vw,32px)]">
				<CardField label={t("reply.namesLabel")} order={3}>
					{(fieldId) => (
						<input
							id={fieldId}
							type="text"
							autoComplete="name"
							placeholder={t("reply.namesPlaceholder")}
							value={fields.names}
							onChange={(event) => update("names", event.target.value)}
							className="voeu-field"
						/>
					)}
				</CardField>
				<CardField label={t("reply.phoneLabel")} order={4}>
					{(fieldId) => (
						<input
							id={fieldId}
							type="tel"
							inputMode="tel"
							autoComplete="tel"
							placeholder={t("reply.phonePlaceholder")}
							value={fields.phone}
							onChange={(event) => update("phone", event.target.value)}
							className="voeu-field"
						/>
					)}
				</CardField>
				<CardField label={t("reply.emailLabel")} order={5}>
					{(fieldId) => (
						<input
							id={fieldId}
							type="email"
							autoComplete="email"
							placeholder={t("reply.emailPlaceholder")}
							value={fields.email}
							onChange={(event) => update("email", event.target.value)}
							className="voeu-field"
						/>
					)}
				</CardField>
				<CardField label={t("reply.dateLabel")} order={6}>
					{(fieldId) => (
						<input
							id={fieldId}
							type="text"
							placeholder={t("reply.datePlaceholder")}
							value={fields.date}
							onChange={(event) => update("date", event.target.value)}
							className="voeu-field"
						/>
					)}
				</CardField>
				<CardField label={t("reply.placeLabel")} order={7}>
					{(fieldId) => (
						<CardSelect
							fieldId={fieldId}
							optionKeys={PLACE_KEYS}
							selectedIndex={fields.placeIndex}
							onSelect={(index) => update("placeIndex", index)}
						/>
					)}
				</CardField>
				<CardField label={t("reply.guestsLabel")} order={8}>
					{(fieldId) => (
						<CardSelect
							fieldId={fieldId}
							optionKeys={GUEST_KEYS}
							selectedIndex={fields.guestsIndex}
							onSelect={(index) => update("guestsIndex", index)}
						/>
					)}
				</CardField>
				<CardField label={t("reply.mattersLabel")} order={9} isWide>
					{(fieldId) => (
						<textarea
							id={fieldId}
							rows={3}
							placeholder={t("reply.mattersPlaceholder")}
							value={fields.matters}
							onChange={(event) => update("matters", event.target.value)}
							className="voeu-field"
						/>
					)}
				</CardField>
			</div>
			<div
				style={settleOrder(10)}
				className="voeu-card-settle relative mt-9 flex flex-wrap items-center gap-x-6 gap-y-4"
			>
				<a
					href={mailHref}
					onClick={(event) => {
						if (isMissingContact) {
							event.preventDefault();
							setHasTriedToSend(true);
						}
					}}
					className={cn(BUTTON, "max-sm:w-full")}
				>
					{t("reply.send")}
				</a>
				<a href={t("site.phoneHref")} className={TEXT_LINK}>
					<span className={TEXT_LINK_RULE}>{t("reply.orCall")}</span>
				</a>
				{hasTriedToSend && isMissingContact ? (
					<p
						role="alert"
						className="basis-full font-bold text-(--voeu-rose-deep) text-[0.86rem] leading-[1.6]"
					>
						{t("reply.missingFields")}
					</p>
				) : null}
				<p className="basis-full text-pretty text-[0.86rem] text-foreground/72 leading-[1.7] sm:max-w-[52ch]">
					{t("reply.sendNote")}
				</p>
			</div>
		</div>
	);
}
