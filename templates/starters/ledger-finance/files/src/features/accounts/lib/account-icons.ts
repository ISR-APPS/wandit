// The icon and the Badge variant of each kind of account.
// The account rows and the account detail page read them.
import {
	BankIcon,
	CreditCardIcon,
	MoneyIcon,
	VaultIcon,
} from "@phosphor-icons/react";
import type { AccountType } from "~/features/ledger";
import type { KitIcon } from "~/shared/ui/icons";

/** One icon per kind of account, named after the object: a bank, a vault, a card, and bank notes. */
export const ACCOUNT_TYPE_ICONS = {
	checking: BankIcon,
	savings: VaultIcon,
	credit_card: CreditCardIcon,
	cash: MoneyIcon,
} satisfies Record<AccountType, KitIcon>;
