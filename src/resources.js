// Static MCP resources (the methodology docs) and prompts (canned workflows). Resource URIs are
// the public doc URLs; resources/read serves the bytes from the ASSETS binding — our own static
// files, not a live external lookup, so the no-network principle holds.
export const RESOURCES = [
  { uri: "https://nestegg.money/docs/calculators.md", path: "/docs/calculators.md", name: "Calculator reference", mimeType: "text/markdown", description: "Inputs, outputs, formula, and rounding for every calculator." },
  { uri: "https://nestegg.money/llms.txt", path: "/llms.txt", name: "llms.txt", mimeType: "text/plain", description: "Agent-oriented index of the calculators and API." },
];

export const PROMPTS = [
  {
    name: "mortgage-plan", description: "Plan or review a mortgage repayment.",
    arguments: [{ name: "amount", description: "Loan principal", required: true }, { name: "rate", description: "Annual rate %", required: true }],
    template: "Use the amortization tool to build a repayment summary for a {amount} loan at {rate}% annual interest. Ask me for the term or monthly payment and the start date, then show the yearly totals and the payoff date. Offer to drill into a specific year (detail=monthly).",
  },
  {
    name: "fire-check", description: "Check progress toward financial independence.",
    arguments: [{ name: "annualSpend", description: "Yearly spending in retirement", required: true }],
    template: "Use fire-number with annualSpend {annualSpend}. Ask for my current savings, annual contribution, and expected return, then report my target nest egg, the gap from today, and the years to financial independence.",
  },
  {
    name: "brutto-netto", description: "Estimate a German net (Netto) salary.",
    arguments: [{ name: "gross", description: "Gross annual salary", required: true }],
    template: "Estimate my German net salary from a gross of {gross}. Look up the current year's statutory rates and contribution ceilings, ask me for my Steuerklasse, church membership, Bundesland, children, and whether my health insurance is statutory or private, then call de-gross-to-net and show the breakdown.",
  },
];
