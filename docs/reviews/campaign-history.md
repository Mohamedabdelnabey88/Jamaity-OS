# Campaign history correction

Campaigns now live inline on the charity homepage, with all/current/completed filters and expandable descriptions and outcomes. Sharing uses a homepage anchor; old campaign paths redirect there. Completed campaigns keep their published history but show no contribution action. Posts retain their existing article routes. Donor banking remains separate.

Owners can set active/completed, optional start/end dates and public outcomes. Dates are documentary; completion is explicit. Existing rows default to active without inferring past completion. Omitted lifecycle fields in older API clients preserve existing values. Published status is independent from completion.

Validation: TypeScript and Vite build passed; 8 Node tests passed. campaign_history_smoke.sql passed against yagbmbuevtjaqypkujaf with authenticated/anon roles and rollback: completed visibility, draft exclusion, invalid dates, unavailable-row update refusal and anon management refusal. No fixtures retained. Security/Performance Advisors reviewed: existing SECURITY DEFINER, intentional RPC-only RLS tables, leaked password protection and unused index notices remain; not suppressed. Live browser interaction was not verified in this release.
