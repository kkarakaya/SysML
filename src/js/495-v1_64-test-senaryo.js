/* v1.64 — Konnektör üzerinden birime test kapsamı, test adımları, doğrulama kaydı
   TestCase: tc.hcScope = {port, unit, cats:[]}  ("Görev Bilgisayarı J2 üzerinden Sensör birimine haberleşme ve güç testi")
             tc.hcSteps = [{id, txt, cats:[], grp:'portId|gid', done, at}]
             tc.hcRuns  = [{id, at, result, pins:[portId|no], n, routes:[…], steps:[…], note}]
   Kapsam uçtan uca hatlardır (hcChains: içten geçişli birimler üzerinden birden çok kablaj). Kapsamdaki pinler tc.hcPins'e yazılır,
   böylece mevcut kapsama hesabı da çalışır. Tik atılan adımların hatları "doğrulandı"; "Test başarılı" bunları tarihli kayda geçirir. */
const HCT2 = {show:'', mode:'scope', open:{}};
/* v1.66: birimden birime kapsam — tc.hcScope = {from:birimA, unit:birimB, cats} (konnektör yok); hatlar birim içi geçişlerle (hcChains) uçtan uca izlenir */
const hcScopeOf = tc => tc && tc.hcScope && (tc.hcScope.port || tc.hcScope.from) ? tc.hcScope : null;
function hcScopeChains(sc){
  if(!sc || !(E(sc.port) || E(sc.from))) return {all:[], toUnit:[], sel:[]};
  const all = hcChains().filter(ch => sc.port ? ch.pins.some(p => p.port.id === sc.port) : ch.ends.some(p => p.port.owner === sc.from));
  const toUnit = sc.unit ? all.filter(ch => (sc.port ? ch.pins : ch.ends).some(p => p.port.owner === sc.unit && p.port.id !== sc.port)) : all;
  const cs = new Set(sc.cats || []), sel = toUnit.filter(ch => !cs.size || ch.cats.some(c => cs.has(c)) || (cs.has('') && !ch.cats.length));
  return {all, toUnit, sel};
}
const hcChainSegs = chs => chs.reduce((s, ch) => s + ch.lines.length, 0);
const hcChainPins = chs => [...new Set(chs.flatMap(ch => ch.pins.map(p => p.key)))];
function hcStepChains(tc, st, sel){
  sel = sel || hcScopeChains(hcScopeOf(tc)).sel; let r = sel;
  if(st.only) r = r.filter(ch => st.only.includes(ch.id));
  if(st.cats && st.cats.length){ const cs = new Set(st.cats); r = r.filter(ch => ch.cats.some(c => cs.has(c))); }
  if(st.grp){ const [pid, gid] = st.grp.split('|'), p = E(pid), g = p && typeof hgGet === 'function' ? hgGet(p, gid) : null, keys = new Set(g ? g.mem.filter(m => m.no).map(m => pid + '|' + m.no) : []); r = r.filter(ch => ch.pins.some(x => keys.has(x.key))); }
  return r;
}
function hcTestState(tc){
  const sc = hcScopeOf(tc), S = hcScopeChains(sc), steps = tc.hcSteps || [], ver = new Set();
  steps.filter(s => s.done).forEach(s => hcStepChains(tc, s, S.sel).forEach(ch => ver.add(ch.id)));
  const verified = S.sel.filter(ch => ver.has(ch.id)), tot = hcChains().length;
  return {sc, S, steps, verified, ver, tot, open:S.sel.filter(ch => !ver.has(ch.id)), done:steps.filter(s => s.done).length};
}
/* adımları kapsamdan üret: konnektördeki pin grupları, kalan hatlar için hat tipleri */
function hcGenSteps(tc){
  const sc = hcScopeOf(tc), S = hcScopeChains(sc), p = E(sc.port) || {name:(E(sc.from) || {}).name || '?'}, out = [], used = new Set(), tu = E(sc.unit);
  (typeof hgOf === 'function' && sc.port ? hgOf(p) : []).forEach(g => { const st = {id:'s' + uid(), txt:'', cats:[], grp:p.id + '|' + g.id, done:false}, chs = hcStepChains(tc, st, S.sel); if(!chs.length) return;
    chs.forEach(ch => used.add(ch.id)); st.txt = `${p.name} · ${g.name} (${g.kind}) ${tu ? tu.name + ' ile ' : ''}doğrulandı`; out.push(st); });
  const rest = S.sel.filter(ch => !used.has(ch.id)), cats = [...new Set(rest.map(ch => ch.cat))];
  cats.forEach(c => { const cat = hcCat(c); out.push({id:'s' + uid(), txt:`${cat ? cat.name : 'Tipsiz'} hatları ${p.name} → ${tu ? tu.name : 'karşı uç'} doğrulandı`, cats:c ? [c] : [], grp:'', done:false, only:rest.filter(ch => ch.cat === c).map(ch => ch.id)}); });
  return out;
}
/* serbest metinden kapsam: "Görev Bilgisayarı J2 üzerinden Sensör birimine haberleşme ve güç testi" */
function hcParseScope(txt){
  const low = s => String(s || '').toLocaleLowerCase('tr'), t = ' ' + low(txt).replace(/[.,;:]/g, ' ') + ' ';
  const us = hcUnits().filter(u => t.includes(low(u.name))).sort((a, b) => b.name.length - a.name.length);
  const cats = hcR().cats.filter(c => t.includes(low(c.name)) || (c.id === 'c_com' && /haberle/.test(t)) || (c.id === 'c_pwr' && /\bgüç\b|besleme/.test(t))).map(c => c.id);
  let port = null, unit = null;
  const ports = Object.values(M.els).filter(hcIsConn).filter(p => new RegExp('(^|[^a-z0-9çğıöşü])' + low(p.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9çğıöşü]|$)').test(t));
  const pos = s => t.indexOf(low(s));
  if(ports.length){ /* konnektörün sahibi metinde konnektörden hemen önce geçen birim */
    const scored = ports.map(p => { const o = E(p.owner), i = o ? pos(o.name) : -1, j = pos(p.name); return {p, s:(i >= 0 ? 10 : 0) + (i >= 0 && i < j ? 5 : 0)}; }).sort((a, b) => b.s - a.s);
    port = scored[0].p; }
  const rest = us.filter(u => !port || u.id !== port.owner), pj = port ? pos(port.name) : -1;
  unit = rest.find(u => pos(u.name) > pj) || rest[0] || null;
  if(!port && us.length >= 2){ /* "Birim1 - Birim5 arası haberleşme": konnektörsüz, birimden birime (metindeki sıraya göre) */
    const ord = us.slice().sort((a, b) => pos(a.name) - pos(b.name)), from = ord.find(u => !us.some(v => v !== u && low(v.name).includes(low(u.name)) && pos(v.name) === pos(u.name)));
    const to = ord.filter(u => u !== from && !(low(from.name).includes(low(u.name)) && pos(u.name) === pos(from.name)))[0];
    if(from && to) return {port:'', from:from.id, unit:to.id, cats}; }
  return {port:port ? port.id : '', unit:unit ? unit.id : '', cats};
}
function hcApplyScope(tc, sc, regen){
  tc.hcScope = {port:sc.port || '', unit:sc.unit || '', cats:(sc.cats || []).slice()}; if(!sc.port && sc.from) tc.hcScope.from = sc.from;
  const S = hcScopeChains(tc.hcScope); tc.hcPins = hcChainPins(S.sel);
  if(regen || !(tc.hcSteps || []).length) tc.hcSteps = hcGenSteps(tc);
  return S;
}
/* doğrulama kaydı: hat → kaydeden testler */
function hcRuns(){ return hcTests().flatMap(t => (t.hcRuns || []).map(r => Object.assign({t}, r))); }
function hcVerifiedBy(){
  const runs = hcRuns().filter(r => /geçti|başarılı/i.test(r.result || '')), by = new Map();
  hcLines().forEach(l => { const hit = runs.filter(r => { const S = new Set(r.pins); return l.pins.every(p => S.has(p.key)); }); if(hit.length) by.set(l.id, hit); });
  return by;
}
/* ---------- test vurgusu: mimari (sistem şeması) ve kablaj detayı ---------- */
function hcTestHL(tc, mode){
  const st = hcTestState(tc), chs = mode === 'ver' ? st.verified : st.S.sel, R = {q:'', units:new Set(), ports:new Set(), cables:new Set(), pins:new Set(), lines:new Set(), hits:[], cats:{}};
  chs.forEach(ch => { ch.lines.forEach(l => { R.lines.add(l.id); R.cables.add(l.cable.id); }); ch.pins.forEach(p => { R.pins.add(p.key); R.ports.add(p.port.id); R.units.add(p.port.owner); }); ch.cats.forEach(c => R.cats[c] = (R.cats[c] || 0) + 1); });
  return R;
}
{ const _sr = hcSearchRes; hcSearchRes = function(opt){ opt = opt || {}; if(opt.hl !== undefined || opt.exp || HC7.q) return _sr.apply(this, arguments); const tc = HCT2.show && E(HCT2.show); return tc ? hcTestHL(tc, HCT2.mode) : null; }; }
{ const rS = VIEWS['@hcsys'].render; VIEWS['@hcsys'].render = () => { let h = rS(); const tc = !HC7.q && HCT2.show && E(HCT2.show); if(!tc) return h; const st = hcTestState(tc), i = h.lastIndexOf('</div>');
  return h.slice(0, i) + `<div id="hcT2Panel" style="position:absolute;right:10px;top:10px;width:320px;background:#fffffff2;border:1px solid #e3c87a;border-radius:8px;box-shadow:0 2px 10px #0002;font-size:12px;padding:8px 10px">
    <div style="display:flex;gap:6px;align-items:center"><b class="noi18n" style="flex:1">${esc(tc.name)}</b><button class="vb" data-hct2="close" title="Vurguyu kapat">✕</button></div>
    <div style="margin:4px 0">${st.S.sel.length} hat kapsamda (${hcChainSegs(st.S.sel)} pin-pin hat, ${new Set(st.S.sel.flatMap(c => c.cables.map(x => x.id))).size} kablaj) · <b style="color:#27ae60">${st.verified.length} doğrulandı</b></div>
    <label class="vchk"><input type="radio" name="hct2m" data-hct2m="scope"${HCT2.mode !== 'ver' ? ' checked' : ''}> Kapsamdaki hatlar</label> <label class="vchk"><input type="radio" name="hct2m" data-hct2m="ver"${HCT2.mode === 'ver' ? ' checked' : ''}> Yalnız doğrulananlar</label>
    <div style="margin-top:6px"><button class="vb" data-hct2="pdf">Mimari PDF</button> <button class="vb" data-hct2="back">Teste dön</button></div></div>` + h.slice(i); }; }
async function hcTestArchPdf(tc){
  const st = hcTestState(tc), hl = hcTestHL(tc, HCT2.mode), title = 'Test kapsamı — ' + tc.name;
  const sub = `${st.S.sel.length} hat kapsamda · ${st.verified.length} doğrulandı · ${HCT2.mode === 'ver' ? 'yalnız doğrulanan hatlar vurgulu' : 'kapsamdaki hatlar vurgulu'}; diğerleri soluk`;
  const im = await svgToFlate({str:hcArchPage('', 1, 1, {hl, title, sub}), w:HC_PW, h:HC_PH}, 2);
  download(buildPdf([Object.assign(im, {pw:1190.55, ph:841.89, dw:1190.55, dh:841.89, dx:0, dy:0})]), fileSafe((E(M.rootId) ? E(M.rootId).name + ' - ' : '') + title) + '.pdf');
}
/* ---------- test tanımı sekmesinde kapsam, adımlar ve kayıt ---------- */
function hcScopeBlock(tc){
  const H = hcR(), st = hcTestState(tc), sc = st.sc || {port:'', unit:'', cats:[]}, cs = new Set(sc.cats || []);
  let popt = hcOpt('', '— konnektör seçin —', sc.port); hcUnits().forEach(u => { const ps = hcUnitConns(u.id); if(ps.length) popt += `<optgroup label="${esc(u.name)}">${ps.map(p => hcOpt(p.id, u.name + ' ' + p.name, sc.port)).join('')}</optgroup>`; });
  const uopt = hcOpt('', '— tüm karşı uçlar —', sc.unit) + hcUnits().map(u => hcOpt(u.id, u.name, sc.unit)).join(''), fopt = hcOpt('', '—', sc.from) + hcUnits().map(u => hcOpt(u.id, u.name, sc.from)).join('');
  const srcTxt = E(sc.port) ? esc((E(E(sc.port).owner) || {}).name + ' ' + E(sc.port).name) + '</b> konnektöründen' : esc((E(sc.from) || {}).name || '') + '</b> biriminden';
  const box = (inner, bg) => `<div style="border:1px solid #dde;border-radius:6px;padding:8px 10px;margin:6px 0;background:${bg || '#fff'}">${inner}</div>`;
  let h = box(`<div class="hcsec" style="margin-top:0">Kapsam: konnektör üzerinden ya da birimden birime</div>
    <div style="display:flex;gap:6px;align-items:center;font-size:12px;margin-bottom:6px"><input data-hct2f="txt" placeholder="ör. Görev Bilgisayarı J2 üzerinden Sensör birimine haberleşme ve güç testi · Birim1 - Birim5 arası haberleşme" style="flex:1" class="noi18n"><button class="vb pri" data-hct2="parse">Tanımdan kapsam çıkar</button></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:12px"><label>Konnektör <select data-hct2f="port" class="noi18n">${popt}</select></label><label title="Konnektör seçilmezse: başlangıç biriminin tüm konnektörlerinden, birim içi geçişlerle hedef birime giden hatlar">veya başlangıç birimi <select data-hct2f="from" class="noi18n">${fopt}</select></label><label>Hedef birim <select data-hct2f="unit" class="noi18n">${uopt}</select></label>
    <span>Hat tipleri:</span>${H.cats.map(c => `<label class="vchk"><input type="checkbox" data-hct2c="${c.id}"${cs.has(c.id) ? ' checked' : ''}> ${esc(c.name)}</label>`).join('')}</div>
    ${st.sc ? `<div style="margin-top:8px;font-size:13px;background:#eef5ff;border-radius:5px;padding:6px 8px">Potansiyel: <b>${srcTxt} geçen <b>${st.S.all.length}</b> hattın ${sc.unit ? `<b>${st.S.toUnit.length}</b> tanesi ${esc((E(sc.unit) || {}).name || '')} birimine gidiyor; bunlardan ` : ''}<b>${st.S.sel.length}</b> hattı bu testle doğrulayabilirsiniz${cs.size ? ' (' + [...cs].map(k => (hcCat(k) || {}).name).join(' + ') + ')' : ''}.
      <span class="muted">${hcChainSegs(st.S.sel)} pin-pin kablaj hattı · ${hcChainPins(st.S.sel).length} pin · kablajlar: ${esc([...new Set(st.S.sel.flatMap(c => c.cables.map(x => x.name)))].join(', ') || '—')} · mimarideki ${st.tot} hattın %${st.tot ? Math.round(st.S.sel.length / st.tot * 100) : 0}'i</span>${[...cs].filter(k => !st.S.sel.some(ch => ch.cats.includes(k))).map(k => `<div style="color:#b9770e;font-size:12px">⚠ ${esc((hcCat(k) || {}).name || k)}: bu konnektörden ${esc((E(sc.unit) || {}).name || 'karşı uca')} giden hat yok</div>`).join('')}</div>` : '<p class="muted" style="font-size:12px;margin:6px 0 0">Konnektörü ve hedef birimi seçin ya da tanımı yazıp “Tanımdan kapsam çıkar”a basın. Kapsamdaki pinler aşağıdaki pin listesinde otomatik işaretlenir.</p>'}`, '#fbfcfe');
  if(!st.sc) return h;
  const pct = st.S.sel.length ? Math.round(st.verified.length / st.S.sel.length * 100) : 0;
  h += box(`<div class="hcsec" style="margin-top:0;display:flex;gap:8px;align-items:center"><span style="flex:1">Test adımları</span><button class="vb" data-hct2="sadd">+ Adım</button><button class="vb" data-hct2="sgen" title="Adımları kapsamdan yeniden üret">Adımları yeniden üret</button></div>
    <table class="hcpt" style="width:100%"><thead><tr><th style="width:26px">✓</th><th>Adım</th><th>Hatlar</th><th>Hat tipi / grup</th><th></th></tr></thead><tbody>
    ${st.steps.map((s, i) => { const chs = hcStepChains(tc, s, st.S.sel), op = HCT2.open[s.id];
      const gs = E(sc.port) && typeof hgOf === 'function' ? hgOf(E(sc.port)) : [];
      return `<tr style="${s.done ? 'background:#eefaf1' : ''}"><td><input type="checkbox" data-hct2s="${s.id}"${s.done ? ' checked' : ''}></td><td><input data-hct2t="${s.id}" value="${esc(s.txt)}" style="width:100%;min-width:260px">${s.done && s.at ? `<div class="muted" style="font-size:10.5px">doğrulandı ${esc(new Date(s.at).toLocaleString('tr-TR'))}</div>` : ''}</td>
        <td><a href="#" data-hct2="sopen" data-k="${s.id}">${chs.length} hat ${op ? '▾' : '▸'}</a></td><td><select data-hct2g="${s.id}" style="max-width:170px">${hcOpt('', s.only ? 'kalan hatlar' : '— tümü —', s.grp ? '' : (s.cats || [])[0] || '')}${H.cats.map(c => hcOpt('c:' + c.id, c.name, !s.grp && (s.cats || [])[0] === c.id ? 'c:' + c.id : '')).join('')}${gs.map(g => hcOpt('g:' + E(sc.port).id + '|' + g.id, 'grup: ' + g.name, s.grp === E(sc.port).id + '|' + g.id ? 'g:' + s.grp : '')).join('')}</select></td>
        <td><button class="vb" data-hct2="sdel" data-k="${s.id}" title="Adımı sil">✕</button></td></tr>${op ? `<tr><td></td><td colspan="4" style="font-size:11px" class="noi18n">${chs.map(ch => `<div>${st.ver.has(ch.id) ? '<span style="color:#27ae60">✓</span>' : '○'} <b>${esc(ch.name)}</b> — ${esc(hcChainRoute(ch))}</div>`).join('') || '<span class="muted">hat yok</span>'}</td></tr>` : ''}`; }).join('') || '<tr><td colspan="5" class="muted">Adım yok</td></tr>'}</tbody></table>
    <div style="display:flex;gap:12px;align-items:center;font-size:13px;margin-top:8px"><div style="flex:0 0 220px;height:12px;background:#eceff3;border-radius:6px;overflow:hidden"><div style="width:${pct}%;height:100%;background:#27ae60"></div></div><b>${st.verified.length} / ${st.S.sel.length}</b> hat doğrulandı · ${st.done} / ${st.steps.length} adım
      <span style="flex:1"></span><button class="vb" data-hct2="show">Mimaride göster</button><button class="vb pri" data-hct2="pass">Test başarılı — kaydet</button></div>`);
  h += box(`<div class="hcsec" style="margin-top:0">Testin kapsadığı hatlar (${st.S.sel.length})</div><div style="max-height:220px;overflow:auto"><table class="hcpt" style="width:100%"><thead><tr><th>Durum</th><th>Hat</th><th>Hat tipi</th><th>Güzergâh (kablaj ve pinler)</th></tr></thead><tbody>
    ${st.S.sel.map(ch => `<tr><td>${st.ver.has(ch.id) ? '<span style="color:#27ae60">✓ doğrulandı</span>' : '<span class="muted">bekliyor</span>'}</td><td class="noi18n"><b>${esc(ch.name)}</b></td><td>${hcChip(hcCat(ch.cat)) || '—'}</td><td class="noi18n" style="font-size:11.5px">${esc(hcChainRoute(ch))}</td></tr>`).join('')}</tbody></table></div>`);
  const runs = tc.hcRuns || [];
  if(runs.length) h += box(`<div class="hcsec" style="margin-top:0">Doğrulama kayıtları</div><table class="hcpt"><thead><tr><th>Tarih</th><th>Sonuç</th><th>Doğrulanan hat</th><th>Adımlar</th><th></th></tr></thead><tbody>${runs.slice().reverse().map(r => `<tr><td>${esc(new Date(r.at).toLocaleString('tr-TR'))}</td><td>${esc(r.result)}</td><td title="${esc((r.routes || []).join('\n'))}">${r.n}</td><td style="font-size:11px">${esc((r.steps || []).join(' · '))}</td><td><button class="vb" data-hct2="rdel" data-k="${r.id}" title="Kaydı sil">✕</button></td></tr>`).join('')}</tbody></table>`);
  return h;
}
{ const _d = hcDefHTML; hcDefHTML = function(){ const h = _d.apply(this, arguments), tc = E(HCT.tc); if(!tc) return h; const mk = '</datalist>', i = h.indexOf(mk); return i < 0 ? h : h.slice(0, i + mk.length) + hcScopeBlock(tc) + h.slice(i + mk.length); }; }
/* kapsama sekmesi: kayıtlı doğrulama */
{ const _c = hcCovHTML; hcCovHTML = function(){ const h = _c.apply(this, arguments), by = hcVerifiedBy(), n = hcLines().length, runs = hcRuns(); const mk = '<div style="display:flex;gap:24px;flex-wrap:wrap">', i = h.indexOf(mk); if(i < 0) return h;
  const blk = `<div style="font-size:13px;margin:0 0 10px;background:#eefaf1;border:1px solid #bfe5c9;border-radius:6px;padding:6px 10px"><b>Kayıtlı doğrulama:</b> ${by.size} / ${n} pin-pin hat başarılı test kaydıyla doğrulandı (%${n ? Math.round(by.size / n * 100) : 0}) · ${runs.length} kayıt${runs.length ? ' · son: ' + esc(runs.slice().sort((a, b) => b.at.localeCompare(a.at))[0].t.name) + ' (' + esc(new Date(runs.slice().sort((a, b) => b.at.localeCompare(a.at))[0].at).toLocaleDateString('tr-TR')) + ')' : ''}</div>`;
  return h.slice(0, i) + blk + h.slice(i); }; }
(() => {
  const V = $('#view'), on = () => ST.cur === '@hctest';
  const save = f => { snap(); const r = f(); afterChange(); renderViewBar(); renderView(); return r; };
  V.addEventListener('change', ev => { if(!on()) return; const t = ev.target, tc = E(HCT.tc); if(!tc) return;
    const sc = Object.assign({port:'', unit:'', cats:[]}, tc.hcScope || {});
    if(t.dataset.hct2f === 'port' || t.dataset.hct2f === 'unit' || t.dataset.hct2f === 'from'){ sc[t.dataset.hct2f] = t.value; if(t.dataset.hct2f === 'port' && t.value) delete sc.from; if(t.dataset.hct2f === 'from' && t.value) sc.port = ''; return save(() => { if(sc.port || sc.from) hcApplyScope(tc, sc, true); else tc.hcScope = sc; }); }
    if(t.dataset.hct2c != null){ const S = new Set(sc.cats); if(t.checked) S.add(t.dataset.hct2c); else S.delete(t.dataset.hct2c); sc.cats = [...S]; return save(() => { if(sc.port || sc.from) hcApplyScope(tc, sc, true); else tc.hcScope = sc; }); }
    const step = id => (tc.hcSteps || []).find(s => s.id === id);
    if(t.dataset.hct2s){ const s = step(t.dataset.hct2s); if(s) return save(() => { s.done = t.checked; s.at = t.checked ? new Date().toISOString() : ''; }); }
    if(t.dataset.hct2t){ const s = step(t.dataset.hct2t); if(s) return save(() => { s.txt = t.value.trim(); }); }
    if(t.dataset.hct2g){ const s = step(t.dataset.hct2g); if(s) return save(() => { const v = t.value; delete s.only; s.cats = v.startsWith('c:') ? [v.slice(2)] : []; s.grp = v.startsWith('g:') ? v.slice(2) : ''; }); }
  });
  V.addEventListener('keydown', ev => { if(on() && ev.target.dataset && ev.target.dataset.hct2f === 'txt' && ev.key === 'Enter'){ ev.preventDefault(); const b = document.querySelector('[data-hct2="parse"]'); if(b) b.click(); } });
  document.addEventListener('change', ev => { const t = ev.target; if(ST.cur === '@hcsys' && t.dataset && t.dataset.hct2m){ HCT2.mode = t.dataset.hct2m; renderView(); } });
  document.addEventListener('click', ev => { const b = ev.target.closest && ev.target.closest('[data-hct2]'); if(!b) return; ev.preventDefault(); const a = b.dataset.hct2, k = b.dataset.k;
    if(a === 'close'){ HCT2.show = ''; renderView(); return; }
    if(a === 'back'){ HCT.tc = HCT2.show; HCT.tab = 'def'; openD('@hctest'); return; }
    if(a === 'pdf'){ const tc = E(HCT2.show); if(tc) hcTestArchPdf(tc); return; }
    const tc = E(HCT.tc); if(!tc || !on()) return;
    if(a === 'parse'){ const txt = (document.querySelector('[data-hct2f="txt"]') || {}).value || ''; const sc = hcParseScope(txt); if(!sc.port && !sc.from) return toast('Tanımda konnektör ya da iki birim bulunamadı (ör. "Görev Bilgisayarı J2", "Birim1 - Birim5 arası")');
      return save(() => { const S = hcApplyScope(tc, sc, true); if(/test/i.test(txt) && /^Kablaj süreklilik testi|^Yeni test/.test(tc.name)) tc.name = txt.trim().replace(/^\S/, c => c.toLocaleUpperCase('tr')); toast(`${S.sel.length} hat kapsamda · ${(tc.hcSteps || []).length} adım`); }); }
    if(a === 'sadd') return save(() => { tc.hcSteps = (tc.hcSteps || []).concat([{id:'s' + uid(), txt:'Yeni adım', cats:[], grp:'', done:false}]); });
    if(a === 'sgen'){ if((tc.hcSteps || []).some(s => s.done) && !confirm('Adımlar yeniden üretilsin mi? İşaretli adımlar sıfırlanır.')) return; return save(() => { tc.hcSteps = hcGenSteps(tc); }); }
    if(a === 'sdel') return save(() => { tc.hcSteps = (tc.hcSteps || []).filter(s => s.id !== k); });
    if(a === 'sopen'){ HCT2.open[k] = !HCT2.open[k]; renderView(); return; }
    if(a === 'show'){ HCT2.show = tc.id; HCT2.mode = 'scope'; HC7.q = ''; HCS.catF = ''; openD('@hcsys'); return; }
    if(a === 'rdel'){ if(!confirm('Doğrulama kaydı silinsin mi?')) return; return save(() => { tc.hcRuns = (tc.hcRuns || []).filter(r => r.id !== k); }); }
    if(a === 'pass'){ const st = hcTestState(tc); if(!st.verified.length) return toast('Önce doğrulanan adımları işaretleyin');
      if(st.open.length && !confirm(`${st.open.length} hat henüz doğrulanmadı. Yalnız doğrulanan ${st.verified.length} hat kaydedilsin mi?`)) return;
      return save(() => { tc.hcRuns = (tc.hcRuns || []).concat([{id:'r' + uid(), at:new Date().toISOString(), result:st.open.length ? 'Geçti (kısmi)' : 'Geçti', pins:hcChainPins(st.verified), n:st.verified.length, routes:st.verified.map(ch => ch.name + ': ' + hcChainRoute(ch)), steps:st.steps.filter(s => s.done).map(s => s.txt)}]);
        tc.result = st.open.length ? 'Kısmen' : 'Geçti'; toast(`Kaydedildi: ${st.verified.length} hat doğrulandı`); }); }
  });
})();
/* yeni test formunda serbest tanım */
{ const _qf = quickForm; quickForm = function(title, fields, cb){ if(title === 'Yeni kablaj testi' && Array.isArray(fields) && !fields.some(f => f.k === 'scope')){
    fields = fields.concat([{k:'scope', l:'Kapsam (isteğe bağlı) — ör. Görev Bilgisayarı J2 üzerinden Sensör birimine haberleşme ve güç testi', v:''}]);
    const cb0 = cb; cb = r => { const res = cb0(r); if(res) return res; if(r.scope){ const tc = E(HCT.tc), sc = hcParseScope(r.scope); if(tc && (sc.port || sc.from)){ snap(); hcApplyScope(tc, sc, true); if(/^Kablaj süreklilik testi/.test(tc.name)) tc.name = r.scope.trim().replace(/^\S/, c => c.toLocaleUpperCase('tr')); afterChange(); renderViewBar(); renderView(); toast(`${hcScopeChains(tc.hcScope).sel.length} hat kapsamda`); } else toast('Kapsamda konnektör bulunamadı; elle seçin'); } }; }
  return _qf.call(this, title, fields, cb, arguments[3]); }; }
