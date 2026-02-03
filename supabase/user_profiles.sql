-- ==============================================
-- SQL para Sistema de Roles y Aprobación de Usuarios
-- Ejecutar en Supabase Dashboard > SQL Editor
-- ==============================================

-- 1. Crear tabla user_profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  username TEXT UNIQUE,
  roles TEXT[] DEFAULT ARRAY['pending']::TEXT[], -- Array de roles: 'pending', 'admin', 'produccion', 'ventas', etc.
  is_approved BOOLEAN DEFAULT FALSE,
  preferences JSONB DEFAULT '{}', -- UI preferences per user (sidebar, gantt settings, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MIGRACIÓN: Si ya tienes la tabla con 'role' como TEXT, ejecuta esto:
-- ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT ARRAY['pending']::TEXT[];
-- UPDATE user_profiles SET roles = ARRAY[role]::TEXT[] WHERE role IS NOT NULL AND roles IS NULL;
-- ALTER TABLE user_profiles DROP COLUMN IF EXISTS role;

-- 2. Habilitar Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de acceso
-- IMPORTANTE: Eliminar políticas existentes primero para evitar conflictos
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow authenticated read own" ON user_profiles;
DROP POLICY IF EXISTS "Allow authenticated users to read profiles" ON user_profiles;

-- Política simple: usuarios autenticados pueden leer su propio perfil
CREATE POLICY "Allow authenticated read own" ON user_profiles
  FOR SELECT 
  TO authenticated
  USING (auth.uid() = id);

-- Admins pueden leer todos los perfiles
-- (Usamos una subconsulta con SECURITY DEFINER en una función para evitar recursividad)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() AND 'admin' = ANY(roles)
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE POLICY "Admins can view all profiles" ON user_profiles
  FOR SELECT 
  TO authenticated
  USING (is_admin());

-- Los admins pueden actualizar cualquier perfil
CREATE POLICY "Admins can update profiles" ON user_profiles
  FOR UPDATE 
  TO authenticated
  USING (is_admin());

-- Los admins pueden eliminar perfiles
CREATE POLICY "Admins can delete profiles" ON user_profiles
  FOR DELETE 
  TO authenticated
  USING (is_admin());

-- 4. Trigger para auto-crear perfil cuando un usuario se registra
-- Funciona para email/password Y para OAuth (Google)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, username)
  VALUES (
    NEW.id,
    -- Para Google OAuth, el nombre viene en 'name' o 'full_name'
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'email'
    ),
    -- Username: usar el proporcionado, o email, o generar uno
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      SPLIT_PART(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING; -- Si ya existe, no hacer nada
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger existente si hay
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Crear trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ==============================================
-- NOTA: Para crear el primer admin, ejecuta esto 
-- después de registrar el usuario admin:
-- 
-- UPDATE user_profiles 
-- SET role = 'admin', is_approved = TRUE 
-- WHERE username = 'TU_USERNAME_ADMIN';
-- ==============================================
