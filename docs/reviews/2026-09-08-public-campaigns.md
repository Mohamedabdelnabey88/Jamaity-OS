# Public campaigns and donor journey

Base: cacea7da9aa623b3d1df3ccf4c4b71845b82130d. Database: yagbmbuevtjaqypkujaf only.

## Delivered

- Rebuilt the charity public page with explicit beneficiary and donor journeys, campaign cards, news, board, impact and disclosures.
- Dedicated /charity/:charityId/donate page containing that charity's published bank name, account holder, IBAN copy, transfer instructions and campaigns.
- Dedicated /charity/:charityId/campaign/:itemId pages with description, image, declared target (no fictional received amount), contextual cash or in-kind contribution instructions, share actions and a print stylesheet.
- Dedicated /charity/:charityId/post/:postId pages with published news. The dedicated read RPC supports posts older than the homepage's 30-post limit.
- Native sharing with clipboard/manual fallback, copyable campaign URL and ready-to-edit promotional text. No messages are sent automatically. No payment gateway or automatic ledger posting.
- Matching authorized charity users see publishing-management links on the public page. Editing still uses the authenticated tenant-bound workspace/RPCs. Publication and promotion controls also appear in the campaign editor and news list.
- Beneficiary CTA preserves charity selection through the existing application flow.
- Hardened direct public news RLS: content from a disabled public site or expired/unapproved charity cannot be read directly just because its news row is marked published.

## Verification

- TypeScript and Vite production build passed.
- Six Node tests passed (existing request tests plus HTTPS safety and in-kind promotional copy).
- Live BEGIN/ROLLBACK SQL test passed: authenticated owner can insert a published post and draft; anon can read the published item, cannot read draft through RPC or direct table access, cannot read another charity's post via mismatched ID, and cannot read the post after its public site is unpublished. No fixture rows retained.
- Advisors reviewed: 5 RPC-only RLS/no-policy info entries; 3 intentionally public SECURITY DEFINER endpoints; 103 authenticated SECURITY DEFINER notices; existing leaked password protection warning still open. Performance: 47 unused index notices. No warnings suppressed.

## Limits

No authenticated browser verification or print/native-share device verification is claimed. Cloud browser access to the local app was blocked in the preceding verification attempt. Share links work as SPA routes; server-rendered social-card metadata/OG preview images are not implemented. Campaign targets are editorial, not reconciled fundraising totals. Bank ownership and transfer receipt are checked by the charity, not automatically by the platform.
