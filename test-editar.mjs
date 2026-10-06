// Pruebas de movEditar (editar monto/cuenta/fecha/categoria de un gasto o ingreso) contra un Firestore
// SIMULADO, con el txDinero REAL de la Casa extraido de index.html. Correr: node test-editar.mjs
import fs from 'fs';
const HTML = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const NS = 'casa', C_GASTOS = 'casa_gastos', C_INGRESOS = 'casa_ingresos';

// ── Firestore falso (mismo molde que mi-cartera/test-dinero.mjs) ──
let SERVIDOR = {};
const clon = o => JSON.parse(JSON.stringify(o));
const doc = (db, ...p) => ({ path: p.join('/') });
function mergeProfundo(viejo, nuevo) {
  const r = { ...viejo };
  for (const k in nuevo) { const v = nuevo[k];
    r[k] = (v && typeof v === 'object' && !Array.isArray(v) && r[k] && typeof r[k] === 'object' && !Array.isArray(r[k])) ? mergeProfundo(r[k], v) : v; }
  return r;
}
let forzarConflicto = 0;
async function runTransaction(db, cb, opts) {
  for (let intento = 0; intento < (opts?.maxAttempts || 5); intento++) {
    const escrituras = []; let leyoDespues = false;
    const tx = {
      get: async ref => { if (escrituras.length) leyoDespues = true; const d = SERVIDOR[ref.path]; return { exists: () => d !== undefined, data: () => clon(d) }; },
      set: (ref, data, o) => {
        // Firestore real truena con undefined: la prueba tambien
        if (JSON.stringify(data, (k, v) => v === undefined ? '__UNDEF__' : v).includes('__UNDEF__')) throw new Error('undefined en set');
        escrituras.push({ t: 'set', ref, data, merge: !!(o && o.merge) }); },
      update: (ref, data) => escrituras.push({ t: 'update', ref, data }),
      delete: ref => escrituras.push({ t: 'del', ref })
    };
    const r = await cb(tx);
    if (leyoDespues) throw new Error('VIOLACION: se leyo despues de escribir');
    if (r && r.error) return r;
    if (forzarConflicto > 0) { forzarConflicto--; continue; }
    for (const w of escrituras) {
      if (w.t === 'del') delete SERVIDOR[w.ref.path];
      else if (w.merge) SERVIDOR[w.ref.path] = mergeProfundo(SERVIDOR[w.ref.path] || {}, w.data);
      else SERVIDOR[w.ref.path] = clon(w.data);
    }
    return r;
  }
  throw new Error('demasiados reintentos');
}

// ── funciones REALES de la app ──
function funcion(nombre) {
  const a = HTML.indexOf('function ' + nombre + '(');
  if (a < 0) throw new Error('no encontrada: ' + nombre);
  let d = 0, i = HTML.indexOf('{', a);
  for (; i < HTML.length; i++) { if (HTML[i] === '{') d++; else if (HTML[i] === '}') { d--; if (!d) break; } }
  return HTML.slice(a, i + 1);
}
const tomar = (ini, fin) => { const a = HTML.indexOf(ini), b = HTML.indexOf(fin, a); if (a < 0 || b < 0) throw new Error('no ' + ini); return HTML.slice(a, b); };
const CUENTAS = { efectivo: 'efectivo', nu: 'debito BBVA', tarjeta: 'credito BBVA' };
const state = { ingresos: [], aportes: [], aporteInicio: '' };
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const cuerpo = tomar('const REF_SALDOS', '// aplica a memoria el resultado CANONICO');
const { txDinero } = new Function('db','datosCargados','doc','runTransaction','setSyncDot','CUENTAS','movSinEfecto','NS','state',
  cuerpo + '\nreturn { txDinero };')({}, true, doc, runTransaction, () => {}, CUENTAS,
  new Function(funcion('movSinEfecto') + '\nreturn movSinEfecto;')(), NS, state);
if (!cuerpo.includes('movEditar')) throw new Error('el txDinero de la Casa no trae movEditar');

let ok = 0, mal = 0;
const chk = (n, c, det = '') => { c ? ok++ : mal++; console.log((c ? '  PASA  ' : '  FALLA ') + n + (c ? '' : '  -> ' + det)); };
const S = NS + '/saldos', T = NS + '/tarjeta', G = C_GASTOS + '/g1', I = C_INGRESOS + '/i1';
const ef = () => SERVIDOR[S].efectivo, nu = () => SERVIDOR[S].nuSaldo, tj = () => SERVIDOR[T].deuda;
const gasto = (monto, fuente, extra = {}) => ({ cat: 'Comida', monto, nota: 'x', fuente, registradoPor: 'Beto', fecha: '2026-10-01T00:00:00Z', creado: '2026-10-01T18:00:00Z', ...extra });
const CAMPO = { efectivo: 'efectivo', nu: 'nuSaldo' };
// arma el plan EXACTAMENTE como lo hace guardarEdicionMov (slots = campos de saldos; tarjeta por tarjetaDelta)
function editar(path, tipo, cA, mA, cD, mD, datos, extra = {}) {
  const plan = { permitirNegativo: true, permitirDeudaNegativa: true,
    movEditar: { ref: { path }, signo: tipo === 'gasto' ? 1 : -1, antes: { slot: CAMPO[cA] || null, monto: mA }, despues: { slot: CAMPO[cD] || null, monto: mD }, datos }, ...extra };
  if (tipo === 'gasto') { const d = (cD === 'tarjeta' ? mD : 0) - (cA === 'tarjeta' ? mA : 0); if (Math.round(d * 100) !== 0) plan.tarjetaDelta = Math.round(d * 100) / 100; }
  return txDinero(plan);
}
const meta = { editadoPor: 'Eli', editado: '2026-10-06T10:00:00Z' };

console.log('\nEditar monto y cuenta (Casa)');
let r;
// 1 misma cuenta, sube el monto
SERVIDOR = { [S]: { efectivo: 1000, nuSaldo: 500 }, [G]: gasto(100, 'efectivo') };
r = await editar(G, 'gasto', 'efectivo', 100, 'efectivo', 150, { ...meta, monto: 150, fuente: 'efectivo' }, { verificarIguales: [{ ref: { path: G }, campos: { monto: 100, fuente: 'efectivo' } }] });
chk('1 gasto 100 -> 150 en efectivo saca 50 mas', r.ok && ef() === 950 && nu() === 500, JSON.stringify(r));
chk('1 conserva registradoPor y pone editadoPor', SERVIDOR[G].registradoPor === 'Beto' && SERVIDOR[G].editadoPor === 'Eli' && SERVIDOR[G].nota === 'x' && SERVIDOR[G].creado === '2026-10-01T18:00:00Z');
// 2 cambio de cuenta
SERVIDOR = { [S]: { efectivo: 1000, nuSaldo: 500 }, [G]: gasto(100, 'efectivo') };
r = await editar(G, 'gasto', 'efectivo', 100, 'nu', 100, { ...meta, monto: 100, fuente: 'nu' });
chk('2 efectivo -> debito: efectivo +100, debito -100', r.ok && ef() === 1100 && nu() === 400, JSON.stringify(SERVIDOR[S]));
// 3 equivale a borrar + crear
SERVIDOR = { [S]: { efectivo: 1000, nuSaldo: 500 }, [G]: gasto(120, 'efectivo') };
await editar(G, 'gasto', 'efectivo', 120, 'nu', 80, { ...meta, monto: 80, fuente: 'nu' });
const editado = { ...SERVIDOR[S] };
SERVIDOR = { [S]: { efectivo: 1000, nuSaldo: 500 }, [G]: gasto(120, 'efectivo') };
await txDinero({ requerirDocs: [{ path: G }], borrar: [{ path: G }], deltas: { efectivo: 120 }, permitirNegativo: true });
await txDinero({ deltas: { nuSaldo: -80 }, permitirNegativo: true, crear: [{ ref: { path: G }, data: gasto(80, 'nu') }] });
chk('3 editar deja los mismos saldos que borrar y volver a crear', editado.efectivo === ef() && editado.nuSaldo === nu(), JSON.stringify(editado) + ' vs ' + JSON.stringify(SERVIDOR[S]));
// 4 tarjeta
SERVIDOR = { [S]: { efectivo: 1000 }, [T]: { deuda: 300, movimientos: [] }, [G]: gasto(100, 'efectivo') };
r = await editar(G, 'gasto', 'efectivo', 100, 'tarjeta', 100, { ...meta, monto: 100, fuente: 'tarjeta' });
chk('4 efectivo -> tarjeta: efectivo +100, deuda +100', r.ok && ef() === 1100 && tj() === 400, 'ef ' + ef() + ' deuda ' + tj());
SERVIDOR = { [S]: { efectivo: 1000 }, [T]: { deuda: 300, movimientos: [] }, [G]: gasto(100, 'tarjeta') };
r = await editar(G, 'gasto', 'tarjeta', 100, 'efectivo', 100, { ...meta, monto: 100, fuente: 'efectivo' });
chk('4b tarjeta -> efectivo: deuda -100, efectivo -100', r.ok && ef() === 900 && tj() === 200, 'ef ' + ef() + ' deuda ' + tj());
SERVIDOR = { [S]: { efectivo: 1000 }, [T]: { deuda: 300, movimientos: [{ x: 1 }] }, [G]: gasto(100, 'tarjeta') };
r = await editar(G, 'gasto', 'tarjeta', 100, 'tarjeta', 250, { ...meta, monto: 250, fuente: 'tarjeta' });
chk('4c tarjeta 100 -> 250: deuda +150, saldos intactos, historial de la tarjeta intacto', r.ok && tj() === 450 && ef() === 1000 && SERVIDOR[T].movimientos.length === 1, 'deuda ' + tj());
// 5 pendiente del Atajo: solo datos
SERVIDOR = { [S]: { efectivo: 1000 }, [T]: { deuda: 300, movimientos: [] }, [G]: gasto(100, 'efectivo', { porAtajo: true, pendiente: true }) };
r = await editar(G, 'gasto', 'efectivo', 100, 'tarjeta', 250, { ...meta, monto: 250, fuente: 'tarjeta' });
chk('5 pendiente del Atajo: saldos y deuda intactos', r.ok && r.movAplicaba === false && ef() === 1000 && tj() === 300, 'ef ' + ef() + ' deuda ' + tj());
chk('5 los datos si cambian y las banderas del Atajo se conservan', SERVIDOR[G].monto === 250 && SERVIDOR[G].fuente === 'tarjeta' && SERVIDOR[G].pendiente === true && SERVIDOR[G].porAtajo === true);
// 5b Atajo con porAtajo y sin aplicadoSaldo (movSinEfecto de la Casa lo cuenta sin efecto)
SERVIDOR = { [S]: { efectivo: 1000 }, [G]: gasto(100, 'efectivo', { porAtajo: true }) };
r = await editar(G, 'gasto', 'efectivo', 100, 'efectivo', 130, { ...meta, monto: 130, fuente: 'efectivo' });
chk('5b porAtajo sin aplicadoSaldo: no toca saldos (igual que movSinEfecto)', r.ok && ef() === 1000 && SERVIDOR[G].monto === 130);
// 6 verificarIguales aborta
SERVIDOR = { [S]: { efectivo: 1000 }, [G]: gasto(130, 'efectivo') };
r = await editar(G, 'gasto', 'efectivo', 100, 'efectivo', 150, { ...meta, monto: 150, fuente: 'efectivo' }, { verificarIguales: [{ ref: { path: G }, campos: { monto: 100, fuente: 'efectivo' } }] });
chk('6 si otro aparato cambio el monto, aborta sin escribir', !!r.error && ef() === 1000 && SERVIDOR[G].monto === 130, JSON.stringify(r));
SERVIDOR = { [S]: { efectivo: 1000 }, [G]: gasto(100, 'efectivo', { pendiente: false, aplicadoSaldo: true, porAtajo: true }) };
r = await editar(G, 'gasto', 'efectivo', 100, 'efectivo', 150, { ...meta, monto: 150, fuente: 'efectivo' }, { verificarIguales: [{ ref: { path: G }, campos: { monto: 100, fuente: 'efectivo', pendiente: true, aplicadoSaldo: undefined } }] });
chk('6b banderas del Atajo distintas a las vistas: aborta', !!r.error && /cambió en otro aparato/.test(r.error) && ef() === 1000, JSON.stringify(r));
SERVIDOR = { [S]: { efectivo: 1000 }, [G]: gasto(100, 'efectivo', { nota: 'otra' }) };
r = await editar(G, 'gasto', 'efectivo', 100, 'efectivo', 150, { ...meta, monto: 150, fuente: 'efectivo', nota: 'mia' }, { verificarIguales: [{ ref: { path: G }, campos: { monto: 100, fuente: 'efectivo', nota: 'x' } }] });
chk('6c nota cambiada en otro aparato y editada aqui: aborta', !!r.error && SERVIDOR[G].nota === 'otra' && ef() === 1000, JSON.stringify(r));
// 7 ya no existe
SERVIDOR = { [S]: { efectivo: 1000 } };
r = await editar(G, 'gasto', 'efectivo', 100, 'efectivo', 150, { ...meta, monto: 150, fuente: 'efectivo' });
chk('7 ya borrado: aborta y no lo resucita', !!r.error && ef() === 1000 && SERVIDOR[G] === undefined, JSON.stringify(r));
// 8 rechazado
SERVIDOR = { [S]: { efectivo: 1000, nuSaldo: 500 }, [G]: gasto(100, 'efectivo', { porAtajo: true, pendiente: false, aplicadoSaldo: false }) };
const antes8 = JSON.stringify(SERVIDOR);
r = await editar(G, 'gasto', 'efectivo', 100, 'nu', 150, { ...meta, monto: 150, fuente: 'nu' });
chk('8 rechazado por el Atajo en el servidor: aborta con mensaje y no escribe', !!r.error && /rechazado/.test(r.error) && JSON.stringify(SERVIDOR) === antes8, JSON.stringify(r));
// 9 reintentos
SERVIDOR = { [S]: { efectivo: 1000 }, [G]: gasto(100, 'efectivo') };
forzarConflicto = 2;
r = await editar(G, 'gasto', 'efectivo', 100, 'efectivo', 300, { ...meta, monto: 300, fuente: 'efectivo' });
chk('9 con dos reintentos solo se saca la diferencia una vez', r.ok && ef() === 800, 'ef ' + ef());
// 10 ingreso (signo -1)
SERVIDOR = { [S]: { efectivo: 1000, nuSaldo: 500 }, [I]: { cat: 'Mes papá', monto: 400, destino: 'efectivo', dePapa: true, registradoPor: 'Toño', fecha: '2026-10-01T00:00:00Z' } };
r = await editar(I, 'ingreso', 'efectivo', 400, 'nu', 350, { ...meta, monto: 350, destino: 'nu' });
chk('10 ingreso 400 efectivo -> 350 debito: efectivo -400, debito +350', r.ok && ef() === 600 && nu() === 850, JSON.stringify(SERVIDOR[S]));
chk('10 ingreso conserva registradoPor y dePapa', SERVIDOR[I].registradoPor === 'Toño' && SERVIDOR[I].dePapa === true && SERVIDOR[I].editadoPor === 'Eli');
// 11 cuenta en rojo permitida
SERVIDOR = { [S]: { efectivo: 50 }, [G]: gasto(10, 'efectivo') };
r = await editar(G, 'gasto', 'efectivo', 10, 'efectivo', 100, { ...meta, monto: 100, fuente: 'efectivo' });
chk('11 subir un gasto que deja la cuenta en rojo se registra', r.ok && ef() === -40 && r.saldos.efectivo === -40, JSON.stringify(r));
// 12 movEditado fusionado con lo del servidor
SERVIDOR = { [S]: { efectivo: 1000 }, [G]: gasto(100, 'efectivo', { porAtajo: true, pendiente: false, aplicadoSaldo: true }) };
r = await editar(G, 'gasto', 'efectivo', 100, 'efectivo', 160, { ...meta, monto: 160, fuente: 'efectivo' });
chk('12 movEditado trae banderas del servidor + lo escrito', r.ok && r.movAplicaba === true && r.movEditado.aplicadoSaldo === true && r.movEditado.porAtajo === true && r.movEditado.monto === 160 && r.movEditado.registradoPor === 'Beto', JSON.stringify(r.movEditado));
// 13 datos sin cat/nota/fecha no los tocan
SERVIDOR = { [S]: { efectivo: 1000 }, [G]: gasto(100, 'efectivo', { cat: 'Casa', nota: 'corregida en otro aparato', fecha: '2026-10-02T00:00:00Z' }) };
r = await editar(G, 'gasto', 'efectivo', 100, 'efectivo', 120, { ...meta, monto: 120, fuente: 'efectivo' });
chk('13 cat, nota y fecha del servidor quedan intactas', r.ok && SERVIDOR[G].cat === 'Casa' && SERVIDOR[G].nota === 'corregida en otro aparato' && SERVIDOR[G].fecha === '2026-10-02T00:00:00Z');
// 14 mismo monto y misma cuenta (solo metadatos con dinero en plan): no escribe saldos
SERVIDOR = { [S]: { efectivo: 1000 }, [G]: gasto(100, 'efectivo') };
r = await editar(G, 'gasto', 'efectivo', 100, 'efectivo', 100, { ...meta, monto: 100, fuente: 'efectivo' });
chk('14 neto cero: saldos intactos y no revienta', r.ok && ef() === 1000);
// 15 cuenta desconocida (legada) como origen: no revierte nada, aplica lo nuevo
SERVIDOR = { [S]: { efectivo: 1000 }, [G]: gasto(100, 'gbm') };
r = await editar(G, 'gasto', 'gbm', 100, 'efectivo', 100, { ...meta, monto: 100, fuente: 'efectivo' });
chk('15 desde cuenta legada: solo saca de la nueva', r.ok && ef() === 900);

console.log('\nMovimiento SIN cuenta (legado o del Atajo, sin fuente/destino): nunca viaja undefined');
// antes.slot = null: nunca afecto ninguna cuenta, no se revierte nada
const sinCta = (monto, extra = {}) => ({ cat: 'Comida', monto, nota: 'x', registradoPor: 'Beto', fecha: '2026-10-01T00:00:00Z', ...extra });
const igualesSin = { monto: 100, fuente: undefined, pendiente: undefined, aplicadoSaldo: undefined };
SERVIDOR = { [S]: { efectivo: 1000, nuSaldo: 500 }, [G]: sinCta(100) };
let truena = false;
try { await editar(G, 'gasto', undefined, 100, 'efectivo', 150, { ...meta, monto: 150, fuente: undefined }); } catch (e) { truena = /undefined/.test(e.message); }
chk('16 control: el simulador rechaza un undefined en datos', truena);
SERVIDOR = { [S]: { efectivo: 1000, nuSaldo: 500 }, [G]: sinCta(100) };
r = await editar(G, 'gasto', undefined, 100, 'efectivo', 150, { ...meta, monto: 150, fuente: 'efectivo' }, { verificarIguales: [{ ref: { path: G }, campos: igualesSin }] });
chk('16 gasto sin fuente + eligen efectivo: saca 150 y no devuelve nada', r.ok && ef() === 850 && nu() === 500 && SERVIDOR[G].fuente === 'efectivo', JSON.stringify(r));
SERVIDOR = { [S]: { efectivo: 1000 }, [T]: { deuda: 300, movimientos: [] }, [G]: sinCta(100) };
r = await editar(G, 'gasto', undefined, 100, 'tarjeta', 100, { ...meta, monto: 100, fuente: 'tarjeta' });
chk('16b gasto sin fuente + eligen tarjeta: deuda +100 y efectivo intacto', r.ok && tj() === 400 && ef() === 1000, 'ef ' + ef() + ' deuda ' + tj());
SERVIDOR = { [S]: { efectivo: 1000, nuSaldo: 500 }, [I]: { cat: 'Mes papá', monto: 400, dePapa: true, registradoPor: 'Toño', fecha: '2026-10-01T00:00:00Z' } };
r = await editar(I, 'ingreso', undefined, 400, 'nu', 300, { ...meta, monto: 300, destino: 'nu' });
chk('16c ingreso sin destino + eligen debito: suma 300 solo ahi, efectivo intacto', r.ok && nu() === 800 && ef() === 1000 && SERVIDOR[I].dePapa === true, JSON.stringify(SERVIDOR[S]));
SERVIDOR = { [S]: { efectivo: 1000 }, [G]: sinCta(100, { porAtajo: true, pendiente: true }) };
r = await editar(G, 'gasto', undefined, 100, undefined, 200, { ...meta, monto: 200 });
chk('16d pendiente del Atajo sin cuenta: cambia el monto, saldos intactos, sin campo fuente', r.ok && ef() === 1000 && SERVIDOR[G].monto === 200 && !('fuente' in SERVIDOR[G]), JSON.stringify(SERVIDOR[G]));
SERVIDOR = { [S]: { efectivo: 1000, nuSaldo: 500 }, [G]: sinCta(100, { fuente: 'nu' }) };
r = await editar(G, 'gasto', undefined, 100, 'efectivo', 150, { ...meta, monto: 150, fuente: 'efectivo' }, { verificarIguales: [{ ref: { path: G }, campos: igualesSin }] });
chk('16e otro aparato ya le asigno cuenta: aborta sin mover saldos', !!r.error && ef() === 1000 && SERVIDOR[G].fuente === 'nu', JSON.stringify(r));
// el codigo REAL de la pantalla
const iG = HTML.indexOf('window.guardarEdicionMov = async function'), cuerpoG = HTML.slice(iG, HTML.indexOf('\n};', iG));
chk('16f guardarEdicionMov arma datos sin undefined y exige cuenta si hay efecto', /if\(cuenta\) datos\[campo\]=cuenta/.test(cuerpoG) && !/const datos=\{[^}]*\[campo\]:cuenta/.test(cuerpoG) && /if\(!cuenta && !movSinEfecto\(it\)\)\{ showToast\(/.test(cuerpoG));
const iE = HTML.indexOf('window.editarMovimiento = function'), cuerpoE = HTML.slice(iE, HTML.indexOf('\n};', iE));
chk('16g editarMovimiento no agrega pastilla para una cuenta ausente', /if \(it\[campo\] && !opciones\.includes\(it\[campo\]\)\) opciones\.unshift/.test(cuerpoE) && /sin cuenta registrada/.test(cuerpoE));
const textoEfecto = new Function('CUENTAS', 'fmt', 'c2', 'Object', funcion('textoEfectoEdit') + '\nreturn textoEfectoEdit;')(CUENTAS, n => '$' + n, n => Math.round(n * 100) / 100, Object);
const t1 = textoEfecto('gasto', undefined, 100, 'efectivo', 150), t2 = textoEfecto('ingreso', undefined, 100, 'nu', 150), t3 = textoEfecto('gasto', undefined, 100, 'tarjeta', 150);
chk('16h el texto del efecto sin cuenta original no dice undefined', !/undefined|null/.test(t1 + t2 + t3) && /saca \$150/.test(t1) && /suma \$150/.test(t2) && /sube \$150/.test(t3), [t1, t2, t3].join(' | '));

console.log('\nSnapshots que llegan con el candado de dinero puesto: se encolan y se drenan al liberar');
{
  const cb = {}; const llamadas = []; let cargados = true;
  const nuevaPantalla = () => new Function('db', 'doc', 'onSnapshot', 'NS', 'state', 'refrescar', 'render', 'renderDeudas', 'renderPersonaSelect', 'aplicarAportes', 'renderPapa', 'renderAporte', 'setSyncDot', 'datosCargados',
    tomar('let unsubs=[];', '// un movimiento del atajo que NO llego') + '\n' + funcion('liberarDinero') +
    '\nsuscribirEnVivo();\nreturn { liberar: liberarDinero, ocupar: () => { dineroOcupado = true; }, estaOcupado: () => dineroOcupado, pendientes: () => snapsPendientes.size };')
    .call(null, {}, (db, ...p) => ({ path: p.join('/'), id: p[p.length - 1] }), (ref, fn) => { cb[ref.path] = fn; return () => {}; }, NS, st2, (...f) => llamadas.push('pinta'), () => {}, () => {}, () => {}, () => {}, () => {}, () => {}, () => {}, cargados);
  const st2 = { efectivo: 100, nuSaldo: 50, tarjetaDeuda: 0, tarjetaMovimientos: [], personas: {} };
  // (st2 se usa por referencia: se declara antes de invocar nuevaPantalla)
  const snap = d => ({ exists: () => d !== undefined, data: () => d });
  // el codigo ejecutable viene del mismo bloque: dineroOcupado y snapsPendientes viven dentro del Function
  const p = nuevaPantalla();
  p.ocupar();
  cb[NS + '/saldos'](snap({ efectivo: 777, nuSaldo: 1 }));
  chk('17 con el candado puesto el snapshot NO se aplica todavia', st2.efectivo === 100 && p.pendientes() === 1);
  cb[NS + '/saldos'](snap({ efectivo: 888, nuSaldo: 2 }));
  cb[NS + '/tarjeta'](snap({ deuda: 40, movimientos: [] }));
  chk('17b solo se guarda el ULTIMO por documento (dos docs = dos pendientes)', p.pendientes() === 2);
  // la transaccion propia deja su resultado (aplicarRes) ANTES de liberar; el drenaje va despues
  st2.efectivo = 500;
  p.liberar();
  chk('17c al liberar se aplican los snapshots descartados, DESPUES del resultado propio', st2.efectivo === 888 && st2.nuSaldo === 2 && st2.tarjetaDeuda === 40 && !p.estaOcupado() && p.pendientes() === 0, JSON.stringify(st2));
  p.liberar();
  chk('17d liberar sin pendientes no hace nada raro', st2.efectivo === 888);
  cb[NS + '/saldos'](snap({ efectivo: 999, nuSaldo: 3 }));
  chk('17e sin candado el snapshot se aplica directo', st2.efectivo === 999 && p.pendientes() === 0);
}
// todos los llamadores sueltan el candado por liberarDinero (ninguno lo deja en false a pelo)
chk('17f solo liberarDinero baja dineroOcupado (declaracion + funcion = 2 apariciones)', (HTML.match(/dineroOcupado=false/g) || []).length === 2, String((HTML.match(/dineroOcupado=false/g) || []).length));
chk('17g en guardarEdicionMov aplicarRes va ANTES que liberarDinero', cuerpoG.indexOf('aplicarRes(res)') > 0 && cuerpoG.indexOf('aplicarRes(res)') < cuerpoG.indexOf('liberarDinero(); }'));

console.log('\nIngreso de papa editado: lo que aporta papa y su arrastre se recalculan');
const extra = ['parseFechaLocal','msFechaMov','movSinEfecto','movValido'].map(funcion).join('\n');
const bloque = tomar('const CAT_PAPA =', 'const CATS_INGRESO_DEFAULT') + tomar('const normCatTxt =', '// "Mes papá" siempre primero') + tomar('const RE_MES=', 'const txtDepositos=');
const papa = (st, hoyISO) => { const Real = Date, fijo = new Real(hoyISO);
  class D extends Real { constructor(...a) { if (a.length === 0) super(fijo.getTime()); else super(...a); } static now() { return fijo.getTime(); } }
  return new Function('state', 'MESES', 'Date', extra + '\n' + bloque + '\nreturn {cuentaPapa};')(st, MESES, D); };
const ing = (fecha, monto, ex = {}) => ({ id: 'i' + monto, cat: 'Mes papá', dePapa: true, destino: 'efectivo', fecha, monto, ...ex });
let st = { aportes: [{ desde: '2026-09', monto: 1000 }], aporteInicio: '2026-09', ingresos: [ing('2026-09-05T15:00:00.000Z', 1000)] };
let p = papa(st, '2026-10-10T12:00:00');
chk('papa antes: septiembre justo, arrastre 0', p.cuentaPapa().arrastre === 0);
// editar el MONTO con la plomeria real: el servidor deja el doc fusionado y la pantalla lo aplica a memoria
SERVIDOR = { [S]: { efectivo: 0 }, [I]: { cat: 'Mes papá', monto: 1000, destino: 'efectivo', dePapa: true, fecha: '2026-09-05T15:00:00.000Z' } };
r = await editar(I, 'ingreso', 'efectivo', 1000, 'efectivo', 1200, { ...meta, monto: 1200, destino: 'efectivo' });
Object.assign(st.ingresos[0], r.movEditado);
chk('editar monto de 1000 a 1200: el saldo sube 200 y el arrastre pasa a +200 sin escribir nada de papa', ef() === 200 && p.cuentaPapa().arrastre === 200, 'arr ' + p.cuentaPapa().arrastre);
// editar la FECHA a otro mes: deja de contar en septiembre
Object.assign(st.ingresos[0], { fecha: '2026-10-02T00:00:00Z', monto: 1000 });
chk('mover la fecha a octubre: septiembre queda faltando 1000 y octubre lo recibe', p.cuentaPapa().arrastre === -1000 && p.cuentaPapa().dado === 1000, JSON.stringify(p.cuentaPapa().arrastre));
// editar la CATEGORIA: sale de papa (dePapa=false) y vuelve
Object.assign(st.ingresos[0], { fecha: '2026-09-05T15:00:00.000Z', cat: 'Renta cuarto', dePapa: false });
chk('categoria fuera de Mes papa + dePapa false: ya no cuenta', p.cuentaPapa().arrastre === -1000);
Object.assign(st.ingresos[0], { cat: 'Mes papá', dePapa: true });
chk('categoria de vuelta a Mes papa: vuelve a contar', p.cuentaPapa().arrastre === 0);
// un ingreso VIEJO (sin dePapa) con otra categoria cuenta como de papa; editar solo el monto NO le inventa dePapa
const viejo = { cat: 'Otros', monto: 1000, destino: 'efectivo', fecha: '2026-09-05T15:00:00.000Z' };
SERVIDOR = { [S]: { efectivo: 0 }, [I]: viejo };
r = await editar(I, 'ingreso', 'efectivo', 1000, 'efectivo', 1100, { ...meta, monto: 1100, destino: 'efectivo' });
chk('ingreso viejo sin dePapa: editar monto no escribe dePapa', !('dePapa' in SERVIDOR[I]) && SERVIDOR[I].monto === 1100);

console.log(`\nTODO ${ok}/${ok + mal}`);
process.exit(mal ? 1 : 0);
