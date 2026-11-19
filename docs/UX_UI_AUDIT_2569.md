# UX/UI Audit — Sustainability Materiality Assessment 2569

**Date:** 19 November 2026  
**Baseline:** GitHub `main`, Tabler UI Free foundation; participant view and live dashboard  
**Method:** Source review and scripted client/server simulation (not a physical-device usability study).  
**Deployment caution:** GitHub commits do not prove the Netlify production deployment is updated. Verify the published deployment's Git SHA and database migration before use.

## Findings and disposition

| Priority | Finding | Action | Status |
| --- | --- | --- | --- |
| P0 | No mechanism to clear results for a new workshop round | Protected Reset Dashboard, explicit confirmation, transactional delete, close vote intake, bump generation | Implemented in repository |
| P1 | Progress can count unsaved selections as complete | `countComplete` requires confirmed `saved` state | Implemented |
| P1 | Participants cannot distinguish pending/saving/saved | Each topic displays clear status, server confirmation, 1–5 labels | Implemented |
| P1 | Destructive and routine administrator controls look similar | Collapsed admin management, distinct red reset action, mandatory typed phrase | Implemented |
| P1 | Background polling could interrupt admin typing | Preserve admin draft and avoid dashboard rerender during confirmation | Implemented |
| P1 | Open participant tabs may show stale results after reset | Versioned `reset_generation`; participant refresh checks changes every ~3 seconds | Implemented |
| P1 | Async vote response can show saved result after reset | Reject stale generations on server and guard late client responses | Implemented |
| P2 | Nearby scatter points can visually overlap | Refine offset/tooltip and add accessible textual mapping | Future |
| P2 | Mobile detail table requires horizontal scrolling | Consider stronger horizontal-scroll affordance / card list | Future |
| P2 | Color contrast and presentation-screen typography not measured | Browser-based visual/accessibility QA at 390, 768, 1024, 1440px and meeting projector | Needs testing |
| Important | Browser sessions do not verify executive identity | For a formal weighted/controlled vote use unique invites or SSO | Out of scope |

## Reset Dashboard — behavior

1. A user chooses **Reset Dashboard** from the Dashboard toolbar.
2. The expandable administrator section displays a destructive-action warning, an Export CSV reminder, a password field and an exact-confirmation field.
3. The administrator must enter the secret `ASSESSMENT_ADMIN_CODE` and type the literal **RESET 2569**.
4. On `POST /api/reset`, the server enforces same-origin requests and checks the secret and phrase.
5. A database transaction locks assessment state, deletes **all vote rows**, closes the assessment, and increments `reset_generation` atomically.
6. All aggregate metrics return to zero. Existing browser-specific anonymous participant records are retained so sessions can be safely reused, but their previously submitted votes are gone.
7. Participant tabs refresh the round identifier and clear old scores. The admin must explicitly reopen voting.

**Reset is destructive and does not provide undo.** Export results before initiating it. Reset is not executed automatically during deploy or in tests.

## Technical contract

- Migration: `netlify/database/migrations/20261119020000_add_reset_generation.sql`.
- Protected API: `POST /api/reset`, body `{"code":"<admin code>","confirmation":"RESET 2569"}`.
- Stats and session APIs return `reset_generation`.
- Vote API expects `reset_generation`, and a shared database row lock ensures an in-flight vote cannot commit after a reset transaction.
- The assessment is left **closed** after reset; only `POST /api/control` with the admin secret may reopen it.
- The dashboard updates approximately every 3 seconds; it is **near-real-time polling**, not a WebSocket push service.

## Simulated QA evidence

- Wrong admin code → 403; no DELETE query.
- Incorrect confirmation phrase → 422; no DELETE query.
- Wrong Origin → 403; no DELETE query.
- Valid administrator reset → transaction executed with SELECT FOR UPDATE → DELETE → UPDATE generation/status → COMMIT.
- Frontend reset simulation → received new generation, cleared vote state, showed zero participants and the empty dashboard.
- Static JavaScript syntax and 10-topic inventory tested.

## Production acceptance checklist

- [ ] Latest GitHub commit is deployed to the intended Netlify site; build passes.
- [ ] Database migration `20261119020000_add_reset_generation` is applied.
- [ ] `ASSESSMENT_ADMIN_CODE` is configured in Netlify functions/runtime environment; never commit the value.
- [ ] Confirm vote and dashboard from two separate mobile/desktop sessions.
- [ ] Export CSV before a controlled **test reset** with dummy data.
- [ ] Confirm Reset clears votes, closes voting, and both browsers update.
- [ ] Confirm reopening allows new voting without restoring old scores.
- [ ] Review responsive layouts, screen-reader labels and projector legibility.

Do not use real executive results to test reset unless a backup has been verified and the owner explicitly approves losing those votes.
