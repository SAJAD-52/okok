-- ============================================================================
-- JADIJCB: Performance Indexes for Fast Supabase Queries & Lower CPU/Egress
-- Migration: 20261117000000_performance_indexes.sql
-- ============================================================================

-- Machines indexes (owner fleet, marketplace filter/sort)
CREATE INDEX IF NOT EXISTS idx_machines_owner_created
  ON public.machines (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_machines_published_created
  ON public.machines (is_published, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_machines_published_category
  ON public.machines (is_published, category, listing_mode);

-- Bookings indexes (owner bookings, machine calendar/overlap, contractor bookings)
CREATE INDEX IF NOT EXISTS idx_bookings_owner_start
  ON public.bookings (owner_id, start_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_machine_status
  ON public.bookings (machine_id, status);

CREATE INDEX IF NOT EXISTS idx_bookings_client_created
  ON public.bookings (client_id, created_at DESC);

-- Conversations & Messages indexes (inbox load, unread badges, RLS joins)
CREATE INDEX IF NOT EXISTS idx_conversations_part_a_last
  ON public.conversations (participant_a, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_part_b_last
  ON public.conversations (participant_b, last_message_at DESC);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_conversations_part_one
    ON public.conversations (participant_one);
  CREATE INDEX IF NOT EXISTS idx_conversations_part_two
    ON public.conversations (participant_two);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_conv_created
  ON public.messages (conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_messages_unread_lookup
  ON public.messages (conversation_id, sender_id)
  WHERE read_at IS NULL;

-- Notifications & Dispatch indexes
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON public.notifications (user_id, is_read, created_at DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_dispatch_notifs_owner_status
    ON public.dispatch_notifications (owner_id, status, created_at DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_driver_offers_status_created
    ON public.driver_job_offers (status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_driver_offers_owner_created
    ON public.driver_job_offers (owner_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_driver_apps_offer_driver
    ON public.driver_job_applications (offer_id, driver_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
