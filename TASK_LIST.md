# 📋 Walk In Again Physiotherapy — Project Task List & Architecture Roadmap

**Application Name:** Walk In Again PHYSIOTHERAPY  
**Tagline:** Move Better. Live Stronger.  
**Tech Stack:** Angular 18 (Standalone, Signals, SCSS, Reactive Forms), Firebase 10 (Auth, Firestore, Cloud Storage), Razorpay SDK  
**Theme:** Professional Medical-Tech (Deep Navy `#0B2545`, Aqua Accent `#136F63`, Coral `#E05A47`, Ice Blue `#EEF4F8`)

---

## 📊 High-Level Status Summary

| Phase | Module | Status | Progress |
| :--- | :--- | :---: | :---: |
| **Phase 1** | Foundation & Design System | ✅ Completed | 100% |
| **Phase 2** | Auth & Role-Based Access (M-PIN) | ✅ Completed | 100% |
| **Phase 3** | Worker / Physiotherapist Portal | ✅ Completed | 100% |
| **Phase 4** | Patient Mobile-First Portal | ✅ Completed | 100% |
| **Phase 5** | Admin Web Dashboard & Analytics | ✅ Completed | 100% |
| **Phase 6** | Firebase Cloud Firestore & Rules | 🔄 Configured / Ready | 90% |
| **Phase 7** | Razorpay Integration & Receipts | 🟡 Configured / Test Mode | 85% |
| **Phase 8** | Testing, PWA & Production Deployment | ⏳ Pending | 40% |

---

## 🛠️ Phase Breakdown & Deliverables

### Phase 1: Foundation & Design System
- [x] Angular 18 Standalone setup with Angular Signals
- [x] SCSS Design Tokens (`_variables.scss`, `_mixins.scss`, `styles.scss`)
- [x] Responsive layout breakpoints (Mobile 375px/430px up to Desktop 1920px)
- [x] Glassmorphism cards, micro-animations, and custom scrollbars
- [x] Clean standalone routing architecture (`app.routes.ts`)

---

### Phase 2: Authentication & M-PIN System
- [x] Mobile number & 4/6 digit M-PIN Login screen (`login.component.ts/html/scss`)
- [x] Role-Based Dynamic Routing:
  - Admin (`role === 'admin'`) ➔ `/admin/dashboard`
  - Worker/Physio (`role === 'worker'`) ➔ `/worker/dashboard`
  - Patient (`role === 'patient'`) ➔ `/patient/home`
- [x] Role Guards (`admin.guard.ts`, `worker.guard.ts`, `patient.guard.ts`)
- [x] M-PIN Security:
  - Client-side validation & masked input fields
  - Quick demo role switcher for development & testing
  - SHA-256 / bcrypt hashing contract prepared for backend validation

---

### Phase 3: Worker / Physiotherapist Mobile Web App
- [x] **Worker Shell & Bottom Navigation** (`worker-shell.component.ts`)
- [x] **Worker Dashboard** (`worker-dashboard.component.ts`):
  - Daily session counter & earnings badge
  - Quick stats (Completed, Remaining, Total Today)
  - Quick actions ("Start New Session", "Search Patient", "History")
- [x] **Patient Search & Directory** (`patient-search.component.ts`):
  - Instant debounced search by Name, Phone, or Patient ID
  - Patient detail card with previous diagnosis and completed sessions
- [x] **Active Session Tracking** (`active-session.component.ts`):
  - Exercise timer with Start, Pause, Resume, and Reset controls
  - Interactive Pain Scale selector (1 to 10 with visual color gradient & emoji cues)
  - Treatment notes & progress evaluation input
- [x] **Session Completion & Billing Flow**:
  - Razorpay checkout trigger modal
  - Cash / UPI / Card payment recording
  - Instant WhatsApp receipt dispatch trigger (`wa.me` deep link with pre-filled message)
- [x] **Worker Session History** (`session-history.component.ts`)

---

### Phase 4: Patient Mobile-First App
- [x] **Patient Shell & Bottom Navigation** (`patient-shell.component.ts`)
- [x] **Patient Home View** (`patient-home.component.ts`):
  - Treatment progress circular indicator (SVG progress ring with dynamic stroke offset)
  - Upcoming session card with date, time, and assigned physiotherapist
  - Quick access actions (Book Session, Exercises, Invoices, Support)
- [x] **My Sessions** (`my-sessions.component.ts`):
  - Segmented filter tabs (`All`, `Completed`, `Pending`)
  - Detailed session card with doctor remarks and exercise guidelines
- [x] **Payment History** (`payment-history.component.ts`):
  - Transaction list with payment method badges (UPI, Card, Cash)
  - Interactive Bottom Sheet Modal for invoice breakdown & Razorpay transaction IDs

---

### Phase 5: Admin Web Dashboard & Analytics
- [x] **Admin Shell with Collapsible Sidebar** (`admin-shell.component.ts`)
- [x] **KPI Metrics Overview**:
  - Total Patients, Active Workers, Total Sessions, Total Revenue with % growth indicators
- [x] **Revenue Analytics**:
  - Responsive Bar Chart (This Month vs. Last Month performance)
  - Payment Methods Donut Chart (UPI / Card / Cash distribution)
- [x] **Real-time Session Monitoring Table**:
  - Recent transactions, patient names, assigned worker, amount, and payment status
- [x] **Top Performing Workers Leaderboard**:
  - Ranking badges, total sessions completed, and rating indicators

---

### Phase 6: Firebase Backend & Security Rules
- [x] Firebase SDK 10 integration configured via `app.config.ts`
- [x] Organization credentials configured in `src/environments/environment.ts`
- [x] Firestore Models (`patient.model.ts`, `session.model.ts`, `transaction.model.ts`, `user.model.ts`)
- [x] Generic `FirestoreService` (`create`, `get`, `update`, `delete`, `query`)
- [ ] Deploy Firestore Security Rules:
  - Role-based read/write access enforcement
  - Workers restricted to their own session notes
  - Patients can only read their own sessions and bills
- [ ] Firestore Composite Indexes configuration:
  - `sessions` collection: `workerId ASC, status ASC, scheduledAt DESC`
  - `transactions` collection: `patientId ASC, createdAt DESC`

---

### Phase 7: Razorpay & External Integrations
- [x] Razorpay Checkout JS dynamically loaded in `PaymentService`
- [x] Test Key ID (`rzp_test_T0ghGBsIrMwMjX`) and Secret wired in environment
- [x] WhatsApp Receipt Generator formatted with patient name, amount, date, and invoice ID
- [ ] Backend Webhook handler for Razorpay `payment.captured` verification (Firebase Cloud Functions)
- [ ] Auto-upload generated PDF invoices to Firebase Cloud Storage

---

### Phase 8: Testing, Hardening & Deployment
- [x] Angular 18 production build optimization (`ng build`)
- [x] Dev server verification on port 4200
- [ ] PWA Manifest & Service Worker for offline mobile app installation
- [ ] Unit & Component Tests for core services
- [x] Firebase Hosting deployment (`https://walkin-physio.web.app`)
- [x] Capacitor Android native project setup & standalone Debug APK generation (`walkin-physio.apk`)

---

## 📂 Key File Map

| Path | Purpose |
| :--- | :--- |
| `src/environments/environment.ts` | Firebase & Razorpay Credentials |
| `src/app/core/services/auth.service.ts` | M-PIN Authentication & User State |
| `src/app/core/services/payment.service.ts` | Razorpay SDK wrapper & WhatsApp receipts |
| `src/app/core/services/session.service.ts` | Session timers, status transitions, Firestore sync |
| `src/app/admin/dashboard/` | Admin KPI & analytics dashboard |
| `src/app/worker/active-session/` | Exercise timer & pain score tracker |
| `src/app/patient/home/` | Patient recovery progress ring & upcoming session |
