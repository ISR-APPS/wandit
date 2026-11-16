// The sample agents of the agency: the people who hold the listings, answer the leads, and run the viewings.
// The other sample modules give each row one agent id. The pages show the name and the initials.
// To make it real: this list becomes the table `agents`, or the profiles of the team.

/** The roles of the team. The label is the message key `agency.roles.<role>`. */
export const AGENT_ROLES = ["manager", "senior", "agent"] as const;

/** One role of the team. */
export type AgentRole = (typeof AGENT_ROLES)[number];

/** One person of the agency team. */
export type Agent = {
	/** Stable id, for example "agent-3". Listings, leads, and viewings point to it. */
	id: string;
	fullName: string;
	role: AgentRole;
	/** Share of the new listings that this agent gets. A higher number means more listings. */
	listingShare: number;
};

/** The six people of the team. The names are fictional. */
export const AGENTS = [
	{
		id: "agent-1",
		fullName: "Maren Holloway",
		role: "manager",
		listingShare: 2,
	},
	{ id: "agent-2", fullName: "Teodor Vance", role: "senior", listingShare: 5 },
	{ id: "agent-3", fullName: "Priya Raman", role: "senior", listingShare: 5 },
	{
		id: "agent-4",
		fullName: "Callum Whitlock",
		role: "agent",
		listingShare: 4,
	},
	{ id: "agent-5", fullName: "Inès Morel", role: "agent", listingShare: 4 },
	{ id: "agent-6", fullName: "Jonah Abara", role: "agent", listingShare: 3 },
] as const satisfies readonly [Agent, ...Agent[]];

/** The agent with this id. An unknown id gives the first agent, so a row always has a name. */
export function findAgent(agentId: string): Agent {
	return AGENTS.find((agent) => agent.id === agentId) ?? AGENTS[0];
}
