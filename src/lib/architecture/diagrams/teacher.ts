import type { Diagram } from "../types";

// Teacher module (Next.js) diagrams, written from paperly-teacher-module/src.
export const teacherDiagrams: Diagram[] = [
  {
    id: "c4-3-teacher-components",
    title: "C4 level 3: teacher module components",
    repo: "teacher",
    family: "c4",
    level: 3,
    summary: "The Next.js app split into pages, shared providers, hooks, the API client and the library of pure helpers.",
    source: String.raw`flowchart TD
  subgraph Pages[pages/ - one file per screen]
    PW[workspace - topical builder]
    PF[full-portion]
    PC[checking]
    PB[billing]
    PA[account / onboarding]
    PJ[join / join-institute]
    PL[index - landing]
  end
  subgraph Providers[Providers in _app.tsx]
    TS[TeacherSessionProvider]
    BP[BillingProvider]
    OP[OfferProvider]
    AG[AdGateProvider]
  end
  subgraph Hooks[hooks/workspace and hooks/fullPortion]
    H1[useLocalDraft]
    H2[useServerDraftSync]
    H3[useWorkspaceStageNavigation]
    H4[useTemplateBankLoader]
    H5[useGenerateTopicalPaper]
    H6[usePdfPreview]
  end
  subgraph Lib[lib/ - pure helpers]
    L1[workspaceBuilder - stages, buckets]
    L2[templatePresentation - card text]
    L3[teacherFlowMachine - flow types]
    L4[planCatalog / pricingConfig]
    L5[latexRepair / sampleExpression]
  end
  API[apiClient - attaches token, refreshes once on 401]
  PX[pages/api/path - proxy to the backend]
  BE[(Backend)]
  PW --> H1 & H2 & H3 & H4 & H5 & H6
  PF --> H5
  Pages --> Providers
  Hooks --> Lib
  Providers --> API
  Hooks --> API
  Pages --> API
  API --> PX --> BE`,
    children: ["teacher-page-map", "teacher-provider-stack", "teacher-api-client-flow", "teacher-builder-flow", "teacher-full-portion-flow", "teacher-checking-flow", "teacher-billing-client-flow", "teacher-preview-modal-flow", "teacher-draft-persistence", "teacher-plan-gates"],
    related: ["c4-2-containers", "state-worksheet-flow", "state-auth-session-client"],
    notes: ["Components import from lib and hooks, never the other way round, so the helpers in lib can be tested without a browser.", "Every network call goes through apiClient. Pages do not call fetch themselves."],
    files: ["teacher-module/src/pages/", "teacher-module/src/hooks/", "teacher-module/src/lib/", "teacher-module/src/components/"],
  },
  {
    id: "teacher-page-map",
    title: "Teacher module: page map",
    repo: "teacher",
    family: "flow",
    summary: "Every screen and the ways a teacher moves between them.",
    source: String.raw`flowchart LR
  Home[index - landing] --> Join[join - sign up or sign in]
  Home --> Terms[terms / privacy / refund / contact]
  Join --> Onb[onboarding - profile]
  Join --> Workspace
  Onb --> Build[build - choose what to make]
  Build --> Workspace[workspace - topical paper]
  Build --> Full[full-portion - whole syllabus paper]
  Build --> Check[checking - AI marking]
  Build --> Custom[custom-plan / build-custom-plan]
  Workspace --> Billing[billing]
  Full --> Billing
  Check --> Billing
  Billing -->|Back to paper| Workspace
  Billing -->|Back to paper| Full
  Account[account] --> Billing
  Account --> Support[support]
  JoinInst[join-institute] --> Account`,
    related: ["c4-3-teacher-components", "teacher-billing-client-flow"],
    notes: ["Billing takes a returnTo address in the query string. It is accepted only if it starts with a single slash, so the page can never send a teacher to another site.", "The pages all live under teacher-module/src/pages; the proxy at pages/api/[...path].ts is the only server code."],
    files: ["teacher-module/src/pages/"],
  },
  {
    id: "teacher-provider-stack",
    title: "Teacher module: provider stack",
    repo: "teacher",
    family: "flow",
    summary: "The order in which _app.tsx wraps every page, and what each layer provides.",
    source: String.raw`flowchart TD
  EB[ErrorBoundary - catches render crashes] --> TM[ThemeModeProvider - light or dark]
  TM --> TSP[TeacherSessionProvider - who is signed in, access token]
  TSP --> BP[BillingProvider - plan, quota, download rights]
  BP --> OP[OfferProvider - timed discount offers]
  OP --> TP[ToastProvider - small messages]
  TP --> AG[AdGateProvider - free plan preview ads]
  AG --> Page[The page]
  AG --> HW[HelpWidget]
  AG --> CB[CookieConsentBanner]
  AG --> OFP[OfferPopup]`,
    related: ["c4-3-teacher-components", "state-auth-session-client"],
    notes: ["A provider sits above everything that reads it: billing needs the signed-in teacher, the ad gate needs both consent and the teacher.", "ThemeInjector inside the app sets the colours from the teacher's organisation theme, so an institute sees its own brand."],
    files: ["teacher-module/src/pages/_app.tsx", "teacher-module/src/lib/teacherSession.tsx", "teacher-module/src/lib/billingContext.tsx", "teacher-module/src/lib/adGate.tsx"],
  },
  {
    id: "teacher-api-client-flow",
    title: "Teacher module: how every API call is made",
    repo: "teacher",
    family: "flow",
    summary: "Token attached, one automatic refresh on 401, then retry once.",
    source: String.raw`flowchart TD
  A[Page or hook calls api.something] --> B[fetchWithTeacherAuth]
  B --> C[Add Authorization Bearer access token from memory]
  C --> D[fetchWithTimeout to /api/... on the same site]
  D --> E{Status}
  E -->|2xx| F[Return the data]
  E -->|401 and first try| G{Refresh already running?}
  G -->|yes| H[Wait for the same refresh]
  G -->|no| I[POST /teacher/auth/refresh with the cookie]
  H --> J{Refresh worked?}
  I --> J
  J -->|yes| K[Retry the original call once]
  J -->|no| L[Throw an auth error, session moves to signed out]
  K --> E
  E -->|other error| M[Throw an error with the server message]`,
    related: ["seq-token-refresh", "state-auth-session-client", "sec-token-lifecycle"],
    notes: ["Only one refresh runs at a time (teacherRefreshPromise), so ten calls that fail together share one refresh and the rotating refresh token is not used twice.", "The cookie is sent only for the auth paths (credentials include); all other calls omit credentials and rely on the bearer token.", "Calls have per-path timeouts from fetchTimeout.ts so a slow route cannot hang the page."],
    files: ["teacher-module/src/lib/apiClient.ts", "teacher-module/src/lib/fetchTimeout.ts"],
  },
  {
    id: "teacher-builder-flow",
    title: "Teacher module: building a topical paper, screen by screen",
    repo: "teacher",
    family: "flow",
    summary: "What a teacher sees and what the code does at each step, including resume, automatic advance and Continue.",
    source: String.raw`flowchart TD
  S[Open workspace] --> R{Saved draft?}
  R -->|local and fresh| R1[Restore from localStorage]
  R -->|none locally| R2[Ask the server for the draft]
  R -->|none anywhere| N[Start at choices]
  R1 --> G[draftRestoreAttempted = true]
  R2 --> G
  N --> G
  G --> NAV[Navigation may now choose the stage]
  NAV --> C[choices: syllabus, paper, topic]
  C --> E[easy bucket]
  E --> M[medium bucket]
  M --> H[hard bucket]
  H --> P[preview]
  E -->|bucket full| EC[Continue button and auto advance]
  M -->|bucket full| MC[Continue button and auto advance]
  EC --> M
  MC --> H
  P --> GEN[Generate]
  GEN --> OK{Allowed?}
  OK -->|yes| RES[Paper ready, open preview modal]
  OK -->|quota or plan| BILL[Billing page with returnTo]
  BILL -->|Back to paper| S`,
    related: ["state-worksheet-flow", "teacher-draft-persistence", "teacher-preview-modal-flow", "teacher-plan-gates"],
    notes: ["The draftRestoreAttempted flag exists because the resume rule used to run before the restore finished, which dropped people back at Easy.", "The prune effect that removes templates no longer approved does nothing until the template list has loaded, otherwise it would erase a good draft.", "Continue appears as soon as a bucket is full and goes to the next bucket still to fill, or on to the preview."],
    files: ["teacher-module/src/pages/workspace.tsx", "teacher-module/src/hooks/workspace/useWorkspaceStageNavigation.ts", "teacher-module/src/hooks/workspace/useLocalDraft.ts", "teacher-module/src/components/workspace/SelectionStages.tsx"],
  },
  {
    id: "teacher-full-portion-flow",
    title: "Teacher module: full portion paper",
    repo: "teacher",
    family: "flow",
    summary: "Choosing a mix across the whole syllabus, seeing coverage, and generating one paper.",
    source: String.raw`flowchart TD
  A[Open full-portion] --> B[useFullPortionCoverage: how many questions exist per topic]
  B --> C[Topic recipe cards: how many from each topic]
  C --> D[Quick mix dialog: auto fill]
  C --> E{Enough questions?}
  E -->|no| X[Exhaustion modal: warn, suggest fewer]
  E -->|yes| F[Generate: api.generateFullPortionPaper]
  F --> G{Allowed?}
  G -->|plan or quota| BILL[Billing, then Back to paper]
  G -->|yes| H[Generated preview]
  H --> I[Same preview modal: QP, MS, PDF preview]`,
    related: ["dfd-2-generation", "teacher-preview-modal-flow", "teacher-plan-gates"],
    notes: ["The exhaustion modal appears when a teacher has used up the fresh questions for a topic; it is the user-facing side of the exhaustion work.", "The server builds the mix; the browser sends the recipe and gets the paper back."],
    files: ["teacher-module/src/pages/full-portion.tsx", "teacher-module/src/hooks/fullPortion/", "teacher-module/src/components/fullPortion/"],
  },
  {
    id: "teacher-checking-flow",
    title: "Teacher module: AI checking of a student paper",
    repo: "teacher",
    family: "flow",
    summary: "Upload, check, report. The page-level view of the AI marking feature.",
    source: String.raw`flowchart TD
  A[Open checking] --> B[Choose the answer sheet file]
  B --> C[api.checkUploadedPaper: multipart upload]
  C --> D{Plan and quota ok?}
  D -->|no| BILL[Billing page]
  D -->|yes| E[Wait: marking runs on the server]
  E --> F[Marks and feedback per question]
  F --> G[api.downloadCheckReport: check-report.pdf]`,
    related: ["seq-ai-check-upload", "dfd-3-ai-marking", "dfd-2-checking"],
    notes: ["The report is fetched through the same authenticated client as everything else, so it needs a live session.", "The AI-check route has its own rate limit (15 a minute)."],
    files: ["teacher-module/src/pages/checking.tsx", "teacher-module/src/lib/apiClient.ts"],
  },
  {
    id: "teacher-billing-client-flow",
    title: "Teacher module: billing page and checkout",
    repo: "teacher",
    family: "flow",
    summary: "Plan cards, optional promo, Razorpay checkout, and the way back to the paper.",
    source: String.raw`flowchart TD
  A[Open billing, maybe with returnTo] --> B[Load plan, receipts, offers]
  B --> C{Action}
  C -->|Redeem promo| P[PromoRedeemBox then PromoCelebration]
  C -->|Choose plan| D[CheckoutPanel]
  C -->|Cancel plan| X[CancelPlanFlow]
  D --> E[Backend creates the order and the price]
  E --> F[Load checkout.razorpay.com script]
  F --> G[Razorpay window opens]
  G -->|paid| H[Send payment ids to the backend to verify]
  G -->|closed| I[Stay on billing]
  H --> J{Verified?}
  J -->|yes| K[Plan active, receipt shown]
  J -->|no| L[Error with support hint]
  K --> R{returnTo present?}
  P --> R
  R -->|yes| BP[Back to paper: resume the builder at the saved point]
  R -->|no| Z[Stay]`,
    related: ["seq-checkout-razorpay", "dfd-3-razorpay-activation", "dfd-3-price-and-order", "state-subscription"],
    notes: ["The price shown is the price the backend computed for the order; the browser never decides the amount.", "Back to paper uses the draft saved before the teacher left, so the builder resumes where it was."],
    files: ["teacher-module/src/pages/billing.tsx", "teacher-module/src/components/billing/CheckoutPanel.tsx", "teacher-module/src/components/billing/PromoRedeemBox.tsx", "teacher-module/src/components/billing/CancelPlanFlow.tsx"],
  },
  {
    id: "teacher-preview-modal-flow",
    title: "Teacher module: the paper preview modal",
    repo: "teacher",
    family: "flow",
    summary: "The four buttons on a finished paper and what each one shows for different plans.",
    source: String.raw`flowchart TD
  A[Paper ready, open modal] --> B[Buttons: QP, MS, PDF preview, Go back]
  B -->|QP| Q[Question paper]
  B -->|MS| M{Plan can download the mark scheme?}
  M -->|yes| M1[Mark scheme, PDF preview allowed]
  M -->|no| M2[msViewOnly: final answers on screen, PDF preview locked]
  M2 --> AD{Free plan?}
  AD -->|yes| AD1[AdGate ms_view: ad then unlock for this paper]
  AD -->|no| M3[Show the on-screen answers]
  AD1 --> M3
  B -->|PDF preview| PDF[Rendered PDF]
  B -->|Go back| BK[Return to the builder]`,
    related: ["teacher-plan-gates", "seq-ad-unlock", "seq-pdf-export"],
    notes: ["can_download_mark_scheme comes from the billing status. When it is false the answer view is on-screen only, so that view must be readable on a phone; the table widths are set for that.", "PDF preview is a toggle between the clean view and the actual PDF; when msViewOnly is true it is forced to the clean view."],
    files: ["teacher-module/src/components/workspace/PdfPreviewModal.tsx", "teacher-module/src/hooks/workspace/usePdfPreview.ts", "teacher-module/src/lib/adGate.tsx"],
  },
  {
    id: "teacher-draft-persistence",
    title: "Teacher module: how a half-built paper is saved",
    repo: "teacher",
    family: "flow",
    summary: "Two copies of the draft: one in the browser for instant resume, one on the server for other devices.",
    source: String.raw`flowchart TD
  A[Teacher changes a selection] --> B[useLocalDraft writes localStorage with savedAt]
  A --> C[useServerDraftSync waits, then PUT draft to the backend]
  C --> D[(teacher_worksheet_drafts)]
  R[Open workspace later] --> E{Local draft younger than max age?}
  E -->|yes| F[Use it, skip the network]
  E -->|no| G[api.getWorksheetDraft]
  G --> H{found?}
  H -->|yes| I[Rebuild selections from template codes still approved]
  H -->|no| J[Start empty]
  L[Sign out] --> K[Clear local builder drafts]`,
    related: ["teacher-builder-flow", "er-templates-worksheets"],
    notes: ["The server save is a convenience: errors are swallowed, the teacher never sees a failure toast for it.", "Saved template codes that are no longer approved are dropped silently when restoring."],
    files: ["teacher-module/src/hooks/workspace/useLocalDraft.ts", "teacher-module/src/hooks/workspace/useServerDraftSync.ts", "backend/app/models/draft.py"],
  },
  {
    id: "teacher-plan-gates",
    title: "Teacher module: what each plan can do",
    repo: "teacher",
    family: "flow",
    summary: "The checks the module makes before it lets a teacher generate, view or download.",
    source: String.raw`flowchart TD
  A[Teacher presses Generate or a download] --> B{Plan tier}
  B -->|free or trial| F1[Up to 5 questions a paper, ad before preview, no mark scheme download]
  B -->|monthly or quarterly| F2[No question cap, no mark scheme download]
  B -->|yearly| F3[No question cap, mark scheme download allowed]
  B -->|institute or custom| F4[Seats and features set per organisation]
  F1 --> Q{Quota left?}
  F2 --> Q
  F3 --> Q
  F4 --> Q
  Q -->|yes| OK[Proceed]
  Q -->|no| BILL[Billing page]`,
    related: ["teacher-preview-modal-flow", "dfd-3-quota-idempotency", "state-subscription"],
    notes: ["The browser only decides what to show. The backend checks the plan and quota again on every request, so hiding a button is never the only protection.", "The plan table in billing_service.py sets max_questions_per_paper (5 for free and trial, none for the paid plans) and can_download_mark_scheme (true for yearly only)."],
    files: ["teacher-module/src/lib/planCatalog.ts", "teacher-module/src/lib/workspaceBuilder.ts", "teacher-module/src/lib/billingContext.tsx", "backend/app/services/entitlements.py"],
  },
];
