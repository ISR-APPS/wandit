import sanitizeHtml from "sanitize-html";

const allowedTags = [
	"p",
	"h1",
	"h2",
	"h3",
	"h4",
	"strong",
	"b",
	"em",
	"i",
	"u",
	"s",
	"a",
	"ul",
	"ol",
	"li",
	"blockquote",
	"code",
	"pre",
	"img",
	"hr",
	"br",
	"span",
];

/** Sanitizes administrator-authored guide HTML before it is persisted. */
export function sanitizeAcademyGuideHtml(html: string): string {
	return sanitizeHtml(html, {
		allowedAttributes: {
			a: ["href", "rel", "target"],
			img: ["src", "alt", "title", "width", "height"],
		},
		allowedSchemes: ["https", "http", "mailto"],
		allowedSchemesByTag: {
			a: ["https", "http", "mailto"],
			img: ["https"],
		},
		allowedTags,
		allowProtocolRelative: false,
		parseStyleAttributes: false,
		transformTags: {
			a: (_tagName, attributes) => ({
				attribs: {
					...attributes,
					rel: "noopener noreferrer nofollow",
					target: "_blank",
				},
				tagName: "a",
			}),
			img: (_tagName, attributes) => {
				const transformedAttributes = { ...attributes };

				if (
					transformedAttributes.src !== undefined &&
					!isAbsoluteHttpsUrl(transformedAttributes.src)
				) {
					delete transformedAttributes.src;
				}

				return { attribs: transformedAttributes, tagName: "img" };
			},
		},
	});
}

/** Returns whether sanitized guide HTML has neither visible text nor an image. */
export function isAcademyGuideHtmlEmpty(html: string): boolean {
	if (/<img(?:\s|\/?>)/iu.test(html)) {
		return false;
	}

	const text = sanitizeHtml(html, {
		allowedAttributes: {},
		allowedTags: [],
	});

	return (
		text.replace(
			/[\s\u00a0\u2000-\u200d\u2028\u2029\u202f\u205f\u2060\ufeff]/gu,
			"",
		) === ""
	);
}

function isAbsoluteHttpsUrl(value: string): boolean {
	try {
		return new URL(value).protocol === "https:";
	} catch {
		return false;
	}
}
