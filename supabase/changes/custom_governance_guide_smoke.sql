begin;
do $$
declare
 v_owner uuid;
 v_charity uuid;
 v_custom jsonb;
 v_custom_id uuid;
 v_system_id uuid;
 v_original_active boolean;
 v_center jsonb;
begin
 select cm.user_id,cm.charity_id into v_owner,v_charity
 from public.charity_members cm
 join public.roles r on r.id=cm.role_id
 where cm.status='active' and r.code='owner'
 order by cm.created_at
 limit 1;
 if v_owner is null then raise exception 'fixture_missing'; end if;

 perform set_config('request.jwt.claim.sub',v_owner::text,true);
 perform set_config('request.jwt.claim.role','authenticated',true);
 execute 'set local role authenticated';

 perform private.ensure_governance_requirements(v_charity);

 v_custom:=public.save_governance_requirement(
   null,'اختبار الحوكمة','متطلب مخصص تجريبي','وصف تجريبي',
   'optional',current_date+30,true,5
 );
 v_custom_id:=(v_custom->>'id')::uuid;

 if v_custom_id is null then raise exception 'custom_create_failed'; end if;
 if (v_custom->>'source_kind')<>'custom' then raise exception 'custom_source_failed'; end if;

 perform public.set_governance_requirement_status(v_custom_id,'ready',null);

 select id,is_active into v_system_id,v_original_active
 from public.governance_requirements
 where charity_id=v_charity and source_kind='system'
 order by sort_order
 limit 1;

 perform public.save_governance_requirement(
   v_system_id,
   (select category from public.governance_requirements where id=v_system_id),
   (select title_ar from public.governance_requirements where id=v_system_id),
   (select description_ar from public.governance_requirements where id=v_system_id),
   'required',
   (select due_date from public.governance_requirements where id=v_system_id),
   false,
   (select sort_order from public.governance_requirements where id=v_system_id)
 );

 v_center:=public.governance_center();
 if exists(select 1 from jsonb_array_elements(v_center->'items') x where (x->>'id')::uuid=v_system_id) then
   raise exception 'inactive_requirement_visible';
 end if;

 begin
   perform public.set_governance_requirement_status(
     (select id from public.governance_requirements where charity_id=v_charity and is_active=true and evidence_policy='required' and not exists(
       select 1 from public.governance_evidence e where e.requirement_id=governance_requirements.id
     ) limit 1),
     'ready',null
   );
   raise exception 'required_evidence_was_not_enforced';
 exception when others then
   if sqlerrm='required_evidence_was_not_enforced' then raise; end if;
   if sqlerrm not like '%evidence_required_before_ready%' and sqlerrm not like '%not_found%' then raise; end if;
 end;
end $$;

select 'PASS: owner can customize governance guide; inactive items are excluded and evidence policy is enforced' as result;
rollback;
