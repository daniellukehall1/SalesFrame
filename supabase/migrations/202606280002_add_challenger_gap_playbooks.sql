insert into public.playbooks (workspace_id, slug, name, description, best_for, evidence_standard, live_guidance, is_system)
values
  (null, 'challenger', 'The Challenger Sale', 'Commercial insight-led selling that teaches, tailors, and takes control of the buying conversation.', 'Calls where the seller needs to challenge the customer''s current thinking with credible insight and create urgency for change.', 'Connect a customer-specific insight to a reframed problem, quantified business impact, and differentiated reason to act.', 'Help the seller reframe the customer''s view, create constructive tension, and move from insight to a customer-owned business case.', true),
  (null, 'gap-selling', 'Gap Selling', 'Problem-centric discovery that contrasts current state, future state, root cause, impact, and urgency.', 'Discovery calls where the seller needs to diagnose the real business gap before discussing product fit.', 'Capture the customer''s current state, desired future state, root cause, measurable gap, and reason to change now.', 'Keep the seller diagnosing the gap until the customer can articulate why the current state must change.', true)
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
    ('challenger', 'Commercial Insight', 'A credible market, operational, or business insight that matters to the customer''s context.', 10),
    ('challenger', 'Reframe', 'A sharper way for the customer to see the problem, risk, or missed opportunity.', 20),
    ('challenger', 'Rational Drowning', 'Quantified evidence that makes the cost of the status quo hard to ignore.', 30),
    ('challenger', 'Emotional Impact', 'Personal, team, or executive consequence that makes the issue feel urgent and human.', 40),
    ('challenger', 'New Way', 'The changed approach the customer needs to believe in before evaluating solution fit.', 50),
    ('challenger', 'Unique Strengths', 'Differentiated capabilities tied to the reframe, not generic product claims.', 60),
    ('challenger', 'Constructive Tension', 'A respectful challenge that advances urgency without sounding combative.', 70),
    ('gap-selling', 'Current State', 'How the customer operates today, including process, tools, symptoms, and constraints.', 10),
    ('gap-selling', 'Future State', 'The specific business condition the customer wants instead.', 20),
    ('gap-selling', 'Gap', 'The measurable distance between current and future state.', 30),
    ('gap-selling', 'Root Cause', 'The underlying reason the current state exists, beyond surface symptoms.', 40),
    ('gap-selling', 'Impact', 'Business, financial, operational, or personal consequence of the gap.', 50),
    ('gap-selling', 'Urgency', 'Why solving the gap matters now instead of later.', 60),
    ('gap-selling', 'Decision Criteria', 'The standards the customer will use to decide whether the gap is solved.', 70)
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
