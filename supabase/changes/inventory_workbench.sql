create or replace function public.record_inventory_movement(
  p_warehouse_id uuid,
  p_item_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  c uuid := private.current_charity_id();
  movement_id uuid;
  current_on_hand numeric;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if c is null or not private.has_permission('inventory.manage') then raise exception 'permission_denied'; end if;
  if p_warehouse_id is null or p_item_id is null then raise exception 'warehouse_item_required'; end if;
  if p_movement_type not in ('receipt','issue') then raise exception 'invalid_movement_type'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'invalid_quantity'; end if;

  if not exists(select 1 from public.warehouses where id=p_warehouse_id and charity_id=c and is_active) then
    raise exception 'warehouse_not_found';
  end if;
  if not exists(select 1 from public.inventory_items where id=p_item_id and charity_id=c and is_active) then
    raise exception 'inventory_item_not_found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(c::text||':'||p_warehouse_id::text||':'||p_item_id::text,0));

  select coalesce(sum(case
    when movement_type='receipt' then quantity
    when movement_type='issue' then -quantity
    else quantity
  end),0)
  into current_on_hand
  from public.stock_movements
  where charity_id=c and warehouse_id=p_warehouse_id and item_id=p_item_id;

  if p_movement_type='issue' and current_on_hand < p_quantity then
    raise exception 'insufficient_stock';
  end if;

  insert into public.stock_movements(
    charity_id,warehouse_id,item_id,movement_type,quantity,reference_type,reference_id,notes,created_by
  ) values(
    c,p_warehouse_id,p_item_id,p_movement_type,p_quantity,'manual',null,nullif(trim(coalesce(p_notes,'')),''),auth.uid()
  )
  returning id into movement_id;

  perform private.log_audit(
    c,auth.uid(),'inventory.movement_created','stock_movement',movement_id,null,
    jsonb_build_object('warehouse_id',p_warehouse_id,'item_id',p_item_id,'movement_type',p_movement_type,'quantity',p_quantity)
  );

  return jsonb_build_object(
    'id',movement_id,
    'movement_type',p_movement_type,
    'quantity',p_quantity,
    'previous_on_hand',current_on_hand,
    'new_on_hand',case when p_movement_type='receipt' then current_on_hand+p_quantity else current_on_hand-p_quantity end
  );
end
$function$;

revoke execute on function public.record_inventory_movement(uuid,uuid,text,numeric,text) from public,anon;
grant execute on function public.record_inventory_movement(uuid,uuid,text,numeric,text) to authenticated;
