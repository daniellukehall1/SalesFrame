begin;

with target_fields as (
  select field.id, field.playbook_id, playbook.slug
  from public.playbook_fields field
  join public.playbooks playbook
    on playbook.id = field.playbook_id
  where playbook.workspace_id is null
    and playbook.slug in ('meddicc', 'meddpicc')
    and field.label = 'Identified Pain'
),
canonical_fields as (
  select field.id, field.playbook_id
  from public.playbook_fields field
  join public.playbooks playbook
    on playbook.id = field.playbook_id
  where playbook.workspace_id is null
    and playbook.slug in ('meddicc', 'meddpicc')
    and field.label = 'Identify Pain'
),
duplicate_evidence as (
  select old_evidence.id
  from public.opportunity_field_evidence old_evidence
  join target_fields old_field
    on old_field.id = old_evidence.playbook_field_id
  join canonical_fields canonical_field
    on canonical_field.playbook_id = old_field.playbook_id
  join public.opportunity_field_evidence canonical_evidence
    on canonical_evidence.opportunity_id = old_evidence.opportunity_id
   and canonical_evidence.playbook_field_id = canonical_field.id
)
delete from public.opportunity_field_evidence evidence
using duplicate_evidence
where evidence.id = duplicate_evidence.id;

with target_fields as (
  select field.id, field.playbook_id
  from public.playbook_fields field
  join public.playbooks playbook
    on playbook.id = field.playbook_id
  where playbook.workspace_id is null
    and playbook.slug in ('meddicc', 'meddpicc')
    and field.label = 'Identified Pain'
),
canonical_fields as (
  select field.id, field.playbook_id
  from public.playbook_fields field
  join public.playbooks playbook
    on playbook.id = field.playbook_id
  where playbook.workspace_id is null
    and playbook.slug in ('meddicc', 'meddpicc')
    and field.label = 'Identify Pain'
)
update public.opportunity_field_evidence evidence
set playbook_field_id = canonical_fields.id,
    updated_at = now()
from target_fields
join canonical_fields
  on canonical_fields.playbook_id = target_fields.playbook_id
where evidence.playbook_field_id = target_fields.id;

delete from public.playbook_fields old_field
using public.playbooks playbook
where playbook.id = old_field.playbook_id
  and playbook.workspace_id is null
  and playbook.slug in ('meddicc', 'meddpicc')
  and old_field.label = 'Identified Pain'
  and exists (
    select 1
    from public.playbook_fields canonical_field
    where canonical_field.playbook_id = old_field.playbook_id
      and canonical_field.label = 'Identify Pain'
  );

update public.playbook_fields field
set label = 'Identify Pain',
    description = 'A business problem the customer agrees is worth solving.',
    sort_order = case playbook.slug
      when 'meddicc' then 50
      when 'meddpicc' then 60
      else field.sort_order
    end,
    updated_at = now()
from public.playbooks playbook
where playbook.id = field.playbook_id
  and playbook.workspace_id is null
  and playbook.slug in ('meddicc', 'meddpicc')
  and field.label = 'Identified Pain'
  and not exists (
    select 1
    from public.playbook_fields existing_field
    where existing_field.playbook_id = field.playbook_id
      and existing_field.label = 'Identify Pain'
  );

with field_rows(slug, label, description, sort_order) as (
  values
    ('meddicc', 'Metrics', 'Quantified business impact, current baseline, and success target.', 10),
    ('meddicc', 'Economic Buyer', 'Named person who owns the commercial outcome and approval path.', 20),
    ('meddicc', 'Decision Criteria', 'The explicit standards the customer will use to compare options.', 30),
    ('meddicc', 'Decision Process', 'Steps, dates, stakeholders, and approval gates required to buy.', 40),
    ('meddicc', 'Identify Pain', 'A business problem the customer agrees is worth solving.', 50),
    ('meddicc', 'Champion', 'A validated internal advocate with influence and personal stake.', 60),
    ('meddicc', 'Competition', 'Known alternatives, including incumbent tools and internal build paths.', 70),
    ('meddpicc', 'Metrics', 'Quantified business impact, current baseline, and success target.', 10),
    ('meddpicc', 'Economic Buyer', 'Named person who owns the commercial outcome and approval path.', 20),
    ('meddpicc', 'Decision Criteria', 'The explicit standards the customer will use to compare options.', 30),
    ('meddpicc', 'Decision Process', 'Steps, dates, stakeholders, and approval gates required to buy.', 40),
    ('meddpicc', 'Paper Process', 'Legal, procurement, security, privacy, order form, and vendor onboarding steps required to complete purchase.', 50),
    ('meddpicc', 'Identify Pain', 'A business problem the customer agrees is worth solving.', 60),
    ('meddpicc', 'Champion', 'A validated internal advocate with influence and personal stake.', 70),
    ('meddpicc', 'Competition', 'Known alternatives, including incumbent tools and internal build paths.', 80)
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

commit;
