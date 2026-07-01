insert into public.playbooks (workspace_id, slug, name, description, best_for, evidence_standard, live_guidance, is_system)
values
  (null, 'value-selling', 'Value Selling', 'Customer value-led selling that ties business issues to impact, required capabilities, proof, and mutual value.', 'Discovery and business-case conversations where the seller needs the buyer to own the value case.', 'Connect customer-stated issues to quantified value, required capabilities, and buyer-owned success outcomes.', 'Move from business issue to reasons, impact, required capabilities, value proof, and a mutual plan without turning the call into an ROI worksheet.', true),
  (null, 'strategic-selling', 'Strategic Selling (Miller Heiman)', 'Complex-deal strategy for mapping buying influences, win-results, response modes, red flags, and next best actions.', 'Multi-stakeholder enterprise opportunities where political alignment and stakeholder strategy decide the outcome.', 'Each key buying influence should have role, influence level, win-result, attitude, response mode, red flags, and a next action.', 'Find missing buying influences, stakeholder win-results, red flags, and political risk before pushing for commitment.', true),
  (null, 'spiced', 'SPICED (Winning by Design)', 'Customer-centric recurring revenue qualification across Situation, Pain, Impact, Critical Event, and Decision.', 'SaaS and recurring revenue motions where urgency, impact, and decision alignment determine deal quality.', 'Each SPICED field should be evidenced in the customer''s words and connected to a qualified business outcome or buying trigger.', 'Keep discovery anchored in the buyer''s situation, pain, impact, critical event, and decision path while adapting to flow.', true)
on conflict (slug) where workspace_id is null do update
  set name = excluded.name,
      description = excluded.description,
      best_for = excluded.best_for,
      evidence_standard = excluded.evidence_standard,
      live_guidance = excluded.live_guidance,
      is_system = true,
      updated_at = now();

with field_rows(slug, label, description, sort_order) as (
  values
    ('value-selling', 'Business Issue', 'The customer-stated problem, initiative, risk, or opportunity that makes change relevant.', 10),
    ('value-selling', 'Reasons', 'Why the issue exists now, what changed, and why the current approach is not enough.', 20),
    ('value-selling', 'Impact', 'The operational, financial, customer, or employee consequence of leaving the issue unresolved.', 30),
    ('value-selling', 'Required Capabilities', 'The capabilities the customer believes are needed to address the issue and create value.', 40),
    ('value-selling', 'Value', 'The measurable business value or success outcome the customer wants from solving the issue.', 50),
    ('value-selling', 'Proof', 'Evidence, examples, benchmarks, or internal validation the buyer needs to believe the value case.', 60),
    ('value-selling', 'Mutual Plan', 'The agreed next steps, owners, timing, and buyer actions required to validate or realize value.', 70),
    ('strategic-selling', 'Economic Buying Influence', 'The person or group with final business authority over funding and business outcome.', 10),
    ('strategic-selling', 'User Buying Influence', 'The people whose work, team, or performance will be directly affected by the solution.', 20),
    ('strategic-selling', 'Technical Buying Influence', 'The evaluator or gatekeeper who can approve, block, or shape the technical requirements.', 30),
    ('strategic-selling', 'Coach', 'A credible internal guide who wants the seller to win and gives truthful deal navigation advice.', 40),
    ('strategic-selling', 'Win-Results', 'The business and personal outcomes each buying influence needs to see from the decision.', 50),
    ('strategic-selling', 'Red Flags', 'Known unknowns, missing stakeholders, political risks, unresolved objections, or weak access.', 60),
    ('strategic-selling', 'Response Mode', 'How the customer is likely to respond to change, such as growth, trouble, even keel, or overconfident.', 70),
    ('strategic-selling', 'Next Best Action', 'The specific action that improves deal position, access, influence, or risk clarity.', 80),
    ('spiced', 'Situation', 'The customer''s current environment, process, tools, team structure, constraints, and operating context.', 10),
    ('spiced', 'Pain', 'The problem, friction, risk, or missed opportunity the customer agrees is worth solving.', 20),
    ('spiced', 'Impact', 'The measurable business, operational, customer, employee, or executive consequence of the pain.', 30),
    ('spiced', 'Critical Event', 'The date, trigger, renewal, initiative, deadline, or external event creating urgency.', 40),
    ('spiced', 'Decision', 'How the customer will decide, who is involved, and what must happen before commitment.', 50),
    ('spiced', 'Success Criteria', 'The standards the customer will use to judge whether the solution and buying process succeeded.', 60)
)
insert into public.playbook_fields (playbook_id, label, description, sort_order)
select playbook.id, field_rows.label, field_rows.description, field_rows.sort_order
from field_rows
join public.playbooks playbook
  on playbook.slug = field_rows.slug
 and playbook.workspace_id is null
on conflict (playbook_id, label) do update
  set description = excluded.description,
      sort_order = excluded.sort_order,
      updated_at = now();
