// The basket of the home page: the list of the pieces that the visitor wants to reserve.
// LandingPage wraps the page in ReservationProvider. The header chip, each reserve button, and the reservation ledger read it.
// The list lives in React state only. Nothing goes to a server: the visitor sends the list by email or by telephone.
import {
	createContext,
	type ReactNode,
	useContext,
	useMemo,
	useState,
} from "react";
import { MAX_RESERVED_PIECES, type PieceRef } from "../lib/pieces";

/** The basket and its one action. */
type Reservation = {
	/** The references on the list, in the order of the clicks. */
	refs: readonly PieceRef[];
	/** True when the list holds the three pieces that one reservation allows. */
	isFull: boolean;
	/** Adds a reference, or removes it when it is on the list. A full list takes no new reference. */
	toggle: (ref: PieceRef) => void;
};

const ReservationContext = createContext<Reservation | undefined>(undefined);

/** Holds the basket for the page below it. A page reload empties the basket. */
export function ReservationProvider({ children }: { children: ReactNode }) {
	const [refs, setRefs] = useState<readonly PieceRef[]>([]);
	const value = useMemo<Reservation>(
		() => ({
			refs,
			isFull: refs.length >= MAX_RESERVED_PIECES,
			toggle: (ref) => {
				setRefs((current) => {
					if (current.includes(ref)) {
						return current.filter((other) => other !== ref);
					}
					// The shop holds three pieces at most for one visitor.
					return current.length >= MAX_RESERVED_PIECES
						? current
						: [...current, ref];
				});
			},
		}),
		[refs],
	);
	return (
		<ReservationContext.Provider value={value}>
			{children}
		</ReservationContext.Provider>
	);
}

/** Returns the basket. Throws outside ReservationProvider. */
export function useReservation(): Reservation {
	const reservation = useContext(ReservationContext);
	if (reservation === undefined) {
		throw new Error("useReservation must be used within ReservationProvider");
	}
	return reservation;
}
