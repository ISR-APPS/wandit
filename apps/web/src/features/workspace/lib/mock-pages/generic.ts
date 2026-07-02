// Mock page builders for freshly generated projects: 3 French COD landing pages aux
// directions artistiques distinctes (conversion classique, bold impact, éditorial épuré).

import type { MockPage, MockPageBuilder } from "./shared";
import { escapeHtml } from "./shared";

const GENERIC_FORM_FIELDS = `<input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off">
				<div class="field">
					<label for="nom">Nom complet</label>
					<input id="nom" type="text" name="nom" placeholder="Votre nom et prénom" autocomplete="name" required>
				</div>
				<div class="field">
					<label for="telephone">Téléphone</label>
					<input id="telephone" type="tel" name="telephone" placeholder="05 XX XX XX XX" autocomplete="tel" required>
				</div>
				<div class="field">
					<label for="wilaya">Wilaya</label>
					<select id="wilaya" name="wilaya" required>
						<option value="" disabled selected>Choisissez votre wilaya</option>
						<option value="16">16 — Alger</option>
						<option value="31">31 — Oran</option>
						<option value="25">25 — Constantine</option>
						<option value="19">19 — Sétif</option>
						<option value="05">05 — Batna</option>
						<option value="09">09 — Blida</option>
						<option value="23">23 — Annaba</option>
						<option value="13">13 — Tlemcen</option>
						<option value="15">15 — Tizi Ouzou</option>
						<option value="06">06 — Béjaïa</option>
						<option value="07">07 — Biskra</option>
						<option value="17">17 — Djelfa</option>
						<option value="27">27 — Mostaganem</option>
						<option value="48">48 — Relizane</option>
						<option value="30">30 — Ouargla</option>
						<option value="10">10 — Bouira</option>
					</select>
				</div>
				<div class="field">
					<label for="commune">Commune</label>
					<input id="commune" type="text" name="commune" placeholder="Votre commune" required>
				</div>
				<button class="btn btn-full" type="submit">Confirmer ma commande — 2&#8239;990 DA</button>
				<p class="form-note">💵 Paiement à la livraison · Vos données restent confidentielles.</p>`;

const GENERIC_FORM_SCRIPT = `<script>
	(function () {
		var form = document.getElementById("commander");
		if (!form) return;
		form.addEventListener("submit", function (event) {
			event.preventDefault();
			var honeypot = form.querySelector('input[name="website"]');
			if (honeypot && honeypot.value) return;
			form.innerHTML = '<div class="form-success"><div class="form-success-icon">✅</div><h3>Commande reçue ✅</h3><p>Nous vous appellerons pour confirmer.</p></div>';
			form.scrollIntoView({ behavior: "smooth", block: "center" });
		});
	})();
</script>`;

const TRUST_STRIP = `<div class="trust">
		<div class="wrap trust-inner">
			<span>🚚 Livraison 58 wilayas</span>
			<span>💵 Paiement à la livraison</span>
			<span>↩️ Retour facile</span>
		</div>
	</div>`;

function buildConversionClassique(ctx: { title: string }): MockPage {
	const name = escapeHtml(ctx.title);
	return {
		title: ctx.title,
		lang: "fr",
		html: `<!doctype html>
<html lang="fr" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name} — 2&#8239;990 DA · Paiement à la livraison</title>
<style>
	* { margin: 0; padding: 0; box-sizing: border-box; }
	html { scroll-behavior: smooth; }
	body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: #faf5ec; color: #31261a; line-height: 1.65; padding-bottom: 86px; -webkit-font-smoothing: antialiased; }
	.wrap { max-width: 1040px; margin: 0 auto; padding: 0 20px; }
	.site { padding: 16px 0; background: #fffdf8; border-bottom: 1px solid #eee3d0; }
	.brand { text-align: center; font-weight: 700; font-size: 15px; color: #b4430e; letter-spacing: 0.02em; }
	.eyebrow { color: #d9541c; font-weight: 700; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 12px; }
	.hero { text-align: center; padding: 52px 0 46px; }
	.hero h1 { font-size: clamp(30px, 7vw, 50px); line-height: 1.12; font-weight: 800; letter-spacing: -0.02em; color: #2b2013; margin-bottom: 16px; }
	.lead { color: #7c6b54; font-size: 16.5px; max-width: 560px; margin: 0 auto 26px; }
	.stage { width: min(230px, 58vw); aspect-ratio: 1; margin: 0 auto 28px; border-radius: 32px; background: radial-gradient(circle at 32% 26%, #ffe8d2, #f7c59a 55%, #eda265); box-shadow: inset 0 -14px 30px rgba(180, 94, 30, 0.18), 0 24px 48px rgba(180, 94, 30, 0.22); display: flex; align-items: center; justify-content: center; font-size: 84px; }
	.price-row { display: flex; align-items: baseline; justify-content: center; gap: 12px; flex-wrap: wrap; }
	.price { font-size: 34px; font-weight: 800; color: #c2410c; }
	.compare { color: #b3a18a; text-decoration: line-through; font-size: 17px; }
	.chip { display: inline-block; margin-top: 10px; background: #fdeadb; border: 1px solid #f2bf94; color: #b4430e; font-weight: 700; font-size: 12.5px; padding: 5px 14px; border-radius: 999px; }
	.cta-row { margin-top: 24px; }
	.btn { display: inline-block; background: linear-gradient(135deg, #f97940, #e05a1d); color: #fff; font-weight: 700; font-size: 16px; font-family: inherit; padding: 15px 32px; border: none; border-radius: 14px; cursor: pointer; text-decoration: none; box-shadow: 0 14px 30px rgba(224, 90, 29, 0.3); }
	.btn:hover { filter: brightness(1.05); }
	.btn-full { display: block; width: 100%; text-align: center; }
	.trust { background: #fffdf8; border-top: 1px solid #eee3d0; border-bottom: 1px solid #eee3d0; }
	.trust-inner { display: flex; justify-content: center; gap: 10px 30px; flex-wrap: wrap; padding: 15px 20px; color: #7c6b54; font-size: 13.5px; font-weight: 600; }
	.section { padding: 52px 0; }
	.section-head { text-align: center; max-width: 620px; margin: 0 auto 34px; }
	.section-head h2 { font-size: clamp(24px, 5vw, 34px); font-weight: 800; line-height: 1.2; color: #2b2013; }
	.section-head .sub { color: #8d7c64; margin-top: 10px; font-size: 15px; }
	.cards { display: grid; gap: 16px; }
	.card { background: #fff; border: 1px solid #f0e4d1; border-radius: 18px; padding: 24px 22px; box-shadow: 0 12px 28px rgba(120, 84, 40, 0.07); }
	.ico { width: 50px; height: 50px; border-radius: 14px; background: #fdeadb; display: flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 14px; }
	.card h3 { font-size: 18px; font-weight: 800; color: #3a2c1b; margin-bottom: 6px; }
	.card p { color: #8d7c64; font-size: 14.5px; }
	.social { display: flex; align-items: center; justify-content: center; gap: 8px 14px; flex-wrap: wrap; max-width: 540px; margin: 0 auto; background: #fff; border: 1px solid #f0e4d1; border-radius: 999px; padding: 14px 26px; font-weight: 600; color: #6f5f49; font-size: 14.5px; box-shadow: 0 10px 24px rgba(120, 84, 40, 0.07); }
	.stars { color: #f59e0b; letter-spacing: 3px; font-size: 15px; }
	.offer { max-width: 560px; margin: 0 auto; text-align: center; background: #fff; border: 2px solid #f2bf94; border-radius: 22px; padding: 36px 26px 30px; box-shadow: 0 26px 56px rgba(180, 94, 30, 0.14); }
	.offer h2 { font-size: 25px; font-weight: 800; color: #2b2013; margin-bottom: 6px; }
	.offer .offer-sub { color: #8d7c64; font-size: 15px; margin-bottom: 16px; }
	.offer ul { list-style: none; max-width: 360px; margin: 22px auto; text-align: left; }
	.offer li { padding: 9px 0 9px 28px; position: relative; color: #5f4f3a; font-size: 15px; border-bottom: 1px dashed #f0e4d1; }
	.offer li:last-child { border-bottom: none; }
	.offer li::before { content: "✓"; position: absolute; left: 0; color: #d9541c; font-weight: 800; }
	.form-card { max-width: 520px; margin: 0 auto; background: #fff; border: 1px solid #f0e4d1; border-radius: 22px; padding: 32px 24px; box-shadow: 0 20px 44px rgba(120, 84, 40, 0.1); }
	.field { margin-bottom: 18px; text-align: left; }
	.field label { display: block; font-size: 13px; font-weight: 700; color: #6f5f49; margin-bottom: 7px; }
	.field input, .field select { width: 100%; background: #fbf6ec; border: 1px solid #e8d9c2; color: #31261a; border-radius: 12px; padding: 13px 15px; font-size: 16px; font-family: inherit; }
	.field select { appearance: none; -webkit-appearance: none; background-image: linear-gradient(45deg, transparent 50%, #d9541c 50%), linear-gradient(135deg, #d9541c 50%, transparent 50%); background-position: calc(100% - 21px) 50%, calc(100% - 15px) 50%; background-size: 6px 6px; background-repeat: no-repeat; }
	.field input:focus, .field select:focus { outline: none; border-color: #e05a1d; box-shadow: 0 0 0 3px rgba(224, 90, 29, 0.15); }
	.form-note { margin-top: 14px; text-align: center; color: #8d7c64; font-size: 13px; }
	.form-success { text-align: center; padding: 26px 4px; }
	.form-success-icon { font-size: 44px; margin-bottom: 12px; }
	.form-success h3 { font-size: 23px; font-weight: 800; color: #b4430e; margin-bottom: 6px; }
	.form-success p { color: #8d7c64; }
	footer { border-top: 1px solid #eee3d0; background: #fffdf8; padding: 30px 0 40px; text-align: center; color: #a5947c; font-size: 13px; }
	footer p + p { margin-top: 6px; }
	.sticky-cta { position: fixed; left: 0; right: 0; bottom: 0; z-index: 60; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 18px; background: rgba(255, 253, 248, 0.96); border-top: 1px solid #f2bf94; backdrop-filter: blur(10px); }
	.s-price { font-size: 20px; font-weight: 800; color: #c2410c; line-height: 1.25; }
	.s-note { font-size: 11.5px; color: #8d7c64; }
	.sticky-cta .btn { padding: 12px 24px; font-size: 15px; box-shadow: none; }
	@media (min-width: 560px) { .cards { grid-template-columns: repeat(2, 1fr); } }
	@media (min-width: 900px) { .cards { grid-template-columns: repeat(4, 1fr); } }
	@media (min-width: 768px) {
		.sticky-cta { display: none; }
		body { padding-bottom: 0; }
		.hero { padding: 76px 0 60px; }
		.section { padding: 68px 0; }
	}
</style>
</head>
<body>
	<header class="site">
		<div class="wrap"><div class="brand">✦ Boutique officielle</div></div>
	</header>

	<main>
		<section class="hero">
			<div class="wrap">
				<p class="eyebrow">Paiement à la livraison — 58 wilayas</p>
				<h1>${name}</h1>
				<p class="lead">La qualité que vous attendiez, livrée jusqu'à votre porte. Vous ne payez qu'à la réception — simple, rapide et sans risque.</p>
				<div class="stage" aria-hidden="true">✨</div>
				<div class="price-row">
					<span class="price">2&#8239;990 DA</span>
					<span class="compare">4&#8239;500 DA</span>
				</div>
				<p><span class="chip">Économisez 1&#8239;510 DA</span></p>
				<p class="cta-row"><a class="btn" href="#commander">Commander — Paiement à la livraison</a></p>
			</div>
		</section>

		${TRUST_STRIP}

		<section class="section">
			<div class="wrap">
				<div class="section-head">
					<p class="eyebrow">Pourquoi commander chez nous</p>
					<h2>Une expérience pensée pour vous rassurer</h2>
				</div>
				<div class="cards">
					<article class="card">
						<div class="ico">✅</div>
						<h3>Qualité vérifiée</h3>
						<p>Chaque produit est contrôlé à la main avant expédition. Rien ne part sans validation.</p>
					</article>
					<article class="card">
						<div class="ico">🚚</div>
						<h3>Livraison rapide</h3>
						<p>Expédition sous 24 h, livraison en 24 à 72 h dans les 58 wilayas d'Algérie.</p>
					</article>
					<article class="card">
						<div class="ico">💵</div>
						<h3>Paiement à la livraison</h3>
						<p>Vous ne payez que lorsque le colis est entre vos mains. Aucun prépaiement demandé.</p>
					</article>
					<article class="card">
						<div class="ico">↩️</div>
						<h3>Retour facile</h3>
						<p>7 jours pour changer d'avis : échange ou remboursement, sans discussion.</p>
					</article>
				</div>
			</div>
		</section>

		<section class="section">
			<div class="wrap">
				<div class="social">
					<span class="stars">★★★★★</span>
					<span>4,8/5 — +1&#8239;200 clients satisfaits à travers l'Algérie</span>
				</div>
			</div>
		</section>

		<section class="section">
			<div class="wrap">
				<div class="offer">
					<p class="eyebrow">L'offre du moment</p>
					<h2>${name}</h2>
					<p class="offer-sub">Une offre pensée pour vous, sans mauvaise surprise.</p>
					<div class="price-row">
						<span class="price">2&#8239;990 DA</span>
						<span class="compare">4&#8239;500 DA</span>
					</div>
					<p><span class="chip">Économisez 1&#8239;510 DA</span></p>
					<ul>
						<li>Livraison dans les 58 wilayas incluse</li>
						<li>Garantie satisfait ou remboursé 7 jours</li>
						<li>Support client 7j/7, en français et en arabe</li>
					</ul>
					<a class="btn btn-full" href="#commander">Je profite de l'offre</a>
					<p class="form-note">💵 Aucun prépaiement — vous payez le livreur à la réception.</p>
				</div>
			</div>
		</section>

		<section class="section">
			<div class="wrap">
				<div class="section-head">
					<p class="eyebrow">Commande en 30 secondes</p>
					<h2>Commander ${name}</h2>
					<p class="sub">Remplissez le formulaire, nous vous appelons pour confirmer. Paiement à la livraison.</p>
				</div>
				<form id="commander" class="form-card" autocomplete="on">
					${GENERIC_FORM_FIELDS}
				</form>
			</div>
		</section>
	</main>

	<footer>
		<div class="wrap">
			<p>© 2026 — Tous droits réservés</p>
			<p>Paiement à la livraison partout en Algérie · Retour sous 7 jours</p>
		</div>
	</footer>

	<div class="sticky-cta">
		<div>
			<div class="s-price">2&#8239;990 DA</div>
			<div class="s-note">Paiement à la livraison</div>
		</div>
		<a class="btn" href="#commander">Commander</a>
	</div>

	${GENERIC_FORM_SCRIPT}
</body>
</html>`,
	};
}

function buildBoldImpact(ctx: { title: string }): MockPage {
	const name = escapeHtml(ctx.title);
	return {
		title: ctx.title,
		lang: "fr",
		html: `<!doctype html>
<html lang="fr" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name} — 2&#8239;990 DA · Paiement à la livraison</title>
<style>
	* { margin: 0; padding: 0; box-sizing: border-box; }
	html { scroll-behavior: smooth; }
	body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: #0a0a12; color: #ececff; line-height: 1.6; padding-bottom: 86px; -webkit-font-smoothing: antialiased; }
	.wrap { max-width: 1040px; margin: 0 auto; padding: 0 20px; }
	.site { padding: 16px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
	.brand { text-align: center; font-weight: 800; font-size: 14px; letter-spacing: 0.24em; text-transform: uppercase; color: #a78bfa; }
	.eyebrow { color: #22d3ee; font-weight: 700; font-size: 11px; letter-spacing: 0.26em; text-transform: uppercase; margin-bottom: 16px; }
	.hero { position: relative; overflow: hidden; text-align: center; padding: 64px 0 58px; }
	.orb { position: absolute; width: 460px; height: 460px; border-radius: 50%; background: radial-gradient(circle, rgba(139, 92, 246, 0.55), rgba(34, 211, 238, 0.2) 55%, transparent 72%); filter: blur(58px); top: -150px; left: 50%; transform: translateX(-50%); pointer-events: none; }
	.hero .wrap { position: relative; }
	.hero h1 { font-size: clamp(38px, 10.5vw, 74px); font-weight: 800; letter-spacing: -0.03em; line-height: 1.04; margin-bottom: 18px; }
	.grad { background: linear-gradient(100deg, #a78bfa, #22d3ee); -webkit-background-clip: text; background-clip: text; color: transparent; }
	.lead { color: #9d9dbd; font-size: 17px; max-width: 540px; margin: 0 auto 28px; }
	.price-row { display: flex; align-items: baseline; justify-content: center; gap: 12px; flex-wrap: wrap; }
	.price { font-size: 38px; font-weight: 800; letter-spacing: -0.02em; color: #fff; }
	.compare { color: #6b6b85; text-decoration: line-through; font-size: 17px; }
	.chip { display: inline-block; margin-top: 10px; background: rgba(34, 211, 238, 0.1); border: 1px solid rgba(34, 211, 238, 0.45); color: #67e8f9; font-weight: 700; font-size: 12.5px; letter-spacing: 0.04em; padding: 5px 14px; border-radius: 999px; }
	.cta-row { margin-top: 26px; }
	.btn { display: inline-block; background: linear-gradient(100deg, #8b5cf6, #06b6d4); color: #fff; font-weight: 800; font-size: 16px; font-family: inherit; padding: 16px 34px; border: none; border-radius: 999px; cursor: pointer; text-decoration: none; box-shadow: 0 16px 40px rgba(124, 58, 237, 0.4); }
	.btn:hover { filter: brightness(1.1); }
	.btn-full { display: block; width: 100%; text-align: center; border-radius: 16px; }
	.trust { border-top: 1px solid rgba(255, 255, 255, 0.08); border-bottom: 1px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.02); }
	.trust-inner { display: flex; justify-content: center; gap: 10px 30px; flex-wrap: wrap; padding: 15px 20px; color: #9d9dbd; font-size: 13.5px; font-weight: 600; }
	.section { padding: 56px 0; }
	.section-head { text-align: center; max-width: 640px; margin: 0 auto 36px; }
	.section-head h2 { font-size: clamp(28px, 6.5vw, 44px); font-weight: 800; letter-spacing: -0.02em; line-height: 1.08; }
	.section-head .sub { color: #9d9dbd; margin-top: 12px; font-size: 15px; }
	.cards { display: grid; gap: 14px; }
	.card { background: #12121e; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 18px; padding: 26px 22px; }
	.ico { width: 52px; height: 52px; border-radius: 14px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(34, 211, 238, 0.2)); border: 1px solid rgba(167, 139, 250, 0.4); display: flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 16px; }
	.card h3 { font-size: 18px; font-weight: 800; margin-bottom: 6px; }
	.card p { color: #9d9dbd; font-size: 14.5px; }
	.social { display: flex; align-items: center; justify-content: center; gap: 8px 14px; flex-wrap: wrap; max-width: 560px; margin: 0 auto; background: #12121e; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 999px; padding: 14px 26px; font-weight: 700; color: #c7c7e2; font-size: 14.5px; }
	.stars { color: #facc15; letter-spacing: 3px; font-size: 15px; }
	.offer { max-width: 560px; margin: 0 auto; text-align: center; background: linear-gradient(180deg, #15152400, #15152400), #131320; border: 1px solid rgba(167, 139, 250, 0.45); border-radius: 24px; padding: 38px 26px 30px; box-shadow: 0 30px 70px rgba(124, 58, 237, 0.25); }
	.offer h2 { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 6px; }
	.offer .offer-sub { color: #9d9dbd; font-size: 15px; margin-bottom: 16px; }
	.offer ul { list-style: none; max-width: 360px; margin: 22px auto; text-align: left; }
	.offer li { padding: 9px 0 9px 28px; position: relative; color: #c7c7e2; font-size: 15px; border-bottom: 1px dashed rgba(255, 255, 255, 0.1); }
	.offer li:last-child { border-bottom: none; }
	.offer li::before { content: "⚡"; position: absolute; left: 0; font-size: 13px; }
	.form-card { max-width: 520px; margin: 0 auto; background: #12121e; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; padding: 32px 24px; }
	.field { margin-bottom: 18px; text-align: left; }
	.field label { display: block; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9d9dbd; margin-bottom: 8px; }
	.field input, .field select { width: 100%; background: #0e0e18; border: 1px solid rgba(255, 255, 255, 0.14); color: #ececff; border-radius: 12px; padding: 13px 15px; font-size: 16px; font-family: inherit; }
	.field select { appearance: none; -webkit-appearance: none; background-image: linear-gradient(45deg, transparent 50%, #22d3ee 50%), linear-gradient(135deg, #22d3ee 50%, transparent 50%); background-position: calc(100% - 21px) 50%, calc(100% - 15px) 50%; background-size: 6px 6px; background-repeat: no-repeat; }
	.field input:focus, .field select:focus { outline: none; border-color: #8b5cf6; box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.22); }
	.form-note { margin-top: 14px; text-align: center; color: #8585a5; font-size: 13px; }
	.form-success { text-align: center; padding: 26px 4px; }
	.form-success-icon { font-size: 44px; margin-bottom: 12px; }
	.form-success h3 { font-size: 24px; font-weight: 800; margin-bottom: 6px; }
	.form-success p { color: #9d9dbd; }
	footer { border-top: 1px solid rgba(255, 255, 255, 0.08); padding: 30px 0 40px; text-align: center; color: #62627e; font-size: 13px; }
	footer p + p { margin-top: 6px; }
	.sticky-cta { position: fixed; left: 0; right: 0; bottom: 0; z-index: 60; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 18px; background: rgba(10, 10, 18, 0.94); border-top: 1px solid rgba(167, 139, 250, 0.4); backdrop-filter: blur(10px); }
	.s-price { font-size: 20px; font-weight: 800; color: #fff; line-height: 1.25; }
	.s-note { font-size: 11.5px; color: #9d9dbd; }
	.sticky-cta .btn { padding: 12px 24px; font-size: 15px; box-shadow: none; }
	@media (min-width: 560px) { .cards { grid-template-columns: repeat(2, 1fr); } }
	@media (min-width: 900px) { .cards { grid-template-columns: repeat(4, 1fr); } }
	@media (min-width: 768px) {
		.sticky-cta { display: none; }
		body { padding-bottom: 0; }
		.hero { padding: 96px 0 76px; }
		.section { padding: 76px 0; }
	}
</style>
</head>
<body>
	<header class="site">
		<div class="wrap"><div class="brand">Drop exclusif</div></div>
	</header>

	<main>
		<section class="hero">
			<div class="orb" aria-hidden="true"></div>
			<div class="wrap">
				<p class="eyebrow">Stock limité · Paiement à la livraison</p>
				<h1><span class="grad">${name}</span><br>Vous allez l'adorer.</h1>
				<p class="lead">Le produit dont tout le monde parle, enfin disponible en Algérie. Commandez en 30 secondes, payez à la réception.</p>
				<div class="price-row">
					<span class="price">2&#8239;990 DA</span>
					<span class="compare">4&#8239;500 DA</span>
				</div>
				<p><span class="chip">−34&#8239;% · Économisez 1&#8239;510 DA</span></p>
				<p class="cta-row"><a class="btn" href="#commander">Je le veux — Paiement à la livraison</a></p>
			</div>
		</section>

		${TRUST_STRIP}

		<section class="section">
			<div class="wrap">
				<div class="section-head">
					<p class="eyebrow">Zéro compromis</p>
					<h2>Pourquoi tout le monde le commande</h2>
				</div>
				<div class="cards">
					<article class="card">
						<div class="ico">⚡</div>
						<h3>Qualité sans compromis</h3>
						<p>Sélectionné et testé avant chaque expédition. Ce que vous voyez est ce que vous recevez.</p>
					</article>
					<article class="card">
						<div class="ico">🚀</div>
						<h3>Chez vous en 24–72 h</h3>
						<p>Expédition express vers les 58 wilayas, avec un appel du livreur avant passage.</p>
					</article>
					<article class="card">
						<div class="ico">💵</div>
						<h3>Zéro prépaiement</h3>
						<p>Vous payez uniquement quand le colis est entre vos mains. Aucun risque, aucune carte.</p>
					</article>
					<article class="card">
						<div class="ico">🛡️</div>
						<h3>Garantie 7 jours</h3>
						<p>Pas convaincu ? Échange ou remboursement sous 7 jours, sans paperasse.</p>
					</article>
				</div>
			</div>
		</section>

		<section class="section">
			<div class="wrap">
				<div class="social">
					<span class="stars">★★★★★</span>
					<span>4,8/5 — +1&#8239;200 clients satisfaits</span>
				</div>
			</div>
		</section>

		<section class="section">
			<div class="wrap">
				<div class="offer">
					<p class="eyebrow">Offre limitée</p>
					<h2>${name}</h2>
					<p class="offer-sub">Une offre pensée pour vous — tant qu'il y a du stock.</p>
					<div class="price-row">
						<span class="price">2&#8239;990 DA</span>
						<span class="compare">4&#8239;500 DA</span>
					</div>
					<p><span class="chip">Économisez 1&#8239;510 DA</span></p>
					<ul>
						<li>Livraison 58 wilayas incluse</li>
						<li>Garantie satisfait ou remboursé 7 jours</li>
						<li>Support client réactif, 7j/7</li>
					</ul>
					<a class="btn btn-full" href="#commander">Je saisis l'offre</a>
					<p class="form-note">💵 Aucun prépaiement — vous payez le livreur à la réception.</p>
				</div>
			</div>
		</section>

		<section class="section">
			<div class="wrap">
				<div class="section-head">
					<p class="eyebrow">Dernière étape</p>
					<h2>Commander ${name}</h2>
					<p class="sub">Remplissez le formulaire, on vous appelle pour confirmer. Paiement à la livraison.</p>
				</div>
				<form id="commander" class="form-card" autocomplete="on">
					${GENERIC_FORM_FIELDS}
				</form>
			</div>
		</section>
	</main>

	<footer>
		<div class="wrap">
			<p>© 2026 — Tous droits réservés</p>
			<p>Paiement à la livraison partout en Algérie · Retour sous 7 jours</p>
		</div>
	</footer>

	<div class="sticky-cta">
		<div>
			<div class="s-price">2&#8239;990 DA</div>
			<div class="s-note">Paiement à la livraison</div>
		</div>
		<a class="btn" href="#commander">Commander</a>
	</div>

	${GENERIC_FORM_SCRIPT}
</body>
</html>`,
	};
}

function buildEditorialEpure(ctx: { title: string }): MockPage {
	const name = escapeHtml(ctx.title);
	return {
		title: ctx.title,
		lang: "fr",
		html: `<!doctype html>
<html lang="fr" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name} — 2&#8239;990 DA · Paiement à la livraison</title>
<style>
	* { margin: 0; padding: 0; box-sizing: border-box; }
	html { scroll-behavior: smooth; }
	body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: #ffffff; color: #1c1a16; line-height: 1.7; padding-bottom: 86px; -webkit-font-smoothing: antialiased; }
	h1, h2, h3, .price, .s-price, .num { font-family: Georgia, "Times New Roman", serif; font-weight: 400; }
	.wrap { max-width: 960px; margin: 0 auto; padding: 0 22px; }
	.site { padding: 20px 0; border-bottom: 1px solid #e8e3da; }
	.brand { text-align: center; font-family: Georgia, "Times New Roman", serif; font-size: 12px; letter-spacing: 0.32em; text-transform: uppercase; color: #6b655c; }
	.eyebrow { font-size: 10.5px; letter-spacing: 0.32em; text-transform: uppercase; color: #8a8378; margin-bottom: 18px; }
	.hero { text-align: center; padding: 68px 0 58px; }
	.hero h1 { font-size: clamp(34px, 8vw, 62px); line-height: 1.08; color: #171511; margin-bottom: 20px; }
	.hero-rule { width: 56px; height: 1px; background: #1c1a16; margin: 0 auto 26px; border: none; }
	.lead { color: #6b655c; font-size: 17px; max-width: 520px; margin: 0 auto 30px; }
	.price-row { display: flex; align-items: baseline; justify-content: center; gap: 14px; flex-wrap: wrap; }
	.price { font-size: 40px; color: #171511; }
	.compare { color: #a89f90; text-decoration: line-through; font-size: 17px; }
	.chip { display: inline-block; margin-top: 12px; border: 1px solid #1c1a16; color: #1c1a16; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; padding: 6px 16px; border-radius: 999px; }
	.cta-row { margin-top: 28px; }
	.btn { display: inline-block; background: #171511; color: #fff; font-weight: 600; font-size: 12.5px; font-family: inherit; letter-spacing: 0.16em; text-transform: uppercase; padding: 17px 36px; border: none; border-radius: 2px; cursor: pointer; text-decoration: none; }
	.btn:hover { background: #33302a; }
	.btn-full { display: block; width: 100%; text-align: center; }
	.trust { border-top: 1px solid #e8e3da; border-bottom: 1px solid #e8e3da; }
	.trust-inner { display: flex; justify-content: center; gap: 10px 34px; flex-wrap: wrap; padding: 16px 20px; color: #6b655c; font-size: 13px; letter-spacing: 0.02em; }
	.section { padding: 64px 0; }
	.section-head { text-align: center; max-width: 620px; margin: 0 auto 44px; }
	.section-head h2 { font-size: clamp(26px, 5.5vw, 38px); line-height: 1.15; color: #171511; }
	.section-head .sub { color: #8a8378; margin-top: 12px; font-size: 15px; }
	.cards { display: grid; border-top: 1px solid #e8e3da; }
	.card { padding: 30px 4px; border-bottom: 1px solid #e8e3da; }
	.num { font-style: italic; font-size: 15px; color: #a89f90; display: block; margin-bottom: 10px; }
	.card h3 { font-size: 21px; color: #171511; margin-bottom: 8px; }
	.card p { color: #6b655c; font-size: 14.5px; }
	.social { text-align: center; color: #171511; font-size: 14px; letter-spacing: 0.06em; }
	.social .stars { display: block; font-size: 18px; letter-spacing: 8px; margin-bottom: 10px; color: #171511; }
	.offer { max-width: 560px; margin: 0 auto; text-align: center; border: 1px solid #171511; padding: 44px 30px 36px; }
	.offer h2 { font-size: 28px; color: #171511; margin-bottom: 8px; }
	.offer .offer-sub { color: #8a8378; font-size: 15px; margin-bottom: 20px; }
	.offer ul { list-style: none; max-width: 340px; margin: 26px auto; text-align: left; }
	.offer li { padding: 10px 0; color: #4b463e; font-size: 15px; border-bottom: 1px solid #efebe3; }
	.offer li:last-child { border-bottom: none; }
	.offer li::before { content: "—"; margin-right: 12px; color: #a89f90; }
	.form-card { max-width: 520px; margin: 0 auto; border: 1px solid #e8e3da; padding: 36px 26px; }
	.field { margin-bottom: 20px; text-align: left; }
	.field label { display: block; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #6b655c; margin-bottom: 8px; }
	.field input, .field select { width: 100%; background: #fff; border: 1px solid #d8d2c6; color: #1c1a16; border-radius: 2px; padding: 13px 15px; font-size: 16px; font-family: inherit; }
	.field select { appearance: none; -webkit-appearance: none; background-image: linear-gradient(45deg, transparent 50%, #1c1a16 50%), linear-gradient(135deg, #1c1a16 50%, transparent 50%); background-position: calc(100% - 21px) 50%, calc(100% - 15px) 50%; background-size: 6px 6px; background-repeat: no-repeat; }
	.field input:focus, .field select:focus { outline: none; border-color: #171511; box-shadow: 0 0 0 1px #171511; }
	.form-note { margin-top: 16px; text-align: center; color: #8a8378; font-size: 13px; }
	.form-success { text-align: center; padding: 26px 4px; }
	.form-success-icon { font-size: 42px; margin-bottom: 14px; }
	.form-success h3 { font-size: 25px; color: #171511; margin-bottom: 8px; }
	.form-success p { color: #6b655c; }
	footer { border-top: 1px solid #e8e3da; padding: 34px 0 44px; text-align: center; color: #a89f90; font-size: 13px; letter-spacing: 0.04em; }
	footer p + p { margin-top: 6px; }
	.sticky-cta { position: fixed; left: 0; right: 0; bottom: 0; z-index: 60; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 18px; background: rgba(255, 255, 255, 0.96); border-top: 1px solid #e8e3da; backdrop-filter: blur(10px); }
	.s-price { font-size: 21px; color: #171511; line-height: 1.25; }
	.s-note { font-size: 11.5px; color: #8a8378; }
	.sticky-cta .btn { padding: 13px 24px; font-size: 11.5px; }
	@media (min-width: 720px) {
		.cards { grid-template-columns: repeat(4, 1fr); border-top: 1px solid #e8e3da; }
		.card { border-bottom: none; padding: 34px 22px; }
		.card + .card { border-left: 1px solid #e8e3da; }
	}
	@media (min-width: 768px) {
		.sticky-cta { display: none; }
		body { padding-bottom: 0; }
		.hero { padding: 104px 0 84px; }
		.section { padding: 84px 0; }
	}
</style>
</head>
<body>
	<header class="site">
		<div class="wrap"><div class="brand">Maison de vente</div></div>
	</header>

	<main>
		<section class="hero">
			<div class="wrap">
				<p class="eyebrow">Édition disponible — paiement à la livraison</p>
				<h1>${name}</h1>
				<hr class="hero-rule">
				<p class="lead">Une offre pensée pour vous : l'essentiel, choisi avec soin, livré chez vous partout en Algérie. Vous réglez à la réception, en toute confiance.</p>
				<div class="price-row">
					<span class="price">2&#8239;990 DA</span>
					<span class="compare">4&#8239;500 DA</span>
				</div>
				<p><span class="chip">Économisez 1&#8239;510 DA</span></p>
				<p class="cta-row"><a class="btn" href="#commander">Commander · Paiement à la livraison</a></p>
			</div>
		</section>

		${TRUST_STRIP}

		<section class="section">
			<div class="wrap">
				<div class="section-head">
					<p class="eyebrow">Nos engagements</p>
					<h2>Quatre promesses, tenues à chaque commande</h2>
				</div>
				<div class="cards">
					<article class="card">
						<span class="num">01</span>
						<h3>Qualité d'abord</h3>
						<p>Chaque pièce est vérifiée individuellement avant de quitter notre atelier.</p>
					</article>
					<article class="card">
						<span class="num">02</span>
						<h3>Livraison suivie</h3>
						<p>Expédition sous 24 h et livraison en 24 à 72 h dans les 58 wilayas.</p>
					</article>
					<article class="card">
						<span class="num">03</span>
						<h3>Paiement à la réception</h3>
						<p>Aucun prépaiement : vous réglez le livreur une fois le colis en main.</p>
					</article>
					<article class="card">
						<span class="num">04</span>
						<h3>Retours sans friction</h3>
						<p>Sept jours pour changer d'avis, échange ou remboursement compris.</p>
					</article>
				</div>
			</div>
		</section>

		<section class="section">
			<div class="wrap">
				<div class="social">
					<span class="stars">★★★★★</span>
					<span>4,8/5 — plus de 1&#8239;200 clients satisfaits à travers l'Algérie</span>
				</div>
			</div>
		</section>

		<section class="section">
			<div class="wrap">
				<div class="offer">
					<p class="eyebrow">L'offre</p>
					<h2>${name}</h2>
					<p class="offer-sub">Une offre pensée pour vous, sans superflu.</p>
					<div class="price-row">
						<span class="price">2&#8239;990 DA</span>
						<span class="compare">4&#8239;500 DA</span>
					</div>
					<p><span class="chip">Économisez 1&#8239;510 DA</span></p>
					<ul>
						<li>Livraison incluse, 58 wilayas</li>
						<li>Garantie satisfait ou remboursé, 7 jours</li>
						<li>Accompagnement client 7j/7</li>
					</ul>
					<a class="btn btn-full" href="#commander">Réserver la mienne</a>
					<p class="form-note">💵 Aucun prépaiement — vous payez le livreur à la réception.</p>
				</div>
			</div>
		</section>

		<section class="section">
			<div class="wrap">
				<div class="section-head">
					<p class="eyebrow">Une minute suffit</p>
					<h2>Commander ${name}</h2>
					<p class="sub">Renseignez vos coordonnées, nous vous appelons pour confirmer. Paiement à la livraison.</p>
				</div>
				<form id="commander" class="form-card" autocomplete="on">
					${GENERIC_FORM_FIELDS}
				</form>
			</div>
		</section>
	</main>

	<footer>
		<div class="wrap">
			<p>© 2026 — Tous droits réservés</p>
			<p>Paiement à la livraison partout en Algérie · Retour sous 7 jours</p>
		</div>
	</footer>

	<div class="sticky-cta">
		<div>
			<div class="s-price">2&#8239;990 DA</div>
			<div class="s-note">Paiement à la livraison</div>
		</div>
		<a class="btn" href="#commander">Commander</a>
	</div>

	${GENERIC_FORM_SCRIPT}
</body>
</html>`,
	};
}

export const GENERIC_BUILDERS: MockPageBuilder[] = [
	buildConversionClassique,
	buildBoldImpact,
	buildEditorialEpure,
];
