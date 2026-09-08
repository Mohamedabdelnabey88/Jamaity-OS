# Public charity identity and image uploads

Refined the existing charity public site and settings studio with a restrained sage/cream palette, stronger hierarchy, prominent charity logo, responsive content cards and section navigation. Campaign history remains inline, including completed campaigns.

Direct logo and public-content image selection, drag/drop, preview and explicit upload now replace URL-only entry; existing URL fields remain optional. JPEG/PNG/WebP up to 5 MiB, browser decode and WebP re-encoding, maximum edge 800px for logos / 1800px for content, unique immutable paths. The enclosing save action applies the returned URL. Uploads block competing save/edit actions. Uploaded public assets are retained if the user leaves without saving; no automatic deletion of shared media.

Storage is a new public marketing-only bucket. Upload/list policies require active workspace, onboarding.manage and matching tenant folder, with allowed logo/content paths. No overwrite grants. Beneficiary and governance buckets unchanged. Public media notice is shown before upload.

Validation: TypeScript and Vite build; existing 8 Node checks; authenticated-role storage metadata insertion and own access, other tenant rejection, invalid folder rejection, anon rejection, all rolled back. This verifies RLS, not an end-to-end browser binary upload. Supabase advisors reviewed: previous SECURITY DEFINER/RPC-only table notices, leaked-password setting and unused indexes remain. Live browser rendering and binary upload remain unverified.

Storage implementation follows https://supabase.com/docs/guides/storage/security/access-control . React review covers preview object URL cleanup, functional parent state updates, bounded network requests, image sizing and keyboard-operable file picker.
