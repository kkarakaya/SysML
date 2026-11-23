/* ================= v1.56: KABLAJ — AWG / BÜKÜMLÜ ÇİFT ÖNERİSİ, TEKNİK RESİM (A3 PDF: PİN PİN ŞEMA, HAT LİSTESİ, BOM, ANTET), KONNEKTÖR GÖRÜNÜMLERİ =================
   AWG önerisi (hat başına):
     - akım: hattan geçen akım (v1.55 KCL) ≤ kapasite (kablajda 1'den çok hat varsa demet değeri, yoksa tek hat)
     - gerilim düşümü: kablaj maks. uzunluğu girilmişse ve hat güç hattıysa, gidiş + dönüş için hat başına izin = V × %düşüm / 2
     - kontak: uçlardaki kontakların kabul ettiği AWG aralıklarının kesişimi (en kalın … en ince)
     → "en ince uygun" (önerilen, ağırlık için) ve "en kalın kabul" (kontak sınırı); hiçbiri uymuyorsa uyarı
   Bükümlü çift: pinout'taki çift eşi (pair) veya etiket adı (+/-, _H/_L) ile; protokole göre empedans (RS-422/485, CAN 120 Ω, 1553 78 Ω, Ethernet 100 Ω);
   güç beslemesi ile dönüşü bükümlü çift (EMI) olarak önerilir. */
const hcOpt3 = () => Object.assign({vdrop:5, practical:24}, hcR().opt || {});
const hcIsPwr = d => { const c = hcPinCat(d), dir = d.dir || (d.lbl && (hcLabel(d.lbl) || {}).dir) || ''; return c === 'c_pwr' || ['src', 'snk', 'rtn'].includes(dir); };
function hcNomV(d){ const a = hcNum(d.vmin), b = hcNum(d.vmax); if(a != null && b != null && a > 0 && b > 0) return +((a + b) / 2).toFixed(3); if(b != null && b > 0) return b; if(a != null && a > 0) return a; return null; }   /* aralık ortası (28 V hat 22–32 V → 27 V) */
/* bir hattın AWG önerisi: {I, thick, thin, rec, ok, why:[…]} — AWG numarası büyüdükçe hat incelir */
function hcAwgSuggest(c, w, nets){
  const T = (hcR().awg || []).slice().sort((a, b) => b.awg - a.awg), o = hcOpt3(), why = [];   /* incelden kalına */
  const I = hcWireCurrent(c, w, nets || hcNets(c)), bundle = c.wires.filter(x => x.on !== false).length > 1;
  let thick = Math.min(...T.map(r => r.awg)), thin = Math.max(...T.map(r => r.awg));
  [w.a, w.b].forEach(e => { const pe = hcEndPin(c, e); if(!pe) return; const t = hcType(pe.port.hc.ct), pt = t && (t.pins || []).find(x => x.no === e.pin), k = pt && hcContact(pt.size);
    if(k){ thick = Math.max(thick, +k.awgThick); thin = Math.min(thin, +k.awgThin); const m = `kontak ${pt.size}: ${k.awgThick}–${k.awgThin} AWG`; if(!why.includes(m)) why.push(m); } });
  const cap = r => bundle ? r.bundle : r.single;
  let rMax = null; const pe = hcEndPin(c, w.a) || hcEndPin(c, w.b), len = hcNum(c.len);
  if(pe && hcIsPwr(pe.d) && I > 0 && len){ const V = (() => { const net = (nets || hcNets(c)).find(n => n.keys.includes(hcEndKey(w.a))); const vs = net ? net.ends.map(e => hcEndPin(c, e)).filter(Boolean).map(x => hcNomV(x.d)).filter(v => v != null) : []; return vs.length ? Math.max(...vs) : hcNomV(pe.d); })();
    const V2 = V || (() => { const vs = c.nodes.filter(n => n.kind === 'conn').flatMap(n => { const p = E(n.port); return p ? hcPins(p).filter(x => hcIsPwr(x.d)).map(x => hcNomV(x.d)) : []; }).filter(v => v != null); return vs.length ? Math.max(...vs) : null; })();   /* dönüş hattı: kablajdaki besleme gerilimi */
    if(V2 && !V) why.push(`dönüş hattı: besleme ${V2} V`);
    if(V2){ const V = V2; rMax = (V * o.vdrop / 100 / 2) / (I * len) * 1000; why.push(`gerilim düşümü: ${V} V, %${o.vdrop} (gidiş+dönüş), ${len} m → hat ≤ ${rMax.toFixed(1)} Ω/km`); } }
  if(I > 0) why.push(`akım ${I} A, ${bundle ? 'demet içinde' : 'tek hat'} kapasite`);
  const fits = r => r.awg >= thick && r.awg <= thin && (I <= 0 || cap(r) >= I) && (rMax == null || r.ohm <= rMax);
  const okList = T.filter(fits);
  let rec = okList.length ? okList[0].awg : null;
  if(rec != null && I <= 0 && rec > o.practical && T.some(r => r.awg === o.practical && fits(r))) { rec = o.practical; why.push(`akımsız hat: pratik alt sınır ${o.practical} AWG`); }
  else if(rec != null && I <= 0 && rec > o.practical){ why.push(`akımsız hat: kontak ${rec} AWG'ye izin veriyor`); }
  const out = {I, thick, thin, rec, minAwg:rec, ok:rec != null, why, rMax};
  if(!out.ok){ const byI = T.filter(r => cap(r) >= I && (rMax == null || r.ohm <= rMax)); out.need = byI.length ? byI[0].awg : null; out.why.push(out.need != null ? `akım / düşüm için en az ${out.need} AWG gerekir, kontak en kalın ${thick} AWG kabul eder — daha büyük kontak veya paralel pin kullanın` : 'tabloda yeterli hat yok'); }
  return out;
}
/* bükümlü çift / ekranlı çift önerisi: [{wires:[id, id], kind, shield}] */
function hcTwistSuggest(c){
  const on = c.wires.filter(w => w.on !== false), out = [], used = new Set();
  const info = w => { const pe = hcEndPin(c, w.a) || hcEndPin(c, w.b); return pe ? {pe, lbl:(hcLabel(pe.d.lbl) || {}).name || pe.d.sig || '', key:hcEndKey(hcEndPin(c, w.a) ? w.a : w.b)} : null; };
  const proto = n => /1553/i.test(n) ? ['Ekranlı twinax 78 Ω (MIL-STD-1553)', true] : /ETH|TX_?D|RX_?D|MDI/i.test(n) ? ['Ekranlı bükümlü çift 100 Ω (Ethernet)', true] : /CAN/i.test(n) ? ['Ekranlı bükümlü çift 120 Ω (CAN)', true] : /422|485/i.test(n) ? ['Ekranlı bükümlü çift 120 Ω (RS-422/485)', true] : /LVDS|SPW|SPACEWIRE/i.test(n) ? ['Ekranlı bükümlü çift 100 Ω (LVDS / SpaceWire)', true] : ['Bükümlü çift', false];
  const base = n => String(n).replace(/(\+|-|_P|_N|_H|_L|P|N)$/i, '').replace(/_RTN$/i, '');
  on.forEach(w => { if(used.has(w.id)) return; const a = info(w); if(!a) return;
    /* 1) pinout'taki çift eşi */
    const pair = a.pe.d.pair; let mate = null;
    if(pair){ const [n] = a.key.split('|'); mate = on.find(x => x.id !== w.id && !used.has(x.id) && [x.a, x.b].some(e => e.n === n && e.pin === pair)); }
    /* 2) etiket adı: X+ / X-, X_H / X_L */
    if(!mate && /(\+|-|_H|_L)$/i.test(a.lbl)){ const b0 = base(a.lbl); mate = on.find(x => { if(x.id === w.id || used.has(x.id)) return false; const b = info(x); return b && b.lbl !== a.lbl && /(\+|-|_H|_L)$/i.test(b.lbl) && base(b.lbl) === b0; }); }
    if(mate){ used.add(w.id); used.add(mate.id); const [kind, shield] = proto(a.lbl); out.push({wires:[w.id, mate.id], kind, shield}); return; }
    /* 3) güç: besleme + dönüş */
    if(hcIsPwr(a.pe.d) && !/RTN|GND/i.test(a.lbl)){ const m2 = on.find(x => { if(x.id === w.id || used.has(x.id)) return false; const b = info(x); return b && hcIsPwr(b.pe.d) && (b.lbl === a.lbl + '_RTN' || /RTN|GND/i.test(b.lbl)) && [x.a, x.b].some(e => [w.a, w.b].some(f => f.n === e.n)); });
      if(m2){ used.add(w.id); used.add(m2.id); out.push({wires:[w.id, m2.id], kind:'Bükümlü güç çifti (besleme + dönüş, EMI)', shield:false}); } }
  });
  return out;
}
function hcApplySuggest(c, opt){
  const nets = hcNets(c); let nA = 0, nG = 0;
  if(opt.awg) c.wires.forEach(w => { if(w.on === false) return; const s = hcAwgSuggest(c, w, nets); if(s.ok && (opt.overwrite || !w.awg)){ w.awg = s.rec; nA++; } });
  if(opt.twist){ const gs = hcTwistSuggest(c); let k = 0; const usedG = new Set(c.wires.map(w => w.grp).filter(Boolean));
    gs.forEach(g => { const ws = g.wires.map(id => c.wires.find(w => w.id === id)); if(!opt.overwrite && ws.some(w => w.grp)) return; let name; do { k++; name = (g.shield ? 'TSP' : 'TP') + k; } while(usedG.has(name)); usedG.add(name); ws.forEach(w => { w.grp = name; if(g.shield) w.shield = true; }); nG++; }); }
  return {nA, nG};
}
function hcSuggestDialog(c){
  const nets = hcNets(c), rows = c.wires.map((w, i) => ({w, i, s:w.on === false ? null : hcAwgSuggest(c, w, nets)})), gs = hcTwistSuggest(c), o = hcOpt3();
  const box = $('#modalBox'); box.style.width = 'min(1100px, 96vw)'; box.style.maxWidth = 'none';
  box.innerHTML = `<h2>${esc(c.name)} — AWG ve bükümlü çift önerisi</h2>
    <p class="muted" style="font-size:12px;margin:-4px 0 8px">Önerilen = akım, gerilim düşümü ve kontak aralığını sağlayan <b>en ince</b> hat; "en kalın" uçlardaki kontakların kabul ettiği sınırdır. Kablaj maks. uzunluğu: <b>${c.len ? esc(c.len) + ' m' : 'girilmedi — yalnız akım kapasitesine bakılır'}</b>.
      İzin verilen gerilim düşümü % <input id="hcVd" value="${esc(o.vdrop)}" style="width:44px"> · akımsız hatlarda pratik alt sınır <input id="hcPr" value="${esc(o.practical)}" style="width:40px"> AWG <button class="pbtn" id="hcSgRe">Yeniden hesapla</button></p>
    <div style="max-height:46vh;overflow:auto"><table class="hcpt"><thead><tr><th>Hat</th><th>Uç A</th><th>Uç B</th><th>Sinyal</th><th>Akım</th><th>Mevcut</th><th>Önerilen</th><th>En ince / en kalın</th><th>Gerekçe</th></tr></thead><tbody>
    ${rows.map(({w, i, s}) => { const pe = hcEndPin(c, w.a) || hcEndPin(c, w.b); return `<tr class="${s ? '' : 'unused'}"><td><b>${esc(hcWireName(c, i))}</b></td><td>${esc(hcEndLabel(c, w.a))}</td><td>${esc(hcEndLabel(c, w.b))}</td><td>${esc(pe ? pe.d.sig || '' : '')}</td><td>${s && s.I ? s.I + ' A' : ''}</td><td>${esc(w.awg || '—')}</td>
      <td>${!s ? 'bağlı değil' : s.ok ? `<b>${s.rec} AWG</b>` : '<span style="color:#c0392b">uygun yok</span>'}</td><td>${s ? (s.ok ? s.rec : '—') + ' / ' + s.thick : ''}</td><td style="font-size:11px;max-width:380px">${s ? esc(s.why.join(' · ')) : ''}</td></tr>`; }).join('')}</tbody></table></div>
    <div class="hcsec">Bükümlü çift önerileri (${gs.length})</div>
    <div style="font-size:12px;max-height:18vh;overflow:auto">${gs.map(g => `• ${g.wires.map(id => { const j = c.wires.findIndex(w => w.id === id); return hcWireName(c, j) + ' (' + esc(hcEndLabel(c, c.wires[j].a)) + ')'; }).join(' + ')} — <b>${esc(g.kind)}</b>`).join('<br>') || '<span class="muted">Öneri yok (pinout\'ta çift eşi veya +/- etiketli hat bulunamadı)</span>'}</div>
    <p style="margin:12px 0 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><label><input type="checkbox" id="hcSgA" checked> AWG önerilerini uygula</label><label><input type="checkbox" id="hcSgT" checked> Bükümlü grupları uygula</label><label><input type="checkbox" id="hcSgO"> Dolu alanların üzerine yaz</label>
      <span style="flex:1"></span><button class="pbtn" id="hcSgC">Kapat</button> <button class="pbtn pri" id="hcSgOk">Uygula</button></p>`;
  $('#modal').style.display = 'flex';
  const close = () => { $('#modal').style.display = 'none'; box.style.width = ''; box.style.maxWidth = ''; box.onclick = null; };
  const setOpt = () => { const H = hcM(); H.opt = Object.assign({}, H.opt || {}, {vdrop:numOf($('#hcVd').value) || 5, practical:parseInt($('#hcPr').value, 10) || 24}); };
  box.onclick = ev => { const id = ev.target.id;
    if(id === 'hcSgC') close();
    if(id === 'hcSgRe'){ snap(); setOpt(); afterChange(); hcSuggestDialog(c); }
    if(id === 'hcSgOk'){ snap(); setOpt(); const r = hcApplySuggest(c, {awg:$('#hcSgA').checked, twist:$('#hcSgT').checked, overwrite:$('#hcSgO').checked}); close(); afterChange(); hcRefresh(); toast(`${r.nA} hatta AWG, ${r.nG} bükümlü grup uygulandı`); } };
}
/* ---------- BOM ve hat listesi ---------- */
function hcBOM(c){
  const rows = [], add = (part, pn, desc, qty, unit) => { const k = part + '|' + pn + '|' + desc + '|' + unit, r = rows.find(x => x.k === k); if(r) r.qty = +(r.qty + qty).toFixed(2); else rows.push({k, part, pn, desc, qty, unit}); };
  const on = c.wires.filter(w => w.on !== false), len = hcNum(c.len);
  c.nodes.filter(n => n.kind === 'conn').forEach(n => { const p = E(n.port); if(!p) return; const t = hcType(p.hc.ct), u = E(p.owner);
    add('Konnektör (kablaj ucu)', t && t.mate || '', `${u ? u.name : '?'} · ${p.name} ile eşleşir${t ? ' (' + (t.pn || t.name) + ')' : ''}`, 1, 'adet');
    if(t && t.backshell) add('Backshell', '', t.backshell, 1, 'adet');
    const cnt = {}; on.forEach(w => [w.a, w.b].forEach(e => { if(e.n !== n.id) return; const pt = t && (t.pins || []).find(x => x.no === e.pin); const sz = pt ? pt.size : '?'; cnt[sz] = (cnt[sz] || 0) + 1; }));
    const g = t && /Dişi/.test(t.gender || '') ? 'pin (erkek)' : t && /Erkek/.test(t.gender || '') ? 'soket (dişi)' : '';
    if(t && !/(Hat|Tel) uçlu|PCB|Lehim/.test(t.term || '')) Object.entries(cnt).forEach(([sz, q]) => add('Kontak', '', `${sz} ${g} — kablaj ucu konnektörüne`, q, 'adet'));
  });
  const grpDone = new Set();
  on.forEach(w => { if(w.grp && on.filter(x => x.grp === w.grp).length > 1){ if(grpDone.has(w.grp)) return; grpDone.add(w.grp); const ws = on.filter(x => x.grp === w.grp), awg = ws[0].awg || '?', sh = ws.some(x => x.shield);
      const awgs = [...new Set(ws.map(x => x.awg || '?'))].join('/'); add(sh ? 'Ekranlı bükümlü kablaj' : 'Bükümlü kablaj', '', `M27500 tipi, ${ws.length} damarlı, ${awgs} AWG${sh ? ', ekranlı + ceketli' : ''}`, len ? len : 1, len ? 'm' : 'adet (uzunluk girilmedi)'); }
    else add('Hat', `M22759/16-${w.awg || '?'} (örnek)`, `${w.awg || '?'} AWG, ETFE yalıtımlı kalaylı bakır${w.shield ? ' (ekranlı)' : ''}`, len ? len : 1, len ? 'm' : 'adet (uzunluk girilmedi)'); });
  const sps = c.nodes.filter(n => n.kind === 'splice'); if(sps.length) add('Splice', 'M81824/1 (örnek)', 'Kıvırmalı splice, ısı ile daralan kılıflı', sps.length, 'adet');
  const nc = c.nodes.filter(n => n.kind === 'conn').length;
  add('Kimlik etiketi', '', `Kablaj kimlik markörü (${c.name})`, nc + 1, 'adet');
  add('Isı ile daralan makaron', '', 'Konnektör çıkışı / dallanma', nc + sps.length, 'adet');
  return rows.map((r, i) => Object.assign(r, {no:i + 1}));
}
function hcWireList(c){ return c.wires.map((w, i) => ({w, name:hcWireName(c, i), a:hcEndLabel(c, w.a), b:hcEndLabel(c, w.b), sig:(() => { const pe = hcEndPin(c, w.a) || hcEndPin(c, w.b); return pe ? pe.d.sig || (hcLabel(pe.d.lbl) || {}).name || '' : ''; })()})).filter(x => x.w.on !== false); }
function hcBomXlsx(cs){
  const S = [];
  cs.forEach(c => {
    S.push({name:c.name + ' BOM', rows:[['No', 'Parça', 'Parça no', 'Açıklama', 'Miktar', 'Birim'].map(v => ({v, s:1}))].concat(hcBOM(c).map(r => [r.no, r.part, r.pn, r.desc, r.qty, r.unit])), widths:[5, 24, 30, 50, 9, 18], header:true, freeze:[1, 0]});
    S.push({name:c.name + ' Hatlar', rows:[['Hat', 'Uç A', 'Uç B', 'Sinyal', 'AWG', 'Renk', 'Bükümlü grup', 'Ekranlı'].map(v => ({v, s:1}))].concat(hcWireList(c).map(x => [x.name, x.a, x.b, x.sig, x.w.awg || '', x.w.color || '', x.w.grp || '', x.w.shield ? 'Evet' : ''])), widths:[10, 16, 16, 20, 7, 10, 12, 8], header:true, freeze:[1, 0]});
  });
  if(!S.length) return toast('Kablaj yok');
  download(buildXlsx(S), fileSafe(cs.length === 1 ? cs[0].name + ' - BOM ve hatlar' : 'Kablajlar - BOM ve hatlar') + '.xlsx');
}
/* ---------- teknik resim sayfaları (A3 yatay, 1587 × 1123) ---------- */
const HC_PW = 1587, HC_PH = 1123, HC_TBW = 577, HC_TBH = 150;
const hcT = (x, y, s, o) => `<text x="${x}" y="${y}" font-size="${(o && o.fs) || 11}"${o && o.b ? ' font-weight="700"' : ''}${o && o.a ? ` text-anchor="${o.a}"` : ''} fill="${(o && o.c) || '#111'}">${esc(s)}</text>`;
function hcDwg(c){ return Object.assign({no:c.name, title:'Kablaj ' + c.name, rev:'A', by:'', chk:'', appr:'', date:new Date().toLocaleDateString('tr-TR')}, c.dwg || {}); }
function hcTitleBlock(c, page, pages, sub){
  const d = hcDwg(c), x = HC_PW - 20 - HC_TBW, y = HC_PH - 20 - HC_TBH, sec = typeof secLabel === 'function' ? secLabel() : '', proj = E(M.rootId) ? E(M.rootId).name : '';
  const cell = (cx, cy, w, h, lab, val, fs) => `<rect x="${cx}" y="${cy}" width="${w}" height="${h}" fill="none" stroke="#111" stroke-width="0.8"/>${hcT(cx + 4, cy + 11, lab, {fs:8, c:'#555'})}${hcT(cx + 6, cy + h - 7, val, {fs:fs || 12, b:true})}`;
  return `<g>${cell(x, y, 385, 50, 'Başlık', d.title + (sub ? ' — ' + sub : ''), 15)}${cell(x + 385, y, 192, 50, 'Çizim no', d.no, 14)}
    ${cell(x, y + 50, 192, 34, 'Proje / model', proj)}${cell(x + 192, y + 50, 96, 34, 'Revizyon', d.rev)}${cell(x + 288, y + 50, 97, 34, 'Ölçek', 'Ölçeksiz')}${cell(x + 385, y + 50, 192, 34, 'Sayfa', page + ' / ' + pages)}
    ${cell(x, y + 84, 144, 34, 'Hazırlayan', d.by)}${cell(x + 144, y + 84, 144, 34, 'Kontrol', d.chk)}${cell(x + 288, y + 84, 145, 34, 'Onay', d.appr)}${cell(x + 433, y + 84, 144, 34, 'Tarih', d.date)}
    ${cell(x, y + 118, 577, 32, 'Gizlilik', sec || '—', 11)}</g>`;
}
const hcFrame = inner => `<svg xmlns="http://www.w3.org/2000/svg" width="${HC_PW}" height="${HC_PH}" viewBox="0 0 ${HC_PW} ${HC_PH}" font-family="Segoe UI, Arial, sans-serif"><rect width="${HC_PW}" height="${HC_PH}" fill="#fff"/><rect x="12" y="12" width="${HC_PW - 24}" height="${HC_PH - 24}" fill="none" stroke="#111" stroke-width="1.6"/>${inner}</svg>`;
function hcTable(x, y, cols, rows, rh){
  rh = rh || 16; const W = cols.reduce((s, c) => s + c[1], 0); let s = `<rect x="${x}" y="${y}" width="${W}" height="${rh + 2}" fill="#e8ecf2" stroke="#111" stroke-width="0.8"/>`, cx = x;
  cols.forEach(([h, w]) => { s += hcT(cx + 4, y + rh - 3, h, {fs:9.5, b:true}); cx += w; });
  rows.forEach((r, i) => { const yy = y + rh + 2 + i * rh; s += `<rect x="${x}" y="${yy}" width="${W}" height="${rh}" fill="${i % 2 ? '#f6f8fb' : '#fff'}" stroke="#bbb" stroke-width="0.4"/>`; let cx2 = x; cols.forEach(([, w], j) => { const v = String(r[j] == null ? '' : r[j]), maxc = Math.max(3, Math.floor(w / 5.6)); s += hcT(cx2 + 4, yy + rh - 4, v.length > maxc ? v.slice(0, maxc - 1) + '…' : v, {fs:9.5}); cx2 += w; }); });
  cx = x; cols.forEach(([, w]) => { s += `<line x1="${cx}" y1="${y}" x2="${cx}" y2="${y + rh + 2 + rows.length * rh}" stroke="#999" stroke-width="0.4"/>`; cx += w; });
  return {svg:s + `<rect x="${x}" y="${y}" width="${W}" height="${rh + 2 + rows.length * rh}" fill="none" stroke="#111" stroke-width="0.8"/>`, h:rh + 2 + rows.length * rh};
}
const HC_WCOLS = [['Hat', 58], ['Uç A', 96], ['Uç B', 96], ['Sinyal', 120], ['AWG', 40], ['Renk', 58], ['Grup', 58], ['Ekr.', 51]];
const HC_BCOLS = [['No', 26], ['Parça', 120], ['Parça no', 150], ['Açıklama', 196], ['Miktar', 85]];
/* kablaj için sayfa listesi: [{str, w, h}] */
function hcDrawingPages(c){
  const wl = hcWireList(c), bom = hcBOM(c), pages = [], RH = 16;
  const bomH = RH + 2 + bom.length * RH, bomY = HC_PH - 20 - HC_TBH - 14 - bomH - 18, colX = HC_PW - 20 - HC_TBW;
  const wlY = 54, wlMax = Math.max(0, Math.floor((bomY - 30 - wlY - RH - 2) / RH)), first = wl.slice(0, wlMax), rest = wl.slice(wlMax);
  const aw = colX - 50, ah = HC_PH - 80, r = hcCableSVG(c, {exp:true, w:Math.round(aw)}), k = Math.min(aw / r.w, ah / r.h, 1.3);
  const notes = [`Kablaj maks. uzunluğu: ${c.len ? c.len + ' m' : 'belirtilmedi'}`].concat(c.note ? [c.note] : []);
  const conns = Math.ceil(c.nodes.filter(n => n.kind === 'conn').length / 3), restPages = Math.ceil(rest.length / 60);
  const total = 1 + restPages + Math.max(1, conns);
  let p1 = `${hcT(30, 40, 'PİN PİN BAĞLANTI ŞEMASI — ' + c.name, {fs:14, b:true})}<g transform="translate(30,${54}) scale(${k})">${r.svg}</g>`;
  p1 += hcT(colX, 40, 'HAT LİSTESİ' + (rest.length ? ` (1–${first.length} / ${wl.length}, devamı sayfa 2)` : ''), {fs:12, b:true});
  p1 += hcTable(colX, wlY, HC_WCOLS, first.map(x => [x.name, x.a, x.b, x.sig, x.w.awg || '', x.w.color || '', x.w.grp || '', x.w.shield ? '✓' : '']), RH).svg;
  p1 += notes.map((n, i) => hcT(colX, bomY - 22 - (notes.length - 1 - i) * 13, n, {fs:10, c:'#333'})).join('');
  p1 += hcT(colX, bomY - 4, 'MALZEME LİSTESİ (BOM)', {fs:12, b:true}) + hcTable(colX, bomY + 4, HC_BCOLS, bom.map(b => [b.no, b.part, b.pn, b.desc, b.qty + ' ' + b.unit.replace(' (uzunluk girilmedi)', '')]), RH).svg;
  p1 += hcTitleBlock(c, 1, total, 'Bağlantı şeması');
  pages.push({str:hcFrame(p1), w:HC_PW, h:HC_PH});
  for(let i = 0; i < restPages; i++){ const part = rest.slice(i * 60, i * 60 + 60), L = part.slice(0, 30), R = part.slice(30);
    let s = hcT(30, 40, `HAT LİSTESİ (devam) — ${c.name}`, {fs:14, b:true}) + hcTable(30, 54, HC_WCOLS, L.map(x => [x.name, x.a, x.b, x.sig, x.w.awg || '', x.w.color || '', x.w.grp || '', x.w.shield ? '✓' : '']), RH).svg;
    if(R.length) s += hcTable(colX, 54, HC_WCOLS, R.map(x => [x.name, x.a, x.b, x.sig, x.w.awg || '', x.w.color || '', x.w.grp || '', x.w.shield ? '✓' : '']), RH).svg;
    pages.push({str:hcFrame(s + hcTitleBlock(c, 2 + i, total, 'Hat listesi')), w:HC_PW, h:HC_PH}); }
  const cn = c.nodes.filter(n => n.kind === 'conn'), cells = [[30, 50, 750, 440], [807, 50, 750, 440], [30, 520, 750, 450]];
  for(let i = 0; i < Math.max(1, conns); i++){ let s = hcT(30, 40, `KONNEKTÖR GÖRÜNÜMLERİ — ${c.name}`, {fs:14, b:true});
    cn.slice(i * 3, i * 3 + 3).forEach((n, j) => { const [x, y, w, h] = cells[j]; s += hcConnFace(c, n, x, y, w, h); });
    if(!cn.length) s += hcT(30, 80, 'Kablajda konnektör yok', {fs:12});
    pages.push({str:hcFrame(s + hcTitleBlock(c, 2 + restPages + i, total, 'Konnektör görünümleri')), w:HC_PW, h:HC_PH}); }
  return pages;
}
/* konnektör ön / arka yüz çizimi: her zaman dikdörtgen; pinler numaralandırma başlangıç köşesine göre satır satır */
function hcFaceGrid(n, rows, start){
  rows = Math.max(1, Math.min(n, rows || (n <= 4 ? 1 : n <= 15 ? 2 : Math.round(Math.sqrt(n * 0.55))))); const cols = Math.ceil(n / rows), pos = [];
  for(let i = 0; i < n; i++){ let r = Math.floor(i / cols), cc = i % cols; if(/Sağ/.test(start || '')) cc = cols - 1 - cc; if(/alt/.test(start || '')) r = rows - 1 - r; pos.push({r, c:cc}); }
  return {rows, cols, pos};
}
function hcConnFace(c, n, x, y, w, h){
  const p = E(n.port), u = p && E(p.owner), t = p && hcType(p.hc.ct); if(!p) return '';
  const pins = t ? t.pins || [] : hcPins(p).map(q => ({no:q.no, size:q.size})), wired = new Map();
  c.wires.filter(wr => wr.on !== false).forEach((wr, i) => [wr.a, wr.b].forEach(e => { if(e.n === n.id) wired.set(e.pin, hcWireName(c, c.wires.indexOf(wr))); }));
  const view = (t && t.view) || HC_VIEWS[0], start = (t && t.start) || 'Sol üst', G = hcFaceGrid(pins.length, t && hcNum(t.rows), start);
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#999" stroke-width="0.6" stroke-dasharray="4 3"/>`;
  s += hcT(x + 10, y + 20, `${u ? u.name : '?'} · ${p.name}`, {fs:14, b:true}) + hcT(x + 10, y + 37, `Birim konnektörü: ${t ? (t.pn || t.name) : 'tip yok'}${t && t.mate ? '   ·   Kablaj ucu: ' + t.mate : ''}`, {fs:10.5, c:'#333'});
  s += hcT(x + 10, y + 52, `Görünüm: ${view} · Numaralandırma: ${start.toLowerCase()} köşeden başlar · ${pins.length} kontak${t && t.gender ? ' · ' + t.gender : ''}`, {fs:10.5, c:'#1f4e8c', b:true});
  const top = y + 64, legH = 36, bw = w - 40, bh = h - (top - y) - legH - 10, cw = bw / Math.max(1, G.cols), ch = bh / Math.max(1, G.rows), rr = Math.max(4, Math.min(24, Math.min(cw, ch) * 0.32));
  s += `<rect x="${x + 20}" y="${top}" width="${bw}" height="${bh}" rx="10" fill="#f4f6f9" stroke="#111" stroke-width="1.4"/>`;
  const cats = new Map();
  pins.forEach((pp, i) => { const g = G.pos[i], cx = x + 20 + cw * (g.c + 0.5), cy = top + ch * (g.r + 0.5), d = (p.hc.pins || {})[pp.no] || {}, cat = hcCat(hcPinCat(d)), used = hcPinUsed(d), wn = wired.get(pp.no);
    if(cat) cats.set(cat.id, cat);
    s += `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="${used ? (cat ? cat.col : '#7f8c8d') : '#fff'}" stroke="#111" stroke-width="${wn ? 1.6 : 0.8}"${wn ? '' : ' stroke-dasharray="2 2"'}/>`;
    s += hcT(cx, cy + Math.min(rr * 0.4, 5), pp.no, {fs:Math.max(7, Math.min(13, rr * 0.95)), b:true, a:'middle', c:used ? '#fff' : '#111'});
    if(ch > 34 && used) s += hcT(cx, cy + rr + 10, (d.sig || '').slice(0, Math.max(4, Math.floor(cw / 6))), {fs:Math.max(6.5, Math.min(9, cw / 9)), a:'middle', c:'#333'}); });
  if(pins.length){ const g0 = G.pos[0], cx = x + 20 + cw * (g0.c + 0.5), cy = top + ch * (g0.r + 0.5), dx = /Sağ/.test(start) ? 1 : -1, dy = /alt/.test(start) ? 1 : -1;
    s += `<path d="M${cx + dx * (rr + 14)},${cy + dy * (rr + 10)} L${cx + dx * (rr + 3)},${cy + dy * (rr + 1)}" stroke="#c0392b" stroke-width="1.6" marker-end="url(#hcArr)"/><defs><marker id="hcArr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#c0392b"/></marker></defs>`; }
  let lx = x + 20; const ly = y + h - legH + 14;
  [...cats.values()].forEach(ct => { s += `<circle cx="${lx + 6}" cy="${ly - 4}" r="6" fill="${ct.col}"/>` + hcT(lx + 16, ly, ct.name, {fs:10}); lx += 30 + ct.name.length * 6.5; });
  s += `<circle cx="${lx + 6}" cy="${ly - 4}" r="6" fill="#fff" stroke="#111" stroke-dasharray="2 2"/>` + hcT(lx + 16, ly, 'boş / kablajda bağlı değil', {fs:10});
  return s;
}
async function hcDrawingPdf(cables, separate){
  cables = cables.filter(Boolean); if(!cables.length) return toast('Kablaj seçilmedi');
  toast('Teknik resim hazırlanıyor… (' + cables.length + ' kablaj)');
  const make = async list => { const pages = []; for(const c of list){ for(const pg of hcDrawingPages(c)){ const im = await svgToFlate(pg, 2); pages.push(Object.assign(im, {pw:1190.55, ph:841.89, dw:1190.55, dh:841.89, dx:0, dy:0})); } } return buildPdf(pages); };
  if(separate){ for(const c of cables) download(await make([c]), fileSafe(hcDwg(c).no + ' - teknik resim') + '.pdf'); }
  else download(await make(cables), fileSafe(cables.length === 1 ? hcDwg(cables[0]).no + ' - teknik resim' : (E(M.rootId) ? E(M.rootId).name : 'Model') + ' - kablaj teknik resimleri') + '.pdf');
}
function hcDrawingDialog(pre){
  const cs = hcCables(); if(!cs.length) return toast('Kablaj yok');
  const box = $('#modalBox'); box.style.width = 'min(560px, 94vw)'; box.style.maxWidth = 'none';
  box.innerHTML = `<h2>Teknik resim oluştur</h2><p class="muted" style="font-size:12px;margin:-4px 0 8px">Her kablaj için A3 yatay: pin pin bağlantı şeması, hat listesi, sağ altta BOM ve antet; ayrı sayfada konnektör görünümleri.</p>
    <div style="max-height:46vh;overflow:auto;border:1px solid #dde;border-radius:4px;padding:6px">${cs.map(c => { const s = hcCableStats(c); return `<label style="display:block;font-size:13px;padding:2px 0"><input type="checkbox" data-hcd="${c.id}"${!pre || pre.includes(c.id) ? ' checked' : ''}> <b>${esc(c.name)}</b> <span class="muted">${c.nodes.filter(n => n.kind === 'conn').map(n => esc(hcNodeLabel(c, n))).join(' ↔ ')} · ${s.wires} hat${s.nE ? ' · ✖ ' + s.nE : ''}</span></label>`; }).join('')}</div>
    <p style="font-size:12px;margin:6px 0"><a href="#" id="hcDAll">Tümünü seç</a> · <a href="#" id="hcDNone">Hiçbirini seçme</a></p>
    <p style="text-align:right;margin:12px 0 0"><button class="pbtn" id="hcDC">Vazgeç</button> <button class="pbtn" id="hcDX" title="Seçili kablajların BOM ve hat listesi">Excel (BOM + hatlar)</button> <button class="pbtn" id="hcDS">Her kablaj ayrı PDF</button> <button class="pbtn pri" id="hcDO">Tek PDF</button></p>`;
  $('#modal').style.display = 'flex';
  const close = () => { $('#modal').style.display = 'none'; box.style.width = ''; box.style.maxWidth = ''; box.onclick = null; };
  const sel = () => [...box.querySelectorAll('[data-hcd]')].filter(i => i.checked).map(i => hcR().cables[i.dataset.hcd]);
  box.onclick = ev => { const id = ev.target.id;
    if(id === 'hcDAll' || id === 'hcDNone'){ ev.preventDefault(); box.querySelectorAll('[data-hcd]').forEach(i => i.checked = id === 'hcDAll'); }
    if(id === 'hcDC') close();
    if(id === 'hcDX'){ const s = sel(); close(); hcBomXlsx(s); }
    if(id === 'hcDO' || id === 'hcDS'){ const s = sel(); if(!s.length) return toast('Kablaj seçin'); close(); hcDrawingPdf(s, id === 'hcDS').catch(e => { appErr('teknik resim', e); toast('PDF oluşturulamadı: ' + e.message); }); } };
}
/* ---------- görünümlere bağlama: kablaj detayında antet + düğmeler, sistem şemasında Teknik resim ---------- */
{
  const rC = VIEWS['@hccable'].render, bC = VIEWS['@hccable'].bar, bS = VIEWS['@hcsys'].bar;
  VIEWS['@hccable'].bar = () => bC() + `<span class="vsep"></span><button class="vb" data-hc3="sug"${HCS.cab ? '' : ' disabled'}>AWG ve bükümlü çift öner…</button><button class="vb pri" data-hc3="pdf"${HCS.cab ? '' : ' disabled'}>Teknik resim oluştur</button><button class="vb" data-hc3="xl"${HCS.cab ? '' : ' disabled'}>BOM Excel</button>`;
  VIEWS['@hcsys'].bar = () => `<button class="vb pri" data-hc3="pdfall">Teknik resim oluştur…</button><span class="vsep"></span>` + bS();
  VIEWS['@hccable'].render = () => { const c = HCS.cab && hcR().cables[HCS.cab]; let h = rC(); if(!c) return h; const d = hcDwg(c);
    const f = (k, l) => `<label>${l}<input data-hc3d="${k}" value="${esc(d[k] || '')}"></label>`;
    const nets = hcNets(c), onW = c.wires.filter(w => w.on !== false), sgm = new Map(onW.map(w => [w.id, hcAwgSuggest(c, w, nets)]));
    const bad = onW.filter(w => !sgm.get(w.id).ok).length, diff = onW.filter(w => w.awg && sgm.get(w.id).ok && +w.awg > sgm.get(w.id).rec).length;
    const extra = `<div class="hcsec">Teknik resim anteti</div><div class="hcform" style="grid-template-columns:repeat(auto-fill,minmax(170px,1fr));margin-top:0">${f('title', 'Başlık')}${f('no', 'Çizim no')}${f('rev', 'Revizyon')}${f('by', 'Hazırlayan')}${f('chk', 'Kontrol')}${f('appr', 'Onay')}${f('date', 'Tarih')}</div>
      <div style="font-size:12px" class="muted">AWG önerisi: ${bad ? `<span style="color:#c0392b">${bad} hat için uygun AWG yok</span> · ` : ''}${diff ? `<span style="color:#b9770e">${diff} hat önerilenden ince</span> · ` : ''}<a href="#" data-hc3="sug">ayrıntılar…</a></div>`;
    return h.replace(/<\/div>$/, extra + '</div>'); };
}
(() => {
  const V = $('#view'), on = () => ST.cur === '@hccable' || ST.cur === '@hcsys';
  V.addEventListener('change', ev => { if(ST.cur !== '@hccable') return; const t = ev.target; if(!t.dataset.hc3d) return; const c = HCS.cab && hcM().cables[HCS.cab]; if(!c) return; snap(); c.dwg = Object.assign(hcDwg(c), c.dwg || {}, {[t.dataset.hc3d]:t.value.trim()}); afterChange(); });
  document.addEventListener('click', ev => { if(!on()) return; const b = ev.target.closest('[data-hc3]'); if(!b) return; ev.preventDefault(); const a = b.dataset.hc3, c = HCS.cab && hcR().cables[HCS.cab];
    if(a === 'pdfall') return hcDrawingDialog(HCS.sel ? [HCS.sel] : null);
    if(!c) return;
    if(a === 'sug') return hcSuggestDialog(c);
    if(a === 'pdf') return hcDrawingPdf([c]).catch(e => { appErr('teknik resim', e); toast('PDF oluşturulamadı: ' + e.message); });
    if(a === 'xl') return hcBomXlsx([c]); });
})();
{ const _m = hcLibMenu; hcLibMenu = () => _m().concat([{t:'Kablaj teknik resimleri (PDF)…', f:hcDrawingDialog}]); }
if(typeof MENU_ADV !== 'undefined') MENU_ADV.analysis = new RegExp(MENU_ADV.analysis.source + '|^Kablaj teknik resimleri');
if(typeof WF_STEPS !== 'undefined'){ const s = WF_STEPS.find(x => /kablajı tasarla/.test(x.t)); if(s) s.a.push(['Teknik resim (PDF)', /^Kablaj teknik resimleri/]); }
/* AWG önerisinden kalın gereken hat: model doğrulamada uyarı */
VALIDATORS.push(add => { if(!M.hrn) return; hcCables().forEach(c => { const nets = hcNets(c); c.wires.forEach((w, i) => { if(w.on === false) return; const s = hcAwgSuggest(c, w, nets); if(!s.ok) add('uyarı', 'Kablaj AWG', null, `${c.name} ${hcWireName(c, i)}: ${s.why[s.why.length - 1]}`); else if(w.awg && +w.awg > s.rec) add('uyarı', 'Kablaj AWG', null, `${c.name} ${hcWireName(c, i)}: ${w.awg} AWG önerilen ${s.rec} AWG'den ince (${s.I} A)`); }); }); });
