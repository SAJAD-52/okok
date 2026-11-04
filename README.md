# JADIJCB · منصة آليات البناء الثقيلة بالمغرب

> **Bilingual (Arabic-first RTL / French LTR) SaaS & B2B Marketplace for Heavy Construction Machinery Rental, Sale, and Spare Parts in Morocco.**

---

## 🏗️ Overview

**JADIJCB** connects Moroccan contractors, equipment owners, and spare parts distributors across all 12 regions of Morocco (Casablanca, Tangier, Marrakech, Rabat, Agadir, Fès, Oujda, etc.). It features digital lease management, instant quotes, operator and fuel terms, manual offline payment approval (RIB / Wafacash), and an interactive OpenStreetMap Leaflet machinery locator.

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS v3, React Router v6, TanStack Query, Zustand, react-i18next, Lucide React, Framer Motion, Leaflet.
- **Backend & Database**: Supabase (PostgreSQL 15, Auth, Row Level Security, Realtime, Storage).
- **CI/CD**: GitHub Actions automated database migration push on merge to `main`.

---

## 🔐 Phase 4: Authentication & Soft Lock Architecture

### 1. Synthetic Email Phone Authentication (Zero-SMS Approach)
In Morocco, the vast majority of equipment owners and civil engineering contractors operate on Android smartphones using mobile numbers (`06 XX XX XX XX`, `07 XX XX XX XX`, or `+212...`) without corporate email addresses. Standard Supabase phone authentication requires paid third-party SMS gateways (Twilio, MessageBird) which encounter high SMS costs and unpredictable delivery delays across Moroccan telecoms (Maroc Telecom, Orange, Inwi).

**Solution**:
1. Users enter **ONLY** their Moroccan phone number and password on `/auth`. No email field is ever shown in the UI.
2. The frontend normalizes any Moroccan phone variation (`06...`, `07...`, `+212...`, spaces/dashes) to E.164 format: `+2126XXXXXXXX` or `+2127XXXXXXXX`.
3. Internally, the phone number is mapped to a deterministic synthetic email: `<digits>@users.jadijcb.app` (e.g., `212661234567@users.jadijcb.app`).
4. The user authenticates against Supabase `auth.signUp` / `auth.signInWithPassword`.
5. The real E.164 phone number is stored in `user_metadata.phone` and automatically synchronized to `public.profiles.phone` via PostgreSQL trigger `handle_new_user()`.

### 2. 72-Hour Free Trial & Welcome Modal
- Upon account creation, the database assigns `subscription_status = 'trial'` with `trial_ends_at = now() + interval '72 hours'`.
- A celebratory `WelcomeModal` pops in using a Framer Motion spring animation with confetti-style particles, displaying a live preview countdown (`72:00:00`) and guiding new users to `/app/onboarding` or `/app`.

### 3. Live Trial Countdown & Urgent Banner
- The `useSubscription` hook tracks real-time expiry, updating every second.
- `TrialBanner` renders at the top of the dashboard. When under 6 hours remain, it automatically switches to an urgent red alert state with an "Activate subscription" button.

### 4. Non-Dismissible Soft Lock & Data Safety
- When the trial ends and no payment is approved, `isLocked` becomes `true`.
- The dashboard view is blurred (`backdrop-blur-md pointer-events-none`) behind a non-dismissible `SoftLockModal`.
- **Zero Data Loss**: Existing machinery listings, bookings, and chat records remain 100% intact and visible. Write actions (creating new machines or modifying listings) are disabled in the UI and blocked at the database level by RLS via `is_subscription_active(auth.uid())`.
- Users are presented with Moroccan payment credentials:
  - **Attijariwafa Bank RIB**: `007 780 0001234567890123 45` with one-click copy.
  - **Wafacash / Cash Plus**: Beneficiary credentials and CIN.
  - **Proof Upload**: Uploads transfer receipt / screenshot directly to the Supabase Storage `payment-proofs` bucket and logs the record in `public.payments`.
  - **WhatsApp Direct Assistance**: Prefilled WhatsApp link to the admin helpline (`+212661234567`) for instant review.

### 5. Admin Console (`/admin`)
- Accessible to users with `role = 'admin'`.
- Lists pending payments with proof image preview, reference numbers, and user phone numbers.
- Search contractors and owners by Moroccan phone number.
- Allows admins to approve payments with custom durations (1, 3, 6, or 12 months) via the secure RPC function `approve_payment(payment_id, months)`.

---

## 🚀 Deployment

### 1. GitHub Secrets Setup

To enable automated database migrations via `.github/workflows/supabase-db-deploy.yml`, configure the following Repository Secrets in **GitHub Repository → Settings → Secrets and variables → Actions → New repository secret**:

| Secret Name | Description | Where to find in Supabase |
| :--- | :--- | :--- |
| `SUPABASE_PROJECT_ID` | Reference ID of your Supabase Cloud project (e.g., `abcdefghijklmnopqrst`) | **Project Settings → General → General settings → Reference ID** (or in project URL `https://supabase.com/dashboard/project/<ref>`) |
| `SUPABASE_ACCESS_TOKEN` | Personal Access Token authorizing the Supabase CLI | **Supabase Dashboard → Account (bottom-left avatar) → Access Tokens → Generate new token** (Name: `github-actions-deploy`) |
| `SUPABASE_DB_PASSWORD` | PostgreSQL Database password set at project creation | Created when creating the project. If forgotten: **Project Settings → Database → Database password → Reset database password** |

### 2. Disable Email Confirmation (Recommended for Morocco Mobile Signups)

Most Moroccan contractors and equipment operators register with a phone number or work email and require zero-friction instant sign-in. To disable mandatory email confirmation:

1. Go to your **Supabase Dashboard**.
2. Select your project and navigate to **Authentication → Providers → Email**.
3. Scroll down to **Email Auth settings**.
4. Toggle **OFF** `Confirm email` (Enable Confirm email: Disabled).
5. Click **Save** at the bottom of the card.

Now new contractor and owner profiles will be activated immediately upon signup, initiating their automatic 72-hour trial subscription without waiting for email activation.

---

## 🗄️ Database Architecture & RLS Security

### Data Model
- `profiles`: Extends `auth.users` with Moroccan phone, company name, ICE identifier, role (`owner`, `client`, `admin`), 72-hour trial tracking, and preferred language (`ar` / `fr`).
- `machines`: Full bilingual listings for rent and sale with strict CHECK constraints (rent mandates hourly/daily/weekly rates; sale mandates price and condition).
- `bookings`: Machine reservation lifecycle with `btree_gist` exclusion constraint preventing overlapping active bookings for the same machine.
- `conversations` & `messages`: Real-time chat with logical replication enabled for instant field coordination.
- `payments`: Offline payments (bank transfer RIB or Wafacash voucher reference + deposit receipt screenshot).
- `storefronts`: Dedicated branded portal for verified machinery fleet owners (`jadijcb.ma/storefront/<slug>`).

---

## 🛠️ Local Development

```bash
# 1. Clone repository
git clone https://github.com/SAJAD-52/jcb.git
cd jcb

# 2. Install dependencies
npm install

# 3. Setup environment variables
cp .env.example .env.local

# 4. Start local development server
npm run dev
```

Server runs at `http://localhost:3000`.

---

## 📜 License

Proprietary © 2026 JADIJCB Maroc S.A.R.L. Tous droits réservés.