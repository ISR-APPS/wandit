// The customer sheet: the side sheet that holds the panel of one customer.
// CustomersPage opens it when the URL names a customer: after a click on a name, or from a link of the order page.
import { Sheet, SheetContent } from "~/shared/ui/sheet";
import type { Customer } from "../api/customers.queries";
import { CustomerPanel } from "./customer-panel";

type CustomerSheetProps = {
	/** The customer to show. It stays set while the sheet closes, so the content does not empty during the slide. */
	customer: Customer | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

/** A controlled sheet at the end side. It renders no panel before a customer is named. */
export function CustomerSheet({
	customer,
	open,
	onOpenChange,
}: CustomerSheetProps) {
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
				{customer ? (
					<CustomerPanel key={customer.id} customer={customer} />
				) : null}
			</SheetContent>
		</Sheet>
	);
}
