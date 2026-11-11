# AUDIT

| ID | File | Issue | Severity | Status |
|---|---|---|---|---|
| AUD-001 | src/components/dashboard/SoftLockModal.tsx | Payment proof upload ignored errors, used fake Unsplash fallback image, and reported fake success on DB insert failure. | P0 | FIXED |
| AUD-002 | src/pages/AdminPage.tsx | Payment approval called RPC without checking errors and gave fake success; receipt preview failed with 404 on private bucket paths. | P0 | FIXED |
| AUD-003 | src/pages/MachineDetailPage.tsx | Relationship ambiguity on profiles join failed to load real owner phone, falling back to dummy phone and breaking WhatsApp leads. | P0 | FIXED |
| AUD-004 | src/pages/MarketplacePage.tsx | loadSupabaseMachines did not flag error state when query failed on slow/dropped networks. | P1 | OPEN |
| AUD-005 | src/pages/AuthPage.tsx | Password minimum length validation lacked inline status indicator on mobile. | P2 | OPEN |
| AUD-006 | src/components/machines/MachineStepperModal.tsx | Ephemeral blob: URLs stored in machine.images instead of uploading compressed photos to Supabase Storage bucket machine-images. | P0 | FIXED |
| AUD-007 | src/pages/DashboardOverviewPage.tsx, src/pages/BookingsPage.tsx | Booking status transitions updated state without checking Supabase { error }, showing fake success on failure. | P1 | FIXED |
| AUD-008 | src/components/dashboard/SoftLockModal.tsx, src/components/dashboard/PaymentProofModal.tsx | Receipts > 5MB taken on phone cameras were hard-blocked instead of client-side compressed via compressImage. | P2 | FIXED |
