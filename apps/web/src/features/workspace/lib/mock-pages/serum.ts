// Mock AI-generated landing page: "Sérum Éclat" — French premium brightening-serum COD page
// (blush-rose + deep plum, women 20-35). Rendered in the workspace preview iframe via srcDoc.

import type { MockPage } from "./shared";

export const SERUM_PAGES: Record<string, MockPage> = {
	"serum-1": {
		title: "Sérum Éclat — Peau éclatante en 4 semaines",
		lang: "fr",
		html: `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sérum Éclat — Peau éclatante en 4 semaines</title>
<style>
:root{
	--bg:#fdf4f6;
	--bg-soft:#fbe9ee;
	--card:#ffffff;
	--ink:#3d1f33;
	--ink-soft:#7a5a6d;
	--rose:#c2537a;
	--rose-deep:#a83e64;
	--gold:#c9a24b;
	--radius:20px;
	--shadow:0 18px 40px -20px rgba(61,31,51,.25);
}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{
	font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
	background:var(--bg);
	color:var(--ink);
	line-height:1.6;
	padding-bottom:88px;
}
.wrap{max-width:1040px;margin:0 auto;padding:0 20px}
h1,h2,h3{font-family:Georgia,serif;font-weight:600;line-height:1.2}
.eyebrow{
	display:inline-block;font-size:12px;letter-spacing:.18em;text-transform:uppercase;
	color:var(--rose-deep);font-weight:700;margin-bottom:14px;
}
section{padding:64px 0}
.btn{
	display:inline-block;background:linear-gradient(135deg,var(--rose),var(--rose-deep));
	color:#fff;text-decoration:none;font-weight:700;font-size:16px;
	padding:16px 32px;border-radius:999px;border:none;cursor:pointer;
	box-shadow:0 12px 24px -10px rgba(168,62,100,.55);
	transition:transform .15s ease,box-shadow .15s ease;
}
.btn:hover{transform:translateY(-2px);box-shadow:0 16px 30px -10px rgba(168,62,100,.6)}
/* Header */
header{padding:20px 0}
header .wrap{display:flex;align-items:center;justify-content:space-between}
.brand{font-family:Georgia,serif;font-size:20px;letter-spacing:.02em}
.brand span{color:var(--rose-deep)}
.header-badge{font-size:12px;color:var(--ink-soft);background:var(--bg-soft);padding:6px 14px;border-radius:999px}
/* Hero */
.hero{padding:36px 0 56px;background:linear-gradient(180deg,var(--bg) 0%,var(--bg-soft) 100%)}
.hero .wrap{display:grid;gap:40px;align-items:center}
.hero h1{font-size:38px;margin-bottom:16px}
.hero h1 em{font-style:italic;color:var(--rose-deep)}
.hero p.lead{font-size:17px;color:var(--ink-soft);margin-bottom:28px;max-width:46ch}
.hero-visual{display:flex;justify-content:center}
.bottle-scene{
	width:280px;height:280px;border-radius:50%;position:relative;
	background:radial-gradient(circle at 35% 30%,#fff 0%,#f9d9e2 45%,#f0bccb 100%);
	box-shadow:var(--shadow);display:flex;align-items:center;justify-content:center;
}
.bottle{
	width:84px;height:170px;border-radius:16px 16px 22px 22px;position:relative;
	background:linear-gradient(160deg,#fbe3ea 0%,#e8a9be 55%,#d17a99 100%);
	box-shadow:inset 6px 0 10px rgba(255,255,255,.55),0 14px 24px -10px rgba(61,31,51,.35);
}
.bottle::before{
	content:"";position:absolute;top:-34px;left:50%;transform:translateX(-50%);
	width:26px;height:38px;border-radius:8px 8px 4px 4px;
	background:linear-gradient(160deg,#4a2a3d,#2e1826);
}
.bottle::after{
	content:"ÉCLAT";position:absolute;inset:auto 0 26px 0;text-align:center;
	font-size:11px;letter-spacing:.28em;color:#fff;font-weight:700;
}
.sparkle{position:absolute;font-size:26px}
.sparkle.s1{top:26px;right:40px}
.sparkle.s2{bottom:44px;left:30px;font-size:20px}
/* Trust strip */
.trust{
	display:flex;flex-wrap:wrap;gap:10px 22px;justify-content:center;
	margin-top:36px;padding:16px 20px;background:rgba(255,255,255,.75);
	border:1px solid #f3d3dd;border-radius:16px;font-size:14px;color:var(--ink-soft);
}
.trust b{color:var(--ink);font-weight:600}
/* Sections */
.section-head{text-align:center;max-width:56ch;margin:0 auto 40px}
.section-head h2{font-size:28px;margin-bottom:10px}
.section-head p{color:var(--ink-soft)}
.cards{display:grid;gap:18px}
.card{
	background:var(--card);border-radius:var(--radius);padding:28px 24px;
	border:1px solid #f6dde5;box-shadow:var(--shadow);
}
.card .icon{
	width:52px;height:52px;border-radius:16px;display:flex;align-items:center;justify-content:center;
	font-size:26px;background:var(--bg-soft);margin-bottom:16px;
}
.card h3{font-size:19px;margin-bottom:8px}
.card p{font-size:15px;color:var(--ink-soft)}
.card .pct{font-size:12px;font-weight:700;color:var(--rose-deep);letter-spacing:.08em;text-transform:uppercase}
/* Steps */
.steps{display:grid;gap:16px;counter-reset:step}
.step{
	display:flex;gap:18px;align-items:flex-start;background:var(--card);
	border:1px solid #f6dde5;border-radius:var(--radius);padding:22px 24px;
}
.step .num{
	flex:0 0 44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;
	font-family:Georgia,serif;font-size:20px;color:#fff;
	background:linear-gradient(135deg,var(--rose),var(--rose-deep));
}
.step h3{font-size:17px;margin-bottom:4px}
.step p{font-size:14px;color:var(--ink-soft)}
/* Guarantee */
.guarantee{
	display:flex;gap:16px;align-items:center;background:#fff;
	border:1px dashed var(--gold);border-radius:var(--radius);padding:22px 24px;
}
.guarantee .icon{font-size:34px}
.guarantee h3{font-size:17px;margin-bottom:2px}
.guarantee p{font-size:14px;color:var(--ink-soft)}
/* Offer */
.offer{background:linear-gradient(180deg,var(--bg-soft),var(--bg))}
.offer-card{
	max-width:520px;margin:0 auto;background:var(--card);border-radius:24px;
	border:1px solid #f3cdd9;box-shadow:var(--shadow);padding:36px 28px;text-align:center;
}
.offer-card .eyebrow{margin-bottom:8px}
.offer-card h2{font-size:24px;margin-bottom:18px}
.price-row{display:flex;align-items:baseline;justify-content:center;gap:14px;margin-bottom:10px}
.price{font-family:Georgia,serif;font-size:44px;color:var(--rose-deep)}
.compare{font-size:19px;color:var(--ink-soft);text-decoration:line-through}
.save-chip{
	display:inline-block;background:#fdeef0;color:var(--rose-deep);border:1px solid #f5c6d2;
	font-size:13px;font-weight:700;padding:6px 14px;border-radius:999px;margin-bottom:18px;
}
.offer-list{list-style:none;margin:0 0 26px;font-size:14px;color:var(--ink-soft)}
.offer-list li{padding:6px 0;border-bottom:1px solid #fae7ec}
.offer-list li:last-child{border-bottom:none}
/* Form */
.form-panel{
	max-width:520px;margin:0 auto;background:var(--card);border-radius:24px;
	border:1px solid #f3cdd9;box-shadow:var(--shadow);padding:32px 26px;
}
.form-panel h2{font-size:22px;text-align:center;margin-bottom:6px}
.form-panel .sub{text-align:center;font-size:14px;color:var(--ink-soft);margin-bottom:24px}
.field{margin-bottom:16px}
.field label{display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:var(--ink)}
.field input,.field select{
	width:100%;padding:14px 16px;font-size:15px;border-radius:14px;
	border:1px solid #ecc9d5;background:#fffafb;color:var(--ink);font-family:inherit;
}
.field input:focus,.field select:focus{outline:2px solid var(--rose);border-color:var(--rose)}
.form-panel .btn{width:100%;margin-top:6px}
.form-note{text-align:center;font-size:12px;color:var(--ink-soft);margin-top:12px}
.success{text-align:center;padding:28px 8px}
.success h3{font-size:22px;margin-bottom:8px;font-family:Georgia,serif}
.success p{color:var(--ink-soft)}
/* Footer */
footer{padding:36px 0 48px;text-align:center;font-size:13px;color:var(--ink-soft)}
footer .brand{font-size:16px;margin-bottom:6px}
/* Sticky CTA */
.sticky-cta{
	position:fixed;left:0;right:0;bottom:0;z-index:60;
	display:flex;align-items:center;justify-content:space-between;gap:14px;
	padding:12px 18px;background:rgba(255,255,255,.94);backdrop-filter:blur(8px);
	border-top:1px solid #f3cdd9;
}
.sticky-cta .p{font-family:Georgia,serif;font-size:20px;color:var(--rose-deep)}
.sticky-cta .c{font-size:12px;color:var(--ink-soft);text-decoration:line-through}
.sticky-cta .btn{padding:12px 22px;font-size:14px}
@media(min-width:768px){
	body{padding-bottom:0}
	.sticky-cta{display:none}
	.hero .wrap{grid-template-columns:1.1fr .9fr}
	.hero h1{font-size:50px}
	.cards{grid-template-columns:repeat(3,1fr)}
	.steps{grid-template-columns:repeat(3,1fr)}
	.step{flex-direction:column}
	section{padding:88px 0}
	.bottle-scene{width:340px;height:340px}
}
</style>
</head>
<body>

<header>
	<div class="wrap">
		<div class="brand">Sérum <span>Éclat</span></div>
		<div class="header-badge">Soin visage · Alger</div>
	</div>
</header>

<section class="hero">
	<div class="wrap">
		<div>
			<span class="eyebrow">Sérum éclaircissant nouvelle génération</span>
			<h1>Une peau <em>éclatante</em> en 4 semaines</h1>
			<p class="lead">La Vitamine C pure à 10% estompe les taches, ravive le teint et lisse le grain de peau — sans agresser les peaux sensibles. Résultats visibles dès la 2e semaine.</p>
			<a class="btn" href="#commander">Commander — Paiement à la livraison</a>
			<div class="trust">
				<span>🚚 <b>Livraison 58 wilayas</b></span>
				<span>💵 <b>Paiement à la livraison</b></span>
				<span>↩️ <b>Retour facile</b></span>
			</div>
		</div>
		<div class="hero-visual">
			<div class="bottle-scene">
				<span class="sparkle s1">✨</span>
				<div class="bottle"></div>
				<span class="sparkle s2">✨</span>
			</div>
		</div>
	</div>
</section>

<section>
	<div class="wrap">
		<div class="section-head">
			<span class="eyebrow">La formule</span>
			<h2>Trois actifs, un teint lumineux</h2>
			<p>Une formule courte, concentrée et sans parfum — pensée pour un usage quotidien.</p>
		</div>
		<div class="cards">
			<div class="card">
				<div class="icon">🍊</div>
				<span class="pct">Vitamine C · 10%</span>
				<h3>Éclat &amp; anti-taches</h3>
				<p>Unifie le teint, estompe les taches pigmentaires et protège la peau du stress oxydatif au quotidien.</p>
			</div>
			<div class="card">
				<div class="icon">💧</div>
				<span class="pct">Acide hyaluronique</span>
				<h3>Hydratation intense</h3>
				<p>Repulpe la peau et retient l'eau dans l'épiderme pour un fini rebondi, sans effet gras ni collant.</p>
			</div>
			<div class="card">
				<div class="icon">🌿</div>
				<span class="pct">Niacinamide</span>
				<h3>Grain de peau affiné</h3>
				<p>Resserre les pores, apaise les rougeurs et renforce la barrière cutanée des peaux les plus sensibles.</p>
			</div>
		</div>
	</div>
</section>

<section style="padding-top:0">
	<div class="wrap">
		<div class="section-head">
			<span class="eyebrow">Simple, matin et soir</span>
			<h2>Votre routine en 3 étapes</h2>
		</div>
		<div class="steps">
			<div class="step">
				<div class="num">1</div>
				<div>
					<h3>Nettoyez</h3>
					<p>Sur peau propre et sèche, matin et/ou soir selon votre routine.</p>
				</div>
			</div>
			<div class="step">
				<div class="num">2</div>
				<div>
					<h3>Appliquez 3 gouttes</h3>
					<p>Massez délicatement sur le visage et le cou en évitant le contour des yeux.</p>
				</div>
			</div>
			<div class="step">
				<div class="num">3</div>
				<div>
					<h3>Hydratez</h3>
					<p>Terminez par votre crème habituelle. Le matin, ajoutez une protection solaire.</p>
				</div>
			</div>
		</div>
	</div>
</section>

<section style="padding-top:0">
	<div class="wrap">
		<div class="guarantee">
			<div class="icon">🌸</div>
			<div>
				<h3>Satisfaite ou remboursée — 14 jours</h3>
				<p>Testez le sérum sereinement. Si vous n'êtes pas convaincue, nous vous remboursons intégralement, sans justification.</p>
			</div>
		</div>
	</div>
</section>

<section class="offer">
	<div class="wrap">
		<div class="offer-card">
			<span class="eyebrow">Offre de lancement</span>
			<h2>Sérum Éclat — 30 ml</h2>
			<div class="price-row">
				<span class="price">3 400 DA</span>
				<span class="compare">5 200 DA</span>
			</div>
			<span class="save-chip">Vous économisez 1 800 DA (-35%)</span>
			<ul class="offer-list">
				<li>✔️ Flacon 30 ml avec pipette — 2 mois d'utilisation</li>
				<li>✔️ Formule vegan, sans parfum, non testée sur les animaux</li>
				<li>✔️ Livraison dans les 58 wilayas sous 24–72h</li>
			</ul>
			<a class="btn" href="#commander">Je commande maintenant</a>
		</div>
	</div>
</section>

<section style="padding-top:0">
	<div class="wrap">
		<form class="form-panel" id="commander">
			<h2>Commandez votre sérum</h2>
			<p class="sub">Remplissez le formulaire — vous payez à la réception. 💵</p>
			<div class="field">
				<label for="f-nom">Nom complet</label>
				<input type="text" id="f-nom" name="fullname" placeholder="Votre nom et prénom" required>
			</div>
			<div class="field">
				<label for="f-tel">Numéro de téléphone</label>
				<input type="tel" id="f-tel" name="phone" placeholder="05 XX XX XX XX" required>
			</div>
			<div class="field">
				<label for="f-wilaya">Wilaya</label>
				<select id="f-wilaya" name="wilaya" required>
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
				<label for="f-commune">Commune</label>
				<input type="text" id="f-commune" name="commune" placeholder="Votre commune" required>
			</div>
			<input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off">
			<button class="btn" type="submit">Confirmer — Paiement à la livraison</button>
			<p class="form-note">Aucun paiement en ligne. Nous vous appelons pour confirmer avant l'expédition.</p>
		</form>
	</div>
</section>

<footer>
	<div class="wrap">
		<div class="brand">Sérum <span>Éclat</span></div>
		<p>Fabriqué avec soin · Livraison partout en Algérie · contact@serumeclat.dz</p>
	</div>
</footer>

<div class="sticky-cta">
	<div>
		<div class="p">3 400 DA</div>
		<div class="c">5 200 DA</div>
	</div>
	<a class="btn" href="#commander">Commander</a>
</div>

<script>
(function(){
	var form = document.getElementById("commander");
	if(!form){ return; }
	form.addEventListener("submit", function(e){
		e.preventDefault();
		var hp = form.querySelector('input[name="website"]');
		if(hp && hp.value){ return; }
		form.innerHTML = '<div class="success"><h3>Commande reçue ✅</h3><p>Nous vous appellerons pour confirmer.</p></div>';
	});
})();
</script>

</body>
</html>`,
	},
};
