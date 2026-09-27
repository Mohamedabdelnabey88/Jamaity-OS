-- Harden staff invitation acceptance so the server-side invitation token is the
-- only binding source for charity, role, and invited email. Client-visible
-- charity codes are no longer accepted as authorization input.

create or replace function public.accept_staff_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if p_token is null
     or length(trim(p_token)) <> 64
     or trim(p_token) !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'invitation_invalid_or_expired';
  end if;

  return public.accept_member_invitation(lower(trim(p_token)));
exception
  when raise_exception then
    if sqlerrm in ('invalid_invitation','invitation_expired_or_invalid') then
      raise exception 'invitation_invalid_or_expired';
    end if;
    raise;
end
$$;

-- Retire legacy acceptance surfaces that accepted a client-provided charity
-- code or bypassed the canonical staff acceptance endpoint.
revoke all on function public.accept_staff_invitation(text,text) from public, anon, authenticated;
revoke all on function public.accept_member_invitation(text) from public, anon, authenticated;
revoke all on function public.accept_team_invitation(text) from public, anon, authenticated;

revoke all on function public.accept_staff_invitation(text) from public, anon;
grant execute on function public.accept_staff_invitation(text) to authenticated;
