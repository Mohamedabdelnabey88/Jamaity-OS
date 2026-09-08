# Beneficiary research assistant — NVIDIA activation

The existing Vercel API route now forwards the caller request to the Supabase beneficiary-analysis Edge Function on yagbmbuevtjaqypkujaf. It no longer requires an OpenAI/Vercel provider secret. The function verifies the caller through PostgREST and reserve_beneficiary_analysis before reading any server secret. That RPC enforces beneficiaries.manage, tenant scope and a database-backed rolling quota. Edge gateway verify_jwt is false because authentication is implemented in the function body using the caller's JWT against the authoritative database API; there is no anonymous analysis path.

NVIDIA key stored encrypted in Supabase Vault under jamaity_nvidia_api_key. beneficiary_analysis_provider_secret is executable only by service_role. It returns only that named secret, not arbitrary Vault values. Edge uses built-in service credentials only for this lookup. The provider key and service credentials never enter frontend, git, response bodies or application logs.

Current tested model: nvidia/nemotron-3-super-120b-a12b, thinking disabled. Initial Qwen and Llama candidates returned EOL; Mistral candidate unavailable. Nemotron succeeded with the actual supplied key and full Arabic structured household review for synthetic income 1200/rent 1500/size 4/dependents 3 in 28.572 seconds. It correctly described a 300 SAR post-rent shortfall and 300 SAR income per person. This is a smoke test, not a validated accuracy benchmark.

Inputs are allowlisted numeric household facts; no names, identity numbers, narratives or documents. Outputs are neutral summaries/questions, source-key validated, never eligibility decisions or rankings. Missing values remain missing. Provider failures return clearly labeled arithmetic-only review. No automatic alternate-provider sharing. Existing 10/user/hour DB quota and request tracking remain. Narratives are not persisted.

Validation: 15 Node tests pass, TypeScript/build gates; live NVIDIA synthetic test; Vault function rejects authenticated and anon roles, permits server role. Deployed Edge rejects unauthenticated and invalid-token requests. Live authenticated browser-to-provider flow is not yet verified. Security Advisor reviewed; intentional RPC-only table and definer notices remain, leaked-password protection remains outstanding.

Rotation: replace jamaity_nvidia_api_key in this project's Vault; no frontend change or Vercel secret needed. The supplied key appeared in chat and should be rotated. No key material is in this document or repository.

References: https://docs.api.nvidia.com/nim/reference/llm-apis and https://supabase.com/docs/guides/database/vault
