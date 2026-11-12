-- JADIJCB: align chat tables (live DB uses participant_one/two, content, is_read)
-- with the app (participant_a/b, body, read_at). Both sets of columns are kept
-- in sync by triggers so old and new code paths work.

-- ---------- conversations ----------
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS participant_one uuid;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS participant_two uuid;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS participant_a uuid;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS participant_b uuid;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS machine_id uuid;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_message_at timestamptz DEFAULT now();
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

UPDATE public.conversations
SET participant_a = COALESCE(participant_a, participant_one),
    participant_b = COALESCE(participant_b, participant_two),
    participant_one = COALESCE(participant_one, participant_a),
    participant_two = COALESCE(participant_two, participant_b);

CREATE OR REPLACE FUNCTION public.sync_conversation_participants()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.participant_a   := COALESCE(NEW.participant_a, NEW.participant_one);
  NEW.participant_b   := COALESCE(NEW.participant_b, NEW.participant_two);
  NEW.participant_one := COALESCE(NEW.participant_one, NEW.participant_a);
  NEW.participant_two := COALESCE(NEW.participant_two, NEW.participant_b);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_conversation_participants ON public.conversations;
CREATE TRIGGER trg_sync_conversation_participants
  BEFORE INSERT OR UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.sync_conversation_participants();

-- ---------- messages ----------
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS body text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_at timestamptz;

UPDATE public.messages
SET body = COALESCE(body, content),
    content = COALESCE(content, body),
    read_at = CASE WHEN read_at IS NULL AND is_read IS TRUE THEN created_at ELSE read_at END;

CREATE OR REPLACE FUNCTION public.sync_message_columns()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.body    := COALESCE(NEW.body, NEW.content);
  NEW.content := COALESCE(NEW.content, NEW.body);
  IF NEW.read_at IS NOT NULL THEN NEW.is_read := true; END IF;
  IF NEW.is_read IS TRUE AND NEW.read_at IS NULL THEN NEW.read_at := now(); END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_message_columns ON public.messages;
CREATE TRIGGER trg_sync_message_columns
  BEFORE INSERT OR UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.sync_message_columns();

-- ---------- RLS: replace all existing policies on both tables ----------
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies
           WHERE schemaname = 'public' AND tablename IN ('conversations','messages')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

CREATE POLICY "conv_select" ON public.conversations FOR SELECT
  USING (auth.uid() IN (participant_a, participant_b, participant_one, participant_two) OR public.is_admin());
CREATE POLICY "conv_insert" ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() IN (participant_a, participant_b, participant_one, participant_two));
CREATE POLICY "conv_update" ON public.conversations FOR UPDATE
  USING (auth.uid() IN (participant_a, participant_b, participant_one, participant_two) OR public.is_admin());
CREATE POLICY "conv_delete" ON public.conversations FOR DELETE
  USING (public.is_admin());

CREATE POLICY "msg_select" ON public.messages FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.conversations c
            WHERE c.id = messages.conversation_id
              AND auth.uid() IN (c.participant_a, c.participant_b, c.participant_one, c.participant_two))
    OR public.is_admin());
CREATE POLICY "msg_insert" ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.conversations c
                WHERE c.id = conversation_id
                  AND auth.uid() IN (c.participant_a, c.participant_b, c.participant_one, c.participant_two)));
CREATE POLICY "msg_update" ON public.messages FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.conversations c
            WHERE c.id = messages.conversation_id
              AND auth.uid() IN (c.participant_a, c.participant_b, c.participant_one, c.participant_two)));
CREATE POLICY "msg_delete" ON public.messages FOR DELETE
  USING (sender_id = auth.uid() OR public.is_admin());

-- ---------- realtime ----------
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

NOTIFY pgrst, 'reload schema';
