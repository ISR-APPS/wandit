// The enrolment section, the fixed closing of the page: the documents to prepare, the address, and the front desk.
// LandingPage renders it last, before the footer. It posts no data: its actions are a tel: link and two mailto: links.
// STARTER.md says where a real application form goes.
import {
	CalendarCheckIcon,
	EnvelopeSimpleIcon,
	PhoneIcon,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { useT } from "~/shared/i18n";
import { BAND, BUTTON, CHIP_CAPS, EYEBROW, H2, WRAP } from "../lib/type-styles";

/** A mailto: link to the academic office, with a subject and an optional body that the mail app fills in. */
function officeMail(email: string, subject: string, body?: string): string {
	const query = new URLSearchParams({ subject });
	if (body !== undefined) {
		query.set("body", body);
	}
	// URLSearchParams writes a space as "+", which mail apps show as is. mailto: needs "%20".
	return `mailto:${email}?${query.toString().replaceAll("+", "%20")}`;
}

/** Two columns from 900px: the checklist on the start side, the white front-desk plate on the end side. */
export function EnrolSection() {
	const { t } = useT();
	const email = t("site.email");
	const pieces = [
		t("enrol.piece1"),
		t("enrol.piece2"),
		t("enrol.piece3"),
		t("enrol.piece4"),
	];
	const channels: {
		icon: ReactNode;
		title: string;
		detail: string;
		action: ReactNode;
	}[] = [
		{
			icon: <PhoneIcon className="size-5" />,
			title: t("enrol.callTitle"),
			detail: t("enrol.callDetail"),
			action: (
				<a
					href={t("site.phoneHref")}
					className={`${BUTTON} cn-btn tabular-nums`}
				>
					{t("site.phoneDisplay")}
				</a>
			),
		},
		{
			icon: <EnvelopeSimpleIcon className="size-5" />,
			title: t("enrol.writeTitle"),
			detail: t("enrol.writeDetail"),
			action: (
				<a
					href={officeMail(
						email,
						t("enrol.writeSubject"),
						t("enrol.writeBody"),
					)}
					className="cn-link inline-flex min-h-11 items-center font-semibold text-[0.9375rem]"
				>
					<span>{t("enrol.writeAction")}</span>
				</a>
			),
		},
		{
			icon: <CalendarCheckIcon className="size-5" />,
			title: t("enrol.visitTitle"),
			detail: t("enrol.visitDetail"),
			action: (
				<a
					href={officeMail(email, t("enrol.visitSubject"))}
					className="cn-link inline-flex min-h-11 items-center font-semibold text-[0.9375rem]"
				>
					<span>{t("enrol.visitAction")}</span>
				</a>
			),
		},
	];
	return (
		<section
			id="enrol"
			aria-labelledby="enrol-title"
			className={`${BAND} bg-(--cn-pale)`}
		>
			<div
				className={`${WRAP} grid items-start gap-[clamp(26px,4vw,60px)] min-[900px]:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]`}
			>
				<div data-stagger="" className="min-w-0">
					<span data-pop="" className={`${EYEBROW} mb-3.5`}>
						{t("enrol.eyebrow")}
					</span>
					<h2 id="enrol-title" data-pop="" className={`${H2} mb-4`}>
						{t("enrol.title")}
					</h2>
					<p
						data-pop=""
						className="text-(--cn-ink-2) text-[0.9375rem] leading-[1.6]"
					>
						{t("enrol.body")}
					</p>
					<p className="mt-[22px] font-semibold text-[0.6875rem] text-muted-foreground uppercase tracking-[0.15em]">
						{t("enrol.piecesLabel")}
					</p>
					<ol className="mt-2.5 border-input border-t">
						{pieces.map((piece, index) => (
							<li
								key={piece}
								data-pop=""
								className="flex gap-3.5 border-input border-b py-[13px] text-[0.9375rem]"
							>
								<span className="flex-none font-bold font-display text-(--cn-sky-deep) text-[0.75rem] tabular-nums leading-[1.6]">
									{String(index + 1).padStart(2, "0")}
								</span>
								<span>{piece}</span>
							</li>
						))}
					</ol>
					<address
						data-pop=""
						className="mt-6 flex flex-wrap gap-2.5 not-italic"
					>
						<span className={`${CHIP_CAPS} bg-card`}>
							{t("enrol.address1")}
						</span>
						<span className={`${CHIP_CAPS} bg-card`}>
							{t("enrol.address2")}
						</span>
						<a
							href={`mailto:${email}`}
							className={`${CHIP_CAPS} min-h-11 border border-input normal-case tracking-[0.02em] hover:border-primary`}
						>
							{email}
						</a>
					</address>
					<p data-pop="" className="cn-r mt-[22px] bg-card px-5 py-[18px]">
						<b className="block font-bold font-display text-[clamp(1.05rem,1.3vw,1.2rem)] tracking-[-0.02em]">
							{t("enrol.walkInTitle")}
						</b>
						<span className="mt-2 block text-(--cn-ink-2) text-[0.875rem] leading-[1.5]">
							{t("enrol.walkInBody")}
						</span>
					</p>
				</div>

				<div
					data-pop=""
					className="cn-r min-w-0 bg-card p-[clamp(22px,2.8vw,36px)]"
				>
					<span className={`${EYEBROW} mb-3`}>{t("enrol.deskEyebrow")}</span>
					<h3 className="font-bold font-display text-[clamp(1.35rem,2vw,1.75rem)] leading-[1.1] tracking-[-0.02em]">
						{t("enrol.deskTitle")}
					</h3>
					<ul className="mt-6 border-border border-t">
						{channels.map((channel) => (
							<li
								key={channel.title}
								className="grid grid-cols-[44px_minmax(0,1fr)] gap-x-4 gap-y-3 border-border border-b py-5 min-[600px]:grid-cols-[44px_minmax(0,1fr)_auto] min-[600px]:items-center"
							>
								<span className="grid size-11 place-items-center rounded-full bg-(--cn-pale) text-(--cn-sky-deep)">
									{channel.icon}
								</span>
								<div className="min-w-0">
									<b className="block font-display font-semibold text-[1.05rem] tracking-[-0.014em]">
										{channel.title}
									</b>
									<span className="mt-1 block text-(--cn-ink-2) text-[0.875rem] leading-[1.5]">
										{channel.detail}
									</span>
								</div>
								<div className="col-start-2 min-[600px]:col-start-3">
									{channel.action}
								</div>
							</li>
						))}
					</ul>
					<div className="cn-r mt-6 bg-(--cn-sand) px-5 py-4">
						<p className="font-semibold text-[0.9375rem] leading-[1.5]">
							{t("enrol.promise")}
						</p>
						<p className="mt-1.5 text-(--cn-ink-2) text-[0.875rem] leading-[1.5]">
							{t("enrol.fallback")}
						</p>
					</div>
					<p className="mt-4 text-[0.8125rem] text-muted-foreground leading-[1.6]">
						{t("enrol.privacy")}
					</p>
				</div>
			</div>
		</section>
	);
}
