# Website frontend: backend API changes for the cutover

For: the Claude working on the Glamlink website (glamlink.net) frontend.
Backend: `api.glamlink.net`, all routes under `/api/v1`. Backend branch: `phase3/identity` (from `phase2c` onward).

The backend and the website ship together in one cutover. After it, every signed-in person has to sign in
again (old tokens stop working). Everything below is what the website must change to work with the new
backend; anything not mentioned answers as before.

## 1. What to change, in short

1. **Sign-in**: new login response, a 15-minute access token, a refresh token in an httpOnly cookie, a
   refresh call. Send `credentials: 'include'` on the auth calls. See section 2.
2. **Registration and email verification**: no more 4-digit OTP. Registration emails a link; build the
   page `/verify-email` that the link opens. See section 3.
3. **Forgot / reset / change password**: links instead of OTP codes; build the page `/reset-password`.
   Changing the password while signed in moved to `/user/auth/change-password`.
4. **Renamed endpoints and fields**: "beautician" and "counselor" are now "professional" (section 5).
5. **Sign-in requirements**: routes now refuse guests with `401` where they need a person, and Access card
   owner routes need a professional account (section 6). Handle `401` by refreshing, then sign-in.
6. **Error codes**: error responses carry a `code` to branch on (section 4).
7. **Access card welcome email** now links to `/reset-password` to set a first password (section 7).

## 2. Sign-in model

| Piece | Lifetime | Where it lives | Sent how |
| --- | --- | --- | --- |
| Access token (JWT) | 15 minutes | Memory only (not localStorage) | `Authorization: Bearer <token>` (or the old `x-access-token` header; both work) |
| Refresh token | 30 days, extended on every refresh | httpOnly cookie `glamlink_refresh` set by `api.glamlink.net` (Path `/api/v1/user/auth`, SameSite=Lax, Secure) | Automatically, when the request uses `credentials: 'include'` |

- The website never sees the refresh token; JavaScript cannot read the cookie. The app gets it in the body instead.
- **Every auth call that sets or uses the cookie needs `credentials: 'include'`**: `login`, `verify-email`,
  `refresh`, `logout`, `logout-all`. The API already allows credentials for the origins in its
  `ACCESSDOMAINS` setting (must include `https://glamlink.net`, and `https://www.glamlink.net` if used).
- Send `client: "website"` in the JSON body of `register`, `login` and `verify-email` (or the header
  `x-client: website`). The website signs in **professional accounts only**.
- The `role_id` request header is gone: nothing reads it. Account type comes from the account.

**Refresh flow**

```js
// On app start: try to get an access token from the cookie (silent sign-in).
// Before the access token expires (access_token_expires_at), or after a 401 with code SESSION_EXPIRED:
const res = await fetch(`${API}/api/v1/user/auth/refresh`, { method: 'POST', credentials: 'include',
  headers: { 'Content-Type': 'application/json' }, body: '{}' });
// 200 -> data.access_token (+ access_token_expires_at). A new refresh cookie is set automatically.
// 409 code REFRESH_TOKEN_ROTATED -> another tab refreshed at the same moment: wait ~300 ms and retry once.
// 401 code SESSION_EXPIRED -> signed out: go to the sign-in page.
```

Retry the original request once after a successful refresh. Refresh tokens rotate: if an old one is ever
replayed, the backend treats it as stolen and ends that session (the person signs in again).

Local development: the cookie only flows between the same site. Run the website and API on the same
hostname (both `localhost`, not `localhost` and `127.0.0.1`). The cookie is not `Secure` outside production.

## 3. Auth endpoints

All bodies are JSON. Successful responses keep the usual envelope `{ success: true, status, message, data }`.

| Endpoint | Body | Success | Notes |
| --- | --- | --- | --- |
| `POST /user/auth/register` | `name`, `email`, `password`, `confirm_password`, `client: "website"`, `turnstile_token`; optional `professional_type` (`individual` default, or `brand`), `mobile`, `profession`, `about`, `address`, `state_id`, `city_id`, `user_name`, `referral_code` | `201`, `data: { email, verification_sent: true }` | Emails a verification link. Registering an email that exists but was never verified just sends a new link (same answer). A verified email: `409 EMAIL_TAKEN`. Password: 8–100 characters, at least 2 digits, no spaces. The Turnstile captcha is required in production. |
| `POST /user/auth/verify-email` | `token`, `client: "website"` | `200`, sign-in response (below) | The person is signed in. A used or expired link: `400 INVALID_LINK`. |
| `POST /user/auth/resend-verification` | `email` | `200` always | Never reveals whether the account exists. |
| `POST /user/auth/login` | `email`, `password`, `client: "website"` | `200`, sign-in response | Errors: `401 INVALID_CREDENTIALS`, `403 EMAIL_NOT_VERIFIED` (a new link is sent automatically), `403 PROFESSIONAL_REQUIRED` (a user/app account), `400 PASSWORD_NOT_SET` (account made with Google/Apple: use forgot password), `403 ACCOUNT_DISABLED`. |
| `POST /user/auth/refresh` | `{}` (cookie) | `200`, `data: { access_token, access_token_expires_at, refresh_token_expires_at }` | See section 2. |
| `POST /user/auth/logout` | `{}` + access token | `200` | Ends this session and clears the cookie. Was `GET /user/auth/logout`. |
| `POST /user/auth/logout-all` | `{}` + access token | `200` | Ends every session of the account. |
| `POST /user/auth/forgot-password` | `email` | `200` always | Emails a reset link valid 1 hour. Also how Google/Apple-only accounts set a password. |
| `POST /user/auth/reset-password` | `token`, `password`, `confirm_password` | `200` | Signs out every device; then sign in. Bad link: `400 INVALID_LINK`. Also verifies the email if it was not yet. |
| `POST /user/auth/change-password` | `old_password`, `new_password`, `confirm_password` + access token | `200` | Other devices are signed out; this one stays. Was `POST /user/auth/reset-password` (authenticated). |
| `POST /user/auth/sso` | | `501` | Google sign-in comes later. |

**Sign-in response** (`login`, `verify-email`):

```json
{
  "success": true, "status": 200, "message": "Signed in.",
  "data": {
    "user": { "id": 18, "name": "…", "email": "…", "account_type": "professional",
              "professional_type": "individual", "email_verified": true, "role_id": 7 },
    "access_token": "…", "access_token_expires_at": "2026-10-15T10:15:00.000Z",
    "refresh_token_expires_at": "2026-11-14T10:00:00.000Z"
  }
}
```

Was: `data: { id, name, email, role_id, tokens: { access: { token, expires } } }` with a 7-day token.

**Removed**: `POST /user/auth/otp`, `POST /user/auth/verify-otp`, `GET /user/auth/logout`, the OTP-based
`forgot-password` body (`email, password, confirm_password, token`).

### Pages the email links open

| Page | Opened by | What it does |
| --- | --- | --- |
| `/verify-email?token=…` | Verification email (valid 24 h) | `POST /user/auth/verify-email { token, client: "website" }` → signed in → dashboard. On `INVALID_LINK`, offer "send a new link" (`resend-verification`). |
| `/reset-password?token=…` | Forgot-password email (1 h), and the Access card welcome email for new owners (7 days) | Form with password + confirm → `POST /user/auth/reset-password` → sign-in page. Word it so it fits both "reset" and "set your password". |

The links use the backend's `WEBSITE_URL` (`https://glamlink.net` in production).

## 4. Error codes

Error responses: `{ success: false, status, message, code, data: "" }`. `code` is stable; `message` is for people.

| Code | Status | Meaning |
| --- | --- | --- |
| `SIGN_IN_REQUIRED` | 401 | The route needs a signed-in account and none was sent |
| `SESSION_EXPIRED` | 401 | Access token expired/invalid or the session ended: refresh, else sign in |
| `REFRESH_TOKEN_ROTATED` | 409 | Another tab refreshed at the same moment: retry the refresh once |
| `PROFESSIONAL_REQUIRED` | 403 | A user (app) account on a professional-only route or website sign-in |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password (deliberately not saying which) |
| `EMAIL_NOT_VERIFIED` | 403 | Sign-in before verifying; a new link was emailed |
| `PASSWORD_NOT_SET` | 400 | Account created with Google/Apple; use forgot password |
| `ACCOUNT_DISABLED` | 403 | Account deactivated or rejected |
| `EMAIL_TAKEN` | 409 | Registering a verified email |
| `WEAK_PASSWORD` | 400 | Password rules not met |
| `PASSWORD_MISMATCH` | 400 | Password and confirm differ |
| `INVALID_LINK` | 400 | Email link expired or already used |
| `INVALID_INPUT` | 400 | Missing name or invalid email |
| `CAPTCHA_REQUIRED` / `CAPTCHA_FAILED` | 400 | Turnstile token missing or rejected |

Older errors elsewhere in the API still have no `code`; branch on `status` there.

## 5. Renamed endpoints and fields

| Was | Now |
| --- | --- |
| `GET /user/find-beautician` | `GET /user/find-professional` |
| `GET /user/nearby/map/beautician/list` | `GET /user/nearby/map/professional/list` |
| `/user/beautician/brand/association` (+ `/list`, `/answer`, `/remove`, `/success/list`) | `/user/professional/brand/association` (same sub-paths) |
| `GET /user/list/random-counsellors` | `GET /user/list/random-professionals` |
| `POST /user/list/nearby-counsellors` | `POST /user/list/nearby-professionals` |
| `GET /review/:counselor_id` | `GET /review/:professional_id` |
| `/counselor/schedular[...]` | `/professional/scheduler[...]` |

Response fields:

| Where | Was | Now |
| --- | --- | --- |
| `GET /user/profile` (and other profile payloads) | `user_profile.no_of_beautician_associated` | `user_profile.no_of_professionals_associated` |
| `GET /user/profile` | `reviews[].counselor_id` | `reviews[].professional_id` |
| `GET /user/profile` | | adds `account_type`, `professional_type`, `email_verified_at`, `downgraded_at` |
| `GET /user/profile` | `user_role: { name: "Estheticians", abbreviation: "ESTI" }` | `user_role: { name: "Professional", abbreviation: "PRO" }` |
| Bookings / appointments / reviews (app) | `counselor_id`, `is_counselor_joined`, `is_counselor_canceled` | `professional_id`, `is_professional_joined`, `is_professional_canceled` |
| Bookings / appointments (app) | `call_type` and video-call fields | removed |
| Any user object | emails as typed | emails stored lowercase |

Request fields follow the same renames (`counselor_id` → `professional_id`).

Also removed since the version in production: the counselling features (`/price`, `/keywords`, `/user/fees/change`,
`/user/trial`, `/user/list/counsellors`), `/order/createOrder`, `/payment/crm/*`, the CRM routes
(`/customer`, `/staff`, `/vendor`), `/logs`, `/test`. The website should not call any of these.

## 6. Sign-in requirements

- **public**: no token needed. **optionalAuth**: works without a token, shows more with one.
- **authenticate**: any signed-in account; guests get `401 SIGN_IN_REQUIRED`.
- **requireProfessional**: a professional account; user accounts get `403 PROFESSIONAL_REQUIRED`.
- **ownerOrAdmin**: the signed-in owner of the record (or an admin). **(or unowned)**: also open while the
  record has no owner yet, which is the logged-out Access card purchase flow.

Before, most of these let guests through and then failed with `500`. Website and shared endpoints now:

| Method | Path | Needs |
| --- | --- | --- |
| POST | `/businessCard` | public (logged-out purchase) |
| POST | `/businessCard/select-plan` | public |
| POST | `/businessCard/shipping-rate-public` | public |
| POST | `/businessCard/create-subscription-public` | public |
| POST | `/businessCard/createBusinessCard` | requireProfessional |
| GET | `/businessCard/getMyBusinessCard` | requireProfessional |
| POST | `/businessCard/select-address` | requireProfessional |
| POST | `/businessCard/shipping-rate` | requireProfessional |
| GET | `/businessCard/payment-history` | requireProfessional |
| POST | `/businessCard/create-subscription` | requireProfessional |
| POST | `/businessCard/cancel-subscription` | requireProfessional |
| PUT | `/businessCard/updateBusinessCard/:id` | ownerOrAdmin (or unowned) |
| PUT | `/businessCard/:id/featured-links/reorder` | ownerOrAdmin (or unowned) |
| GET | `/businessCard/getBusinessCardById/:id`, `/getBusinessCard/:slug`, `/search`, `/getAllProfiles`, `/filter`, `/getAllCategories`, `/findCategoryById/:id`, `/getAllDirectories`, `/getProfilesByDirectory/:id` | public |
| POST | `/access-card/analytics/event` | public |
| GET | `/access-card/analytics/:businessCardId`, `/access-card/analytics/:businessCardId/events` | ownerOrAdmin |
| GET | journal, journal categories, authors, blog, blog categories, podcast schedule, discover, ads, FAQ | public |
| POST | `/guest-application/create`, `/partnership-inquiry`, `/contactUs` | public |
| GET | `/form/getAllQuestions` | public |
| POST | `/form/submitForm` | authenticate |
| GET | `/user/profile` | authenticate |
| GET | `/user/profile/:userId` | optionalAuth |
| POST | `/user/profile`, `PUT /user/username`, `POST /user/addLinkTreeLink`, `POST /user/notifications`, `DELETE /user/deactivate` | authenticate |
| GET | `/user/list`, `/user/list/random-professionals`, `/user/list/timezones`; POST `/user/list/nearby-professionals`, `/user/search` | optionalAuth |
| GET | `/payment/stripe/stripe-key` | optionalAuth |
| POST | `/payment/stripe/create-payment-intent` | authenticate |
| GET | `/country`, `/state`, `/city`, `/language`, `/category`, `/profession` (and `/:id`) | public |

Every other user route (social, bookings, marketplace: app features) needs `authenticate`; admin routes
need an admin token and refuse user tokens.

## 7. Access card purchase: what changed

- The purchase endpoints and their payloads are unchanged.
- A buyer without an account now gets a professional account **without a password**. The welcome email has
  a "Set Your Password" button to `/reset-password?token=…` (valid 7 days) instead of a generated password.
  Setting it also verifies the email. Until then, sign-in answers `PASSWORD_NOT_SET`.
- If the card's email already belongs to an account, that account is used (an app "user" account becomes a
  professional one). Before, the payment webhook could fail in this case.
- Cards bought while logged out are attached to the account once its email is verified (or the password is
  set from the welcome link).
