// The clip-out coupon of the letters page: a dashed frame with scissors, a coupon number, and the ways to write.
// LettersSection renders it. Each subject opens a mail with that subject; the brick button opens a plain mail.
// It posts no data (a starter has no form table). STARTER.md says where a real form goes.
import { ArrowUpRightIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { LETTER_SUBJECTS } from "../lib/content";
import {
	BUTTON,
	BUTTON_BRICK,
	BUTTON_INK,
	FURNITURE,
} from "../lib/type-styles";

/** The coupon on the deeper stock. Each subject row is a mail link, marked with a brick slug square, not a box. */
export function LettersCoupon() {
	const { t } = useT();
	const mailFor = (subject: string) =>
		`${t("site.emailHref")}?subject=${encodeURIComponent(`${t("letters.mailSubjectPrefix")}${subject}`)}`;
	return (
		<div className="relative border-(--ks-coupon-edge) border-2 border-dashed bg-canvas p-[clamp(1.4rem,3vw,2.2rem)]">
			<span
				aria-hidden="true"
				className="absolute start-6 -top-3.5 bg-linear-to-b from-50% from-background to-50% to-canvas px-2 leading-none"
			>
				<ScissorsGlyph />
			</span>
			<p
				className={cn(
					FURNITURE,
					"absolute end-4 top-3 font-bold text-[0.68rem] text-foreground/70 tracking-[0.12em]",
				)}
			>
				{t("letters.couponNumber")}
			</p>
			<h3 className="mt-3 font-display font-extrabold text-[1.6rem] leading-tight">
				{t("letters.couponTitle")}
			</h3>
			<p className="mt-1 text-pretty text-[0.98rem] text-foreground/80 italic">
				{t("letters.couponDeck")}
			</p>
			<p
				className={cn(
					FURNITURE,
					"mt-6 mb-1 font-bold text-[0.7rem] tracking-[0.12em]",
				)}
			>
				{t("letters.couponSubjects")}
			</p>
			<ul className="grid border-(--ks-rule) border-t min-[640px]:grid-cols-2 min-[640px]:gap-x-6">
				{LETTER_SUBJECTS.map((subjectKey) => (
					<li key={subjectKey} className="border-(--ks-rule) border-b">
						<a
							href={mailFor(t(subjectKey))}
							className="group flex min-h-12 items-center gap-3 py-2.5 transition-colors duration-200 hover:text-primary focus-visible:text-primary"
						>
							<span
								aria-hidden="true"
								className="size-2.25 shrink-0 bg-primary"
							/>
							<span className="flex-1">{t(subjectKey)}</span>
							<ArrowUpRightIcon className="size-4 shrink-0 opacity-55 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 rtl:-scale-x-100" />
						</a>
					</li>
				))}
			</ul>
			<div className="mt-7 flex flex-col gap-3 min-[640px]:flex-row min-[640px]:flex-wrap">
				<a href={t("site.emailHref")} className={cn(BUTTON, BUTTON_BRICK)}>
					{t("letters.couponWrite")}
				</a>
				<a href={t("site.phoneHref")} className={cn(BUTTON, BUTTON_INK)}>
					{t("letters.couponCall")} · {t("site.phoneDisplay")}
				</a>
			</div>
			<p
				className={cn(
					FURNITURE,
					"mt-4 font-medium text-[0.7rem] text-foreground/62 leading-relaxed tracking-[0.08em]",
				)}
			>
				{t("letters.couponNote")}
			</p>
		</div>
	);
}

/** The small drawn scissors that ride the top edge of the coupon. */
function ScissorsGlyph() {
	return (
		<svg
			width="42"
			height="26"
			viewBox="0 0 42 26"
			aria-hidden="true"
			className="text-foreground"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<circle cx="7" cy="7" r="4.5" />
			<circle cx="7" cy="19" r="4.5" />
			<line x1="10.5" y1="9.5" x2="38" y2="17" />
			<line x1="10.5" y1="16.5" x2="38" y2="9" />
		</svg>
	);
}
