// This page shows alpine cycling kit and fit details.
// The home route renders it. It reads product descriptions from the app dictionary.
import { useT } from "~/shared/i18n";

/** Opens on the route photo and gives riders a field guide to the kit. */
export function LandingPage() {
	const { t } = useT();
	const kit = [
		{
			id: "J–01",
			name: t("landing.jersey"),
			use: t("landing.jerseyUse"),
			detail: t("landing.jerseyBody"),
		},
		{
			id: "V–02",
			name: t("landing.vest"),
			use: t("landing.vestUse"),
			detail: t("landing.vestBody"),
		},
		{
			id: "B–03",
			name: t("landing.bib"),
			use: t("landing.bibUse"),
			detail: t("landing.bibBody"),
		},
	];

	return (
		<div>
			<header className="border-foreground/40 border-b">
				<div className="mx-auto flex max-w-[100rem] flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-9">
					<a
						className="font-display font-extrabold text-lg uppercase tracking-tight"
						href="#top"
					>
						{t("common.appName")}
					</a>
					<nav
						className="flex gap-6 font-bold text-sm"
						aria-label="Cycling kit"
					>
						<a className="hover:underline" href="#kit">
							{t("landing.collection")}
						</a>
						<a className="hover:underline" href="#fit">
							{t("landing.fit")}
						</a>
					</nav>
				</div>
			</header>
			<main id="top" className="mx-auto max-w-[100rem]">
				<section className="relative mx-5 mt-5 sm:mx-9 sm:mt-9">
					<figure>
						<img
							src="/images/studio.webp"
							width={1440}
							height={960}
							alt={t("landing.heroAlt")}
							className="aspect-[0.9] w-full object-cover object-[60%_center] sm:aspect-[1.9] lg:aspect-[2.35]"
						/>
						<figcaption className="flex flex-wrap justify-between gap-2 border-foreground/40 border-b py-3 font-mono text-xs">
							<span>{t("landing.route")}</span>
							<span>{t("landing.grade")}</span>
						</figcaption>
					</figure>
					<div className="absolute inset-x-0 bottom-14 mx-3 max-w-max bg-background px-4 py-4 sm:bottom-16 sm:mx-6 sm:px-7 sm:py-6">
						<p className="mb-2 font-mono font-semibold text-primary text-xs">
							{t("landing.label")}
						</p>
						<h1 className="max-w-[13ch] font-extrabold text-[clamp(2rem,5.8vw,6.05rem)] leading-[0.94] tracking-[-0.085em]">
							{t("landing.heroTitle")}
						</h1>
					</div>
				</section>
				<section id="kit" className="mx-5 py-14 sm:mx-9 sm:py-20">
					<div className="mb-8 flex flex-wrap items-end justify-between gap-4">
						<h2 className="font-bold text-4xl tracking-tight">
							{t("landing.collection")}
						</h2>
						<p className="max-w-sm">{t("landing.heroSubtitle")}</p>
					</div>
					<ul className="border-foreground/40 border-y">
						{kit.map((piece) => (
							<li
								className="grid gap-2 border-foreground/40 border-b py-5 last:border-b-0 sm:grid-cols-[0.35fr_1fr_0.65fr_1fr] sm:items-baseline"
								key={piece.id}
							>
								<span className="font-mono text-primary text-sm">
									{piece.id}
								</span>
								<h3 className="font-bold text-2xl">{piece.name}</h3>
								<span className="font-semibold text-sm">{piece.use}</span>
								<p className="max-w-md text-sm leading-relaxed">
									{piece.detail}
								</p>
							</li>
						))}
					</ul>
				</section>
				<section
					id="fit"
					className="grid gap-7 bg-foreground px-5 py-10 text-background sm:px-9 sm:py-16 lg:grid-cols-[0.8fr_1fr]"
				>
					<div>
						<h2 className="font-bold text-4xl">{t("landing.fit")}</h2>
						<p className="mt-4 max-w-sm">{t("landing.fitIntro")}</p>
					</div>
					<div className="divide-y divide-background/30 border-background/30 border-y">
						<details open className="py-4">
							<summary className="cursor-pointer font-bold">
								{t("landing.chest")}
							</summary>
							<p className="mt-3 max-w-lg">{t("landing.chestBody")}</p>
						</details>
						<details className="py-4">
							<summary className="cursor-pointer font-bold">
								{t("landing.waist")}
							</summary>
							<p className="mt-3 max-w-lg">{t("landing.waistBody")}</p>
						</details>
					</div>
				</section>
			</main>
			<footer className="mx-auto flex max-w-[100rem] flex-wrap items-center justify-between gap-4 px-5 py-6 sm:px-9">
				<p className="font-bold font-display text-lg">{t("common.appName")}</p>
				<a
					className="font-semibold text-sm underline underline-offset-4"
					href="mailto:fit@switchback.example"
				>
					{t("landing.email")}
				</a>
			</footer>
		</div>
	);
}
