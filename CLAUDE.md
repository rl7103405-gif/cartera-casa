# Mi Cartera — plantilla

PWA de finanzas personales para **una sola persona**, pensada para clonarse: cada usuario
tiene su propia copia del código y su propio proyecto de Firebase. Sin datos de nadie
precargados.

## Stack

- **HTML/CSS/JS puro en un solo `index.html`.** Sin frameworks, sin build, sin npm.
- **Firebase Firestore** (sincronización) y **Firebase Authentication** (email/password).
- Se publica tal cual en GitHub Pages.
- Archivos: `index.html`, `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png`,
  `firestore.rules`.

## Antes de usarla: 3 cosas que hay que personalizar

1. `index.html` → `firebaseConfig`: los 6 valores del proyecto de Firebase propio.
2. `index.html` → `ALLOWED_EMAIL`: el correo que puede entrar.
3. `firestore.rules` → el mismo correo, y publicar las reglas en Firebase.

Ver `README.md` para el paso a paso completo.

## Qué trae

- **Inicio**: patrimonio total, tarjetas por cuenta, "cómo vas este mes", actualizar saldos,
  transferencias, tarjetas de crédito, registro de compras de acciones, temas de color.
- **Movimientos**: alta de gastos/ingresos e historial filtrable por tipo y periodo.
- **Metas**: metas de fin de año, proyección "camino a diciembre" y apartados de ahorro.
- **Perfil**: foto, datos personales, estándar financiero personalizado y calificación de hábitos.
- **Noticias**: titulares de tus acciones y de bancos vía RSS público.
- **Deudas**: quién te debe y a quién le debes, con historial por persona.
- **Resumen**: cierre del mes/año con coach, utilidades ("cuánto ganó tu dinero"), pasteles
  interactivos, categorías y gráficas de evolución.

## Conceptos centrales del código

- `calcCompoundAt(base, fechaStr, tasaPct, ms)`: interés compuesto diario (tasa nominal /365,
  días calendario completos). **Toda** cuenta que genere rendimiento pasa por aquí; nunca
  hardcodear un monto fijo por día.
- `parseFechaLocal()` / `hoyLocal()` / `msFechaMov()`: manejo de fechas en horario local para
  evitar el clásico bug de que `YYYY-MM-DD` se lea como UTC y muestre el día anterior.
- **Patrón de escritura**: mutación optimista + `writeBatch`/`runTransaction` + rollback en
  `catch` con `backupCuentas()`/`restoreCuentas()`. Si agregas un campo nuevo al estado que
  se mute en un flujo, agrégalo también al respaldo.
- `calcularCierre()` es un **modelo puro** (no toca el DOM); `textoCoach()`/`textoAnalisis()`
  generan texto; `cierreMesHTML()` pinta. No mezclar esas capas.
- `ESTANDARES` + `estandarDe(perfil)`: única fuente de umbrales financieros (ahorro objetivo,
  gasto máximo, meses de emergencia). Coach, cierre, racha y score los consumen; no
  hardcodear porcentajes sueltos.
- **Cuentas**: hoy están fijas en el código (`CUENTAS`, campos del `state`). Volverlas
  configurables por usuario es el siguiente paso planeado de esta plantilla.

## Reglas de trabajo

1. **Un solo commit por tanda de cambios** — GitHub Pages atasca su cola de deploys si se
   suben varios commits seguidos.
2. Si cambias `sw.js`, **sube también la versión de `CACHE`** para invalidar el caché viejo.
3. `ALLOWED_EMAIL` es solo un gate de UI: la seguridad real está en `firestore.rules`.
4. Validar siempre lo que viene de Firestore (`Number.isFinite`, arrays, regex) — un dato
   corrupto no debe romper la app ni propagar `NaN` a los saldos.
5. Escapar con `escapeHtml()` cualquier texto del usuario que se interpole en HTML.
