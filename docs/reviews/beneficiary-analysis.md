# Beneficiary research assistant v1

The charity household panel now offers explicit analysis for staff with beneficiaries.manage. The server retrieves the authorized live household via a new RPC; the browser cannot supply household facts or select another tenant. Requests receive an ID and a DB timestamp; DB advisory locking enforces 10 requests per staff user per rolling hour. Metadata only is persisted, not generated narratives. No application/support decisions are changed.

Deterministic review covers numeric completeness, income per person, post-rent remainder and clarification prompts. Missing data is not zero and is not an eligibility signal. The optional language layer is an existing OpenAI model, NOT a newly trained model. It uses Responses structured output, no tools, store:false, bounded output/timeouts, numeric-only inputs without names, IDs, narrative fields or documents. Source keys are allowlisted and output shape is checked. Suggestions remain a draft for human review; this does not verify evidence, score need or rank recipients.

## Activation
Set OPENAI_API_KEY as a server-only secret in the existing Vercel project and redeploy. Do not use a VITE_ prefix. Optional BENEFICIARY_ANALYSIS_MODEL defaults to pinned gpt-4.1-mini-2025-04-14. Existing VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are reused server-side with the caller's bearer token. The URL is pinned to the authorized project. No service role is used.

Without the provider key, the endpoint returns a clearly labeled rules-only review. Provider failure/refusal/schema mismatch also produces a visibly labeled fallback. A real provider call remains unverified because no key is available; no quality/accuracy percentage is claimed. Validate against researcher-reviewed de-identified examples before relying on narrative quality. Key provisioning remains the external blocker.

## Validation
14 Node tests cover missing-vs-zero, arithmetic, excluded personal fields, source/schema validation, unauthenticated/invalid/denied requests, no-key fallback and mocked model success/invalid output. TypeScript and Vite passed. SQL transaction/rollback smoke confirms authenticated profile retrieval, unavailable target refusal, rolling quota, anonymous refusal. No fixtures remain. This is not browser-to-production or live-model verification.

Official implementation reference: https://developers.openai.com/api/docs/guides/structured-outputs
