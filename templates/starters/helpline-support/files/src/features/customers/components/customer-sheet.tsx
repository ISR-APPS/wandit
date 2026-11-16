// The side sheet of one customer. CustomersPage opens it from a company name or from the `?customer=` param.
// It holds a CustomerPanel. The sheet slides in from the end side.
import { Sheet, SheetContent } from "~/shared/ui/sheet";
import type { CustomerListItem } from "../api/customers.queries";
import { CustomerPanel } from "./customer-panel";

type CustomerSheetProps = {
	/** The customer to show, or null when the param names no customer. */
	customer: CustomerListItem | null;
	onClose: () => void;
};

/** A controlled sheet: open while a customer is selected. */
export function CustomerSheet({ customer, onClose }: CustomerSheetProps) {
	return (
		<Sheet
			open={customer !== null}
			onOpenChange={(open) => (open ? undefined : onClose())}
		>
			<SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
				{customer ? (
					<CustomerPanel key={customer.id} customer={customer} />
				) : null}
			</SheetContent>
		</Sheet>
	);
}
