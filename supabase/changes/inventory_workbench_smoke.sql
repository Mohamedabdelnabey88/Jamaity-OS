begin;
do $$
declare
 u uuid;c uuid;w uuid;i uuid;r jsonb;
begin
 select cm.user_id,cm.charity_id into u,c
 from public.charity_members cm join public.roles ro on ro.id=cm.role_id
 where cm.status='active' and ro.code in('owner','admin')
 order by (ro.code='owner') desc limit 1;

 if u is null then raise exception 'fixture_missing'; end if;

 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claim.role','authenticated',true);
 execute 'set local role authenticated';

 w:=public.create_warehouse('Inventory smoke warehouse',null);
 i:=public.create_inventory_item('INV-SMOKE-001','Inventory smoke item',null,'وحدة');

 r:=public.record_inventory_movement(w,i,'receipt',10,'smoke receipt');
 if (r->>'new_on_hand')::numeric<>10 then raise exception 'receipt_failed'; end if;

 r:=public.record_inventory_movement(w,i,'issue',4,'smoke issue');
 if (r->>'new_on_hand')::numeric<>6 then raise exception 'issue_failed'; end if;

 begin
   perform public.record_inventory_movement(w,i,'issue',7,'must fail');
   raise exception 'negative_stock_was_allowed';
 exception when others then
   if sqlerrm='negative_stock_was_allowed' then raise; end if;
   if sqlerrm not like '%insufficient_stock%' then raise; end if;
 end;

 if not exists(select 1 from public.inventory_balances() b where b.warehouse_id=w and b.item_id=i and b.on_hand=6) then
   raise exception 'balance_failed';
 end if;
end $$;
rollback;
