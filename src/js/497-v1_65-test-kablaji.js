/* ================= v1.65 — TEST KABLAJLARI =================
   Test kablajı (M.hrn.cables[id].test = true): projeye ait, birim konnektörlerine takılan ve banana jack gibi bağımsız uçlar içeren kablaj.
   - Genel mimaride görünmez: sistem kablaj şeması, özet, hat tipine göre mimariler, hat tablosu, test kapsaması ve arama yalnız hcCables() (işletim) kullanır.
   - İşletim kablajının takılı olduğu konnektöre de takılabilir (çakışma denetimi test kablajları için yapılmaz); pin uyumluluğu, AWG ve diğer denetimler aynen çalışır.
   - "Test kablajları" görünümü: tüm test kablajlarının listesi (birime / metne göre süzme), yeni test kablajı, teknik resim (tek PDF / her biri ayrı PDF), BOM ve liste Excel. */
const HCTK = {unit:'', q:'', sel:null};
function hcTkFilter(o){
  o = o || HCTK; const q = String(o.q || '').toLocaleLowerCase('tr');
  return hcTestCables().filter(c => (!o.unit || c.nodes.some(n => n.kind === 'conn' && E(n.port) && E(n.port).owner === o.unit))
    && (!q || [c.name, c.note || '', hcDwg(c).no, hcDwg(c).title].concat(c.nodes.map(n => hcNodeLabel(c, n))).join(' | ').toLocaleLowerCase('tr').includes(q)));
}
/* liste satırı: birim konnektörleri, bağımsız uçlar, sayımlar */
function hcTkRow(c){
  const st = hcCableStats(c), conns = c.nodes.filter(n => n.kind === 'conn'), frees = c.nodes.filter(n => n.kind === 'free'), d = hcDwg(c);
  return {c, st, conns:conns.map(n => hcNodeLabel(c, n)), frees:frees.map(n => hcNodeLabel(c, n)), units:[...new Set(conns.map(n => { const p = E(n.port), u = p && E(p.owner); return u ? u.name : '?'; }))], sp:c.nodes.filter(n => n.kind === 'splice').length, no:d.no, rev:d.rev};
}
/* yeni test kablajı: seçilen konnektörler (isteğe bağlı birbirine etiketlerle eşlenir) + n bağımsız uç */
function hcNewTestCable(o){
  o = o || {}; const c = hcNewCable(o.ports || [], o.name || '', {test:true, auto:false});
  if(o.note) c.note = o.note;
  if(o.auto !== false) c.nodes.filter(n => n.kind === 'conn').forEach(n => hcAutoMap(c, n.id));
  for(let i = 0; i < (parseInt(o.jacks, 10) || 0); i++) hcAddFree(c, {ft:o.ft || HC_FREE_TYPES[0], col:HC_FREE_COLS[i % 2]});
  return c;
}
function hcTkNewDialog(){
  const units = hcUnits().filter(u => hcUnitConns(u.id).length); if(!units.length) return toast('Önce birim ve konnektör tanımlayın (Birim arayüzleri ve pinout)');
  const box = $('#modalBox'); box.style.width = 'min(620px, 94vw)'; box.style.maxWidth = 'none';
  box.innerHTML = `<h2>Yeni test kablajı</h2><p class="muted" style="font-size:12px;margin:-4px 0 8px">Test kablajı projede saklanır, doğrulanır ve teknik resmi alınır; <b>genel mimaride (sistem kablaj şeması, özet, mimariler) görünmez</b>. Konnektöre işletim kablajı takılı olsa da seçilebilir.</p>
    <div class="qf"><label>Ad<input id="hcTkN" value="${esc(hcNextCableName('TW'))}" class="noi18n"></label><label>Not / amaç<input id="hcTkNote" placeholder="ör. Birim 1 – Birim 2 güç ve haberleşme testi"></label></div>
    <div style="font-size:12px;font-weight:600;margin:8px 0 4px">Birim konnektörleri</div>
    <div style="max-height:36vh;overflow:auto;border:1px solid #dde;border-radius:4px;padding:6px">${units.map(u => `<div style="font-size:12px;font-weight:600;margin-top:4px">${esc(u.name)}</div>${hcUnitConns(u.id).map(p => { const t = hcType(p.hc.ct), cb = hcCableOfPort(p.id); return `<label style="display:block;font-size:12.5px;padding:1px 0 1px 12px"><input type="checkbox" data-hctk="${p.id}"> <b>${esc(p.name)}</b> <span class="muted">${esc(t ? t.pn || t.name : 'tip yok')}${cb ? ' · işletimde ' + esc(cb.name) : ''}</span></label>`; }).join('')}`).join('')}</div>
    <p style="font-size:12px;margin:8px 0;display:flex;gap:14px;flex-wrap:wrap;align-items:center"><label><input type="checkbox" id="hcTkA" checked> Seçilen konnektörleri etiketlere göre birbirine bağla</label>
      <label>Bağımsız uç <input id="hcTkJ" value="2" style="width:36px"> adet <select id="hcTkF">${HC_FREE_TYPES.map(x => hcOpt(x, x, HC_FREE_TYPES[0])).join('')}</select></label></p>
    <p style="text-align:right;margin:12px 0 0"><button class="pbtn" id="hcTkC">Vazgeç</button> <button class="pbtn pri" id="hcTkO">Oluştur ve aç</button></p>`;
  $('#modal').style.display = 'flex';
  const close = () => { $('#modal').style.display = 'none'; box.style.width = ''; box.style.maxWidth = ''; box.onclick = null; };
  box.onclick = ev => { const id = ev.target.id;
    if(id === 'hcTkC') close();
    if(id === 'hcTkO'){ const name = $('#hcTkN').value.trim(); if(name && hcAllCables().some(x => x.name === name)) return toast('Bu kablaj adı kullanılıyor');
      const ports = [...box.querySelectorAll('[data-hctk]')].filter(i => i.checked).map(i => i.dataset.hctk);
      snap(); const c = hcNewTestCable({name, note:$('#hcTkNote').value.trim(), ports, auto:$('#hcTkA').checked, jacks:$('#hcTkJ').value, ft:$('#hcTkF').value}); close(); afterChange();
      toast(`${c.name} oluşturuldu: ${c.nodes.filter(n => n.kind === 'conn').length} konnektör, ${c.nodes.filter(n => n.kind === 'free').length} bağımsız uç, ${c.wires.length} hat`); hcOpenCable(c.id); } };
}
function hcTkXlsx(cs){
  const rows = cs.map(hcTkRow); if(!rows.length) return toast('Test kablajı yok');
  const hd = a => a.map(v => ({v, s:1})), S = [{name:'Test kablajları', rows:[hd(['Kablaj', 'Çizim no', 'Rev.', 'Birimler', 'Birim konnektörleri', 'Bağımsız uçlar', 'Hat', 'Splice', 'Uzunluk (m)', 'Hata', 'Uyarı', 'Not'])]
    .concat(rows.map(r => [r.c.name, r.no, r.rev, r.units.join(', '), r.conns.join(' · '), r.frees.join(' · '), r.st.wires, r.sp, r.c.len || '', r.st.nE, r.st.nW, r.c.note || ''])), widths:[10, 12, 6, 24, 40, 36, 6, 7, 11, 6, 6, 30], header:true, freeze:[1, 0]}];
  rows.forEach(r => S.push({name:(r.c.name + ' hatlar').slice(0, 31), rows:[hd(['Hat', 'Uç A', 'Uç B', 'Sinyal', 'AWG', 'Renk', 'Bükümlü grup'])].concat(hcWireList(r.c).map(x => [x.name, hcEndLong(r.c, x.w.a), hcEndLong(r.c, x.w.b), x.sig, x.w.awg || '', x.w.color || '', x.w.grp || ''])), widths:[10, 26, 26, 20, 7, 10, 12], header:true, freeze:[1, 0]}));
  download(buildXlsx(S), fileSafe((E(M.rootId) ? E(M.rootId).name + ' - ' : '') + 'test kablajları') + '.xlsx');
}
const hcTkSel = () => { const all = hcTkFilter(); if(!HCTK.sel) return all; return all.filter(c => HCTK.sel.has(c.id)); };
function hcTkHTML(){
  const all = hcTestCables(), rows = hcTkFilter().map(hcTkRow), sel = HCTK.sel;
  if(!all.length) return `<div style="padding:14px;max-width:760px"><p><b>Henüz test kablajı yok.</b></p><p class="muted" style="font-size:13px">Test kablajı birim konnektörlerine takılan, banana jack gibi bağımsız uçlar içerebilen ve projede saklanan kablajdır. Genel mimaride (sistem kablaj şeması, özet, mimariler, hat tablosu, test kapsaması) görünmez; burada listelenir ve teknik resmi alınır.</p>
    <p><button class="vb pri" data-hctka="new">+ Yeni test kablajı</button></p></div>`;
  const tot = rows.reduce((a, r) => (a.w += r.st.wires, a.e += r.st.nE, a.u += r.st.nW, a), {w:0, e:0, u:0});
  return `<div style="padding:10px"><div class="muted" style="font-size:12px;margin-bottom:6px">${rows.length}${rows.length !== all.length ? ' / ' + all.length : ''} test kablajı · ${tot.w} hat${tot.e ? ` · <span style="color:#c0392b">✖ ${tot.e} hata</span>` : ''}${tot.u ? ` · <span style="color:#b9770e">⚠ ${tot.u} uyarı</span>` : ''} — genel mimaride gösterilmez</div>
    <div style="max-height:calc(100vh - 210px);overflow:auto"><table class="hcpt" style="width:100%"><thead><tr><th><input type="checkbox" data-hctkc="all"${!sel || rows.every(r => sel.has(r.c.id)) ? ' checked' : ''} style="width:auto" title="Tümünü seç"></th><th>Kablaj</th><th>Çizim no</th><th>Birim konnektörleri</th><th>Bağımsız uçlar</th><th>Hat</th><th>Splice</th><th>Uzunluk</th><th>Denetim</th><th>Not</th><th></th></tr></thead><tbody>
    ${rows.map(r => `<tr><td><input type="checkbox" data-hctkc="${r.c.id}"${!sel || sel.has(r.c.id) ? ' checked' : ''} style="width:auto"></td><td><a href="#" data-hctka="open" data-k="${r.c.id}"><b class="noi18n">${esc(r.c.name)}</b></a></td><td class="noi18n">${esc(r.no)}${r.rev ? ' rev ' + esc(r.rev) : ''}</td>
      <td class="noi18n">${r.conns.map(esc).join('<br>') || '<span class="muted">—</span>'}</td><td class="noi18n">${r.frees.map(esc).join('<br>') || '<span class="muted">—</span>'}</td><td>${r.st.wires}</td><td>${r.sp || ''}</td><td>${r.c.len ? esc(r.c.len) + ' m' : ''}</td>
      <td>${r.st.nE ? `<span style="color:#c0392b">✖ ${r.st.nE}</span> ` : ''}${r.st.nW ? `<span style="color:#b9770e">⚠ ${r.st.nW}</span>` : ''}${!r.st.nE && !r.st.nW ? '<span style="color:#27ae60">✓</span>' : ''}</td><td>${esc(r.c.note || '')}</td>
      <td style="white-space:nowrap"><button class="vb" data-hctka="open" data-k="${r.c.id}">Aç</button><button class="vb" data-hctka="pdf1" data-k="${r.c.id}" title="Bu kablajın teknik resmi (A3 PDF)">PDF</button></td></tr>`).join('') || '<tr><td colspan="11" class="muted">Süzgece uyan test kablajı yok</td></tr>'}
    </tbody></table></div></div>`;
}
function hcTkBar(){
  const units = [...new Set(hcTestCables().flatMap(c => c.nodes.filter(n => n.kind === 'conn' && E(n.port)).map(n => E(n.port).owner)))].map(E).filter(Boolean).sort(sortEls), n = hcTkSel().length;
  return `<button class="vb pri" data-hctka="new">+ Yeni test kablajı</button><span class="vsep"></span><label>Birim <select data-hctkf="unit" class="noi18n">${hcOpt('', 'Tümü', HCTK.unit)}${units.map(u => hcOpt(u.id, u.name, HCTK.unit)).join('')}</select></label>
    <input data-hctkf="q" value="${esc(HCTK.q)}" placeholder="Ara (ad, uç, not)" style="width:150px"><span class="vsep"></span>
    <button class="vb" data-hctka="pdf"${n ? '' : ' disabled'} title="Seçili test kablajlarının teknik resimleri tek PDF'te">Teknik resim — tek PDF (${n})</button><button class="vb" data-hctka="pdfs"${n ? '' : ' disabled'}>Her biri ayrı PDF</button>
    <button class="vb" data-hctka="bom"${n ? '' : ' disabled'}>BOM Excel</button><button class="vb" data-hctka="xl"${n ? '' : ' disabled'} title="Test kablajı listesi ve hat listeleri">Liste Excel</button><span class="vsep"></span><button class="vb" data-hctka="sys">Sistem şeması</button>`;
}
VIEWS['@hctk'] = {tr:'Test Kablajları', ic:'TW', note:'Projeye ait <b>test kablajları</b>: birim konnektörlerine takılır, banana jack gibi <b>bağımsız uçlar</b> içerebilir. Genel mimaride (sistem kablaj şeması, özet, mimariler, hat tablosu, test kapsaması) görünmez.<br><br><b>+ Yeni test kablajı</b> ile konnektörleri ve bağımsız uç sayısını seçin; kablaj detayında hatları düzenleyin. Bir işletim kablajını test kablajına çevirmek için kablaj detayında <b>Test kablajı</b> kutusunu işaretleyin.<br><br>Seçili test kablajlarının teknik resimleri tek PDF ya da her biri ayrı PDF olarak alınır.',
  render:hcTkHTML, bar:hcTkBar, status:() => hcTestCables().length + ' test kablajı'};
(() => {
  const V = $('#view'), on = () => ST.cur === '@hctk', pdf = (cs, sep) => hcDrawingPdf(cs, sep).catch(e => { appErr('teknik resim', e); toast('PDF oluşturulamadı: ' + e.message); });
  V.addEventListener('change', ev => { if(!on()) return; const t = ev.target;
    if(t.dataset.hctkf){ HCTK[t.dataset.hctkf] = t.value.trim(); renderViewBar(); renderView(); return; }
    if(t.dataset.hctkc){ const ids = hcTkFilter().map(c => c.id); if(!HCTK.sel) HCTK.sel = new Set(ids);
      if(t.dataset.hctkc === 'all') HCTK.sel = t.checked ? null : new Set(); else if(t.checked) HCTK.sel.add(t.dataset.hctkc); else HCTK.sel.delete(t.dataset.hctkc);
      if(HCTK.sel && ids.every(id => HCTK.sel.has(id))) HCTK.sel = null; renderViewBar(); renderView(); } });
  V.addEventListener('keydown', ev => { if(on() && ev.target.matches && ev.target.matches('input')){ ev.stopPropagation(); if(ev.key === 'Enter') ev.target.blur(); } });
  document.addEventListener('click', ev => { if(!on()) return; const b = ev.target.closest('[data-hctka]'); if(!b) return; ev.preventDefault(); const a = b.dataset.hctka, k = b.dataset.k;
    if(a === 'new') return hcTkNewDialog();
    if(a === 'open') return hcOpenCable(k);
    if(a === 'pdf1') return pdf([hcR().cables[k]], false);
    if(a === 'pdf' || a === 'pdfs') return pdf(hcTkSel(), a === 'pdfs');
    if(a === 'bom') return hcBomXlsx(hcTkSel());
    if(a === 'xl') return hcTkXlsx(hcTkSel());
    if(a === 'sys') return openD('@hcsys'); });
})();
/* kablaj detayında test kablajı ise sistem şeması sekmesindeki seçim temizlenir; menü, iş akışı */
{ const _m = hcLibMenu; hcLibMenu = () => { const r = _m(), i = r.findIndex(x => x && x.t && /^Kablaj şeması/.test(x.t)); r.splice(i < 0 ? r.length : i + 1, 0, {t:'Test kablajları', f:() => openD('@hctk')}); return r; }; }
if(typeof MENU_ADV !== 'undefined') MENU_ADV.analysis = new RegExp(MENU_ADV.analysis.source + '|^Test kablajları');
if(typeof WF_STEPS !== 'undefined'){ const s = WF_STEPS.find(x => /kablajı tasarla/.test(x.t)); if(s) s.a.push(['Test kablajları', /^Test kablajları/]); }
if(typeof MENU_GROUPS !== 'undefined'){ const g = MENU_GROUPS.analysis.cls.find(x => x[0] === 'Kablaj ve konnektörler'); if(g) g[1] = new RegExp(g[1].source + '|^Test kablajları'); }
