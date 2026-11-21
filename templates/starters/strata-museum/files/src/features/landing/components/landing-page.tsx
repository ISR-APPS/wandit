/**
 * Renders the public home page for this starter.
 * The root route calls it, and TanStack Start prerenders it.
 */

import "../landing.css";

/** The specimen guide ties three display objects to the processes that form them. */
export function LandingPage() {
	return (
		<div className="strata">
			<header>
				<a href="#top">STRATA</a>
				<nav aria-label="Exhibition">
					<a href="#index">Specimen index</a>
					<a href="#visit">Visit the gallery</a>
				</nav>
			</header>
			<main id="top">
				<section className="strata-hero">
					<img
						src="/images/hero.webp"
						alt="Banded agate and basalt with irregular amber veins"
						fetchPriority="high"
					/>
					<div>
						<p>Earth sciences gallery</p>
						<h1>
							Time
							<br />
							in stone.
						</h1>
						<a href="#index">Open the specimen index ↓</a>
					</div>
					<p className="strata-caption">
						Banded agate and basalt · polished section
					</p>
				</section>
				<section id="index" className="strata-index">
					<h2>Read the rock.</h2>
					<p>Three specimens show how minerals grow, melt, and settle.</p>
					<details open>
						<summary>
							<span>01</span> Agate bands
						</summary>
						<p>
							Look for lines where layers of silica filled an open space in
							older rock.
						</p>
					</details>
					<details>
						<summary>
							<span>02</span> Basalt pores
						</summary>
						<p>
							Look for pockets left by gas as lava cooled along the surface.
						</p>
					</details>
					<details>
						<summary>
							<span>03</span> Sandstone beds
						</summary>
						<p>
							Look for grains that settle in layers when moving water loses
							speed.
						</p>
					</details>
				</section>
				<section id="visit" className="strata-visit">
					<h2>Visit the gallery.</h2>
					<p>
						Ask for the field guide at the desk. It shows the same details you
						can look for on a walk.
					</p>
					<a href="mailto:visits@example.com">Ask about group visits ↗</a>
				</section>
			</main>
		</div>
	);
}
