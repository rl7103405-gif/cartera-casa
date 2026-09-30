// Pruebas de la aportación de papá (cuentaPapa y saneaAportes, extraídas del index.html real).
// Correr: node test-papa.mjs
import fs from 'fs';
const html=fs.readFileSync(new URL('./index.html', import.meta.url),'utf8');
const tomar=(ini,fin)=>{ const a=html.indexOf(ini), b=html.indexOf(fin,a); if(a<0||b<0) throw new Error('no '+ini); return html.slice(a,b); };
const bloque=tomar('const CAT_PAPA =','const CATS_INGRESO_DEFAULT')+tomar('const normCatTxt =','// "Mes papá" siempre primero')+tomar('const RE_MES=','const txtDepositos=');
const extra=['function parseFechaLocal','function msFechaMov','function movSinEfecto','function movValido'].map(n=>{ const a=html.indexOf(n); let d=0,i=html.indexOf('{',a); for(;i<html.length;i++){ if(html[i]==='{')d++; else if(html[i]==='}'){d--; if(!d)break;} } return html.slice(a,i+1); }).join('\n');
const MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
let ok=0,mal=0; const eq=(n,a,b)=>{ const p=JSON.stringify(a)===JSON.stringify(b); p?ok++:mal++; console.log((p?'✅':'❌')+' '+n+(p?'':'  obtuve '+JSON.stringify(a)+' esperaba '+JSON.stringify(b))); };
const hacer=(state,hoyISO)=>{ const RealDate=Date; const fijo=new RealDate(hoyISO);
  class D extends RealDate{ constructor(...a){ if(a.length===0) super(fijo.getTime()); else super(...a); } static now(){ return fijo.getTime(); } }
  const f=new Function('state','MESES','Date', extra+'\n'+bloque+'\nreturn {cuentaPapa,saneaAportes,cuotaDe,recibidoEnMes};');
  return f(state,MESES,D); };
const ing=(fecha,monto,extra={})=>({fecha,monto,...extra});
// 1) caso de Roberto: septiembre dio 30 de más → octubre le toca 30 menos
let st={aportes:[{desde:'2026-09',monto:54100}],aporteInicio:'2026-09',ingresos:[ing('2026-09-02T15:00:00.000Z',27000),ing('2026-09-16T15:00:00.000Z',27130)]};
let c=hacer(st,'2026-10-05T12:00:00').cuentaPapa();
eq('sep +30 → arrastre', c.arrastre, 30); eq('octubre le toca', c.leToca, 54070); eq('meses cerrados', c.meses.map(m=>[m.k,m.dif,m.n]), [['2026-09',30,2]]);
// 2) mismo, visto el 30-sep (mes en curso): sin arrastre, deMas 30
c=hacer(st,'2026-09-30T12:00:00').cuentaPapa();
eq('30-sep: sin meses cerrados', c.meses.length, 0); eq('30-sep deMas', c.deMas, 30); eq('30-sep pendiente', c.pendiente, 0);
// 3) faltante acumulado dos meses y cambio de monto en noviembre
st={aportes:[{desde:'2026-09',monto:54000},{desde:'2026-11',monto:60000}],aporteInicio:'2026-09',ingresos:[ing('2026-09-10',53000),ing('2026-10-10',54500),ing('2026-11-03T18:00:00.000Z',10000)]};
c=hacer(st,'2026-11-20T12:00:00').cuentaPapa();
eq('arrastre −1000+500', c.arrastre, -500); eq('nov le toca 60000+500', c.leToca, 60500); eq('nov pendiente', c.pendiente, 50500);
eq('cuota por mes', c.meses.map(m=>m.cuota), [54000,54000]);
// 4) fecha pelada del día 1 cuenta en su mes (no en el anterior)
st={aportes:[{desde:'2026-09',monto:100}],aporteInicio:'2026-09',ingresos:[ing('2026-10-01',100),ing('2026-09-30',100)]};
c=hacer(st,'2026-11-02T12:00:00').cuentaPapa();
eq('día 1 pelado en octubre', c.meses.map(m=>[m.k,m.dado]), [['2026-09',100],['2026-10',100]]);
// 5) excluye pendientes/rechazados del atajo y montos no finitos
st={aportes:[{desde:'2026-09',monto:100}],aporteInicio:'2026-09',ingresos:[ing('2026-09-05',100),ing('2026-09-06',50,{pendiente:true}),ing('2026-09-07',70,{porAtajo:true,aplicadoSaldo:false}),ing('2026-09-08',NaN)]};
c=hacer(st,'2026-10-02T12:00:00').cuentaPapa();
eq('solo el válido', c.meses[0].dado, 100);
// 6) crédito mayor que la cuota: leToca negativo, pendiente 0, deMas = todo lo recibido
st={aportes:[{desde:'2026-09',monto:1000}],aporteInicio:'2026-09',ingresos:[ing('2026-09-05',2500),ing('2026-10-03',200)]};
c=hacer(st,'2026-10-10T12:00:00').cuentaPapa();
eq('leToca −500', c.leToca, -500); eq('pendiente 0', c.pendiente, 0); eq('deMas = 1500+200-1000 pasa a favor', c.deMas, 700);
// 7) inicio antes de la primera cuota se sube a la primera cuota; sin historial → null
st={aportes:[{desde:'2026-09',monto:100}],aporteInicio:'2026-05',ingresos:[]};
c=hacer(st,'2026-10-10T12:00:00').cuentaPapa(); eq('inicio ajustado', c.inicio, '2026-09');
eq('sin historial', hacer({aportes:[],aporteInicio:'',ingresos:[]},'2026-10-10T12:00:00').cuentaPapa(), null);
// 8) saneo: basura, duplicados (gana el último), orden
const sa=hacer({aportes:[],ingresos:[]},'2026-10-10T12:00:00').saneaAportes([{desde:'2026-10',monto:5},null,{desde:'2026-13',monto:1},{desde:'2026-09',monto:-1},{desde:'2026-09',monto:3},{desde:'2026-10',monto:7},'x',{desde:'2026-08',monto:1.25}]);
eq('saneo', sa, [{desde:'2026-08',monto:1.25},{desde:'2026-09',monto:3},{desde:'2026-10',monto:7}]);
// 9) centavos: 0.1+0.2 no deja residuo
st={aportes:[{desde:'2026-09',monto:0.3}],aporteInicio:'2026-09',ingresos:[ing('2026-09-05',0.1),ing('2026-09-06',0.2)]};
c=hacer(st,'2026-10-10T12:00:00').cuentaPapa(); eq('centavos exactos', c.arrastre, 0);
console.log(`\n${ok}/${ok+mal}`);
// 10) caso de Codex: arrastre +250, cuota 100, depósito 10 → quedan 160 a favor
st={aportes:[{desde:'2026-09',monto:100}],aporteInicio:'2026-09',ingresos:[ing('2026-09-05',350),ing('2026-10-03',10)]};
c=hacer(st,'2026-10-10T12:00:00').cuentaPapa(); eq('crédito restante 160', c.deMas, 160);
// 11) meses antes de 2020 se descartan
eq('antes de 2020 fuera', hacer({aportes:[],ingresos:[]},'2026-10-10T12:00:00').saneaAportes([{desde:'0001-01',monto:5},{desde:'2019-12',monto:5},{desde:'2020-01',monto:5}]), [{desde:'2020-01',monto:5}]);
// 12) solo cuenta "Mes papá" (con o sin acento/mayúsculas) y los ingresos de antes del campo dePapa
st={aportes:[{desde:'2026-09',monto:1000}],aporteInicio:'2026-09',ingresos:[
  ing('2026-09-05',400,{cat:'Mes papá',dePapa:true}), ing('2026-09-06',300,{cat:'Otros'}),
  ing('2026-09-07',5000,{cat:'Renta cuarto',dePapa:false}), ing('2026-09-08',70,{cat:'Otros',dePapa:'false'}),
  ing('2026-09-09',20,{cat:'MES PAPA',dePapa:false})]};
c=hacer(st,'2026-10-10T12:00:00').cuentaPapa();
eq('Mes papá + anterior + MES PAPA', [c.meses[0].dado, c.meses[0].n], [720,3]);
eq('faltan 280', c.arrastre, -280);
console.log(`total ${ok}/${ok+mal}`);
