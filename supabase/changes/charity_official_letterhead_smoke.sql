begin;
do $$
declare
 v_owner uuid;
 v_charity uuid;
 v_donation uuid;
 v_template jsonb;
 v_template_id uuid;
 v_doc jsonb;
begin
 select cm.user_id,cm.charity_id into v_owner,v_charity
 from public.charity_members cm
 join public.roles r on r.id=cm.role_id
 where cm.status='active' and r.code='owner'
 order by cm.created_at
 limit 1;

 select id into v_donation
 from public.donations
 where charity_id=v_charity and status='received'
 order by donated_at desc
 limit 1;

 if v_owner is null or v_donation is null then raise exception 'fixture_missing'; end if;

 perform set_config('request.jwt.claim.sub',v_owner::text,true);
 perform set_config('request.jwt.claim.role','authenticated',true);
 execute 'set local role authenticated';

 v_template:=public.save_donor_thank_you_template(
  v_charity::text||'/templates/donor-thank-you/background-smoke.png',
  v_charity::text||'/templates/donor-thank-you/source-smoke.pdf',
  'شكرًا {{donor_name}} على {{donation_summary}}',
  62,22,13
 );
 v_template_id:=(v_template->>'id')::uuid;
 if v_template_id is null then raise exception 'template_save_failed'; end if;

 begin
  perform public.save_donor_thank_you_template(
   '00000000-0000-0000-0000-000000000000/templates/bad.png',
   null,'x',62,22,13
  );
  raise exception 'cross_tenant_template_path_allowed';
 exception when others then
  if sqlerrm='cross_tenant_template_path_allowed' then raise; end if;
  if sqlerrm not like '%invalid_background_path%' then raise; end if;
 end;

 v_doc:=public.register_donation_thank_you_document(
  v_donation,v_template_id,
  v_charity::text||'/generated/donor-thank-you/'||v_donation::text||'/smoke.pdf'
 );
 if nullif(v_doc->>'id','') is null then raise exception 'document_register_failed'; end if;
end $$;

select 'PASS: charity template and generated donor letter remain tenant-bound' as result;
rollback;
