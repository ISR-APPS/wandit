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
		var MAX_PAYLOAD_BYTES = 12 * 1024;
		var MAX_RETRY_AFTER_MS = 2000;
		var RETRY_DELAYS_MS = [250, 750];
		var sentAt = {};
		var inFlight = {};
		var pendingPayloads = {};
		var beaconedPayloads = {};
		var pendingSend = null;
		var converted = {};

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

		function utf8Size(value) {
			var size = 0;
			for (var i = 0; i < value.length; i++) {
				var code = value.charCodeAt(i);
				if (code < 128) {
					size += 1;
				} else if (code < 2048) {
					size += 2;
				} else if (
					code >= 55296 &&
					code <= 56319 &&
					i + 1 < value.length
				) {
					var next = value.charCodeAt(i + 1);
					if (next >= 56320 && next <= 57343) {
						size += 4;
						i += 1;
					} else {
						size += 3;
					}
				} else {
					size += 3;
				}
			}
			return size;
		}

		// Preserve the canonical lead fields. Extras are lowest priority, then
		// optional attribution fields, so both fetch and beacon stay below the
		// public endpoint's tight text-body limit.
		function serializeWithinLimit(body) {
			var payload = JSON.stringify(body);
			var keys;
			while (utf8Size(payload) > MAX_PAYLOAD_BYTES && body.extras) {
				keys = Object.keys(body.extras);
				if (keys.length === 0) {
					delete body.extras;
				} else {
					delete body.extras[keys[keys.length - 1]];
				}
				payload = JSON.stringify(body);
			}
			while (utf8Size(payload) > MAX_PAYLOAD_BYTES && body.attribution) {
				keys = Object.keys(body.attribution);
				if (keys.length === 0) {
					delete body.attribution;
				} else {
					delete body.attribution[keys[keys.length - 1]];
				}
				payload = JSON.stringify(body);
			}
			return payload;
		}

		function wait(ms) {
			return new Promise(function (resolve) {
				setTimeout(resolve, ms);
			});
		}

		function retryDelay(response, attempt) {
			var fallback = RETRY_DELAYS_MS[attempt] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
			try {
				var header = response && response.headers && response.headers.get("Retry-After");
				if (!header) return fallback;
				var seconds = Number(header);
				if (isFinite(seconds) && seconds >= 0) {
					return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
				}
				var dateMs = Date.parse(header);
				if (!isNaN(dateMs)) {
					return Math.min(Math.max(0, dateMs - Date.now()), MAX_RETRY_AFTER_MS);
				}
			} catch (ignored) {}
			return fallback;
		}

		function postWithRetry(payload, attempt) {
			var request;
			try {
				request = fetch(captureUrl, {
					method: "POST",
					mode: "cors",
					credentials: "omit",
					keepalive: true,
					headers: { "Content-Type": "application/json" },
					body: payload
				});
			} catch (error) {
				request = Promise.reject(error);
			}
			return Promise.resolve(request).then(function (response) {
				var status = response && response.status;
				if (status >= 200 && status < 300) return true;
				var retryable = status === 429 || (status >= 500 && status < 600);
				if (!retryable || attempt >= RETRY_DELAYS_MS.length) return false;
				return wait(retryDelay(response, attempt)).then(function () {
					return postWithRetry(payload, attempt + 1);
				});
			}, function () {
				if (attempt >= RETRY_DELAYS_MS.length) return false;
				return wait(RETRY_DELAYS_MS[attempt]).then(function () {
					return postWithRetry(payload, attempt + 1);
				});
			});
		}

		// Ad-pixel conversion: fired ONCE per accepted lead send, only after
		// the capture endpoint answered 2xx — never on the raw submit, never
		// on the same-phone dedupe path, and never for a honeypot-trapped
		// send (the server answers 200 to keep bots blind, but stores no
		// lead). A localStorage stamp extends the dedupe across reloads so a
		// resubmit-after-refresh cannot double-count. The base codes
		// (fbq/ttq) are injected at publish time by pixel-injector.ts;
		// feature-detect so pages without pixels stay silent.
		function fireLeadConversion(digits) {
			if (converted[digits]) return;
			converted[digits] = true;
			try {
				var storageKey = "wandit:lead:conv:" + digits;
				var last = Number(localStorage.getItem(storageKey));
				if (isFinite(last) && Date.now() - last < DEDUPE_WINDOW_MS) return;
				localStorage.setItem(storageKey, String(Date.now()));
			} catch (ignored) {}
			try {
				if (typeof window.fbq === "function") {
					window.fbq("track", "Lead");
				}
			} catch (ignored) {}
			try {
				if (window.ttq && typeof window.ttq.track === "function") {
					window.ttq.track("Lead");
				}
			} catch (ignored) {}
		}

		function send(lead) {
			var phone = clip(lead.phone, 40);
			if (!phone) return Promise.resolve(false);
			var digits = phoneDigits(phone);
			var now = Date.now();
			if (
				typeof sentAt[digits] === "number" &&
				now - sentAt[digits] < DEDUPE_WINDOW_MS
			) {
				return Promise.resolve(true);
			}
			if (inFlight[digits]) return inFlight[digits];
			var body = { phone: phone };
			var name = clip(lead.name, 200);
			if (name) body.name = name;
			var wilaya = clip(lead.wilaya, 120);
			if (wilaya) body.wilaya = wilaya;
			var commune = clip(lead.commune, 120);
			if (commune) body.commune = commune;
			if (lead.extras && Object.keys(lead.extras).length > 0) {
				body.extras = {};
				var extraKeys = Object.keys(lead.extras);
				for (var i = 0; i < extraKeys.length; i++) {
					body.extras[extraKeys[i]] = lead.extras[extraKeys[i]];
				}
			}
			var attribution = collectAttribution();
			if (Object.keys(attribution).length > 0) body.attribution = attribution;
			var hp = readHoneypot();
			if (hp) body._hp = hp;
			var payload = serializeWithinLimit(body);
			pendingPayloads[digits] = payload;
			delete beaconedPayloads[digits];
			var request = postWithRetry(payload, 0).then(function (ok) {
				if (ok) {
					sentAt[digits] = Date.now();
					// A filled honeypot means the server accepted the request but
					// silently dropped the lead — no conversion for a trapped bot.
					if (!hp) fireLeadConversion(digits);
				}
				return ok;
			}, function () {
				return false;
			});
			inFlight[digits] = request;
			request.then(function (ok) {
				if (inFlight[digits] === request) delete inFlight[digits];
				if (ok && pendingPayloads[digits] === payload) {
					delete pendingPayloads[digits];
				}
			});
			return request;
		}

		function dispatchResult(ok) {
			try {
				document.dispatchEvent(new CustomEvent("wandit:lead:result", {
					detail: { ok: ok === true }
				}));
			} catch (ignored) {}
		}

		function sendAndReport(lead) {
			try {
				send(lead).then(function (ok) {
					dispatchResult(ok);
				}, function () {
					dispatchResult(false);
				});
			} catch (ignored) {
				dispatchResult(false);
			}
		}

		function sendPendingWithBeacon() {
			try {
				if (!navigator.sendBeacon) return;
				var keys = Object.keys(pendingPayloads);
				for (var i = 0; i < keys.length; i++) {
					var key = keys[i];
					var payload = pendingPayloads[key];
					if (beaconedPayloads[key] === payload) continue;
					if (navigator.sendBeacon(captureUrl, payload)) {
						beaconedPayloads[key] = payload;
					}
				}
			} catch (ignored) {}
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
				sendAndReport(lead);
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
						sendAndReport(lead);
					} catch (ignored) {}
				}, HEURISTIC_DELAY_MS);
			} catch (ignored) {}
		}, true);

		if (typeof window !== "undefined" && window.addEventListener) {
			window.addEventListener("pagehide", sendPendingWithBeacon);
		}
	} catch (ignored) {}
})();`;
}
