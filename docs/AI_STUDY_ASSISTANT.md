# AI study assistant

Implemented on 22 October 2026. Open **Learn → AI study assistant** after signing in.

## Included

- Explain a topic with an example and recap, adapted to the education level saved on the learner's profile.
- Summarise up to 6,000 characters of pasted study notes.
- Generate five multiple-choice practice questions. Select answers before revealing the answer key and explanations. Practice does not modify marks, quiz rewards or leaderboards.
- Separate study modes, input validation, loading/error states, clear-session control and a missing-provider state. Sessions are cleared when leaving the screen or changing accounts.
- Owner controls in the administration screen: enable/disable the assistant, daily learner limit (default 10), and school-wide daily request limit (default 100).

## Live configuration

The connected project has migration 012 and the Gemini-enabled `study-assistant` Edge Function deployed. The hosted check reports **configured=true, enabled=true**. The supplied Gemini credential was verified and stored in Supabase Edge Function secrets. The selected model is `gemini-3.5-flash-lite`; live provider checks passed for explanation, summary and five-question practice output. Limits remain 10 requests per learner and 100 across the school per UTC day.

To maintain or configure another installation:

1. In Supabase **Edge Functions → Secrets**, set `GEMINI_API_KEY`, `STUDY_AI_PROVIDER=gemini` and `STUDY_GEMINI_MODEL=gemini-3.5-flash-lite`. Keep the key out of source control and `EXPO_PUBLIC_*` variables.
2. The optional OpenAI integration remains available with `STUDY_AI_PROVIDER=openai`, `OPENAI_API_KEY`, and `STUDY_AI_MODEL` (default `gpt-4.1-mini`). There is no automatic fallback between vendors. The app identifies the active provider before submission.
3. Sign in as the designated owner, open administration → **Study assistant controls**, refresh settings, set appropriate daily limits, enable the assistant and save.
4. Open Learn → AI study assistant. Try an explanation, a short notes summary and a practice set. Compare correctness and grade suitability with a teacher before wider rollout.
5. Set provider-side billing controls and monitor usage. Request caps are not a precise monetary budget. Failed or moderated attempts after quota reservation count; no automatic provider retries are performed. Daily limits reset at midnight UTC (02:00 South Africa time).

Updating a hosted secret does not require an app rebuild. Shipping the new screens to installed users does require a new app build/update; existing APK/AAB files do not contain these changes.

## Security and data handling

- The client sends only mode and text. The Edge Function verifies the session with Supabase Auth, checks that the profile is active, and reads the education level from the database.
- Provider credentials stay in Edge Function secrets. Quota reservation is a service-role-only database RPC; clients cannot choose another user or increase their limits. Configuration requires an active owner and is audited.
- Quota updates are serialized in PostgreSQL, with a ten-second per-learner cooldown. Counters store user ID, date, count and last-request time; they do not store notes or answers.
- The provider receives submitted text and education-level context, but not the learner's email, name, account ID, other app records or private messages. It has no app tools or browsing access.
- Gemini uses a single request with a JSON output schema and explicit safety settings for harassment, hate speech, sexually explicit content and dangerous content. Blocked, truncated and malformed answers are rejected. Internal thought parts are not displayed.
- OpenAI requests use `store: false` and separate input/output moderation. Neither integration implies zero provider retention. The app does not save learner notes or answers; provider-side data handling follows the selected provider's policies.
- Provider failures return controlled messages, not raw provider error bodies. Authentication, quota and timeout failures are distinguished where practical. The credential was checked against the exported web bundle and was absent.
- Practice results remain on the current screen. They are not a secure assessment and do not award credits.

## Verification

Passed for this change:

- `npm.cmd run typecheck`
- `npm.cmd test`: 26 tests, including both providers, three generation modes, output validation, safety blocking, thought exclusion, authentication and quota failures.
- `npm.cmd run test:database`: owner permissions, default-disabled state, service-only quota calls, usage isolation, cooldown, learner/school caps and suspended accounts.
- `npm.cmd run build:web`
- `node tests/study-assistant.browser.cjs`: mobile-width explanation, summary, practice/answer reveal, rate-limit and missing-provider states with mocked backend responses.
- `node tests/study-assistant.live.cjs`: real hosted Auth/access controls, request bounds, suspended-account denial and disabled-provider handling. Its temporary account was deleted. No paid generation was requested.
- `node tests/study-assistant.live.cjs --browser`: passed with a real temporary Auth session, the locally exported mobile-width UI, deployed Edge Function and live Gemini. All three modes returned valid study content; five practice answers were selected and checked successfully. The temporary account was deleted. These were real provider requests.

Physical-device verification and a new app release artifact remain separate release steps. Live smoke checks cover representative study material; no test can guarantee every generated answer is factually correct. Google's model availability and latency can vary: the tested model was selected after the older 2.5 model was unavailable to this account and 3.8 reported overload.

Deployment helpers:

```powershell
node scripts/deploy-services.cjs --apply
node scripts/study-ai-service.cjs --deploy
node --experimental-strip-types scripts/configure-study-gemini.cjs --apply
node scripts/activate-study-ai.cjs --apply
node tests/study-assistant.live.cjs --browser
```

The deployment helper inspects secret **names** and deploys only the study assistant and its explicit shared dependencies. The Gemini configuration helper runs three bounded provider checks before saving the local credential remotely; it never prints the key. Activation preserves existing daily limits and creates an audit record. The live browser test creates and deletes a temporary account and makes three real AI requests.

References: [Responses structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini), [moderation](https://developers.openai.com/api/docs/guides/moderation), [provider data controls](https://developers.openai.com/api/docs/guides/your-data), [Supabase function deployment](https://supabase.com/changelog/33720-deploy-and-update-edge-functions-using-the-management-api).

Gemini references: [API key handling](https://ai.google.dev/gemini-api/docs/api-key), [structured output](https://ai.google.dev/gemini-api/docs/generate-content/structured-output), [safety settings](https://ai.google.dev/gemini-api/docs/generate-content/safety-settings), [available models](https://ai.google.dev/gemini-api/docs/models).
