// This page shows the roaster's coffee and brew methods.
// The home route renders it. The tabs keep the tasting notes next to their roast.
import { useT } from "~/shared/i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";

/** Lets visitors compare roast profiles and find a recipe for their brewing method. */
export function LandingPage() {
	const { t } = useT();
	const coffees = [
		{
			id: "citrus",
			name: t("landing.coffeeLight"),
			notes: t("landing.coffeeLightNotes"),
			advice: t("landing.coffeeLightGuide"),
		},
		{
			id: "balanced",
			name: t("landing.coffeeMedium"),
			notes: t("landing.coffeeMediumNotes"),
			advice: t("landing.coffeeMediumGuide"),
		},
		{
			id: "rich",
			name: t("landing.coffeeDark"),
			notes: t("landing.coffeeDarkNotes"),
			advice: t("landing.coffeeDarkGuide"),
		},
	];

	return (
		<div className="mx-auto max-w-[92rem]">
			<header className="grid grid-cols-[1fr_auto] items-center gap-4 border-foreground/30 border-b px-5 py-4 sm:px-10">
				<a
					className="font-display font-extrabold text-2xl text-primary uppercase leading-none"
					href="#top"
				>
					{t("common.appName")}
				</a>
				<nav
					className="flex gap-4 font-bold text-sm sm:gap-8"
					aria-label="Roastery"
				>
					<a className="hover:underline" href="#coffee">
						{t("landing.coffee")}
					</a>
					<a className="hover:underline" href="#brew">
						{t("landing.brew")}
					</a>
				</nav>
			</header>
			<main id="top">
				<section className="px-5 pt-10 pb-0 sm:px-10 sm:pt-14">
					<div className="mb-7 flex flex-wrap items-end justify-between gap-5">
						<h1 className="max-w-[11ch] font-extrabold text-[clamp(3rem,10vw,9rem)] text-primary leading-[0.85] tracking-[-0.075em]">
							{t("landing.heroTitle")}
						</h1>
						<p className="mb-1 max-w-60 font-semibold text-base leading-snug">
							{t("landing.heroSubtitle")}
						</p>
					</div>
					<img
						src="/images/studio.webp"
						width={1440}
						height={960}
						alt={t("landing.heroAlt")}
						className="aspect-[1.45] w-full rounded-lg object-cover object-center sm:aspect-[2.4]"
					/>
				</section>
				<section
					id="coffee"
					className="grid gap-8 px-5 py-16 sm:px-10 sm:py-20 lg:grid-cols-[0.7fr_1.3fr]"
				>
					<div>
						<h2 className="font-extrabold text-4xl tracking-tight">
							{t("landing.finder")}
						</h2>
						<p className="mt-3 max-w-60">{t("landing.finderBody")}</p>
					</div>
					<Tabs defaultValue="balanced" className="gap-5">
						<TabsList
							aria-label="Coffee profiles"
							className="h-auto w-full flex-wrap justify-start gap-1"
						>
							{coffees.map((coffee) => (
								<TabsTrigger
									key={coffee.id}
									value={coffee.id}
									className="px-3 py-2"
								>
									{coffee.name}
								</TabsTrigger>
							))}
						</TabsList>
						{coffees.map((coffee) => (
							<TabsContent
								key={coffee.id}
								value={coffee.id}
								className="min-h-44 rounded-lg bg-primary p-6 text-primary-foreground sm:p-8"
							>
								<p className="font-semibold text-sm">{t("landing.notes")}</p>
								<h3 className="mt-3 font-bold text-3xl">{coffee.notes}</h3>
								<p className="mt-3 max-w-md">{coffee.advice}</p>
							</TabsContent>
						))}
					</Tabs>
				</section>
				<section
					id="brew"
					className="mx-5 grid gap-6 border-foreground/30 border-t py-12 sm:mx-10 md:grid-cols-[0.7fr_1.3fr]"
				>
					<h2 className="font-extrabold text-4xl tracking-tight">
						{t("landing.brewTitle")}
					</h2>
					<div className="grid divide-y divide-foreground/30 border-foreground/30 border-y">
						<details open className="py-4">
							<summary className="cursor-pointer font-bold">
								{t("landing.filterTitle")}
							</summary>
							<p className="mt-3 max-w-lg">{t("landing.filterBody")}</p>
						</details>
						<details className="py-4">
							<summary className="cursor-pointer font-bold">
								{t("landing.pressTitle")}
							</summary>
							<p className="mt-3 max-w-lg">{t("landing.pressBody")}</p>
						</details>
					</div>
				</section>
			</main>
			<footer className="flex flex-wrap items-center justify-between gap-5 bg-primary px-5 py-9 text-primary-foreground sm:px-10">
				<p className="font-bold font-display text-2xl">{t("common.appName")}</p>
				<a
					className="font-semibold underline underline-offset-4"
					href="mailto:hello@firstcrack.example"
				>
					{t("landing.email")}
				</a>
			</footer>
		</div>
	);
}
