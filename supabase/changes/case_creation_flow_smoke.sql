begin;
do $$
declare u uuid;c uuid;b uuid;r jsonb;cid uuid;
begin
 select cm.user_id,cm.charity_id into u,c from public.charity_members cm join public.roles ro on ro.id=cm.role_id where cm.status='active' and ro.code in('owner','case_manager') order by (ro.code='case_manager') desc limit 1;
 select id into b from public.beneficiaries where charity_id=c limit 1;
 if u is null or b is null then raise exception 'fixture_missing'; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claim.role','authenticated',true);
 execute 'set local role authenticated';
 r:=public.create_case(b,'Smoke test case','normal');
 cid:=(r->>'id')::uuid;
 if cid is null then raise exception 'case_create_failed'; end if;
 if not exists(select 1 from public.cases where id=cid and charity_id=c and beneficiary_id=b and priority='normal' and status='new') then raise exception 'case_binding_failed'; end if;
end $$;
rollback;