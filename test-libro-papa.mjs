// Pruebas de libroPapa (pestaña papá), extraídas del index.html real. Cifras inventadas.
// Correr: node test-libro-papa.mjs   (TZ=UTC node test-libro-papa.mjs para otra zona)
// La parte de propiedad compara contra el código que ya estaba: cuentaPapa y estadoPapa.
import fs from 'fs';
const html=fs.readFileSync(new URL('./index.html', import.meta.url),'utf8');
const tomar=(ini,fin)=>{ const a=html.indexOf(ini), b=html.indexOf(fin,a); if(a<0||b<0) throw new Error('no '+ini); return html.slice(a,b); };
const bloque=tomar('const CAT_PAPA =','const CATS_INGRESO_DEFAULT')+tomar('const normCatTxt =','// "Mes papá" siempre primero')+tomar('const RE_MES=','const txtDepositos=')+tomar('function estadoPapa(c){','function renderPapaDeuda(){');
const extra=['function parseFechaLocal','function msFechaMov','function movSinEfecto','function movValido'].map(n=>{ const a=html.indexOf(n); let d=0,i=html.indexOf('{',a); for(;i<html.length;i++){ if(html[i]==='{')d++; else if(html[i]==='}'){d--; if(!d)break;} } return html.slice(a,i+1); }).join('\n');
const MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
let ok=0,mal=0;
const eq=(n,a,b)=>{ const p=JSON.stringify(a)===JSON.stringify(b); p?ok++:mal++; if(!p||process.env.VERBOSO) console.log((p?'PASA ':'FALLA ')+n+(p?'':'  obtuve '+JSON.stringify(a)+' esperaba '+JSON.stringify(b))); };
const hacer=(state,hoyISO)=>{ const RealDate=Date; const fijo=new RealDate(hoyISO);
  class D extends RealDate{ constructor(...a){ if(a.length===0) super(fijo.getTime()); else super(...a); } static now(){ return fijo.getTime(); } }
  const f=new Function('state','MESES','Date', extra+'\n'+bloque+'\nreturn {cuentaPapa,libroPapa,estadoPapa,depositosPapa};');
  return f(state,MESES,D); };
const ing=(fecha,monto,x={})=>({id:'i'+fecha+monto,fecha,monto,...x});
const libro=(st,hoy)=>hacer(st,hoy).libroPapa();
const mes=(l,k)=>l.meses.find(m=>m.k===k);
const A=(monto,desde='2026-09')=>[{desde,monto}];

// parcial en mes abierto: no dice "debe"
let st={aportes:A(10000),aporteInicio:'2026-09',ingresos:[ing('2026-09-05',4000)]};
let l=libro(st,'2026-09-20T12:00:00');
eq('parcial abierto: estado', l.mes.estado,'en-curso'); eq('parcial abierto: sin deuda', l.debe,0); eq('parcial abierto: falta', l.mes.falta,6000);
// varios depósitos en el mismo mes se suman y se separan
st={aportes:A(10000),aporteInicio:'2026-09',ingresos:[ing('2026-09-05',4000),ing('2026-09-10',6000),ing('2026-10-02',10000)]};
l=libro(st,'2026-10-20T12:00:00');
eq('varios: dos filas', mes(l,'2026-09').aplic.map(a=>a.monto),[4000,6000]); eq('varios: completo', mes(l,'2026-09').estado,'completo');
eq('varios: n', mes(l,'2026-09').n,2); eq('varios: sin tarde', mes(l,'2026-09').tarde,false);
// el mes cierra incompleto
st={aportes:A(10000),aporteInicio:'2026-09',ingresos:[ing('2026-09-05',9000)]};
l=libro(st,'2026-10-02T12:00:00');
eq('cierra incompleto: debe', l.debe,1000); eq('cierra incompleto: estado', mes(l,'2026-09').estado,'debe'); eq('cierra incompleto: meses', l.mesesDebe,['2026-09']);
// atrasado: el de noviembre cubre octubre, y conserva su fecha
st={aportes:A(10000),aporteInicio:'2026-09',ingresos:[ing('2026-09-03',10000),ing('2026-10-09',6000),ing('2026-11-05',3000)]};
l=libro(st,'2026-11-12T12:00:00');
eq('atrasado: debe', l.debe,1000); eq('atrasado: octubre', [mes(l,'2026-10').cubierto,mes(l,'2026-10').falta],[9000,1000]);
eq('atrasado: fila tarde', mes(l,'2026-10').aplic.map(a=>[a.monto,a.tipo]),[[6000,''],[3000,'tarde']]);
eq('atrasado: noviembre sin cubrir', [l.mes.cubierto,l.mes.llego],[0,3000]);
eq('atrasado: se fue a octubre', l.depositos.find(d=>d.monto===3000).repartos,[{k:'2026-10',monto:3000}]);
// atrasado que cubre todo el mes: "cubierto el 5 nov, tarde"
st={aportes:A(10000),aporteInicio:'2026-10',ingresos:[ing('2026-10-09',6000),ing('2026-11-05',4000)]};
l=libro(st,'2026-11-12T12:00:00');
eq('tarde: completo', mes(l,'2026-10').estado,'completo'); eq('tarde: bandera', mes(l,'2026-10').tarde,true);
eq('tarde: fecha real', new Date(mes(l,'2026-10').cubiertoEl).getDate(),5); eq('tarde: sin deuda', l.debe,0);
// un depósito que se reparte entre dos meses
st={aportes:A(10000),aporteInicio:'2026-10',ingresos:[ing('2026-10-09',9000),ing('2026-11-05',5000)]};
l=libro(st,'2026-11-12T12:00:00');
eq('reparte: dos partes', l.depositos[1].repartos,[{k:'2026-10',monto:1000},{k:'2026-11',monto:4000}]); eq('reparte: mes en curso', l.mes.cubierto,4000);
// adelanto: de más en el mes en curso, a favor y nunca negativo
st={aportes:A(10000),aporteInicio:'2026-11',ingresos:[ing('2026-11-05',12500)]};
l=libro(st,'2026-11-12T12:00:00');
eq('adelanto: a favor', l.aFavor,2500); eq('adelanto: no debe', l.debe,0); eq('adelanto: sigue diciembre', l.mesSig,'2026-12'); eq('adelanto: sobra del depósito', l.depositos[0].sobra,2500);
// de más y luego corto
st={aportes:A(10000),aporteInicio:'2026-09',ingresos:[ing('2026-09-05',12000),ing('2026-10-05',7000)]};
l=libro(st,'2026-11-02T12:00:00');
eq('de más luego corto: debe', l.debe,1000); eq('de más luego corto: usa el adelanto', mes(l,'2026-10').aplic.map(a=>[a.monto,a.tipo]),[[2000,'adelanto'],[7000,'']]);
eq('de más luego corto: bandera', mes(l,'2026-10').conAdelanto,true);
// arrastre a favor al mes en curso
st={aportes:A(10000),aporteInicio:'2026-09',ingresos:[ing('2026-09-05',10030)]};
l=libro(st,'2026-10-05T12:00:00');
eq('arrastre: adelanto previo', l.adelantoPrevio,30); eq('arrastre: cubre octubre', l.mes.cubierto,30); eq('arrastre: no es a favor final', l.aFavor,0);
// la cuota cambia a medio camino
st={aportes:[{desde:'2026-09',monto:10000},{desde:'2026-11',monto:12000}],aporteInicio:'2026-09',ingresos:[ing('2026-09-10',9000),ing('2026-10-10',10500),ing('2026-11-03',2000)]};
l=libro(st,'2026-11-20T12:00:00');
eq('cuota cambia: cuotas', l.meses.map(m=>m.cuota),[10000,10000,12000]); eq('cuota cambia: sin deuda', l.debe,0); eq('cuota cambia: noviembre', l.mes.cubierto,1500);
// mes sin cuota
st={aportes:[{desde:'2026-09',monto:1000},{desde:'2026-10',monto:0},{desde:'2026-11',monto:1000}],aporteInicio:'2026-09',ingresos:[ing('2026-09-05',1000),ing('2026-11-05',1000)]};
l=libro(st,'2026-11-20T12:00:00');
eq('sin cuota: estado', mes(l,'2026-10').estado,'sin-cuota'); eq('sin cuota: nada aplicado', mes(l,'2026-10').aplic.length,0); eq('sin cuota: noviembre', l.mes.cubierto,1000);
// mes de inicio: lo anterior no entra; una fecha futura tampoco
st={aportes:A(1000),aporteInicio:'2026-10',ingresos:[ing('2026-09-05',700),ing('2026-10-05',1000),ing('2026-12-05',300)]};
l=libro(st,'2026-11-02T12:00:00');
eq('inicio: previos', l.previos,1); eq('inicio: futuros', l.futuros,1); eq('inicio: meses', l.meses.map(m=>m.k),['2026-10','2026-11']); eq('inicio: mes en curso vacío', l.mes.cubierto,0);
eq('inicio antes de la cuota se sube', libro({aportes:A(100),aporteInicio:'2026-05',ingresos:[]},'2026-10-10T12:00:00').inicio,'2026-09');
eq('sin historial', libro({aportes:[],aporteInicio:'',ingresos:[]},'2026-10-10T12:00:00'),null);
eq('inicio futuro', libro({aportes:A(100),aporteInicio:'2027-01',ingresos:[]},'2026-10-10T12:00:00'),null);
// Atajo pendiente o rechazado, monto no finito, fecha inválida
st={aportes:A(100),aporteInicio:'2026-09',ingresos:[ing('2026-09-05',100),ing('2026-09-06',50,{pendiente:true}),ing('2026-09-07',70,{porAtajo:true,aplicadoSaldo:false}),ing('2026-09-08',NaN),ing('nada',80),ing('2026-13-45',90)]};
l=libro(st,'2026-10-02T12:00:00');
eq('solo el válido', [mes(l,'2026-09').llego,mes(l,'2026-09').n,l.depositos.length],[100,1,1]);
// fecha pelada del día 1 y del último día
st={aportes:A(100),aporteInicio:'2026-09',ingresos:[ing('2026-10-01',100),ing('2026-09-30',100)]};
l=libro(st,'2026-11-02T12:00:00');
eq('día 1 pelado', l.meses.map(m=>[m.k,m.llego]),[['2026-09',100],['2026-10',100],['2026-11',0]]);
// centavos
st={aportes:A(0.3),aporteInicio:'2026-09',ingresos:[ing('2026-09-05',0.1),ing('2026-09-06',0.2)]};
l=libro(st,'2026-10-10T12:00:00');
eq('centavos exactos', [l.debe,mes(l,'2026-09').falta,mes(l,'2026-09').estado],[0,0,'completo']);
// otra moneda: cuenta su monto en pesos y conserva el original
st={aportes:A(1000),aporteInicio:'2026-09',ingresos:[ing('2026-09-05',800,{montoOrig:50,moneda:'AUD',cat:'Mes papá',dePapa:true})]};
l=libro(st,'2026-10-02T12:00:00');
eq('otra moneda: pesos', l.debe,200); eq('otra moneda: original', [l.depositos[0].montoOrig,l.depositos[0].moneda],[50,'AUD']);
// anteriores al 30-sep sin dePapa, y categoría que no es de papá
st={aportes:A(1000),aporteInicio:'2026-09',ingresos:[ing('2026-09-05',400,{cat:'Mes papá',dePapa:true}),ing('2026-09-06',300,{cat:'Otros'}),ing('2026-09-07',5000,{cat:'Renta cuarto',dePapa:false}),ing('2026-09-09',20,{cat:'MES PAPA',dePapa:false})]};
l=libro(st,'2026-10-10T12:00:00');
eq('de papá y anteriores', [mes(l,'2026-09').llego,mes(l,'2026-09').n,l.debe],[720,3,280]);
// el orden no depende de cómo llegaron, y no se toca el estado
st={aportes:A(1000),aporteInicio:'2026-09',ingresos:[ing('2026-09-20',600,{id:'b',creado:'2'}),ing('2026-09-20',500,{id:'a',creado:'1'}),ing('2026-09-05',100)]};
const copia=JSON.stringify(st), l1=libro(st,'2026-10-10T12:00:00');
eq('no toca el estado', JSON.stringify(st),copia);
eq('empate por creado', mes(l1,'2026-09').aplic.map(a=>a.monto),[100,500,400]);
const st2={...st,ingresos:st.ingresos.slice().reverse()}, l2=libro(st2,'2026-10-10T12:00:00');
eq('mismo reparto en otro orden', JSON.stringify(l2.meses),JSON.stringify(l1.meses));
// monto negativo (la app no lo captura): el total sigue igual que cuentaPapa
st={aportes:A(1000),aporteInicio:'2026-09',ingresos:[ing('2026-09-05',1500),ing('2026-09-06',-700)]};
l=libro(st,'2026-10-10T12:00:00');
eq('negativo: debe', l.debe,200); eq('negativo: fila', mes(l,'2026-09').ajustes.length,1);
st={aportes:A(1000),aporteInicio:'2026-11',ingresos:[ing('2026-11-05',1500),ing('2026-11-06',-200)]};
l=libro(st,'2026-11-10T12:00:00');
eq('negativo: primero le quita a lo que sobra', [l.aFavor,l.mes.cubierto],[300,1000]);
st={aportes:A(1000),aporteInicio:'2026-09',ingresos:[ing('2026-09-05',-300)]};
l=libro(st,'2026-10-10T12:00:00');
eq('negativo: debe más que la cuota', l.debe,1300);
const unit=ok+mal;

// ── PROPIEDAD: cientos de escenarios al azar contra cuentaPapa y estadoPapa ──
let semilla=20261103; const az=n=>{ semilla=(semilla*1664525+1013904223)>>>0; return semilla%n; };
const MES=k=>{ const [y,m]=k.split('-').map(Number); return (y*12)+(m-1); }, KEY=n=>Math.floor(n/12)+'-'+String(n%12+1).padStart(2,'0');
const dia=n=>String(n).padStart(2,'0');
const cents=()=>[0,0.01,0.1,0.2,0.3,0.07,0.5,0.99][az(8)];
const N=Number(process.env.ESCENARIOS||3000);
const r=x=>Math.round(x*100)/100;
let falloProp=0; const fallaP=(n,info)=>{ falloProp++; mal++; if(falloProp<=8) console.log('FALLA propiedad',n,JSON.stringify(info)); };
for(let e=0;e<N;e++){
  const base=MES('2026-01')+az(10), hoyN=base+az(12), hoy=KEY(hoyN)+'-'+dia(1+az(28))+'T12:00:00';
  const aportes=[]; let n=base; const cuantos=1+az(4);
  for(let i=0;i<cuantos&&n<=hoyN;i++){ aportes.push({desde:KEY(n),monto:[0,100,1000,10000,20000.5,0.3][az(6)]}); n+=1+az(4); }
  const inicio=az(3)===0?'':KEY(base+az(hoyN-base+1));
  const ingresos=[]; const dep=az(14);
  for(let i=0;i<dep;i++){
    const mm=KEY(base-2+az(hoyN-base+5)), d=dia(1+az(28));
    const forma=az(3), fecha=forma===0?mm+'-'+d:forma===1?mm+'-'+d+'T00:00:00.000Z':mm+'-'+d+'T1'+az(9)+':30:00.000Z';
    const x={id:'p'+i,fecha,monto:r([100,1000,5000,9000,10000,12000,20000][az(7)]*(az(4)===0?0.5:1)+cents())};
    switch(az(12)){ case 0:x.pendiente=true;break; case 1:x.porAtajo=true;x.aplicadoSaldo=false;break; case 2:x.cat='Otros';x.dePapa=false;break; case 3:x.cat='Mes papá';x.dePapa=true;break; case 4:x.monto=NaN;break; case 5:if(az(4)===0)x.monto=0;break; case 6:if(az(2)===0)x.monto=-x.monto;break; }
    ingresos.push(x);
  }
  const s={aportes,aporteInicio:inicio,ingresos}, api=hacer(s,hoy), c=api.cuentaPapa(), L=api.libroPapa();
  if(!c||!L){ if(!!c!==!!L) fallaP('null',{s,hoy}); ok++; continue; }
  const est=api.estadoPapa(c);
  const atrasado=/^falta/.test(est.sub)?est.monto:0, aFavorEst=/^va de más/.test(est.sub)?est.monto:0;
  const mal1=[];
  if(L.inicio!==c.inicio) mal1.push('inicio');
  if(Math.abs(L.debe-atrasado)>0.004) mal1.push('debe '+L.debe+' vs '+atrasado);
  if(Math.abs(L.aFavor-c.deMas)>0.004) mal1.push('aFavor '+L.aFavor+' vs '+c.deMas);
  if(Math.abs(L.aFavor-aFavorEst)>0.004) mal1.push('aFavor est');
  if(Math.abs(L.debe+L.mes.falta-c.pendiente)>0.004) mal1.push('pendiente '+(L.debe+L.mes.falta)+' vs '+c.pendiente);
  if(/^a favor/.test(est.sub)&&Math.abs(L.adelantoPrevio-est.monto)>0.004) mal1.push('adelanto '+L.adelantoPrevio+' vs '+est.monto);
  if(L.meses.length!==c.meses.length+1) mal1.push('meses');
  c.meses.forEach((m,i)=>{ const x=L.meses[i]; if(x.k!==m.k||Math.abs(x.cuota-m.cuota)>0.004||Math.abs(x.llego-m.dado)>0.004||x.n!==m.n) mal1.push('mes '+m.k); });
  if(Math.abs(L.mes.llego-c.dado)>0.004||L.mes.n!==c.n||Math.abs(L.mes.cuota-c.cuota)>0.004) mal1.push('mes actual');
  // nada se pierde ni se inventa: lo llegado = lo cubierto + a favor (si el neto no es negativo)
  const llego=L.meses.reduce((t,m)=>t+m.llego,0), cub=L.meses.reduce((t,m)=>t+m.cubierto,0);
  if(llego>=0&&Math.abs(llego-cub-L.aFavor)>0.004) mal1.push('conservación');
  // cada mes tiene lo que dicen sus filas, y ninguno se pasa de su cuota
  L.meses.forEach(m=>{ const su=m.aplic.reduce((t,a)=>t+a.monto,0); if(Math.abs(su-m.cubierto)>0.004) mal1.push('filas '+m.k); if(m.cubierto>m.cuota+0.004||m.falta<-0.004) mal1.push('tope '+m.k); });
  L.depositos.filter(d=>d.c>0&&llego>=0&&!ingresos.some(i=>i.monto<0)).forEach(d=>{ const su=d.repartos.reduce((t,x)=>t+x.monto,0)+d.sobra; if(Math.abs(su-d.monto)>0.004) mal1.push('reparto '+d.id); });
  // la deuda sale de meses cerrados, y si hay a favor no puede haber deuda
  if(L.debe>0.004&&L.aFavor>0.004) mal1.push('debe y a favor');
  if(mal1.length) fallaP(mal1.join(','),{aportes,inicio,hoy,ingresos}); else ok++;
}
console.log(`unitarias ${unit} · propiedad ${N} escenarios · fallas de propiedad ${falloProp}`);
console.log(`total ${ok}/${ok+mal}`);
process.exitCode=mal?1:0;
