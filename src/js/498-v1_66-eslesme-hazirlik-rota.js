/* ================= v1.66 — EŞLEŞME TABLOSU, TAKILI KONNEKTÖRLER VE TEST HAZIRLIĞI, ROTA BULMA, GEÇİŞ KONNEKTÖRÜ =================
   1) Kablaj ↔ konnektör eşleşme tablosu: her kablaj (birleşik hücre), uçları (n.ref, varsayılan P1, P2…), takıldığı konnektör ve karşı taraf
      (birim ya da geçiş konnektörünün öbür yanındaki kablaj, birleşik hücre). Excel (birleşik hücreli) ve A3 PDF.
   2) Takılı konnektörler: kablaj düğümünde n.mated (sistem şemasında "Takılı işaretle" kipi, eşleşme tablosunda kutu). Bir hat, geçtiği bütün
      kablaj uçları takılıysa icra edilebilir; test hazırlığı = icra edilebilir hat / testin hatları (adımlardan değil, hat sayısından).
   3) Rota bulma: "Birim1 - Birim5 arası haberleşme" → kablajlar ve birim içi geçişler üzerinden en kısa yollar. Bilinmeyen birim içi geçişler
      pin gruplarından (aynı tür / rol), sinyal adından ve etiketten tahmin edilip önerilir; onaylanan geçişler birime yazılır (u.hcLinks [{a, b, why}]).
   4) Geçiş konnektörü: kablajın bir ucunda araya 1:1 ara konnektör (u.hcInline, iki yan A / B, pin numarası aynı); o uçtaki hatlar yeni kablaja
      aktarılır. Hat tablosunda "yan yana" kip: her hattın başlangıçtan sona geçtiği konnektörler ve kablajlar ayrı hücrelerde. */
const HC10 = {mateOpen:false};
const hcNodeOfPort = (c, pid) => (c.nodes || []).find(n => n.kind === 'conn' && n.port === pid) || null;
const hcNodeRef = (c, n) => n.ref || 'P' + (c.nodes.filter(x => x.kind === 'conn').indexOf(n) + 1);
function hcPortMated(pid){ const c = hcCableOfPort(pid), n = c && hcNodeOfPort(c, pid); return !!(n && n.mated); }
/* ---------- 4) geçiş konnektörü ---------- */
function hcNextInlineName(){ const used = new Set(Object.values(M.els).filter(e => e.kind === 'Block').map(e => e.name)); let k = 1; while(used.has('X' + k)) k++; return 'X' + k; }
function hcInsertInline(c, nid, o){
  o = o || {}; const n = hcNode(c, nid), p = n && n.kind === 'conn' && E(n.port); if(!p || !p.hc) return null;
  const u0 = E(p.owner), t = hcType(p.hc.ct), mate = t && t.mate ? hcTypes().find(x => x.pn === t.mate) : null;
  const P0 = hcSysLayout(), H = hcM();
  const X = hcNewUnit(o.name || hcNextInlineName(), u0 && E(u0.owner) ? u0.owner : undefined); X.hcInline = true; X.hcThru = true;
  const A = hcNewPort(X.id, 'A'), B = hcNewPort(X.id, 'B'); A.hc.ct = p.hc.ct; B.hc.ct = mate ? mate.id : p.hc.ct; A.hc.cat = B.hc.cat = p.hc.cat;
  A.hc.desc = 'Geçiş konnektörü — ' + c.name + ' tarafı'; B.hc.desc = 'Geçiş konnektörü — ' + (u0 ? u0.name + ' ' : '') + p.name + ' tarafı';
  const pins = [...new Set(c.wires.flatMap(w => [w.a, w.b]).filter(e => e.n === nid).map(e => e.pin))].sort((a, b) => String(a).localeCompare(String(b), 'tr', {numeric:true}));
  pins.forEach(no => { const d = (p.hc.pins || {})[no] || {}, cp = {}; ['sig', 'lbl', 'cat', 'vmin', 'vmax', 'inom', 'ipk'].forEach(k => { if(d[k] != null && d[k] !== '') cp[k] = d[k]; }); cp.dir = 'pas'; if(!cp.sig) cp.sig = (d.lbl && (hcLabel(d.lbl) || {}).name) || 'P' + no;
    A.hc.pins[no] = Object.assign({}, cp); B.hc.pins[no] = Object.assign({}, cp); });
  n.port = A.id; delete n.mated;
  const c2 = hcNewCable([], o.cable || '', {auto:false}), na = hcAddConnNode(c2, B.id, false), nb = hcAddConnNode(c2, p.id, false);
  pins.forEach(no => { const w = c.wires.find(x => x.on !== false && [x.a, x.b].some(e => e.n === nid && e.pin === no)) || {}; hcAddWire(c2, {n:na.id, pin:no}, {n:nb.id, pin:no}, {awg:w.awg || '', color:w.color || '', grp:w.grp || '', shield:!!w.shield}); });
  /* yerleşim: mevcut konumları sabitle, geçiş konnektörünü iki tarafın arasına (altına) koy */
  hcUnits().forEach(u => { if(!H.lay[u.id] && P0[u.id]) H.lay[u.id] = {x:P0[u.id].x, y:P0[u.id].y}; });
  const oth = c.nodes.filter(x => x.kind === 'conn' && x.id !== nid).map(x => E(x.port)).filter(Boolean).map(q => P0[q.owner]).filter(Boolean), me = u0 && P0[u0.id];
  if(me){ const ox = oth.length ? oth.reduce((s, r) => s + r.x, 0) / oth.length : me.x + 400, oy = oth.length ? oth.reduce((s, r) => s + r.y, 0) / oth.length : me.y;
    const hX = HC_UH + 2 * HC_RH + 8, boxes = hcUnits().filter(u => u.id !== X.id && P0[u.id]).map(u => P0[u.id]), hit = (x, y) => boxes.some(r => x < r.x + r.w + 30 && x + HC_UW + 30 > r.x && y < r.y + r.h + 30 && y + hX + 30 > r.y);
    let x = Math.round((me.x + ox) / 2 / 10) * 10, y = Math.round((me.y + oy) / 2 / 10) * 10;
    for(let g = 0; g < 200 && hit(x, y); g++){ y += 20; if(g % 40 === 39){ x += HC_UW + 40; y = Math.round((me.y + oy) / 2 / 10) * 10; } }
    H.lay[X.id] = {x, y}; }
  return {X, A, B, cable:c2, pins:pins.length};
}
function hcInlineDialog(c){
  const cs = c.nodes.filter(n => n.kind === 'conn' && E(n.port)); if(!cs.length) return toast('Kablajda birim konnektörü yok');
  quickForm(c.name + ' — geçiş konnektörü ekle', [{k:'side', l:'Hangi uçta araya girsin', t:'select', opts:cs.map(n => [n.id, hcNodeLabel(c, n) + ' tarafında']), v:cs[cs.length - 1].id},
    {k:'name', l:'Geçiş konnektörü adı', v:hcNextInlineName()}, {k:'cable', l:'Yeni kablaj adı (öbür yan)', v:hcNextCableName()}], r => {
    if(r.cable && hcAllCables().some(x => x.name === r.cable)) return 'Bu kablaj adı kullanılıyor';
    snap(); const res = hcInsertInline(c, r.side, r); afterChange(); hcRefresh(); renderTree && renderTree();
    if(res) toast(`${res.X.name} eklendi: ${c.name} → ${res.X.name} · A, ${res.cable.name} ← ${res.X.name} · B (${res.pins} hat 1:1)`); },
    'Düz kablajın ortasına montaj kolaylığı için konulan 1:1 ara konnektör. Seçilen uçtaki hatlar <b>X · A</b> konnektöründe biter; <b>X · B</b> ile birim konnektörü arasında aynı pin numaralarıyla yeni bir kablaj oluşur. Hat tablosunda hat iki kablaj boyunca tek satırda izlenir.');
}
/* ---------- 1) eşleşme tablosu ---------- */
function hcMateBlocks(cs){
  return (cs || hcCables()).map(c => ({c, rows:c.nodes.filter(n => n.kind === 'conn').map(n => {
    const p = E(n.port), u = p && E(p.owner), t = p && hcType(p.hc.ct), inl = !!(u && u.hcInline);
    let other = u ? u.name : '?', kind = 'birim';
    if(inl){ const q = hcUnitConns(u.id).find(x => x.id !== p.id), oc = q && hcCablesOfPort(q.id).find(x => x.id !== c.id); other = oc ? oc.name : u.name + ' (öbür yan boş)'; kind = 'kablaj'; }
    return {c, n, ref:hcNodeRef(c, n), plug:inl ? (t && (t.pn || t.name)) || '' : (t && t.mate) || '', conn:p ? (u ? u.name + ' · ' : '') + p.name : '(silinmiş)', other, kind, inl, mated:!!n.mated}; })})).filter(b => b.rows.length);
}
/* aynı değerli ardışık satırları birleştir: [[başlangıç, uzunluk]] */
const hcRuns2 = (rows, f) => { const out = []; rows.forEach((r, i) => { const v = f(r); if(i && v === f(rows[i - 1])) out[out.length - 1][1]++; else out.push([i, 1]); }); return out; };
function hcMateXlsx(cs){
  const B = hcMateBlocks(cs); if(!B.length) return toast('Kablaj yok');
  const hd = ['Kablaj', 'Kablaj ucu', 'Kablaj ucu parça no', 'Takıldığı konnektör', 'Birim / karşı kablaj', 'Takıldı'].map(v => ({v, s:1})), rows = [hd], merges = [];
  B.forEach(b => { const r0 = rows.length;
    b.rows.forEach((r, i) => rows.push([i ? {v:'', s:7} : {v:b.c.name, s:7}, r.ref, r.plug, r.conn, {v:r.other, s:r.kind === 'kablaj' ? 7 : 6}, r.mated ? {v:'✓', s:3} : '']));
    if(b.rows.length > 1) merges.push(`A${r0 + 1}:A${r0 + b.rows.length}`);
    hcRuns2(b.rows, r => r.other).forEach(([i, k]) => { if(k > 1){ merges.push(`E${r0 + i + 1}:E${r0 + i + k}`); for(let j = 1; j < k; j++) rows[r0 + i + j][4] = {v:'', s:rows[r0 + i][4].s}; } }); });
  const tot = B.reduce((s, b) => s + b.rows.length, 0), mt = B.reduce((s, b) => s + b.rows.filter(r => r.mated).length, 0);
  download(buildXlsx([{name:'Eşleşme tablosu', rows, merges, widths:[14, 12, 24, 34, 26, 9], header:true, freeze:[0, 1]},
    {name:'Özet', rows:[[{v:'Kablaj', s:1}, {v:'Uç', s:1}, {v:'Takılı', s:1}]].concat(B.map(b => [b.c.name, b.rows.length, b.rows.filter(r => r.mated).length])).concat([[{v:'Toplam', s:6}, tot, mt]]), widths:[16, 8, 8], header:true}]),
    fileSafe((E(M.rootId) ? E(M.rootId).name + ' - ' : '') + 'kablaj konnektör eşleşme tablosu') + '.xlsx');
}
async function hcMatePdf(cs){
  const B = hcMateBlocks(cs); if(!B.length) return toast('Kablaj yok');
  const cols = [['Kablaj', 170], ['Kablaj ucu', 110], ['Kablaj ucu parça no', 230], ['Takıldığı konnektör', 340], ['Birim / karşı kablaj', 250], ['Takıldı', 80]], RH = 20, X0 = 30, Y0 = 74;
  const W = cols.reduce((s, c) => s + c[1], 0), maxY = HC_PH - 20 - HC_TBH - 20, pages = [[]]; let y = Y0 + RH + 2;
  B.forEach(b => { const h = b.rows.length * RH; if(y + h > maxY && pages[pages.length - 1].length){ pages.push([]); y = Y0 + RH + 2; } pages[pages.length - 1].push(b); y += h; });
  const fit = (s, w) => { s = String(s || ''); const m = Math.floor(w / 6.2); return s.length > m ? s.slice(0, m - 1) + '…' : s; };
  const pseudo = {name:'Eşleşme', dwg:{title:'Kablaj – konnektör eşleşme tablosu', no:'ESLESME', rev:'A', date:new Date().toLocaleDateString('tr-TR')}}, out = [];
  const tot = B.reduce((s, b) => s + b.rows.length, 0), mt = B.reduce((s, b) => s + b.rows.filter(r => r.mated).length, 0);
  toast('Eşleşme tablosu PDF hazırlanıyor…');
  for(let pi = 0; pi < pages.length; pi++){
    let s = hcT(X0, 40, 'KABLAJ – KONNEKTÖR EŞLEŞME TABLOSU', {fs:15, b:true}) + hcT(X0, 58, `${B.length} kablaj · ${tot} kablaj ucu · ${mt} takılı · sayfa ${pi + 1} / ${pages.length}`, {fs:10.5, c:'#444'});
    let cx = X0; s += `<rect x="${X0}" y="${Y0}" width="${W}" height="${RH + 2}" fill="#26364b"/>`; cols.forEach(([h, w]) => { s += hcT(cx + 6, Y0 + RH - 5, h, {fs:10.5, b:true, c:'#fff'}); cx += w; });
    let yy = Y0 + RH + 2;
    pages[pi].forEach(b => { const h = b.rows.length * RH, xs = []; let x = X0; cols.forEach(([, w]) => { xs.push(x); x += w; });
      b.rows.forEach((r, i) => { const ry = yy + i * RH; s += `<rect x="${xs[1]}" y="${ry}" width="${W - cols[0][1]}" height="${RH}" fill="${r.mated ? '#e6f7ea' : i % 2 ? '#f6f8fb' : '#fff'}" stroke="#bbb" stroke-width="0.5"/>`;
        s += hcT(xs[1] + 6, ry + 14, r.ref, {fs:10.5, b:true}) + hcT(xs[2] + 6, ry + 14, fit(r.plug, cols[2][1]), {fs:10}) + hcT(xs[3] + 6, ry + 14, fit(r.conn, cols[3][1]), {fs:10.5}) + hcT(xs[5] + cols[5][1] / 2, ry + 14, r.mated ? '✓' : '', {fs:12, b:true, a:'middle', c:'#1e8449'}); });
      hcRuns2(b.rows, r => r.other).forEach(([i, k]) => { const ry = yy + i * RH, r = b.rows[i]; s += `<rect x="${xs[4]}" y="${ry}" width="${cols[4][1]}" height="${k * RH}" fill="${r.kind === 'kablaj' ? '#eef5ff' : '#fff'}" stroke="#555" stroke-width="0.8"/>` + hcT(xs[4] + cols[4][1] / 2, ry + k * RH / 2 + 5, fit(r.other, cols[4][1]), {fs:r.kind === 'kablaj' ? 13 : 11, b:true, a:'middle', c:r.kind === 'kablaj' ? '#1f4e8c' : '#111'}); });
      s += `<rect x="${X0}" y="${yy}" width="${cols[0][1]}" height="${h}" fill="#f0f3f7" stroke="#111" stroke-width="1"/>` + hcT(X0 + cols[0][1] / 2, yy + h / 2 + 6, fit(b.c.name, cols[0][1]), {fs:15, b:true, a:'middle'});
      s += `<rect x="${X0}" y="${yy}" width="${W}" height="${h}" fill="none" stroke="#111" stroke-width="1.2"/>`; yy += h; });
    const im = await svgToFlate({str:hcFrame(s + hcTitleBlock(pseudo, pi + 1, pages.length, 'Eşleşme tablosu')), w:HC_PW, h:HC_PH}, 2); out.push(Object.assign(im, {pw:1190.55, ph:841.89, dw:1190.55, dh:841.89, dx:0, dy:0})); }
  download(buildPdf(out), fileSafe((E(M.rootId) ? E(M.rootId).name + ' - ' : '') + 'kablaj konnektör eşleşme tablosu') + '.pdf');
}
function hcMateHTML(){
  const B = hcMateBlocks(); if(!B.length) return '<div style="padding:14px" class="muted">Kablaj yok. Önce sistem kablaj şemasında birimleri bağlayın.</div>';
  const tot = B.reduce((s, b) => s + b.rows.length, 0), mt = B.reduce((s, b) => s + b.rows.filter(r => r.mated).length, 0);
  let h = `<div style="padding:10px"><div style="font-size:12px;margin-bottom:6px"><b>${B.length}</b> kablaj · <b>${tot}</b> kablaj ucu · <b style="color:#1e8449">${mt} takılı</b> (%${tot ? Math.round(mt / tot * 100) : 0}) <span class="muted">— kablajları takarken kullanın; takılan ucu işaretleyin (test hazırlığı bu işaretlerden hesaplanır). Kablaj ucu adı değiştirilebilir.</span></div>
    <div style="max-height:calc(100vh - 200px);overflow:auto"><table class="hcpt hcmate"><thead><tr><th>Kablaj</th><th>Kablaj ucu</th><th>Kablaj ucu parça no</th><th>Takıldığı konnektör</th><th>Birim / karşı kablaj</th><th>Takıldı</th></tr></thead><tbody>`;
  B.forEach(b => { const runs = new Map(hcRuns2(b.rows, r => r.other).map(([i, k]) => [i, k]));
    b.rows.forEach((r, i) => { h += `<tr style="${r.mated ? 'background:#e6f7ea' : ''}${i ? '' : ';border-top:2px solid #34495e'}">${i ? '' : `<td rowspan="${b.rows.length}" style="font-size:15px;font-weight:700;text-align:center;vertical-align:middle;background:#f0f3f7"><a href="#" data-hc10="cab" data-k="${b.c.id}" class="noi18n">${esc(b.c.name)}</a></td>`}
      <td><input data-hc10r="${b.c.id}|${r.n.id}" value="${esc(r.ref)}" style="width:60px;font-weight:700" class="noi18n"></td><td class="noi18n">${esc(r.plug)}</td><td class="noi18n">${esc(r.conn)}</td>
      ${runs.has(i) ? `<td rowspan="${runs.get(i)}" class="noi18n" style="vertical-align:middle;text-align:center;font-weight:700;${r.kind === 'kablaj' ? 'font-size:14px;color:#1f4e8c;background:#eef5ff' : ''}">${r.kind === 'kablaj' && hcCables().find(x => x.name === r.other) ? `<a href="#" data-hc10="cab" data-k="${hcCables().find(x => x.name === r.other).id}">${esc(r.other)}</a>` : esc(r.other)}</td>` : ''}
      <td style="text-align:center"><input type="checkbox" data-hc10m="${b.c.id}|${r.n.id}"${r.mated ? ' checked' : ''} style="width:auto"></td></tr>`; }); });
  return h + '</tbody></table></div></div>';
}
const hcMateBar = () => `<button class="vb pri" data-hc10="matexl">Excel indir</button><button class="vb" data-hc10="matepdf">PDF indir</button><span class="vsep"></span><button class="vb" data-hc10="mall">Tümü takılı</button><button class="vb" data-hc10="mnone">Hiçbiri</button><span class="vsep"></span><button class="vb" data-hc10="ready">Test hazırlığı</button><button class="vb" data-hc10="sys">Sistem şeması</button>`;
VIEWS['@hcmate'] = {tr:'Eşleşme Tablosu', ic:'MAT', note:'Her kablajın uçları (P1, P2…), takıldıkları konnektörler ve karşı taraf (birim ya da geçiş konnektörünün öbür yanındaki kablaj). Kablajları takarken kullanmak için <b>Excel</b> (birleşik hücreli) ya da <b>PDF</b> indirin.<br><br><b>Takıldı</b> kutusu takılan ucu işaretler; sistem şemasında da <b>Takılı işaretle</b> kipiyle konnektöre tıklayarak işaretleyebilirsiniz. Test hazırlığı bu işaretlerden hesaplanır.',
  render:hcMateHTML, bar:hcMateBar, status:() => { const B = hcMateBlocks(), t = B.reduce((s, b) => s + b.rows.length, 0); return B.length + ' kablaj · ' + B.reduce((s, b) => s + b.rows.filter(r => r.mated).length, 0) + ' / ' + t + ' uç takılı'; }};
/* ---------- 2) takılı konnektörler ve test hazırlığı ---------- */
const hcLineReady = l => l.pins.every(p => { const n = hcNodeOfPort(l.cable, p.port.id); return !!(n && n.mated); });
const hcChainReady = ch => ch.lines.every(hcLineReady);
function hcChainMissing(ch){ const out = []; ch.lines.forEach(l => l.pins.forEach(p => { const n = hcNodeOfPort(l.cable, p.port.id); if(n && !n.mated && !out.some(x => x.n === n)) out.push({c:l.cable, n, txt:`${l.cable.name} ${hcNodeRef(l.cable, n)} ↔ ${hcNodeLabel(l.cable, n)}`}); })); return out; }
function hcTestChains(tc){
  if(hcScopeOf(tc)) return hcTestState(tc).S.sel;
  return hcTestCov(tc).lines.map(l => ({id:l.id, lines:[l], cables:[l.cable], pins:l.pins, cats:l.cats, cat:l.cat, name:l.name}));
}
function hcTestReady(tc){
  const chs = hcTestChains(tc), ready = chs.filter(hcChainReady), miss = [];
  chs.filter(ch => !hcChainReady(ch)).forEach(ch => hcChainMissing(ch).forEach(m => { if(!miss.some(x => x.n === m.n)) miss.push(m); }));
  const steps = hcScopeOf(tc) ? (tc.hcSteps || []).map(s => { const sc = hcStepChains(tc, s, chs); return {s, n:sc.length, k:sc.filter(hcChainReady).length}; }) : [];
  return {chs, ready, n:chs.length, k:ready.length, r:chs.length ? ready.length / chs.length : 0, miss, steps};
}
const hcReadyCol = R => !R.n ? '#999' : R.k === R.n ? '#27ae60' : R.k ? '#d68910' : '#c0392b';
const hcReadyBar = (R, w) => `<span style="display:inline-block;vertical-align:middle;width:${w || 120}px;height:10px;background:#eceff3;border-radius:5px;overflow:hidden"><span style="display:block;width:${Math.round(R.r * 100)}%;height:100%;background:${hcReadyCol(R)}"></span></span>`;
function hcReadyBlock(tc){
  const R = hcTestReady(tc); if(!R.n) return '';
  return `<div style="border:1px solid ${R.k === R.n ? '#9bd3ab' : '#dde'};border-radius:6px;padding:8px 10px;margin:6px 0;background:${R.k === R.n ? '#eefaf1' : '#fff'}">
    <div class="hcsec" style="margin-top:0;display:flex;gap:8px;align-items:center"><span style="flex:1">Hazırlık — takılı konnektörlere göre</span><button class="vb" data-hc10="matemode2" title="Sistem şemasında konnektörlere tıklayarak takılı işaretleyin">Takılı işaretle</button><button class="vb" data-hc10="mate">Eşleşme tablosu</button></div>
    <div style="font-size:13px">${hcReadyBar(R, 200)} <b style="color:${hcReadyCol(R)}">${R.k} / ${R.n} hat icra edilebilir (%${Math.round(R.r * 100)})</b>${R.k === R.n ? ' — test icra edilebilir ✓' : ''}</div>
    ${R.steps.length ? `<div style="font-size:12px;margin-top:6px">${R.steps.map(x => `<div>${x.n && x.k === x.n ? '<span style="color:#27ae60">●</span>' : x.k ? '<span style="color:#d68910">◐</span>' : '<span style="color:#c0392b">○</span>'} ${esc(x.s.txt || 'Adım')} <span class="muted">— ${x.k} / ${x.n} hat${x.n && x.k === x.n ? ', yapılabilir' : ''}</span></div>`).join('')}</div>` : ''}
    ${R.miss.length ? `<div style="font-size:12px;margin-top:6px;color:#7a4b0b">Takılmamış: ${R.miss.slice(0, 10).map(m => `<span class="noi18n">${esc(m.txt)}</span>`).join(' · ')}${R.miss.length > 10 ? ' …' : ''}</div>` : ''}</div>`;
}
function hcReadyRows(){ return hcTests().map(t => ({t, R:hcTestReady(t)})).filter(x => x.R.n); }
function hcReadyHTML(){
  const rows = hcReadyRows(), B = hcMateBlocks(), tot = B.reduce((s, b) => s + b.rows.length, 0), mt = B.reduce((s, b) => s + b.rows.filter(r => r.mated).length, 0);
  if(!rows.length) return `<div style="padding:14px" class="muted">Kapsamı tanımlı kablaj testi yok. Kablaj → Kablaj test tanımı ve kapsama'dan test ekleyin.</div>`;
  return `<div style="padding:10px"><div style="font-size:12px;margin-bottom:6px">${mt} / ${tot} kablaj ucu takılı · <b style="color:#27ae60">${rows.filter(x => x.R.k === x.R.n).length}</b> / ${rows.length} test icra edilebilir <span class="muted">— oran, testin hatlarından geçtiği bütün kablaj uçları takılı olanların payıdır (adım sayısından değil).</span></div>
    <table class="hcpt" style="width:100%"><thead><tr><th>Test</th><th>Hat</th><th>İcra edilebilir</th><th>Hazırlık</th><th>Adımlar</th><th>Takılmamış kablaj uçları</th></tr></thead><tbody>
    ${rows.map(({t, R}) => `<tr style="${R.k === R.n ? 'background:#e6f7ea' : ''}"><td><a href="#" data-hc10="test" data-k="${t.id}" class="noi18n"><b>${esc(t.name)}</b></a></td><td>${R.n}</td><td><b style="color:${hcReadyCol(R)}">${R.k}</b></td><td style="white-space:nowrap">${hcReadyBar(R)} <b style="color:${hcReadyCol(R)}">%${Math.round(R.r * 100)}</b>${R.k === R.n ? ' ✓' : ''}</td>
      <td style="font-size:11.5px">${R.steps.length ? R.steps.filter(x => x.n && x.k === x.n).length + ' / ' + R.steps.length + ' yapılabilir' : '—'}</td><td class="noi18n" style="font-size:11.5px">${R.miss.slice(0, 6).map(m => esc(m.txt)).join('<br>')}${R.miss.length > 6 ? '<br>…' : ''}</td></tr>`).join('')}</tbody></table></div>`;
}
function hcReadyXlsx(){ const rows = hcReadyRows(), hd = a => a.map(v => ({v, s:1}));
  download(buildXlsx([{name:'Test hazırlığı', rows:[hd(['Test', 'Hat', 'İcra edilebilir hat', 'Hazırlık %', 'Yapılabilir adım', 'Takılmamış kablaj uçları'])].concat(rows.map(({t, R}) => [t.name, R.n, R.k, Math.round(R.r * 100), R.steps.length ? R.steps.filter(x => x.n && x.k === x.n).length + ' / ' + R.steps.length : '', R.miss.map(m => m.txt).join('\n')])), widths:[40, 7, 10, 10, 12, 60], header:true, freeze:[0, 1]}]),
    fileSafe((E(M.rootId) ? E(M.rootId).name + ' - ' : '') + 'test hazırlığı') + '.xlsx'); }
VIEWS['@hcready'] = {tr:'Test Hazırlığı', ic:'RDY', note:'Takılı işaretlenen kablaj uçlarına göre her testin <b>icra edilebilir hat</b> sayısı ve yüzdesi. Bir hat, geçtiği bütün kablaj uçları takılıysa icra edilebilir; yüzde adım sayısından değil, testin toplam hat sayısından hesaplanır. Tamamı icra edilebilen testler yeşildir.<br><br>Adım satırında ●: adımın bütün hatları icra edilebilir.',
  render:hcReadyHTML, bar:() => `<button class="vb pri" data-hc10="matemode2">Takılı işaretle (şemada)</button><button class="vb" data-hc10="mate">Eşleşme tablosu</button><span class="vsep"></span><button class="vb" data-hc10="readyxl">Excel</button>`,
  status:() => { const r = hcReadyRows(); return r.filter(x => x.R.k === x.R.n).length + ' / ' + r.length + ' test icra edilebilir'; }};
/* ---------- 3) rota bulma ve birim içi geçiş tahmini ---------- */
const HC10_GEN = /^(gnd|0v|rtn|.*_rtn|.*rtn|shield|shd|chassis|şasi|sasi|nc|spare|yedek)$/i;
const hcPinKey = (p, no) => p.id + '|' + no;
function hcKeyTxt(k){ const [pid, no] = k.split('|'), p = E(pid), u = p && E(p.owner); return `${u ? u.name : '?'} ${p ? p.name : '?'}-${no}`; }
/* birim içinde onaylı geçiş ortakları: içten geçişli (aynı sinyal), geçiş konnektörü (aynı pin no), u.hcLinks */
function hcInnerConfirmed(u){
  const m = new Map(), add = (a, b, why) => { if(!m.has(a)) m.set(a, []); if(!m.has(b)) m.set(b, []); m.get(a).push({k:b, why}); m.get(b).push({k:a, why}); };
  (u.hcLinks || []).forEach(l => add(l.a, l.b, l.why || 'onaylı geçiş'));
  if(u.hcThru){ const by = new Map(); hcUnitConns(u.id).forEach(p => hcPins(p).forEach(q => { const s = u.hcInline ? '#' + q.no : String(q.d.sig || '').trim().toLocaleLowerCase('tr'); if(!s || !hcPinUsed(q.d) && !u.hcInline) return; if(!by.has(s)) by.set(s, []); by.get(s).push(hcPinKey(p, q.no)); }));
    by.forEach(ks => { for(let i = 0; i < ks.length; i++) for(let j = i + 1; j < ks.length; j++) if(ks[i].split('|')[0] !== ks[j].split('|')[0]) add(ks[i], ks[j], u.hcInline ? 'geçiş konnektörü' : 'içten geçişli'); }); }
  return m;
}
/* tahmini birim içi geçişler: farklı konnektörlerdeki pinler arasında — grup (aynı tür ve rol) 3, aynı sinyal adı 2 (genel adlar 1), aynı etiket 1 */
function hcInferPairs(u, cats){
  const ps = hcUnitConns(u.id), conf = hcInnerConfirmed(u), best = new Map(), cs = cats && cats.length ? new Set(cats) : null;
  const ok = (p, q) => hcPinUsed(q.d) && (!cs || cs.has(hcPinCat(q.d)) || cs.has(p.hc.cat));
  const put = (a, b, s, why) => { if(a.split('|')[0] === b.split('|')[0]) return; if((conf.get(a) || []).some(x => x.k === b)) return; const key = [a, b].sort().join('~'), o = best.get(key); if(!o || o.s < s) best.set(key, {a, b, s, why}); };
  const pins = ps.flatMap(p => hcPins(p).filter(q => ok(p, q)).map(q => ({p, q, k:hcPinKey(p, q.no), sig:String(q.d.sig || '').trim().toLocaleLowerCase('tr'), lbl:q.d.lbl || ''})));
  if(typeof hgOf === 'function') ps.forEach((p, i) => ps.slice(i + 1).forEach(q => hgOf(p).forEach(g => hgOf(q).forEach(h => { if(g.kind !== h.kind && hgNorm2(g.name) !== hgNorm2(h.name)) return;
    g.mem.forEach(m => { if(!m.no || !m.role) return; const m2 = h.mem.find(x => x.no && hgNorm2(x.role) === hgNorm2(m.role)); if(m2) put(hcPinKey(p, m.no), hcPinKey(q, m2.no), 3, `grup ${g.name} ↔ ${h.name} (${m.role})`); }); }))));
  for(let i = 0; i < pins.length; i++) for(let j = i + 1; j < pins.length; j++){ const A = pins[i], B = pins[j]; if(A.p.id === B.p.id) continue;
    if(A.sig && A.sig === B.sig) put(A.k, B.k, HC10_GEN.test(A.sig) ? 1 : 2, `aynı sinyal adı ${A.q.d.sig}`);
    else if(A.lbl && A.lbl === B.lbl) put(A.k, B.k, 1, `aynı etiket ${(hcLabel(A.lbl) || {}).name || A.lbl}`); }
  return [...best.values()];
}
const hgNorm2 = s => String(s || '').toLocaleLowerCase('tr').replace(/[\s_\-]+/g, '').replace(/\d+$/, '');
/* rota arama (Dijkstra): kablaj hattı 1, onaylı geçiş 1, tahmini geçiş 1 + (4 − güç) */
function hcFindRoutes(from, to, cats){
  const lines = hcLines(), lineOf = new Map(), cs = cats && cats.length ? new Set(cats) : null; lines.forEach(l => l.pins.forEach(p => lineOf.set(p.key, l)));
  const conf = new Map(), inf = new Map(), unitOf = k => (E(k.split('|')[0]) || {}).owner;
  const innerC = uid0 => { if(!conf.has(uid0)) conf.set(uid0, hcInnerConfirmed(E(uid0))); return conf.get(uid0); };
  const innerI = uid0 => { if(!inf.has(uid0)){ const m = new Map(); hcInferPairs(E(uid0), cats).forEach(x => { [[x.a, x.b], [x.b, x.a]].forEach(([a, b]) => { if(!m.has(a)) m.set(a, []); m.get(a).push({k:b, s:x.s, why:x.why}); }); }); inf.set(uid0, m); } return inf.get(uid0); };
  const starts = lines.filter(l => !cs || l.cats.some(c => cs.has(c))).flatMap(l => l.pins.filter(p => p.port.owner === from).map(p => p.key));
  const out = [], seenEnd = new Set();
  [...new Set(starts)].forEach(st => {
    const dist = new Map([[st, 0]]), prev = new Map(), Q = [st], done = new Set();
    while(Q.length){ Q.sort((a, b) => dist.get(a) - dist.get(b)); const k = Q.shift(); if(done.has(k)) continue; done.add(k); if(dist.get(k) > 30) break;
      const u = unitOf(k), relax = (k2, w, step) => { if(done.has(k2)) return; const d = dist.get(k) + w; if(!dist.has(k2) || d < dist.get(k2)){ dist.set(k2, d); prev.set(k2, {k, step}); Q.push(k2); } };
      const l = lineOf.get(k); if(l && (!prev.get(k) || prev.get(k).step.t !== 'cable')) l.pins.forEach(p => { if(p.key !== k) relax(p.key, 1, {t:'cable', line:l}); });
      if(u && u !== from && u !== to && prev.get(k) && prev.get(k).step.t === 'cable'){
        (innerC(u).get(k) || []).forEach(x => relax(x.k, 1, {t:'in', a:k, b:x.k, why:x.why, conf:true}));
        (innerI(u).get(k) || []).forEach(x => relax(x.k, 1 + (4 - x.s), {t:'in', a:k, b:x.k, why:x.why, s:x.s, conf:false})); } }
    [...dist.keys()].filter(k => unitOf(k) === to && prev.get(k) && prev.get(k).step.t === 'cable').forEach(end => { const id = st + '>' + end; if(seenEnd.has(id)) return; seenEnd.add(id);
      const steps = []; let k = end; while(prev.get(k)){ steps.unshift(prev.get(k).step); k = prev.get(k).k; }
      const inferred = steps.filter(s => s.t === 'in' && !s.conf), l0 = steps[0].line, ps = l0.pins.find(p => p.key === st);
      out.push({id, start:st, end, steps, inferred, name:(ps && (ps.d.sig || (hcLabel(ps.d.lbl) || {}).name)) || l0.name, cat:l0.cat, cost:dist.get(end), strong:inferred.every(s => s.s >= 2)}); });
  });
  /* aynı başlangıç pininden birden çok hedef varsa en ucuzu; sırala */
  const byStart = new Map(); out.forEach(r => { const o = byStart.get(r.start); if(!o || r.cost < o.cost) byStart.set(r.start, r); });
  return [...byStart.values()].sort((a, b) => (a.cat || '~').localeCompare(b.cat || '~') || String(a.name).localeCompare(String(b.name), 'tr', {numeric:true}));
}
function hcRouteTxt(r){ let s = hcKeyTxt(r.start); r.steps.forEach(st => { s += st.t === 'cable' ? ` ⇒[${st.line.cable.name}]⇒ ` + hcKeyTxt(st._to) : (st.conf ? ' ~ ' : ' ~? ') + hcKeyTxt(st.b); }); return s; }
/* yol adımlarına hedef pini yaz (metin için) */
function hcRouteFill(r){ let k = r.start; r.steps.forEach((st, i) => { if(st.t === 'cable'){ const nx = i + 1 < r.steps.length && r.steps[i + 1].t === 'in' ? r.steps[i + 1].a : (i === r.steps.length - 1 ? r.end : null); st._to = nx || st.line.pins.find(p => p.key !== k).key; k = st._to; } else k = st.b; }); return r; }
function hcAcceptRoutes(routes){ let n = 0; routes.forEach(r => r.inferred.forEach(s => { const u = E(unitOf2(s.a)); if(!u) return; u.hcLinks = u.hcLinks || []; if(!u.hcLinks.some(l => (l.a === s.a && l.b === s.b) || (l.a === s.b && l.b === s.a))){ u.hcLinks.push({a:s.a, b:s.b, why:s.why}); n++; } })); return n; }
const unitOf2 = k => (E(k.split('|')[0]) || {}).owner;
const HC10R = {sel:{}, mu:'', ma:'', mb:''};
function hcRouteBlock(tc){
  const sc = hcScopeOf(tc); if(!sc || !sc.from) return '';
  if(!sc.unit) return `<div style="border:1px solid #dde;border-radius:6px;padding:8px 10px;margin:6px 0" class="muted">Rota bulmak için hedef birimi seçin.</div>`;
  const R = hcFindRoutes(sc.from, sc.unit, sc.cats).map(hcRouteFill), pend = R.filter(r => r.inferred.length), linked = hcUnits().filter(u => (u.hcLinks || []).length);
  const isSel = r => HC10R.sel[r.id] != null ? HC10R.sel[r.id] : r.strong;
  const ru = [...new Set(R.flatMap(r => r.steps.filter(s => s.t === 'cable').flatMap(s => s.line.pins.map(p => p.port.owner))))].filter(u => u !== sc.from && u !== sc.unit).map(E).filter(Boolean);
  const mu = E(HC10R.mu) || ru[0] || null, popt = u => u ? hcUnitConns(u.id).flatMap(p => hcPins(p).filter(q => hcPinUsed(q.d)).map(q => [hcPinKey(p, q.no), p.name + '-' + q.no + (q.d.sig ? ' ' + q.d.sig : '')])) : [];
  return `<div style="border:1px solid #c9d8ee;border-radius:6px;padding:8px 10px;margin:6px 0;background:#f7faff">
    <div class="hcsec" style="margin-top:0">Rota: ${esc((E(sc.from) || {}).name || '')} → ${esc((E(sc.unit) || {}).name || '')} <span class="muted" style="font-weight:400;font-size:12px">${R.length} hat bulundu · ${pend.length} hattın birim içi geçişi tahmin (onay bekliyor)</span></div>
    ${R.length ? `<table class="hcpt" style="width:100%"><thead><tr><th style="width:24px"></th><th>Hat</th><th>Hat tipi</th><th>Güzergâh</th><th>Tahmini birim içi geçiş</th></tr></thead><tbody>
    ${R.map(r => `<tr style="${r.inferred.length ? '' : 'background:#eefaf1'}"><td>${r.inferred.length ? `<input type="checkbox" data-hc10s="${esc(r.id)}"${isSel(r) ? ' checked' : ''} style="width:auto">` : '<span style="color:#27ae60" title="Onaylı rota">✓</span>'}</td><td class="noi18n"><b>${esc(r.name)}</b></td><td>${hcChip(hcCat(r.cat)) || '—'}</td><td class="noi18n" style="font-size:11.5px">${esc(hcRouteTxt(r))}</td>
      <td style="font-size:11.5px">${r.inferred.map(s => `<div class="noi18n"><span style="color:${s.s >= 3 ? '#27ae60' : s.s === 2 ? '#2e86de' : '#b9770e'}">${s.s >= 3 ? '●●●' : s.s === 2 ? '●●' : '●'}</span> ${esc(hcKeyTxt(s.a))} ↔ ${esc(hcKeyTxt(s.b).split(' ').slice(1).join(' '))} <span class="muted">(${esc(s.why)})</span></div>`).join('') || '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody></table>
    ${pend.length ? `<div style="margin-top:6px;display:flex;gap:8px;align-items:center;font-size:12px"><button class="vb pri" data-hc10="racc">Seçili rotaların geçişlerini onayla</button><span class="muted">●●● grup / rol, ●● aynı sinyal adı, ● etiket veya genel ad (GND…). Onaylanan geçiş birime yazılır; hat tablosu ve diğer testler de kullanır.</span></div>` : ''}`
    : '<p class="muted" style="font-size:12px">Kablajlar ve birim içi geçişlerle hedef birime ulaşan hat bulunamadı. Aşağıdan birim içi geçişi elle ekleyin ya da birimi “içten geçişli” işaretleyin.</p>'}
    <div style="margin-top:8px;font-size:12px;display:flex;gap:6px;flex-wrap:wrap;align-items:center"><b>Birim içi geçiş ekle:</b> <select data-hc10f="mu" class="noi18n">${hcUnits().filter(u => u.id !== sc.from && u.id !== sc.unit).map(u => hcOpt(u.id, u.name, mu && mu.id)).join('')}</select>
      <select data-hc10f="ma" class="noi18n">${popt(mu).map(([k, l]) => hcOpt(k, l, HC10R.ma)).join('')}</select> ↔ <select data-hc10f="mb" class="noi18n">${popt(mu).map(([k, l]) => hcOpt(k, l, HC10R.mb)).join('')}</select><button class="vb" data-hc10="ladd">+ Ekle</button></div>
    ${linked.length ? `<div style="margin-top:6px;font-size:11.5px"><b>Onaylı birim içi geçişler:</b> ${linked.map(u => u.hcLinks.map((l, i) => `<span class="hcchip noi18n" style="background:#5d6d7e">${esc(u.name)}: ${esc(hcKeyTxt(l.a).split(' ').slice(1).join(' '))} ↔ ${esc(hcKeyTxt(l.b).split(' ').slice(1).join(' '))} <a data-hc10="ldel" data-k="${u.id}|${i}" style="cursor:pointer;color:#fff" title="Geçişi sil">✕</a></span>`).join(' ')).join(' ')}</div>` : ''}</div>`;
}
/* test tanımına bağlama: rota bloğu kapsamdan sonra, hazırlık bloğu en sonda */
{ const _sb = hcScopeBlock; hcScopeBlock = function(tc){ let h = _sb.apply(this, arguments); const rb = hcRouteBlock(tc), mk = '<span style="flex:1">Test adımları</span>', i = h.indexOf(mk);
  if(rb){ const j = i < 0 ? -1 : h.lastIndexOf('<div style="border:1px solid #dde', i); h = j < 0 ? h + rb : h.slice(0, j) + rb + h.slice(j); }
  return h + hcReadyBlock(tc); }; }
/* ---------- 4b) hat tablosu: yan yana güzergâh ---------- */
const hcPathCol = i => i === 0 ? 'Başlangıç' : (i - 1) % 3 === 0 ? 'Kablaj' : (i - 1) % 3 === 1 ? 'Konnektör' : 'Geçiş (çıkış)';
const hcPathCab = i => i > 0 && (i - 1) % 3 === 0;
function hcChainPath(ch, startUnit){
  const lineOf = new Map(); ch.lines.forEach(l => l.pins.forEach(p => lineOf.set(p.key, l)));
  const inner = new Map(), add = (a, b) => { if(!lineOf.has(a) || !lineOf.has(b)) return; if(!inner.has(a)) inner.set(a, []); if(!inner.has(b)) inner.set(b, []); inner.get(a).push(b); inner.get(b).push(a); };
  [...new Set(ch.pins.map(p => p.port.owner))].map(E).filter(Boolean).forEach(u => hcInnerConfirmed(u).forEach((xs, a) => xs.forEach(x => add(a, x.k))));
  const byKey = new Map(ch.pins.map(p => [p.key, p])), ends = (ch.ends && ch.ends.length ? ch.ends : ch.pins).slice().sort((a, b) => hcPinTxt(a).localeCompare(hcPinTxt(b), 'tr', {numeric:true}));
  const st = (startUnit && ends.find(p => p.port.owner === startUnit)) || ends[0]; if(!st) return [];
  const cells = [hcPinTxt(st)], vis = new Set([st.key]); let cur = st.key;
  for(let g = 0; g < 60; g++){
    const l = lineOf.get(cur); if(!l) break; const oth = l.pins.filter(p => !vis.has(p.key)); if(!oth.length) break;
    oth.forEach(p => vis.add(p.key)); cells.push(l.cable.name);
    const cont = oth.find(p => (inner.get(p.key) || []).some(k => !vis.has(k))) || null;
    cells.push(oth.map(hcPinTxt).join(' + '));
    if(!cont) break; const nx = inner.get(cont.key).find(k => !vis.has(k)); vis.add(nx); cells.push(hcPinTxt(byKey.get(nx) || {port:E(nx.split('|')[0]), no:nx.split('|')[1]})); cur = nx;
  }
  return cells;   /* [başlangıç, (kablaj, varış konnektörü, geçiş çıkışı)…] — son üçlüde çıkış yok */
}
{ const _rr = hcRouteRows; hcRouteRows = function(){ let R = _rr.apply(this, arguments); if(HC9.unit) R = R.filter(r => r.ch.pins.some(p => p.port.owner === HC9.unit)).map((r, i) => Object.assign(r, {no:i + 1})); R.forEach(r => { r.path = hcChainPath(r.ch, HC9.unit); }); return R; }; }
{ const _rb = hcRouteBar; hcRouteBar = function(){ return _rb.apply(this, arguments) + `<span class="vsep"></span><label>Birim <select data-hc10f="runit" class="noi18n">${hcOpt('', 'Tümü', HC9.unit || '')}${hcUnits().filter(u => !u.hcInline).map(u => hcOpt(u.id, u.name, HC9.unit || '')).join('')}</select></label><label class="vchk" title="Her hattın geçtiği konnektörler ve kablajlar ayrı sütunlarda, başlangıçtan sona"><input type="checkbox" data-hc10f="rcols"${HC9.cols ? ' checked' : ''}> Yan yana (sütunlu)</label>`; }; }
{ const _rh = hcRouteHTML; hcRouteHTML = function(){ if(!HC9.cols) return _rh.apply(this, arguments); const R = hcRouteRows(), mx = Math.max(1, ...R.map(r => r.path.length));
  return `<div style="padding:10px"><p class="muted" style="font-size:12px;margin-top:0">Her satır bir hat: ${HC9.unit ? esc((E(HC9.unit) || {}).name || '') + ' biriminden başlayarak' : 'bir uçtan başlayarak'} geçtiği kablajlar ve konnektör pinleri yan yana: her kablaj için varış konnektörü ve (geçiş konnektörü / birim içi geçiş varsa) çıkış konnektörü. Dallanmalar “+” ile.</p>
    <div style="max-height:calc(100vh - 220px);overflow:auto"><table class="hcpt"><thead><tr><th>No</th><th>Hat</th><th>Hat tipi</th>${Array.from({length:mx}, (_, i) => `<th>${hcPathCol(i)}</th>`).join('')}</tr></thead><tbody>
    ${R.map(r => `<tr><td>${r.no}</td><td class="noi18n"><b>${esc(r.name)}</b></td><td>${hcChip(hcCat(r.ch.cat)) || '—'}</td>${Array.from({length:mx}, (_, i) => `<td class="noi18n" style="white-space:nowrap;${hcPathCab(i) ? 'color:#1f4e8c;font-weight:700;background:#eef5ff' : ''}">${esc(r.path[i] || '')}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${mx + 3}" class="muted">Seçime uyan hat yok</td></tr>`}</tbody></table></div></div>`; }; }
{ const _rx = hcRouteXlsx; hcRouteXlsx = function(){ if(!HC9.cols) return _rx.apply(this, arguments); const R = hcRouteRows(), mx = Math.max(1, ...R.map(r => r.path.length)), hd = a => a.map(v => ({v, s:1}));
  download(buildXlsx([{name:'Hat güzergâhı', rows:[hd(['No', 'Hat', 'Hat tipi'].concat(Array.from({length:mx}, (_, i) => hcPathCol(i))))].concat(R.map(r => [r.no, r.name, r.cat].concat(Array.from({length:mx}, (_, i) => hcPathCab(i) && r.path[i] ? {v:r.path[i], s:6} : r.path[i] || '')))), widths:[5, 22, 12].concat(Array.from({length:mx}, (_, i) => hcPathCab(i) ? 9 : 20)), header:true, freeze:[2, 1]}]),
    fileSafe((E(M.rootId) ? E(M.rootId).name + ' - ' : '') + 'hat güzergâh tablosu') + '.xlsx'); }; }
{ const _rp = hcRoutePdf; hcRoutePdf = async function(){ if(!HC9.cols) return _rp.apply(this, arguments); const R = hcRouteRows(); if(!R.length) return toast('Seçime uyan hat yok');
  const mx = Math.max(1, ...R.map(r => r.path.length)), avail = HC_PW - 60 - 34 - 140, nCab = Array.from({length:mx}, (_, i) => i).filter(hcPathCab).length, cabW = Math.min(60, avail * 0.06), cellW = (avail - nCab * cabW) / Math.max(1, mx - nCab);
  const cols = [['No', 34], ['Hat', 140]].concat(Array.from({length:mx}, (_, i) => [hcPathCol(i), hcPathCab(i) ? cabW : cellW])), RH = 15;
  const per = Math.floor((HC_PH - 20 - HC_TBH - 30 - 70) / RH) - 1, pages = Math.ceil(R.length / per), fit = (s, wd) => { s = String(s || ''); const m = Math.floor(wd / 5.4); return s.length > m ? s.slice(0, m - 1) + '…' : s; };
  const title = 'Hat güzergâh tablosu' + (HC9.unit ? ' — ' + ((E(HC9.unit) || {}).name || '') : ''), pseudo = {name:title, dwg:{title, no:'HAT-GUZERGAH', rev:'A', date:new Date().toLocaleDateString('tr-TR')}}, out = [];
  for(let i = 0; i < pages; i++){ const part = R.slice(i * per, i * per + per);
    let s = hcT(30, 40, title.toLocaleUpperCase('tr'), {fs:15, b:true}) + hcT(30, 58, `${R.length} hat · sayfa ${i + 1} / ${pages}`, {fs:10.5, c:'#444'}) + hcTable(30, 70, cols, part.map(r => [String(r.no), fit(r.name, 140)].concat(Array.from({length:mx}, (_, j) => fit(r.path[j], cols[j + 2][1])))), RH).svg;
    const im = await svgToFlate({str:hcFrame(s + hcTitleBlock(pseudo, i + 1, pages, 'Hat güzergâhı')), w:HC_PW, h:HC_PH}, 2); out.push(Object.assign(im, {pw:1190.55, ph:841.89, dw:1190.55, dh:841.89, dx:0, dy:0})); }
  download(buildPdf(out), fileSafe((E(M.rootId) ? E(M.rootId).name + ' - ' : '') + title) + '.pdf'); }; }
VIEWS['@hcroute'].render = () => hcRouteHTML(); VIEWS['@hcroute'].bar = () => hcRouteBar();
/* ---------- görünümlere bağlama ve olaylar ---------- */
{ const bS = VIEWS['@hcsys'].bar; VIEWS['@hcsys'].bar = () => bS() + `<span class="vsep"></span><button class="vb" data-hc10="matexl" title="Kablaj – konnektör eşleşme tablosu (Excel, birleşik hücreli)">Eşleşme tablosu ⤓</button><button class="vb${HCS.mate ? ' pri' : ''}" data-hc10="matemode" title="Açıkken konnektöre tıklayınca kablaj ucu takılı / takılı değil olur">Takılı işaretle${HCS.mate ? ' (açık)' : ''}</button><button class="vb" data-hc10="ready">Test hazırlığı</button><button class="vb" data-hc10="inline"${HCS.sel ? '' : ' disabled'} title="Seçili kablajın bir ucuna 1:1 geçiş konnektörü ekle">Geçiş konnektörü…</button>`; }
{ const bC = VIEWS['@hccable'].bar; VIEWS['@hccable'].bar = () => bC() + `<span class="vsep"></span><button class="vb" data-hc10="inline"${HCS.cab ? '' : ' disabled'} title="Kablajın bir ucuna 1:1 geçiş konnektörü ekle; o uçtaki hatlar yeni kablaja aktarılır">Geçiş konnektörü ekle…</button>`; }
{ const rS = VIEWS['@hcsys'].render; VIEWS['@hcsys'].render = () => { const h = rS(); if(!HCS.mate) return h; const i = h.lastIndexOf('</div>'); const B = hcMateBlocks(), t = B.reduce((s, b) => s + b.rows.length, 0), m = B.reduce((s, b) => s + b.rows.filter(r => r.mated).length, 0);
  return h.slice(0, i) + `<div style="position:absolute;left:10px;top:10px;background:#eefaf1;border:1px solid #9bd3ab;border-radius:6px;padding:5px 10px;font-size:12px"><b>Takılı işaretle:</b> konnektöre tıklayın (yeşil = takılı) · ${m} / ${t} uç takılı <button class="vb" data-hc10="matemode">Bitir</button></div>` + h.slice(i); }; }
(() => {
  const V = $('#view'), save = f => { snap(); const r = f(); afterChange(); renderViewBar(); renderView(); return r; };
  V.addEventListener('mousedown', ev => { if(ST.cur !== '@hcsys' || !HCS.mate || ev.button !== 0) return; const t = ev.target.closest && ev.target.closest('[data-hcpt]'); if(!t) return; ev.preventDefault(); ev.stopPropagation();
    const pid = t.dataset.hcpt, c = hcCableOfPort(pid), n = c && hcNodeOfPort(c, pid); if(!n) return toast('Bu konnektöre kablaj takılı değil');
    save(() => { n.mated = !n.mated; if(n.mated) n.matedAt = new Date().toISOString(); else delete n.matedAt; }); toast(`${c.name} ${hcNodeRef(c, n)} ↔ ${hcNodeLabel(c, n)}: ${n.mated ? 'takılı' : 'takılı değil'}`); }, true);
  V.addEventListener('change', ev => { const t = ev.target;
    if(ST.cur === '@hcmate' && (t.dataset.hc10m || t.dataset.hc10r)){ const [cid, nid] = (t.dataset.hc10m || t.dataset.hc10r).split('|'), c = hcR().cables[cid], n = c && hcNode(c, nid); if(!n) return;
      return save(() => { if(t.dataset.hc10m){ n.mated = t.checked; if(n.mated) n.matedAt = new Date().toISOString(); else delete n.matedAt; } else { const v = t.value.trim(); if(v) n.ref = v; else delete n.ref; } }); }
    if(ST.cur === '@hctest' && t.dataset.hc10s){ HC10R.sel[t.dataset.hc10s] = t.checked; return; }
    if(ST.cur === '@hctest' && t.dataset.hc10f){ HC10R[t.dataset.hc10f] = t.value; if(t.dataset.hc10f === 'mu'){ HC10R.ma = ''; HC10R.mb = ''; renderView(); } return; } });
  V.addEventListener('keydown', ev => { if(ST.cur === '@hcmate' && ev.target.dataset && ev.target.dataset.hc10r){ ev.stopPropagation(); if(ev.key === 'Enter') ev.target.blur(); } });
  document.addEventListener('change', ev => { const t = ev.target; if(ST.cur !== '@hcroute' || !t.dataset || !t.dataset.hc10f) return; if(t.dataset.hc10f === 'runit') HC9.unit = t.value; if(t.dataset.hc10f === 'rcols') HC9.cols = t.checked; renderView(); });
  document.addEventListener('click', ev => { const b = ev.target.closest && ev.target.closest('[data-hc10]'); if(!b) return; const a = b.dataset.hc10, k = b.dataset.k;
    if(!/^@hc/.test(ST.cur || '')) return; ev.preventDefault();
    if(a === 'matexl') return hcMateXlsx();
    if(a === 'matepdf') return hcMatePdf().catch(e => { appErr('eşleşme pdf', e); toast('PDF oluşturulamadı: ' + e.message); });
    if(a === 'mate') return openD('@hcmate');
    if(a === 'ready') return openD('@hcready');
    if(a === 'readyxl') return hcReadyXlsx();
    if(a === 'sys') return openD('@hcsys');
    if(a === 'cab') return hcOpenCable(k);
    if(a === 'test'){ HCT.tc = k; HCT.tab = 'def'; return openD('@hctest'); }
    if(a === 'matemode'){ HCS.mate = !HCS.mate; renderViewBar(); renderView(); return; }
    if(a === 'matemode2'){ HCS.mate = true; HCT2.show = ''; openD('@hcsys'); return; }
    if(a === 'mall' || a === 'mnone') return save(() => { hcCables().forEach(c => c.nodes.filter(n => n.kind === 'conn').forEach(n => { if(a === 'mall'){ if(!n.mated){ n.mated = true; n.matedAt = new Date().toISOString(); } } else { delete n.mated; delete n.matedAt; } })); });
    if(a === 'inline'){ const c = hcR().cables[ST.cur === '@hccable' ? HCS.cab : HCS.sel]; if(c) hcInlineDialog(c); return; }
    const tc = E(HCT.tc); if(ST.cur !== '@hctest' || !tc) return;
    const sc = hcScopeOf(tc);
    if(a === 'racc' && sc){ const R = hcFindRoutes(sc.from, sc.unit, sc.cats).filter(r => r.inferred.length && (HC10R.sel[r.id] != null ? HC10R.sel[r.id] : r.strong)); if(!R.length) return toast('Onaylanacak rota seçilmedi');
      return save(() => { const n = hcAcceptRoutes(R); hcApplyScope(tc, sc, true); HC10R.sel = {}; toast(`${n} birim içi geçiş onaylandı · ${hcScopeChains(tc.hcScope).sel.length} hat kapsamda`); }); }
    if(a === 'ladd'){ const u = E(HC10R.mu) || E((document.querySelector('[data-hc10f="mu"]') || {}).value), A = HC10R.ma || (document.querySelector('[data-hc10f="ma"]') || {}).value, B = HC10R.mb || (document.querySelector('[data-hc10f="mb"]') || {}).value;
      if(!u || !A || !B || A === B || A.split('|')[0] === B.split('|')[0]) return toast('Birimin iki farklı konnektöründen birer pin seçin');
      return save(() => { u.hcLinks = (u.hcLinks || []).concat([{a:A, b:B, why:'elle eklendi'}]); if(sc) hcApplyScope(tc, sc, true); }); }
    if(a === 'ldel'){ const [uid0, i] = k.split('|'), u = E(uid0); if(!u) return; return save(() => { u.hcLinks.splice(+i, 1); if(!u.hcLinks.length) delete u.hcLinks; if(sc) hcApplyScope(tc, sc, true); }); }
  });
})();
{ const _m = hcLibMenu; hcLibMenu = () => { const r = _m(), i = r.findIndex(x => x && x.t && /^Hat tablosu/.test(x.t)); r.splice(i < 0 ? r.length : i + 1, 0, {t:'Kablaj – konnektör eşleşme tablosu', f:() => openD('@hcmate')}, {t:'Test hazırlığı (takılı konnektörler)', f:() => openD('@hcready')}); return r; }; }
if(typeof MENU_ADV !== 'undefined') MENU_ADV.analysis = new RegExp(MENU_ADV.analysis.source + '|^Kablaj – konnektör eşleşme|^Test hazırlığı');
if(typeof MENU_GROUPS !== 'undefined'){ const g = MENU_GROUPS.analysis.cls.find(x => x[0] === 'Kablaj ve konnektörler'); if(g) g[1] = new RegExp(g[1].source + '|^Kablaj – konnektör eşleşme|^Test hazırlığı'); }
if(typeof WF_STEPS !== 'undefined'){ const s = WF_STEPS.find(x => /kablajı tasarla/.test(x.t)); if(s) s.a.push(['Eşleşme tablosu', /^Kablaj – konnektör eşleşme/], ['Test hazırlığı', /^Test hazırlığı/]); }
