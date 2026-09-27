begin;
do $$
declare
 v_owner uuid;
 v_charity uuid;
 v_custom jsonb;
 v_custom_id uuid;
 v_system jsonb;
 v_system_id uuid;
 v_catalog jsonb;
 v_center jsonb;
 v_required_id uuid;
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

 v_center:=public.governance_center();

 v_custom:=public.save_governance_requirement(
   null,'اختبار الحوكمة','متطلب مخصص تجريبي','وصف تجريبي',
   'optional',current_date+30,true,5
 );
 v_custom_id:=(v_custom->>'id')::uuid;
 if v_custom_id is null then raise exception 'custom_create_failed'; end if;
 if (v_custom->>'source_kind')<>'custom' then raise exception 'custom_source_failed'; end if;

 perform public.set_governance_requirement_status(v_custom_id,'ready',null);

 v_catalog:=public.governance_requirement_catalog();
 select x into v_system
 from jsonb_array_elements(v_catalog) x
 where x->>'source_kind'='system'
 order by coalesce((x->>'sort_order')::int,100)
 limit 1;

 v_system_id:=(v_system->>'id')::uuid;
 if v_system_id is null then raise exception 'system_requirement_missing'; end if;

 perform public.save_governance_requirement(
   v_system_id,
   v_system->>'category',
   v_system->>'title_ar',
   v_system->>'description_ar',
   'required',
   nullif(v_system->>'due_date','')::date,
   false,
   coalesce((v_system->>'sort_order')::int,100)
 );

 v_center:=public.governance_center();
 if exists(select 1 from jsonb_array_elements(v_center->'items') x where (x->>'id')::uuid=v_system_id) then
   raise exception 'inactive_requirement_visible';
 end if;

 select (x->>'id')::uuid into v_required_id
 from jsonb_array_elements(v_center->'items') x
 where x->>'evidence_policy'='required' and coalesce((x->>'evidence_count')::int,0)=0
 limit 1;

 if v_required_id is not null then
   begin
     perform public.set_governance_requirement_status(v_required_id,'ready',null);
     raise exception 'required_evidence_was_not_enforced';
   exception when others then
     if sqlerrm='required_evidence_was_not_enforced' then raise; end if;
     if sqlerrm not like '%evidence_required_before_ready%' then raise; end if;
   end;
 end if;
end $$;

select 'PASS: owner can customize governance guide; inactive items are excluded and evidence policy is enforced' as result;
rollback;
