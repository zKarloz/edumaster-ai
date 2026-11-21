-- Ejecutar después de crear el bucket PRIVADO profile-avatars en Storage.
-- Un archivo JPEG por identidad Auth: <uuid>/avatar.jpg. No se cambia Data API.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'profile-avatars' AND NOT public) THEN
    RAISE EXCEPTION 'Crea primero el bucket privado profile-avatars en Storage';
  END IF;
END $$;
DROP POLICY IF EXISTS edumaster_avatar_read ON storage.objects;
DROP POLICY IF EXISTS edumaster_avatar_insert ON storage.objects;
DROP POLICY IF EXISTS edumaster_avatar_update ON storage.objects;
DROP POLICY IF EXISTS edumaster_avatar_delete ON storage.objects;
CREATE POLICY edumaster_avatar_read ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'profile-avatars' AND name = (SELECT auth.uid())::text || '/avatar.jpg');
CREATE POLICY edumaster_avatar_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'profile-avatars' AND name = (SELECT auth.uid())::text || '/avatar.jpg');
CREATE POLICY edumaster_avatar_update ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'profile-avatars' AND name = (SELECT auth.uid())::text || '/avatar.jpg')
WITH CHECK (bucket_id = 'profile-avatars' AND name = (SELECT auth.uid())::text || '/avatar.jpg');
CREATE POLICY edumaster_avatar_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'profile-avatars' AND name = (SELECT auth.uid())::text || '/avatar.jpg');
COMMIT;
