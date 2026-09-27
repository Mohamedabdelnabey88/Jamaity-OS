create table if not exists public.donation_thank_you_logs (
  id uuid primary key default gen_random_uuid(),
  charity_id uuid not null references public.charities(id) on delete cascade,
  donation_id uuid not null references public.donations(id) on delete cascade,
  donor_id uuid not null references public.donors(id) on delete cascade,
  channel text not null check (channel in ('whatsapp','email','copy','other')),
  message_text text not null,
  sent_at timestamptz not null default now(),
  sent_by uuid not null references auth.users(id)
);

create index if not exists donation_thank_you_logs_charity_idx
  on public.donation_thank_you_logs(charity_id, sent_at desc);
create index if not exists donation_thank_you_logs_donation_idx
  on public.donation_thank_you_logs(donation_id, sent_at desc);
create index if not exists donation_thank_you_logs_donor_idx
  on public.donation_thank_you_logs(donor_id);
create index if not exists donation_thank_you_logs_sent_by_idx
  on public.donation_thank_you_logs(sent_by);

alter table public.donation_thank_you_logs enable row level security;
revoke all on table public.donation_thank_you_logs from public,anon,authenticated;

create or replace function public.record_donation_thank_you(
  p_donation_id uuid,
  p_channel text,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  c uuid:=private.current_charity_id();
  d public.donations%rowtype;
  log_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if c is null or not (
    private.has_permission('donations.manage')
    or private.has_permission('donors.manage')
  ) then raise exception 'permission_denied'; end if;

  if p_channel not in ('whatsapp','email','copy','other') then raise exception 'invalid_channel'; end if;
  if nullif(trim(coalesce(p_message,'')),'') is null then raise exception 'message_required'; end if;
  if length(p_message)>5000 then raise exception 'message_too_long'; end if;

  select * into d from public.donations where id=p_donation_id and charity_id=c;
  if not found then raise exception 'donation_not_found'; end if;
  if d.status<>'received' then raise exception 'donation_not_received'; end if;

  insert into public.donation_thank_you_logs(
    charity_id,donation_id,donor_id,channel,message_text,sent_by
  ) values(
    c,d.id,d.donor_id,p_channel,trim(p_message),auth.uid()
  )
  returning id into log_id;

  perform private.log_audit(
    c,auth.uid(),'donation.thank_you_recorded','donation',d.id,null,
    jsonb_build_object('channel',p_channel,'thank_you_log_id',log_id)
  );

  return jsonb_build_object('id',log_id,'sent_at',now(),'channel',p_channel);
end
$function$;

revoke execute on function public.record_donation_thank_you(uuid,text,text) from public,anon;
grant execute on function public.record_donation_thank_you(uuid,text,text) to authenticated;

create or replace function public.donation_thank_you_status(p_donation_ids uuid[])
returns table(donation_id uuid,last_sent_at timestamptz,send_count bigint)
language sql
security definer
set search_path=''
as $function$
  select l.donation_id,max(l.sent_at),count(*)::bigint
  from public.donation_thank_you_logs l
  where l.charity_id=private.current_charity_id()
    and l.donation_id=any(coalesce(p_donation_ids,'{}'::uuid[]))
  group by l.donation_id
$function$;

revoke execute on function public.donation_thank_you_status(uuid[]) from public,anon;
grant execute on function public.donation_thank_you_status(uuid[]) to authenticated;
