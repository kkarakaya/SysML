/* ================= v1.60 — Mimarilerde arama ve vurgulama, kablaj görünümünde yakınlaştırma, görünüm PDF'i =================
   Arama: birim, konnektör (ad, tip, parça no), pin (no, "J2-3", sinyal), etiket, hat tipi, protokol profili / fiziksel katman /
   mesaj, ek dosya adı, kablaj, hat rengi / grubu, test adı. Eşleşmeyenler soluklaşır, eşleşenler vurgulanır. */
const HC7 = {q:'', ck:1, open:true};
const hcLow = s => String(s == null ? '' : s).toLocaleLowerCase('tr');
const HC7C = {key:'', v:null};
function hcSearch(q){
  q = hcLow(q).trim(); if(!q) return null;
  const key = REV + '|' + q; if(HC7C.key === key) return HC7C.v;
  const terms = q.split(/\s+/).filter(Boolean), m = s => { const t = hcLow(s); return terms.every(x => t.includes(x)); };
  const R = {q, units:new Set(), ports:new Set(), cables:new Set(), pins:new Set(), lines:new Set(), hits:[], cats:{}};
  const hit = (t, label, ref) => { if(R.hits.length < 400) R.hits.push(Object.assign({t, label}, ref)); };
  const lines = hcLines(), lineOf = new Map(); lines.forEach(l => l.pins.forEach(x => lineOf.set(x.key, l)));
  const cablesOfPort = pid => hcCables().filter(c => c.nodes.some(n => n.kind === 'conn' && n.port === pid));
  const litCable = c => { if(!c) return; R.cables.add(c.id); c.nodes.forEach(n => { if(n.kind !== 'conn') return; const p = E(n.port); if(p){ R.ports.add(p.id); R.units.add(p.owner); } }); };
  const litPort = p => { R.ports.add(p.id); R.units.add(p.owner); cablesOfPort(p.id).forEach(litCable); };
  const litPin = (p, no) => { const k = p.id + '|' + no, l = lineOf.get(k); R.pins.add(k); R.ports.add(p.id); R.units.add(p.owner);
    if(l){ litCable(l.cable); l.pins.forEach(x => R.pins.add(x.key)); if(!R.lines.has(l.id)){ R.lines.add(l.id); l.cats.forEach(c => { R.cats[c] = (R.cats[c] || 0) + 1; }); } } };
  hcUnits().forEach(u => {
    if(m(u.name)){ hit('Birim', u.name, {unit:u.id}); R.units.add(u.id); hcUnitConns(u.id).forEach(litPort); }
    hcUnitConns(u.id).forEach(p => {
      const t = hcType(p.hc.ct), cat = hcCat(p.hc.cat);
      if(m([p.name, u.name + ' ' + p.name, t && t.name, t && t.pn, t && t.fam, cat && cat.name, p.hc.desc].filter(Boolean).join(' | '))){ hit('Konnektör', u.name + ' ' + p.name + (t ? ' · ' + (t.pn || t.name) : ''), {unit:u.id, port:p.id}); litPort(p); }
      (typeof hpIfs === 'function' ? hpIfs(p) : []).forEach(ifc => { const e = hpEff(ifc); if(!e) return; const msgs = (e.msgs || []).filter(x => m(x.mid + ' ' + x.name));
        if(m([e.name, e.phy, e.addr, e.endian === 'little' ? 'little endian' : 'big endian', e.crc].join(' | ')) || msgs.length){ hit('Protokol', `${u.name} ${p.name} · ${e.name}${msgs.length ? ' · ' + msgs.map(x => x.mid + ' ' + x.name).join(', ') : ''}`, {unit:u.id, port:p.id}); hpIfPins(p, ifc).forEach(no => litPin(p, no)); litPort(p); } });
      (typeof hpAtts === 'function' ? hpAtts(p) : []).forEach(f => { if(m(f.name)){ hit('Ek', `${u.name} ${p.name} · ${f.name}`, {unit:u.id, port:p.id, file:f.id}); litPort(p); } });
      hcPins(p).forEach(x => { if(!hcPinUsed(x.d)) return; const lb = hcLabel(x.d.lbl), pc = hcCat(hcPinCat(x.d));
        const txt = [p.name + '-' + x.no, p.name + '.' + x.no, u.name + ' ' + p.name + '-' + x.no, x.d.sig, lb && lb.name, pc && pc.name, x.d.note].filter(Boolean).join(' | ');
        if(m(txt)){ hit('Pin', `${u.name} ${p.name}-${x.no}${x.d.sig ? ' ' + x.d.sig : ''}${lb ? ' (' + lb.name + ')' : ''}`, {unit:u.id, port:p.id, pin:x.no}); litPin(p, x.no); } });
    });
  });
  hcCables().forEach(c => { if(m(c.name + ' | ' + (c.note || ''))){ hit('Kablaj', c.name + ' (' + c.nodes.filter(n => n.kind === 'conn').map(n => hcNodeLabel(c, n)).join(' ↔ ') + ')', {cable:c.id}); litCable(c); }
    c.wires.forEach((w, i) => { if(w.on === false) return; if(m([hcWireName(c, i), w.color, w.grp, w.note].filter(Boolean).join(' | '))){ hit('Hat', c.name + ' · ' + hcWireName(c, i) + (w.color ? ' ' + w.color : '') + (w.grp ? ' ' + w.grp : ''), {cable:c.id}); litCable(c); [w.a, w.b].forEach(e => { const pe = hcEndPin(c, e); if(pe) litPin(pe.port, pe.no || e.pin); }); } }); });
  if(typeof hcHarnessTests === 'function') hcHarnessTests().forEach(t => { if(m(t.name + ' | ' + (t.doc || ''))){ hit('Test', t.name + ' · ' + t.hcPins.length + ' pin', {test:t.id}); t.hcPins.forEach(k => { const [pid, no] = k.split('|'), p = E(pid); if(p) litPin(p, no); }); } });
  HC7C.key = key; HC7C.v = R; return R;
}
/* çizimlerin kullandığı sonuç: opt.hl verilmişse o; dışa aktarmada (exp) verilmemişse arama yok */
function hcSearchRes(opt){ opt = opt || {}; if(opt.hl !== undefined) return opt.hl; if(opt.exp) return null; return HC7.q ? hcSearch(HC7.q) : null; }
/* ---------- sistem şeması: arama kutusu ve sonuç paneli ---------- */
{ const bS = VIEWS['@hcsys'].bar; VIEWS['@hcsys'].bar = () => bS() + `<span class="vsep"></span><input data-hc7f="q" placeholder="Ara: birim, konnektör, pin (J2-3), sinyal, etiket, protokol, kablaj, test" value="${esc(HC7.q)}" style="width:330px" class="noi18n">${HC7.q ? '<button class="vb" data-hc7="clr" title="Aramayı temizle">✕</button>' : ''}<button class="vb" data-hc7="pdf" title="Ekrandaki görünümü (mimari süzgeci, arama vurgusu, test kapsaması dahil) A3 PDF olarak indir">Görünümü PDF</button>`; }
{ const rS = VIEWS['@hcsys'].render; VIEWS['@hcsys'].render = () => { let h = rS(); const R = HC7.q ? hcSearch(HC7.q) : null; if(!R) return h; const i = h.lastIndexOf('</div>'); return h.slice(0, i) + hcSearchPanel(R) + h.slice(i); }; }
function hcSearchPanel(R){
  const by = {}; R.hits.forEach(x => { (by[x.t] = by[x.t] || []).push(x); });
  const cats = Object.entries(R.cats).filter(([k]) => hcCat(k));
  return `<div id="hc7Panel" style="position:absolute;right:10px;top:10px;width:330px;max-height:calc(100% - 60px);overflow:auto;background:#fffffff2;border:1px solid #e3c87a;border-radius:8px;box-shadow:0 2px 10px #0002;font-size:12px">
    <div style="padding:6px 10px;background:#fff4d6;border-bottom:1px solid #e3c87a;display:flex;gap:6px;align-items:center;cursor:pointer" data-hc7="tog"><b>${R.hits.length >= 400 ? '400+' : R.hits.length} sonuç</b><span class="muted">"${esc(R.q)}" · ${R.units.size} birim · ${R.cables.size} kablaj · ${R.lines.size} hat</span><span style="flex:1"></span>${HC7.open ? '▴' : '▾'}</div>
    ${HC7.open ? `${cats.length ? `<div style="padding:5px 10px;border-bottom:1px solid #eee">Eşleşen hatlar mimarilerde: ${cats.map(([k, v]) => `<a href="#" data-hc7="cat" data-k="${k}" style="text-decoration:none">${hcChip({name:hcCat(k).name + ' ' + v, col:hcCat(k).col})}</a>`).join(' ')} ${HCS.catF ? '<a href="#" data-hc7="cat" data-k="">tüm hat tipleri</a>' : ''}</div>` : ''}
    ${Object.entries(by).map(([t, L]) => `<div style="padding:4px 10px 2px;font-weight:600;color:#556">${esc(t)} (${L.length})</div>${L.slice(0, 40).map(x => `<div class="hc7hit noi18n" data-hc7="go" data-u="${x.unit || ''}" data-c="${x.cable || ''}" data-p="${x.port || ''}" data-f="${x.file || ''}" data-t="${x.test || ''}" style="padding:2px 10px 2px 18px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(x.label)}">${esc(x.label)}</div>`).join('')}${L.length > 40 ? `<div class="muted" style="padding:0 18px">… ${L.length - 40} daha</div>` : ''}`).join('') || '<div class="muted" style="padding:8px 10px">Eşleşme yok.</div>'}` : ''}</div>`;
}
/* bir birimi / kablajı ekranın ortasına getir ve kısa süre parlat */
function hcCenterOn(x, y){ const wr = $('#hcSysWrap'); if(!wr) return; HCS.tx = wr.clientWidth / 2 - 165 - x * HCS.k; HCS.ty = wr.clientHeight / 2 - y * HCS.k; const g = $('#hcSysG'); if(g) g.setAttribute('transform', `translate(${HCS.tx},${HCS.ty}) scale(${HCS.k})`); }
function hcFlash(sel){ const el = document.querySelector(sel); if(!el) return; el.style.transition = 'filter .3s'; el.style.filter = 'drop-shadow(0 0 6px #f39c12) drop-shadow(0 0 6px #f39c12)'; setTimeout(() => { el.style.filter = ''; }, 1400); }
function hcGoHit(d){
  const P = hcSysLayout();
  if(d.t){ HCT.tc = d.t; HCT.tab = 'def'; return openD('@hctest'); }
  if(d.c && !d.u){ const c = hcR().cables[d.c]; if(!c) return; if(HCS.catF && !hcCableStats(c).byCat[HCS.catF]){ HCS.catF = ''; renderViewBar(); renderView(); }
    const us = c.nodes.filter(n => n.kind === 'conn' && E(n.port)).map(n => P[E(n.port).owner]).filter(Boolean); if(us.length) hcCenterOn(us.reduce((a, u) => a + u.x + u.w / 2, 0) / us.length, us.reduce((a, u) => a + u.y + u.h / 2, 0) / us.length);
    HCS.sel = c.id; renderViewBar(); return hcFlash(`#hcSys .hcLabels [data-hcw="${c.id}"]`); }
  if(d.u){ if(HCS.catF && !document.querySelector(`#hcSys [data-hcu="${d.u}"]`)){ HCS.catF = ''; renderViewBar(); renderView(); }
    const u = P[d.u]; if(u) hcCenterOn(u.x + u.w / 2, u.y + u.h / 2); hcFlash(d.p ? `#hcSys [data-hcpt="${d.p}"]` : `#hcSys [data-hcu="${d.u}"]`); }
}
async function hcViewPdf(){
  const R = HC7.q ? hcSearch(HC7.q) : null, cat = hcCat(HCS.catF);
  const title = (cat ? cat.name + ' mimarisi' : 'Sistem kablaj mimarisi') + (R ? ' — arama: ' + R.q : '') + (HCS.cov ? ' — test kapsaması' : '');
  const sub = [R ? `"${R.q}" araması: ${R.units.size} birim, ${R.cables.size} kablaj, ${R.pins.size} pin vurgulu; diğerleri soluk` : '', HCS.cov ? 'kablajlar test kapsamasına göre renkli (yeşil tam, turuncu kısmi, kırmızı yok)' : ''].filter(Boolean).join(' · ');
  const page = hcArchPage(HCS.catF || '', 1, 1, {hl:R, cov:!!HCS.cov, title, sub});
  toast('PDF hazırlanıyor…');
  const im = await svgToFlate({str:page, w:HC_PW, h:HC_PH}, 2);
  download(buildPdf([Object.assign(im, {pw:1190.55, ph:841.89, dw:1190.55, dh:841.89, dx:0, dy:0})]), fileSafe((E(M.rootId) ? E(M.rootId).name + ' - ' : '') + title) + '.pdf');
}
/* ---------- kablaj detayı: yakınlaştırma / kaydırma ---------- */
{ const bC = VIEWS['@hccable'].bar; VIEWS['@hccable'].bar = () => bC() + `<span class="vsep"></span><button class="vb" data-hc7="cin" title="Yakınlaştır (Ctrl + tekerlek)">+</button><button class="vb" data-hc7="cout">−</button><button class="vb" data-hc7="cfit" title="Şemayı kutuya sığdır">Sığdır</button><button class="vb" data-hc7="c100">%100</button><input data-hc7f="q" placeholder="Pinleri vurgula (sinyal, etiket, J1-3…)" value="${esc(HC7.q)}" style="width:220px" class="noi18n">${HC7.q ? '<button class="vb" data-hc7="clr">✕</button>' : ''}`; }
function hcCabZoom(k){ const sv = $('#hcCabSvg'), wr = $('#hcCabWrap'); if(!sv || !wr) { HC7.ck = k; return; } const vb = sv.viewBox.baseVal, cx = (wr.scrollLeft + wr.clientWidth / 2) / HC7.ck, cy = (wr.scrollTop + wr.clientHeight / 2) / HC7.ck;
  HC7.ck = Math.max(0.25, Math.min(4, k)); sv.setAttribute('width', Math.round(vb.width * HC7.ck)); sv.setAttribute('height', Math.round(vb.height * HC7.ck)); wr.scrollLeft = cx * HC7.ck - wr.clientWidth / 2; wr.scrollTop = cy * HC7.ck - wr.clientHeight / 2; }
function hcCabFit(){ const sv = $('#hcCabSvg'), wr = $('#hcCabWrap'); if(!sv || !wr) return; const vb = sv.viewBox.baseVal; hcCabZoom(Math.min((wr.clientWidth - 4) / vb.width, (wr.clientHeight - 4) / vb.height || 1)); }
(() => {
  const V = $('#view'), onS = () => ST.cur === '@hcsys', onC = () => ST.cur === '@hccable';
  let tm = 0;
  const apply = () => { HC7C.key = ''; if(onS()){ renderView(); const b = document.querySelector('.vbar [data-hc7="clr"]'); if(!!b !== !!HC7.q) { const i = document.querySelector('[data-hc7f="q"]'), pos = i && i.selectionStart; renderViewBar(); const j = document.querySelector('[data-hc7f="q"]'); if(j){ j.focus(); try { j.setSelectionRange(pos, pos); } catch(e){} } } } else if(onC()){ const wr = $('#hcCabWrap'), sl = wr && [wr.scrollLeft, wr.scrollTop]; renderView(); const w2 = $('#hcCabWrap'); if(w2 && sl){ w2.scrollLeft = sl[0]; w2.scrollTop = sl[1]; } } };
  document.addEventListener('input', ev => { if(!(onS() || onC()) || !ev.target.dataset || ev.target.dataset.hc7f !== 'q') return; HC7.q = ev.target.value; clearTimeout(tm); tm = setTimeout(apply, 180); });
  document.addEventListener('keydown', ev => { if(ev.target.dataset && ev.target.dataset.hc7f === 'q'){ ev.stopPropagation(); if(ev.key === 'Escape'){ HC7.q = ''; ev.target.value = ''; apply(); } if(ev.key === 'Enter'){ const R = hcSearch(HC7.q); if(R && R.hits[0] && onS()) hcGoHit({u:R.hits[0].unit || '', c:R.hits[0].cable || '', p:R.hits[0].port || '', t:R.hits[0].test || ''}); } } }, true);
  document.addEventListener('click', ev => {
    if(!(onS() || onC())) return; const b = ev.target.closest && ev.target.closest('[data-hc7]'); if(!b) return; ev.preventDefault(); const a = b.dataset.hc7;
    if(a === 'clr'){ HC7.q = ''; HC7C.key = ''; renderViewBar(); renderView(); return; }
    if(a === 'tog'){ HC7.open = !HC7.open; renderView(); return; }
    if(a === 'cat'){ HCS.catF = b.dataset.k; renderViewBar(); renderView(); return; }
    if(a === 'go') return hcGoHit({u:b.dataset.u, c:b.dataset.c, p:b.dataset.p, t:b.dataset.t, f:b.dataset.f});
    if(a === 'pdf') return hcViewPdf();
    if(a === 'cin') return hcCabZoom(HC7.ck * 1.25);
    if(a === 'cout') return hcCabZoom(HC7.ck / 1.25);
    if(a === 'c100') return hcCabZoom(1);
    if(a === 'cfit') return hcCabFit();
  });
  /* panel üzerindeki fare olayları şemayı sürüklemesin / yakınlaştırmasın */
  V.addEventListener('mousedown', ev => { if(onS() && ev.target.closest && ev.target.closest('#hc7Panel')) ev.stopPropagation(); }, true);
  V.addEventListener('wheel', ev => { if(onS() && ev.target.closest && ev.target.closest('#hc7Panel')) ev.stopPropagation();
    if(onC() && ev.ctrlKey && ev.target.closest && ev.target.closest('#hcCabWrap')){ ev.preventDefault(); hcCabZoom(HC7.ck * (ev.deltaY < 0 ? 1.15 : 1 / 1.15)); } }, {capture:true, passive:false});
  /* kablaj şemasında boş alanı sürükleyerek kaydır */
  let pan = null;
  V.addEventListener('mousedown', ev => { if(!onC() || ev.button !== 0) return; const wr = ev.target.closest && ev.target.closest('#hcCabWrap'); if(!wr) return; pan = {wr, x:ev.clientX, y:ev.clientY, l:wr.scrollLeft, t:wr.scrollTop}; wr.style.cursor = 'grabbing'; ev.preventDefault(); });
  window.addEventListener('mousemove', ev => { if(!pan) return; pan.wr.scrollLeft = pan.l - (ev.clientX - pan.x); pan.wr.scrollTop = pan.t - (ev.clientY - pan.y); });
  window.addEventListener('mouseup', () => { if(pan){ pan.wr.style.cursor = 'grab'; pan = null; } });
})();
/* Kablaj tablosu satırlarını da vurgula */
{ const rC = VIEWS['@hccable'].render; VIEWS['@hccable'].render = () => { let h = rC(); const R = HC7.q ? hcSearch(HC7.q) : null, c = HCS.cab && hcR().cables[HCS.cab]; if(!R || !c) return h;
  const lit = new Set(c.wires.filter(w => [w.a, w.b].some(e => { const pe = hcEndPin(c, e); return pe && R.pins.has(pe.port.id + '|' + (pe.no || e.pin)); })).map(w => w.id));
  lit.forEach(id => { h = h.replace(new RegExp(`<tr class="([^"]*)"(><td><b>[^<]*</b></td><td><select data-hcwf="${id}\\|a")`), '<tr class="$1" style="background:#fff2c4"$2'); });
  return h.replace('<div class="hcsec">Hatlar', `<div class="muted" style="font-size:12px;margin:4px 0">"${esc(R.q)}": bu kablajda ${lit.size} hat vurgulu</div><div class="hcsec">Hatlar`); }; }
