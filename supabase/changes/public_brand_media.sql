-- Public marketing images only; beneficiary and governance storage remain private.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('charity-public-media','charity-public-media',true,5242880,array['image/jpeg','image/png','image/webp']);
create policy charity_public_media_insert on storage.objects for insert to authenticated with check (
 bucket_id='charity-public-media' and (storage.foldername(name))[1]=private.current_charity_id()::text
 and (storage.foldername(name))[2] in ('logo','content') and private.has_permission('onboarding.manage')
);
create policy charity_public_media_select on storage.objects for select to authenticated using (
 bucket_id='charity-public-media' and (storage.foldername(name))[1]=private.current_charity_id()::text and private.has_permission('onboarding.manage')
);
-- Immutable unique paths: replacement is a new image, not an overwrite of shared content.
