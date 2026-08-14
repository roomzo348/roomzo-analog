# Java Decommission Checklist

Use this checklist during the final big-bang cutover from Java backend to Analog Nitro backend.

## 1) Infrastructure and Secrets

- [ ] Configure Analog runtime vars from `.env.example` in deployment secrets.
- [ ] Ensure MySQL credentials point to production DB used by Java.
- [ ] Ensure SMTP credentials are valid for OTP/contact/report email flows.
- [ ] Ensure OneSignal app ID/API key are configured.
- [ ] Set `NEARBY_SEARCH_RADIUS_KM` to intended production value.

## 2) API and Realtime Smoke Tests

- [ ] Auth: `send-otp`, `verify-otp`, `register`, `login`, `forgot-password-init`, `reset-password`.
- [ ] Listings: add, update, delete, owner list, status update, listing details.
- [ ] Discovery: searchWithFilters, featured, recent, exploreCity.
- [ ] Engagement: favourites, reviews, report-property, consent checks/saves.
- [ ] Analytics: activity log ingest + owner/property metrics.
- [ ] Flatmates: create, check-status, nearby feed, delete.
- [ ] Chat REST: conversations/history/accept.
- [ ] Realtime: `/ws-chat` connect, send, read-receipt.

## 3) Frontend Cutover

- [ ] Confirm frontend uses same-origin API (`environment.apiUrl = ''`).
- [ ] Deploy `roomzo-analog` with new server routes.
- [ ] Run user journey checks on production build:
  - [ ] visitor browse/search/listing details
  - [ ] login/register/password reset
  - [ ] contact owner / consent flow
  - [ ] owner my-listings lifecycle
  - [ ] chat send/receive/read

## 4) Java Retirement

- [ ] Remove Java backend from load balancer / ingress.
- [ ] Disable Java background workers and cron jobs.
- [ ] Archive Java logs and last deployment artifacts.
- [ ] Keep rollback window with previous release image for emergency only.
- [ ] After stabilization window, revoke Java app credentials/secrets.

## 5) Post-Cutover Validation

- [ ] Compare key KPIs for 24h: listing views, contacts, shares, chat messages.
- [ ] Verify DB write rates and API latency are stable.
- [ ] Review error logs for unhandled endpoint payload variants.
- [ ] Confirm sitemap still includes active `/room/:id` pages.
