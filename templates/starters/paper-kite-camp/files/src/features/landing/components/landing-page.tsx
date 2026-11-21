// This page explains the age groups and weekly workshops at the camp.
// The home route renders it. It reads sample program details from the dictionary.

import { ArrowUpRightIcon, ScissorsIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";

/** Gives families a workshop schedule and the details they need before registration. */
export function LandingPage() {
	const { t } = useT();
	const schedule = [
		{
			days: t("landing.monday"),
			workshop: t("landing.mondayArt"),
			idea: t("landing.mondayNote"),
		},
		{
			days: t("landing.tuesday"),
			workshop: t("landing.tuesdayArt"),
			idea: t("landing.tuesdayNote"),
		},
		{
			days: t("landing.wednesday"),
			workshop: t("landing.wednesdayArt"),
			idea: t("landing.wednesdayNote"),
		},
		{
			days: t("landing.thursday"),
			workshop: t("landing.thursdayArt"),
			idea: t("landing.thursdayNote"),
		},
		{
			days: t("landing.friday"),
			workshop: t("landing.fridayArt"),
			idea: t("landing.fridayNote"),
		},
	];

	return (
		<div className="mx-auto max-w-[90rem] px-4 sm:px-8">
			<header className="flex flex-wrap items-center justify-between gap-4 py-5 sm:py-7">
				<a
					className="inline-flex items-center gap-2 font-bold font-display text-2xl"
					href="#top"
				>
					<ScissorsIcon aria-hidden="true" />
					{t("common.appName")}
				</a>
				<nav
					className="flex flex-wrap items-center gap-4 font-extrabold text-sm sm:gap-6"
					aria-label="Camp"
				>
					<a className="hover:underline" href="#week">
						{t("landing.schedule")}
					</a>
					<a className="hover:underline" href="#families">
						{t("landing.info")}
					</a>
					<a
						className="rounded-full bg-primary px-4 py-2 text-primary-foreground"
						href="#register"
					>
						{t("landing.register")}
					</a>
				</nav>
			</header>
			<main id="top">
				<section className="relative isolate grid items-center overflow-hidden rounded-[2rem] bg-secondary text-secondary-foreground lg:grid-cols-[1fr_0.95fr]">
					<div className="px-6 py-10 sm:px-12 sm:py-16 lg:py-20">
						<p className="mb-4 font-extrabold">{t("landing.tag")}</p>
						<h1 className="max-w-[12ch] font-bold text-[clamp(2.9rem,7.7vw,7.8rem)] leading-[0.86] tracking-[-0.055em]">
							{t("landing.heroTitle")}
						</h1>
						<p className="mt-5 max-w-sm font-bold text-base leading-snug">
							{t("landing.heroSubtitle")}
						</p>
						<a
							className="mt-6 inline-flex rounded-full bg-primary px-4 py-3 font-extrabold text-primary-foreground sm:px-6"
							href="#week"
						>
							{t("landing.seeWeek")}
						</a>
					</div>
					<img
						src="/images/studio.webp"
						width={1440}
						height={960}
						alt={t("landing.heroAlt")}
						className="h-full min-h-64 w-full object-cover lg:[clip-path:polygon(10%_0%,100%_0%,100%_100%,0%_100%)]"
					/>
				</section>
				<section
					id="week"
					className="grid gap-7 py-16 lg:grid-cols-[0.65fr_1.4fr]"
				>
					<div className="lg:sticky lg:top-10 lg:self-start">
						<h2 className="font-bold text-4xl sm:text-6xl">
							{t("landing.weekTitle")}
						</h2>
						<p className="mt-4 max-w-64 leading-relaxed">
							{t("landing.weekIntro")}
						</p>
					</div>
					<ol className="grid gap-2">
						{schedule.map((day) => (
							<li
								key={day.days}
								className="grid items-center gap-2 rounded-2xl border border-foreground/20 bg-card px-5 py-4 sm:grid-cols-[0.65fr_1fr_1.3fr] sm:gap-5"
							>
								<span className="font-extrabold text-primary text-sm">
									{day.days}
								</span>
								<h3 className="font-bold text-xl leading-tight">
									{day.workshop}
								</h3>
								<p className="text-sm">{day.idea}</p>
							</li>
						))}
					</ol>
				</section>
				<section
					id="families"
					className="grid gap-8 rounded-[2rem] bg-secondary p-6 text-secondary-foreground sm:p-10 lg:grid-cols-2"
				>
					<div>
						<h2 className="font-bold text-4xl">{t("landing.familyTitle")}</h2>
						<p className="mt-3 max-w-sm leading-relaxed">
							{t("landing.familyIntro")}
						</p>
					</div>
					<div className="divide-y divide-foreground/25 border-foreground/25 border-y">
						<details className="py-3">
							<summary className="cursor-pointer font-extrabold">
								{t("landing.bring")}
							</summary>
							<p className="mt-3">{t("landing.bringBody")}</p>
						</details>
						<details className="py-3">
							<summary className="cursor-pointer font-extrabold">
								{t("landing.experience")}
							</summary>
							<p className="mt-3">{t("landing.experienceBody")}</p>
						</details>
					</div>
				</section>
			</main>
			<footer
				id="register"
				className="flex flex-wrap items-center justify-between gap-5 py-10"
			>
				<h2 className="font-bold text-3xl">{t("landing.footer")}</h2>
				<a
					className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-extrabold text-primary-foreground"
					href="mailto:camp@paperkite.example"
				>
					{t("landing.register")}
					<ArrowUpRightIcon aria-hidden="true" />
				</a>
			</footer>
		</div>
	);
}
