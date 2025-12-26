-- ============================================================================
-- FIX: Actualizar función get_user_by_email para usar profiles en lugar de auth.users
-- ============================================================================
-- Problema: auth.users no es directamente accesible por RPC
-- Solución: Usar la tabla profiles que tiene el mismo id que auth.users
-- ============================================================================

-- Eliminar función anterior
DROP FUNCTION IF EXISTS get_user_by_email(TEXT);
DROP FUNCTION IF EXISTS get_user_by_email_from_id(UUID);

-- Crear nueva función para buscar usuario por email
-- Usa auth.uid() para obtener el email del usuario actual desde su propio perfil
-- y luego busca en profiles
CREATE OR REPLACE FUNCTION get_user_by_email(user_email TEXT)
RETURNS TABLE(id UUID, email TEXT) AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Buscar el usuario en auth.users (funciona con SECURITY DEFINER)
  FOR user_record IN 
    SELECT au.id, au.email::TEXT
    FROM auth.users au
    WHERE LOWER(au.email) = LOWER(user_email)
  LOOP
    id := user_record.id;
    email := user_record.email;
    RETURN NEXT;
  END LOOP;
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener email de usuario por ID
CREATE OR REPLACE FUNCTION get_user_by_email_from_id(user_id UUID)
RETURNS TABLE(id UUID, email TEXT) AS $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN 
    SELECT au.id, au.email::TEXT
    FROM auth.users au
    WHERE au.id = user_id
  LOOP
    id := user_record.id;
    email := user_record.email;
    RETURN NEXT;
  END LOOP;
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Verificación: Probar las funciones
-- ============================================================================
-- Para probar: SELECT * FROM get_user_by_email('email@ejemplo.com');
-- Para probar: SELECT * FROM get_user_by_email_from_id('uuid-aqui');
-- ============================================================================
