export type LegalPageId = "terms" | "privacy"

export type LegalSection = {
  bullets?: string[]
  paragraphs?: string[]
  title: string
}

export const legalBusinessName = "ALLYCHAT PTY LTD"
export const legalBusinessAbn = "ABN 39 696 543 727"
export const legalContactEmail = "hello@salesframe.ai"
export const legalEffectiveDate = "29 June 2026"

export const termsSections: LegalSection[] = [
  {
    title: "1. Who operates SalesFrame",
    paragraphs: [
      `SalesFrame is provided by ${legalBusinessName} (${legalBusinessAbn}), an Australian company based in Sydney, New South Wales. References to "SalesFrame", "we", "us" or "our" mean ${legalBusinessName}.`,
      "By creating an account, accessing the service, using call capture, uploading information, saving an OpenAI API key, or otherwise using SalesFrame, you agree to these Terms of Service.",
    ],
  },
  {
    title: "2. What SalesFrame does",
    paragraphs: [
      "SalesFrame is a sales productivity and live coaching application. It may help authorised workspace users manage accounts and opportunities, capture call audio, generate transcripts, map evidence to sales methodologies, produce AI-assisted customer research, recommend next questions, and prepare post-call outputs.",
      "SalesFrame is not a legal, financial, compliance, employment, medical, security, procurement, or professional advisory service. AI-generated outputs are suggestions only and must be reviewed by a human before use.",
    ],
  },
  {
    title: "3. Eligibility and account responsibility",
    bullets: [
      "You must be at least 18 years old and able to enter a binding agreement.",
      "You are responsible for all activity under your account and workspace.",
      "You must keep login credentials, workspace access, and API keys secure.",
      "You must promptly notify us if you suspect unauthorised access or misuse.",
    ],
  },
  {
    title: "4. Call recording, transcription, and consent",
    paragraphs: [
      "You are solely responsible for ensuring every call, meeting, recording, transcript, note, customer research request, and AI analysis you initiate is lawful in every location that applies to you, your organisation, your customer, and all meeting participants.",
      "Before using recording, transcription, diarisation, customer research, or live guidance features, you must provide all notices and obtain all consents required under applicable privacy, surveillance, workplace, telecommunications, confidentiality, employment, contract, and data protection laws.",
      "You must not use SalesFrame to secretly record, monitor, profile, analyse, or process any person where doing so would be unlawful, misleading, unfair, or outside the permissions you have obtained.",
    ],
  },
  {
    title: "5. Your data and customer data",
    paragraphs: [
      "You retain ownership of data you submit to SalesFrame, including account records, opportunity records, profile notes, customer research inputs, call recordings, transcripts, notes, methodology evidence, and generated outputs.",
      "You grant us a non-exclusive, worldwide, royalty-free licence to host, process, transmit, secure, back up, analyse, display, and otherwise use that data only as reasonably necessary to provide, maintain, protect, improve, support, and troubleshoot SalesFrame.",
      "You warrant that you have all rights, permissions, notices, and consents necessary to provide the data to SalesFrame and to allow it to be processed through the service and its subprocessors.",
    ],
  },
  {
    title: "6. OpenAI API keys and AI services",
    paragraphs: [
      "SalesFrame is designed to use the OpenAI API key connected by the workspace user for AI-powered features. We do not promise that every OpenAI request will succeed, be uninterrupted, be free of latency, or produce accurate or complete output.",
      "AI outputs may be inaccurate, incomplete, delayed, inappropriate, duplicated, biased, or unsuitable for a particular sales context. You are solely responsible for reviewing outputs before relying on them, sending them externally, updating a CRM, making commercial decisions, or asking a customer a suggested question.",
      "You are responsible for your OpenAI account, usage, costs, rate limits, model availability, OpenAI terms, and any restrictions that apply to the API key you connect.",
    ],
  },
  {
    title: "7. Acceptable use",
    bullets: [
      "Do not use SalesFrame for unlawful recording, surveillance, scraping, harassment, discrimination, deception, spam, malware, security testing without permission, or infringement of third-party rights.",
      "Do not upload or process highly sensitive information unless you have a lawful basis, express permission where required, and a genuine business need.",
      "Do not attempt to bypass access controls, reverse engineer the service, overload infrastructure, or interfere with other users.",
      "Do not represent AI-generated guidance as guaranteed, professional advice, or a substitute for your own judgement.",
    ],
  },
  {
    title: "8. Third-party services",
    paragraphs: [
      "SalesFrame uses third-party infrastructure and services, which may include Supabase, Netlify, OpenAI, browser APIs, authentication providers, email providers, monitoring tools, and other hosting, storage, analytics, support, and security services.",
      "We are not responsible for third-party outages, model behaviour, API changes, browser limitations, provider terms, loss of access, pricing changes, security incidents, or failures outside our reasonable control.",
    ],
  },
  {
    title: "9. Service availability and changes",
    paragraphs: [
      "SalesFrame is provided on an evolving basis. We may add, remove, suspend, limit, rename, or change features, models, prompts, workflows, storage behaviour, retention periods, usage limits, integrations, and pricing.",
      "We do not guarantee that the service will be uninterrupted, error-free, secure from every threat, compatible with every browser, able to capture every audio source, or suitable for every sales methodology, workflow, jurisdiction, customer, or organisation.",
    ],
  },
  {
    title: "10. No sales outcome guarantee",
    paragraphs: [
      "SalesFrame does not guarantee revenue, pipeline, qualification accuracy, deal progression, customer response, forecast accuracy, compliance outcomes, or any particular business result.",
      "You remain responsible for your sales process, customer communications, methodology interpretation, business decisions, legal compliance, and records of truth.",
    ],
  },
  {
    title: "11. Fees and taxes",
    paragraphs: [
      "If paid plans, trials, usage charges, or invoices apply, you must pay all fees, usage costs, taxes, duties, and charges when due. Unless expressly stated otherwise, fees are non-refundable to the maximum extent permitted by law.",
      "We may suspend or limit access for unpaid fees, payment failure, suspected misuse, excessive usage, or legal/compliance risk.",
    ],
  },
  {
    title: "12. Intellectual property",
    paragraphs: [
      "We and our licensors own all rights in SalesFrame, including software, interfaces, designs, prompts, workflows, methodology mapping logic, documentation, branding, logos, and service improvements, excluding your data.",
      "You must not copy, modify, resell, white-label, sublicense, or commercially exploit SalesFrame except as expressly permitted by us in writing.",
    ],
  },
  {
    title: "13. Confidentiality and security",
    paragraphs: [
      "Each party must use reasonable care to protect confidential information received from the other party. We apply technical and organisational safeguards appropriate to the nature of the service, but no system can be guaranteed completely secure.",
      "You are responsible for configuring workspace access, limiting who can view customer data, using strong credentials, rotating compromised API keys, and ensuring your own devices, browsers, networks, and integrations are secure.",
    ],
  },
  {
    title: "14. Suspension and termination",
    paragraphs: [
      "We may suspend, restrict, or terminate access immediately if we reasonably believe there is unlawful use, security risk, non-payment, breach of these terms, misuse of AI or recording features, infringement of third-party rights, or risk to us, users, customers, or infrastructure.",
      "You may stop using SalesFrame at any time. Deleting data may be subject to retention, backup, legal, security, fraud-prevention, accounting, or operational requirements.",
    ],
  },
  {
    title: "15. Indemnity",
    paragraphs: [
      `To the maximum extent permitted by law, you indemnify ${legalBusinessName}, its officers, employees, contractors, suppliers, and affiliates against claims, losses, liabilities, damages, penalties, costs, and expenses arising from your data, your use of SalesFrame, unlawful recording or transcription, failure to obtain consent, breach of these terms, breach of law, third-party claims, or reliance on AI outputs.`,
    ],
  },
  {
    title: "16. Liability limits",
    paragraphs: [
      "Nothing in these terms excludes, restricts, or modifies any consumer guarantee, right, remedy, liability, or obligation that cannot be excluded under the Australian Consumer Law or other applicable law.",
      "Subject to the previous sentence and to the maximum extent permitted by law, SalesFrame is provided 'as is' and 'as available', and we exclude all warranties, guarantees, representations, and conditions not expressly stated in these terms.",
      "To the maximum extent permitted by law, we are not liable for indirect, consequential, special, exemplary, punitive, or economic loss, loss of profit, loss of revenue, loss of goodwill, loss of opportunity, loss or corruption of data, loss of customers, business interruption, failed deals, AI output errors, recording failures, transcription errors, or third-party service failures.",
      "To the maximum extent permitted by law, our total aggregate liability arising out of or relating to SalesFrame is limited to the fees paid by you to us for the service in the 12 months before the event giving rise to liability, or AUD 100 if no fees were paid.",
    ],
  },
  {
    title: "17. Governing law and disputes",
    paragraphs: [
      "These terms are governed by the laws of New South Wales, Australia. The parties submit to the exclusive jurisdiction of the courts of New South Wales and the Commonwealth courts of Australia sitting in or having jurisdiction over New South Wales.",
      `Before commencing court proceedings, you must first contact us at ${legalContactEmail} and give us a reasonable opportunity to resolve the issue, except where urgent injunctive or equitable relief is required.`,
    ],
  },
  {
    title: "18. Contact",
    paragraphs: [
      `Questions about these terms can be sent to ${legalContactEmail}.`,
    ],
  },
]

export const privacySections: LegalSection[] = [
  {
    title: "1. Who this policy applies to",
    paragraphs: [
      `This Privacy Policy explains how ${legalBusinessName} (${legalBusinessAbn}), trading as SalesFrame, handles personal information in connection with SalesFrame. It is designed for Australian privacy law, including the Privacy Act 1988 (Cth) and the Australian Privacy Principles where they apply.`,
      `Our privacy contact is ${legalContactEmail}.`,
    ],
  },
  {
    title: "2. Information we collect",
    bullets: [
      "Account and identity details, such as name, email address, profile information, avatar, authentication identifiers, workspace membership, and support communications.",
      "Workspace records, such as workspace names, company details, seller profile, company domain, product context, currency, settings, and OpenAI key connection status.",
      "Customer and deal information entered by users, such as account names, websites, industry, profile notes, stakeholders, opportunity names, amount, stage, close date, methodology fields, risks, and next steps.",
      "Call content and metadata, such as audio recordings, transcripts, speaker labels, timestamps, call type, selected playbooks, audio preflight results, notes, methodology evidence, and post-call outputs.",
      "AI inputs and outputs, such as customer research requests, prompts, model responses, follow-up drafts, next-call briefs, live guidance events, and evidence mappings.",
      "Technical and usage information, such as browser type, device information, IP address, logs, diagnostics, errors, security events, performance data, and feature usage.",
    ],
  },
  {
    title: "3. Sensitive information and call content",
    paragraphs: [
      "SalesFrame may process call recordings, transcripts, notes, and customer profile notes that include personal information and, depending on what meeting participants say or users enter, sensitive information.",
      "You must not submit, record, transcribe, or analyse sensitive information unless you have a lawful basis, all required consents, and a genuine business need. You are responsible for the content you capture and upload.",
    ],
  },
  {
    title: "4. How we collect information",
    bullets: [
      "Directly from users when they create accounts, enter workspace data, connect an API key, upload or edit records, start calls, or contact support.",
      "Through browser and application features when users capture audio, generate transcripts, use live guidance, or create post-call outputs.",
      "From connected third-party services and subprocessors where needed to provide the service.",
      "From public sources selected for customer research, such as company websites, LinkedIn, investor pages, regulator or registry pages, reputable business media, and other trusted public sources.",
    ],
  },
  {
    title: "5. Why we use information",
    bullets: [
      "To provide, operate, secure, troubleshoot, improve, and support SalesFrame.",
      "To authenticate users and enforce workspace access controls.",
      "To save and display account, opportunity, call, transcript, recording, methodology, research, and post-call data.",
      "To process AI-powered features using the OpenAI API key connected by the user or workspace.",
      "To generate live question guidance, summaries, evidence mappings, follow-up drafts, next-call briefs, and research outputs.",
      "To detect misuse, investigate incidents, protect rights and safety, comply with law, and enforce terms.",
      "To communicate service, security, billing, product, and support information.",
    ],
  },
  {
    title: "6. OpenAI API keys",
    paragraphs: [
      "SalesFrame stores OpenAI API keys in encrypted form server-side and does not expose saved key values back to the browser after saving.",
      "When AI features are used, relevant inputs may be sent to OpenAI so the requested feature can work. This may include account context, opportunity context, seller profile, customer research inputs, transcript excerpts, notes, selected playbooks, and prior evidence.",
      "Users are responsible for ensuring their OpenAI account, API key, model use, data processing settings, and OpenAI terms are appropriate for the information they process through SalesFrame.",
    ],
  },
  {
    title: "7. Disclosure to service providers",
    paragraphs: [
      "We may disclose information to service providers that help us operate SalesFrame, including hosting, database, storage, authentication, serverless functions, AI processing, analytics, logging, monitoring, customer support, email, security, and payment providers.",
      "Current or intended infrastructure may include Supabase, Netlify, OpenAI, browser platform services, and related operational providers. Providers may change over time.",
    ],
  },
  {
    title: "8. Overseas disclosures",
    paragraphs: [
      "Some providers may store or process information outside Australia, including in the United States, Europe, or other jurisdictions where our providers or their infrastructure operate.",
      "By using SalesFrame, you acknowledge that information may be transferred to and processed in those locations, subject to our provider arrangements and applicable law.",
    ],
  },
  {
    title: "9. Recording retention and deletion",
    paragraphs: [
      "SalesFrame is designed with a 90-day recording retention approach unless a different retention period is configured, required, or technically necessary. Transcripts, notes, evidence, and account or opportunity records may remain after recordings are deleted unless you delete them or a retention rule applies.",
      "Deletion may not immediately remove data from backups, logs, caches, audit records, security systems, legal holds, accounting records, or third-party provider systems where retention is required or technically necessary.",
    ],
  },
  {
    title: "10. Security",
    paragraphs: [
      "We use technical and organisational safeguards designed to protect information, such as authentication, access controls, private storage, encryption of saved OpenAI keys, and server-side controls for privileged operations.",
      "No method of transmission, storage, browser capture, AI processing, or internet service is completely secure. Users must protect their devices, browsers, credentials, workspace access, and API keys.",
    ],
  },
  {
    title: "11. Notifiable Data Breaches",
    paragraphs: [
      "Where the Notifiable Data Breaches scheme applies, we will assess suspected eligible data breaches and notify affected individuals and the Office of the Australian Information Commissioner where required by law.",
    ],
  },
  {
    title: "12. Access, correction, and complaints",
    paragraphs: [
      `You can request access to or correction of personal information we hold about you by contacting ${legalContactEmail}. We may need to verify your identity and may refuse or limit access where permitted by law.`,
      `Privacy complaints should be sent to ${legalContactEmail}. We will aim to respond within a reasonable period. If you are not satisfied, you may contact the Office of the Australian Information Commissioner.`,
    ],
  },
  {
    title: "13. Marketing communications",
    paragraphs: [
      "We may send service, security, product, and marketing communications where permitted by law. You can opt out of marketing communications where an unsubscribe mechanism is provided, but we may still send essential service or security notices.",
    ],
  },
  {
    title: "14. Children",
    paragraphs: [
      "SalesFrame is intended for business users aged 18 and over. It is not designed for children, and users must not knowingly submit children's personal information unless they have a lawful basis and all required authority.",
    ],
  },
  {
    title: "15. Changes to this policy",
    paragraphs: [
      "We may update this Privacy Policy as SalesFrame, our providers, our business, or applicable law changes. The updated version will be made available in the app or on our website.",
    ],
  },
]
