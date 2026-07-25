/**
 * Publish-time lead-capture runtime (docs/features/leads-crm.md).
 *
 * Builds the INLINE script injected into every published page: no imports, no
 * dependencies, one IIFE, and every async entry point (event handlers, the
 * deferred send) carries its own try/catch so a runtime failure can never
 * break a merchant's page. Plain exported function, NO NestJS DI on purpose
 * (precedent: stampHtml) — the Nest publish pipeline and Trigger.dev tasks
 * share it.
 *
 * Two capture paths feed one send() deduped by normalized phone digits:
 * - Event path (authoritative, new pages): a `wandit:lead` CustomEvent whose
 *   flat detail carries the four canonical fields plus scalar extras.
 * - Heuristic fallback (pages generated before the form contract): observe
 *   any form submit in capture phase, classify fields by key, and send after
 *   a grace window that a `wandit:lead` event cancels.
 *
 * The payload matches leadCaptureBodySchema (@wandit/contracts) — values are
 * clipped client-side to the contract caps so a valid lead is never rejected
 * for length.
 */
export function buildLeadsRuntimeScript(options: {
	captureUrl: string;
}): string {
	// JSON-escape, then fold "<" to \u003c so no URL can ever smuggle a
	// script-close sequence into the inline tag.
	const captureUrl = JSON.stringify(options.captureUrl).replace(
		/</g,
		"\\u003c",
	);

	// NOTE: this is a template literal — backslashes meant for the script must
	// be doubled (\\s below), and the script text must never contain a
	// backtick, "${", or a literal script-close tag.
	return `(function () {
	try {
		var captureUrl = ${captureUrl};
		var DEDUPE_WINDOW_MS = 120000;
		var HEURISTIC_DELAY_MS = 2500;
		var sentAt = {};
		var pendingSend = null;

		// Arabic-Indic (U+0660-0669) and Eastern Arabic-Indic (U+06F0-06F9)
		// digits fold to ASCII; every other non-digit character is dropped.
		function phoneDigits(value) {
			var out = "";
			for (var i = 0; i < value.length; i++) {
				var code = value.charCodeAt(i);
				if (code >= 48 && code <= 57) {
					out += value.charAt(i);
				} else if (code >= 1632 && code <= 1641) {
					out += String.fromCharCode(code - 1584);
				} else if (code >= 1776 && code <= 1785) {
					out += String.fromCharCode(code - 1728);
				}
			}
			return out;
		}

		function clip(value, max) {
			return String(value == null ? "" : value).trim().slice(0, max);
		}

		// Tighter than the server contract (40 keys / 500 chars) on purpose:
		// this feeds a jsonb column through an unauthenticated endpoint.
		function addExtra(extras, key, value) {
			var safeKey = clip(key, 80);
			if (!safeKey || Object.keys(extras).length >= 25) return;
			if (typeof value === "string") {
				var safeValue = clip(value, 300);
				if (safeValue) extras[safeKey] = safeValue;
			} else if (
				typeof value === "number" ||
				typeof value === "boolean" ||
				value === null
			) {
				extras[safeKey] = value;
			}
		}

		function collectAttribution() {
			var out = {};
			try {
				var query = new URLSearchParams(location.search);
				var utmKeys = [
					"utm_source",
					"utm_medium",
					"utm_campaign",
					"utm_term",
					"utm_content"
				];
				for (var i = 0; i < utmKeys.length; i++) {
					var utm = query.get(utmKeys[i]);
					if (utm) out[utmKeys[i]] = utm.slice(0, 500);
				}
				var fbclid = query.get("fbclid");
				if (fbclid) out.fbclid = fbclid.slice(0, 1000);
				var ttclid = query.get("ttclid");
				if (ttclid) out.ttclid = ttclid.slice(0, 1000);
			} catch (ignored) {}
			try {
				if (document.referrer) out.referrer = String(document.referrer).slice(0, 2000);
				if (location.href) out.landing_url = String(location.href).slice(0, 2000);
			} catch (ignored) {}
			return out;
		}

		function readHoneypot() {
			try {
				var decoy = document.querySelector("[data-wandit-hp]");
				if (decoy && typeof decoy.value === "string") return decoy.value.slice(0, 500);
			} catch (ignored) {}
			return "";
		}

		function send(lead) {
			var phone = clip(lead.phone, 40);
			if (!phone) return;
			var digits = phoneDigits(phone);
			var now = Date.now();
			if (sentAt[digits] && now - sentAt[digits] < DEDUPE_WINDOW_MS) return;
			sentAt[digits] = now;
			var body = { phone: phone };
			var name = clip(lead.name, 200);
			if (name) body.name = name;
			var wilaya = clip(lead.wilaya, 120);
			if (wilaya) body.wilaya = wilaya;
			var commune = clip(lead.commune, 120);
			if (commune) body.commune = commune;
			if (lead.extras && Object.keys(lead.extras).length > 0) body.extras = lead.extras;
			body.attribution = collectAttribution();
			var hp = readHoneypot();
			if (hp) body._hp = hp;
			var payload = JSON.stringify(body);
			// A bare string body posts as text/plain — a CORS simple request
			// with no preflight, which the capture endpoint parses. Never
			// "fix" this by adding a JSON content type.
			var delivered = false;
			try {
				if (navigator.sendBeacon) delivered = navigator.sendBeacon(captureUrl, payload);
			} catch (ignored) {
				delivered = false;
			}
			if (!delivered) {
				try {
					fetch(captureUrl, {
						method: "POST",
						mode: "no-cors",
						keepalive: true,
						body: payload
					}).catch(function () {});
				} catch (ignored) {}
			}
		}

		function cancelPendingSend() {
			if (pendingSend !== null) {
				clearTimeout(pendingSend);
				pendingSend = null;
			}
		}

		document.addEventListener("wandit:lead", function (event) {
			try {
				// The event path is authoritative — drop any scheduled
				// heuristic send for the same submit.
				cancelPendingSend();
				var detail = event && event.detail;
				if (!detail || typeof detail !== "object") return;
				var lead = { name: "", phone: "", wilaya: "", commune: "", extras: {} };
				for (var key in detail) {
					if (key === "name" || key === "phone" || key === "wilaya" || key === "commune") {
						lead[key] = clip(detail[key], 500);
					} else {
						addExtra(lead.extras, key, detail[key]);
					}
				}
				send(lead);
			} catch (ignored) {}
		});

		function fieldKey(field) {
			var key = field.getAttribute("data-lead-field") || field.name || field.id;
			if (key) return String(key);
			try {
				var label = (field.labels && field.labels[0]) || (field.closest && field.closest("label"));
				if (label && label.textContent) return label.textContent.replace(/\\s+/g, " ").trim();
			} catch (ignored) {}
			return "";
		}

		function leadFromForm(form) {
			var lead = { name: "", phone: "", wilaya: "", commune: "", extras: {} };
			var fields = form.querySelectorAll("input, select, textarea");
			for (var i = 0; i < fields.length; i++) {
				var field = fields[i];
				if (field.disabled || field.hasAttribute("data-wandit-hp")) continue;
				var type = String(field.type || "").toLowerCase();
				if (type === "hidden" || type === "password" || type === "file") continue;
				if (type === "submit" || type === "button" || type === "reset" || type === "image") continue;
				if ((type === "checkbox" || type === "radio") && !field.checked) continue;
				var value = typeof field.value === "string" ? field.value.trim() : "";
				if (!value) continue;
				var key = fieldKey(field);
				var autocomplete = String(field.getAttribute("autocomplete") || "").toLowerCase();
				if (!lead.phone && (type === "tel" || /phone|tel|mobile|هاتف/i.test(key))) {
					lead.phone = value;
				} else if (!lead.name && (autocomplete === "name" || /^(full[-_ ]?)?name$|nom|اسم/i.test(key))) {
					lead.name = value;
				} else if (!lead.wilaya && /wilaya|ولاية/i.test(key)) {
					lead.wilaya = value;
				} else if (!lead.commune && /commune|بلدية/i.test(key)) {
					lead.commune = value;
				} else {
					addExtra(lead.extras, key, value);
				}
			}
			return lead;
		}

		// Capture phase: page handlers that stopPropagation cannot hide the
		// submit from the fallback.
		document.addEventListener("submit", function (event) {
			try {
				var form = event.target;
				if (!form || String(form.nodeName || "").toUpperCase() !== "FORM") return;
				var lead = leadFromForm(form);
				if (phoneDigits(lead.phone).length < 8) return;
				cancelPendingSend();
				// Grace window: if the page also emits wandit:lead for this
				// submit, that path cancels this fallback.
				pendingSend = setTimeout(function () {
					pendingSend = null;
					try {
						send(lead);
					} catch (ignored) {}
				}, HEURISTIC_DELAY_MS);
			} catch (ignored) {}
		}, true);
	} catch (ignored) {}
})();`;
}
