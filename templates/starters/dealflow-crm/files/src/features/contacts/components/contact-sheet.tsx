// The contact sheet: the side sheet that holds the contact panel of one person.
// ContactsPage opens it when the user clicks a person in the people table.
import { Sheet, SheetContent } from "~/shared/ui/sheet";
import type { Contact } from "../api/contacts.queries";
import { ContactPanel } from "./contact-panel";

type ContactSheetProps = {
	/** The person to show. It stays set while the sheet closes, so the content does not empty during the slide. */
	contact: Contact | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

/** A controlled sheet at the end side. It renders no panel before the first click on a name. */
export function ContactSheet({
	contact,
	open,
	onOpenChange,
}: ContactSheetProps) {
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
				{contact ? <ContactPanel key={contact.id} contact={contact} /> : null}
			</SheetContent>
		</Sheet>
	);
}
