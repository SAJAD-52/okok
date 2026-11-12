# PROGRESS

## DONE
- Created `docs/BRIEF.md`, `docs/AUDIT.md`, `docs/PROGRESS.md`.
- Completed Iteration 1 audit across Owner journey, Customer journey, and Admin journey (FOCUS: all).
- Fixed all P0 issues from Iteration 1:
  - AUD-001: Enforced strict upload and database error handling in `SoftLockModal.tsx`, eliminated fake fallback images, and ensured honest error reporting.
  - AUD-002: Enforced verified database execution on payment approval in `AdminPage.tsx`, removed fake success toast on RPC failure, and added signed URL generation for private receipt image preview.
  - AUD-003: Fixed PostgREST relationship ambiguity in `MachineDetailPage.tsx` to reliably load the owner's real phone number for direct WhatsApp leads.
- Completed Iteration 2 (FOCUS: owner, signup -> machine -> lead -> pay -> unlock):
  - AUD-006 (P0): Uploaded compressed machine photos directly to Supabase Storage `machine-images` bucket in `MachineStepperModal.tsx` and saved public permanent URLs instead of temporary blob: URLs.
  - AUD-007 (P1): Checked Supabase `{ error }` and synced SQLite server backend in `DashboardOverviewPage.tsx` and `BookingsPage.tsx` before updating status, preventing fake success toasts and rollback on failure.
  - AUD-008 (P2 - REVENUE LENS): Client-side compressed receipt photos via `compressImage` in `SoftLockModal.tsx` and `PaymentProofModal.tsx`, eliminating 5MB mobile camera rejection and preventing payment drop-off on weak Moroccan 3G networks.
  - AUD-009 (P0 - REVENUE LENS): Resolved contractor booking disconnect (`CreateBookingModal.tsx`, `BookingsPage.tsx`, `DashboardOverviewPage.tsx`, `DashboardLayout.tsx`, `bookingStore.ts`, migration `20261111000000_fix_bookings_owner_rls.sql`). Guaranteed that bookings created by contractors (`entreprise`) immediately route to the true machine owner's dashboard with live counter badge and notification, eliminating UUID rejection and PostgREST schema mismatches.

## REMAINING
- AUD-004: Enhance network retry and explicit error states in `MarketplacePage.tsx` (P1).
- AUD-005: Mobile password validation indicator in `AuthPage.tsx` (P2).

## DECISIONS
- Signed URLs with 1-hour expiration are used to preview offline payment receipts in `payment-proofs` bucket without exposing public read access.
- When an owner's phone cannot be resolved on a machine, WhatsApp button targets WhatsApp direct message without placeholder fallback numbers to preserve trust.
- In `SoftLockModal` and `PaymentProofModal`, incoming receipt photos from mobile cameras are automatically compressed down to ~200-350KB before upload, removing file size friction for paying owners.
- Bookings created on machines strictly inherit the machine's true owner (`owner_id`) and allow owners to select and approve any booking for their machines via machine-level ownership join in Supabase RLS.
