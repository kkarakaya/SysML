/* ================= v1.58: KABLAJ TEST TANIMI VE HAT KAPSAMASI =================
   Test = SysML TestCase (VCRM, rapor ve gereksinim doğrulamasıyla aynı eleman). tc.hcPins = ['portId|pin', …]: testte doğrulanan birim pinleri.
   Hat (v1.57 hcLines) bir testte doğrulanmış sayılır: kural "any" — uçlarından en az biri testte; "all" — tüm uçları testte (M.hrn.opt.covRule).
   Kapsama = doğrulanan hat / toplam hat; toplamda bir hat herhangi bir testte doğrulanmışsa kapsanmıştır. */
const HCT = {tab:'def', tc:'', q:'', flt:'all', onlyWired:true, unitOpen:{}};
const hcCovRule = () => (hcR().opt || {}).covRule || 'any';
const hcTests = () => Object.values(M.els).filter(e => e.kind === 'TestCase').sort((a, b) => (b.hcPins ? 1 : 0) - (a.hcPins ? 1 : 0) || sortEls(a, b));
const hcHarnessTests = () => hcTests().filter(t => (t.hcPins || []).length);
const hcLineIn = (l, set, rule) => (rule || hcCovRule()) === 'all' ? l.pins.every(p => set.has(p.key)) : l.pins.some(p => set.has(p.key));
function hcTestCov(tc, lines){ lines = lines || hcLines(); const set = new Set(tc.hcPins || []), cov = lines.filter(l => hcLineIn(l, set)); return {lines:cov, n:lines.length, k:cov.length, r:lines.length ? cov.length / lines.length : 0}; }
function hcCoverage(){
  const lines = hcLines(), tests = hcHarnessTests(), sets = tests.map(t => ({t, set:new Set(t.hcPins || [])})), rule = hcCovRule();
  const by = new Map(lines.map(l => [l.id, sets.filter(x => hcLineIn(l, x.set, rule)).map(x => x.t)]));
  const covered = lines.filter(l => by.get(l.id).length), cat = {};
  lines.forEach(l => { const c = cat[l.cat] = cat[l.cat] || {n:0, k:0}; c.n++; if(by.get(l.id).length) c.k++; });
  const per = tests.map(t => Object.assign({t}, hcTestCov(t, lines)));
  return {lines, tests, by, covered, open:lines.filter(l => !by.get(l.id).length), r:lines.length ? covered.length / lines.length : 0, cat, per};
}
/* şema katmanı: kablajdaki hatların kapsanma oranı */
function hcCableCov(c){ const C = HCT._cache && HCT._cache.rev === REV ? HCT._cache.v : (HCT._cache = {rev:REV, v:hcCoverage()}).v; const ls = C.lines.filter(l => l.cable === c), k = ls.filter(l => C.by.get(l.id).length).length; return {n:ls.length, k, r:ls.length ? k / ls.length : 0}; }
/* ---------- görünüm ---------- */
function hcTestBar(){
  const tab = (k, t) => `<button class="vb${HCT.tab === k ? ' pri' : ''}" data-hc5="tab" data-k="${k}">${t}</button>`;
  const ts = hcTests(); if(HCT.tc && !E(HCT.tc)) HCT.tc = '';
  return `${tab('def', 'Test tanımı')}${tab('cov', 'Kapsama')}<span class="vsep"></span>` + (HCT.tab === 'def'
    ? `<label>Test <select data-hc5f="tc" class="noi18n">${hcOpt('', '— seçin —', HCT.tc)}${ts.map(t => hcOpt(t.id, (t.reqId || t.tid ? (t.reqId || t.tid) + ' ' : '') + t.name + ((t.hcPins || []).length ? ' (' + t.hcPins.length + ' pin)' : ''), HCT.tc)).join('')}</select></label><button class="vb pri" data-hc5="new">+ Yeni test</button><button class="vb" data-hc5="dup"${HCT.tc ? '' : ' disabled'}>Çoğalt</button>
       <span class="vsep"></span><input data-hc5f="q" placeholder="Ara (birim, konnektör, pin, sinyal, etiket)" value="${esc(HCT.q)}" style="width:240px"><label class="vchk"><input type="checkbox" data-hc5f="onlyWired"${HCT.onlyWired ? ' checked' : ''}> Yalnız kablaja bağlı pinler</label>`
    : `<label>Göster <select data-hc5f="flt">${hcOpt('all', 'Tüm hatlar', HCT.flt)}${hcOpt('open', 'Açıkta kalan hatlar', HCT.flt)}${hcOpt('tested', 'Testlerde kullanılan hatlar', HCT.flt)}</select></label>
       <label>Hat doğrulanmış sayılır <select data-hc5f="rule">${hcOpt('any', 'uçlarından biri testteyse', hcCovRule())}${hcOpt('all', 'tüm uçları testteyse', hcCovRule())}</select></label><button class="vb" data-hc5="sys">Şemada göster</button><button class="vb" data-hc5="xl">Excel</button>`);
}
function hcTestHTML(){ return HCT.tab === 'cov' ? hcCovHTML() : hcDefHTML(); }
function hcDefHTML(){
  const tc = E(HCT.tc);
  if(!tc) return `<div style="padding:14px"><p class="muted" style="font-size:12px">Bir test seçin veya <b>+ Yeni test</b> ile oluşturun. Testler modelde Test Durumu (TestCase) elemanıdır: gereksinim doğrulaması, VCRM ve raporlarda da görünür. Her birimin test edilen pinlerini tek tek işaretleyin; kapsama sekmesi testin kablaj hatlarının yüzde kaçını doğruladığını gösterir.</p>
    <div class="hccards">${hcHarnessTests().map(t => { const c = hcTestCov(t); return `<div class="hccard" data-hc5tc="${t.id}"><b class="noi18n">${esc(t.name)}</b><div class="muted">${t.hcPins.length} pin · ${c.k} / ${c.n} hat · %${Math.round(c.r * 100)}</div></div>`; }).join('') || '<span class="muted">Henüz kablaj testi yok.</span>'}</div></div>`;
  const lines = hcLines(), cov = hcTestCov(tc, lines), set = new Set(tc.hcPins || []), lineOf = new Map(); lines.forEach(l => l.pins.forEach(p => lineOf.set(p.key, l)));
  const C = hcCoverage(), q = HCT.q.toLowerCase();
  let h = `<div style="padding:10px"><div class="hcform" style="grid-template-columns:2fr 3fr 1fr;margin-top:0"><label>Test adı<input data-hc5d="name" value="${esc(tc.name)}" class="noi18n"></label><label>Açıklama / prosedür özeti<input data-hc5d="doc" value="${esc(tc.doc || '')}"></label><label>Sonuç<input data-hc5d="result" value="${esc(tc.result || '')}" list="hcRes"></label></div><datalist id="hcRes">${['Planlandı', 'Geçti', 'Kaldı', 'Kısmen'].map(x => `<option value="${x}">`).join('')}</datalist>
    <div style="display:flex;gap:14px;align-items:center;font-size:13px;margin:4px 0 8px"><div style="flex:0 0 260px;height:14px;background:#eceff3;border-radius:7px;overflow:hidden"><div style="width:${Math.round(cov.r * 100)}%;height:100%;background:#27ae60"></div></div><b>%${Math.round(cov.r * 100)}</b><span>${cov.k} / ${cov.n} kablaj hattı bu testte doğrulanıyor · ${set.size} pin işaretli</span><span class="muted">tüm testlerle toplam %${Math.round(C.r * 100)}</span></div>`;
  hcUnits().forEach(u => {
    const ps = hcUnitConns(u.id); let rows = '', nU = 0, nS = 0;
    ps.forEach(p => { const pins = hcPins(p).filter(x => hcPinUsed(x.d) && (!HCT.onlyWired || lineOf.has(p.id + '|' + x.no)) && (!q || [u.name, p.name, x.no, x.d.sig, (hcLabel(x.d.lbl) || {}).name].join(' ').toLowerCase().includes(q)));
      if(!pins.length) return; const allOn = pins.every(x => set.has(p.id + '|' + x.no));
      rows += `<tr><td colspan="7" style="background:#f3f5f9"><label style="font-weight:600;display:inline-flex;flex-direction:row;align-items:center;gap:4px;margin:0"><input type="checkbox" data-hc5p="${p.id}|*"${allOn ? ' checked' : ''}> ${esc(p.name)}</label> <span class="muted" style="font-size:11px">${esc((hcType(p.hc.ct) || {}).name || '')}</span> ${hcChip(hcCat(p.hc.cat))}</td></tr>`;
      pins.forEach(x => { const k = p.id + '|' + x.no, l = lineOf.get(k), by = l ? (C.by.get(l.id) || []).filter(t => t.id !== tc.id) : []; nU++; if(set.has(k)) nS++;
        rows += `<tr><td style="width:24px"><input type="checkbox" data-hc5p="${esc(k)}"${set.has(k) ? ' checked' : ''}></td><td><b>${esc(x.no)}</b></td><td class="noi18n">${esc(x.d.sig || '')}</td><td>${esc((hcLabel(x.d.lbl) || {}).name || '')}</td><td>${hcChip(hcCat(hcPinCat(x.d)))}</td><td class="noi18n">${l ? esc(l.cable.name) + ' · ' + esc(l.pins.filter(y => y.key !== k).map(y => (E(y.port.owner) || {}).name + ' ' + y.port.name + '-' + y.no).join(', ')) : '<span class="muted">kablaja bağlı değil</span>'}</td><td class="muted" style="font-size:11px">${by.length ? 'diğer testler: ' + esc(by.map(t => t.name).join(', ')) : ''}</td></tr>`; });
    });
    if(!rows) return;
    const open = HCT.unitOpen[u.id] !== false;
    h += `<div style="border:1px solid #dde;border-radius:6px;margin:6px 0;background:#fff"><div style="padding:5px 8px;cursor:pointer;display:flex;gap:8px;align-items:center" data-hc5u="${u.id}"><b>${open ? '▾' : '▸'} <span class="noi18n">${esc(u.name)}</span></b><span class="muted" style="font-size:12px">${nS} / ${nU} pin testte</span><span style="flex:1"></span><button class="vb" data-hc5="uall" data-k="${u.id}">Tümünü seç</button><button class="vb" data-hc5="unone" data-k="${u.id}">Temizle</button></div>
      ${open ? `<table class="hcpt" style="width:100%"><thead><tr><th></th><th>Pin</th><th>Sinyal</th><th>Etiket</th><th>Hat tipi</th><th>Hat (kablaj · karşı uçlar)</th><th>Kapsama</th></tr></thead><tbody>${rows}</tbody></table>` : ''}</div>`;
  });
  return h + '</div>';
}
function hcCovHTML(){
  const C = hcCoverage(), pct = r => '%' + Math.round(r * 100), bar = (r, col) => `<div style="display:inline-block;vertical-align:middle;width:140px;height:10px;background:#eceff3;border-radius:5px;overflow:hidden;margin-right:6px"><div style="width:${Math.round(r * 100)}%;height:100%;background:${col || '#27ae60'}"></div></div>`;
  const tile = (v, l, col) => `<div style="border:1px solid #dde;border-radius:8px;padding:8px 14px;min-width:120px;background:#fff"><div style="font-size:22px;font-weight:700;color:${col || '#223'}">${v}</div><div class="muted" style="font-size:12px">${l}</div></div>`;
  const list = HCT.flt === 'open' ? C.open : HCT.flt === 'tested' ? C.covered : C.lines, T = C.tests.slice(0, 14);
  let h = `<div style="padding:12px"><div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">${tile(C.lines.length, 'kablaj hattı')}${tile(C.covered.length, 'testlerde doğrulanan', '#27ae60')}${tile(C.open.length, 'açıkta kalan', C.open.length ? '#c0392b' : '')}${tile(pct(C.r), 'toplam kapsama', C.r >= 1 ? '#27ae60' : '#b9770e')}${tile(C.tests.length, 'kablaj testi')}</div>
    <div style="display:flex;gap:24px;flex-wrap:wrap"><div><div class="hcsec">Testlere göre</div><table class="hcpt"><thead><tr><th>Test</th><th>Pin</th><th>Hat</th><th>Kapsama</th><th>Sonuç</th></tr></thead><tbody>${C.per.map(x => `<tr><td><a href="#" data-hc5="open" data-k="${x.t.id}" class="noi18n">${esc(x.t.name)}</a></td><td>${x.t.hcPins.length}</td><td>${x.k} / ${x.n}</td><td>${bar(x.r)}${pct(x.r)}</td><td>${esc(x.t.result || '')}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Kablaj testi yok</td></tr>'}</tbody></table></div>
    <div><div class="hcsec">Hat tiplerine göre</div><table class="hcpt"><thead><tr><th>Hat tipi</th><th>Hat</th><th>Doğrulanan</th><th>Kapsama</th></tr></thead><tbody>${Object.entries(C.cat).map(([k, v]) => `<tr><td>${hcChip(hcCat(k)) || 'Tipsiz'}</td><td>${v.n}</td><td>${v.k}</td><td>${bar(v.n ? v.k / v.n : 0)}${pct(v.n ? v.k / v.n : 0)}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="hcsec">${HCT.flt === 'open' ? 'Açıkta kalan hatlar' : HCT.flt === 'tested' ? 'Testlerde kullanılan hatlar' : 'Tüm hatlar'} (${list.length})</div>
    <div style="max-height:52vh;overflow:auto"><table class="hcpt"><thead><tr><th>Kablaj</th><th>Hat</th><th>Hat tipi</th><th>Uçlar</th>${T.map(t => `<th title="${esc(t.name)}" class="noi18n" style="max-width:80px;overflow:hidden;text-overflow:ellipsis">${esc(t.name.slice(0, 12))}</th>`).join('')}<th>Durum</th></tr></thead><tbody>
    ${list.map(l => { const by = C.by.get(l.id); return `<tr><td class="noi18n"><a href="#" data-hc5="cable" data-k="${l.cable.id}">${esc(l.cable.name)}</a></td><td class="noi18n">${esc(l.name)}</td><td>${hcChip(hcCat(l.cat))}</td><td class="noi18n" style="font-size:11px">${esc(l.pins.map(x => (E(x.port.owner) || {}).name + ' ' + x.port.name + '-' + x.no).join(' — '))}</td>${T.map(t => `<td style="text-align:center;color:#27ae60">${by.includes(t) ? '✓' : ''}</td>`).join('')}<td>${by.length ? '<span style="color:#27ae60">doğrulandı</span>' : '<span style="color:#c0392b">açıkta</span>'}</td></tr>`; }).join('') || '<tr><td colspan="5" class="muted">—</td></tr>'}</tbody></table></div>
    ${C.tests.length > T.length ? `<p class="muted" style="font-size:11px">İlk ${T.length} test sütun olarak gösteriliyor; tümü Excel'de.</p>` : ''}</div>`;
  return h;
}
function hcCovXlsx(){
  const C = hcCoverage(), hd = a => a.map(v => ({v, s:1}));
  download(buildXlsx([
    {name:'Testler', rows:[hd(['Test', 'Pin', 'Doğrulanan hat', 'Toplam hat', 'Kapsama %', 'Sonuç'])].concat(C.per.map(x => [x.t.name, x.t.hcPins.length, x.k, x.n, Math.round(x.r * 1000) / 10, x.t.result || ''])).concat([[''], ['Toplam (tüm testler)', '', C.covered.length, C.lines.length, Math.round(C.r * 1000) / 10]]), widths:[30, 8, 14, 11, 11, 12], header:true},
    {name:'Hat kapsaması', rows:[hd(['Kablaj', 'Hat', 'Hat tipi', 'Uçlar'].concat(C.tests.map(t => t.name)).concat(['Durum']))].concat(C.lines.map(l => { const by = C.by.get(l.id); return [l.cable.name, l.name, (hcCat(l.cat) || {}).name || '', l.pins.map(x => (E(x.port.owner) || {}).name + ' ' + x.port.name + '-' + x.no).join(' — ')].concat(C.tests.map(t => by.includes(t) ? '✓' : '')).concat([by.length ? 'doğrulandı' : 'açıkta']); })), widths:[10, 22, 12, 60].concat(C.tests.map(() => 12)).concat([12]), header:true, freeze:[1, 4]},
    {name:'Test pinleri', rows:[hd(['Test', 'Birim', 'Konnektör', 'Pin', 'Sinyal'])].concat(C.tests.flatMap(t => (t.hcPins || []).map(k => { const [pid, no] = k.split('|'), p = E(pid), d = p && p.hc && (p.hc.pins || {})[no] || {}; return [t.name, p ? (E(p.owner) || {}).name : '(silinmiş)', p ? p.name : '', no, d.sig || '']; }))), widths:[30, 22, 10, 6, 20], header:true}
  ]), fileSafe((E(M.rootId) ? E(M.rootId).name + ' - ' : '') + 'kablaj test kapsaması') + '.xlsx');
}
VIEWS['@hctest'] = {tr:'Kablaj Test Kapsaması', ic:'TST', note:'<b>Test tanımı:</b> bir test seçin veya oluşturun, her birimin testte doğrulanan pinlerini tek tek işaretleyin (konnektör başlığı ve "Tümünü seç" toplu seçim). Testler modelde Test Durumu elemanıdır.<br><br><b>Kapsama:</b> her testin ve tüm testlerin kablaj hatlarının yüzde kaçını doğruladığı, açıkta kalan ve testlerde kullanılan hatlar, hat × test matrisi. <b>Şemada göster</b> kablajları kapsama oranına göre renklendirir (yeşil tam, turuncu kısmi, kırmızı yok).', render:hcTestHTML, bar:hcTestBar, status:() => { const C = hcCoverage(); return C.tests.length + ' test · ' + C.covered.length + ' / ' + C.lines.length + ' hat · %' + Math.round(C.r * 100); }};
/* sistem şemasında kapsama katmanı düğmesi */
{ const bS = VIEWS['@hcsys'].bar; VIEWS['@hcsys'].bar = () => bS() + `<button class="vb${HCS.cov ? ' pri' : ''}" data-hc5="covlayer" title="Kablajları test kapsamasına göre renklendir">Test kapsaması</button>`; }
/* TestCase özellik panelinde kablaj kapsamı */
HOOKS.props.push((t, panel) => { const e = t && t.el; if(!panel || !e || e.kind !== 'TestCase' || !M.hrn) return; const c = hcTestCov(e); panel.insertAdjacentHTML('beforeend', `<div class="pf"><label>Kablaj kapsamı</label><div>${(e.hcPins || []).length} pin · ${c.k} / ${c.n} hat · %${Math.round(c.r * 100)}<br><button class="pbtn" data-hc5go="${e.id}">Test pinlerini düzenle</button></div></div>`); });
document.addEventListener('click', ev => { const b = ev.target.closest && ev.target.closest('[data-hc5go]'); if(!b) return; HCT.tc = b.dataset.hc5go; HCT.tab = 'def'; openD('@hctest'); });
/* pin silinince test pin listeleri temizlenir */
{ const _dm = delModel; delModel = function(ids){ const r = _dm.apply(this, arguments); Object.values(M.els).forEach(t => { if(t.kind === 'TestCase' && t.hcPins) t.hcPins = t.hcPins.filter(k => E(k.split('|')[0])); }); return r; }; }
(() => {
  const V = $('#view'), on = () => ST.cur === '@hctest';
  const save = f => { snap(); f(); afterChange(); renderViewBar(); renderView(); };
  V.addEventListener('keydown', ev => { if(on() && ev.target.matches && ev.target.matches('input,select')){ ev.stopPropagation(); if(ev.key === 'Enter') ev.target.blur(); } });
  V.addEventListener('input', ev => { if(on() && ev.target.dataset.hc5f === 'q'){ HCT.q = ev.target.value; renderView(); } });
  V.addEventListener('change', ev => {
    if(!on()) return; const t = ev.target, f = t.dataset.hc5f;
    if(f === 'tc'){ HCT.tc = t.value; renderViewBar(); renderView(); return; }
    if(f === 'flt'){ HCT.flt = t.value; renderView(); return; }
    if(f === 'onlyWired'){ HCT.onlyWired = t.checked; renderView(); return; }
    if(f === 'rule') return save(() => { const H = hcM(); H.opt = Object.assign({}, H.opt || {}, {covRule:t.value}); });
    const tc = E(HCT.tc); if(!tc) return;
    if(t.dataset.hc5d){ const k = t.dataset.hc5d, v = t.value.trim(); return save(() => { if(k === 'name'){ if(v) tc.name = v; } else tc[k] = v; }); }
    if(t.dataset.hc5p){ const [pid, no] = t.dataset.hc5p.split('|'); return save(() => { const S = new Set(tc.hcPins || []);
      if(no === '*'){ const p = E(pid), lineOf = new Set(hcLines().flatMap(l => l.pins.map(x => x.key))); hcPins(p).filter(x => hcPinUsed(x.d) && (!HCT.onlyWired || lineOf.has(pid + '|' + x.no))).forEach(x => t.checked ? S.add(pid + '|' + x.no) : S.delete(pid + '|' + x.no)); }
      else if(t.checked) S.add(pid + '|' + no); else S.delete(pid + '|' + no);
      tc.hcPins = [...S]; }); }
  });
  document.addEventListener('click', ev => {
    if(!on() && ST.cur !== '@hcsys') return;
    const tcEl = ev.target.closest('[data-hc5tc]'); if(tcEl && on()){ HCT.tc = tcEl.dataset.hc5tc; renderViewBar(); renderView(); return; }
    const uh = ev.target.closest('[data-hc5u]'); if(uh && !ev.target.closest('button') && on()){ HCT.unitOpen[uh.dataset.hc5u] = HCT.unitOpen[uh.dataset.hc5u] === false; renderView(); return; }
    const b = ev.target.closest('[data-hc5]'); if(!b) return; ev.preventDefault(); const a = b.dataset.hc5, k = b.dataset.k, tc = E(HCT.tc);
    if(a === 'covlayer'){ HCS.cov = !HCS.cov; renderViewBar(); renderView(); return; }
    if(a === 'tab'){ HCT.tab = k; renderViewBar(); renderView(); return; }
    if(a === 'new') return quickForm('Yeni kablaj testi', [{k:'name', l:'Test adı', v:'Kablaj süreklilik testi ' + (hcHarnessTests().length + 1)}], r => { if(!r.name) return 'Ad gerekli'; save(() => { const t = newTest({name:r.name, hcPins:[]}); HCT.tc = t.id; HCT.tab = 'def'; }); renderTree(); });
    if(a === 'dup' && tc) return save(() => { const t = newTest({name:tc.name + ' (kopya)', hcPins:(tc.hcPins || []).slice(), doc:tc.doc || ''}); HCT.tc = t.id; });
    if(a === 'uall' || a === 'unone'){ if(!tc) return; return save(() => { const S = new Set(tc.hcPins || []), lineOf = new Set(hcLines().flatMap(l => l.pins.map(x => x.key)));
      hcUnitConns(k).forEach(p => hcPins(p).forEach(x => { const key = p.id + '|' + x.no; if(!hcPinUsed(x.d) || (HCT.onlyWired && !lineOf.has(key))) return; if(a === 'uall') S.add(key); else S.delete(key); })); tc.hcPins = [...S]; }); }
    if(a === 'open'){ HCT.tc = k; HCT.tab = 'def'; renderViewBar(); renderView(); return; }
    if(a === 'cable') return hcOpenCable(k);
    if(a === 'sys'){ HCS.cov = true; HCS.catF = ''; openD('@hcsys'); return; }
    if(a === 'xl') return hcCovXlsx();
  });
})();
{ const _m = hcLibMenu; hcLibMenu = () => { const r = _m(); r.push({t:'Kablaj test tanımı ve kapsama', f:() => openD('@hctest')}); return r; }; }
if(typeof MENU_ADV !== 'undefined') MENU_ADV.analysis = new RegExp(MENU_ADV.analysis.source + '|^Kablaj test tanımı');
if(typeof MENU_GROUPS !== 'undefined'){ const g = MENU_GROUPS.analysis.cls.find(x => x[0] === 'Kablaj ve konnektörler'); if(g) g[1] = new RegExp(g[1].source + '|Kablaj test'); }
if(typeof WF_STEPS !== 'undefined'){ const s = WF_STEPS.find(x => /^Doğrula$/.test(x.t)); if(s) s.a.push(['Kablaj test kapsaması', /^Kablaj test tanımı/]); }
