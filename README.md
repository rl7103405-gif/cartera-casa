# Mi Cartera — cómo instalar tu propia copia

App de finanzas personales. Cada persona tiene **su propia copia**: su código, su base de
datos y su usuario. Nadie ve los datos de nadie.

Sigue estos 4 pasos en orden. Tardas ~20 minutos la primera vez.

---

## 1. Crea tu proyecto de Firebase (gratis)

1. Entra a <https://console.firebase.google.com> con tu cuenta de Google y da
   **"Crear un proyecto"**. Ponle el nombre que quieras (ej. `cartera-ana`).
   Puedes desactivar Google Analytics, no hace falta.
2. Dentro del proyecto, ve a **Compilación → Authentication → Comenzar**, elige
   **Correo electrónico/contraseña**, actívalo y guarda.
3. En la pestaña **Users** de Authentication, da **"Agregar usuario"**: pon el correo y la
   contraseña con los que vas a entrar a la app. **Ese correo es el que usarás abajo.**
4. Ve a **Compilación → Firestore Database → Crear base de datos**. Elige el modo de
   producción y la ubicación que te sugiera.
5. Ve a **Configuración del proyecto (engrane) → Tus apps → icono `</>` (Web)**, registra la
   app con cualquier apodo y copia el bloque `firebaseConfig` que te muestra: son 6 valores
   (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`).

## 2. Personaliza los archivos

En `index.html`, busca y reemplaza:

- El bloque `firebaseConfig` — pega los 6 valores del paso anterior en lugar de los
  `TU_API_KEY`, `TU_PROYECTO`, etc.
- `const ALLOWED_EMAIL = 'TU_CORREO@ejemplo.com';` — pon el correo del paso 1.3.

En `firestore.rules`, cambia `TU_CORREO@ejemplo.com` por ese mismo correo.

> Si quieres, también puedes ajustar tus metas del año en `index.html`:
> `const META_SAVINGS = 0, META_STOCKS = 0, META_FECHA = '2026-12-31'` (cuánto quieres tener
> ahorrado e invertido para esa fecha).

## 3. Publica las reglas de seguridad

Este paso es el que protege tus datos: sin él, cualquiera podría leerlos.

1. En Firebase, ve a **Firestore Database → Reglas**.
2. Borra lo que haya y pega el contenido completo de tu `firestore.rules` (ya con tu correo).
3. Da **Publicar**.

## 4. Sube la app a internet (GitHub Pages, gratis)

1. Crea una cuenta en <https://github.com> si no tienes.
2. Crea un repositorio **nuevo y público** (ej. `mi-cartera`).
3. Sube estos archivos: `index.html`, `manifest.json`, `sw.js`, `icon-192.png`,
   `icon-512.png`. Puedes arrastrarlos en la web de GitHub ("uploading an existing file").
   **Súbelos todos de una sola vez, en un solo commit.**
4. En el repo, ve a **Settings → Pages**, en "Source" elige **Deploy from a branch**, rama
   `main`, carpeta `/ (root)`, y guarda.
5. Espera ~1 minuto. Tu app queda en `https://TU-USUARIO.github.io/mi-cartera`.

## 5. Úsala

- Abre esa dirección en tu teléfono, inicia sesión con tu correo y contraseña.
- En iPhone: botón **Compartir → Agregar a inicio**. En Android: menú **⋮ → Instalar
  aplicación**. Queda como una app normal.
- Primero ve a **perfil** y captura tus datos (te sirve para tu calificación), luego a
  **inicio → actualizar saldos** para poner cuánto tienes en cada cuenta.

---

## Preguntas frecuentes

**¿Alguien más puede ver mis datos?**
No. Las reglas del paso 3 solo permiten leer y escribir a tu correo. El código es público
(está en GitHub), pero tus datos viven en tu base de datos privada.

**¿Es gratis?**
Sí. Firebase tiene una capa gratuita muy holgada para uso personal y GitHub Pages es gratis.

**¿Y si cambio de teléfono?**
Entras con tu mismo correo y ahí están todos tus datos.

**Esto no es un producto comercial**: es una app casera, sin garantías. Revisa tus números
contra las apps de tus bancos.
