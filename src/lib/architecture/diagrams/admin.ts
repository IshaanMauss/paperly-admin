import type { Diagram } from "../types";

// Admin panel diagrams, written from paperly-admin-panel/src and the backend admin routes.
export const adminDiagrams: Diagram[] = [
  {
    id: "c4-3-admin-components",
    title: "C4 level 3: admin panel components",
    repo: "admin",
    family: "c4",
    level: 3,
    summary: "The admin panel is a Next.js app: pages, a shell that handles navigation and access, a session library, and a server-side gateway that is its only door to the backend.",
    source: String.raw`flowchart TD
  subgraph Pages[pages/ - one per area]
    P1[teachers, user-360, organizations, users]
    P2[payments, billing, plans, offers, promo-codes]
    P3[paper-builders, checking, variant-health]
    P4[support, maintenance, backups, health, logs, run-tests]
    P5[security, audit-log]
    P6[database - owner only]
    P7[architecture - owner only]
  end
  Shell[AppShell - nav, owner filter, sign-in guard]
  subgraph Lib[lib/]
    AA[adminAuth.tsx - session, hasPermission]
    AT[adminToken.ts - token, one shared refresh]
    AC[apiClient.ts - calls and error text]
    AR[adminRefresh.ts - refresh-data signal]
    ARC[architecture/ - diagram catalog]
  end
  subgraph Comps[components/]
    C1[database/ - schema, SQL console, history]
    C2[user360/, templates/, review/, upload/]
    C3[architecture/DiagramViewer]
  end
  GW[pages/api/gateway - server proxy]
  CF[lib/server/cfAccess - Cloudflare Access check]
  BE[(Backend /api/admin/...)]
  Pages --> Shell
  Shell --> AA
  Pages --> AC
  AC --> AT
  AA --> AT
  Pages --> Comps
  P7 --> C3 --> ARC
  AC --> GW
  GW --> CF
  GW -->|adds gateway secret header| BE`,
    children: ["admin-page-map", "admin-gateway-flow", "admin-session-lifecycle", "admin-database-ui-flow", "admin-architecture-tab-flow"],
    related: ["c4-2-containers", "c4-3-admin-api-components"],
    notes: ["The browser only ever talks to its own origin at /api/gateway. The gateway secret lives in a server-only environment variable and never reaches browser code.", "Pages call permission checks (hasPermission) to hide controls, but the backend checks the same permission again on every request."],
    files: ["admin-panel/src/pages/", "admin-panel/src/components/AppShell.tsx", "admin-panel/src/lib/", "admin-panel/src/pages/api/gateway/[...path].ts"],
  },
  {
    id: "admin-page-map",
    title: "Admin panel: pages, groups and who can open them",
    repo: "admin",
    family: "flow",
    summary: "The sidebar groups and which areas need a special role.",
    source: String.raw`flowchart LR
  Login[login] --> Home[Overview]
  Home --> People
  Home --> Money
  Home --> Product
  Home --> Operations
  subgraph People
    U[Users] --- U3[User 360] --- O[Organizations] --- T[Admin Team]
  end
  subgraph Money
    Pay[Payments] --- Bil[Billing] --- Pl[Plans and Features] --- Of[Offers] --- Pr[Promo Codes]
  end
  subgraph Product
    PB[Paper Builders] --- CK[AI Checking] --- VH[Variant Health]
  end
  subgraph Operations
    Su[Support] --- Ma[Maintenance] --- Ba[Export and Backup] --- He[Health] --- Lo[Server Logs] --- RT[Run Tests] --- Se[Security] --- Au[Audit Log]
  end
  Ow{{Owner only}} --- DB[Database]
  Ow --- AR[Architecture]
  Operations --- Ow`,
    related: ["c4-3-admin-components", "sec-admin-rbac"],
    notes: ["Database and Architecture carry ownerOnly in the sidebar list and the page itself checks the role, so a typed address shows a notice instead of the content.", "The Database area is also enforced on the backend: every route there refuses anyone who is not the owner.", "Architecture is an owner-only page in the interface. Its diagrams are part of the panel's own code, not data from the backend, so it is a convenience screen and not a secret store."],
    files: ["admin-panel/src/components/AppShell.tsx", "admin-panel/docs/admin-pages-and-permissions.md"],
  },
  {
    id: "admin-gateway-flow",
    title: "Admin panel: the gateway in front of the backend",
    repo: "admin",
    family: "flow",
    summary: "The path every admin call takes, and the two locks on it: Cloudflare Access and the shared gateway secret.",
    source: String.raw`flowchart TD
  B[Browser calls /api/gateway/admin/...] --> M{ADMIN_BACKEND_URL set?}
  M -->|no| E1[503 gateway not configured]
  M -->|yes| V{Method allowed?}
  V -->|no| E2[405]
  V -->|yes| CFQ{CF_ACCESS_TEAM_DOMAIN and AUD set?}
  CFQ -->|yes| J{Valid Cloudflare Access token?}
  J -->|no| E3[403 sign in through the company login]
  J -->|yes| FW
  CFQ -->|no| FW[Build target URL, copy headers]
  FW --> S[Add the gateway secret header]
  S --> BE[(Backend)]
  BE --> RS[Rewrite Set-Cookie for this site]
  RS --> B`,
    related: ["c4-3-admin-components", "c4-2-containers", "sec-token-lifecycle"],
    notes: ["With both Cloudflare Access settings present, a request that did not come through Access is refused, so finding the raw hosting address gives no way around the login wall.", "The backend refuses admin calls that do not carry the gateway secret header, so a direct call to the backend also fails.", "The gateway rewrites cookies so the refresh cookie belongs to the panel's own site."],
    files: ["admin-panel/src/pages/api/gateway/[...path].ts", "admin-panel/src/lib/server/gatewayProxy.ts", "admin-panel/src/lib/server/cfAccess.ts", "admin-panel/docs/admin-gateway-setup.md"],
  },
  {
    id: "admin-session-lifecycle",
    title: "Admin panel: sign-in session in the browser",
    repo: "admin",
    family: "flow",
    summary: "How the panel keeps an admin signed in across reloads without asking for the password again.",
    source: String.raw`flowchart TD
  A[Page loads] --> B{Access token in this tab and not near expiry?}
  B -->|yes| C[Use it, state = signed in]
  B -->|no| D[One shared refresh with the refresh cookie]
  D --> E{Refresh accepted?}
  E -->|yes| F[Store the new token, read the admin from the response]
  E -->|no| G[Signed out, show login]
  F --> C
  C --> H[Calls carry the token]
  H -->|401| D
  C --> I[Sign out: clear token, revoke the refresh session]`,
    related: ["seq-admin-login", "sec-token-lifecycle", "sec-admin-rbac", "er-admin-platform"],
    notes: ["The access token is kept for the tab in sessionStorage and lives 15 minutes; the refresh token is a cookie and lives 14 days.", "Refresh is shared at module level, so a reload or several simultaneous calls cannot use the rotating refresh cookie twice.", "A token is rejected if its audience is not paperly-admin."],
    files: ["admin-panel/src/lib/adminAuth.tsx", "admin-panel/src/lib/adminToken.ts", "backend/app/services/admin_auth.py"],
  },
  {
    id: "admin-database-ui-flow",
    title: "Admin panel: the Database area, tab by tab",
    repo: "admin",
    family: "flow",
    summary: "What the owner sees: choose a database, browse, then run a statement through the guarded console.",
    source: String.raw`flowchart TD
  A[Open Database] --> O{Owner?}
  O -->|no| N[Notice: owner only]
  O -->|yes| T[Choose target: production or test]
  T --> TABS[Tabs]
  TABS --> OV[Overview: guard status, RLS, connection]
  TABS --> SB[Schema browser: tables and columns]
  TABS --> SQL[SQL console]
  TABS --> HI[History of runs]
  SQL --> R[Review statement]
  R --> BL{Blocked by the guard?}
  BL -->|yes| X[Reason shown, nothing runs]
  BL -->|no| DR[Dry run: risk, rows affected]
  DR --> RD{Read only?}
  RD -->|yes| RUN[Run]
  RD -->|no| CF[Type RUN ON PRODUCTION, then password]
  CF --> RUN
  RUN --> HI`,
    related: ["seq-admin-sql-run", "dfd-3-sql-console", "dfd-2-database-console"],
    notes: ["Write statements on production need the typed phrase and the account password; the review token lasts 5 minutes and is tied to the admin, the target and the exact statement.", "One statement at a time. A plain SQL update does not change updated_at unless the statement sets it."],
    files: ["admin-panel/src/pages/database.tsx", "admin-panel/src/components/database/", "backend/app/api/routes/admin_database.py", "backend/app/services/sql_console_guard.py"],
  },
  {
    id: "admin-architecture-tab-flow",
    title: "Admin panel: how the Architecture tab works",
    repo: "admin",
    family: "flow",
    summary: "This tab itself: diagrams are data in the panel's code, drawn in the browser by Mermaid.",
    source: String.raw`flowchart LR
  F[diagrams/*.ts - one entry per diagram] --> C[catalog.ts - ids, links, checks]
  C --> P[pages/architecture.tsx - search, filter, drill down]
  P --> V[DiagramViewer]
  V -->|import mermaid on first use| M[Mermaid, strict security level]
  M --> SVG[SVG shown with zoom and pan]
  T[catalog.test.ts] -->|fails the build on a broken link or id| C`,
    related: ["c4-3-admin-components"],
    notes: ["To add a diagram: add an entry in a file under diagrams, list it in its parent's children, run the tests. See docs/architecture-diagrams.md in the admin panel.", "Mermaid is loaded on demand so it adds nothing to pages that do not use it."],
    files: ["admin-panel/src/lib/architecture/", "admin-panel/src/pages/architecture.tsx", "admin-panel/src/components/architecture/DiagramViewer.tsx"],
  },
];
