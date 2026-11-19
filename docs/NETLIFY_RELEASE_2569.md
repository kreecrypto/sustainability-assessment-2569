# Netlify Production Release — Sustainability Assessment 2569

**Target project:** [sustainability-assessment-2569](https://app.netlify.com/projects/sustainability-assessment-2569)  
**GitHub:** [kreecrypto/sustainability-assessment-2569](https://github.com/kreecrypto/sustainability-assessment-2569)  
**Branch:** `main`  
**Checked:** 2026-11-19

## Verified pre-release state

- Existing Netlify deployment `6afe7c2f04954a2445266e5a` reports `ready` but `gitCommit = null`, `gitBranch = null`, and `deploy_source = api`.
- That deployment lists only `20261119010000_initial_assessment` as an applied database migration.
- GitHub `main` contains `20261119020000_add_reset_generation.sql`, a guarded administrator reset endpoint, and a corresponding frontend.
- Netlify Environment Variable read returned no entries; two attempts to write `ASSESSMENT_ADMIN_CODE` through the connected API returned **403**. No admin code was installed by those attempts.
- Avoid sending real meeting votes until after the updated database migration and controlled release are verified.

## Step A — Link existing Netlify project to GitHub

1. Open existing Netlify project, not **Add new project**.
2. Go to **Project configuration → Developer settings → Continuous deployment → Repository**.
3. Click **Link repository** (or the similarly named link action).
4. Choose GitHub, authorize the Netlify GitHub App for the private `kreecrypto/sustainability-assessment-2569` repository.
5. Select branch `main`. Do **not** create a new GitHub repository or a second Netlify project.
6. Confirm build command `npm run build`, publish directory `public`, base directory root. The repository includes `netlify.toml` with these settings.
7. Trigger Deploy if the link flow does not start it automatically.

Official guide: https://docs.netlify.com/build/git-workflows/repo-permissions-linking/

## Step B — Add production secret

1. Go to **Project configuration → Environment variables → Add a variable**.
2. Key: `ASSESSMENT_ADMIN_CODE`.
3. Value: choose a cryptographically random string at least 12 characters long; store it privately and **never commit to Git**.
4. Set scope to **Functions** and context to **Production** (or the closest available scoped option).
5. Mark **Contains secret values** if supported.
6. Save, then create a **new Deploy** so the function runtime picks up the value.

Official guide: https://docs.netlify.com/build/environment-variables/get-started/

## Step C — Verify deploy and schema

1. Open **Deploys → newest Production deploy**.
2. Verify state is **Ready**, branch **main**, and commit SHA matches GitHub `main`.
3. Verify both migration entries are applied:
   - `20261119010000_initial_assessment`
   - `20261119020000_add_reset_generation`
4. `GET /api/stats` should return `reset_generation` as a number and 10 topic rows.
5. `GET /api/session` should return `reset_generation` and session votes.
6. Check participant and dashboard pages on two separate browsers, using test data.

## Step D — Controlled dummy-data reset test

1. Ensure no real executive scores are present (never run this test on important live results).
2. Have two browsers each score at least one topic.
3. Export CSV, then select **Reset Dashboard**.
4. Check that a wrong admin code fails without deleting data.
5. Type exact phrase `RESET 2569`, enter the valid admin code, and confirm.
6. The dashboard should show zero scores, voting should become **closed**, and stale clients should clear selections.
7. Re-open the assessment with the admin code and verify that fresh voting works.

**Important:** The Reset action permanently deletes all submitted vote rows. Export before using it.

## Connector limitation

The current ChatGPT-connected Netlify tools can inspect site and deploy status and can *attempt* to mutate environment variables. However, this account's environment writes returned HTTP 403, and the available tools do not expose a connect-repository/deploy action for the existing site. Complete steps A and B directly in the Netlify UI, then verify the new deploy details and migration list.


## Verification after Netlify configuration — 19 November 2026

The project owner reported that the GitHub repository was linked and the admin environment variable configured.

Read-only verification via the connected Netlify API:
- `ASSESSMENT_ADMIN_CODE` exists. Its value was **not** read or recorded in this document.
- The environment variable metadata did **not** indicate secret protection; its scopes included builds/functions/post-processing/runtime rather than Functions alone. Update it in the Netlify UI where possible.
- At verification, the latest production deploy was still `6afe7c2f04954a2445266e5a`, an API/drop deploy with no Git commit or branch, rather than a deploy from `main`.
- The only recorded applied database migration was `20261119010000_initial_assessment`; the reset-generation migration was not yet applied.

This documentation change is also a harmless new `main` commit to exercise Git continuous deployment if the repository connection is active. Do not use real executive data until the newest deploy shows a matching commit and successful reset migration.

## Git deploy recheck after making the repository public — 2026-11-19

The repository was verified **public** before this commit. This documentation-only update triggers a new Git `main` build on the existing Netlify project; it does not read, delete, or reset any assessment data.

The old blocked deploy is not evidence of a new failure: verify the **new** deploy ID and its status. Required acceptance before calling this release complete:

- Build `ready` with branch `main` and the latest commit SHA.
- Applied migration `20261119020000_add_reset_generation` alongside the original schema.
- `/api/stats` returns 10 topics plus numeric `reset_generation`.
- Admin environment variable exists without its value being exposed to the public repository.

