-- Serialize issues for the same item and make exact retries return the original result.
-- No stock, support or journal records are rewritten by this migration.
create or replace function public.issue_in_kind(
 p_warehouse_id uuid,p_item_id uuid,p_quantity numeric,p_support_id uuid,p_notes text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare c uuid;s public.support_records%rowtype;prior public.stock_movements%rowtype;
 avail numeric;mv uuid;je uuid;ex uuid;inv uuid;
begin
 c:=private.current_charity_id();
 if auth.uid() is null or c is null or not private.has_permission('support.manage') then raise exception 'permission_denied';end if;
 if p_quantity is null or p_quantity<=0 or p_quantity::text in ('NaN','Infinity','-Infinity') then raise exception 'quantity_must_be_positive';end if;
 -- A repeatable-read snapshot may predate an earlier completed stock issue.
 if current_setting('transaction_isolation')='repeatable read' then raise exception 'stock_issue_requires_fresh_snapshot';end if;
 select * into s from public.support_records where id=p_support_id and charity_id=c for update;
 if not found then raise exception 'support_not_found';end if;
 select * into prior from public.stock_movements where charity_id=c and reference_type='support' and reference_id=p_support_id and movement_type='issue' limit 1;
 if found then
  if prior.warehouse_id is distinct from p_warehouse_id or prior.item_id is distinct from p_item_id or prior.quantity is distinct from p_quantity then raise exception 'support_issue_conflict';end if;
  if s.approval_status is distinct from 'executed' then raise exception 'support_issue_inconsistent';end if;
  select id into je from public.journal_entries where charity_id=c and reference_type='support' and reference_id=p_support_id;
  if je is null then raise exception 'support_issue_inconsistent';end if;
  return jsonb_build_object('movement_id',prior.id,'journal_entry_id',je,'already_executed',true);
 end if;
 if s.approval_status is distinct from 'approved' then raise exception 'support_not_approved';end if;
 if lower(coalesce(s.support_type,'')) not in ('in_kind','عينى','عيني','in-kind') then raise exception 'support_not_in_kind';end if;
 if coalesce(s.amount,0)<=0 or s.amount::text in ('NaN','Infinity','-Infinity') then raise exception 'in_kind_valuation_required';end if;
 if not exists(select 1 from public.warehouses where id=p_warehouse_id and charity_id=c and is_active) then raise exception 'warehouse_not_found';end if;
 -- All issue_in_kind calls for this tenant/item queue here before reading the balance.
 -- NO KEY UPDATE also allows unrelated receipt FK checks to proceed.
 perform 1 from public.inventory_items where id=p_item_id and charity_id=c and is_active for no key update;
 if not found then raise exception 'item_not_found';end if;
 select coalesce(sum(case when movement_type='receipt' then quantity when movement_type='issue' then -quantity else 0 end),0)
 into avail from public.stock_movements where charity_id=c and warehouse_id=p_warehouse_id and item_id=p_item_id;
 if avail<p_quantity then raise exception 'insufficient_stock';end if;
 insert into public.stock_movements(charity_id,warehouse_id,item_id,movement_type,quantity,reference_type,reference_id,notes,created_by)
 values(c,p_warehouse_id,p_item_id,'issue',p_quantity,'support',p_support_id,p_notes,auth.uid()) returning id into mv;
 perform private.ensure_default_accounts(c);
 select id into ex from public.accounting_accounts where charity_id=c and code='5200';
 select id into inv from public.accounting_accounts where charity_id=c and code='1200';
 select id into je from public.journal_entries where charity_id=c and reference_type='support' and reference_id=p_support_id;
 if je is null then
  insert into public.journal_entries(charity_id,reference_type,reference_id,description,status,created_by)
  values(c,'support',p_support_id,'تنفيذ دعم عيني','posted',auth.uid()) returning id into je;
  insert into public.journal_lines(journal_entry_id,account_id,debit,credit,description)
  values(je,ex,s.amount,0,'مصروف دعم عيني'),(je,inv,0,s.amount,'صرف من مخزون التبرعات العينية');
 end if;
 update public.support_records set status='provided',approval_status='executed',executed_at=now(),provided_at=now() where id=p_support_id;
 insert into public.support_events(charity_id,support_record_id,event_type,actor_id,metadata)
 values(c,p_support_id,'executed',auth.uid(),jsonb_build_object('movement_id',mv,'journal_entry_id',je));
 perform private.log_audit(c,'support.executed','support_record',p_support_id,null,jsonb_build_object('movement_id',mv,'journal_entry_id',je));
 return jsonb_build_object('movement_id',mv,'journal_entry_id',je,'already_executed',false);
end $$;
revoke all on function public.issue_in_kind(uuid,uuid,numeric,uuid,text) from public,anon;
grant execute on function public.issue_in_kind(uuid,uuid,numeric,uuid,text) to authenticated;
