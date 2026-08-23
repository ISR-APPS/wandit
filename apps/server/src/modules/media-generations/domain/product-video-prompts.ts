export type ProductVideoPreset = "orbit" | "hero" | "lifestyle";

export const PRODUCT_VIDEO_IDENTITY_LAW =
	"The product is exactly the one in the reference image: same shape, same proportions, same colors, same materials, same ports, buttons and markings. Do not redesign the product. Do not add on-screen text, captions, subtitles, watermarks or user interface. Do not invent logos or labels; only markings physically present on the product in the reference image may appear.";

const PRODUCT_VIDEO_SCENE_BY_PRESET = {
	orbit:
		"The camera orbits slowly around the product in one smooth continuous studio commercial move, revealing every side while keeping it clearly framed and fully visible. The product rests centered on a seamless matte pedestal against a soft gradient studio background. Soft key light and a gentle rim light shape the silhouette, with crisp controlled reflections tracing the edges. The atmosphere stays calm, premium, minimal, and physically realistic throughout.",
	hero: "The low-angle camera pushes in slowly toward the product in one smooth continuous cinematic hero shot, keeping it clearly framed beneath a focused spotlight. The background falls into deep, soft shadow without a cut. Faint dust motes drift naturally through the beam, adding depth without obscuring the product. At the end, a subtle controlled light sweep crosses the front face and settles into a confident premium finish.",
	lifestyle:
		"The camera glides slowly sideways past the product in one smooth continuous lifestyle commercial shot, keeping it clearly recognizable while the environment moves gently in parallax. The product rests on a clean surface near a window in a bright real-world setting that naturally fits its use. Natural daylight and shallow depth of field separate the product from the background. The atmosphere remains warm, inviting, believable, and uncluttered throughout.",
} as const satisfies Record<ProductVideoPreset, string>;

/** Builds the immutable provider prompt without an LLM director call. */
export function buildProductVideoPrompt(input: {
	preset: ProductVideoPreset;
	productName: string;
	productDetails?: string;
}): string {
	const productLine = input.productDetails
		? `The product is ${input.productName}. Real product facts: ${input.productDetails}.`
		: `The product is ${input.productName}.`;

	return `${PRODUCT_VIDEO_SCENE_BY_PRESET[input.preset]} ${productLine} ${PRODUCT_VIDEO_IDENTITY_LAW}`;
}
