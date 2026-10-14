# Mi Cocina

App personal de recetas, conversión a Thermomix TM7, menú semanal y lista de la compra. Especificación completa en [CLAUDE.md](CLAUDE.md).

## Desarrollo local

```bash
cp .env.example .env.local   # y rellena los valores
npm install
npm run dev                  # http://localhost:3000
```

## Configuración de Supabase

1. Ejecuta las migraciones de `supabase/migrations/` en orden (SQL Editor del panel).
2. Authentication → Users → **Add user** con el email de `ALLOWED_EMAIL`.
3. Authentication → Sign In / Providers → desactiva **Allow new users to sign up**.
4. Authentication → URL Configuration: `Site URL` = URL de producción; en **Redirect URLs** añade `http://localhost:3000/**` y `https://<tu-dominio>/**`.
5. Authentication → Emails → **Magic Link**: usa la plantilla de abajo (el enlace funciona aunque se abra en otro navegador, y el código sirve para entrar desde la PWA).

```html
<h2>Entrar en Mi Cocina</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Entrar</a></p>
<p>O escribe este código en la app: <strong>{{ .Token }}</strong></p>
```

## Fotos de las recetas

Las recetas sin foto muestran una imagen de relleno (color e icono según el plato). La foto propia se sube desde el formulario de la receta.

## Despliegue

Vercel conectado al repo de GitHub, con las variables de `.env.example` configuradas en el proyecto.

## Instalar en el móvil (PWA)

- **Android / Chrome**: menú ⋮ → *Instalar aplicación* (o el aviso que aparece abajo).
- **iPhone / Safari**: botón compartir → *Añadir a pantalla de inicio*.
- **Ordenador (Chrome)**: icono de instalar en la barra de direcciones.

La app necesita conexión: no guarda datos sin conexión. El inicio de sesión desde la app instalada se hace con el **código de 6 dígitos** del correo (el enlace se abre en el navegador).
