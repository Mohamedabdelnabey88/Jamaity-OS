-- Scoped account maintenance; historical account codes/types remain stable.
create or replace function public.accounting_save_account(p_account_id uuid,p_code text,p_name_ar text,p_account_type text,p_is_active boolean default true)
returns uuid language plpgsql security definer set search_path='' as $$
declare c uuid:=private.current_charity_id(); a public.accounting_accounts%rowtype; old_row jsonb;
begin
 if auth.uid() is null then raise exception 'not_authenticated';end if;
 if c is null or not private.has_permission('accounting.manage') then raise exception 'forbidden';end if;
 if nullif(trim(p_name_ar),'') is null or length(trim(p_name_ar))>200 then raise exception 'invalid_account_name';end if;
 if p_is_active is null then raise exception 'invalid_account_status';end if;
 if p_account_id is null then
  if p_code is null or trim(p_code)!~'^[A-Za-z0-9._-]{2,20}$' then raise exception 'invalid_account_code';end if;
  if p_account_type is null or p_account_type not in('asset','liability','equity','revenue','expense') then raise exception 'invalid_account_type';end if;
  insert into public.accounting_accounts(charity_id,code,name_ar,account_type,is_active)
  values(c,trim(p_code),trim(p_name_ar),p_account_type,p_is_active) returning * into a;
 else
  select * into a from public.accounting_accounts where id=p_account_id and charity_id=c for update;
  if not found then raise exception 'account_not_found';end if;
  old_row:=to_jsonb(a);
  if p_code is distinct from a.code or p_account_type is distinct from a.account_type then raise exception 'account_identity_locked';end if;
  update public.accounting_accounts set name_ar=trim(p_name_ar),is_active=p_is_active where id=a.id returning * into a;
 end if;
 perform private.log_audit(c,auth.uid(),'accounting.account_saved','accounting_account',a.id,old_row,to_jsonb(a));
 return a.id;
end $$;
revoke all on function public.accounting_save_account(uuid,text,text,text,boolean) from public,anon;
grant execute on function public.accounting_save_account(uuid,text,text,text,boolean) to authenticated;
