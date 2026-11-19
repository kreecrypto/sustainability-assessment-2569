# Sustainability Assessment 2569

ระบบประเมินประเด็นความสำคัญด้านความยั่งยืน ประจำปี 2569 ด้วยเกณฑ์ **Necessity × Complexity** (คะแนนแต่ละด้าน 1–5) ทั้ง 10 ประเด็น

## Screens
- **Participant:** `/?view=vote` — ประเมิน 10 ประเด็นและแก้คะแนนเดิมได้ โดยบันทึกอัตโนมัติเมื่อเลือกครบทั้ง 2 ด้าน
- **Dashboard:** `/?view=dashboard` — กราฟ Matrix, คะแนนเฉลี่ย, จำนวนผู้ประเมิน, Export CSV, เปิด/ปิดรับคะแนน
- **Demo:** `/?view=dashboard&demo=1` — สาธิตด้วยข้อมูลจำลองเท่านั้น ไม่ใช่คะแนนจริง

## Stack
Netlify static site + Netlify Functions + Netlify Database (PostgreSQL). Dashboard โหลดข้อมูลใหม่ทุก ~3 วินาที (near-real-time, **ไม่ใช่ WebSocket**)

## Deploy
1. Connect GitHub repo `kreecrypto/sustainability-assessment-2569` to the *existing* Netlify project `sustainability-assessment-2569`.
2. Build command: `npm run build`, Publish directory: `public`, Base directory: repository root.
3. Confirm the Netlify Database feature is available on the account, and the deployment applies migration `netlify/database/migrations/20261119010000_initial_assessment.sql`.
4. In Netlify project Environment Variables, set a strong random **ASSESSMENT_ADMIN_CODE**, at least 12 characters, with Functions scope and Production context (do not commit secret). Redeploy after setting.
5. The site must be accessible to meeting participants; verify Visitor access settings.
6. Verify /api/stats returns 10 rows, then check voting using two different devices.

## Data integrity and privacy
- Server validates topic IDs 1–10, scores 1–5, and closes writes when voting is disabled.
- Anonymous browser gets a random session cookie (HttpOnly, Secure, SameSite=Lax). Only its SHA-256 digest is stored in database.
- One score pair per topic per browser session. Edits overwrite previous scores rather than inflate count.
- Dashboard exposes only aggregates, never individual scores.
- **Not identity-verified:** users can vote again if they clear cookies, use another browser or device. For governance-grade voting use invite links/SSO.
- Production must not be used for the meeting until live database, session cookies, multi-device updates, admin lock, and CSV are tested.
- Access to Dashboard and admin control UI is public; only admin control requests require the secret.

## Files
`public/` frontend; `netlify/functions/api.mjs` backend; `netlify/database/migrations/` initial schema; `netlify.toml` hosting settings.

## Local development
Node 22+, Netlify CLI:
```sh
npm install
netlify link
netlify database init
netlify database migrations apply
netlify dev
```
Avoid overwriting committed migrations. Never check in `.env`, keys, `.netlify/`, or generated files.

## Notes
This repository is independent of the existing UTP application and never modifies its code or database.
