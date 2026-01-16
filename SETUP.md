# Guía de Configuración para Nuevos Dispositivos

Para trabajar en este proyecto desde otro ordenador o con otra cuenta, sigue estos pasos:

## 1. Permisos de Colaborador (GitHub)
Si vas a usar una cuenta de GitHub diferente a la propietaria del repositorio (`ReyperAutomatizacion02`), necesitas darte acceso primero:
1. Inicia sesión en GitHub con la cuenta dueña (`ReyperAutomatizacion02`).
2. Ve a `Settings` > `Collaborators` en el repositorio.
3. Haz clic en "Add people" e invita a tu otra cuenta (nombre de usuario o email).
4. Acepta la invitación desde el correo electrónico de la otra cuenta.

## 2. Clonar el Repositorio
En el nuevo ordenador, abre una terminal y ejecuta:

```bash
git clone https://github.com/ReyperAutomatizacion02/Reyper-XYZ.git
cd Reyper-XYZ
```

## 3. Configurar Identidad (Git)
Si es la primera vez que usas Git en ese ordenador o quieres usar un nombre específico para este proyecto:

```bash
# Configuración global (para todos los proyectos)
git config --global user.name "Tu Nombre"
git config --global user.email "tucorreo@ejemplo.com"

# O configuración solo para este proyecto (ejecutar dentro de la carpeta Reyper-XYZ)
git config user.name "Tu Nombre"
git config user.email "tucorreo@ejemplo.com"
```

## 4. Gestión de Credenciales
Cuando intentes hacer `git push` por primera vez:
- Windows te pedirá iniciar sesión en la ventana emergente. Usa las credenciales de la **cuenta que tiene permisos** (la que invitate como colaborador).
- Si usas tokens de acceso personal (PAT), asegúrate de que el token tenga permisos de `repo`.

## 5. Flujo de Trabajo Básico
1. **Bajar cambios** antes de empezar: `git pull`
2. **Hacer cambios** en el código.
3. **Guardar cambios**:
   ```bash
   git add .
   git commit -m "Descripción de los cambios"
   ```
4. **Subir cambios**: `git push`
