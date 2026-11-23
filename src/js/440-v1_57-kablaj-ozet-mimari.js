/* ================= v1.57: KABLAJ ÖZETİ VE HAT TİPİNE GÖRE MİMARİLER =================
   Hat (net): bir kablajdaki açık hatlarla uçtan uca bağlanan pin kümesi (en az iki pin). Kimliği pin uçlarından türetilir (port|pin, sıralı) —
   kablaj / düğüm yeniden düzenlense de aynı pinleri bağlayan hat aynı kimliği taşır (v1.58 test kapsamı bu kimliği kullanır).
   Mimari görünümü: sistem şeması bir hat tipine süzülür (HCS.catF); o tipte hattı olmayan kablajlar gizlenir, ilgisiz konnektörler soluklaşır. */
function hcLines(){
  const out = [];
  hcCables().forEach(c => hcNets(c).forEach(net => {
    const pins = net.ends.map(e => { const p = hcEndPin(c, e); return p ? {port:p.port, no:e.pin, d:p.d, key:p.port.id + '|' + e.pin} : null; }).filter(Boolean);
    if(pins.length < 2) return;
    const key = pins.map(x => x.key).sort().join(','), cats = [...new Set(pins.map(x => hcPinCat(x.d)).filter(Boolean))], lbls = [...new Set(pins.map(x => (hcLabel(x.d.lbl) || {}).name || x.d.sig).filter(Boolean))];
    out.push({id:key, cable:c, pins, cat:cats[0] || '', cats, name:lbls.join(' / ') || '(etiketsiz)', units:[...new Set(pins.map(x => x.port.owner))]});
  }));
  return out;
}
function hcSummary(){
  const H = hcR(), units = hcUnits(), conns = Object.values(M.els).filter(hcIsConn), cs = hcCables(), lines = hcLines(), cat = {}, z = () => ({conn:0, pins:0, wires:0, cables:new Set(), lines:0});
  const C = k => cat[k] = cat[k] || z();
  conns.forEach(p => { C(p.hc.cat || '').conn++; hcPins(p).forEach(x => { if(hcPinUsed(x.d)) C(hcPinCat(x.d)).pins++; }); });
  let wires = 0, off = 0, sp = 0, nE = 0, nW = 0;
  cs.forEach(c => { const s = hcCableStats(c); wires += s.wires; off += s.off; nE += s.nE; nW += s.nW; sp += c.nodes.filter(n => n.kind === 'splice').length; Object.entries(s.byCat).forEach(([k, v]) => { C(k).wires += v; C(k).cables.add(c.id); }); });
  lines.forEach(l => C(l.cat).lines++);
  const wiredPins = new Set(); cs.forEach(c => c.wires.filter(w => w.on !== false).forEach(w => [w.a, w.b].forEach(e => { const p = hcEndPin(c, e); if(p) wiredPins.add(p.port.id + '|' + e.pin); })));
  const byUnit = units.map(u => { const ps = hcUnitConns(u.id), o = {u, conn:ps.length, pins:0, wired:0, free:0, cat:{}, cables:new Set()};
    ps.forEach(p => { hcPins(p).forEach(x => { if(!hcPinUsed(x.d)) return; o.pins++; const k = hcPinCat(x.d); o.cat[k] = (o.cat[k] || 0) + 1; if(wiredPins.has(p.id + '|' + x.no)) o.wired++; else o.free++; }); hcCablesOfPort(p.id).forEach(c => o.cables.add(c.id)); });
    return o; });
  return {units, conns, cs, lines, cat, wires, off, sp, nE, nW, byUnit, cats:H.cats};
}
function hcSumHTML(){
  const S = hcSummary(), chip = k => { const c = hcCat(k); return c ? hcChip(c) : '<span class="hcchip" style="background:#999">Tipsiz</span>'; };
  const tile = (v, l, col) => `<div style="border:1px solid #dde;border-radius:8px;padding:8px 14px;min-width:110px;background:#fff"><div style="font-size:22px;font-weight:700;color:${col || '#223'}">${v}</div><div class="muted" style="font-size:12px">${l}</div></div>`;
  const keys = [...new Set(S.cats.map(c => c.id).concat(Object.keys(S.cat)))].filter(k => S.cat[k] && (S.cat[k].conn || S.cat[k].pins || S.cat[k].wires));
  let h = `<div style="padding:12px">
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">${tile(S.units.length, 'birim')}${tile(S.conns.length, 'arayüz (konnektör)')}${tile(S.cs.length, 'kablaj')}${tile(S.lines.length, 'hat (uçtan uca)')}${tile(S.wires, 'bağlı pin-pin hat')}${S.off ? tile(S.off, 'bağlı değil', '#888') : ''}${tile(S.sp, 'splice')}${tile(S.nE, 'eşleştirme hatası', S.nE ? '#c0392b' : '')}${tile(S.nW, 'uyarı', S.nW ? '#b9770e' : '')}</div>
    <div class="hcsec">Hat tiplerine göre</div>
    <table class="hcpt"><thead><tr><th>Hat tipi</th><th>Arayüz</th><th>Dolu pin</th><th>Uçtan uca hat</th><th>Pin-pin hat</th><th>Kablaj</th><th>Mimari</th></tr></thead><tbody>
    ${keys.map(k => { const x = S.cat[k]; return `<tr><td>${chip(k)}</td><td>${x.conn}</td><td>${x.pins}</td><td>${x.lines}</td><td>${x.wires}</td><td>${x.cables.size}</td><td>${k ? `<button class="vb" data-hc4="arch" data-k="${esc(k)}">Görüntüle</button><button class="vb" data-hc4="archpdf" data-k="${esc(k)}">PDF</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="7" class="muted">Henüz pinout girilmedi</td></tr>'}
    </tbody></table>
    <div class="hcsec">Birimlere göre</div>
    <table class="hcpt"><thead><tr><th>Birim</th><th>Arayüz</th><th>Dolu pin</th><th>Kablaja bağlı</th><th>Bağlanmamış</th><th>Kablaj</th>${keys.filter(Boolean).map(k => `<th>${esc((hcCat(k) || {}).name || k)}</th>`).join('')}</tr></thead><tbody>
    ${S.byUnit.map(o => `<tr><td class="noi18n"><a href="#" data-hc4="unit" data-k="${o.u.id}">${esc(o.u.name)}</a></td><td>${o.conn}</td><td>${o.pins}</td><td>${o.wired}</td><td${o.free ? ' style="color:#b9770e"' : ''}>${o.free}</td><td>${o.cables.size}</td>${keys.filter(Boolean).map(k => `<td>${o.cat[k] || ''}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="6" class="muted">Birim yok</td></tr>'}
    </tbody></table>
    <div class="hcsec">Kablajlara göre</div>
    <table class="hcpt"><thead><tr><th>Kablaj</th><th>Uçlar</th><th>Uçtan uca hat</th><th>Pin-pin hat</th><th>Splice</th><th>Uzunluk</th><th>AWG</th>${keys.filter(Boolean).map(k => `<th>${esc((hcCat(k) || {}).name || k)}</th>`).join('')}<th>Denetim</th></tr></thead><tbody>
    ${S.cs.map(c => { const s = hcCableStats(c), aw = [...new Set(c.wires.filter(w => w.on !== false).map(w => w.awg).filter(Boolean))].sort((a, b) => a - b); return `<tr><td><a href="#" data-hc4="cable" data-k="${c.id}"><b class="noi18n">${esc(c.name)}</b></a></td><td class="noi18n">${c.nodes.filter(n => n.kind === 'conn').map(n => esc(hcNodeLabel(c, n))).join(' ↔ ')}</td><td>${S.lines.filter(l => l.cable === c).length}</td><td>${s.wires}</td><td>${c.nodes.filter(n => n.kind === 'splice').length || ''}</td><td>${c.len ? esc(c.len) + ' m' : ''}</td><td>${aw.join(', ')}</td>${keys.filter(Boolean).map(k => `<td>${s.byCat[k] || ''}</td>`).join('')}<td>${s.nE ? `<span style="color:#c0392b">✖ ${s.nE}</span> ` : ''}${s.nW ? `<span style="color:#b9770e">⚠ ${s.nW}</span>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="8" class="muted">Kablaj yok</td></tr>'}
    </tbody></table></div>`;
  return h;
}
function hcSumBar(){ return `<button class="vb pri" data-hc4="archall">Mimarileri PDF olarak indir…</button><button class="vb" data-hc4="xl">Özet Excel</button><span class="vsep"></span><button class="vb" data-hc4="sys">Kablaj şeması</button>`; }
VIEWS['@hcsum'] = {tr:'Kablaj Özeti', ic:'Σ', note:'Birim, arayüz, kablaj, uçtan uca hat ve pin-pin hat sayıları; hat tiplerine (güç, haberleşme, ayrık…), birimlere ve kablajlara göre dağılım.<br><br><b>Hat</b>: bir kablajdaki hatlarla uçtan uca bağlanan pinler (splice üzerinden dallanan hat tek hat sayılır).<br><br>Her hat tipi için <b>Görüntüle</b> sistem şemasını o tipe süzer (ör. güç mimarisi); <b>PDF</b> o mimariyi A3 sayfa olarak indirir.', render:hcSumHTML, bar:hcSumBar, status:() => { const S = hcSummary(); return S.cs.length + ' kablaj · ' + S.lines.length + ' hat · ' + S.wires + ' hat'; }};
/* ---------- mimari PDF ---------- */
function hcArchPage(catF, page, pages, extra){
  const cat = hcCat(catF), title = (extra && extra.title) || (cat ? cat.name + ' mimarisi' : 'Sistem kablaj mimarisi'), r = hcSysSVG(Object.assign({exp:true, det:true, catF:catF || ''}, extra || {}));
  const aw = HC_PW - 60, ah = HC_PH - 90 - HC_TBH, k = Math.min(aw / r.w, ah / r.h, 1.4);
  const pseudo = {name:title, dwg:{title, no:'MIM-' + (cat ? cat.name : 'SİSTEM').toLocaleUpperCase('tr').replace(/[^A-Z0-9ÇĞİÖŞÜ]+/g, '-'), rev:'A', date:new Date().toLocaleDateString('tr-TR')}};
  const cs = hcCables().filter(c => !catF || hcCableStats(c).byCat[catF]), lines = hcLines().filter(l => !catF || l.cats.includes(catF));
  let s = hcT(30, 40, title.toLocaleUpperCase('tr'), {fs:16, b:true}) + hcT(30, 58, `${cs.length} kablaj · ${lines.length} hat · ${hcUnits().length} birim${cat ? ' · yalnız ' + cat.name + ' hatlarını taşıyan kablajlar; diğer arayüzler soluk' : ''}${extra && extra.sub ? ' · ' + extra.sub : ''}`, {fs:11, c:'#444'});
  s += `<g transform="translate(30,72) scale(${k})">${r.svg}</g>`;
  let lx = 30; const ly = HC_PH - 34; hcR().cats.forEach(c => { if(catF && c.id !== catF) return; s += `<rect x="${lx}" y="${ly - 9}" width="18" height="4" fill="${c.col}"/>` + hcT(lx + 24, ly - 3, c.name, {fs:10}); lx += 40 + c.name.length * 6.5; });
  return hcFrame(s + hcTitleBlock(pseudo, page, pages));
}
async function hcArchPdf(cats){
  const pages = []; toast('Mimari PDF hazırlanıyor… (' + cats.length + ' sayfa)');
  for(let i = 0; i < cats.length; i++){ const im = await svgToFlate({str:hcArchPage(cats[i], i + 1, cats.length), w:HC_PW, h:HC_PH}, 2); pages.push(Object.assign(im, {pw:1190.55, ph:841.89, dw:1190.55, dh:841.89, dx:0, dy:0})); }
  const nm0 = cats.length === 1 ? (hcCat(cats[0]) ? hcCat(cats[0]).name + ' mimarisi' : 'Sistem kablaj mimarisi') : 'Kablaj mimarileri';
  download(buildPdf(pages), fileSafe((E(M.rootId) ? E(M.rootId).name + ' - ' : '') + nm0) + '.pdf');
}
function hcArchDialog(){
  const S = hcSummary(), ks = hcR().cats.filter(c => S.cat[c.id] && S.cat[c.id].wires);
  const box = $('#modalBox'); box.style.width = 'min(480px, 94vw)'; box.style.maxWidth = 'none';
  box.innerHTML = `<h2>Mimarileri PDF olarak indir</h2><p class="muted" style="font-size:12px;margin:-4px 0 8px">Her seçim A3 yatay bir sayfa olur: sistem kablaj şeması o hat tipine süzülür (detaylı görünüm), altında antet.</p>
    <label style="display:block;padding:3px 0"><input type="checkbox" data-hca4="" checked> <b>Tüm sistem</b> (bütün kablajlar)</label>
    ${ks.map(c => `<label style="display:block;padding:3px 0"><input type="checkbox" data-hca4="${c.id}" checked> ${hcChip(c)} ${S.cat[c.id].cables.size} kablaj · ${S.cat[c.id].lines} hat</label>`).join('') || '<p class="muted">Hat tipine göre bağlı hat yok.</p>'}
    <p style="text-align:right;margin:12px 0 0"><button class="pbtn" id="hcAC">Vazgeç</button> <button class="pbtn pri" id="hcAO">PDF indir</button></p>`;
  $('#modal').style.display = 'flex';
  const close = () => { $('#modal').style.display = 'none'; box.style.width = ''; box.style.maxWidth = ''; box.onclick = null; };
  box.onclick = ev => { if(ev.target.id === 'hcAC') close(); if(ev.target.id === 'hcAO'){ const sel = [...box.querySelectorAll('[data-hca4]')].filter(i => i.checked).map(i => i.dataset.hca4); if(!sel.length) return toast('En az bir mimari seçin'); close(); hcArchPdf(sel).catch(e => { appErr('mimari pdf', e); toast('PDF oluşturulamadı: ' + e.message); }); } };
}
function hcSumXlsx(){
  const S = hcSummary(), keys = hcR().cats.filter(c => S.cat[c.id]).map(c => c.id), cn = k => (hcCat(k) || {}).name || 'Tipsiz', hd = a => a.map(v => ({v, s:1}));
  const sheets = [
    {name:'Hat tipleri', rows:[hd(['Hat tipi', 'Arayüz', 'Dolu pin', 'Uçtan uca hat', 'Pin-pin hat', 'Kablaj'])].concat(Object.keys(S.cat).map(k => [cn(k), S.cat[k].conn, S.cat[k].pins, S.cat[k].lines, S.cat[k].wires, S.cat[k].cables.size])), widths:[18, 9, 9, 9, 9, 9], header:true},
    {name:'Birimler', rows:[hd(['Birim', 'Arayüz', 'Dolu pin', 'Kablaja bağlı', 'Bağlanmamış', 'Kablaj'].concat(keys.map(cn)))].concat(S.byUnit.map(o => [o.u.name, o.conn, o.pins, o.wired, o.free, o.cables.size].concat(keys.map(k => o.cat[k] || 0)))), widths:[24, 8, 9, 12, 12, 8].concat(keys.map(() => 11)), header:true},
    {name:'Kablajlar', rows:[hd(['Kablaj', 'Uçlar', 'Uçtan uca hat', 'Pin-pin hat', 'Splice', 'Uzunluk (m)', 'Hata', 'Uyarı'].concat(keys.map(cn)))].concat(S.cs.map(c => { const s = hcCableStats(c); return [c.name, c.nodes.filter(n => n.kind === 'conn').map(n => hcNodeLabel(c, n)).join(' ↔ '), S.lines.filter(l => l.cable === c).length, s.wires, c.nodes.filter(n => n.kind === 'splice').length, c.len || '', s.nE, s.nW].concat(keys.map(k => s.byCat[k] || 0)); })), widths:[10, 50, 7, 7, 7, 11, 7, 7].concat(keys.map(() => 11)), header:true},
    {name:'Hatlar', rows:[hd(['Kablaj', 'Hat', 'Hat tipi', 'Uçlar'])].concat(S.lines.map(l => [l.cable.name, l.name, cn(l.cat), l.pins.map(x => (E(x.port.owner) || {}).name + ' · ' + x.port.name + '-' + x.no).join(' — ')])), widths:[10, 24, 14, 80], header:true}];
  download(buildXlsx(sheets), fileSafe((E(M.rootId) ? E(M.rootId).name + ' - ' : '') + 'kablaj özeti') + '.xlsx');
}
/* sistem şeması çubuğuna hat tipi süzgeci */
{ const bS = VIEWS['@hcsys'].bar; VIEWS['@hcsys'].bar = () => bS() + `<span class="vsep"></span><label>Mimari <select data-hc4f="cat">${hcOpt('', 'Tüm hat tipleri', HCS.catF || '')}${hcR().cats.map(c => hcOpt(c.id, c.name + ' mimarisi', HCS.catF || '')).join('')}</select></label><button class="vb" data-hc4="sum">Özet</button>`;
  const st = VIEWS['@hcsys'].status; VIEWS['@hcsys'].status = () => st() + (HCS.catF && hcCat(HCS.catF) ? ' · ' + hcCat(HCS.catF).name + ' mimarisi' : ''); }
(() => {
  const V = $('#view');
  V.addEventListener('change', ev => { if(ST.cur !== '@hcsys' || ev.target.dataset.hc4f !== 'cat') return; HCS.catF = ev.target.value; renderView(); renderStatus(); });
  document.addEventListener('click', ev => { if(ST.cur !== '@hcsum' && ST.cur !== '@hcsys') return; const b = ev.target.closest('[data-hc4]'); if(!b) return; ev.preventDefault(); const a = b.dataset.hc4, k = b.dataset.k;
    if(a === 'arch'){ HCS.catF = k; HCS.det = true; openD('@hcsys'); return; }
    if(a === 'archpdf') return hcArchPdf([k]).catch(e => { appErr('mimari pdf', e); toast('PDF oluşturulamadı: ' + e.message); });
    if(a === 'archall') return hcArchDialog();
    if(a === 'xl') return hcSumXlsx();
    if(a === 'sys'){ HCS.catF = ''; openD('@hcsys'); return; }
    if(a === 'sum') return openD('@hcsum');
    if(a === 'unit'){ HC.unit = k; HC.port = ''; openD('@hcunits'); return; }
    if(a === 'cable') return hcOpenCable(k); });
})();
{ const _m = hcLibMenu; hcLibMenu = () => { const r = _m(), i = r.findIndex(x => /^Kablaj şeması/.test(x.t)); r.splice(i + 1, 0, {t:'Kablaj özeti ve mimariler', f:() => openD('@hcsum')}); return r; }; }
if(typeof MENU_ADV !== 'undefined') MENU_ADV.analysis = new RegExp(MENU_ADV.analysis.source + '|^Kablaj özeti');
if(typeof WF_STEPS !== 'undefined'){ const s = WF_STEPS.find(x => /kablajı tasarla/.test(x.t)); if(s) s.a.splice(s.a.findIndex(a => /Kablaj şeması/.test(a[0])) + 1, 0, ['Özet ve mimariler', /^Kablaj özeti/]); }
