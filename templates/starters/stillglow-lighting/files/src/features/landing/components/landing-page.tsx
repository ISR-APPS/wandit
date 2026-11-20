// This page introduces the studio's lighting collection.
// The home route renders it. It links the fixture index to a trade inquiry.
import { useT } from "~/shared/i18n";

/** Pairs a room-scale photograph with a fixture index that expands in place. */
export function LandingPage() {
	const { t } = useT();
	const fixtures = [
		{
			name: t("landing.sumo"),
			type: t("landing.sumoType"),
			material: t("landing.sumoMaterial"),
			description: t("landing.sumoBody"),
		},
		{
			name: t("landing.tilt"),
			type: t("landing.tiltType"),
			material: t("landing.tiltMaterial"),
			description: t("landing.tiltBody"),
		},
		{
			name: t("landing.bank"),
			type: t("landing.bankType"),
			material: t("landing.bankMaterial"),
			description: t("landing.bankBody"),
		},
	];

	return (
		<div className="mx-auto max-w-[100rem]">
			<header className="mx-5 grid items-center gap-3 border-foreground/25 border-b py-5 sm:mx-9 sm:grid-cols-[1fr_auto_1fr] sm:py-6">
				<a className="font-display text-2xl" href="#top">
					{t("common.appName")}
				</a>
				<p className="hidden text-muted-foreground text-sm sm:block">
					{t("landing.studio")}
				</p>
				<nav
					className="flex gap-6 text-sm sm:justify-end"
					aria-label="Collection"
				>
					<a className="hover:underline" href="#index">
						{t("landing.index")}
					</a>
					<a className="hover:underline" href="#trade">
						{t("landing.trade")}
					</a>
				</nav>
			</header>
			<main id="top">
				<section className="grid items-end gap-7 px-5 py-9 sm:px-9 sm:py-12 lg:grid-cols-[0.45fr_1fr] lg:py-16">
					<div className="grid gap-5 lg:gap-8 lg:pb-10">
						<h1 className="max-w-[10ch] font-normal text-[clamp(3.2rem,6vw,7rem)] leading-[0.95] tracking-[-0.07em]">
							{t("landing.heroTitle")}
						</h1>
						<p className="max-w-56 text-muted-foreground leading-relaxed">
							{t("landing.heroSubtitle")}
						</p>
						<a
							className="w-fit border-primary border-b pb-1 text-primary text-sm"
							href="#index"
						>
							{t("landing.browse")}
						</a>
					</div>
					<figure>
						<img
							src="/images/studio.webp"
							width={1440}
							height={960}
							alt={t("landing.heroAlt")}
							className="aspect-[1.35] w-full object-cover object-center lg:aspect-[1.65]"
						/>
						<figcaption className="mt-3 flex flex-wrap justify-between gap-2 border-foreground/25 border-b pb-3 text-muted-foreground text-sm">
							<span>{t("landing.sumo")}</span>
							<span>{t("landing.material")}</span>
						</figcaption>
					</figure>
				</section>
				<section
					id="index"
					className="mx-5 grid gap-7 py-6 pb-20 sm:mx-9 lg:grid-cols-[0.45fr_1fr]"
				>
					<div>
						<h2 className="text-4xl">{t("landing.index")}</h2>
						<p className="mt-3 max-w-52 text-muted-foreground text-sm">
							{t("landing.indexBody")}
						</p>
					</div>
					<div className="divide-y divide-foreground/25 border-foreground/25 border-y">
						{fixtures.map((fixture) => (
							<details key={fixture.name} className="py-4">
								<summary className="cursor-pointer">
									<span className="inline-flex w-[calc(100%-1rem)] flex-wrap items-baseline justify-between gap-3">
										<span className="font-display text-2xl">
											{fixture.name}
										</span>
										<span className="text-muted-foreground text-sm">
											{fixture.type}
										</span>
									</span>
								</summary>
								<p className="mt-4 font-semibold text-primary text-sm">
									{fixture.material}
								</p>
								<p className="mt-2 max-w-md">{fixture.description}</p>
							</details>
						))}
					</div>
				</section>
			</main>
			<footer
				id="trade"
				className="flex flex-wrap items-end justify-between gap-7 bg-primary px-5 py-10 text-primary-foreground sm:px-9 sm:py-16"
			>
				<div>
					<h2 className="text-4xl">{t("landing.tradeTitle")}</h2>
					<p className="mt-3 max-w-lg">{t("landing.tradeBody")}</p>
				</div>
				<a
					className="border-current border-b pb-1 font-semibold"
					href="mailto:trade@stillglow.example"
				>
					{t("landing.email")}
				</a>
			</footer>
		</div>
	);
}
