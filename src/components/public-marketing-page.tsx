import * as React from "react"
import { ArrowUpRightIcon, AudioLinesIcon, CheckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  publicMarketingNavGroups,
  type PublicMarketingLink,
} from "@/lib/public-marketing-routes"

const siteUrl = "https://salesframe.ai"

type PublicPageSection = {
  body: string
  bullets?: string[]
  heading: string
}

type PublicPageSnapshot = {
  bestFor: string
  focus: string
  watchFor: string
}

type PublicPageReference = {
  href: string
  label: string
  publisher: string
}

type PublicPageVisual = {
  alt: string
  caption: string
  height: number
  src: string
  width: number
}

type PublicPage = {
  ctaLabel?: string
  faq: Array<{
    answer: string
    question: string
  }>
  intro: string
  kind: "playbook" | "use-case" | "comparison" | "resource" | "hub"
  path: string
  related?: PublicMarketingLink[]
  seoDescription: string
  seoTitle: string
  sections: PublicPageSection[]
  title: string
}

export type PublicMarketingPageMetadata = {
  canonicalUrl: string
  description: string
  imageAlt: string
  imageHeight: number
  imageUrl: string
  imageWidth: number
  keywords: string
  schema: ReturnType<typeof buildPageSchema>
  title: string
}

const coreMethodologyLinks = publicMarketingNavGroups[0].links
const coreUseCaseLinks = [
  ...publicMarketingNavGroups[1].links,
  { href: "/conversation-intelligence-alternative", label: "Conversation intelligence alternative" },
  { href: "/ai-meeting-notetaker-for-sales", label: "AI meeting notetaker for sales" },
  { href: "/meddicc-software", label: "MEDDICC software" },
]
const comparisonLinks = publicMarketingNavGroups[2].links
const resourceLinks = publicMarketingNavGroups[3].links

const playbookPages: PublicPage[] = [
  {
    kind: "playbook",
    path: "/playbooks/meddicc",
    title: "MEDDICC sales methodology",
    seoTitle: "MEDDICC Sales Methodology | Live MEDDICC Coaching | SalesFrame",
    seoDescription:
      "Learn what MEDDICC is, when to use it, discovery questions to ask, common mistakes, and how SalesFrame coaches MEDDICC live during discovery calls.",
    intro:
      "MEDDICC helps sellers qualify complex deals without turning discovery into an interrogation. SalesFrame keeps the discipline underneath the conversation.",
    sections: [
      {
        heading: "What MEDDICC is",
        body:
          "MEDDICC is a qualification framework for complex B2B sales. It helps sellers understand metrics, the economic buyer, decision criteria, decision process, pain, paper process, competition and champion strength.",
      },
      {
        heading: "When to use it",
        body:
          "Use MEDDICC when deals have multiple stakeholders, meaningful commercial impact, a formal buying process or a real risk of slipping late in the cycle.",
      },
      {
        heading: "Discovery questions sellers can ask",
        body: "The best MEDDICC questions create evidence without sounding like a checklist.",
        bullets: [
          "What is the business problem making this worth solving now?",
          "How would you measure whether this change was worth it?",
          "Who feels the cost of the current process most directly?",
          "What would need to happen internally before this could move forward?",
        ],
      },
      {
        heading: "Common mistakes",
        body:
          "The common mistake is asking for every field too early. Economic buyer, metrics and paper process matter, but the timing has to match the trust in the room.",
      },
      {
        heading: "How SalesFrame coaches MEDDICC live",
        body:
          "SalesFrame watches the conversation, selected playbooks and opportunity evidence, then suggests one natural next question that can update MEDDICC without making the seller sound robotic.",
      },
    ],
    faq: [
      {
        question: "What does MEDDICC stand for?",
        answer:
          "MEDDICC commonly refers to Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, Champion and Competition. Some teams use MEDDPICC to add paper process.",
      },
      {
        question: "Does SalesFrame force every MEDDICC question into a call?",
        answer:
          "No. SalesFrame prioritises timing and conversation flow, then updates MEDDICC evidence in the background when the buyer gives useful proof.",
      },
    ],
  },
  {
    kind: "playbook",
    path: "/playbooks/bant",
    title: "BANT qualification framework",
    seoTitle: "BANT Qualification Framework | BANT Questions for Sales | SalesFrame",
    seoDescription:
      "Understand BANT, when it works, which qualification questions to ask, common mistakes, and how SalesFrame coaches BANT live.",
    intro:
      "BANT is useful when it stays lightweight. SalesFrame helps sellers qualify budget, authority, need and timing without making the buyer feel processed.",
    sections: [
      {
        heading: "What BANT is",
        body:
          "BANT stands for Budget, Authority, Need and Timeline. It is a simple qualification framework that helps sellers understand whether an opportunity is real and when it might move.",
      },
      {
        heading: "When to use it",
        body:
          "Use BANT for early qualification, inbound leads, smaller opportunities or discovery calls where you need a fast read on fit and urgency.",
      },
      {
        heading: "Discovery questions sellers can ask",
        body: "The strongest BANT questions sound like normal business curiosity.",
        bullets: [
          "What made this worth exploring now?",
          "Who else will need to be comfortable with a change?",
          "How are you thinking about timing if this proves useful?",
          "Is there already budget around this problem, or is that still being shaped?",
        ],
      },
      {
        heading: "Common mistakes",
        body:
          "BANT gets clumsy when budget and authority are asked too bluntly before the buyer has shared enough pain or value.",
      },
      {
        heading: "How SalesFrame coaches BANT live",
        body:
          "SalesFrame uses BANT as a light signal layer. If need and timing are still unclear, it asks for context first, then brings commercial questions in when the moment is ready.",
      },
    ],
    faq: [
      {
        question: "Is BANT still useful for modern SaaS sales?",
        answer:
          "Yes, when it is used as a lightweight qualification lens rather than a rigid script. It is strongest when paired with deeper discovery.",
      },
      {
        question: "How does SalesFrame avoid blunt BANT questions?",
        answer:
          "SalesFrame ranks questions by conversation fit, buyer mood and methodology value, so budget or authority questions are softened until they make sense.",
      },
    ],
  },
  {
    kind: "playbook",
    path: "/playbooks/spin-selling",
    title: "SPIN Selling questions",
    seoTitle: "SPIN Selling Questions for SaaS Discovery | SalesFrame",
    seoDescription:
      "Learn SPIN Selling, when to use Situation, Problem, Implication and Need-payoff questions, common mistakes, and how SalesFrame coaches SPIN live.",
    intro:
      "SPIN helps sellers move from context to pain to impact to value. SalesFrame keeps that arc alive while the buyer is speaking.",
    sections: [
      {
        heading: "What SPIN Selling is",
        body:
          "SPIN Selling is a discovery framework built around Situation, Problem, Implication and Need-payoff questions. It helps sellers uncover the cost of the problem before presenting a solution.",
      },
      {
        heading: "When to use it",
        body:
          "Use SPIN when the buyer knows something is wrong, but the commercial impact or urgency has not been fully explored yet.",
      },
      {
        heading: "Discovery questions sellers can ask",
        body: "SPIN questions should move gently from context into consequences.",
        bullets: [
          "How does that process work today?",
          "Where does it tend to slow down or break?",
          "What happens downstream when that issue continues?",
          "If that improved, what would it free the team up to do?",
        ],
      },
      {
        heading: "Common mistakes",
        body:
          "The mistake is asking too many situation questions and never reaching implication. Buyers do not feel urgency until the problem has a consequence.",
      },
      {
        heading: "How SalesFrame coaches SPIN live",
        body:
          "SalesFrame detects where the conversation is sitting in the SPIN arc and suggests the next question that deepens the buyer's own reasoning.",
      },
    ],
    faq: [
      {
        question: "What are the four SPIN question types?",
        answer: "Situation, Problem, Implication and Need-payoff.",
      },
      {
        question: "Can SalesFrame use SPIN with MEDDICC or BANT?",
        answer:
          "Yes. SalesFrame merges overlapping intents so one natural question can support SPIN Problem, MEDDICC Pain and BANT Need at the same time.",
      },
    ],
  },
  {
    kind: "playbook",
    path: "/playbooks/sandler",
    title: "Sandler sales methodology",
    seoTitle: "Sandler Sales Methodology | Upfront Contract Examples | SalesFrame",
    seoDescription:
      "Learn when to use Sandler, how upfront contracts work, discovery questions to ask, common mistakes, and how SalesFrame coaches Sandler live.",
    intro:
      "Sandler keeps sales conversations honest. SalesFrame helps sellers set the frame, protect trust and ask direct questions without sounding heavy.",
    sections: [
      {
        heading: "What Sandler is",
        body:
          "Sandler is a sales methodology built around mutual qualification, upfront contracts, pain discovery, budget, decision and clear next steps.",
      },
      {
        heading: "When to use it",
        body:
          "Use Sandler when the seller needs to create a clear conversational agreement, avoid unpaid consulting and make the buying process more mutual.",
      },
      {
        heading: "Discovery questions sellers can ask",
        body: "Sandler questions work best when they create clarity without pressure.",
        bullets: [
          "Would it be useful if we agreed what we both want from this conversation?",
          "What would make this conversation worth your time?",
          "What happens if nothing changes?",
          "If this is not a fit, are you comfortable saying that directly?",
        ],
      },
      {
        heading: "Common mistakes",
        body:
          "The mistake is treating upfront contracts like a script. The agreement should feel human, short and useful to the buyer.",
      },
      {
        heading: "How SalesFrame coaches Sandler live",
        body:
          "SalesFrame watches for opening, pain and decision moments, then suggests questions that keep the conversation mutual and clear.",
      },
    ],
    faq: [
      {
        question: "What is a Sandler upfront contract?",
        answer:
          "It is a short agreement about the purpose, agenda, timing and possible outcomes of a conversation.",
      },
      {
        question: "Does SalesFrame write Sandler scripts?",
        answer:
          "SalesFrame suggests natural wording for the moment. It is designed to keep the seller conversational, not scripted.",
      },
    ],
  },
  {
    kind: "playbook",
    path: "/playbooks/challenger-sale",
    title: "Challenger Sale framework",
    seoTitle: "Challenger Sale Framework | Teach, Tailor, Take Control | SalesFrame",
    seoDescription:
      "Understand The Challenger Sale, when to use it, discovery questions, common mistakes, and how SalesFrame coaches Challenger-style conversations live.",
    intro:
      "Challenger selling is about creating commercial insight, not creating tension for its own sake. SalesFrame helps the seller challenge at the right moment.",
    sections: [
      {
        heading: "What Challenger is",
        body:
          "The Challenger Sale focuses on teaching the buyer something valuable, tailoring the message to their world and taking control of the commercial conversation.",
      },
      {
        heading: "When to use it",
        body:
          "Use Challenger when the buyer may be underestimating the cost of the status quo or needs a sharper way to understand the problem.",
      },
      {
        heading: "Discovery questions sellers can ask",
        body: "Challenger questions should help the buyer see a business truth more clearly.",
        bullets: [
          "What are teams usually missing when this problem shows up?",
          "Where does the cost of this issue hide today?",
          "What would your leadership team be surprised to learn about this process?",
          "What assumption would need to be true for the current approach to keep working?",
        ],
      },
      {
        heading: "Common mistakes",
        body:
          "The mistake is confusing insight with provocation. A good challenge earns trust by being specific, relevant and useful.",
      },
      {
        heading: "How SalesFrame coaches Challenger live",
        body:
          "SalesFrame uses account intelligence, opportunity context and buyer mood to decide whether to teach, clarify, soften or stay curious.",
      },
    ],
    faq: [
      {
        question: "Is Challenger only for aggressive sellers?",
        answer:
          "No. The strongest Challenger conversations are calm, informed and useful. The goal is insight, not pressure.",
      },
      {
        question: "How does SalesFrame know when to challenge?",
        answer:
          "SalesFrame considers the conversation stage, buyer mood, account context and missing evidence before suggesting a Challenger-style move.",
      },
    ],
  },
  {
    kind: "playbook",
    path: "/playbooks/gap-selling",
    title: "Gap Selling methodology",
    seoTitle: "Gap Selling Methodology | Current State, Future State and Impact | SalesFrame",
    seoDescription:
      "Learn Gap Selling, when to use it, questions for current state and future state, common mistakes, and how SalesFrame coaches Gap Selling live.",
    intro:
      "Gap Selling helps sellers understand the distance between where the buyer is and where they need to be. SalesFrame keeps that gap sharp during the call.",
    sections: [
      {
        heading: "What Gap Selling is",
        body:
          "Gap Selling focuses on current state, future state, the gap between them and the business impact of closing that gap.",
      },
      {
        heading: "When to use it",
        body:
          "Use Gap Selling when the buyer can describe pain but has not yet connected it to a concrete future state or measurable business impact.",
      },
      {
        heading: "Discovery questions sellers can ask",
        body: "Gap Selling questions should make the before-and-after picture visible.",
        bullets: [
          "What does the process look like today?",
          "What would a better version of this look like six months from now?",
          "What is the gap costing the team right now?",
          "What would change if that gap closed?",
        ],
      },
      {
        heading: "Common mistakes",
        body:
          "The mistake is jumping to future state before the current state is emotionally and commercially understood.",
      },
      {
        heading: "How SalesFrame coaches Gap Selling live",
        body:
          "SalesFrame listens for current state, future state and impact evidence, then guides the seller to deepen whichever part is still weak.",
      },
    ],
    faq: [
      {
        question: "What is the core idea behind Gap Selling?",
        answer:
          "The core idea is that buyers change when the gap between current state and future state is clear, painful and worth solving.",
      },
      {
        question: "Can SalesFrame track Gap Selling evidence?",
        answer:
          "Yes. SalesFrame tracks field evidence and can update overlapping methodology requirements when the buyer explains current state, impact or desired outcomes.",
      },
    ],
  },
  {
    kind: "playbook",
    path: "/playbooks/spiced",
    title: "SPICED sales methodology",
    seoTitle: "SPICED Sales Methodology | Winning by Design Discovery | SalesFrame",
    seoDescription:
      "Learn SPICED, when to use it, discovery questions for SaaS sellers, common mistakes, and how SalesFrame coaches SPICED live.",
    intro:
      "SPICED gives SaaS sellers a practical way to understand situation, pain, impact, critical event and decision. SalesFrame keeps it natural live.",
    sections: [
      {
        heading: "What SPICED is",
        body:
          "SPICED stands for Situation, Pain, Impact, Critical Event and Decision. It is commonly used in SaaS discovery to connect customer context to buying urgency.",
      },
      {
        heading: "When to use it",
        body:
          "Use SPICED when a seller needs to qualify whether a problem has urgency, measurable impact and a decision path.",
      },
      {
        heading: "Discovery questions sellers can ask",
        body: "SPICED questions are strongest when they connect pain to a critical event.",
        bullets: [
          "What is happening in the business that makes this a priority now?",
          "Where is the pain showing up day to day?",
          "What is the impact if it stays unresolved?",
          "Is there a date or event this needs to be solved around?",
        ],
      },
      {
        heading: "Common mistakes",
        body:
          "The mistake is treating critical event as a closing tactic. It should come from the buyer's real business timing.",
      },
      {
        heading: "How SalesFrame coaches SPICED live",
        body:
          "SalesFrame uses SPICED to find the next useful gap in the story, then asks one question that fits the current thread.",
      },
    ],
    faq: [
      {
        question: "What does SPICED stand for?",
        answer: "Situation, Pain, Impact, Critical Event and Decision.",
      },
      {
        question: "Is SPICED useful with other playbooks?",
        answer:
          "Yes. SPICED overlaps naturally with MEDDICC, BANT, SPIN and Gap Selling. SalesFrame merges those overlaps into one live coaching intent.",
      },
    ],
  },
]

const useCasePages: PublicPage[] = [
  {
    kind: "use-case",
    path: "/ai-sales-coach",
    title: "AI sales coach",
    seoTitle: "AI Sales Coach for Live Discovery Calls | SalesFrame",
    seoDescription:
      "SalesFrame is an AI sales coach that helps sellers ask better next questions live, using account context, opportunity history, playbooks and transcript flow.",
    intro:
      "SalesFrame is built for the moment where the seller needs the next useful question, not another report after the call.",
    sections: [
      {
        heading: "What an AI sales coach should do",
        body:
          "An AI sales coach should help the seller think clearly in the live moment: what has been answered, what is still missing and what question fits now.",
      },
      {
        heading: "Why SalesFrame is different",
        body:
          "SalesFrame combines account intelligence, opportunity fields, selected playbooks, previous evidence and the live transcript to suggest one next move.",
      },
      {
        heading: "Best fit",
        body:
          "Use SalesFrame when discovery quality, methodology adherence and seller confidence matter more than simply recording the meeting.",
      },
    ],
    faq: [
      {
        question: "Is SalesFrame an AI sales coach or a notetaker?",
        answer:
          "SalesFrame captures transcripts and post-call outputs, but the core product is live coaching during the sales conversation.",
      },
      {
        question: "Does SalesFrame replace sales training?",
        answer:
          "No. It helps sellers apply methodology and account context in the moment, which makes training easier to use on real calls.",
      },
    ],
  },
  {
    kind: "use-case",
    path: "/real-time-sales-coaching",
    title: "Real-time sales coaching",
    seoTitle: "Real-Time Sales Coaching Software | SalesFrame",
    seoDescription:
      "Real-time sales coaching that guides sellers during discovery calls with timely next questions, methodology coverage and account context.",
    intro:
      "Post-call coaching is useful. Real-time coaching changes the call while it is still happening.",
    sections: [
      {
        heading: "What real-time coaching means",
        body:
          "It means the seller gets guidance while the buyer is still in the conversation: clarify this, go softer, ask about impact or wait because the moment moved on.",
      },
      {
        heading: "How SalesFrame keeps it calm",
        body:
          "SalesFrame avoids a dashboard full of alerts. It shows one main question, a short reason and simple controls to move on.",
      },
      {
        heading: "Where it helps",
        body:
          "Real-time coaching is strongest in discovery, qualification, account planning calls, follow-up calls and coaching roleplays.",
      },
    ],
    faq: [
      {
        question: "Will real-time coaching distract sellers?",
        answer:
          "SalesFrame is intentionally quiet. It gives one suggested question at a time and keeps methodology detail in the background.",
      },
      {
        question: "Does SalesFrame update the question as the call moves?",
        answer:
          "Yes. SalesFrame uses final transcript turns, seller feedback and conversation flow to decide whether to hold, replace, park or recover a question.",
      },
    ],
  },
  {
    kind: "use-case",
    path: "/sales-discovery-call-coach",
    title: "Sales discovery call coach",
    seoTitle: "Sales Discovery Call Coach | Better Discovery Questions | SalesFrame",
    seoDescription:
      "Coach discovery calls live with better next questions across pain, impact, stakeholders, decision process, timing and methodology coverage.",
    intro:
      "Discovery calls should not feel like forms being filled in. SalesFrame helps sellers follow the buyer's thread and still capture the evidence that matters.",
    sections: [
      {
        heading: "What discovery needs",
        body:
          "Good discovery needs pain, impact, decision context, stakeholder understanding, timing and a next step that feels earned.",
      },
      {
        heading: "How SalesFrame helps",
        body:
          "SalesFrame reads the live conversation and selected methodology, then suggests a question that helps the seller deepen the right part of the story.",
      },
      {
        heading: "What sellers see",
        body:
          "A simple live coach card with the next question, a short reason and controls to mark it asked, too soon, softer or skipped.",
      },
    ],
    faq: [
      {
        question: "Can SalesFrame help with discovery call questions?",
        answer:
          "Yes. SalesFrame is designed to recommend timely discovery questions during the call, not just provide a static question bank.",
      },
      {
        question: "Does SalesFrame use previous calls?",
        answer:
          "Yes. Previous evidence can shape what should be asked next so sellers do not repeat what has already been answered.",
      },
    ],
  },
  {
    kind: "use-case",
    path: "/conversation-intelligence-alternative",
    title: "Conversation intelligence alternative",
    seoTitle: "Conversation Intelligence Alternative for Live Sales Coaching | SalesFrame",
    seoDescription:
      "SalesFrame is a conversation intelligence alternative for sellers who need live next-question coaching, not only post-call analysis.",
    intro:
      "Conversation intelligence is valuable after the call. SalesFrame is designed for the live moment where a better next question can still change the outcome.",
    sections: [
      {
        heading: "The difference",
        body:
          "Traditional conversation intelligence captures, analyses and reports. SalesFrame captures the call too, but the product centre is live guidance.",
      },
      {
        heading: "Why it matters",
        body:
          "If a seller misses pain, impact or decision process during discovery, the cleanest post-call report cannot recover that moment.",
      },
      {
        heading: "Who it is for",
        body:
          "SalesFrame is for sellers and sales leaders who care about methodology discipline, sharper discovery and real-time coaching.",
      },
    ],
    faq: [
      {
        question: "Is SalesFrame a replacement for conversation intelligence?",
        answer:
          "For some teams, yes. For others, it can sit beside analytics tools by focusing on the live seller experience.",
      },
      {
        question: "Does SalesFrame still produce post-call outputs?",
        answer:
          "Yes. The live coaching layer feeds transcript, notes, evidence and follow-up preparation after the call.",
      },
    ],
  },
  {
    kind: "use-case",
    path: "/ai-meeting-notetaker-for-sales",
    title: "AI meeting notetaker for sales",
    seoTitle: "AI Meeting Notetaker for Sales Calls | SalesFrame",
    seoDescription:
      "SalesFrame captures sales call transcripts and post-call notes, then goes further by coaching sellers live with one next best question.",
    intro:
      "A notetaker remembers the meeting. SalesFrame helps the seller improve the meeting while it is still happening.",
    sections: [
      {
        heading: "What sellers need from notes",
        body:
          "Sellers need reliable transcripts, useful notes, evidence, follow-up and a clear next step without losing focus during the call.",
      },
      {
        heading: "Where SalesFrame goes further",
        body:
          "SalesFrame uses the transcript while it is forming to guide the seller toward better discovery, qualification and methodology coverage.",
      },
      {
        heading: "Best fit",
        body:
          "Use SalesFrame when the sales call itself needs coaching, not just a summary once it is over.",
      },
    ],
    faq: [
      {
        question: "Does SalesFrame take meeting notes?",
        answer:
          "Yes. SalesFrame supports transcript and post-call outputs, but it is built around real-time sales coaching.",
      },
      {
        question: "Does SalesFrame need a meeting bot?",
        answer:
          "SalesFrame can work from the seller's browser capture flow. A meeting bot can be added later as another capture option.",
      },
    ],
  },
  {
    kind: "use-case",
    path: "/meddicc-software",
    title: "MEDDICC software",
    seoTitle: "MEDDICC Software for Live Sales Calls | SalesFrame",
    seoDescription:
      "MEDDICC software that helps sellers capture methodology evidence from live discovery calls and ask better next questions.",
    intro:
      "MEDDICC software should help sellers collect real evidence, not just maintain fields after the deal review.",
    sections: [
      {
        heading: "What MEDDICC software should track",
        body:
          "Metrics, economic buyer, decision criteria, decision process, pain, paper process, champion and competition should be backed by actual customer evidence.",
      },
      {
        heading: "How SalesFrame helps",
        body:
          "SalesFrame listens to the call, identifies what was answered and suggests the next question that can improve MEDDICC coverage naturally.",
      },
      {
        heading: "Why live matters",
        body:
          "A weak MEDDICC field is easier to fix while the buyer is still talking than during a pipeline review days later.",
      },
    ],
    faq: [
      {
        question: "Can SalesFrame support MEDDPICC too?",
        answer:
          "Yes. SalesFrame supports MEDDICC and MEDDPICC-style evidence, including paper process where relevant.",
      },
      {
        question: "Does SalesFrame auto-complete MEDDICC fields?",
        answer:
          "SalesFrame can suggest and store evidence, but completion should be based on transcript evidence or seller-entered record context.",
      },
    ],
  },
  {
    kind: "use-case",
    path: "/sales-call-coaching-software",
    title: "Sales call coaching software",
    seoTitle: "Sales Call Coaching Software for Live Discovery | SalesFrame",
    seoDescription:
      "Sales call coaching software for live discovery, methodology coverage, transcripts, post-call notes and next-call preparation.",
    intro:
      "SalesFrame gives sellers a calmer way to run better calls: one next question, shaped by everything the app already knows.",
    sections: [
      {
        heading: "What sales call coaching should improve",
        body:
          "It should improve question quality, evidence capture, call flow, follow-up and seller confidence without making the call feel mechanical.",
      },
      {
        heading: "How SalesFrame coaches",
        body:
          "SalesFrame combines playbooks, account context, opportunity context, previous answers and live transcript turns to guide the next move.",
      },
      {
        heading: "Who it helps",
        body:
          "Account executives, sales leaders, founders and revenue teams who want stronger discovery and cleaner deal evidence.",
      },
    ],
    faq: [
      {
        question: "What makes SalesFrame different from a call recorder?",
        answer:
          "SalesFrame is built to guide the live conversation. Recording and notes support the workflow, but coaching is the centre.",
      },
      {
        question: "Which sales methodologies can it coach?",
        answer:
          "SalesFrame supports MEDDICC, BANT, SPIN Selling, Sandler, Challenger, Gap Selling, SPICED and more.",
      },
    ],
  },
]

const comparisonPages: PublicPage[] = [
  {
    kind: "comparison",
    path: "/compare/gong",
    title: "SalesFrame vs Gong",
    seoTitle: "SalesFrame vs Gong | Live Sales Coaching vs Revenue AI Analysis",
    seoDescription:
      "A calm comparison of SalesFrame and Gong for teams evaluating live sales coaching, conversation intelligence and revenue AI.",
    intro:
      "Gong is widely positioned as a Revenue AI platform for capturing interactions, analysing what works and automating revenue workflows. SalesFrame focuses on the seller's live next question.",
    sections: [
      {
        heading: "Where Gong is strong",
        body:
          "Gong is built for broad revenue teams that want interaction capture, analytics, forecasting context, enablement and revenue workflow support.",
      },
      {
        heading: "Where SalesFrame is different",
        body:
          "SalesFrame is intentionally narrower: live discovery coaching, methodology evidence and the next best question while the buyer is still talking.",
      },
      {
        heading: "How to choose",
        body:
          "Choose SalesFrame when the problem is not just understanding calls later, but helping sellers ask better questions during the call.",
      },
    ],
    faq: [
      {
        question: "Is SalesFrame trying to replace Gong?",
        answer:
          "Not always. SalesFrame is focused on live seller coaching. Some teams may use it instead of, or alongside, broader revenue intelligence systems.",
      },
      {
        question: "What is the main difference?",
        answer:
          "Gong is broad revenue intelligence. SalesFrame is a live sales coach designed around account context, opportunity context and methodology-driven next questions.",
      },
    ],
  },
  {
    kind: "comparison",
    path: "/compare/clari-copilot",
    title: "SalesFrame vs Clari Copilot",
    seoTitle: "SalesFrame vs Clari Copilot | Live Discovery Coaching Comparison",
    seoDescription:
      "Compare SalesFrame and Clari Copilot for live sales coaching, conversation intelligence, CRM context and discovery call guidance.",
    intro:
      "Clari Copilot is positioned around conversation intelligence and revenue process. SalesFrame is built to make the live discovery question sharper.",
    sections: [
      {
        heading: "Where Clari Copilot is strong",
        body:
          "Clari Copilot connects sales conversations into revenue workflows, CRM capture, pipeline visibility and coaching programmes.",
      },
      {
        heading: "Where SalesFrame is different",
        body:
          "SalesFrame keeps the seller interface quiet and focused on one live question, selected methodology coverage and buyer conversation flow.",
      },
      {
        heading: "How to choose",
        body:
          "Choose SalesFrame when your team wants a lightweight live coach for discovery moments rather than a broad revenue platform surface.",
      },
    ],
    faq: [
      {
        question: "Does SalesFrame include conversation intelligence?",
        answer:
          "SalesFrame captures transcripts and call evidence, but its main job is helping the seller navigate the live conversation.",
      },
      {
        question: "Can SalesFrame work with CRM and opportunity context?",
        answer:
          "Yes. SalesFrame uses account and opportunity context to shape the next question and post-call outputs.",
      },
    ],
  },
  {
    kind: "comparison",
    path: "/compare/fireflies",
    title: "SalesFrame vs Fireflies",
    seoTitle: "SalesFrame vs Fireflies | AI Notetaker vs Live Sales Coach",
    seoDescription:
      "Compare SalesFrame and Fireflies for sales teams choosing between AI meeting notes, transcription and live sales coaching.",
    intro:
      "Fireflies is known as an AI assistant for transcribing, summarising, searching and analysing meetings. SalesFrame is built for live sales coaching.",
    sections: [
      {
        heading: "Where Fireflies is strong",
        body:
          "Fireflies is useful when teams want meeting capture, summaries, searchable conversations and broad meeting productivity.",
      },
      {
        heading: "Where SalesFrame is different",
        body:
          "SalesFrame focuses on sales methodology, account intelligence, opportunity context and the question the seller should ask next.",
      },
      {
        heading: "How to choose",
        body:
          "Choose SalesFrame when the live discovery moment matters more than meeting memory alone.",
      },
    ],
    faq: [
      {
        question: "Is SalesFrame an AI notetaker?",
        answer:
          "It can produce notes, but SalesFrame is positioned as a live sales coach first.",
      },
      {
        question: "Does SalesFrame summarise calls?",
        answer:
          "Yes. SalesFrame supports post-call outputs, transcript downloads and next-call preparation.",
      },
    ],
  },
  {
    kind: "comparison",
    path: "/compare/fathom",
    title: "SalesFrame vs Fathom",
    seoTitle: "SalesFrame vs Fathom | Meeting Notes vs Live Sales Coaching",
    seoDescription:
      "Compare SalesFrame and Fathom for teams evaluating AI meeting notes, sales call summaries and real-time coaching.",
    intro:
      "Fathom is known for helping people stay present by capturing notes and summaries. SalesFrame is built to coach the seller inside sales conversations.",
    sections: [
      {
        heading: "Where Fathom is strong",
        body:
          "Fathom is useful for meeting notes, summaries, searchable records and follow-up workflows across different meeting types.",
      },
      {
        heading: "Where SalesFrame is different",
        body:
          "SalesFrame is more sales-specific: it tracks playbook evidence, live transcript turns and account context to suggest better discovery questions.",
      },
      {
        heading: "How to choose",
        body:
          "Choose SalesFrame when your seller needs coaching in the room, not only a cleaner recap after the room goes quiet.",
      },
    ],
    faq: [
      {
        question: "Can SalesFrame help sellers stay present?",
        answer:
          "Yes. The interface is intentionally calm, showing one suggested question and keeping details in the background.",
      },
      {
        question: "Does SalesFrame replace a general meeting notetaker?",
        answer:
          "For sales calls, it may. For broad internal meeting notes, a general meeting notetaker may still be useful.",
      },
    ],
  },
  {
    kind: "comparison",
    path: "/compare/outreach",
    title: "SalesFrame vs Outreach",
    seoTitle: "SalesFrame vs Outreach | Live Sales Coaching for Discovery Calls",
    seoDescription:
      "Compare SalesFrame and Outreach for revenue teams evaluating sales engagement, revenue orchestration and live discovery coaching.",
    intro:
      "Outreach is positioned as a broad revenue and sales engagement platform. SalesFrame focuses on live sales coaching during calls.",
    sections: [
      {
        heading: "Where Outreach is strong",
        body:
          "Outreach supports prospecting, sales engagement, deal management, forecasting, coaching and broader revenue workflows.",
      },
      {
        heading: "Where SalesFrame is different",
        body:
          "SalesFrame is not trying to run the entire revenue motion. It helps the seller ask the next best question live and maintain methodology evidence.",
      },
      {
        heading: "How to choose",
        body:
          "Choose SalesFrame when the priority is live discovery quality and coaching simplicity rather than end-to-end sales engagement.",
      },
    ],
    faq: [
      {
        question: "Can SalesFrame sit beside a sales engagement platform?",
        answer:
          "Yes. SalesFrame can focus on live call coaching while another platform handles sequences, engagement and broader revenue workflows.",
      },
      {
        question: "What does SalesFrame do during a call?",
        answer:
          "It listens to the conversation, reads account and opportunity context, checks selected playbooks and suggests one next question.",
      },
    ],
  },
]

const resourcePages: PublicPage[] = [
  {
    kind: "resource",
    path: "/resources/discovery-call-guide",
    title: "How to run a discovery call",
    seoTitle: "How to Run a Discovery Call | SalesFrame Guide",
    seoDescription:
      "A calm guide to running better discovery calls: context, pain, impact, stakeholders, decision process, next steps and live coaching.",
    intro:
      "A good discovery call feels like a useful business conversation. The seller learns enough to help, and the buyer feels understood.",
    sections: [
      {
        heading: "Start with context",
        body:
          "Understand the account, opportunity stage, current tools, existing notes and why the conversation is happening now.",
      },
      {
        heading: "Move into pain and impact",
        body:
          "Ask what is not working, who it affects, why it matters and what changes if the buyer solves it.",
      },
      {
        heading: "Earn the commercial questions",
        body:
          "Budget, authority, decision process and timing matter more when the buyer can already see the value of change.",
      },
    ],
    faq: [
      {
        question: "What is the goal of a discovery call?",
        answer:
          "To understand the buyer's current state, desired outcome, pain, impact, stakeholders and decision path well enough to decide whether there is a real next step.",
      },
      {
        question: "How does SalesFrame help discovery calls?",
        answer:
          "SalesFrame gives sellers the next timely question based on playbooks, account context, opportunity context and live conversation flow.",
      },
    ],
  },
  {
    kind: "resource",
    path: "/resources/meddicc-discovery-questions",
    title: "Best MEDDICC discovery questions",
    seoTitle: "Best MEDDICC Discovery Questions | SalesFrame",
    seoDescription:
      "MEDDICC discovery questions for metrics, economic buyer, decision criteria, decision process, pain, paper process, champion and competition.",
    intro:
      "The best MEDDICC questions feel like business discovery, not field collection.",
    sections: [
      {
        heading: "Pain and metrics",
        body: "Start with the problem and the measurable consequence.",
        bullets: [
          "What is the issue costing the team today?",
          "What would improve if this was fixed?",
          "How are you measuring the problem right now?",
        ],
      },
      {
        heading: "Economic buyer and champion",
        body: "Understand influence through action, not titles alone.",
        bullets: [
          "Who will care most about the business impact?",
          "Who has already pushed this internally?",
          "What has your strongest supporter done so far?",
        ],
      },
      {
        heading: "Decision process",
        body: "Make the path visible without sounding like procurement interrogation.",
        bullets: [
          "What would need to happen after this conversation?",
          "Who else should be involved before this becomes real?",
          "What could slow this down internally?",
        ],
      },
    ],
    faq: [
      {
        question: "Should every MEDDICC question be asked in one call?",
        answer:
          "No. SalesFrame helps sellers capture the highest-value evidence that fits the current conversation.",
      },
      {
        question: "What makes MEDDICC evidence strong?",
        answer:
          "Customer-sourced proof, clear business impact, specific stakeholders and a credible decision path.",
      },
    ],
  },
  {
    kind: "resource",
    path: "/resources/bant-qualification-questions",
    title: "BANT qualification questions",
    seoTitle: "BANT Qualification Questions | SalesFrame",
    seoDescription:
      "Practical BANT questions for budget, authority, need and timeline without making discovery feel transactional.",
    intro:
      "BANT works best when the seller earns the commercial questions by first understanding the buyer's need.",
    sections: [
      {
        heading: "Need",
        body:
          "What problem is the buyer trying to solve, and what makes it worth attention now?",
        bullets: [
          "What prompted you to explore this?",
          "What happens if the current process stays as it is?",
        ],
      },
      {
        heading: "Authority",
        body:
          "Authority is rarely one person. Ask about influence, confidence and the path to agreement.",
        bullets: [
          "Who else would need to be comfortable with this?",
          "Who usually weighs in on this type of change?",
        ],
      },
      {
        heading: "Budget and timeline",
        body:
          "Ask budget and timing once the value of change has started to show up.",
        bullets: [
          "Is this tied to an existing initiative or budget cycle?",
          "If this proved useful, when would you want to make progress?",
        ],
      },
    ],
    faq: [
      {
        question: "Is BANT too simple?",
        answer:
          "It can be if used alone. SalesFrame can combine BANT with deeper discovery frameworks so qualification stays useful.",
      },
      {
        question: "How should sellers ask about budget?",
        answer:
          "Ask after there is enough pain and value context, and frame it around how the buyer normally funds this type of problem.",
      },
    ],
  },
  {
    kind: "resource",
    path: "/resources/spin-selling-questions-for-saas-discovery",
    title: "SPIN Selling questions for SaaS discovery",
    seoTitle: "SPIN Selling Questions for SaaS Discovery | SalesFrame",
    seoDescription:
      "Situation, Problem, Implication and Need-payoff questions for SaaS discovery calls, with examples and common mistakes.",
    intro:
      "SPIN helps SaaS sellers make discovery useful by moving from what is happening to why it matters.",
    sections: [
      {
        heading: "Situation questions",
        body: "Use only enough situation questions to understand the current workflow.",
        bullets: ["How does the team handle this today?", "Which systems or people are involved?"],
      },
      {
        heading: "Problem and implication questions",
        body: "This is where discovery becomes commercially useful.",
        bullets: [
          "Where does that workflow create friction?",
          "What does that friction affect downstream?",
          "What is the cost of leaving it alone?",
        ],
      },
      {
        heading: "Need-payoff questions",
        body: "Let the buyer explain the value in their own words.",
        bullets: [
          "What would improve if that was easier?",
          "How would the team know the change had worked?",
        ],
      },
    ],
    faq: [
      {
        question: "Why does SPIN work well in SaaS?",
        answer:
          "It helps connect workflow problems to business impact before the seller introduces product capability.",
      },
      {
        question: "Can SalesFrame coach SPIN live?",
        answer:
          "Yes. SalesFrame can detect whether the seller should ask a situation, problem, implication or need-payoff question next.",
      },
    ],
  },
  {
    kind: "resource",
    path: "/resources/sandler-upfront-contract-examples",
    title: "Sandler upfront contract examples",
    seoTitle: "Sandler Upfront Contract Examples | SalesFrame",
    seoDescription:
      "Practical Sandler upfront contract examples for discovery calls, follow-up calls and qualification conversations.",
    intro:
      "An upfront contract should make the conversation easier for both sides. It does not need to sound formal.",
    sections: [
      {
        heading: "Discovery opener",
        body:
          "A simple version: we will spend a few minutes on context, a few on the problem, then decide together whether there is a useful next step.",
      },
      {
        heading: "Mutual clarity",
        body:
          "A stronger version includes permission for either side to say there is no fit if that becomes clear.",
      },
      {
        heading: "Common mistake",
        body:
          "Do not over-explain the contract. The buyer should feel helped by the frame, not forced through a sales technique.",
      },
    ],
    faq: [
      {
        question: "How long should an upfront contract be?",
        answer:
          "Usually under a minute. It should clarify the agenda, timing and possible outcomes.",
      },
      {
        question: "Can SalesFrame suggest Sandler openers?",
        answer:
          "Yes. SalesFrame can suggest opening-stage wording based on call type, account context and selected playbooks.",
      },
    ],
  },
  {
    kind: "resource",
    path: "/resources/stop-sales-calls-becoming-checklist-interviews",
    title: "How to stop sales calls becoming checklist interviews",
    seoTitle: "How to Stop Sales Calls Becoming Checklist Interviews | SalesFrame",
    seoDescription:
      "A guide to keeping sales discovery human while still collecting methodology evidence for MEDDICC, BANT, SPIN, Sandler and more.",
    intro:
      "The seller needs evidence. The buyer needs a conversation. The best sales calls give both sides what they need.",
    sections: [
      {
        heading: "Follow the thread",
        body:
          "If the buyer moves from pain into implementation risk, follow that thread. Park the earlier question and return later if needed.",
      },
      {
        heading: "Ask one question that covers many fields",
        body:
          "One strong question about business pain can update MEDDICC Pain, SPIN Problem, BANT Need and Gap Selling Current State.",
      },
      {
        heading: "Recover before the wrap",
        body:
          "Near the end, recover the highest-value missing intent with a calm bridge: before we wrap, can I check one thing?",
      },
    ],
    faq: [
      {
        question: "Why do sales calls become checklist interviews?",
        answer:
          "Because sellers try to satisfy every methodology field directly instead of merging overlapping intents into natural questions.",
      },
      {
        question: "How does SalesFrame avoid that?",
        answer:
          "SalesFrame keeps strict methodology in the background and gives the seller one human question in the foreground.",
      },
    ],
  },
]

const hubPages: PublicPage[] = [
  {
    kind: "hub",
    path: "/playbooks",
    title: "Sales methodology playbooks",
    seoTitle: "Sales Methodology Playbooks for Live Coaching | SalesFrame",
    seoDescription:
      "Explore MEDDICC, BANT, SPIN Selling, Sandler, Challenger, Gap Selling and SPICED, and how SalesFrame coaches each methodology live.",
    intro:
      "SalesFrame supports the methodologies sellers already use, then keeps them quiet enough to help the call rather than dominate it.",
    sections: [
      {
        heading: "Explore playbooks",
        body:
          "Start with the methodology your team uses most, or compare how different frameworks overlap during discovery.",
        bullets: coreMethodologyLinks.map((link) => link.label),
      },
    ],
    related: coreMethodologyLinks,
    faq: [
      {
        question: "Can multiple playbooks be selected at once?",
        answer:
          "Yes. SalesFrame merges overlapping requirements into shared intents so the seller sees one natural question at a time.",
      },
    ],
  },
  {
    kind: "hub",
    path: "/use-cases",
    title: "SalesFrame use cases",
    seoTitle: "SalesFrame Use Cases | AI Sales Coaching and Discovery Calls",
    seoDescription:
      "Explore SalesFrame use cases across AI sales coaching, real-time sales coaching, discovery calls, sales call coaching software and meeting notes.",
    intro:
      "SalesFrame is for the live sales moment: the point where better context and a better next question can change the conversation.",
    sections: [
      {
        heading: "Explore use cases",
        body:
          "Each page explains where SalesFrame fits and why live coaching is different from only analysing the call later.",
        bullets: coreUseCaseLinks.map((link) => link.label),
      },
    ],
    related: coreUseCaseLinks,
    faq: [
      {
        question: "What is SalesFrame mainly used for?",
        answer:
          "Live discovery coaching, methodology evidence, account intelligence, opportunity context and post-call preparation.",
      },
    ],
  },
  {
    kind: "hub",
    path: "/compare",
    title: "Compare SalesFrame",
    seoTitle: "Compare SalesFrame with Gong, Clari, Fireflies, Fathom and Outreach",
    seoDescription:
      "Compare SalesFrame with conversation intelligence, meeting notetaker and revenue platforms through a calm live-coaching lens.",
    intro:
      "These comparisons are intentionally plain. Most tools capture and analyse. SalesFrame is focused on helping the seller ask the next question live.",
    sections: [
      {
        heading: "Explore comparisons",
        body:
          "Use these pages to understand fit without the usual comparison-page theatre.",
        bullets: comparisonLinks.map((link) => `SalesFrame vs ${link.label}`),
      },
    ],
    related: comparisonLinks,
    faq: [
      {
        question: "What is the comparison angle?",
        answer:
          "Many platforms record and analyse. SalesFrame coaches live and gives the seller a timely next question.",
      },
    ],
  },
  {
    kind: "hub",
    path: "/resources",
    title: "Sales discovery resources",
    seoTitle: "Sales Discovery Resources and Methodology Guides | SalesFrame",
    seoDescription:
      "Guides for discovery calls, MEDDICC questions, BANT qualification, SPIN Selling, Sandler upfront contracts and better sales conversations.",
    intro:
      "Helpful sales content should make the next conversation better. These guides are written for sellers who need practical questions, not theory for its own sake.",
    sections: [
      {
        heading: "Explore guides",
        body:
          "Start with discovery, then go deeper into the methodology questions your team uses most.",
        bullets: resourceLinks.map((link) => link.label),
      },
    ],
    related: resourceLinks,
    faq: [
      {
        question: "Are these guides meant to replace SalesFrame?",
        answer:
          "No. They explain useful patterns. SalesFrame helps apply those patterns live while the buyer is talking.",
      },
    ],
  },
]

const publicPages = [...hubPages, ...playbookPages, ...useCasePages, ...comparisonPages, ...resourcePages]
const publicPagesByPath = new Map(publicPages.map((page) => [page.path, page]))

const pageSnapshots: Record<string, PublicPageSnapshot> = {
  "/playbooks/meddicc": {
    focus: "Qualify complex opportunities with evidence across value, stakeholders, process, pain, champions and competition.",
    bestFor: "Enterprise and multi-stakeholder B2B deals where forecast confidence matters.",
    watchFor: "Treating MEDDICC like a form to complete instead of evidence earned through a real buyer conversation.",
  },
  "/playbooks/bant": {
    focus: "Establish whether budget, authority, need and timing are strong enough to justify the next step.",
    bestFor: "Early qualification, inbound leads and shorter sales cycles that need a fast fit check.",
    watchFor: "Leading with budget or authority before the buyer has described a meaningful need.",
  },
  "/playbooks/spin-selling": {
    focus: "Move from situation to problem, implication and need-payoff so the buyer builds the case for change.",
    bestFor: "Consultative discovery where the impact of the current problem is still unclear.",
    watchFor: "Spending too long on situation questions and never reaching consequence or value.",
  },
  "/playbooks/sandler": {
    focus: "Create mutual clarity, uncover pain and agree honest outcomes without adding pressure.",
    bestFor: "Sellers who want firmer discovery structure, clearer next steps and permission to qualify out.",
    watchFor: "Delivering the up-front contract or pain questions as a memorised script.",
  },
  "/playbooks/challenger-sale": {
    focus: "Teach a useful commercial insight, tailor it to the stakeholder and guide the decision with constructive tension.",
    bestFor: "Complex categories where the buyer may be underestimating the cost or risk of the status quo.",
    watchFor: "Confusing a relevant reframe with confrontation, opinion or manufactured urgency.",
  },
  "/playbooks/gap-selling": {
    focus: "Diagnose the current state, define the future state and quantify the business gap between them.",
    bestFor: "Problem-centric discovery where value depends on making the cost of inaction concrete.",
    watchFor: "Jumping to product capabilities before the root cause and business impact are understood.",
  },
  "/playbooks/spiced": {
    focus: "Connect situation, pain, impact, critical event and decision so the revenue team shares one customer story.",
    bestFor: "Recurring-revenue teams that want a common language across sales, RevOps and customer success.",
    watchFor: "Recording facts without connecting pain to measurable impact and a credible critical event.",
  },
  "/ai-sales-coach": {
    focus: "Give the seller one useful next move while the conversation is still happening.",
    bestFor: "Account executives who want practical in-call help without a noisy wall of prompts.",
    watchFor: "Tools that generate generic scripts without account, opportunity or methodology context.",
  },
  "/real-time-sales-coaching": {
    focus: "Turn live transcript evidence into timely guidance before the buyer moves on.",
    bestFor: "Discovery, qualification and objection moments where timing matters more than a post-call score.",
    watchFor: "Alert-heavy interfaces that compete with the buyer for the seller's attention.",
  },
  "/sales-discovery-call-coach": {
    focus: "Help sellers deepen pain, impact, stakeholders and decision process without losing the natural thread.",
    bestFor: "B2B discovery calls where the seller must balance curiosity with qualification discipline.",
    watchFor: "Checklist discovery that collects fields but fails to understand why the buyer would change.",
  },
  "/conversation-intelligence-alternative": {
    focus: "Prioritise in-call action while still preserving transcript evidence and post-call context.",
    bestFor: "Sellers who need help navigating the meeting, not only dashboards about what happened later.",
    watchFor: "Buying a broad analytics platform when the primary job is a calm next question for the rep.",
  },
  "/ai-meeting-notetaker-for-sales": {
    focus: "Capture notes and next steps while keeping sales methodology and opportunity evidence connected.",
    bestFor: "Sellers who want less admin but still need a stronger discovery and follow-up workflow.",
    watchFor: "Treating a clean summary as proof that the right questions were asked during the call.",
  },
  "/meddicc-software": {
    focus: "Keep MEDDICC evidence current from live calls, opportunity context and previous conversations.",
    bestFor: "Teams operationalising MEDDICC beyond training, spreadsheets or end-of-quarter deal inspection.",
    watchFor: "Scoring fields without showing the customer evidence or the next conversation needed to strengthen it.",
  },
  "/sales-call-coaching-software": {
    focus: "Improve the behaviour and decisions that shape live sales calls, then preserve the evidence for review.",
    bestFor: "Individual sellers and teams that want repeatable call quality without constant manager shadowing.",
    watchFor: "Coaching that produces retrospective metrics but gives the rep nothing actionable in the moment.",
  },
  "/compare/gong": {
    focus: "Compare a broad Revenue AI and conversation-intelligence platform with a focused live sales coach.",
    bestFor: "Teams deciding between enterprise-wide conversation analysis and lightweight in-call question guidance.",
    watchFor: "Comparing feature counts before agreeing on the primary job the team needs the product to do.",
  },
  "/compare/clari-copilot": {
    focus: "Compare revenue-process conversation intelligence and battlecards with focused next-question coaching.",
    bestFor: "Teams weighing Clari ecosystem depth against a simpler seller-first live coaching workflow.",
    watchFor: "Assuming every form of real-time assistance solves the same rep problem.",
  },
  "/compare/fireflies": {
    focus: "Compare cross-functional meeting intelligence and analytics with sales-specific live coaching.",
    bestFor: "Teams choosing between broad meeting productivity and methodology-aware discovery guidance.",
    watchFor: "Using transcription breadth as a substitute for sales depth and opportunity context.",
  },
  "/compare/fathom": {
    focus: "Compare a polished AI meeting assistant with a live coach designed around sales discovery.",
    bestFor: "Sellers deciding whether excellent summaries are enough or in-call direction is the higher priority.",
    watchFor: "Evaluating only the post-call experience when the quality of the live conversation is the constraint.",
  },
  "/compare/outreach": {
    focus: "Compare a broad sales execution platform with a focused live discovery and methodology coach.",
    bestFor: "Teams deciding whether they need end-to-end engagement workflows or a lightweight coaching layer.",
    watchFor: "Buying platform breadth when the immediate problem is call quality for an individual seller.",
  },
  "/resources/discovery-call-guide": {
    focus: "Run discovery as a useful business conversation from context through pain, impact and next steps.",
    bestFor: "Account executives preparing for first calls, deeper discovery or opportunity requalification.",
    watchFor: "Trying to cover every topic instead of following the buyer's most commercially important thread.",
  },
  "/resources/meddicc-discovery-questions": {
    focus: "Ask MEDDICC questions that produce customer evidence without sounding like field collection.",
    bestFor: "Sellers preparing complex discovery, deal reviews or late-stage evidence recovery.",
    watchFor: "Asking economic-buyer or process questions without enough trust, pain or context.",
  },
  "/resources/bant-qualification-questions": {
    focus: "Qualify budget, authority, need and timing through normal business curiosity.",
    bestFor: "Inbound qualification, SDR-to-AE handoffs and shorter-cycle SaaS opportunities.",
    watchFor: "Using BANT as a pass-or-fail interrogation instead of a signal for where to explore next.",
  },
  "/resources/spin-selling-questions-for-saas-discovery": {
    focus: "Use situation, problem, implication and need-payoff questions to make SaaS value concrete.",
    bestFor: "Discovery calls where workflow friction is known but consequence and urgency remain weak.",
    watchFor: "Collecting background detail without helping the buyer articulate downstream impact.",
  },
  "/resources/sandler-upfront-contract-examples": {
    focus: "Open meetings with a short mutual agreement about purpose, agenda, time and outcomes.",
    bestFor: "Discovery, follow-up and qualification calls that need clarity without unnecessary formality.",
    watchFor: "Reciting a rigid script instead of matching the language and relationship in the room.",
  },
  "/resources/stop-sales-calls-becoming-checklist-interviews": {
    focus: "Merge overlapping methodology requirements into fewer, more natural questions.",
    bestFor: "Sellers using multiple playbooks or trying to recover coverage late in a call.",
    watchFor: "Optimising for completed fields instead of buyer understanding, trust and momentum.",
  },
}

const comparisonRows: Record<string, Array<{ criterion: string; salesFrame: string; alternative: string }>> = {
  "/compare/gong": [
    { criterion: "Primary job", salesFrame: "Live next-question coaching", alternative: "Revenue AI, conversation intelligence and coaching at scale" },
    { criterion: "During the call", salesFrame: "One contextual discovery question", alternative: "Signals, insights and broader revenue guidance" },
    { criterion: "After the call", salesFrame: "Transcript, evidence, notes and next-call brief", alternative: "Deep analytics, libraries, scorecards and deal intelligence" },
    { criterion: "Best fit", salesFrame: "Focused seller workflow", alternative: "Larger revenue organisations seeking platform breadth" },
  ],
  "/compare/clari-copilot": [
    { criterion: "Primary job", salesFrame: "Live discovery coaching", alternative: "Conversation intelligence connected to revenue orchestration" },
    { criterion: "During the call", salesFrame: "Natural next questions", alternative: "Live transcription, insights and battlecards" },
    { criterion: "Revenue context", salesFrame: "Account, opportunity and playbook evidence", alternative: "Clari pipeline, forecast and revenue-process context" },
    { criterion: "Best fit", salesFrame: "Simple rep-first guidance", alternative: "Teams already standardising on the Clari platform" },
  ],
  "/compare/fireflies": [
    { criterion: "Primary job", salesFrame: "Sales-specific live coaching", alternative: "Meeting capture, search and conversation analytics" },
    { criterion: "Audience", salesFrame: "B2B sellers and revenue teams", alternative: "Sales, recruiting, product, marketing and other meeting-heavy teams" },
    { criterion: "Methodology", salesFrame: "Playbook evidence shapes live questions", alternative: "Topics, sentiment and meeting analytics" },
    { criterion: "Best fit", salesFrame: "Improving discovery quality", alternative: "Making meetings searchable and easier to analyse" },
  ],
  "/compare/fathom": [
    { criterion: "Primary job", salesFrame: "Live sales conversation guidance", alternative: "AI meeting notes, summaries and follow-up" },
    { criterion: "During the call", salesFrame: "A next best question", alternative: "Automated capture so participants can stay present" },
    { criterion: "Sales depth", salesFrame: "Opportunity and methodology evidence", alternative: "Custom sales summary templates and CRM workflows" },
    { criterion: "Best fit", salesFrame: "Sellers who need direction", alternative: "Teams prioritising frictionless notes and recaps" },
  ],
  "/compare/outreach": [
    { criterion: "Primary job", salesFrame: "Live sales coaching", alternative: "Sales execution across engagement, deals and forecasting" },
    { criterion: "During the call", salesFrame: "Contextual discovery questions", alternative: "Kaia real-time enablement, content and conversation intelligence" },
    { criterion: "Workflow breadth", salesFrame: "Calls, playbooks and opportunity evidence", alternative: "Prospecting through deal progression and revenue operations" },
    { criterion: "Best fit", salesFrame: "Focused coaching layer", alternative: "Teams consolidating around an end-to-end execution platform" },
  ],
}

const publicPageReferences: Record<string, PublicPageReference[]> = {
  "/playbooks/meddicc": [{ publisher: "MEDDICC", label: "MEDDIC, MEDDICC and MEDDPICC methodology", href: "https://meddicc.com/meddpicc-sales-methodology-and-process" }],
  "/playbooks/bant": [{ publisher: "HubSpot", label: "Sales qualification and the BANT framework", href: "https://blog.hubspot.com/sales/ultimate-guide-to-sales-qualification" }],
  "/playbooks/spin-selling": [{ publisher: "Huthwaite International", label: "The SPIN methodology", href: "https://www.huthwaiteinternational.com/spin-methodology" }],
  "/playbooks/sandler": [{ publisher: "Sandler", label: "Up-front contracts: literal vs reality", href: "https://go.sandler.com/tbsalesdevelopment/insights/blog/categories/sales-process/up-front-contracts-literal-vs-reality/" }],
  "/playbooks/challenger-sale": [{ publisher: "Challenger", label: "What is the Challenger sales methodology?", href: "https://challengerinc.com/what-is-challenger-sales-methodology/" }],
  "/playbooks/gap-selling": [{ publisher: "Gong", label: "A practical guide to Gap Selling", href: "https://www.gong.io/blog/gap-selling" }],
  "/playbooks/spiced": [{ publisher: "Winning by Design", label: "The SPICED framework", href: "https://winningbydesign.com/spiced-framework/" }],
  "/ai-sales-coach": [{ publisher: "Gong", label: "Sales coaching software guide", href: "https://www.gong.io/sales-coaching-software" }],
  "/real-time-sales-coaching": [{ publisher: "Clari", label: "Clari conversation intelligence", href: "https://www.clari.com/conversation-intelligence/" }],
  "/sales-discovery-call-coach": [{ publisher: "Huthwaite International", label: "Research-based SPIN discovery", href: "https://www.huthwaiteinternational.com/spin-methodology" }],
  "/conversation-intelligence-alternative": [{ publisher: "Gong", label: "Conversation intelligence guide", href: "https://www.gong.io/conversation-intelligence" }],
  "/ai-meeting-notetaker-for-sales": [{ publisher: "Fathom", label: "Fathom AI meeting assistant", href: "https://fathom.video/" }],
  "/meddicc-software": [{ publisher: "MEDDICC", label: "MEDDPICC performance platform and methodology", href: "https://meddicc.com/" }],
  "/sales-call-coaching-software": [{ publisher: "Gong", label: "Modern sales coaching software", href: "https://www.gong.io/sales-coaching-software" }],
  "/compare/gong": [{ publisher: "Gong", label: "Gong conversation intelligence", href: "https://www.gong.io/conversation-intelligence" }],
  "/compare/clari-copilot": [{ publisher: "Clari", label: "Clari conversation intelligence and Copilot", href: "https://www.clari.com/conversation-intelligence/" }],
  "/compare/fireflies": [{ publisher: "Fireflies.ai", label: "Fireflies conversation intelligence", href: "https://fireflies.ai/conversation-intelligence" }],
  "/compare/fathom": [{ publisher: "Fathom", label: "Fathom AI meeting assistant", href: "https://fathom.video/" }],
  "/compare/outreach": [{ publisher: "Outreach", label: "Outreach for account executives", href: "https://www.outreach.io/persona/account-executives" }],
  "/resources/meddicc-discovery-questions": [{ publisher: "MEDDICC", label: "MEDDPICC methodology and process", href: "https://meddicc.com/meddpicc-sales-methodology-and-process" }],
  "/resources/bant-qualification-questions": [{ publisher: "HubSpot", label: "The BANT qualification framework", href: "https://blog.hubspot.com/sales/ultimate-guide-to-sales-qualification" }],
  "/resources/spin-selling-questions-for-saas-discovery": [{ publisher: "Huthwaite International", label: "The SPIN methodology", href: "https://www.huthwaiteinternational.com/spin-methodology" }],
  "/resources/sandler-upfront-contract-examples": [{ publisher: "Sandler", label: "How to use an up-front contract", href: "https://sandler.com/podcasts/how-to-succeed-at-knowing-when-to-use-an-upfront-contract/" }],
}

function getPageSnapshot(page: PublicPage): PublicPageSnapshot {
  return pageSnapshots[page.path] ?? {
    focus: page.intro,
    bestFor: page.sections[0]?.body ?? "Sellers building a more consistent discovery workflow.",
    watchFor: "Trying to apply every idea at once instead of choosing the next useful action.",
  }
}

function getPageVisual(page: PublicPage): PublicPageVisual {
  if (page.kind === "playbook" || page.path === "/playbooks") {
    return {
      src: "/media/salesframe-how-it-works-step-4.webp",
      width: 1120,
      height: 485,
      alt: "SalesFrame opportunity methodology screen showing selected sales playbooks and evidence coverage.",
      caption: `SalesFrame keeps ${page.title.toLowerCase()} connected to live opportunity evidence instead of a separate checklist.`,
    }
  }
  if (page.kind === "use-case" || page.path === "/use-cases") {
    return {
      src: "/media/salesframe-how-it-works-step-6.webp",
      width: 1120,
      height: 486,
      alt: "SalesFrame live call cockpit showing one next best discovery question.",
      caption: "The live coach keeps one timely question in the foreground and methodology coverage in the background.",
    }
  }
  if (page.kind === "comparison" || page.path === "/compare") {
    return {
      src: "/media/salesframe-how-it-works-step-5.webp",
      width: 1120,
      height: 485,
      alt: "A seller in a live video conversation, representing the moment SalesFrame is designed to support.",
      caption: "The comparison starts with the job to be done: help during the conversation, analyse it afterwards, or run a broader revenue workflow.",
    }
  }
  if (page.kind === "resource" || page.path === "/resources") {
    return {
      src: "/media/salesframe-how-it-works-step-3.webp",
      width: 1120,
      height: 487,
      alt: "SalesFrame customer research screen preparing account context before a sales call.",
      caption: "Useful discovery starts before the call with account context, a clear objective and the right questions to earn next.",
    }
  }

  return {
    src: "/media/salesframe-how-it-works-step-1.webp",
    width: 960,
    height: 720,
    alt: "Two sales professionals reviewing SalesFrame before a customer conversation.",
    caption: "SalesFrame brings preparation, live coaching and follow-up into one calm seller workflow.",
  }
}

function getPageKeywords(page: PublicPage) {
  return [
    page.title,
    ...page.sections.map((section) => section.heading),
    "SalesFrame",
    "real-time sales coaching",
    "B2B sales discovery",
    "next best question",
  ].join(", ")
}

function getPageReadTime(page: PublicPage) {
  const text = [page.title, page.intro, ...page.sections.flatMap((section) => [section.heading, section.body, ...(section.bullets ?? [])]), ...page.faq.flatMap((item) => [item.question, item.answer])].join(" ")
  return Math.max(5, Math.ceil(text.split(/\s+/).length / 180) + 3)
}

function getSectionId(heading: string) {
  return heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function getPracticalWorkflow(page: PublicPage) {
  if (page.kind === "playbook") return [
    { title: "Prepare the evidence", body: `Select ${page.title} for the opportunity and review what the buyer has already confirmed.` },
    { title: "Follow the conversation", body: "Listen for customer language that strengthens several fields at once instead of asking in acronym order." },
    { title: "Progress one gap", body: "Use the next best question to deepen the highest-value missing intent, then save the evidence for the deal." },
  ]
  if (page.kind === "comparison") return [
    { title: "Name the primary job", body: "Decide whether the team mainly needs live rep guidance, post-call intelligence, meeting productivity or a wider revenue platform." },
    { title: "Test a real workflow", body: "Run the same discovery scenario through both products and count the steps from preparation to an actionable next move." },
    { title: "Inspect trust and fit", body: "Review recording consent, data access, methodology depth, integrations and the amount of attention the tool demands during calls." },
  ]
  if (page.kind === "resource") return [
    { title: "Before the call", body: `Use this ${page.title.toLowerCase()} guide to choose a small number of outcomes and questions worth earning.` },
    { title: "During the call", body: "Follow the buyer's language, ask one question at a time and move deeper when an answer reveals impact or uncertainty." },
    { title: "After the call", body: "Turn customer statements into opportunity evidence, confirm the next step and identify the one gap to revisit next time." },
  ]
  if (page.kind === "hub") return [
    { title: "Choose the job", body: "Start with the category that matches the seller problem: methodology, live use case, product comparison or practical guide." },
    { title: "Read for action", body: "Use the direct answer and at-a-glance summary first, then go deeper into examples, evaluation criteria and FAQs." },
    { title: "Apply it live", body: "Bring the useful parts into an account or opportunity and let SalesFrame surface the next relevant question during the call." },
  ]
  return [
    { title: "Connect the context", body: "Bring the account, opportunity, previous evidence and selected playbooks into one preparation flow." },
    { title: "Coach the live moment", body: `Use ${page.title.toLowerCase()} to give the seller one concise next move while the buyer is still speaking.` },
    { title: "Preserve the evidence", body: "Save transcript turns, methodology coverage, notes and next steps so the following conversation starts stronger." },
  ]
}

function getEvaluationPoints(page: PublicPage) {
  if (page.kind === "playbook") return [
    "Does the guidance respect conversation timing instead of forcing framework order?",
    "Can one buyer answer update overlapping fields across multiple playbooks?",
    "Is every coverage claim traceable to customer evidence?",
    "Can the seller see the next useful gap without exposing a distracting scorecard?",
  ]
  if (page.kind === "comparison") return [
    "What is the product's primary job, and is that the problem your sellers actually feel?",
    "What appears on screen during a live call, and how much attention does it demand?",
    "How are recordings, transcripts, permissions and retention controlled?",
    "Can you test the workflow with one real opportunity before committing to platform breadth?",
  ]
  if (page.kind === "resource") return [
    "Can a seller use the guidance without reading a script to the buyer?",
    "Do the questions move from context into business impact and decision evidence?",
    "Is there a clear way to adapt the guide to deal stage and buyer trust?",
    "Does the post-call review turn answers into a credible next step?",
  ]
  if (page.kind === "hub") return [
    "Start with the page closest to the immediate seller problem.",
    "Prefer one framework applied well over several frameworks applied mechanically.",
    "Use comparisons to clarify fit, not to count features without context.",
    "Turn every useful idea into a question, evidence standard or next action.",
  ]
  return [
    "Does it help while the conversation can still change, not only after the call?",
    "Is guidance shaped by the account, opportunity and selected methodology?",
    "Can the seller understand and dismiss the suggestion in a few seconds?",
    "Does the workflow leave clean evidence, notes and next steps after the meeting?",
  ]
}

function getRelatedLinks(page: PublicPage) {
  if (page.related) return page.related
  if (page.kind === "playbook") return coreMethodologyLinks.filter((link) => link.href !== page.path).slice(0, 4)
  if (page.kind === "comparison") return comparisonLinks.filter((link) => link.href !== page.path).slice(0, 4)
  if (page.kind === "resource") return resourceLinks.filter((link) => link.href !== page.path).slice(0, 4)

  return coreUseCaseLinks.filter((link) => link.href !== page.path).slice(0, 4)
}

function setMeta(selector: string, attribute: "content" | "href", value: string) {
  const element = document.head.querySelector(selector)

  if (!element) return

  element.setAttribute(attribute, value)
}

function buildPageSchema(page: PublicPage) {
  const canonicalUrl = `${siteUrl}${page.path}`
  const visual = getPageVisual(page)
  const references = publicPageReferences[page.path] ?? []
  const breadcrumbItems = [
    {
      "@type": "ListItem",
      position: 1,
      name: "SalesFrame",
      item: siteUrl,
    },
    {
      "@type": "ListItem",
      position: 2,
      name:
        page.kind === "playbook"
          ? "Playbooks"
          : page.kind === "comparison"
            ? "Compare"
            : page.kind === "resource"
              ? "Resources"
              : page.kind === "use-case"
                ? "Use Cases"
                : page.title,
      item:
        page.kind === "playbook"
          ? `${siteUrl}/playbooks`
          : page.kind === "comparison"
            ? `${siteUrl}/compare`
            : page.kind === "resource"
              ? `${siteUrl}/resources`
              : page.kind === "use-case"
                ? `${siteUrl}/use-cases`
                : canonicalUrl,
    },
  ]

  if (breadcrumbItems[1].item !== canonicalUrl) {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: 3,
      name: page.title,
      item: canonicalUrl,
    })
  }

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": page.kind === "hub" ? "CollectionPage" : "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: page.seoTitle,
        description: page.seoDescription,
        abstract: page.intro,
        dateModified: "2026-07-10",
        datePublished: "2026-07-10",
        keywords: getPageKeywords(page),
        isPartOf: {
          "@id": `${siteUrl}/#website`,
        },
        about: {
          "@id": `${siteUrl}/#software`,
        },
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: `${siteUrl}${visual.src}`,
          width: visual.width,
          height: visual.height,
          caption: visual.caption,
        },
        publisher: {
          "@id": `${siteUrl}/#organization`,
        },
        citation: references.map((reference) => reference.href),
        inLanguage: "en-AU",
      },
      ...((page.kind === "playbook" || page.kind === "resource")
        ? [{
            "@type": "Article",
            "@id": `${canonicalUrl}#article`,
            headline: page.title,
            description: page.seoDescription,
            dateModified: "2026-07-10",
            datePublished: "2026-07-10",
            image: `${siteUrl}${visual.src}`,
            mainEntityOfPage: {
              "@id": `${canonicalUrl}#webpage`,
            },
            author: {
              "@id": `${siteUrl}/#organization`,
            },
            publisher: {
              "@id": `${siteUrl}/#organization`,
            },
          }]
        : []),
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        itemListElement: breadcrumbItems,
      },
      {
        "@type": "FAQPage",
        "@id": `${canonicalUrl}#faq`,
        mainEntity: page.faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    ],
  }
}

export function getPublicMarketingPageMetadata(path: string): PublicMarketingPageMetadata | null {
  const page = publicPagesByPath.get(path)
  if (!page) return null
  const visual = getPageVisual(page)

  return {
    canonicalUrl: `${siteUrl}${page.path}`,
    description: page.seoDescription,
    imageAlt: visual.alt,
    imageHeight: visual.height,
    imageUrl: `${siteUrl}${visual.src}`,
    imageWidth: visual.width,
    keywords: getPageKeywords(page),
    schema: buildPageSchema(page),
    title: page.seoTitle,
  }
}

function usePublicPageMetadata(page: PublicPage | null) {
  React.useEffect(() => {
    if (!page) return

    const canonicalUrl = `${siteUrl}${page.path}`
    const visual = getPageVisual(page)
    const schemaId = "salesframe-public-page-schema"

    document.title = page.seoTitle
    setMeta('meta[name="description"]', "content", page.seoDescription)
    setMeta('meta[name="keywords"]', "content", getPageKeywords(page))
    setMeta('meta[name="robots"]', "content", "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1")
    setMeta('link[rel="canonical"]', "href", canonicalUrl)
    setMeta('meta[property="og:url"]', "content", canonicalUrl)
    setMeta('meta[property="og:title"]', "content", page.seoTitle)
    setMeta('meta[property="og:description"]', "content", page.seoDescription)
    setMeta('meta[property="og:image"]', "content", `${siteUrl}${visual.src}`)
    setMeta('meta[property="og:image:alt"]', "content", visual.alt)
    setMeta('meta[property="og:image:width"]', "content", String(visual.width))
    setMeta('meta[property="og:image:height"]', "content", String(visual.height))
    setMeta('meta[name="twitter:title"]', "content", page.seoTitle)
    setMeta('meta[name="twitter:description"]', "content", page.seoDescription)
    setMeta('meta[name="twitter:image"]', "content", `${siteUrl}${visual.src}`)
    setMeta('meta[name="twitter:image:alt"]', "content", visual.alt)

    let schema = document.getElementById(schemaId) as HTMLScriptElement | null
    if (!schema) {
      schema = document.createElement("script")
      schema.id = schemaId
      schema.type = "application/ld+json"
      document.head.appendChild(schema)
    }
    schema.textContent = JSON.stringify(buildPageSchema(page))

    return () => {
      document.getElementById(schemaId)?.remove()
    }
  }, [page])
}

function SalesFrameMark() {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-black text-white">
      <AudioLinesIcon aria-hidden="true" className="size-5" />
    </span>
  )
}

function PublicPageHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-black/10 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <a href="/" className="inline-flex min-h-11 items-center gap-3 text-sm font-medium tracking-tight text-black">
          <SalesFrameMark />
          <span>SalesFrame</span>
        </a>

        <nav aria-label="Public navigation" className="hidden items-center gap-5 text-xs text-black/55 sm:flex">
          {publicMarketingNavGroups.map((group) => (
            <a key={group.id} href={group.href} className="transition-colors hover:text-black">
              {group.label}
            </a>
          ))}
        </nav>

        <Button asChild className="min-h-11 bg-black px-4 text-white hover:bg-black/85 sm:min-h-9">
          <a href="/signup">Sign Up</a>
        </Button>
      </div>
    </header>
  )
}

function PublicPageFooter() {
  return (
    <footer className="border-t border-black/10 bg-white">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-10 sm:px-8 md:grid-cols-4">
        {publicMarketingNavGroups.map((group) => (
          <div key={group.id} className="grid gap-3">
            <a href={group.href} className="inline-flex min-h-11 items-center text-xs font-medium text-black sm:min-h-0">
              {group.label}
            </a>
            <div className="grid gap-2">
              {group.links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="inline-flex min-h-11 items-center text-sm leading-5 text-black/60 transition-colors hover:text-black sm:min-h-0"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </footer>
  )
}

function getPageKindLabel(page: PublicPage) {
  if (page.kind === "playbook") return "Sales playbook"
  if (page.kind === "comparison") return "Product comparison"
  if (page.kind === "resource") return "Practical guide"
  if (page.kind === "use-case") return "Sales coaching use case"
  return "SalesFrame library"
}

function PageHero({ page }: { page: PublicPage }) {
  const snapshot = getPageSnapshot(page)

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(19rem,0.75fr)] lg:gap-14">
      <div className="max-w-3xl">
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-black/42">{getPageKindLabel(page)}</p>
        <h1 className="text-balance text-4xl font-medium tracking-[-0.035em] text-black sm:text-5xl lg:text-6xl">
          {page.title}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-black/68 sm:text-xl sm:leading-9">{page.intro}</p>
        <p className="mt-5 text-xs text-black/45">Reviewed 10 July 2026 · {getPageReadTime(page)} minute read</p>
      </div>

      <aside className="grid gap-6 rounded-3xl bg-black p-6 text-white sm:p-7" aria-label="At a glance">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/45">Direct answer</p>
          <p className="mt-3 text-lg leading-7 text-white/90">{snapshot.focus}</p>
        </div>
        <dl className="grid gap-5 border-t border-white/15 pt-5 text-sm">
          <div>
            <dt className="font-medium text-white">Best for</dt>
            <dd className="mt-1 leading-6 text-white/62">{snapshot.bestFor}</dd>
          </div>
          <div>
            <dt className="font-medium text-white">Watch for</dt>
            <dd className="mt-1 leading-6 text-white/62">{snapshot.watchFor}</dd>
          </div>
        </dl>
      </aside>
    </div>
  )
}

function PageVisual({ page }: { page: PublicPage }) {
  const visual = getPageVisual(page)

  return (
    <figure className="mt-12 overflow-hidden rounded-3xl bg-black/[0.035] ring-1 ring-black/8 sm:mt-16">
      <img
        src={visual.src}
        alt={visual.alt}
        width={visual.width}
        height={visual.height}
        loading="eager"
        decoding="async"
        className="aspect-[2.3/1] w-full object-cover"
      />
      <figcaption className="px-5 py-4 text-sm leading-6 text-black/58 sm:px-6">{visual.caption}</figcaption>
    </figure>
  )
}

function OnPageNavigation({ page }: { page: PublicPage }) {
  const links = [
    ...page.sections.map((section) => ({ href: `#${getSectionId(section.heading)}`, label: section.heading })),
    ...(page.kind === "comparison" ? [{ href: "#comparison-snapshot", label: "Comparison snapshot" }] : []),
    { href: "#practical-workflow", label: "How to apply it" },
    { href: "#evaluation-guide", label: "Evaluation guide" },
    { href: "#frequently-asked-questions", label: "FAQ" },
  ]

  return (
    <nav aria-label="On this page" className="mt-8 border-y border-black/10 py-3 sm:mt-10">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="shrink-0 pr-2 text-xs font-medium text-black/45">On this page</span>
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-xs text-black/62 transition-colors hover:bg-black hover:text-white sm:min-h-8"
          >
            {link.label}
          </a>
        ))}
      </div>
    </nav>
  )
}

function PageSection({ section, index }: { section: PublicPageSection; index: number }) {
  return (
    <section id={getSectionId(section.heading)} className="scroll-mt-24 border-t border-black/10 py-9 first:border-t-0 first:pt-0 sm:py-11">
      <div className="grid gap-4 sm:grid-cols-[2.5rem_minmax(0,1fr)] sm:gap-5">
        <span className="text-xs font-medium tabular-nums text-black/35">{String(index + 1).padStart(2, "0")}</span>
        <div className="grid gap-4">
          <h2 className="text-2xl font-medium tracking-tight text-black">{section.heading}</h2>
          <p className="max-w-2xl text-base leading-7 text-black/68">{section.body}</p>
          {section.bullets ? (
            <ul className="mt-1 grid gap-3 text-base leading-7 text-black/68">
              {section.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-3">
                  <span className="mt-1.5 grid size-5 shrink-0 place-items-center rounded-full bg-black text-white" aria-hidden="true">
                    <CheckIcon className="size-3" />
                  </span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function ComparisonSnapshot({ page }: { page: PublicPage }) {
  const rows = comparisonRows[page.path]
  if (!rows) return null
  const alternativeName = page.title.replace("SalesFrame vs ", "")

  return (
    <section id="comparison-snapshot" className="scroll-mt-24 border-t border-black/10 py-10">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-black/42">Side-by-side</p>
      <h2 className="mt-3 text-2xl font-medium tracking-tight text-black">SalesFrame and {alternativeName} at a glance</h2>
      <p className="mt-3 max-w-2xl text-base leading-7 text-black/65">
        This is a fit comparison, not a claim that one product should replace every job performed by the other.
      </p>
      <div className="mt-6 overflow-hidden rounded-2xl ring-1 ring-black/10">
        <div className="hidden grid-cols-[0.7fr_1fr_1fr] gap-4 bg-black px-5 py-3 text-xs font-medium text-white sm:grid">
          <span>Decision area</span><span>SalesFrame</span><span>{alternativeName}</span>
        </div>
        {rows.map((row) => (
          <div key={row.criterion} className="grid gap-3 border-t border-black/8 p-5 first:border-t-0 sm:grid-cols-[0.7fr_1fr_1fr] sm:gap-4">
            <p className="text-sm font-medium text-black">{row.criterion}</p>
            <p className="text-sm leading-6 text-black/65"><span className="font-medium text-black sm:hidden">SalesFrame: </span>{row.salesFrame}</p>
            <p className="text-sm leading-6 text-black/65"><span className="font-medium text-black sm:hidden">{alternativeName}: </span>{row.alternative}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function PracticalWorkflow({ page }: { page: PublicPage }) {
  return (
    <section id="practical-workflow" className="scroll-mt-24 border-t border-black/10 py-10">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-black/42">Practical workflow</p>
      <h2 className="mt-3 text-2xl font-medium tracking-tight text-black">How to put this into practice</h2>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {getPracticalWorkflow(page).map((step, index) => (
          <div key={step.title} className="rounded-2xl bg-black/[0.035] p-5">
            <p className="text-xs font-medium text-black/35">0{index + 1}</p>
            <h3 className="mt-4 text-base font-medium text-black">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-black/62">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function EvaluationGuide({ page }: { page: PublicPage }) {
  return (
    <section id="evaluation-guide" className="scroll-mt-24 border-t border-black/10 py-10">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-black/42">Decision guide</p>
      <h2 className="mt-3 text-2xl font-medium tracking-tight text-black">What good looks like</h2>
      <p className="mt-3 max-w-2xl text-base leading-7 text-black/65">
        Use these checks to turn the page into a practical buying, coaching or call-preparation decision.
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {getEvaluationPoints(page).map((point) => (
          <li key={point} className="flex gap-3 rounded-2xl border border-black/10 p-4 text-sm leading-6 text-black/68">
            <CheckIcon aria-hidden="true" className="mt-1 size-4 shrink-0 text-black" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ReferenceSection({ page }: { page: PublicPage }) {
  const references = publicPageReferences[page.path] ?? []
  if (references.length === 0) return null

  return (
    <section className="border-t border-black/10 py-10" aria-labelledby="reference-heading">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-black/42">Sources</p>
      <h2 id="reference-heading" className="mt-3 text-2xl font-medium tracking-tight text-black">Authoritative references</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-black/58">
        Product capabilities and methodology definitions were checked against these first-party or specialist sources. Links open on the publisher's site.
      </p>
      <div className="mt-5 grid gap-2">
        {references.map((reference) => (
          <a
            key={reference.href}
            href={reference.href}
            target="_blank"
            rel="noreferrer"
            className="group flex min-h-11 items-center justify-between gap-4 rounded-xl bg-black/[0.035] px-4 py-3 text-sm text-black transition-colors hover:bg-black hover:text-white"
          >
            <span><span className="font-medium">{reference.publisher}</span><span className="text-black/55 group-hover:text-white/65"> · {reference.label}</span></span>
            <ArrowUpRightIcon aria-hidden="true" className="size-4 shrink-0" />
          </a>
        ))}
      </div>
    </section>
  )
}

function FAQSection({ page }: { page: PublicPage }) {
  return (
    <section id="frequently-asked-questions" className="scroll-mt-24 border-t border-black/10 py-10">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-black/42">Common questions</p>
      <h2 className="mt-3 text-2xl font-medium tracking-tight text-black">Frequently asked questions</h2>
      <div className="mt-6 grid gap-2">
        {page.faq.map((item) => (
          <details key={item.question} className="group rounded-xl bg-black/[0.035] px-4 py-3 sm:px-5">
            <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-medium text-black marker:hidden">
              {item.question}
            </summary>
            <p className="max-w-2xl pb-2 pt-2 text-sm leading-6 text-black/65">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

function KeyTakeaways({ page }: { page: PublicPage }) {
  const takeaways = page.sections.slice(0, 4).map((section) => section.body.split(/(?<=[.!?])\s/)[0])

  return (
    <aside className="h-fit rounded-2xl border border-black/10 p-5 lg:sticky lg:top-24" aria-label="Key takeaways">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-black/42">Key takeaways</p>
      <ul className="mt-4 grid gap-4">
        {takeaways.map((takeaway) => (
          <li key={takeaway} className="flex gap-3 text-sm leading-6 text-black/65">
            <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-black" />
            <span>{takeaway}</span>
          </li>
        ))}
      </ul>
    </aside>
  )
}

function RelatedLinks({ page }: { page: PublicPage }) {
  const relatedLinks = getRelatedLinks(page)
  if (relatedLinks.length === 0) return null

  return (
    <section className="border-t border-black/10 py-10">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-black/42">Next reads</p>
      <h2 className="mt-3 text-2xl font-medium tracking-tight text-black">Keep exploring</h2>
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {relatedLinks.map((link) => (
          <a key={link.href} href={link.href} className="flex min-h-11 items-center justify-between rounded-xl bg-black/[0.035] px-4 py-3 text-sm font-medium text-black transition-colors hover:bg-black hover:text-white">
            <span>{link.label}</span><span aria-hidden="true">→</span>
          </a>
        ))}
      </div>
    </section>
  )
}

function PublicPageCTA({ page }: { page: PublicPage }) {
  return (
    <section className="my-10 grid gap-5 rounded-3xl bg-black p-6 text-white sm:p-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/45">Take it into the next call</p>
        <h2 className="mt-3 text-2xl font-medium tracking-tight">Start with SalesFrame</h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-white/62">
          Turn {page.title.toLowerCase()} into live account context, methodology evidence and one natural next question for the seller.
        </p>
      </div>
      <div>
        <Button asChild className="min-h-11 bg-white px-5 text-black hover:bg-white/85">
          <a href="/signup">{page.ctaLabel ?? "Sign Up"}</a>
        </Button>
      </div>
    </section>
  )
}

export function PublicMarketingPage({ path }: { path: string }) {
  const page = publicPagesByPath.get(path) ?? null

  usePublicPageMetadata(page)

  if (!page) return null

  return (
    <main className="h-svh overflow-y-auto bg-white text-black">
      <PublicPageHeader />

      <article className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16 lg:py-20">
        <PageHero page={page} />
        <PageVisual page={page} />
        <OnPageNavigation page={page} />

        <div className="mt-10 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-14">
          <div>
            {page.sections.map((section, index) => (
              <PageSection key={section.heading} section={section} index={index} />
            ))}
            <ComparisonSnapshot page={page} />
            <PracticalWorkflow page={page} />
            <EvaluationGuide page={page} />
            <ReferenceSection page={page} />
            <FAQSection page={page} />
            <RelatedLinks page={page} />
            <PublicPageCTA page={page} />
          </div>
          <KeyTakeaways page={page} />
        </div>
      </article>

      <PublicPageFooter />
    </main>
  )
}
