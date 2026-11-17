// Candado antes de desplegar las reglas de Firestore (17-nov-2026). Corre como "predeploy" de firebase.json.
// Falla (salida 1) si firestore.rules:
//   1. no trae EXACTAMENTE una linea "&& request.auth.uid == uid" dentro de function soy;
//   2. no trae los cinco esRoberto/esZoe/esTono/esEli/esCasa llamando a soy('<uid de 28 caracteres>', '<correo>');
//   3. trae el comentario de COPIA PARA EMULADOR (la copia sin uid de las pruebas: nunca se despliega).
// Autocontenido: lee el firestore.rules que esta junto a este archivo, sin importar desde que carpeta lo corra firebase.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ruta = fileURLToPath(new URL('./firestore.rules', import.meta.url));
const texto = fs.readFileSync(ruta, 'utf8');
const errores = [];

if (/COPIA PARA EMULADOR/i.test(texto)) errores.push('trae el comentario "COPIA PARA EMULADOR": es la copia sin uid de las pruebas, no se despliega');

// cuerpo de function soy(...) { ... }
const m = texto.match(/function\s+soy\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*\}/);
if (!m) errores.push('no encuentro function soy(uid, correo)');
else {
  const n = (m[1].match(/^[ \t]*&& request\.auth\.uid == uid[ \t]*\r?$/gm) || []).length;
  if (n !== 1) errores.push(`function soy debe traer UNA linea "&& request.auth.uid == uid" y trae ${n}`);
}

for (const f of ['esRoberto', 'esZoe', 'esTono', 'esEli', 'esCasa']) {
  const re = new RegExp(String.raw`function\s+${f}\s*\(\)\s*\{\s*return\s+soy\('[A-Za-z0-9]{28}',\s*'[^'\s]+@[^'\s]+'\)\s*;\s*\}`);
  if (!re.test(texto)) errores.push(`${f}() debe ser: return soy('<uid de 28 caracteres>', '<correo>');`);
}

if (errores.length) {
  console.error('revisar-reglas: NO se despliega ' + ruta);
  for (const e of errores) console.error('  - ' + e);
  process.exit(1);
}
console.log('revisar-reglas: firestore.rules trae soy() con uid y los cinco pares');
