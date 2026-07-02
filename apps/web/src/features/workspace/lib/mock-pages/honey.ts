// Mock pages: "عسل الأوراس الحر" — two iterations (v1 baseline, v2 + témoignages et
// options de poids) d'une page COD arabe RTL, palette miel/crème artisanale.

import type { MockPage } from "./shared";

const HONEY_FORM_FIELDS = `<input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off">
				<div class="field">
					<label for="nom">الاسم الكامل</label>
					<input id="nom" type="text" name="nom" placeholder="اسمك ولقبك" autocomplete="name" required>
				</div>
				<div class="field">
					<label for="telephone">رقم الهاتف</label>
					<input id="telephone" type="tel" name="telephone" placeholder="05 XX XX XX XX" autocomplete="tel" dir="ltr" required>
				</div>
				<div class="field">
					<label for="wilaya">الولاية</label>
					<select id="wilaya" name="wilaya" required>
						<option value="" disabled selected>اختر ولايتك</option>
						<option value="16">16 — الجزائر</option>
						<option value="31">31 — وهران</option>
						<option value="25">25 — قسنطينة</option>
						<option value="19">19 — سطيف</option>
						<option value="05">05 — باتنة</option>
						<option value="09">09 — البليدة</option>
						<option value="23">23 — عنابة</option>
						<option value="13">13 — تلمسان</option>
						<option value="15">15 — تيزي وزو</option>
						<option value="06">06 — بجاية</option>
						<option value="07">07 — بسكرة</option>
						<option value="17">17 — الجلفة</option>
						<option value="27">27 — مستغانم</option>
						<option value="48">48 — غليزان</option>
						<option value="30">30 — ورقلة</option>
						<option value="10">10 — البويرة</option>
					</select>
				</div>
				<div class="field">
					<label for="commune">البلدية</label>
					<input id="commune" type="text" name="commune" placeholder="اسم البلدية" required>
				</div>`;

const HONEY_FORM_SCRIPT = `<script>
	(function () {
		var form = document.getElementById("commander");
		if (!form) return;
		form.addEventListener("submit", function (event) {
			event.preventDefault();
			var honeypot = form.querySelector('input[name="website"]');
			if (honeypot && honeypot.value) return;
			form.innerHTML = '<div class="form-success"><div class="form-success-icon">✅</div><h3>تم استلام طلبك ✅</h3><p>سنتصل بك هاتفيًا لتأكيد الطلب.</p></div>';
			form.scrollIntoView({ behavior: "smooth", block: "center" });
		});
	})();
</script>`;

const HONEY_CSS = `* { margin: 0; padding: 0; box-sizing: border-box; }
	html { scroll-behavior: smooth; }
	body {
		font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
		background: #fbf3e2;
		color: #3a2d16;
		line-height: 1.8;
		padding-bottom: 88px;
		-webkit-font-smoothing: antialiased;
	}
	.wrap { max-width: 1040px; margin: 0 auto; padding: 0 20px; }
	.site { padding: 16px 0; background: #fffaf0; border-bottom: 1px solid #eeddbc; }
	.brand { text-align: center; color: #8a5a0e; font-weight: 800; font-size: 17px; letter-spacing: 0.02em; }
	.brand .bee { margin-inline-start: 6px; }
	.eyebrow { color: #b87914; font-weight: 700; font-size: 13px; letter-spacing: 0.02em; margin-bottom: 12px; }
	.hero { padding: 48px 0 42px; text-align: center; background: linear-gradient(180deg, #fdf7e9, #fbf3e2); }
	.hero h1 { font-size: clamp(28px, 6.6vw, 46px); line-height: 1.35; font-weight: 800; color: #4a370f; margin-bottom: 14px; }
	.lead { color: #7c6534; font-size: 16.5px; max-width: 580px; margin: 0 auto 30px; }
	.jar { position: relative; width: min(210px, 56vw); aspect-ratio: 1; margin: 0 auto 30px; border-radius: 50%; background: radial-gradient(circle at 35% 28%, #ffe4a6, #f3b53c 55%, #d98f1f); box-shadow: inset 0 -16px 34px rgba(139, 84, 10, 0.35), 0 26px 52px rgba(160, 102, 14, 0.32); display: flex; align-items: center; justify-content: center; }
	.jar-emoji { font-size: clamp(72px, 19vw, 104px); filter: drop-shadow(0 12px 18px rgba(97, 58, 4, 0.35)); }
	.jar .bee-fly { position: absolute; top: 2px; inset-inline-start: -8px; font-size: 30px; transform: rotate(-12deg); }
	.jar .flower { position: absolute; bottom: 6px; inset-inline-end: -6px; font-size: 26px; }
	.price-row { display: flex; align-items: baseline; justify-content: center; gap: 12px; flex-wrap: wrap; }
	.price { font-size: 34px; font-weight: 800; color: #a5670a; }
	.unit { font-size: 15px; color: #96793e; }
	.compare { color: #ab9464; text-decoration: line-through; font-size: 17px; }
	.chip { display: inline-block; margin-top: 10px; background: #f7e3bb; border: 1px solid #e0b869; color: #8a5a0e; font-weight: 700; font-size: 13px; padding: 5px 14px; border-radius: 999px; }
	.cta-row { margin-top: 24px; }
	.btn { display: inline-block; background: linear-gradient(135deg, #f2b64f, #d9931f); color: #3b2604; font-weight: 800; font-size: 16.5px; font-family: inherit; padding: 15px 32px; border: none; border-radius: 14px; cursor: pointer; text-decoration: none; box-shadow: 0 14px 28px rgba(197, 134, 24, 0.35); }
	.btn:hover { filter: brightness(1.05); }
	.btn-full { display: block; width: 100%; text-align: center; }
	.trust { background: #fffaf0; border-top: 1px solid #eeddbc; border-bottom: 1px solid #eeddbc; }
	.trust-inner { display: flex; justify-content: center; gap: 10px 30px; flex-wrap: wrap; padding: 15px 20px; color: #7c6534; font-size: 14px; font-weight: 600; }
	.section { padding: 52px 0; }
	.section-head { text-align: center; max-width: 640px; margin: 0 auto 34px; }
	.section-head h2 { font-size: clamp(24px, 5vw, 34px); font-weight: 800; line-height: 1.4; color: #4a370f; }
	.section-head .sub { color: #8a7345; margin-top: 10px; font-size: 15px; }
	.cards { display: grid; gap: 16px; }
	.card { background: #fffaf0; border: 1px solid #eeddbc; border-radius: 18px; padding: 26px 22px; box-shadow: 0 12px 28px rgba(160, 112, 30, 0.08); }
	.ico { width: 54px; height: 54px; border-radius: 50%; background: linear-gradient(135deg, #fbe4b0, #f3c264); display: flex; align-items: center; justify-content: center; font-size: 26px; margin-bottom: 16px; }
	.card h3 { font-size: 19px; font-weight: 800; color: #5a430f; margin-bottom: 6px; }
	.card p { color: #8a7345; font-size: 14.5px; }
	.offer { max-width: 560px; margin: 0 auto; text-align: center; background: #fffaf0; border: 2px solid #e8c477; border-radius: 22px; padding: 36px 26px 30px; box-shadow: 0 26px 56px rgba(160, 112, 30, 0.16); }
	.offer h2 { font-size: 26px; font-weight: 800; color: #4a370f; margin-bottom: 14px; }
	.offer ul { list-style: none; max-width: 360px; margin: 22px auto; text-align: start; }
	.offer li { padding: 9px 0; padding-inline-start: 28px; position: relative; color: #6e5828; font-size: 15px; border-bottom: 1px dashed #eeddbc; }
	.offer li:last-child { border-bottom: none; }
	.offer li::before { content: "🐝"; position: absolute; inset-inline-start: 0; font-size: 14px; }
	.form-card { max-width: 520px; margin: 0 auto; background: #fffaf0; border: 1px solid #e8c477; border-radius: 22px; padding: 32px 24px; box-shadow: 0 20px 44px rgba(160, 112, 30, 0.12); }
	.field { margin-bottom: 18px; text-align: start; }
	.field label { display: block; font-size: 13.5px; font-weight: 700; color: #6e5828; margin-bottom: 7px; }
	.field input, .field select { width: 100%; background: #fdf7e9; border: 1px solid #e3cf9e; color: #3a2d16; border-radius: 12px; padding: 13px 15px; font-size: 16px; font-family: inherit; }
	.field input[dir="ltr"] { text-align: start; }
	.field select { appearance: none; -webkit-appearance: none; background-image: linear-gradient(45deg, transparent 50%, #b87914 50%), linear-gradient(135deg, #b87914 50%, transparent 50%); background-position: 21px 50%, 15px 50%; background-size: 6px 6px; background-repeat: no-repeat; }
	.field input:focus, .field select:focus { outline: none; border-color: #d9931f; box-shadow: 0 0 0 3px rgba(217, 147, 31, 0.18); }
	.form-note { margin-top: 14px; text-align: center; color: #8a7345; font-size: 13px; }
	.form-success { text-align: center; padding: 26px 4px; }
	.form-success-icon { font-size: 44px; margin-bottom: 12px; }
	.form-success h3 { font-size: 23px; font-weight: 800; color: #7a5410; margin-bottom: 6px; }
	.form-success p { color: #8a7345; }
	footer { border-top: 1px solid #eeddbc; background: #fffaf0; padding: 30px 0 40px; text-align: center; color: #a08a5a; font-size: 13px; }
	footer p + p { margin-top: 6px; }
	.sticky-cta { position: fixed; left: 0; right: 0; bottom: 0; z-index: 60; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 18px; background: rgba(255, 250, 240, 0.96); border-top: 1px solid #e8c477; backdrop-filter: blur(10px); }
	.s-price { font-size: 20px; font-weight: 800; color: #a5670a; line-height: 1.25; }
	.s-note { font-size: 11.5px; color: #8a7345; }
	.sticky-cta .btn { padding: 12px 24px; font-size: 15px; box-shadow: none; }
	@media (min-width: 720px) {
		.cards { grid-template-columns: repeat(3, 1fr); }
	}
	@media (min-width: 768px) {
		.sticky-cta { display: none; }
		body { padding-bottom: 0; }
		.hero { padding: 76px 0 60px; }
		.section { padding: 68px 0; }
	}`;

const HONEY_TRUST_HTML = `<div class="trust">
		<div class="wrap trust-inner">
			<span>🚚 التوصيل إلى 58 ولاية</span>
			<span>💵 الدفع عند الاستلام</span>
			<span>↩️ إرجاع سهل</span>
		</div>
	</div>`;

const HONEY_BENEFITS_HTML = `<section class="section">
		<div class="wrap">
			<div class="section-head">
				<p class="eyebrow">لماذا عسلنا مختلف؟</p>
				<h2>من الخلية إلى برطمانك، دون وسطاء</h2>
			</div>
			<div class="cards">
				<article class="card">
					<div class="ico">🌼</div>
					<h3>طبيعي 100٪</h3>
					<p>يُجنى يدويًا من أزهار جبلية برية في أعالي الأوراس، بعيدًا عن المبيدات والمزارع الصناعية.</p>
				</article>
				<article class="card">
					<div class="ico">🍯</div>
					<h3>بدون أي إضافات</h3>
					<p>لا سكر مضاف، لا تسخين، لا خلط — عسل خام يحتفظ بكل إنزيماته وفوائده كما أنتجته النحلة.</p>
				</article>
				<article class="card">
					<div class="ico">🔬</div>
					<h3>تحليل مخبري معتمد</h3>
					<p>كل دفعة مرفوقة بشهادة تحليل مخبري تثبت نقاء العسل وخلوّه من أي غش أو إضافات.</p>
				</article>
			</div>
		</div>
	</section>`;

export const HONEY_PAGES: Record<string, MockPage> = {
	"honey-1": {
		title: "عسل الأوراس الحر",
		lang: "ar",
		html: `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>عسل الأوراس الحر — 3&#8239;200 دج للكيلوغرام · الدفع عند الاستلام</title>
<style>
	${HONEY_CSS}
</style>
</head>
<body>
	<header class="site">
		<div class="wrap"><div class="brand">مناحل الأوراس<span class="bee">🐝</span></div></div>
	</header>

	<main>
		<section class="hero">
			<div class="wrap">
				<p class="eyebrow">من قلب جبال الأوراس</p>
				<h1>عسل حر طبيعي،<br>من الخلية إلى باب بيتك</h1>
				<p class="lead">عسل جبلي حر يُجنى يدويًا من مناحل عائلية في جبال الأوراس، دون تسخين ودون أي إضافات. اطلب الآن وادفع عند الاستلام.</p>
				<div class="jar" aria-hidden="true">
					<span class="jar-emoji">🍯</span>
					<span class="bee-fly">🐝</span>
					<span class="flower">🌼</span>
				</div>
				<div class="price-row">
					<span class="price">3&#8239;200 دج</span>
					<span class="unit">/ كيلوغرام</span>
					<span class="compare">4&#8239;000 دج</span>
				</div>
				<p><span class="chip">وفّر 800 دج على سعر الموسم</span></p>
				<p class="cta-row"><a class="btn" href="#commander">اطلب الآن — الدفع عند الاستلام</a></p>
			</div>
		</section>

		${HONEY_TRUST_HTML}

		${HONEY_BENEFITS_HTML}

		<section class="section">
			<div class="wrap">
				<div class="offer">
					<p class="eyebrow">عرض اليوم</p>
					<h2>برطمان 1 كغ — عسل حر خام</h2>
					<div class="price-row">
						<span class="price">3&#8239;200 دج</span>
						<span class="compare">4&#8239;000 دج</span>
					</div>
					<p><span class="chip">وفّر 800 دج</span></p>
					<ul>
						<li>برطمان زجاجي محكم الإغلاق</li>
						<li>شهادة تحليل مخبري مع كل طلب</li>
						<li>تغليف مقوّى يصل سليمًا إلى بابك</li>
						<li>التوصيل إلى 58 ولاية — الدفع عند الاستلام</li>
					</ul>
					<a class="btn btn-full" href="#commander">أطلب برطماني الآن</a>
					<p class="form-note">💵 لا تدفع أي شيء الآن — الدفع عند استلام الطلب.</p>
				</div>
			</div>
		</section>

		<section class="section">
			<div class="wrap">
				<div class="section-head">
					<p class="eyebrow">الطلب يستغرق أقل من دقيقة</p>
					<h2>اطلب الآن</h2>
					<p class="sub">املأ النموذج وسنتصل بك لتأكيد الطلب. الدفع عند الاستلام.</p>
				</div>
				<form id="commander" class="form-card" autocomplete="on">
					${HONEY_FORM_FIELDS}
					<button class="btn btn-full" type="submit">أؤكد طلبي — 3&#8239;200 دج</button>
					<p class="form-note">💵 الدفع عند الاستلام · بياناتك تبقى سرّية.</p>
				</form>
			</div>
		</section>
	</main>

	<footer>
		<div class="wrap">
			<p>© 2026 مناحل الأوراس — باتنة، الجزائر</p>
			<p>الدفع عند الاستلام في جميع الولايات · إرجاع سهل خلال 7 أيام</p>
		</div>
	</footer>

	<div class="sticky-cta">
		<div>
			<div class="s-price">3&#8239;200 دج</div>
			<div class="s-note">الدفع عند الاستلام</div>
		</div>
		<a class="btn" href="#commander">اطلب الآن</a>
	</div>

	${HONEY_FORM_SCRIPT}
</body>
</html>`,
	},

	"honey-2": {
		title: "عسل الأوراس الحر",
		lang: "ar",
		html: `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>عسل الأوراس الحر — ابتداءً من 1&#8239;800 دج · الدفع عند الاستلام</title>
<style>
	${HONEY_CSS}
	.badges { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; max-width: 720px; margin: 0 auto; }
	.badge { background: #fffaf0; border: 1px solid #eeddbc; border-radius: 14px; padding: 14px 12px; text-align: center; font-size: 13px; font-weight: 700; color: #6e5828; }
	.badge .b-ico { display: block; font-size: 22px; margin-bottom: 6px; }
	.reviews { display: grid; gap: 16px; }
	.review { background: #fffaf0; border: 1px solid #eeddbc; border-radius: 18px; padding: 24px 22px; box-shadow: 0 12px 28px rgba(160, 112, 30, 0.08); }
	.stars { color: #d9931f; letter-spacing: 4px; font-size: 14px; margin-bottom: 10px; }
	.review blockquote { color: #6e5828; font-size: 14.5px; margin-bottom: 14px; }
	.who { display: flex; align-items: center; gap: 10px; }
	.avatar { width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, #fbe4b0, #f3c264); color: #7a5410; font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: 15px; }
	.who-name { font-size: 13.5px; font-weight: 700; color: #5a430f; line-height: 1.4; }
	.who-city { font-size: 12px; color: #a08a5a; }
	.weights { display: grid; gap: 12px; margin-bottom: 22px; }
	.weight-slot { position: relative; }
	.weight-slot input { position: absolute; opacity: 0; pointer-events: none; }
	.weight { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #fdf7e9; border: 1px solid #e3cf9e; border-radius: 14px; padding: 15px 16px; cursor: pointer; position: relative; transition: border-color 0.15s ease, background 0.15s ease; }
	.weight-slot input:checked + .weight { border-color: #d9931f; background: #fbeecb; box-shadow: inset 0 0 0 1px #d9931f; }
	.w-name { display: block; font-size: 15.5px; font-weight: 800; color: #4a370f; }
	.w-sub { display: block; font-size: 12.5px; color: #96793e; margin-top: 2px; }
	.w-price { font-size: 18px; font-weight: 800; color: #a5670a; white-space: nowrap; }
	.pop { position: absolute; top: -10px; inset-inline-end: 14px; background: linear-gradient(135deg, #f2b64f, #d9931f); color: #3b2604; font-size: 10.5px; font-weight: 800; padding: 2px 10px; border-radius: 999px; }
	@media (min-width: 720px) {
		.reviews { grid-template-columns: repeat(3, 1fr); }
		.badges { grid-template-columns: repeat(4, 1fr); }
	}
</style>
</head>
<body>
	<header class="site">
		<div class="wrap"><div class="brand">مناحل الأوراس<span class="bee">🐝</span></div></div>
	</header>

	<main>
		<section class="hero">
			<div class="wrap">
				<p class="eyebrow">من قلب جبال الأوراس</p>
				<h1>عسل جبلي حر،<br>كما أنتجته النحلة تمامًا</h1>
				<p class="lead">يُجنى يدويًا من مناحل عائلية في أعالي الأوراس، بدون تسخين وبدون أي إضافات. اختر الحجم المناسب لعائلتك وادفع عند الاستلام.</p>
				<div class="jar" aria-hidden="true">
					<span class="jar-emoji">🍯</span>
					<span class="bee-fly">🐝</span>
					<span class="flower">🌼</span>
				</div>
				<div class="price-row">
					<span class="price">3&#8239;200 دج</span>
					<span class="unit">/ كيلوغرام</span>
					<span class="compare">4&#8239;000 دج</span>
				</div>
				<p><span class="chip">وفّر 800 دج على سعر الموسم</span></p>
				<p class="cta-row"><a class="btn" href="#commander">اطلب الآن — الدفع عند الاستلام</a></p>
			</div>
		</section>

		${HONEY_TRUST_HTML}

		<section class="section">
			<div class="wrap">
				<div class="badges">
					<div class="badge"><span class="b-ico">⭐</span>تقييم 4.9/5 من +380 زبونًا</div>
					<div class="badge"><span class="b-ico">🐝</span>عسل موسم جنْي 2026</div>
					<div class="badge"><span class="b-ico">🔬</span>تحليل مخبري معتمد</div>
					<div class="badge"><span class="b-ico">📦</span>+3&#8239;000 طلب مُسلَّم</div>
				</div>
			</div>
		</section>

		${HONEY_BENEFITS_HTML}

		<section class="section">
			<div class="wrap">
				<div class="section-head">
					<p class="eyebrow">آراء زبائننا</p>
					<h2>عائلات جزائرية وثقت بنا</h2>
				</div>
				<div class="reviews">
					<article class="review">
						<div class="stars">★★★★★</div>
						<blockquote>العسل ممتاز، طعمه يذكّرني بعسل جدّي في القرية. وصلني الطلب إلى الجزائر العاصمة في يومين فقط.</blockquote>
						<div class="who">
							<div class="avatar">أ</div>
							<div>
								<div class="who-name">أم أيوب</div>
								<div class="who-city">الجزائر</div>
							</div>
						</div>
					</article>
					<article class="review">
						<div class="stars">★★★★★</div>
						<blockquote>جربت الكثير من الأنواع، هذا أول عسل أحسست فيه بالفرق فعلًا. التغليف كان محكمًا والتحليل المخبري مرفق.</blockquote>
						<div class="who">
							<div class="avatar">ي</div>
							<div>
								<div class="who-name">يوسف ب.</div>
								<div class="who-city">سطيف</div>
							</div>
						</div>
					</article>
					<article class="review">
						<div class="stars">★★★★★</div>
						<blockquote>طلبت 500 غرام للتجربة ثم أعدت الطلب 2 كغ مباشرة. أنصح به للأطفال في فصل الشتاء.</blockquote>
						<div class="who">
							<div class="avatar">س</div>
							<div>
								<div class="who-name">سمية ك.</div>
								<div class="who-city">وهران</div>
							</div>
						</div>
					</article>
				</div>
			</div>
		</section>

		<section class="section">
			<div class="wrap">
				<div class="offer">
					<p class="eyebrow">كل طلب يشمل</p>
					<h2>جودة نضمنها حتى باب بيتك</h2>
					<ul>
						<li>برطمان زجاجي محكم الإغلاق</li>
						<li>شهادة تحليل مخبري مع كل طلب</li>
						<li>تغليف مقوّى يصل سليمًا إلى بابك</li>
						<li>التوصيل إلى 58 ولاية — الدفع عند الاستلام</li>
					</ul>
					<a class="btn btn-full" href="#commander">اختر الحجم المناسب</a>
					<p class="form-note">💵 لا تدفع أي شيء الآن — الدفع عند استلام الطلب.</p>
				</div>
			</div>
		</section>

		<section class="section">
			<div class="wrap">
				<div class="section-head">
					<p class="eyebrow">الطلب يستغرق أقل من دقيقة</p>
					<h2>اختر الحجم واطلب الآن</h2>
					<p class="sub">املأ النموذج وسنتصل بك لتأكيد الطلب. الدفع عند الاستلام.</p>
				</div>
				<form id="commander" class="form-card" autocomplete="on">
					<div class="weights">
						<div class="weight-slot">
							<input type="radio" name="poids" id="poids-500" value="500g" data-prix="1&#8239;800 دج">
							<label class="weight" for="poids-500">
								<span>
									<span class="w-name">500 غ</span>
									<span class="w-sub">للتجربة الأولى</span>
								</span>
								<span class="w-price">1&#8239;800 دج</span>
							</label>
						</div>
						<div class="weight-slot">
							<input type="radio" name="poids" id="poids-1000" value="1kg" data-prix="3&#8239;200 دج" checked>
							<label class="weight" for="poids-1000">
								<span class="pop">الأكثر طلبًا</span>
								<span>
									<span class="w-name">1 كغ</span>
									<span class="w-sub">الحجم العائلي المثالي</span>
								</span>
								<span class="w-price">3&#8239;200 دج</span>
							</label>
						</div>
						<div class="weight-slot">
							<input type="radio" name="poids" id="poids-2000" value="2kg" data-prix="5&#8239;900 دج">
							<label class="weight" for="poids-2000">
								<span>
									<span class="w-name">2 كغ</span>
									<span class="w-sub">وفّر 500 دج على سعر الكيلوغرام</span>
								</span>
								<span class="w-price">5&#8239;900 دج</span>
							</label>
						</div>
					</div>
					${HONEY_FORM_FIELDS}
					<button class="btn btn-full" type="submit">أؤكد طلبي — <span id="total-commande">3&#8239;200 دج</span></button>
					<p class="form-note">💵 الدفع عند الاستلام · بياناتك تبقى سرّية.</p>
				</form>
			</div>
		</section>
	</main>

	<footer>
		<div class="wrap">
			<p>© 2026 مناحل الأوراس — باتنة، الجزائر</p>
			<p>الدفع عند الاستلام في جميع الولايات · إرجاع سهل خلال 7 أيام</p>
		</div>
	</footer>

	<div class="sticky-cta">
		<div>
			<div class="s-price">ابتداءً من 1&#8239;800 دج</div>
			<div class="s-note">الدفع عند الاستلام</div>
		</div>
		<a class="btn" href="#commander">اطلب الآن</a>
	</div>

	<script>
		(function () {
			var form = document.getElementById("commander");
			if (!form) return;
			var total = document.getElementById("total-commande");
			var radios = form.querySelectorAll('input[name="poids"]');
			for (var i = 0; i < radios.length; i++) {
				radios[i].addEventListener("change", function () {
					if (total) total.textContent = this.getAttribute("data-prix");
				});
			}
			form.addEventListener("submit", function (event) {
				event.preventDefault();
				var honeypot = form.querySelector('input[name="website"]');
				if (honeypot && honeypot.value) return;
				form.innerHTML = '<div class="form-success"><div class="form-success-icon">✅</div><h3>تم استلام طلبك ✅</h3><p>سنتصل بك هاتفيًا لتأكيد الطلب.</p></div>';
				form.scrollIntoView({ behavior: "smooth", block: "center" });
			});
		})();
	</script>
</body>
</html>`,
	},
};
