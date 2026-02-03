# Cómo Habilitar Leaked Password Protection en Supabase

## ¿Qué es?

**Leaked Password Protection** es una función de seguridad que verifica si las contraseñas que los usuarios intentan usar han sido comprometidas en filtraciones de datos conocidas. Supabase usa la base de datos de [HaveIBeenPwned.org](https://haveibeenpwned.com/) para esta verificación.

**Beneficio**: Previene que los usuarios usen contraseñas que ya fueron expuestas en hackeos públicos (como "123456", "password", etc.).

---

## Pasos para Habilitarlo

### 1. Ir al Dashboard de Supabase

1. Abre tu navegador
2. Ve a: https://supabase.com/dashboard
3. Inicia sesión con tu cuenta
4. Selecciona el proyecto **"Reyper XYZ"**

---

### 2. Navegar a Authentication Settings

1. En el menú lateral izquierdo, haz clic en **"Authentication"** (ícono de candado 🔒)
2. Luego haz clic en **"Policies"** o **"Password"** (dependiendo de la versión de Supabase)

**Ruta completa**: 
```
Dashboard → Authentication → Policies
```

O también puede estar en:
```
Dashboard → Authentication → Password
```

---

### 3. Habilitar la Protección

Busca la sección que dice:

**"Password Strength"** o **"Leaked Password Protection"**

Verás un toggle/switch que dice algo como:

- ✅ **"Check for leaked passwords"**
- ✅ **"Prevent use of compromised passwords"**
- ✅ **"Enable HaveIBeenPwned integration"**

**Activa ese switch** (debe ponerse en verde/azul).

---

### 4. Guardar Cambios

1. Haz clic en el botón **"Save"** o **"Update"** al final de la página
2. Espera la confirmación (debería aparecer un mensaje de éxito)

---

## Verificación

Después de habilitarlo:

1. Ve a Supabase Dashboard → SQL Editor
2. Ejecuta:
   ```sql
   SELECT * FROM auth.config;
   ```
3. Busca una configuración relacionada con `password_leaked_check` o similar
4. Debería estar en `true` o `enabled`

**Alternativa más simple**: 
- Intenta registrar un nuevo usuario con una contraseña muy común como "password123"
- Debería rechazarla con un mensaje de error

---

## ¿Qué Pasa Después?

Una vez habilitado:

### ✅ Para Nuevos Usuarios
- Al registrarse, si intentan usar una contraseña comprometida, verán un error
- Ejemplo: "Esta contraseña ha sido expuesta en filtraciones de datos. Por favor usa otra."

### ✅ Para Usuarios Existentes
- No se ven afectados inmediatamente
- Solo se verifica cuando cambien su contraseña

### ✅ Sin Impacto en la App
- No requiere cambios en el código
- La validación se hace automáticamente en el backend de Supabase

---

## Captura de Pantalla de Referencia

La configuración se ve algo así:

```
┌─────────────────────────────────────────┐
│ Password Strength                        │
├─────────────────────────────────────────┤
│                                          │
│ Minimum password length: [8]             │
│                                          │
│ ☑ Require uppercase letters             │
│ ☑ Require lowercase letters             │
│ ☑ Require numbers                       │
│ ☑ Require special characters            │
│                                          │
│ ☑ Check for leaked passwords  ← AQUÍ    │
│   Prevent use of compromised passwords  │
│                                          │
│         [Cancel]  [Save Changes]         │
└─────────────────────────────────────────┘
```

---

## Troubleshooting

### No encuentro la opción

Si no ves la opción de "Leaked Password Protection":

1. **Verifica tu plan**: Esta función puede estar disponible solo en ciertos planes
2. **Actualiza la página**: A veces el dashboard necesita refrescarse
3. **Busca en "Password"**: Puede estar en una sección diferente dependiendo de la versión

### ¿Es obligatorio?

**No**, es opcional. El warning es solo una recomendación de buena práctica de seguridad.

**Pros de habilitarlo**:
- ✅ Mayor seguridad
- ✅ Protege a usuarios de usar contraseñas débiles
- ✅ Cumple con mejores prácticas de seguridad

**Contras**:
- ⚠️ Usuarios pueden frustrarse si su contraseña favorita está comprometida
- ⚠️ Requiere conexión a HaveIBeenPwned (mínimo impacto en performance)

---

## Resumen Rápido

1. Ve a: https://supabase.com/dashboard
2. Selecciona proyecto "Reyper XYZ"
3. Click en **Authentication** → **Policies** (o **Password**)
4. Activa el switch **"Check for leaked passwords"**
5. Click en **Save**
6. ✅ ¡Listo!

---

## Alternativa: Ignorar el Warning

Si decides no habilitarlo por ahora:

- El sistema seguirá funcionando perfectamente
- Es solo una recomendación de seguridad, no un error crítico
- Puedes habilitarlo más adelante cuando quieras

El warning desaparecerá una vez que lo habilites en el dashboard.
