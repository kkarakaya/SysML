/* ================= v1.55: KABLAJ ŞEMASI — SİSTEM SEVİYESİ ŞEMA, KABLO DETAYI, DALLANMA / SPLICE, EŞLEŞTİRME DENETİMİ =================
   Kablo (M.hrn.cables[id]): {id, name, len, note, nodes:[{id, kind:'conn', port} | {id, kind:'splice', name}], wires:[{id, a:{n, pin}, b:{n, pin}, on, awg, color, grp, shield, note}]}
   - Bir birim konnektörü (port) en çok bir kabloya takılır. 2'den çok konnektör düğümü = dallanma (Y kablo); splice düğümünde pin yoktur (pin '').
   - "on" false: tel tanımlı ama bağlı değil (combobox ile kaldırılır) — denetime ve sayımlara girmez.
   - Net: açık (on) tellerle birbirine bağlanan pin / splice uçları; uyumluluk net içindeki tüm pin çiftleri için denetlenir. */
const hcCables = () => Object.values(hcR().cables || {}).sort((a, b) => String(a.name).localeCompare(String(b.name), 'tr', {numeric:true}));
const hcNode = (c, nid) => (c.nodes || []).find(n => n.id === nid) || null;
const hcCableOfPort = pid => hcCables().find(c => c.nodes.some(n => n.kind === 'conn' && n.port === pid)) || null;
const hcCablesOfPort = pid => hcCables().filter(c => c.nodes.some(n => n.kind === 'conn' && n.port === pid));
function hcNextCableName(){ const H = hcR(); let n = 1; const used = new Set(Object.values(H.cables || {}).map(c => c.name)); while(used.has('W' + n)) n++; return 'W' + n; }
function hcNodeLabel(c, n, short){
  if(!n) return '?';
  if(n.kind === 'splice') return n.name || 'SP';
  const p = E(n.port), u = p && E(p.owner); return p ? (short ? '' : (u ? u.name + ' · ' : '')) + p.name : '(silinmiş)';
}
const hcEndLabel = (c, e) => { const n = hcNode(c, e.n); return n && n.kind === 'splice' ? hcNodeLabel(c, n) : hcNodeLabel(c, n, true) + '-' + e.pin; };
const hcEndLong = (c, e) => { const n = hcNode(c, e.n); return n && n.kind === 'splice' ? hcNodeLabel(c, n) : hcNodeLabel(c, n) + ' / ' + e.pin; };
function hcEndPin(c, e){ const n = hcNode(c, e.n); if(!n || n.kind !== 'conn') return null; const p = E(n.port); if(!p || !p.hc) return null; return {port:p, no:e.pin, d:(p.hc.pins || {})[e.pin] || {}}; }
const hcWireName = (c, i) => c.name + '-' + String(i + 1).padStart(2, '0');
/* ---------- kablo oluşturma ve düzenleme ---------- */
function hcNewCable(portIds, name){
  const H = hcM(), id = 'cb' + uid(), c = {id, name:name || hcNextCableName(), len:'', note:'', nodes:[], wires:[]};
  H.cables[id] = c; (portIds || []).forEach(pid => hcAddConnNode(c, pid, true)); return c;
}
function hcAddConnNode(c, pid, auto){
  if(c.nodes.some(n => n.kind === 'conn' && n.port === pid)) return null;
  const n = {id:'n' + uid(), kind:'conn', port:pid}; c.nodes.push(n);
  if(auto) hcAutoMap(c, n.id);
  return n;
}
function hcAddSplice(c, name){ let k = 1; const used = new Set(c.nodes.filter(n => n.kind === 'splice').map(n => n.name)); while(used.has('SP' + k)) k++; const n = {id:'n' + uid(), kind:'splice', name:name || 'SP' + k}; c.nodes.push(n); return n; }
function hcAddWire(c, a, b, extra){ const w = Object.assign({id:'w' + uid(), a, b, on:true, awg:'', color:'', grp:'', shield:false, note:''}, extra || {}); c.wires.push(w); return w; }
function hcRemoveNode(c, nid){ c.nodes = c.nodes.filter(n => n.id !== nid); c.wires = c.wires.filter(w => w.a.n !== nid && w.b.n !== nid); }
const hcEndKey = e => e.n + '|' + (e.pin || '');
const hcLblMatch = (a, b) => !!(a && b && (a === b || hcR().rules.some(r => (r.a === a && r.b === b) || (r.a === b && r.b === a))));
/* bir konnektör düğümünün dolu pinlerini kablodaki diğer uçlara etiket / kural eşleşmesiyle bağla.
   Eşleşen pin zaten bir tele bağlıysa (dallanma) tel bir splice'a bölünür: A—B  →  A—SP, SP—B, SP—C. Dönüş: eklenen tel sayısı */
function hcAutoMap(c, nid){
  const n = hcNode(c, nid), p = n && E(n.port); if(!p || !p.hc) return 0;
  const wired = new Set(); c.wires.forEach(w => { wired.add(hcEndKey(w.a)); wired.add(hcEndKey(w.b)); });
  let added = 0;
  hcPins(p).filter(x => hcPinUsed(x.d) && !wired.has(nid + '|' + x.no)).forEach(x => {
    const lbl = x.d.lbl, sig = x.d.sig; if(!lbl && !sig) return;
    let best = null, bestWired = null;
    for(const m of c.nodes){
      if(m.id === nid || m.kind !== 'conn') continue; const q = E(m.port); if(!q || !q.hc) continue;
      for(const y of hcPins(q)){
        if(!hcPinUsed(y.d)) continue;
        const ok = lbl ? hcLblMatch(lbl, y.d.lbl) : (!y.d.lbl && y.d.sig && y.d.sig === sig); if(!ok) continue;
        const k = m.id + '|' + y.no; if(!wired.has(k)){ best = {n:m.id, pin:y.no}; break; } if(!bestWired) bestWired = {n:m.id, pin:y.no};
      }
      if(best) break;
    }
    if(best){ hcAddWire(c, {n:nid, pin:x.no}, best); wired.add(hcEndKey(best)); wired.add(nid + '|' + x.no); added++; return; }
    if(bestWired){
      const k = hcEndKey(bestWired), w = c.wires.find(w0 => hcEndKey(w0.a) === k || hcEndKey(w0.b) === k);
      if(!w) return;
      const oth = hcEndKey(w.a) === k ? w.b : w.a, on = hcNode(c, oth.n);
      if(on && on.kind === 'splice'){ hcAddWire(c, {n:nid, pin:x.no}, {n:on.id, pin:''}, {awg:w.awg, grp:'', color:w.color}); }
      else { const sp = hcAddSplice(c), keepB = w.b; w.b = {n:sp.id, pin:''}; hcAddWire(c, {n:sp.id, pin:''}, keepB, {awg:w.awg, color:w.color, grp:w.grp, shield:w.shield}); hcAddWire(c, {n:sp.id, pin:''}, {n:nid, pin:x.no}, {awg:w.awg, color:w.color}); }
      wired.add(nid + '|' + x.no); added++;
    }
  });
  return added;
}
/* ---------- netler ve denetim ---------- */
function hcNets(c){
  const par = new Map(), f = k => { while(par.get(k) !== k){ par.set(k, par.get(par.get(k))); k = par.get(k); } return k; }, add = k => { if(!par.has(k)) par.set(k, k); };
  c.wires.filter(w => w.on !== false).forEach(w => { const a = hcEndKey(w.a), b = hcEndKey(w.b); add(a); add(b); const ra = f(a), rb = f(b); if(ra !== rb) par.set(ra, rb); });
  const nets = new Map(); par.forEach((_, k) => { const r = f(k); if(!nets.has(r)) nets.set(r, []); nets.get(r).push(k); });
  return [...nets.values()].map(keys => ({keys, ends:keys.map(k => { const [n, pin] = k.split('|'); return {n, pin}; })}));
}
const hcI = d => Math.max(hcNum(d && d.ipk) || 0, hcNum(d && d.inom) || 0);
/* telden geçen akım: iki pin uçlu telde büyük olan. Splice'a giden telde düğüm akımı (KCL): pinin akımı ile netteki diğer pinlerin toplamından
   küçük olanı (kaynak teli yüklerin toplamını, yük teli kendi akımını taşır); biri tanımsızsa tanımlı olan. */
function hcWireCurrent(c, w, nets){
  const pa = hcEndPin(c, w.a), pb = hcEndPin(c, w.b);
  if(pa && pb) return Math.max(hcI(pa.d), hcI(pb.d));
  const net = (nets || hcNets(c)).find(x => x.keys.includes(hcEndKey(w.a)));
  const all = net ? net.ends.map(e => ({e, p:hcEndPin(c, e)})).filter(x => x.p) : [];
  const pe = pa || pb; if(!pe) return all.length ? Math.max(...all.map(x => hcI(x.p.d))) : 0;
  const k = hcEndKey(pa ? w.a : w.b), own = hcI(pe.d), others = all.filter(x => hcEndKey(x.e) !== k).reduce((s, x) => s + hcI(x.p.d), 0);
  return +(own > 0 && others > 0 ? Math.min(own, others) : Math.max(own, others)).toFixed(3);
}
const hcAwgRow = awg => (hcR().awg || []).find(r => +r.awg === +awg) || null;
/* kablo denetimi: [{sev, msg, w (tel id) | n (düğüm id)}] */
function hcCableIssues(c){
  const out = [], push = (sev, msg, ref) => out.push(Object.assign({sev, msg}, ref || {}));
  c.nodes.forEach(n => { if(n.kind !== 'conn') return; const p = E(n.port); if(!p || !p.hc){ push('hata', 'Konnektör modelde yok (silinmiş)', {n:n.id}); return; } const o = hcCablesOfPort(p.id).filter(x => x.id !== c.id); if(o.length) push('hata', `${hcNodeLabel(c, n)} başka bir kabloya da takılı (${o.map(x => x.name).join(', ')})`, {n:n.id}); });
  const nets = hcNets(c), seen = new Set();
  nets.forEach(net => {
    const pins = net.ends.map(e => Object.assign({e}, hcEndPin(c, e) || {})).filter(x => x.port);
    for(let i = 0; i < pins.length; i++) for(let j = i + 1; j < pins.length; j++){
      if(pins[i].port.id === pins[j].port.id) continue;
      hcPinCompat(pins[i].d, pins[j].d).forEach(([sev, m]) => { const key = sev + m + hcEndKey(pins[i].e) + hcEndKey(pins[j].e); if(seen.has(key)) return; seen.add(key);
        const w = c.wires.find(w0 => w0.on !== false && [hcEndKey(w0.a), hcEndKey(w0.b)].includes(hcEndKey(pins[i].e))) || {};
        push(sev, `${hcEndLabel(c, pins[i].e)} ↔ ${hcEndLabel(c, pins[j].e)}: ${m}`, {w:w.id}); });
    }
    const sps = net.ends.filter(e => { const n = hcNode(c, e.n); return n && n.kind === 'splice'; });
    if(sps.length && pins.length < 2) push('uyarı', `${sps.map(e => hcNodeLabel(c, hcNode(c, e.n))).join(', ')}: splice'a tek pin bağlı`);
  });
  /* tel denetimi: aynı uç birden çok tele, akım / AWG, kontak AWG aralığı */
  const useCnt = new Map(); c.wires.filter(w => w.on !== false).forEach(w => [w.a, w.b].forEach(e => { const n = hcNode(c, e.n); if(n && n.kind === 'conn'){ const k = hcEndKey(e); useCnt.set(k, (useCnt.get(k) || 0) + 1); } }));
  useCnt.forEach((v, k) => { if(v > 1){ const [n, pin] = k.split('|'); push('uyarı', `${hcEndLabel(c, {n, pin})} pinine ${v} tel bağlı — dallanma için splice kullanın`); } });
  c.wires.forEach((w, i) => {
    if(w.on === false) return;
    if(!hcNode(c, w.a.n) || !hcNode(c, w.b.n)) { push('hata', hcWireName(c, i) + ': ucu olmayan tel', {w:w.id}); return; }
    const I = hcWireCurrent(c, w, nets), r = w.awg ? hcAwgRow(w.awg) : null;
    if(r && I > r.bundle) push(I > r.single ? 'hata' : 'uyarı', `${hcWireName(c, i)}: ${I} A, AWG ${w.awg} kapasitesi demet içinde ${r.bundle} A${I > r.single ? ', tek telde ' + r.single + ' A' : ''}`, {w:w.id});
    [w.a, w.b].forEach(e => { const pe = hcEndPin(c, e); if(!pe || !w.awg) return; const t = hcType(pe.port.hc.ct), pinT = t && (t.pins || []).find(x => x.no === e.pin), k = pinT && hcContact(pinT.size); if(k && (+w.awg < +k.awgThick || +w.awg > +k.awgThin)) push('uyarı', `${hcWireName(c, i)}: AWG ${w.awg}, ${hcEndLabel(c, e)} kontağı (${pinT.size}) ${k.awgThick}–${k.awgThin} AWG kabul eder`, {w:w.id}); });
    if(hcEndKey(w.a) === hcEndKey(w.b)) push('hata', hcWireName(c, i) + ': iki ucu aynı', {w:w.id});
  });
  /* splice üzerinde AWG geçişi: uyar ama engelleme; akım sınırı içindeyse uygun de */
  c.nodes.filter(n => n.kind === 'splice').forEach(n => {
    const ws = c.wires.filter(w => w.on !== false && (w.a.n === n.id || w.b.n === n.id)), gs = [...new Set(ws.map(w => w.awg).filter(Boolean))];
    if(gs.length > 1){ const bad = ws.filter(w => { const r = hcAwgRow(w.awg); return r && hcWireCurrent(c, w, nets) > r.bundle; });
      push(bad.length ? 'uyarı' : 'bilgi', `${n.name}: AWG geçişi (${gs.sort((a, b) => a - b).join(' / ')}) — ${bad.length ? bad.length + ' tel akım sınırını aşıyor' : 'tüm teller akım sınırı içinde ✓'}`, {n:n.id}); }
  });
  /* bağlanmamış dolu pinler */
  c.nodes.filter(n => n.kind === 'conn').forEach(n => { const p = E(n.port); if(!p || !p.hc) return; const free = hcPins(p).filter(x => hcPinUsed(x.d) && !useCnt.has(n.id + '|' + x.no)); if(free.length) push('bilgi', `${hcNodeLabel(c, n)}: ${free.length} dolu pin bu kabloda bağlı değil (${free.slice(0, 8).map(x => x.no).join(', ')}${free.length > 8 ? '…' : ''})`, {n:n.id}); });
  return out;
}
function hcCableStats(c){
  const on = c.wires.filter(w => w.on !== false), byCat = {};
  on.forEach(w => { const pe = hcEndPin(c, w.a) || hcEndPin(c, w.b); const k = pe ? hcPinCat(pe.d) : ''; byCat[k] = (byCat[k] || 0) + 1; });
  const iss = hcCableIssues(c);
  return {wires:on.length, off:c.wires.length - on.length, byCat, iss, nE:iss.filter(x => x.sev === 'hata').length, nW:iss.filter(x => x.sev === 'uyarı').length};
}
/* ---------- sistem şeması (SVG) ---------- */
const HCS = {k:1, tx:20, ty:20, det:false, sel:''};
const HC_UW = 210, HC_UH = 30, HC_RH = 24;
function hcSysLayout(){
  const H = hcR(), us = hcUnits(), lay = H.lay || {}, P = {}, hOf = u => HC_UH + Math.max(1, hcUnitConns(u.id).length) * HC_RH + 8;
  us.forEach(u => { if(lay[u.id]) P[u.id] = {x:lay[u.id].x, y:lay[u.id].y, w:HC_UW, h:hOf(u)}; });
  const fixed = Object.values(P), hit = (x, y, h) => fixed.concat(Object.values(P)).some(r => x < r.x + r.w + 40 && x + HC_UW + 40 > r.x && y < r.y + r.h + 40 && y + h + 40 > r.y);
  let col = 0, x = 40, y = 40, rowH = 0;
  us.forEach(u => { if(P[u.id]) return; const h = hOf(u);
    for(let g = 0; g < 400 && hit(x, y, h); g++){ col++; x += HC_UW + 190; if(col >= 3){ col = 0; x = 40; y += Math.max(rowH, 60) + 90; rowH = 0; } }
    P[u.id] = {x, y, w:HC_UW, h}; rowH = Math.max(rowH, h); col++; x += HC_UW + 190; if(col >= 3){ col = 0; x = 40; y += rowH + 90; rowH = 0; } });
  return P;
}
function hcPortAnchor(P, p, side){ const u = P[p.owner]; if(!u) return null; const i = hcUnitConns(p.owner).findIndex(x => x.id === p.id); return {x:side > 0 ? u.x + u.w : u.x, y:u.y + HC_UH + i * HC_RH + HC_RH / 2}; }
function hcCableColor(c, st){ const top = Object.entries(st.byCat).sort((a, b) => b[1] - a[1])[0]; const cat = top && hcCat(top[0]); return cat ? cat.col : '#555'; }
/* exp: dışa aktarma (olay öznitelikleri ve seçim çizilmez); only: yalnız bu kablolar; catF: yalnız bu hat tipindeki tellerin bulunduğu kablolar (v1.57 mimari görünümleri; verilmezse HCS.catF) */
function hcSysSVG(opt){
  opt = opt || {}; const catF = opt.catF !== undefined ? opt.catF : HCS.catF || '', P = hcSysLayout(), cs = hcCables().filter(c => (!opt.only || opt.only.includes(c.id)) && (!catF || hcCableStats(c).byCat[catF])), det = opt.det != null ? opt.det : HCS.det, HL = typeof hcSearchRes === 'function' ? hcSearchRes(opt) : null;   /* v1.60 arama vurgusu */
  const dimPort = p => catF && p.hc.cat !== catF && !hcPins(p).some(x => hcPinUsed(x.d) && hcPinCat(x.d) === catF);
  let maxX = 400, maxY = 300; Object.values(P).forEach(u => { maxX = Math.max(maxX, u.x + u.w + 60); maxY = Math.max(maxY, u.y + u.h + 60); });
  const usedPorts = new Map(); cs.forEach(c => c.nodes.forEach(n => { if(n.kind === 'conn') usedPorts.set(n.port, c); }));
  let units = '', cables = '', labels = '';
  hcUnits().forEach(u => { const p0 = P[u.id], cs0 = hcUnitConns(u.id); if(catF && cs0.every(dimPort)) return;   /* mimari görünümünde ilgisiz birimler gizli */
    units += `<g class="hcU" ${opt.exp ? '' : `data-hcu="${u.id}"`}${HL && !HL.units.has(u.id) ? ' opacity="0.18"' : ''}><rect x="${p0.x}" y="${p0.y}" width="${p0.w}" height="${p0.h}" rx="6" fill="#fff" stroke="#34495e" stroke-width="1.4"/><rect x="${p0.x}" y="${p0.y}" width="${p0.w}" height="${HC_UH}" rx="6" fill="#34495e"/><rect x="${p0.x}" y="${p0.y + HC_UH - 6}" width="${p0.w}" height="6" fill="#34495e"/>
      <text x="${p0.x + p0.w / 2}" y="${p0.y + 20}" text-anchor="middle" fill="#fff" font-size="13" font-weight="600" style="cursor:move">${esc(u.name)}</text>`;
    cs0.forEach((p, i) => { const y = p0.y + HC_UH + i * HC_RH, cat = hcCat(p.hc.cat), t = hcType(p.hc.ct), cb = usedPorts.get(p.id);
      units += `<g ${opt.exp ? '' : `data-hcpt="${p.id}"`}${dimPort(p) || (HL && !HL.ports.has(p.id)) ? ' opacity="0.3"' : ''}><rect x="${p0.x + 4}" y="${y + 2}" width="${p0.w - 8}" height="${HC_RH - 4}" rx="3" fill="${HL && HL.ports.has(p.id) ? '#fff4d6' : cb ? '#eef5ff' : '#f7f7f7'}" stroke="${HL && HL.ports.has(p.id) ? '#f39c12' : '#dde'}"${HL && HL.ports.has(p.id) ? ' stroke-width="2.2"' : ''}/><rect x="${p0.x + 4}" y="${y + 2}" width="5" height="${HC_RH - 4}" fill="${cat ? cat.col : '#bbb'}"/>
        <text x="${p0.x + 14}" y="${y + 16}" font-size="11.5" font-weight="600">${esc(p.name)}</text><text x="${p0.x + 50}" y="${y + 16}" font-size="10" fill="#667">${(() => { const s0 = (t && (t.pn || t.name)) || 'tip yok', bl = typeof hcPortBadgeLen === 'function' ? hcPortBadgeLen(p) : 0, n = bl ? Math.max(5, Math.floor((146 - bl * 5.7 - 8) / 6.1)) : 26; return esc(s0.length > n ? s0.slice(0, n - 1) + '…' : s0); })()}</text>${typeof hcPortBadge === 'function' ? hcPortBadge(p, p0.x + p0.w - 10, y + 16) : ''}
        ${opt.exp ? '' : `<circle cx="${p0.x}" cy="${y + HC_RH / 2}" r="5" fill="#fff" stroke="#2e86de" stroke-width="1.5" data-hch="${p.id}" style="cursor:crosshair"/><circle cx="${p0.x + p0.w}" cy="${y + HC_RH / 2}" r="5" fill="#fff" stroke="#2e86de" stroke-width="1.5" data-hch="${p.id}" style="cursor:crosshair"/>`}</g>`; });
    if(!cs0.length) units += `<text x="${p0.x + 10}" y="${p0.y + HC_UH + 16}" font-size="11" fill="#999">arayüz yok</text>`;
    units += '</g>'; });
  cs.forEach(c => {
    const cov = (opt.cov != null ? opt.cov : HCS.cov) && typeof hcCableCov === 'function' ? hcCableCov(c) : null;   /* v1.58 test kapsaması katmanı */
    const st = hcCableStats(c), col = cov ? (cov.n && cov.r >= 1 ? '#27ae60' : cov.r > 0 ? '#d68910' : '#c0392b') : catF && hcCat(catF) ? hcCat(catF).col : hcCableColor(c, st), sel = !opt.exp && HCS.sel === c.id, conns = c.nodes.filter(n => n.kind === 'conn' && E(n.port) && P[E(n.port).owner]);
    if(!conns.length) return;
    const cen = conns.map(n => { const p = E(n.port), u = P[p.owner]; return {n, p, cx:u.x + u.w / 2}; }), mx = cen.reduce((s, x) => s + x.cx, 0) / cen.length;
    const anchors = cen.map(x => ({n:x.n, a:hcPortAnchor(P, x.p, (conns.length === 2 ? (cen.find(y => y !== x) || x).cx : mx) >= x.cx ? 1 : -1), side:(conns.length === 2 ? (cen.find(y => y !== x) || x).cx : mx) >= x.cx ? 1 : -1}));
    const sw = det ? Math.min(7, 1.6 + st.wires / 6) : 2.2, attrs = opt.exp ? '' : `data-hcw="${c.id}" style="cursor:pointer"`;
    let path = '', lx, ly;
    if(anchors.length === 2){ const [A, B] = anchors, dx = Math.max(40, Math.abs(B.a.x - A.a.x) / 2.5); path = `M${A.a.x},${A.a.y} C${A.a.x + A.side * dx},${A.a.y} ${B.a.x + B.side * dx},${B.a.y} ${B.a.x},${B.a.y}`; lx = (A.a.x + B.a.x) / 2; ly = (A.a.y + B.a.y) / 2; }
    else { lx = anchors.reduce((s, x) => s + x.a.x + x.side * 60, 0) / anchors.length; ly = anchors.reduce((s, x) => s + x.a.y, 0) / anchors.length; path = anchors.map(x => `M${x.a.x},${x.a.y} C${x.a.x + x.side * 60},${x.a.y} ${lx},${ly} ${lx},${ly}`).join(' '); }
    const hlC = HL ? (HL.cables.has(c.id) ? 1 : -1) : 0;
    cables += `<g ${attrs}${hlC < 0 ? ' opacity="0.12"' : ''}>${hlC > 0 ? `<path d="${path}" fill="none" stroke="#f9d56e" stroke-width="${sw + 8}" stroke-linecap="round" opacity="0.85"/>` : ''}<path d="${path}" fill="none" stroke="transparent" stroke-width="12"/><path d="${path}" fill="none" stroke="${col}" stroke-width="${sel ? sw + 2 : sw}"${st.wires ? '' : ' stroke-dasharray="6 4"'}/>${anchors.length > 2 ? `<circle cx="${lx}" cy="${ly}" r="5" fill="${col}"/>` : ''}
      ${anchors.map(x => `<circle cx="${x.a.x}" cy="${x.a.y}" r="3.5" fill="${col}"/>`).join('')}`;
    const mk0 = cov ? ` · test %${Math.round(cov.r * 100)} (${cov.k}/${cov.n})` : (st.nE ? ' ✖' + st.nE : '') + (st.nW ? ' ⚠' + st.nW : '');
    const lab = det ? `${c.name} · ${catF ? (st.byCat[catF] || 0) + ' / ' : ''}${st.wires} tel${mk0}${c.nodes.some(n => n.kind === 'splice') ? ' · ' + c.nodes.filter(n => n.kind === 'splice').length + ' splice' : ''}` : c.name + mk0;
    const tw = lab.length * 6.4 + 12, lc = cov ? col : st.nE ? '#c0392b' : st.nW ? '#d68910' : col;
    labels += `<g ${attrs}${hlC < 0 ? ' opacity="0.15"' : ''}><rect x="${lx - tw / 2}" y="${ly - 20}" width="${tw}" height="16" rx="8" fill="#fff" stroke="${lc}" stroke-width="${sel || st.nE ? 2 : 1}"/><text x="${lx}" y="${ly - 8}" text-anchor="middle" font-size="11" font-weight="600" fill="${lc}">${esc(lab)}</text>`;
    if(det){ const cats = Object.entries(st.byCat).filter(([k]) => k && (!catF || k === catF)); cats.forEach(([k, v], i) => { const ct = hcCat(k); if(ct) labels += `<text x="${lx}" y="${ly + 10 + i * 12}" text-anchor="middle" font-size="10" fill="${ct.col}" stroke="#fff" stroke-width="3" paint-order="stroke">${esc(ct.name)} ${v}</text>`; }); }
    labels += '</g>';
    cables += '</g>';
  });
  return {svg:`<g class="hcCables">${cables}</g><g class="hcUnits">${units}</g><g class="hcLabels">${labels}</g>`, w:maxX, h:maxY};
}
function hcSysHTML(){
  const us = hcUnits();
  if(!us.length) return `<div style="padding:14px" class="muted">Henüz birim yok. Önce <b>Birim arayüzleri ve pinout</b> görünümünde birimleri ve konnektörlerini tanımlayın. <button class="vb" data-hsa="units">Birim arayüzlerini aç</button></div>`;
  const r = hcSysSVG(), cs = hcCables(), tot = cs.reduce((a, c) => { const s = hcCableStats(c); a.w += s.wires; a.e += s.nE; a.u += s.nW; return a; }, {w:0, e:0, u:0});
  return `<div id="hcSysWrap" style="position:relative;height:calc(100vh - 150px);overflow:hidden;background:#fafbfc;background-image:radial-gradient(#dfe3ea 1px, transparent 1px);background-size:20px 20px">
    <svg id="hcSys" width="100%" height="100%" style="user-select:none"><g id="hcSysG" transform="translate(${HCS.tx},${HCS.ty}) scale(${HCS.k})">${r.svg}</g><path id="hcLink" d="" stroke="#2e86de" stroke-width="2" stroke-dasharray="5 4" fill="none" style="pointer-events:none"/></svg>
    <div style="position:absolute;left:10px;bottom:8px;font-size:11px;background:#fffc;padding:3px 8px;border-radius:4px;color:#556">${cs.length} kablo · ${tot.w} tel${tot.e ? ` · <span style="color:#c0392b">✖ ${tot.e} hata</span>` : ''}${tot.u ? ` · <span style="color:#b9770e">⚠ ${tot.u} uyarı</span>` : ''} — Bağlamak için konnektörün yanındaki ● noktasından başka bir konnektöre sürükleyin · kabloyu açmak için çift tıklayın · tekerlek: yakınlaştır · boş alanı sürükle: kaydır</div></div>`;
}
function hcSysBar(){
  const c = HCS.sel && hcR().cables[HCS.sel];
  return `<button class="vb${HCS.det ? ' pri' : ''}" data-hsa="det" title="Kablolarda tel sayısı, hat tipleri ve denetim sonuçlarını göster">${HCS.det ? 'Detaylı görünüm' : 'Basit görünüm'}</button><span class="vsep"></span>
    <button class="vb" data-hsa="zin">+</button><button class="vb" data-hsa="zout">−</button><button class="vb" data-hsa="fit">Sığdır</button><button class="vb" data-hsa="auto" title="Birim yerleşimini sıfırla">Yerleşimi sıfırla</button><span class="vsep"></span>
    <label>Kablo <select data-hsf="cable" class="noi18n">${hcOpt('', '—', HCS.sel)}${hcCables().map(x => hcOpt(x.id, x.name, HCS.sel)).join('')}</select></label>
    <button class="vb" data-hsa="open"${c ? '' : ' disabled'}>Kabloyu aç</button><button class="vb" data-hsa="del"${c ? '' : ' disabled'} style="color:#c0392b">Bağlantıyı sil</button><span class="vsep"></span><button class="vb" data-hsa="units">Birim arayüzleri</button>`;
}
function hcFit(){
  const r = hcSysSVG(), wr = $('#hcSysWrap'); if(!wr) return; const W = wr.clientWidth || 1000, Hh = wr.clientHeight || 600;
  HCS.k = Math.max(0.2, Math.min(2, Math.min(W / r.w, Hh / r.h))); HCS.tx = 10; HCS.ty = 10; renderView();
}
/* ---------- kablo detayı: pin pin bağlantı şeması ---------- */
const HC_TW = 250, HC_TH = 40, HC_PR = 17;
function hcCableSVG(c, opt){
  opt = opt || {}; const conns = c.nodes.filter(n => n.kind === 'conn'), sps = c.nodes.filter(n => n.kind === 'splice');
  const shown = n => { const p = E(n.port); if(!p || !p.hc) return []; const wired = new Set(c.wires.flatMap(w => [w.a, w.b]).filter(e => e.n === n.id).map(e => e.pin)); return hcPins(p).filter(x => hcPinUsed(x.d) || wired.has(x.no)); };
  const L = conns.slice(0, 1), R = conns.slice(1), W = opt.w || 980, pos = {};
  let yL = 20, yR = 20;
  const table = (n, x, y, side) => { const p = E(n.port), u = p && E(p.owner), t = p && hcType(p.hc.ct), rows = shown(n); pos[n.id] = {x, y, side, rows:{}};
    let s = `<g><rect x="${x}" y="${y}" width="${HC_TW}" height="${HC_TH + Math.max(1, rows.length) * HC_PR + 4}" fill="#fff" stroke="#34495e" stroke-width="1.2"/><rect x="${x}" y="${y}" width="${HC_TW}" height="${HC_TH}" fill="#34495e"/>
      <text x="${x + 8}" y="${y + 16}" fill="#fff" font-size="12.5" font-weight="700">${esc(u ? u.name : '?')} · ${esc(p ? p.name : '?')}</text><text x="${x + 8}" y="${y + 32}" fill="#cfd8e3" font-size="10">${esc(t ? [t.pn || t.name, t.mate ? 'kablo ucu: ' + t.mate : ''].filter(Boolean).join(' · ') : 'tip seçilmedi')}</text>`;
    rows.forEach((r, i) => { const yy = y + HC_TH + i * HC_PR, cat = hcCat(hcPinCat(r.d)), lb = hcLabel(r.d.lbl); pos[n.id].rows[r.no] = yy + HC_PR / 2 + 2;
      const hlP = !opt.exp && typeof hcSearchRes === 'function' && (hcSearchRes({}) || {pins:new Set()}).pins.has(p.id + '|' + r.no);
      s += `<rect x="${x}" y="${yy + 2}" width="${HC_TW}" height="${HC_PR}" fill="${hlP ? '#ffe9a8' : i % 2 ? '#f6f8fb' : '#fff'}"/><rect x="${side > 0 ? x + HC_TW - 4 : x}" y="${yy + 2}" width="4" height="${HC_PR}" fill="${cat ? cat.col : '#ccc'}"/>
        <text x="${x + 10}" y="${yy + 14}" font-size="11" font-weight="700">${esc(r.no)}</text><text x="${x + 40}" y="${yy + 14}" font-size="11">${esc((r.d.sig || '').slice(0, 20))}</text><text x="${x + 170}" y="${yy + 14}" font-size="10" fill="#667">${esc(lb ? lb.name.slice(0, 13) : '')}</text>`; });
    return s + '</g>'; };
  let body = '';
  L.forEach(n => { body += table(n, 20, yL, 1); yL += HC_TH + Math.max(1, shown(n).length) * HC_PR + 30; });
  R.forEach(n => { body += table(n, W - HC_TW - 20, yR, -1); yR += HC_TH + Math.max(1, shown(n).length) * HC_PR + 30; });
  /* splice: bağlı uçların ortalama yüksekliğinde, orta sütunda */
  const endY = e => { const p0 = pos[e.n]; return p0 && p0.rows[e.pin] != null ? p0.rows[e.pin] : null; };
  sps.forEach((n, i) => { const ys = c.wires.filter(w => w.a.n === n.id || w.b.n === n.id).map(w => endY(w.a.n === n.id ? w.b : w.a)).filter(v => v != null); const y = ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : 40 + i * 30;
    pos[n.id] = {x:W / 2, y, splice:true}; });
  sps.map(n => pos[n.id]).sort((a, b) => a.y - b.y).forEach((p0, i, arr) => { if(i && p0.y < arr[i - 1].y + 30) p0.y = arr[i - 1].y + 30; });
  sps.forEach(n => { const p0 = pos[n.id]; body += `<g><circle cx="${p0.x}" cy="${p0.y}" r="7" fill="#34495e"/><text x="${p0.x + 10}" y="${p0.y - 8}" font-size="10.5" font-weight="700">${esc(n.name)}</text></g>`; });
  const iss = hcCableIssues(c), wIss = new Map(); iss.forEach(x => { if(x.w){ const o = wIss.get(x.w) || 0; wIss.set(x.w, Math.max(o, x.sev === 'hata' ? 2 : x.sev === 'uyarı' ? 1 : 0)); } });
  const ept = e => { const p0 = pos[e.n]; if(!p0) return null; if(p0.splice) return {x:p0.x, y:p0.y, side:0}; const y = p0.rows[e.pin]; if(y == null) return null; return {x:p0.side > 0 ? p0.x + HC_TW : p0.x, y, side:p0.side}; };
  let wires = '';
  c.wires.forEach((w, i) => { const A = ept(w.a), B = ept(w.b); if(!A || !B) return;
    const pe = hcEndPin(c, w.a) || hcEndPin(c, w.b), cat = pe && hcCat(hcPinCat(pe.d)), lv = wIss.get(w.id) || 0, col = w.on === false ? '#aab' : lv === 2 ? '#c0392b' : lv === 1 ? '#d68910' : cat ? cat.col : '#444';
    const ax = A.x, bx = B.x, dx = Math.max(30, Math.abs(bx - ax) / 3);
    const d = A.side === B.side && A.side !== 0 ? `M${ax},${A.y} C${ax + A.side * 90},${A.y} ${bx + B.side * 90},${B.y} ${bx},${B.y}` : `M${ax},${A.y} C${ax + (A.side || (bx > ax ? 1 : -1)) * dx},${A.y} ${bx + (B.side || (ax > bx ? 1 : -1)) * dx},${B.y} ${bx},${B.y}`;
    const lab = hcWireName(c, i) + (w.awg ? ' · ' + w.awg + ' AWG' : '') + (w.grp ? ' · ' + w.grp : '');
    wires += `<g ${opt.exp ? '' : `data-hcwire="${w.id}"`}><path d="${d}" fill="none" stroke="${col}" stroke-width="${w.on === false ? 1 : 1.6}"${w.on === false ? ' stroke-dasharray="4 3"' : ''}/>${opt.labels === false ? '' : (() => { const L0 = A.side ? A : B; return `<text x="${L0.x + (L0.side >= 0 ? 6 : -6)}" y="${L0.y - 3}" font-size="8.5" fill="${col}" text-anchor="${L0.side >= 0 ? 'start' : 'end'}">${esc(lab)}</text>`; })()}</g>`; });
  const H = Math.max(yL, yR, 120) + 10;
  return {svg:`<g>${wires}</g>${body}`, w:W, h:H, iss};
}
function hcCableHTML(){
  const c = HCS.cab && hcR().cables[HCS.cab];
  if(!c) return `<div style="padding:14px" class="muted">Kablo seçilmedi. Sistem şemasında bir kabloya çift tıklayın veya üstten seçin.</div>`;
  const r = hcCableSVG(c), st = hcCableStats(c), aw = (hcR().awg || []).map(x => x.awg);
  const free = Object.values(M.els).filter(e => hcIsConn(e) && !hcCableOfPort(e.id)).sort((a, b) => (E(a.owner) ? E(a.owner).name : '').localeCompare(E(b.owner) ? E(b.owner).name : '', 'tr') || String(a.name).localeCompare(String(b.name), 'tr', {numeric:true}));
  const endOpts = cur => { let o = hcOpt('', '—', cur); c.nodes.forEach(n => { if(n.kind === 'splice') o += hcOpt(n.id + '|', n.name, cur); else { const p = E(n.port); if(!p) return; o += `<optgroup label="${esc(hcNodeLabel(c, n))}">${hcPins(p).map(x => hcOpt(n.id + '|' + x.no, hcNodeLabel(c, n, true) + '-' + x.no + (x.d.sig ? ' ' + x.d.sig : ''), cur)).join('')}</optgroup>`; } }); return o; };
  let h = `<div style="padding:10px">
    <div class="hcform" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr));margin-top:0">
      <label>Kablo adı<input data-hck2="name" value="${esc(c.name)}" class="noi18n"></label><label>Maks. uzunluk (m)<input data-hck2="len" value="${esc(c.len == null ? '' : c.len)}"></label><label>Not<input data-hck2="note" value="${esc(c.note || '')}"></label>
      <label>Uçlar<span style="font-size:12px;color:#223;padding-top:4px">${c.nodes.map(n => `<span class="hcchip" style="background:${n.kind === 'splice' ? '#34495e' : '#2e86de'}">${esc(hcNodeLabel(c, n))} <a data-hca2="nrm" data-n="${n.id}" style="cursor:pointer;color:#fff" title="Uçu kablodan çıkar">✕</a></span>`).join(' ')}</span></label></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:12px;margin-bottom:6px">
      <label>Dal ekle <select data-hcf2="branch" class="noi18n">${hcOpt('', '— konnektör seçin —', '')}${free.map(p => hcOpt(p.id, (E(p.owner) ? E(p.owner).name + ' · ' : '') + p.name, '')).join('')}</select></label>
      <button class="vb" data-hca2="splice">+ Splice</button><button class="vb" data-hca2="auto" title="Bağlanmamış dolu pinleri etiket ve eşleşme kurallarına göre bağla">Etiketlere göre eşle</button>
      <span class="vsep"></span><label>Tümüne AWG <select data-hcf2="awgAll">${hcOpt('', '—', '')}${aw.map(a => hcOpt(a, a + ' AWG', '')).join('')}</select></label></div>`;
  if(st.iss.length) h += `<div style="background:#fdf6ec;border:1px solid #f0d9b5;color:#7a4b0b;font-size:12px;padding:5px 8px;border-radius:4px;margin-bottom:6px;max-height:110px;overflow:auto">${st.iss.map(x => `<span style="color:${x.sev === 'hata' ? '#c0392b' : x.sev === 'uyarı' ? '#b9770e' : '#2e6da4'}">${hcSev(x.sev)}</span> ${esc(x.msg)}`).join('<br>')}</div>`;
  h += `<div id="hcCabWrap" style="border:1px solid #dde;border-radius:6px;background:#fff;overflow:auto;max-height:52vh;cursor:grab"><svg id="hcCabSvg" width="${Math.round(r.w * (typeof HC7 !== 'undefined' ? HC7.ck : 1))}" height="${Math.round(r.h * (typeof HC7 !== 'undefined' ? HC7.ck : 1))}" viewBox="0 0 ${r.w} ${r.h}" style="display:block">${r.svg}</svg></div>`;
  h += `<div class="hcsec">Teller <span class="muted" style="font-weight:normal;font-size:12px">${st.wires} bağlı${st.off ? ', ' + st.off + ' bağlı değil' : ''}</span></div>
    <div style="max-height:40vh;overflow:auto"><table class="hcpt"><thead><tr><th>Tel</th><th>Uç A</th><th>Uç B</th><th>Sinyal / etiket</th><th>Durum</th><th>AWG</th><th>Renk</th><th>Bükümlü grup</th><th>Ekranlı</th><th>Akım</th><th>Denetim</th><th></th></tr></thead><tbody>`;
  const nets = hcNets(c), wi = new Map(); st.iss.forEach(x => { if(x.w){ const l = wi.get(x.w) || []; l.push(x); wi.set(x.w, l); } });
  c.wires.forEach((w, i) => { const pe = hcEndPin(c, w.a) || hcEndPin(c, w.b), lb = pe && hcLabel(pe.d.lbl), I = hcWireCurrent(c, w, nets), is = wi.get(w.id) || [], a = f => `data-hcwf="${w.id}|${f}"`;
    h += `<tr class="${w.on === false ? 'unused' : ''}"><td><b>${esc(hcWireName(c, i))}</b></td><td><select ${a('a')} style="min-width:120px">${endOpts(hcEndKey(w.a))}</select></td><td><select ${a('b')} style="min-width:120px">${endOpts(hcEndKey(w.b))}</select></td>
      <td>${esc(pe ? (pe.d.sig || '') + (lb ? ' (' + lb.name + ')' : '') : '')}</td><td><select ${a('on')}>${hcOpt('1', 'Bağlı', w.on === false ? '0' : '1')}${hcOpt('0', 'Bağlı değil', w.on === false ? '0' : '1')}</select></td>
      <td><select ${a('awg')}>${hcOpt('', '—', w.awg)}${aw.map(x => hcOpt(x, x, w.awg)).join('')}</select></td><td><input ${a('color')} value="${esc(w.color || '')}" style="width:70px"></td><td><input ${a('grp')} value="${esc(w.grp || '')}" style="width:70px" title="Aynı grup adını taşıyan teller bükümlü çift / üçlü olarak işaretlenir (ör. TP1)"></td>
      <td style="text-align:center"><input type="checkbox" ${a('shield')}${w.shield ? ' checked' : ''} style="width:auto"></td><td>${I ? I + ' A' : ''}</td>
      <td class="iss" title="${esc(is.map(x => x.msg).join('\n'))}">${is.map(x => `<span style="color:${x.sev === 'hata' ? '#c0392b' : x.sev === 'uyarı' ? '#b9770e' : '#2e86de'}">${hcSev(x.sev)}</span>`).join(' ')}</td><td><button class="vb" data-hca2="wdel" data-w="${w.id}">✕</button></td></tr>`; });
  h += `<tr><td class="muted">yeni</td><td><select id="hcNwA">${endOpts('')}</select></td><td><select id="hcNwB">${endOpts('')}</select></td><td colspan="9"><button class="vb" data-hca2="wadd">+ Tel ekle</button></td></tr></tbody></table></div>
    <p class="muted" style="font-size:11px">Durum "Bağlı değil" seçilen tel tanımlı kalır ama denetime, sayımlara ve teknik resme bağlı olarak girmez. Dallanma için <b>Dal ekle</b>: eşleşen etiketli pin zaten bağlıysa tel otomatik olarak bir splice'a bölünür. Splice üzerindeki AWG geçişleri engellenmez; akım sınırı içinde kalıyorsa uygun olarak işaretlenir.</p></div>`;
  return h;
}
function hcCableBar(){
  return `<button class="vb" data-hsa="sys">◀ Sistem şeması</button><label>Kablo <select data-hsf="cab" class="noi18n">${hcOpt('', '—', HCS.cab)}${hcCables().map(x => hcOpt(x.id, x.name + ' (' + x.nodes.filter(n => n.kind === 'conn').map(n => hcNodeLabel(x, n)).join(' ↔ ') + ')', HCS.cab)).join('')}</select></label>
    <button class="vb" data-hsa="cdel" style="color:#c0392b"${HCS.cab ? '' : ' disabled'}>Kabloyu sil</button>`;
}
VIEWS['@hcsys'] = {tr:'Kablaj Şeması', ic:'HRN', note:'Tüm birimler ve kablolar tek şemada. Bir konnektörün yanındaki <b>●</b> noktasından başka bir konnektöre sürükleyerek kablo oluşturun; pinler etiket ve eşleşme kurallarına göre otomatik bağlanır. Bir kabloya takılı konnektöre sürüklerseniz yeni konnektör o kabloya <b>dal</b> olarak eklenir.<br><br>Kabloya <b>çift tıklayın</b>: yalnız o kablonun pin pin şeması ve tel tablosu açılır. <b>Detaylı görünüm</b> düğmesi kablolarda tel sayısını, hat tiplerini ve denetim sonuçlarını gösterir.<br><br>Kırmızı kablo: eşleştirme hatası (farklı hat tipi, örtüşmeyen gerilim, iki çıkış); turuncu: uyarı.', render:hcSysHTML, bar:hcSysBar, status:() => hcCables().length + ' kablo · ' + hcUnits().length + ' birim'};
VIEWS['@hccable'] = {tr:'Kablo Detayı', ic:'W', note:'Seçili kablonun pin pin bağlantı şeması: uçlarda birim ve konnektör adları, ortada splice\'lar.<br><br>Tel tablosunda uçları değiştirin, <b>Durum</b> ile teli gerçekten bağlı / bağlı değil yapın, AWG, renk, bükümlü grup ve ekran girin.<br><br>Denetim: net içindeki tüm pin çiftleri için hat tipi, etiket, gerilim aralığı ve yön; tel akımı AWG kapasitesine, AWG kontak aralığına göre.', render:hcCableHTML, bar:hcCableBar, status:() => { const c = HCS.cab && hcR().cables[HCS.cab]; if(!c) return ''; const s = hcCableStats(c); return c.name + ' · ' + s.wires + ' tel · ' + s.nE + ' hata · ' + s.nW + ' uyarı'; }};
/* ilk açılışta ekrana sığdır */
if(VIEWS['@hcsys']){ const r0 = VIEWS['@hcsys'].render; VIEWS['@hcsys'].render = () => { const h = r0(); if(!HCS.init && hcUnits().length){ HCS.init = true; setTimeout(hcFit, 0); } return h; }; }
const hcOpenCable = id => { HCS.cab = id; HCS.sel = id; openD('@hccable'); };
/* menü ve iş akışı */
{ const _m = hcLibMenu; hcLibMenu = () => _m().concat([{t:'Kablaj şeması', f:() => openD('@hcsys')}]); }
if(typeof MENU_ADV !== 'undefined') MENU_ADV.analysis = new RegExp(MENU_ADV.analysis.source + '|^Kablaj şeması');
if(typeof WF_STEPS !== 'undefined'){ const s = WF_STEPS.find(x => /kablajı tasarla/.test(x.t)); if(s){ s.a.push(['Kablaj şeması', /^Kablaj şeması/]); const k0 = s.k; s.k = () => k0() + ', ' + hcCables().length + ' kablo'; } }
VALIDATORS.push((add) => { if(!M.hrn) return; hcCables().forEach(c => hcCableIssues(c).filter(x => x.sev !== 'bilgi').forEach(x => { const n = x.n && hcNode(c, x.n), e = n && n.kind === 'conn' ? E(n.port) : null; add(x.sev, 'Kablaj eşleştirme', e, c.name + ': ' + x.msg); })); });
/* port silinince kablo düğümleri temizlenir */
{ const _dm = delModel; delModel = function(ids){ const r = _dm.apply(this, arguments); if(M.hrn && M.hrn.cables) Object.values(M.hrn.cables).forEach(c => c.nodes.filter(n => n.kind === 'conn' && !E(n.port)).forEach(n => hcRemoveNode(c, n.id))); return r; }; }
/* ---------- olaylar ---------- */
(() => {
  const V = $('#view'), onS = () => ST.cur === '@hcsys', onC = () => ST.cur === '@hccable';
  const save = f => { snap(); const r = f(); afterChange(); renderViewBar(); renderView(); return r; };
  const toModel = ev => { const sv = $('#hcSys'), r = sv.getBoundingClientRect(); return {x:(ev.clientX - r.left - HCS.tx) / HCS.k, y:(ev.clientY - r.top - HCS.ty) / HCS.k}; };
  let drag = null;
  V.addEventListener('mousedown', ev => {
    if(!onS() || ev.button !== 0) return; const sv = ev.target.closest && ev.target.closest('#hcSys'); if(!sv) return;
    const h = ev.target.closest('[data-hch]'), u = ev.target.closest('[data-hcu]'), w = ev.target.closest('[data-hcw]');
    if(h){ const pt = toModel(ev); drag = {k:'link', from:h.dataset.hch, x0:pt.x, y0:pt.y}; ev.preventDefault(); return; }
    if(w){ HCS.sel = w.dataset.hcw; renderViewBar(); document.querySelectorAll('#hcSys [data-hcw]').forEach(g0 => g0.style.filter = g0 === w ? 'drop-shadow(0 0 3px #2e86de)' : ''); return; }
    if(u){ const P = hcSysLayout(), p0 = P[u.dataset.hcu], pt = toModel(ev); drag = {k:'unit', id:u.dataset.hcu, dx:pt.x - p0.x, dy:pt.y - p0.y, el:u, x:p0.x, y:p0.y, moved:false}; ev.preventDefault(); return; }
    drag = {k:'pan', sx:ev.clientX, sy:ev.clientY, tx:HCS.tx, ty:HCS.ty}; ev.preventDefault();
  });
  window.addEventListener('mousemove', ev => {
    if(!drag || !onS()) return; const g = $('#hcSysG'); if(!g) return;
    if(drag.k === 'pan'){ HCS.tx = drag.tx + ev.clientX - drag.sx; HCS.ty = drag.ty + ev.clientY - drag.sy; g.setAttribute('transform', `translate(${HCS.tx},${HCS.ty}) scale(${HCS.k})`); return; }
    const pt = toModel(ev);
    if(drag.k === 'unit'){ drag.moved = true; drag.x = Math.round((pt.x - drag.dx) / 10) * 10; drag.y = Math.round((pt.y - drag.dy) / 10) * 10; const P = hcSysLayout(), p0 = P[drag.id]; drag.el.setAttribute('transform', `translate(${drag.x - p0.x},${drag.y - p0.y})`); return; }
    if(drag.k === 'link'){ const l = $('#hcLink'); l.setAttribute('d', `M${drag.x0 * HCS.k + HCS.tx},${drag.y0 * HCS.k + HCS.ty} L${pt.x * HCS.k + HCS.tx},${pt.y * HCS.k + HCS.ty}`); }
  });
  window.addEventListener('mouseup', ev => {
    if(!drag) return; const d = drag; drag = null; if(!onS()) return;
    if(d.k === 'unit' && d.moved) return save(() => { const H = hcM(), P = hcSysLayout(); hcUnits().forEach(u => { if(!H.lay[u.id]) H.lay[u.id] = {x:P[u.id].x, y:P[u.id].y}; }); H.lay[d.id] = {x:d.x, y:d.y}; });
    if(d.k === 'link'){ const l = $('#hcLink'); if(l) l.setAttribute('d', ''); const t = ev.target.closest && (ev.target.closest('[data-hch]') || ev.target.closest('[data-hcpt]')); if(!t) return; const to = t.dataset.hch || t.dataset.hcpt; if(!to || to === d.from) return; hcConnect(d.from, to); }
  });
  V.addEventListener('wheel', ev => { if(!onS() || !ev.target.closest('#hcSys')) return; ev.preventDefault(); const r = $('#hcSys').getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top, k0 = HCS.k, k = Math.max(0.15, Math.min(3, k0 * (ev.deltaY < 0 ? 1.12 : 1 / 1.12)));
    HCS.tx = mx - (mx - HCS.tx) * k / k0; HCS.ty = my - (my - HCS.ty) * k / k0; HCS.k = k; const g = $('#hcSysG'); if(g) g.setAttribute('transform', `translate(${HCS.tx},${HCS.ty}) scale(${HCS.k})`); }, {passive:false});
  V.addEventListener('dblclick', ev => { if(!onS()) return; const w = ev.target.closest('[data-hcw]'); if(w) return hcOpenCable(w.dataset.hcw); const p = ev.target.closest('[data-hcpt]'); if(p){ const e = E(p.dataset.hcpt); if(e){ HC.unit = e.owner; HC.port = e.id; openD('@hcunits'); } } });
  V.addEventListener('keydown', ev => { if(onC() && ev.target.matches && ev.target.matches('input,select')){ ev.stopPropagation(); if(ev.key === 'Enter') ev.target.blur(); } });
  V.addEventListener('change', ev => {
    const t = ev.target, v = t.type === 'checkbox' ? t.checked : t.value.trim();
    if((onS() || onC()) && t.dataset.hsf){ if(t.dataset.hsf === 'cable'){ HCS.sel = v; renderViewBar(); renderView(); } else { HCS.cab = v; HCS.sel = v; renderViewBar(); renderView(); } return; }
    if(!onC()) return; const c = HCS.cab && hcM().cables[HCS.cab]; if(!c) return;
    if(t.dataset.hck2){ const k = t.dataset.hck2; return save(() => { if(k === 'name'){ if(v && !hcCables().some(x => x.id !== c.id && x.name === v)) c.name = v; else toast('Kablo adı boş veya başka kabloda kullanılıyor'); } else if(k === 'len') c.len = v === '' ? '' : (numOf(v) == null ? c.len : numOf(v)); else c[k] = v; }); }
    if(t.dataset.hcf2 === 'branch' && v) return save(() => { const n = hcAddConnNode(c, v, true); toast(n ? 'Dal eklendi' : 'Konnektör zaten bu kabloda'); });
    if(t.dataset.hcf2 === 'awgAll' && v) return save(() => { c.wires.forEach(w => w.awg = +v); });
    if(t.dataset.hcwf){ const [wid, f] = t.dataset.hcwf.split('|'), w = c.wires.find(x => x.id === wid); if(!w) return;
      return save(() => { if(f === 'a' || f === 'b'){ if(!v) return; const [n, pin] = v.split('|'); w[f] = {n, pin:pin || ''}; } else if(f === 'on') w.on = v === '1'; else if(f === 'awg') w.awg = v === '' ? '' : +v; else if(f === 'shield') w.shield = !!v; else w[f] = v; }); }
  });
  document.addEventListener('click', ev => {
    if(!onS() && !onC()) return;
    const b = ev.target.closest('[data-hsa]');
    if(b){ const a = b.dataset.hsa;
      if(a === 'det'){ HCS.det = !HCS.det; renderViewBar(); renderView(); return; }
      if(a === 'zin' || a === 'zout'){ HCS.k = Math.max(0.15, Math.min(3, HCS.k * (a === 'zin' ? 1.2 : 1 / 1.2))); renderView(); return; }
      if(a === 'fit') return hcFit();
      if(a === 'auto'){ if(!confirm('Birimlerin şemadaki konumları sıfırlansın mı?')) return; return save(() => { hcM().lay = {}; }); }
      if(a === 'open' && HCS.sel) return hcOpenCable(HCS.sel);
      if(a === 'del' && HCS.sel) return hcDelCable(HCS.sel);
      if(a === 'units') return openD('@hcunits');
      if(a === 'sys') return openD('@hcsys');
      if(a === 'cdel' && HCS.cab){ const id = HCS.cab; hcDelCable(id, () => openD('@hcsys')); return; }
      return; }
    const b2 = ev.target.closest('[data-hca2]'); if(!b2 || !onC()) return;
    const c = HCS.cab && hcM().cables[HCS.cab]; if(!c) return; const a = b2.dataset.hca2;
    if(a === 'splice') return save(() => { hcAddSplice(c); });
    if(a === 'auto') return save(() => { const n = c.nodes.filter(x => x.kind === 'conn').reduce((s, x) => s + hcAutoMap(c, x.id), 0); toast(n ? n + ' tel eklendi' : 'Eşlenecek pin bulunamadı'); });
    if(a === 'wdel') return save(() => { c.wires = c.wires.filter(w => w.id !== b2.dataset.w); });
    if(a === 'wadd'){ const A = $('#hcNwA').value, B = $('#hcNwB').value; if(!A || !B || A === B) return toast('İki farklı uç seçin'); const [na, pa] = A.split('|'), [nb, pb] = B.split('|'); return save(() => { hcAddWire(c, {n:na, pin:pa || ''}, {n:nb, pin:pb || ''}); }); }
    if(a === 'nrm'){ const n = hcNode(c, b2.dataset.n); if(!n) return; if(!confirm(hcNodeLabel(c, n) + ' kablodan çıkarılsın mı? Bağlı teller silinir.')) return; return save(() => { hcRemoveNode(c, n.id); }); }
  });
})();
function hcConnect(fromId, toId){
  const a = E(fromId), b = E(toId); if(!hcIsConn(a) || !hcIsConn(b)) return;
  if(a.owner === b.owner && !confirm('İki konnektör aynı birimde. Yine de bağlansın mı?')) return;
  const ca = hcCableOfPort(a.id), cb = hcCableOfPort(b.id);
  if(ca && cb){ if(ca.id === cb.id) return toast('Bu iki konnektör zaten ' + ca.name + ' kablosunda'); return toast(`${a.name} ${ca.name} kablosunda, ${b.name} ${cb.name} kablosunda — bir konnektör yalnız bir kabloya takılır`); }
  snap();
  let c, msg;
  if(ca || cb){ c = ca || cb; const nw = ca ? b : a; hcAddConnNode(c, nw.id, true); msg = `${nw.name} ${c.name} kablosuna dal olarak eklendi`; }
  else { c = hcNewCable([a.id, b.id]); msg = `${c.name} oluşturuldu: ${c.wires.length} tel etiketlere göre bağlandı`; }
  HCS.sel = c.id; afterChange(); hcRefresh();
  const s = hcCableStats(c); toast(msg + (s.nE ? ` · ${s.nE} hata` : '') + (s.nW ? ` · ${s.nW} uyarı` : ''));
  return c;
}
function hcDelCable(id, then){ const c = hcR().cables[id]; if(!c) return; if(!confirm(c.name + ' kablosu ve ' + c.wires.length + ' teli silinsin mi?')) return; snap(); delete hcM().cables[id]; if(HCS.sel === id) HCS.sel = ''; if(HCS.cab === id) HCS.cab = ''; afterChange(); hcRefresh(); if(then) then(); }
function hcRefresh(){ if(VIEWS[ST.cur] && $('#view .vbar')){ renderViewBar(); renderView(); } }
