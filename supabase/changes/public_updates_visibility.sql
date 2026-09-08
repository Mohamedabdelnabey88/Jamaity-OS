alter policy public_updates_anon_select on public.charity_updates to anon using (public.public_charity_post(charity_id,id) is not null);
alter policy updates_authenticated_select on public.charity_updates to authenticated using (public.public_charity_post(charity_id,id) is not null or (charity_id=(select private.current_charity_id()) and (select private.has_permission('updates.manage'))));
