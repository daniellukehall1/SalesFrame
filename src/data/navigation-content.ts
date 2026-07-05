export const viewLabels: Record<string, string> = {
  home: "Home",
  workspace: "Active Call",
  "opportunity-record": "Opportunity",
  "opportunity-intelligence": "Next-call Brief",
  "account-detail": "Account",
  "post-call": "Post-call Outputs",
  opportunities: "Opportunities",
  methodology: "Methodology Fields",
  calls: "Calls",
  playbooks: "Playbooks",
  meddicc: "MEDDICC",
  meddpicc: "MEDDPICC",
  bant: "BANT",
  "force-management": "Force Management",
  spin: "SPIN Selling",
  sandler: "Sandler",
  challenger: "The Challenger Sale",
  "gap-selling": "Gap Selling",
  "value-selling": "Value Selling",
  "strategic-selling": "Strategic Selling (Miller Heiman)",
  spiced: "SPICED (Winning by Design)",
  custom: "Custom Framework",
  settings: "Settings",
  "profile-account": "Account",
  capture: "Audio Capture",
  retention: "Retention",
  help: "Support",
  roadmap: "Roadmap",
  billing: "Billing",
  account: "Account",
  ai: "OpenAI API Key",
}

export const sectionCards: Record<string, { kicker: string; title: string; body: string }[]> = {
  playbooks: [
    {
      kicker: "Methodology",
      title: "Strict adherence",
      body: "Each playbook defines required fields, evidence standards, and question prompts that the live coach uses in real time.",
    },
    {
      kicker: "Custom",
      title: "Configurable frameworks",
      body: "Custom frameworks can model your workspace's qualification standards without hardcoding team-specific language.",
    },
  ],
  settings: [
    {
      kicker: "Capture",
      title: "Browser audio permissions",
      body: "Seller-approved browser capture powers live call guidance from the web app.",
    },
    {
      kicker: "Data",
      title: "Structured workspace data",
      body: "Accounts, opportunities, calls, recordings, transcript segments, notes, framework fields, and evidence snippets map cleanly to relational tables.",
    },
  ],
  default: [
    {
      kicker: "Workspace",
      title: "Designed for individual sellers",
      body: "The interface prioritizes live guidance, opportunity memory, and strict methodology completion without manager/admin complexity.",
    },
    {
      kicker: "Wedge",
      title: "Real-time question guidance",
      body: "The product is not just post-call notes. It gives the seller the next best question while the customer is still talking.",
    },
    {
      kicker: "Records",
      title: "Clean account context",
      body: "Account and opportunity data stays consistent across calls, notes, research, and post-call outputs.",
    },
  ],
}
