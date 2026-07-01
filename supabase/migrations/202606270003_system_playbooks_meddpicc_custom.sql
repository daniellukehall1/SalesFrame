insert into public.playbooks (workspace_id, slug, name, description, best_for, evidence_standard, live_guidance, is_system)
values
  (null, 'meddpicc', 'MEDDPICC', 'MEDDICC qualification with explicit paper process coverage.', 'Enterprise deals where procurement, legal, security, privacy, or vendor onboarding can slow signature.', 'Every MEDDICC field plus paper process must have customer-sourced evidence and an owner.', 'Use MEDDICC evidence and add paper process prompts when buying steps or contracting risk become relevant.', true),
  (null, 'custom', 'Custom framework', 'Configurable fields for internal methodology variants.', 'Team-specific qualification models, internal sales plays, and framework variants.', 'Required fields, evidence standards, and completion rules should be clear and testable.', 'Treat configured fields as first-class guidance alongside system playbooks.', true)
on conflict (slug) where workspace_id is null do update
  set name = excluded.name,
      description = excluded.description,
      best_for = excluded.best_for,
      evidence_standard = excluded.evidence_standard,
      live_guidance = excluded.live_guidance,
      is_system = excluded.is_system,
      updated_at = now();

with field_rows(slug, label, description, sort_order) as (
  values
    ('meddpicc', 'Metrics', 'Quantified business impact, current baseline, and success target.', 10),
    ('meddpicc', 'Economic Buyer', 'Named person who owns the commercial outcome and approval path.', 20),
    ('meddpicc', 'Decision Criteria', 'The explicit standards the customer will use to compare options.', 30),
    ('meddpicc', 'Decision Process', 'Steps, dates, stakeholders, and approval gates required to buy.', 40),
    ('meddpicc', 'Paper Process', 'Legal, procurement, security, privacy, order form, and vendor onboarding steps required to complete purchase.', 50),
    ('meddpicc', 'Identify Pain', 'A business problem the customer agrees is worth solving.', 60),
    ('meddpicc', 'Champion', 'A validated internal advocate with influence and personal stake.', 70),
    ('meddpicc', 'Competition', 'Known alternatives, including incumbent tools and internal build paths.', 80),
    ('custom', 'Required field', 'The information that must be captured before the opportunity can progress.', 10),
    ('custom', 'Evidence standard', 'The proof needed before the app marks the field as complete.', 20),
    ('custom', 'Prompt pattern', 'The question style the seller should use when the field is weak or missing.', 30),
    ('custom', 'Exit criteria', 'The condition that confirms the playbook requirement has been satisfied.', 40)
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
