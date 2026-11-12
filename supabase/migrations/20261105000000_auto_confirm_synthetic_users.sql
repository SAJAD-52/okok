-- JADIJCB: Auto-confirm existing users
-- NOTE: auth.users.confirmed_at is a GENERATED column on Supabase and cannot be
-- written. Only email_confirmed_at is updated. The BEFORE INSERT trigger that was
-- here is removed (the next migration drops it anyway).
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email_confirmed_at IS NULL;
