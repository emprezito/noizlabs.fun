
CREATE TABLE public.sounds_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sound_id text NOT NULL,
  audio_hash text,
  audio_url text NOT NULL,
  token_name text,
  token_ticker text,
  token_address text,
  minted_by text,
  minted_at timestamp with time zone,
  status text NOT NULL DEFAULT 'available',
  reserved_by text,
  reserved_at timestamp with time zone,
  reservation_expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX sounds_registry_sound_id_idx ON public.sounds_registry (sound_id);
CREATE UNIQUE INDEX sounds_registry_audio_hash_idx ON public.sounds_registry (audio_hash) WHERE audio_hash IS NOT NULL;

ALTER TABLE public.sounds_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view sounds registry" ON public.sounds_registry FOR SELECT TO public USING (true);
CREATE POLICY "Only service role can insert sounds" ON public.sounds_registry FOR INSERT TO public WITH CHECK (false);
CREATE POLICY "Only service role can update sounds" ON public.sounds_registry FOR UPDATE TO public USING (false);
CREATE POLICY "Only service role can delete sounds" ON public.sounds_registry FOR DELETE TO public USING (false);

ALTER PUBLICATION supabase_realtime ADD TABLE public.sounds_registry;
