// The booking section: the pitch, three promises, the phone and email pills, and the visit request card.
// LandingPage renders it last, before the footer. Nothing here posts data: the actions are mailto and tel links.
import { EnvelopeSimpleIcon, PhoneIcon } from "@phosphor-icons/react";
import type { TranslationKey } from "~/shared/i18n";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { DISPLAY, TAG, WRAP } from "../lib/styles";
import { VisitRequestCard } from "./visit-request-card";

const BOOK_POINTS: readonly TranslationKey[] = [
	"book.point1",
	"book.point2",
	"book.point3",
];

/** Two columns from 1024px: the copy at the start, the card at the end. */
export function BookSection() {
	const { t } = useT();
	return (
		<section
			id="book"
			aria-labelledby="book-title"
			className="relative scroll-mt-24 overflow-clip py-[clamp(4rem,8vw,7rem)]"
		>
			<div
				className={cn(
					WRAP,
					"grid items-start gap-[clamp(2.6rem,5vw,4.5rem)] lg:grid-cols-[0.95fr_1.05fr]",
				)}
			>
				<div data-pop="kids">
					<p
						className={cn(TAG, "mb-5 rotate-2 bg-(--gd-teal) text-background")}
					>
						{t("book.tag")}
					</p>
					<h2
						id="book-title"
						className={cn(
							DISPLAY,
							"mb-4.5 text-balance text-[clamp(2.3rem,4.6vw,3.9rem)] leading-[1.02]",
						)}
					>
						{t("book.title")}
					</h2>
					<p className="mb-6 max-w-[62ch] font-bold text-foreground/72 leading-relaxed">
						{t("book.body")}
					</p>
					<ul className="mb-8 grid gap-3.5">
						{BOOK_POINTS.map((pointKey) => (
							<li
								key={pointKey}
								className="flex items-baseline gap-3 font-bold"
							>
								<span
									aria-hidden="true"
									className="gd-outline-thin inline-flex size-6.5 shrink-0 translate-y-1 items-center justify-center rounded-full bg-(--gd-teal) font-extrabold text-[0.85rem] text-background"
								>
									✓
								</span>
								<span>{t(pointKey)}</span>
							</li>
						))}
					</ul>
					<div className="flex flex-wrap gap-4">
						<a
							href={t("site.phoneHref")}
							className="gd-btn gap-2 bg-card px-[1.1em] font-bold font-display text-[0.95rem]"
						>
							<PhoneIcon className="size-4.5" />
							{t("site.phoneDisplay")}
						</a>
						<a
							href={t("site.emailHref")}
							className="gd-btn gap-2 bg-card px-[1.1em] font-bold font-display text-[0.95rem]"
						>
							<EnvelopeSimpleIcon className="size-4.5" />
							{t("site.email")}
						</a>
					</div>
				</div>
				<VisitRequestCard />
			</div>
		</section>
	);
}
