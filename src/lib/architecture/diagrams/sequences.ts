import type { Diagram } from "../types";

// Sequence diagrams: one scenario each, in call order.

export const sequenceDiagrams: Diagram[] = [
  {
    id: "seq-teacher-email-signin",
    title: "Sequence: teacher signs in with email and password",
    repo: "system",
    family: "sequence",
    summary: "The calls between the browser, the Vercel proxy, the backend and the database, including lockout and email verification.",
    source: String.raw`sequenceDiagram
  autonumber
  actor T as Teacher
  participant B as Teacher module in the browser
  participant P as Next API proxy /api
  participant A as Backend /teacher/auth/login
  participant D as Postgres
  T->>B: Email and password
  B->>P: POST /api/teacher/auth/login (credentials included)
  P->>A: Forward the request body unchanged
  A->>D: Find the account by email
  alt account is locked
    A-->>B: 429 with Retry-After, password not checked
  else password wrong
    A->>D: register_failure: count a miss, lock after the limit
    A-->>B: 401 Email or password is incorrect
  else email not verified
    A->>D: Issue an email code
    A-->>B: 403 verify your email
  else suspended
    A-->>B: 403 suspended
  else success
    A->>D: register_success clears the counter, create a refresh session
    A-->>P: 200 access token plus Set-Cookie refresh token
    P-->>B: Forward the token and the cookie
    B->>B: Keep the access token in memory only
    B->>B: Clear any old builder drafts, then go to the page asked for
  end`,
    related: ["dfd-2-auth", "seq-token-refresh", "state-auth-session-client"],
    notes: ["The access token lives only in a JavaScript variable. It is never written to localStorage, so a page refresh signs in again silently through the refresh cookie.", "The proxy forwards the Set-Cookie header and forces Cache-Control no-store."],
    files: ["teacher-module/src/lib/apiClient.ts", "teacher-module/src/pages/api/[...path].ts", "backend/app/api/routes/teacher_auth_routes.py"],
  },
  {
    id: "seq-phone-otp-signin",
    title: "Sequence: teacher signs in with a phone code",
    repo: "system",
    family: "sequence",
    summary: "Requesting and checking a phone code, with Turnstile, the SMS provider and the outbox.",
    source: String.raw`sequenceDiagram
  autonumber
  actor T as Teacher
  participant B as Browser
  participant TS as Cloudflare Turnstile
  participant A as Backend
  participant D as Postgres
  participant S as SMS provider
  T->>B: Enter the phone number
  B->>TS: Run the human check
  TS-->>B: Single use token
  B->>A: POST /teacher/auth/phone/request-otp with the token
  A->>TS: Verify the token
  A->>D: Store only the hash of a new code with attempts and expiry
  A->>S: Send the code (msg91 or mock), daily cap applies
  A->>D: Write a masked outbox row, code redacted
  A-->>B: Same reply for known and new numbers
  T->>B: Type the code
  B->>A: POST /teacher/auth/phone/verify
  A->>D: Check expiry, attempts and hash, then mark it consumed
  alt profile exists
    A->>D: Use the existing account
  else new number
    A->>D: Create a phone account
  end
  A-->>B: Access token plus refresh cookie`,
    related: ["dfd-3-phone-otp", "dfd-2-auth"],
    notes: ["Limits: 8 code requests and 20 checks per hour per client, an attempt limit per code, and a daily SMS cap."],
    files: ["backend/app/api/routes/teacher_phone.py", "teacher-module/src/components/PhoneSignIn.tsx"],
  },
  {
    id: "seq-token-refresh",
    title: "Sequence: keeping the teacher signed in (refresh)",
    repo: "teacher",
    family: "sequence",
    summary: "How the browser quietly gets a new access token, with one shared refresh when many calls fail at once.",
    source: String.raw`sequenceDiagram
  autonumber
  participant UI as Page code
  participant C as apiClient
  participant P as Next proxy
  participant A as Backend /teacher/auth/refresh
  participant D as Postgres
  UI->>C: api.someCall()
  C->>P: Request with Authorization bearer
  P->>A: Forward
  A-->>C: 401 expired token
  C->>C: Is a refresh already running?
  alt first caller
    C->>P: POST /teacher/auth/refresh (cookie, credentials included)
    alt no refresh cookie
      P-->>C: Local 401 without calling the backend
    else cookie present
      P->>A: Forward
      A->>D: Rotate the refresh session, mark the old one rotated
      A-->>C: New access token plus new cookie
    end
  else others wait
    C->>C: Wait for the same refresh result
  end
  alt refresh worked
    C->>P: Retry the original request once
    P->>A: Forward
    A-->>UI: Result
  else refresh failed
    C-->>UI: Signed out, go to sign-in with next=
  end`,
    related: ["state-auth-session-client", "sec-token-lifecycle"],
    notes: ["Only one refresh runs at a time (single flight), so a page that fires six calls does not rotate the cookie six times.", "On first load the session provider tries refresh up to 3 times with growing delays and retries only on network errors, not on 401 or 403.", "Every 5 seconds the shell reads /teacher/platform-status; if the platform session epoch changed (a forced sign-out) the browser signs out and redirects."],
    files: ["teacher-module/src/lib/apiClient.ts", "teacher-module/src/lib/teacherSession.tsx", "teacher-module/src/pages/api/[...path].ts"],
  },
  {
    id: "seq-topical-generation",
    title: "Sequence: generating a topical paper",
    repo: "system",
    family: "sequence",
    summary: "Every step from the Generate button to a stored worksheet, including the idempotency claim, quota, generation slot and failure release.",
    source: String.raw`sequenceDiagram
  autonumber
  actor T as Teacher
  participant B as Browser (useGenerateTopicalPaper)
  participant R as Route worksheet_topical
  participant I as Idempotency records
  participant Q as Quota counters
  participant G as Generation engine
  participant D as Postgres
  T->>B: Generate preview
  B->>B: Plan gate check, session check, ad gate if Free
  B->>R: POST /worksheets/topical with selected template codes and an idempotency key
  R->>R: Resolve teacher from the token, set RLS context
  R->>I: Claim the key (in_progress, completed or 409)
  R->>D: Load approved templates and filter by topic, paper and plan
  R->>Q: reserve_generation_quota (atomic)
  alt limit reached
    R-->>B: 402 or 429, nothing charged
  else reserved
    R->>R: generation_slot: wait for one of 4 slots per process, else 503
    R->>D: Commit and release the connection
    R->>D: Read recent signatures and wordings, release again
    R->>G: Generate each question: sample, verify, guard, render
    alt hard failure
      R->>Q: release_generation_quota once
      R->>I: Mark failed
      R-->>B: Error, nothing charged
    else success
      R->>D: Store the worksheet and record template usage
      R->>I: Mark completed with the response
      R-->>B: Worksheet
      B->>B: Mark templates used, refresh billing, delete the saved draft
    end
  end`,
    related: ["dfd-2-generation", "dfd-3-quota-idempotency", "dfd-3-variant-engine"],
    notes: ["Rate limit on this route is 20 a minute.", "The slow generation work runs without holding a database connection, which is what let the system pass the load test with no server errors."],
    files: ["backend/app/api/routes/worksheet_topical.py", "backend/app/api/routes/worksheet_common.py", "teacher-module/src/hooks/workspace/useGenerateTopicalPaper.ts"],
  },
  {
    id: "seq-pdf-export",
    title: "Sequence: previewing and downloading a PDF",
    repo: "system",
    family: "sequence",
    summary: "Export, preview and download, including the Free-plan ad before a mark scheme and the phone-safe download.",
    source: String.raw`sequenceDiagram
  autonumber
  actor T as Teacher
  participant B as Browser (usePdfPreview)
  participant R as Route worksheet_exports
  participant E as pdf_export
  participant S as Local disk and bucket
  T->>B: Preview MS
  opt Free plan
    B->>B: Rewarded ad for this paper (ms_view)
  end
  B->>R: POST /worksheets/id/export with an Idempotency-Key
  R->>R: Check ownership and RLS
  alt files current and present
    R-->>B: Existing paths
  else needs rendering
    R->>E: Render worksheet PDF, answer key PDF and first page images
    E->>S: Write to local disk, copy up to 4 files to the bucket
    R-->>B: Paths saved on the worksheet
  end
  alt on screen view
    B->>R: GET answer-key.html?embedded=true
    R-->>B: Page with answers by plan, shown in an iframe
  else PDF view or download
    B->>R: GET worksheet.pdf or answer-key.pdf
    R->>S: ensure_local restores from the bucket if the file is gone
    R-->>B: PDF bytes
    B->>B: deliverFile: share sheet on a phone, link or download on a computer
  end`,
    related: ["dfd-3-pdf-render-store", "teacher-preview-modal-flow"],
    notes: ["Monthly and Quarterly plans see the mark scheme on screen only; the downloadable mark scheme PDF is Yearly.", "Export is rate limited to 30 a minute."],
    files: ["backend/app/api/routes/worksheet_exports.py", "teacher-module/src/hooks/workspace/usePdfPreview.ts", "teacher-module/src/lib/fileDelivery.ts"],
  },
  {
    id: "seq-checkout-razorpay",
    title: "Sequence: buying a plan with Razorpay",
    repo: "system",
    family: "sequence",
    summary: "Checkout from order creation to an active plan, with both the browser callback and the webhook.",
    source: String.raw`sequenceDiagram
  autonumber
  actor T as Teacher
  participant B as Checkout panel
  participant A as Backend billing
  participant RZ as Razorpay
  participant D as Postgres
  T->>B: Open checkout for a plan
  B->>A: POST /billing/razorpay/order (plan, optional promo or offer)
  A->>A: Work out the price, discount before GST
  alt total is zero
    A->>D: Grant the plan directly
    A-->>B: free result and billing status
  else payment needed
    A->>RZ: Create order with notes teacher_id and plan_code
    A->>D: Record razorpay.order.created
    A-->>B: Order id and amount
    B->>RZ: Load checkout.js and open Razorpay Checkout
    T->>RZ: Pay
    par browser callback
      RZ-->>B: payment id and signature
      B->>A: POST /billing/razorpay/verify
      A->>A: Check the signature and fetch the order notes
    and webhook
      RZ->>A: POST /billing/razorpay/webhook with a signature
    end
    A->>D: Activate once, unique by payment id
    A-->>B: Billing status
    B->>B: Success card with confetti, refresh offers
  end`,
    related: ["dfd-3-razorpay-activation", "dfd-3-price-and-order", "state-subscription", "teacher-billing-client-flow"],
    notes: ["The browser never decides the price or the plan: both come from the server and are checked against the order notes."],
    files: ["backend/app/api/routes/billing.py", "teacher-module/src/components/billing/CheckoutPanel.tsx"],
  },
  {
    id: "seq-ad-unlock",
    title: "Sequence: watching an ad to unlock one paper",
    repo: "system",
    family: "sequence",
    summary: "The Free-plan rewarded ad from start to a spendable credit.",
    source: String.raw`sequenceDiagram
  autonumber
  actor T as Free teacher
  participant B as AdGateProvider
  participant A as Backend /billing/ad
  participant D as Postgres
  T->>B: Generate, daily limit reached
  B->>B: Cookie consent for marketing?
  B->>A: POST /billing/ad/start (purpose, target)
  A->>D: Count today's starts, at most 6
  A-->>B: Signed token and seconds to wait
  B->>B: Try the Google rewarded ad, then AdSense, then the timer card
  B->>A: POST /billing/ad/complete with the token
  A->>A: Check signature, owner, purpose, one use, 28 seconds to 15 minutes
  A->>D: Store one credit in teacher_quota_counters
  A-->>B: Billing status
  B->>A: Generate again, this time spending the credit`,
    related: ["dfd-3-ad-credit", "dfd-2-ad-gate"],
    notes: ["If no ad is configured or shown, nothing is unlocked. The 30 second card is not a way around the gate."],
    files: ["teacher-module/src/lib/adGate.tsx", "backend/app/services/ad_gate_service.py"],
  },
  {
    id: "seq-ai-check-upload",
    title: "Sequence: AI checking an uploaded paper",
    repo: "system",
    family: "sequence",
    summary: "From the upload on the Check page to marks and a downloadable report.",
    source: String.raw`sequenceDiagram
  autonumber
  actor T as Teacher
  participant B as Check page
  participant A as Backend worksheet_checking
  participant Q as billing_service
  participant L as LLM provider
  participant D as Postgres
  T->>B: Choose the scanned pages
  B->>A: POST /worksheets/check-upload (multipart)
  A->>Q: reserve_ai_check
  alt not allowed
    A-->>B: 402 or 429
  else reserved
    A->>A: Find the paper from its QR code, check the teacher owns it
    A->>A: Split into page images
    loop each question or part
      A->>L: Read the working and mark it against the scheme
      L-->>A: Marks and feedback
    end
    alt confirmed failure
      A->>Q: release_ai_check
      A-->>B: Error, check not used
    else done
      A->>D: Log paper_checked
      A-->>B: Results and unmatched questions
      T->>B: Download report
      B->>A: POST /worksheets/id/check-report.pdf
      A-->>B: Report PDF
    end
  end`,
    related: ["dfd-2-checking", "dfd-3-ai-marking"],
    files: ["backend/app/api/routes/worksheet_checking.py", "teacher-module/src/pages/checking.tsx"],
  },
  {
    id: "seq-admin-login",
    title: "Sequence: admin signs in through the gateway",
    repo: "admin",
    family: "sequence",
    summary: "How the admin panel talks to the backend without ever holding the gateway secret in the browser.",
    source: String.raw`sequenceDiagram
  autonumber
  actor O as Owner or admin
  participant B as Admin panel in the browser
  participant G as Panel server route /api/gateway
  participant CF as Cloudflare Access (optional)
  participant A as Backend /api/admin
  participant D as Postgres
  O->>B: Email and password
  B->>G: POST /api/gateway/admin/auth/login
  opt Cloudflare Access configured
    G->>CF: Verify the Cf-Access-Jwt-Assertion (RS256, JWKS)
  end
  G->>G: Strip x-ztna-, cf-, x-forwarded- and similar headers from the browser
  G->>A: Forward with the gateway secret header added
  A->>A: Gateway secret matches? else 403
  A->>D: Check lockout, password, active flag
  A->>D: Create an admin refresh session
  A-->>G: Access token (15 min) and HttpOnly refresh cookie (14 days)
  G->>G: Rewrite Set-Cookie for the panel's own site
  G-->>B: Token and cookie
  B->>B: Keep the access token in memory
  Note over B,A: Later calls send the bearer token. The browser refreshes before expiry and on 401 through /admin/auth/refresh, which rotates the session.`,
    related: ["admin-gateway-flow", "sec-admin-rbac", "dfd-2-admin-audit"],
    notes: ["Five failed logins in 15 minutes lock an admin account.", "The access token carries a token_version; changing it on the account signs that admin out everywhere."],
    files: ["admin-panel/src/pages/api/gateway/[...path].ts", "admin-panel/src/lib/adminAuth.tsx", "backend/app/api/routes/admin_auth.py"],
  },
  {
    id: "seq-admin-refund",
    title: "Sequence: an admin refunds a payment",
    repo: "admin",
    family: "sequence",
    summary: "The refund path from the User 360 page to Razorpay and the audit trail.",
    source: String.raw`sequenceDiagram
  autonumber
  actor O as Admin with billing.refund
  participant B as Admin panel
  participant A as Backend admin_support_billing
  participant RF as refund_service
  participant RZ as Razorpay
  participant D as Postgres
  O->>B: Refund, with a reason and optional amount
  B->>A: POST /admin/teachers/id/billing/refund
  A->>A: Permission billing.refund, else refused and logged
  A->>RF: find_refundable_payment (latest verified payment)
  alt none, or already refunded
    A-->>B: 404 or 409, nothing sent
  else found
    RF->>RZ: POST /payments/id/refund
    alt Razorpay refuses
      A-->>B: 400 or 502, no event written
    else accepted
      A->>D: Record razorpay.refund.created and an admin action log
      opt cancel the plan too
        A->>D: Cancel the subscription
      end
      A-->>B: Done
    end
  end
  A->>D: Automatic audit row for the write`,
    related: ["dfd-2-billing", "sec-admin-rbac"],
    notes: ["Only one refund is possible per payment. billing.refund is owner-only unless a role has been explicitly given it."],
    files: ["backend/app/api/routes/admin_support_billing.py", "backend/app/services/refund_service.py"],
  },
  {
    id: "seq-admin-sql-run",
    title: "Sequence: running a change in the Database console",
    repo: "admin",
    family: "sequence",
    summary: "Review, confirm and run, with the review token, typed phrase and password step.",
    source: String.raw`sequenceDiagram
  autonumber
  actor O as Owner
  participant U as Database page
  participant A as Backend admin_database
  participant G as sql_console_guard
  participant D as Postgres (production or test)
  O->>U: Type a statement
  U->>A: POST /database/target/sql/review
  A->>G: Scrub, check one statement, verbs, restricted tables
  alt blocked
    A-->>U: Blocked with the reason
  else allowed
    A->>D: Dry run in a transaction that is always rolled back
    A-->>U: Risk, row count, RLS and guard status, review token (5 minutes)
    O->>U: Type RUN ON PRODUCTION, second phrase if high risk, then the password
    U->>A: POST /database/target/sql/run with token and password
    A->>A: Check password, lockout, token matches admin, target and statement
    A->>D: Execute
    alt row count differs from the dry run
      A->>D: Roll back
      A-->>U: Nothing changed, difference shown
    else same
      A->>D: Commit
      A->>D: Write admin_sql_run
      A-->>U: Done
    end
  end`,
    related: ["dfd-2-database-console", "dfd-3-sql-console"],
    files: ["backend/app/api/routes/admin_database.py", "admin-panel/src/components/database/SqlConsole.tsx"],
  },
  {
    id: "seq-template-ingestion",
    title: "Sequence: adding a template from screenshots",
    repo: "backend",
    family: "sequence",
    summary: "The dashboard flow from screenshots to an approved template.",
    source: String.raw`sequenceDiagram
  autonumber
  actor Au as Template author
  participant Dh as Dashboard
  participant A as Backend
  participant L as LLM provider
  participant D as Postgres
  Au->>Dh: Upload question and mark scheme screenshots
  Dh->>A: POST /api/extract/template-draft (20 to 90 seconds)
  A->>L: OCR and structure plan
  loop up to 4 repair rounds
    A->>A: Validate the draft
    A->>L: Repair what failed
  end
  A-->>Dh: Draft JSON
  Au->>Dh: Edit in review
  Dh->>A: POST /api/preview
  A-->>Dh: 5 sampled variants checked with SymPy
  Dh->>A: POST /api/templates
  A->>D: Insert as draft, safe_to_generate false
  Au->>Dh: Approve
  Dh->>A: POST /api/templates/id/approve
  A->>D: Lock the row and run the checks
  A->>D: status approved, safe_to_generate true, log approval
  A-->>Dh: Approved`,
    related: ["dfd-2-template-authoring", "dfd-3-template-approval"],
    files: ["docs/admin-upload-flow.md", "backend/app/api/routes/extract.py", "backend/app/api/routes/templates.py"],
  },
  {
    id: "seq-institute-join",
    title: "Sequence: an institute is set up and a teacher joins",
    repo: "system",
    family: "sequence",
    summary: "From the first request to a teacher using the institute plan.",
    source: String.raw`sequenceDiagram
  autonumber
  actor V as Visitor or teacher
  participant B as Teacher module
  participant A as Backend
  participant AD as Admin panel
  participant D as Postgres
  V->>B: Request an institute plan
  B->>A: POST /teacher/organization-requests
  A->>D: organization_requests status pending
  AD->>A: Admin approves the request
  A->>D: Create the organization (institute, active) and an activation token, status approved
  A-->>AD: Activation details to hand over
  V->>B: Open the activation link
  B->>A: Redeem the token
  A->>D: status delivered, requester becomes institute_owner
  Note over V,D: Later a teacher joins with the institute code
  V->>B: Enter the join code
  B->>A: POST /teacher/organization/join
  A->>D: organization_members row, role institute_teacher, status active
  A-->>B: Institute features and plan available`,
    related: ["dfd-2-institutes", "state-org-request"],
    files: ["backend/app/services/organization_requests.py", "teacher-module/src/pages/join-institute.tsx"],
  },
];
