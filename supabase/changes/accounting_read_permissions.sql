-- Preserve existing readers and tenant/subscription scope; add explicit accounting roles.
alter policy accounting_accounts_member_select on public.accounting_accounts to authenticated using (
 charity_id = (select private.current_charity_id()) and
 ((select private.has_permission('accounting.view')) or (select private.has_permission('accounting.manage')) or
  (select private.has_permission('audit.view')) or (select private.has_permission('donations.manage')))
);
alter policy journal_entries_member_select on public.journal_entries to authenticated using (
 charity_id = (select private.current_charity_id()) and
 ((select private.has_permission('accounting.view')) or (select private.has_permission('accounting.manage')) or
  (select private.has_permission('audit.view')) or (select private.has_permission('donations.manage')))
);
alter policy journal_lines_member_select on public.journal_lines to authenticated using (
 exists(select 1 from public.journal_entries je where je.id=journal_lines.journal_entry_id
 and je.charity_id=(select private.current_charity_id()) and
 ((select private.has_permission('accounting.view')) or (select private.has_permission('accounting.manage')) or
  (select private.has_permission('audit.view')) or (select private.has_permission('donations.manage'))))
);
