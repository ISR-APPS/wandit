/**
 * Renders the public home page for this starter.
 * The root route calls it, and TanStack Start prerenders it.
 */
import { useState } from "react";
import "../landing.css";

const services = [
	{
		category: "Household",
		name: "Lamps and small appliances",
		text: "Loose connections, switches, or damaged housings.",
	},
	{
		category: "Clothes",
		name: "Clothes and bags",
		text: "Small tears, missing buttons, and stuck zippers.",
	},
	{
		category: "Bikes",
		name: "Bikes and scooters",
		text: "Brake adjustments, punctures, and chain care.",
	},
	{
		category: "Household",
		name: "Chairs and stools",
		text: "Loose joints and parts that need a new fastener.",
	},
];

/** The filter narrows the directory. The visit guide explains what to bring to the workshop. */
export function LandingPage() {
	const [category, setCategory] = useState("All repairs");
	const visible = services.filter(
		(service) => category === "All repairs" || category === service.category,
	);

	return (
		<div className="dovetail">
			<header>
				<a href="#top">
					Dovetail
					<br />
					<span>Repair collective</span>
				</a>
				<nav aria-label="Workshop">
					<a href="#directory">Repair directory</a>
					<a href="#visit">First visit</a>
				</nav>
			</header>
			<main id="top">
				<section className="dovetail-hero">
					<h1>
						Keep good things
						<br />
						in use.
					</h1>
					<div>
						<p>
							Bring something broken. Sit with someone who knows how to fix it.
							Take home the skills, too.
						</p>
						<a href="#directory">Find your repair ↘</a>
					</div>
				</section>
				<div className="dovetail-layout">
					<figure>
						<img
							src="/images/hero.webp"
							alt="Hands repairing a blue desk lamp at a workshop bench"
							fetchPriority="high"
						/>
						<figcaption>At the bench · Small appliance repair</figcaption>
					</figure>
					<section id="directory">
						<h2>Repair directory</h2>
						<fieldset
							className="dovetail-filters"
							aria-label="Filter by item type"
						>
							{["All repairs", "Household", "Clothes", "Bikes"].map((item) => (
								<button
									key={item}
									type="button"
									aria-pressed={category === item}
									onClick={() => setCategory(item)}
								>
									{item}
								</button>
							))}
						</fieldset>
						<ul>
							{visible.map((service) => (
								<li key={service.name}>
									<h3>{service.name}</h3>
									<p>{service.text}</p>
								</li>
							))}
						</ul>
					</section>
				</div>
				<section id="visit" className="dovetail-visit">
					<h2>Your first visit.</h2>
					<div>
						<p>
							Bring the item, its parts, and any instructions you have. Unplug
							it before you pack it. If it is heavy, email first so we can help
							you plan.
						</p>
						<a href="mailto:workshop@example.com">Ask the workshop ↗</a>
					</div>
				</section>
			</main>
		</div>
	);
}
