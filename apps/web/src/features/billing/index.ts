// Public surface consumed by other features. Pages are never exported from barrels.

// Wallet of the active workspace (balance, paid owner flag, Starter pass flag, top-up limits), the local
// pricing answer, and the DZD rate for every visitor (null when the API has no SlickPay key).
export {
	useBillingWalletQuery,
	useDzdPerUsdRate,
	useLocalPricingQuery,
} from "./api/billing.queries";
// Opens the top-up dialog. The credits surfaces, the landing pricing page, and the builder call it.
// While the wallet says `starterPassRequired`, the dialog sells only the Starter pass.
export { useBillingModal } from "./components/billing-modal-provider";
// The top-up kit: the amount picker (Spark Meter or compact) and the receipt. The /pricing page renders both.
export { TopupAmountPicker } from "./components/topup-amount-picker";
export { TopupReceipt } from "./components/topup-receipt";
// Opens the top-up dialog for a 402 answer; the V2 builder chat calls it.
export { dispatchBillingError } from "./lib/billing-error-dispatch";
// Price text of a USD amount: DZD when the rate is known, else USD. And "$20 · 5 000 DZD" for USD with DZD.
export { formatLocalPrice, formatUsdAndDzd } from "./lib/price-format";
// False when no top-up method is on: callers hide their top-up buttons.
export { usePurchasesEnabled } from "./lib/purchases";
