/* v1.63 — Pin grupları ve grup bağlantıları
   Port: p.hc.grps = [{id, name, kind, cat, mem:[{role, no}]}]   (ör. "UART1": TX / RX / GND)
   Grup bağlantıları ayrıca saklanmaz: hatlardan türetilir (iki grubun üyeleri aynı hattaysa bağlıdır).
   Grup Bağlantıları görünümünde grup tutamağı başka bir grubun tutamağına sürüklenince üyeler role göre eşlenir
   (TX ↔ RX, A ↔ A, GND ↔ GND …); karşılığı olmayan üye uyarılır ama bağlantı engellenmez. Pin tutamakları ile pin pin el ile bağlantı. */
const HG_T = [['UART', ['TX', 'RX', 'GND'], 'c_com'], ['RS-232', ['TX', 'RX', 'RTS', 'CTS', 'GND'], 'c_com'], ['RS-422', ['TX+', 'TX-', 'RX+', 'RX-', 'GND'], 'c_com'], ['RS-485', ['A', 'B', 'GND'], 'c_com'],
  ['CAN', ['CAN_H', 'CAN_L', 'GND'], 'c_com'], ['Ethernet', ['TX+', 'TX-', 'RX+', 'RX-'], 'c_com'], ['MIL-STD-1553', ['DATA', 'DATA_N', 'SHIELD'], 'c_com'], ['Güç', ['+', 'RTN'], 'c_pwr'],
  ['Ayrık sinyal', ['SIG', 'RTN'], 'c_dis'], ['Analog', ['SIG+', 'SIG-'], 'c_ana'], ['Özel', [], '']];
const HG_X = {TX:'RX', RX:'TX', 'TX+':'RX+', 'TX-':'RX-', 'RX+':'TX+', 'RX-':'TX-', RTS:'CTS', CTS:'RTS'};
const HG_SYN = {TXD:'TX', RXD:'RX', '0V':'GND', SGND:'GND', GROUND:'GND', COM:'GND', CANH:'H', CANL:'L', CAN_H:'H', CAN_L:'L', 'D+':'A', 'D-':'B', PWR:'+', VCC:'+', VIN:'+', RET:'RTN', RETURN:'RTN'};
const hgNorm = r => { const s = String(r || '').trim().toLocaleUpperCase('tr').replace(/\s+/g, ''); return HG_SYN[s] || HG_SYN[s.replace(/_/g, '')] || s; };
const hgOf = p => (p && p.hc && p.hc.grps) || [];
const hgGet = (p, gid) => hgOf(p).find(g => g.id === gid) || null;
const hgPinGrp = (p, no) => hgOf(p).find(g => g.mem.some(m => m.no === no)) || null;
const hgPinTxt = (p, no) => `${(E(p.owner) || {}).name || '?'} ${p.name}-${no}`;
const hgGName = (p, g) => `${(E(p.owner) || {}).name || '?'} ${p.name} · ${g.name}`;
const hgCat = g => g.cat || (HG_T.find(t => t[0] === g.kind) || [])[2] || '';
/* şablon rolüne en uygun pin: sinyal adı / etiket rolle biter veya eşittir */
function hgGuess(p, role, taken){
  const R = hgNorm(role); if(!R) return '';
  let best = '', bs = 0;
  hcPins(p).forEach(x => { if(taken.has(x.no)) return; const names = [x.d.sig, (hcLabel(x.d.lbl) || {}).name].filter(Boolean).map(s => String(s).toLocaleUpperCase('tr'));
    names.forEach(s => { const n = hgNorm(s); let sc = n === R ? 4 : (s.endsWith('_' + R) || s.endsWith(' ' + R) || s.endsWith('-' + R) && R.length > 1) ? 3 : hgNorm(s.split(/[_\s]/).pop()) === R ? 2 : R.length > 2 && s.includes(R) ? 1 : 0; if(sc > bs){ bs = sc; best = x.no; } }); });
  return best;
}
function hgNewGroup(p, kind, name){
  const t = HG_T.find(x => x[0] === kind) || HG_T[HG_T.length - 1], gs = hgOf(p), base = kind === 'Özel' ? 'Grup' : kind.replace(/ sinyal$/, '');
  let k = 1; while(gs.some(g => g.name === base + ' ' + k)) k++;
  const taken = new Set(gs.flatMap(g => g.mem.map(m => m.no)).filter(Boolean)), mem = t[1].map(role => { const no = hgGuess(p, role, taken); if(no) taken.add(no); return {role, no}; });
  const g = {id:'g' + uid(), name:name || base + ' ' + k, kind:t[0], cat:t[2], mem}; p.hc.grps = gs.concat([g]); return g;
}
/* iki grubun üyelerini role göre eşle */
function hgMap(ga, gb){
  const used = new Set(), pairs = [], missA = [];
  ga.mem.filter(m => m.no).forEach(m => { const r = hgNorm(m.role); if(!r) return; const want = [HG_X[r] || r, r];
    const hit = want.map(w => gb.mem.find(n => n.no && !used.has(n) && hgNorm(n.role) === w)).find(Boolean);
    if(hit){ used.add(hit); pairs.push([m, hit]); } else missA.push(m); });
  const ra = ga.mem.filter(m => m.no && !hgNorm(m.role)), rb = gb.mem.filter(n => n.no && !hgNorm(n.role) && !used.has(n));   /* rolsüz üyeler sırayla */
  ra.forEach((m, i) => { if(rb[i]){ used.add(rb[i]); pairs.push([m, rb[i]]); } else missA.push(m); });
  const missB = gb.mem.filter(n => n.no && !used.has(n));
  return {pairs, missA, missB};
}
const hgCableOf = (pa, pb) => hcCables().find(c => c.nodes.some(n => n.kind === 'conn' && n.port === pa.id) && c.nodes.some(n => n.kind === 'conn' && n.port === pb.id)) || null;
function hgEnsureCable(pa, pb){
  let c = hgCableOf(pa, pb); if(c) return c;
  c = hcNewCable([]); hcAddConnNode(c, pa.id, false); hcAddConnNode(c, pb.id, false); return c;
}
const hgNodeOf = (c, p) => c.nodes.find(n => n.kind === 'conn' && n.port === p.id);
const hgHasWire = (c, a, b) => c.wires.some(w => (hcEndKey(w.a) === hcEndKey(a) && hcEndKey(w.b) === hcEndKey(b)) || (hcEndKey(w.a) === hcEndKey(b) && hcEndKey(w.b) === hcEndKey(a)));
/* grup → grup bağla (snap / afterChange çağırana ait) */
function hgConnect(pa, gaId, pb, gbId){
  const ga = hgGet(pa, gaId), gb = hgGet(pb, gbId); if(!ga || !gb) return null;
  const mp = hgMap(ga, gb), c = hgEnsureCable(pa, pb), na = hgNodeOf(c, pa), nb = hgNodeOf(c, pb); let added = 0;
  mp.pairs.forEach(([m, n]) => { const a = {n:na.id, pin:m.no}, b = {n:nb.id, pin:n.no}; if(!hgHasWire(c, a, b)){ hcAddWire(c, a, b); added++; } });
  return Object.assign({cable:c, added}, mp);
}
function hgPinConnect(pa, noA, pb, noB){
  const c = hgEnsureCable(pa, pb), a = {n:hgNodeOf(c, pa).id, pin:noA}, b = {n:hgNodeOf(c, pb).id, pin:noB};
  if(hgHasWire(c, a, b)) return {cable:c, added:0}; hcAddWire(c, a, b); return {cable:c, added:1};
}
/* grup bağlantıları: hatlardan türetilir */
const HGC = {rev:-1, v:null};
function hgLinks(){
  if(HGC.rev === REV && HGC.v) return HGC.v;
  const map = new Map();
  hcLines().forEach(l => { const gs = []; l.pins.forEach(x => { const g = hgPinGrp(x.port, x.no); if(g) gs.push({p:x.port, g, no:x.no}); });
    for(let i = 0; i < gs.length; i++) for(let j = i + 1; j < gs.length; j++){ const A = gs[i], B = gs[j]; if(A.p.id === B.p.id && A.g.id === B.g.id) continue;
      const [X, Y] = (A.p.id + A.g.id) < (B.p.id + B.g.id) ? [A, B] : [B, A], k = X.p.id + '|' + X.g.id + '~' + Y.p.id + '|' + Y.g.id;
      if(!map.has(k)) map.set(k, {id:k, pa:X.p, ga:X.g, pb:Y.p, gb:Y.g, pairs:[], cables:new Set()}); const L = map.get(k); L.pairs.push([X.no, Y.no]); L.cables.add(l.cable.id); } });
  const v = [...map.values()].map(L => { const ia = new Set(L.pairs.map(x => x[0])), ib = new Set(L.pairs.map(x => x[1]));
    return Object.assign(L, {missA:L.ga.mem.filter(m => m.no && !ia.has(m.no)), missB:L.gb.mem.filter(m => m.no && !ib.has(m.no)), n:L.pairs.length, tot:Math.max(L.ga.mem.filter(m => m.no).length, L.gb.mem.filter(m => m.no).length)}); });
  HGC.rev = REV; HGC.v = v; return v;
}
const hgMissTxt = (p, ms) => ms.map(m => (m.role || '?') + ' (' + p.name + '-' + m.no + ')').join(', ');
function hgLinkIssues(L){
  const out = [];
  if(L.missA.length) out.push(`${hgGName(L.pa, L.ga)} ↔ ${hgGName(L.pb, L.gb)}: karşı grupta karşılığı olmayan üye: ${hgMissTxt(L.pa, L.missA)}`);
  if(L.missB.length) out.push(`${hgGName(L.pb, L.gb)} ↔ ${hgGName(L.pa, L.ga)}: karşı grupta karşılığı olmayan üye: ${hgMissTxt(L.pb, L.missB)}`);
  if(L.ga.kind && L.gb.kind && L.ga.kind !== 'Özel' && L.gb.kind !== 'Özel' && L.ga.kind !== L.gb.kind) out.push(`${hgGName(L.pa, L.ga)} (${L.ga.kind}) ile ${hgGName(L.pb, L.gb)} (${L.gb.kind}) farklı türde`);
  return out;
}
{ const _ci = hcCableIssues; hcCableIssues = function(c){ const r = _ci.apply(this, arguments); try { hgLinks().filter(L => L.cables.has(c.id)).forEach(L => hgLinkIssues(L).forEach(msg => r.push({sev:'uyarı', msg, n:(hgNodeOf(c, L.pa) || {}).id}))); } catch(e){} return r; }; }
VALIDATORS.push((add) => { if(!M.hrn) return; Object.values(M.els).filter(hcIsConn).forEach(p => hgOf(p).forEach(g => { const nos = g.mem.map(m => m.no).filter(Boolean), dup = nos.filter((x, i) => nos.indexOf(x) !== i);
  if(!nos.length) add('bilgi', 'Pin grubu', p, `${p.name} · ${g.name}: üyelere pin atanmamış`); if(dup.length) add('uyarı', 'Pin grubu', p, `${p.name} · ${g.name}: aynı pin birden çok üyede (${[...new Set(dup)].join(', ')})`);
  const other = hgOf(p).filter(o => o !== g && o.mem.some(m => m.no && nos.includes(m.no))); if(other.length) add('uyarı', 'Pin grubu', p, `${p.name} · ${g.name}: pinler ${other.map(o => o.name).join(', ')} grubunda da var`); })); });

/* ---------- birim arayüzü panelinde grup düzenleyici ---------- */
function hgPortBlock(p){
  const H = hcR(), pins = hcPins(p), gs = hgOf(p), pinOpt = (v) => hcOpt('', '—', v) + pins.map(x => hcOpt(x.no, x.no + (x.d.sig || x.d.lbl ? ' · ' + (x.d.sig || (hcLabel(x.d.lbl) || {}).name) : ''), v)).join('');
  let h = `<div class="hcsec" style="margin-top:8px">Pin grupları <span class="muted" style="font-weight:400;font-size:11.5px">— ör. Haberleşme UART1 (TX, RX, GND), RS-485 (A, B, GND). Grup Bağlantıları görünümünde gruplar sürüklenerek bağlanır.</span></div>`;
  h += `<div style="font-size:12px;margin:4px 0 6px">Şablon <select data-hgf="newkind">${HG_T.map(t => hcOpt(t[0], t[0] + (t[1].length ? ' (' + t[1].join(', ') + ')' : ''), HG.kind)).join('')}</select> <button class="vb" data-hg="add">+ Grup ekle</button> <button class="vb" data-hg="open" title="Grup Bağlantıları görünümünü aç">Grup bağlantıları</button></div>`;
  if(!gs.length) return h + '<p class="muted" style="font-size:12px;margin:0 0 6px">Bu konnektörde pin grubu yok.</p>';
  h += `<table class="hcpt" style="margin-bottom:6px"><thead><tr><th>Grup adı</th><th>Tür</th><th>Hat tipi</th><th>Üyeler (rol · pin)</th><th></th></tr></thead><tbody>`;
  gs.forEach(g => { const a = f => `data-hgf="${f}" data-g="${g.id}"`;
    h += `<tr><td><input ${a('name')} value="${esc(g.name)}" class="noi18n" style="width:110px"></td><td><select ${a('kind')}>${HG_T.map(t => hcOpt(t[0], t[0], g.kind)).join('')}</select></td>
      <td><select ${a('cat')}>${hcOpt('', '—', g.cat)}${H.cats.map(c => hcOpt(c.id, c.name, g.cat)).join('')}</select></td><td>${g.mem.map((m, i) => `<span style="display:inline-flex;gap:2px;align-items:center;margin:1px 6px 1px 0;border:1px solid #dde;border-radius:4px;padding:1px 3px"><input data-hgm="role" data-g="${g.id}" data-i="${i}" value="${esc(m.role)}" placeholder="rol" class="noi18n" style="width:52px"><select data-hgm="no" data-g="${g.id}" data-i="${i}" style="max-width:120px">${pinOpt(m.no)}</select><button class="vb" data-hg="mdel" data-g="${g.id}" data-i="${i}" title="Üyeyi çıkar" style="padding:0 4px">✕</button></span>`).join('')}<button class="vb" data-hg="madd" data-g="${g.id}" style="padding:0 6px">+ üye</button> <button class="vb" data-hg="fill" data-g="${g.id}" title="Boş üyelere sinyal adından pin öner" style="padding:0 6px">Pinleri öner</button></td>
      <td><button class="vb" data-hg="del" data-g="${g.id}" title="Grubu sil">Sil</button></td></tr>`; });
  return h + '</tbody></table>';
}
{ const _ph = hcPortHTML; hcPortHTML = function(p){ const h = _ph.apply(this, arguments), mk = '<div style="max-height:calc(100vh - 330px)', i = h.indexOf(mk); return i < 0 ? h + hgPortBlock(p) : h.slice(0, i) + hgPortBlock(p) + h.slice(i); }; }

/* ---------- Grup Bağlantıları görünümü ---------- */
const HG = {k:1, pins:false, kind:'UART', sel:''};
const HG_UW = 250, HG_UH = 30, HG_CH = 22, HG_GH = 22, HG_PH = 18;
function hgRows(u){
  const rows = []; hcUnitConns(u.id).forEach(p => { rows.push({t:'c', p, h:HG_CH});
    hgOf(p).forEach(g => rows.push({t:'g', p, g, h:HG_GH}));
    if(HG.pins) hcPins(p).filter(x => hcPinUsed(x.d) && !hgPinGrp(p, x.no)).forEach(x => rows.push({t:'p', p, no:x.no, d:x.d, h:HG_PH})); });
  return rows;
}
function hgLayout(){
  const H = hcR(), lay = H.glay || {}, us = hcUnits(), P = {};
  let col = 0, x = 40, y = 40, rowH = 0;
  us.forEach(u => { const rows = hgRows(u), h = HG_UH + rows.reduce((s, r) => s + r.h, 0) + 8;
    if(lay[u.id]) P[u.id] = {x:lay[u.id].x, y:lay[u.id].y, w:HG_UW, h, rows};
    else { P[u.id] = {x, y, w:HG_UW, h, rows}; rowH = Math.max(rowH, h); col++; x += HG_UW + 220; if(col >= 3){ col = 0; x = 40; y += rowH + 80; rowH = 0; } } });
  Object.values(P).forEach(u => { let yy = u.y + HG_UH; u.rows.forEach(r => { r.y = yy; yy += r.h; }); });
  return P;
}
function hgSVG(opt){
  opt = opt || {}; const P = hgLayout(), exp = !!opt.exp, links = hgLinks(), anc = new Map();
  let maxX = 500, maxY = 300, units = '', lines = '', labels = '';
  Object.values(P).forEach(u => { maxX = Math.max(maxX, u.x + u.w + 80); maxY = Math.max(maxY, u.y + u.h + 80); });
  hcUnits().forEach(u => { const b = P[u.id];
    units += `<g ${exp ? '' : `data-hgu="${u.id}"`}><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="6" fill="#fff" stroke="#34495e" stroke-width="1.4"/><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${HG_UH}" rx="6" fill="#34495e"/><rect x="${b.x}" y="${b.y + HG_UH - 6}" width="${b.w}" height="6" fill="#34495e"/><text x="${b.x + b.w / 2}" y="${b.y + 20}" text-anchor="middle" fill="#fff" font-size="13" font-weight="600" style="cursor:move">${esc(u.name)}</text>`;
    b.rows.forEach(r => { const y = r.y, cy = y + r.h / 2;
      if(r.t === 'c'){ const t = hcType(r.p.hc.ct); units += `<g ${exp ? '' : `data-hgc="${r.p.id}" style="cursor:pointer"`}><rect x="${b.x + 1}" y="${y}" width="${b.w - 2}" height="${r.h}" fill="#eef1f5"/><text x="${b.x + 8}" y="${y + 15}" font-size="11.5" font-weight="700">${esc(r.p.name)}</text><text x="${b.x + 46}" y="${y + 15}" font-size="10" fill="#667">${esc(((t && (t.pn || t.name)) || 'tip yok').slice(0, 30))}${hgOf(r.p).length ? '' : ' · grup yok'}</text></g>`; return; }
      const key = r.t === 'g' ? r.p.id + '|g:' + r.g.id : r.p.id + '|p:' + r.no; anc.set(key, {L:{x:b.x, y:cy}, R:{x:b.x + b.w, y:cy}, u:u.id, cx:b.x + b.w / 2});
      if(r.t === 'g'){ const cat = hcCat(hgCat(r.g)), nm = r.g.mem.filter(m => m.no).length, mm = r.g.mem.map(m => m.role || m.no).join(' · ');
        units += `<g><rect x="${b.x + 4}" y="${y + 2}" width="${b.w - 8}" height="${r.h - 4}" rx="3" fill="${HG.sel === key ? '#fff4d6' : '#f7f9fc'}" stroke="#dde"/><rect x="${b.x + 4}" y="${y + 2}" width="5" height="${r.h - 4}" fill="${cat ? cat.col : '#bbb'}"/><text x="${b.x + 14}" y="${y + 15}" font-size="11.5" font-weight="600">${esc(r.g.name)}</text><text x="${b.x + 96}" y="${y + 15}" font-size="9.5" fill="#667">${esc((mm.length > 30 ? mm.slice(0, 29) + '…' : mm) || 'üye yok')} (${nm})</text></g>`;
      } else units += `<g><text x="${b.x + 18}" y="${y + 13}" font-size="10" fill="#555">pin ${esc(r.no)}</text><text x="${b.x + 70}" y="${y + 13}" font-size="10" fill="#333">${esc(String(r.d.sig || (hcLabel(r.d.lbl) || {}).name || '').slice(0, 26))}</text></g>`;
      if(!exp){ const rr = r.t === 'g' ? 5.5 : 4, st = r.t === 'g' ? '#2e86de' : '#95a5a6'; units += `<circle cx="${b.x}" cy="${cy}" r="${rr}" fill="#fff" stroke="${st}" stroke-width="1.6" data-hgh="${key}" style="cursor:crosshair"/><circle cx="${b.x + b.w}" cy="${cy}" r="${rr}" fill="#fff" stroke="${st}" stroke-width="1.6" data-hgh="${key}" style="cursor:crosshair"/>`; } }); units += '</g>'; });
  const lane = new Map(), route = (A, B, w, col, attrs, lab, lc) => {
    const same = Math.abs(A.cx - B.cx) < HG_UW + 40, sa = same ? 1 : B.cx >= A.cx ? 1 : -1, sbb = same ? 1 : A.cx > B.cx ? 1 : -1, a = sa > 0 ? A.R : A.L, b = sbb > 0 ? B.R : B.L;   /* üst üste birimler: ikisi de sağ yandan */
    const la = (lane.get(A.u + sa) || 0), lb = (lane.get(B.u + sbb) || 0); lane.set(A.u + sa, la + 1); lane.set(B.u + sbb, lb + 1);
    const xa = a.x + sa * (18 + la * 10), xb = b.x + sbb * (18 + lb * 10), X = sa === sbb ? (sa > 0 ? Math.max(xa, xb) : Math.min(xa, xb)) : Math.round((xa + xb) / 2);
    const d = `M${a.x},${a.y} H${X} V${b.y} H${b.x}`;
    lines += `<g ${attrs}><path d="${d}" fill="none" stroke="transparent" stroke-width="10"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${w}"/><circle cx="${a.x}" cy="${a.y}" r="3" fill="${col}"/><circle cx="${b.x}" cy="${b.y}" r="3" fill="${col}"/></g>`;
    if(lab){ const tw = lab.length * 6.2 + 10, ly = Math.round((a.y + b.y) / 2); labels += `<g ${attrs}><rect x="${X - tw / 2}" y="${ly - 8}" width="${tw}" height="15" rx="7" fill="#fff" stroke="${lc}"/><text x="${X}" y="${ly + 3}" text-anchor="middle" font-size="10.5" font-weight="600" fill="${lc}">${esc(lab)}</text></g>`; } };
  links.forEach(L => { const A = anc.get(L.pa.id + '|g:' + L.ga.id), B = anc.get(L.pb.id + '|g:' + L.gb.id); if(!A || !B) return; const cat = hcCat(hgCat(L.ga)) || hcCat(hgCat(L.gb)), warn = hgLinkIssues(L).length;
    route(A, B, 2.6, cat ? cat.col : '#555', exp ? '' : `data-hgl="${esc(L.id)}" data-cab="${[...L.cables][0]}" style="cursor:pointer"`, `${L.n}/${L.tot}${warn ? ' ⚠' : ''}`, warn ? '#d68910' : (cat ? cat.col : '#555')); });
  if(HG.pins){ const seen = new Set(); hcLines().forEach(l => { const ps = l.pins.filter(x => anc.has(x.port.id + '|p:' + x.no)); if(!ps.length) return;
    l.pins.forEach(x => { const kx = x.port.id + '|p:' + x.no, g = hgPinGrp(x.port, x.no), kg = g ? x.port.id + '|g:' + g.id : kx; x._k = anc.has(kx) ? kx : kg; });
    for(let i = 1; i < l.pins.length; i++){ const A = anc.get(l.pins[0]._k), B = anc.get(l.pins[i]._k), k = l.id + i; if(!A || !B || seen.has(k)) continue; seen.add(k); const cat = hcCat(l.cat);
      route(A, B, 1.2, cat ? cat.col : '#888', exp ? '' : `data-cab="${l.cable.id}" style="cursor:pointer"`, '', ''); } }); }
  return {svg:`<g>${lines}</g><g>${units}</g><g>${labels}</g>`, w:maxX, h:maxY};
}
function hgHTML(){
  if(!hcUnits().length) return '<div style="padding:14px" class="muted">Henüz birim yok. Önce Birim arayüzleri ve pinout görünümünde birimleri ve konnektörlerini tanımlayın.</div>';
  const r = hgSVG(), L = hgLinks(), warn = L.reduce((s, x) => s + hgLinkIssues(x).length, 0), ng = Object.values(M.els).filter(hcIsConn).reduce((s, p) => s + hgOf(p).length, 0);
  return `<div style="padding:6px 10px;font-size:12px" class="muted">${ng} grup · ${L.length} grup bağlantısı${warn ? ` · <b style="color:#b9770e">⚠ ${warn} uyarı</b>` : ''} — Grup tutamağını (mavi) başka bir grubun tutamağına sürükleyin: üyeler role göre bağlanır (TX ↔ RX, A ↔ A, GND ↔ GND). Pin tutamakları (gri, “Grupsuz pinler”) ile pin pin bağlanır. Konnektör başlığına tıklayınca grup düzenleyici açılır, çizgiye çift tıklayınca kablaj detayı.</div>
    ${warn ? `<div class="gaps" style="margin:0 10px 6px;background:#fdf6ec;border:1px solid #f0d9b5;color:#7a4b0b;font-size:12px;padding:5px 8px;border-radius:4px;max-height:84px;overflow:auto">${L.flatMap(hgLinkIssues).map(m => '⚠ ' + esc(m)).join('<br>')}</div>` : ''}
    <div id="hgWrap" style="position:relative;height:calc(100vh - ${warn ? 250 : 170}px);overflow:auto;background:#fafbfc;background-image:radial-gradient(#dfe3ea 1px, transparent 1px);background-size:20px 20px">
    <svg id="hgSvg" xmlns="http://www.w3.org/2000/svg" width="${Math.round(r.w * HG.k)}" height="${Math.round(r.h * HG.k)}" viewBox="0 0 ${r.w} ${r.h}" font-family="Inter,Segoe UI,Arial,sans-serif">${r.svg}<path id="hgTmp" d="" stroke="#2e86de" stroke-width="2" stroke-dasharray="5 4" fill="none" pointer-events="none"/></svg></div>`;
}
function hgBar(){
  return `<button class="vb" data-hgb="zout" title="Uzaklaştır">−</button><span style="font-size:12px;min-width:40px;text-align:center">%${Math.round(HG.k * 100)}</span><button class="vb" data-hgb="zin" title="Yakınlaştır">+</button><button class="vb" data-hgb="z100">%100</button><span class="vsep"></span>
    <label class="vchk" style="font-size:12px"><input type="checkbox" data-hgb="pins"${HG.pins ? ' checked' : ''}> Grupsuz pinler (pin pin bağlantı)</label><span class="vsep"></span><button class="vb" data-hgb="auto" title="Birim konumlarını sıfırla">Otomatik yerleşim</button><button class="vb" data-hgb="units">Birim arayüzleri</button><button class="vb" data-hgb="sys">Kablaj şeması</button><button class="vb" data-hgb="pdf">Görünümü PDF</button>`;
}
VIEWS['@hcgrp'] = {tr:'Grup Bağlantıları', ic:'GRP', note:'Konnektörlerde tanımlanan pin gruplarını (ör. Haberleşme UART1, UART2, RS-485, Güç) birbirine sürükleyerek bağlayın. Üyeler role göre eşlenir: TX ↔ RX, TX+ ↔ RX+, A ↔ A, CAN_H ↔ CAN_H, GND ↔ GND. Karşı grupta karşılığı olmayan üye uyarılır ama bağlantı engellenmez; eşleşen üyeler otomatik bağlanır.<br><br>Karşılık grubu yoksa veya isterseniz <b>Grupsuz pinler</b> açıkken pin tutamaklarıyla pin pin bağlayabilirsiniz (kablaj detayında da el ile hat eklenebilir).<br><br>Gruplar Birim arayüzleri ve pinout görünümünde, konnektörün <b>Pin grupları</b> bölümünde tanımlanır.', render:hgHTML, bar:hgBar,
  status:() => hgLinks().length + ' grup bağlantısı'};
async function hgPdf(){
  const r = hgSVG({exp:true}), sc = Math.min((HC_PW - 60) / r.w, (HC_PH - HC_TBH - 90) / r.h, 1.6);
  const pseudo = {name:'Grup bağlantıları', dwg:{title:'Grup bağlantıları', no:'GRP-01', rev:'A', date:new Date().toLocaleDateString('tr-TR')}};
  const s = hcT(30, 40, 'GRUP BAĞLANTILARI', {fs:15, b:true}) + `<g transform="translate(30,60) scale(${sc})">${r.svg}</g>` + hcTitleBlock(pseudo, 1, 1, 'Pin grupları');
  const im = await svgToFlate({str:hcFrame(s), w:HC_PW, h:HC_PH}, 2); download(buildPdf([Object.assign(im, {pw:1190.55, ph:841.89, dw:1190.55, dh:841.89, dx:0, dy:0})]), fileSafe((E(M.rootId) ? E(M.rootId).name + ' - ' : '') + 'grup bağlantıları') + '.pdf');
}
function hgReport(res, pa, pb, ga, gb){
  if(!res) return; const miss = [res.missA.length ? hgMissTxt(pa, res.missA) : '', res.missB.length ? hgMissTxt(pb, res.missB) : ''].filter(Boolean).join('; ');
  toast(`${ga.name} ↔ ${gb.name}: ${res.added} hat bağlandı (${res.cable.name})${miss ? ' · ⚠ karşılığı yok: ' + miss : ''}`, miss ? 6000 : undefined);
}
(() => {
  const V = $('#view'), onG = () => ST.cur === '@hcgrp', onU = () => ST.cur === '@hcunits';
  const save = f => { snap(); const r = f(); afterChange(); renderViewBar(); renderView(); return r; };
  const toM = ev => { const sv = $('#hgSvg'), r = sv.getBoundingClientRect(); return {x:(ev.clientX - r.left) / HG.k, y:(ev.clientY - r.top) / HG.k}; };
  let drag = null;
  V.addEventListener('mousedown', ev => { if(!onG() || ev.button !== 0 || !ev.target.closest('#hgSvg')) return;
    const h = ev.target.closest('[data-hgh]'), u = ev.target.closest('[data-hgu]');
    if(h){ const pt = toM(ev); drag = {k:'link', from:h.dataset.hgh, x0:+h.getAttribute('cx'), y0:+h.getAttribute('cy')}; HG.sel = h.dataset.hgh; ev.preventDefault(); return; }
    if(u){ const P = hgLayout(), b = P[u.dataset.hgu], pt = toM(ev); drag = {k:'unit', id:u.dataset.hgu, dx:pt.x - b.x, dy:pt.y - b.y, x:b.x, y:b.y, x0:b.x, y0:b.y, moved:false}; ev.preventDefault(); } });
  window.addEventListener('mousemove', ev => { if(!drag || !onG()) return; const pt = toM(ev);
    if(drag.k === 'link'){ const l = $('#hgTmp'); if(l) l.setAttribute('d', `M${drag.x0},${drag.y0} L${pt.x},${pt.y}`); return; }
    drag.moved = true; drag.x = Math.round((pt.x - drag.dx) / 10) * 10; drag.y = Math.round((pt.y - drag.dy) / 10) * 10;
    document.querySelectorAll(`#hgSvg [data-hgu="${drag.id}"]`).forEach(g => g.setAttribute('transform', `translate(${drag.x - drag.x0},${drag.y - drag.y0})`)); });
  window.addEventListener('mouseup', ev => { if(!drag) return; const d = drag; drag = null; if(!onG()) return;
    if(d.k === 'unit'){ if(d.moved) save(() => { const H = hcM(), P = hgLayout(); H.glay = H.glay || {}; hcUnits().forEach(u => { if(!H.glay[u.id]) H.glay[u.id] = {x:P[u.id].x, y:P[u.id].y}; }); H.glay[d.id] = {x:d.x, y:d.y}; }); return; }
    const l = $('#hgTmp'); if(l) l.setAttribute('d', ''); const t = ev.target.closest && ev.target.closest('[data-hgh]'); if(!t || t.dataset.hgh === d.from) return;
    const [pa0, ka] = d.from.split('|'), [pb0, kb] = t.dataset.hgh.split('|'), pa = E(pa0), pb = E(pb0); if(!pa || !pb) return;
    if(ka[0] !== kb[0]) return toast('Grubu bir gruba, pini bir pine bağlayın');
    if(pa.id === pb.id) return toast('Aynı konnektörün içinde bağlantı yapılmaz');
    if(ka[0] === 'g'){ const ga = hgGet(pa, ka.slice(2)), gb = hgGet(pb, kb.slice(2)); const res = save(() => hgConnect(pa, ga.id, pb, gb.id)); return hgReport(res, pa, pb, ga, gb); }
    const res = save(() => hgPinConnect(pa, ka.slice(2), pb, kb.slice(2))); toast(res.added ? `${hgPinTxt(pa, ka.slice(2))} ↔ ${hgPinTxt(pb, kb.slice(2))} bağlandı (${res.cable.name})` : 'Bu iki pin zaten bağlı'); });
  V.addEventListener('dblclick', ev => { if(!onG()) return; const l = ev.target.closest('[data-cab]'); if(l && l.dataset.cab) hcOpenCable(l.dataset.cab); });
  V.addEventListener('wheel', ev => { if(!onG() || !ev.ctrlKey || !ev.target.closest('#hgWrap')) return; ev.preventDefault(); HG.k = Math.max(0.3, Math.min(2.5, HG.k * (ev.deltaY < 0 ? 1.1 : 1 / 1.1))); renderView(); renderViewBar(); }, {passive:false});
  document.addEventListener('click', ev => {
    const c = onG() && ev.target.closest && ev.target.closest('[data-hgc]'); if(c){ const p = E(c.dataset.hgc); if(p){ HC.unit = p.owner; HC.port = p.id; openD('@hcunits'); } return; }
    const b = ev.target.closest && ev.target.closest('[data-hgb]'); if(b && onG() && b.tagName !== 'INPUT'){ const a = b.dataset.hgb;
      if(a === 'zin' || a === 'zout') HG.k = Math.max(0.3, Math.min(2.5, HG.k * (a === 'zin' ? 1.2 : 1 / 1.2))); else if(a === 'z100') HG.k = 1;
      else if(a === 'auto'){ if(!confirm('Birimlerin grup görünümündeki konumları sıfırlansın mı?')) return; return save(() => { hcM().glay = {}; }); }
      else if(a === 'units') return openD('@hcunits'); else if(a === 'sys') return openD('@hcsys'); else if(a === 'pdf') return hgPdf();
      renderView(); renderViewBar(); return; }
    const g = ev.target.closest && ev.target.closest('[data-hg]'); if(!g) return; const a = g.dataset.hg;
    if(a === 'grp'){ ev.preventDefault(); return openD('@hcgrp'); }
    if(!onU()) return; const p = E(HC.port); if(!p) return; ev.preventDefault();
    if(a === 'open') return openD('@hcgrp');
    if(a === 'add') return save(() => { const gr = hgNewGroup(p, HG.kind); toast(`${gr.name} eklendi · ${gr.mem.filter(m => m.no).length}/${gr.mem.length} üyeye pin önerildi`); });
    const gr = hgGet(p, g.dataset.g); if(!gr) return;
    if(a === 'del'){ if(!confirm(gr.name + ' grubu silinsin mi? (Hatlar silinmez)')) return; return save(() => { p.hc.grps = hgOf(p).filter(x => x !== gr); }); }
    if(a === 'madd') return save(() => { gr.mem.push({role:'', no:''}); });
    if(a === 'mdel') return save(() => { gr.mem.splice(+g.dataset.i, 1); });
    if(a === 'fill') return save(() => { const taken = new Set(hgOf(p).flatMap(x => x.mem.map(m => m.no)).filter(Boolean)); let n = 0; gr.mem.forEach(m => { if(!m.no){ const no = hgGuess(p, m.role, taken); if(no){ m.no = no; taken.add(no); n++; } } }); toast(n ? n + ' üyeye pin önerildi' : 'Önerilecek pin bulunamadı'); });
  });
  V.addEventListener('change', ev => { const t = ev.target;
    if(onG() && t.dataset.hgb === 'pins'){ HG.pins = t.checked; renderView(); return; }
    if(!onU()) return; const p = E(HC.port); if(!p) return;
    if(t.dataset.hgf === 'newkind'){ HG.kind = t.value; return; }
    const gr = t.dataset.g && hgGet(p, t.dataset.g); if(!gr) return; const v = t.value.trim();
    if(t.dataset.hgf === 'name') return save(() => { if(v && !hgOf(p).some(x => x !== gr && x.name === v)) gr.name = v; else toast('Grup adı boş veya bu konnektörde kullanılıyor'); });
    if(t.dataset.hgf === 'cat') return save(() => { gr.cat = v; });
    if(t.dataset.hgf === 'kind') return save(() => { const tp = HG_T.find(x => x[0] === v); gr.kind = v; if(tp && tp[1].length){ const old = gr.mem; const taken = new Set(hgOf(p).filter(x => x !== gr).flatMap(x => x.mem.map(m => m.no)).filter(Boolean));
      gr.mem = tp[1].map(role => { const o = old.find(m => hgNorm(m.role) === hgNorm(role)); const no = o && o.no || hgGuess(p, role, taken); if(no) taken.add(no); return {role, no:no || ''}; }); gr.cat = tp[2] || gr.cat; } });
    if(t.dataset.hgm){ const m = gr.mem[+t.dataset.i]; if(!m) return; return save(() => { m[t.dataset.hgm] = v; }); }
  });
})();
/* menüler ve sistem şeması çubuğu */
{ const bS = VIEWS['@hcsys'].bar; VIEWS['@hcsys'].bar = () => bS() + `<button class="vb" data-hg="grp" title="Pin gruplarını (UART1, RS-485, Güç…) sürükleyerek bağla">Grup bağlantıları</button>`; }
{ const _m = hcLibMenu; hcLibMenu = () => { const r = _m(); const i = r.findIndex(x => x && x.t && /^Kablaj şeması/.test(x.t)); r.splice(i < 0 ? r.length : i + 1, 0, {t:'Grup bağlantıları (pin grupları)', f:() => openD('@hcgrp')}); return r; }; }
if(typeof MENU_ADV !== 'undefined') MENU_ADV.analysis = new RegExp(MENU_ADV.analysis.source + '|^Grup bağlantıları');
if(typeof MENU_GROUPS !== 'undefined'){ const g = MENU_GROUPS.analysis.cls.find(x => x[0] === 'Kablaj ve konnektörler'); if(g) g[1] = new RegExp(g[1].source + '|Grup bağlantıları'); }
