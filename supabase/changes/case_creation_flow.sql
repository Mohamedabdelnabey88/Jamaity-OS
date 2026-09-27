create or replace function public.create_case(
 p_beneficiary_id uuid,
 p_title text,
 p_priority text default 'normal'
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
 c uuid:=private.current_charity_id();
 cid uuid;
 case_no text;
 next_no integer;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if c is null or not private.has_permission('cases.manage') then raise exception 'forbidden'; end if;
 if p_beneficiary_id is null then raise exception 'beneficiary_required'; end if;
 if nullif(trim(coalesce(p_title,'')),'') is null then raise exception 'case_title_required'; end if;
 if p_priority not in ('low','normal','high','critical') then raise exception 'invalid_priority'; end if;
 if not exists(select 1 from public.beneficiaries where id=p_beneficiary_id and charity_id=c) then raise exception 'beneficiary_not_found'; end if;

 perform pg_advisory_xact_lock(hashtextextended(c::text||':case-number:'||current_date::text,0));
 select coalesce(max(nullif(regexp_replace(case_number,'^CASE-[0-9]{8}-','','g'),'')::integer),0)+1
 into next_no
 from public.cases
 where charity_id=c and case_number like 'CASE-'||to_char(current_date,'YYYYMMDD')||'-%';

 case_no:='CASE-'||to_char(current_date,'YYYYMMDD')||'-'||lpad(next_no::text,4,'0');

 insert into public.cases(charity_id,beneficiary_id,case_number,title,status,priority,assigned_to)
 values(c,p_beneficiary_id,case_no,trim(p_title),'new',p_priority,auth.uid())
 returning id into cid;

 perform private.log_audit(c,auth.uid(),'case.created','case',cid,null,jsonb_build_object('case_number',case_no,'beneficiary_id',p_beneficiary_id,'priority',p_priority));
 return jsonb_build_object('id',cid,'case_number',case_no,'status','new');
end
$function$;

revoke execute on function public.create_case(uuid,text,text) from public,anon;
grant execute on function public.create_case(uuid,text,text) to authenticated;
