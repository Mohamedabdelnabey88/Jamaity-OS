create or replace function public.beneficiary_analysis_provider_secret()
returns text language sql security definer set search_path='' as $$
 select decrypted_secret from vault.decrypted_secrets where name='jamaity_nvidia_api_key' limit 1;
$$;
revoke all on function public.beneficiary_analysis_provider_secret() from public,anon,authenticated;
grant execute on function public.beneficiary_analysis_provider_secret() to service_role;
