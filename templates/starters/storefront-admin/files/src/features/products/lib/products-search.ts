// The search params of the product page: the open product lives in the URL, as /app/products?product=prod-04.
// The /app/products route validates the URL with this schema. The order page links to a product with it.
import { z } from "zod";

/** `product` is absent while the dialog is closed. An id with no row also keeps the dialog closed. */
export const productsSearchSchema = z.object({
	product: z.string().max(40).optional().catch(undefined),
});
