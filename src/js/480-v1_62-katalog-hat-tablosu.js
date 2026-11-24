/* ================= v1.62 — Katalog konnektör görünümleri, içten geçişli birimler, hat tablosu (PDF), toplu bağlantı şemaları =================
   - Konnektör tipine katalogdan ön (eşleşme yüzü) ve arka görünüm resmi eklenir; teknik resimde konnektör görünümü artık çizilmez,
     seçilen yüzün katalog resmi ve yanında pin tablosu konur (ön / arka / ikisi, kablaj başına seçilir).
   - Birim "içten geçişli" (ara kutu, dağıtım kutusu) işaretlenirse aynı sinyal adlı pinleri içeride bağlı sayılır: hat birden çok kablajdan geçer.
   - Hat tablosu: seçilen hat tipleri / etiket için her hattın geçtiği kablajlar ve konnektörler (J1-1 ↔ J2-3), PDF ve Excel. */
const HC9 = {cats:null, lbl:'', q:'', thru:true};
/* ---------- katalog görünümleri ---------- */
const hcTImg = (t, k) => { if(!t) return ''; if(t['img' + k]) return t['img' + k]; const H = hcR(), o = (H.timg || {})[t.id]; return o ? o[k] || '' : ''; };
function hcImgBlock(t, ro){
  const one = (k, l, hint) => { const src = hcTImg(t, k); return `<div style="display:inline-block;vertical-align:top;margin:0 14px 6px 0;min-width:200px"><div style="font-size:12px;font-weight:600">${l}</div>${src ? `<img class="hcimg" style="max-width:260px;max-height:200px" src="${esc(src)}" alt="">` : `<div class="muted" style="font-size:11px;border:1px dashed #ccd;border-radius:4px;padding:16px 10px;width:220px">${hint}</div>`}<button class="vb" data-hc9="img" data-k="${k}">${src ? 'Değiştir…' : 'Resim yükle…'}</button>${src ? `<button class="vb" data-hc9="imgdel" data-k="${k}">Kaldır</button>` : ''}</div>`; };
  return `<div class="hcsec">Görünümler <span class="muted" style="font-weight:400;font-size:11px">katalog / datasheet görünümlerini yükleyin; teknik resimde konnektör görünümü bu resimlerden alınır (çizilmez)${ro ? '. Yerleşik tipe eklenen resimler bu modelde saklanır' : ''}</span></div>
    ${one('F', 'Ön görünüm (eşleşme yüzü)', 'Katalogdaki ön (mating face) görünümü, pin numaralarıyla')}${one('R', 'Arka görünüm (kablo / kontak giriş yüzü)', 'Katalogdaki arka (wire entry) görünümü')}${one('', 'Fotoğraf', 'Genel ürün fotoğrafı (isteğe bağlı)')}`;
}
function hcImgPick2(t, k, builtin){
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => { const f = inp.files && inp.files[0]; if(!f) return; const r = new FileReader();
    r.onload = () => { const im = new Image(); im.onload = () => { const mx = k ? 1400 : 480, sc = Math.min(1, mx / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.round(im.width * sc); cv.height = Math.round(im.height * sc);
      const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(im, 0, 0, cv.width, cv.height);
      const url = cv.toDataURL(/png/i.test(f.type) ? 'image/png' : 'image/jpeg', 0.9); snap();
      if(builtin){ const H = hcM(); H.timg = H.timg || {}; H.timg[t.id] = Object.assign(H.timg[t.id] || {}, {[k]:url}); } else t['img' + k] = url;
      afterChange(); renderView(); toast('Görünüm eklendi'); }; im.src = r.result; };
    r.readAsDataURL(f); };
  inp.click();
}
document.addEventListener('click', ev => { const b = ev.target.closest && ev.target.closest('[data-hc9="img"],[data-hc9="imgdel"]'); if(!b || ST.cur !== '@hclib') return; ev.preventDefault();
  const t = hcType(HC.sel); if(!t) return; const k = b.dataset.k, builtin = !!t.builtin;
  if(b.dataset.hc9 === 'img') return hcImgPick2(builtin ? t : hcR().ctypes[t.id], k, builtin);
  snap(); if(builtin){ const H = hcM(); if(H.timg && H.timg[t.id]) delete H.timg[t.id][k]; } else delete hcR().ctypes[t.id]['img' + k]; afterChange(); renderView(); }, true);
/* teknik resimde konnektör görünümü: katalog resmi + pin tablosu (çizim yok) */
const HC_FACE = [['F', 'Ön görünüm (eşleşme yüzü)'], ['R', 'Arka görünüm (kablo giriş yüzü)'], ['FR', 'Ön ve arka görünüm']];
hcConnFace = function(c, n, x, y, w, h){
  const p = E(n.port), u = p && E(p.owner), t = p && hcType(p.hc.ct); if(!p) return '';
  const mode = (c.dwg && c.dwg.face) || 'F', wired = new Map();
  c.wires.filter(wr => wr.on !== false).forEach(wr => [wr.a, wr.b].forEach(e => { if(e.n === n.id) wired.set(e.pin, hcWireName(c, c.wires.indexOf(wr))); }));
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#999" stroke-width="0.6" stroke-dasharray="4 3"/>`;
  s += hcT(x + 10, y + 20, `${u ? u.name : '?'} · ${p.name}`, {fs:14, b:true}) + hcT(x + 10, y + 37, `Birim konnektörü: ${t ? (t.pn || t.name) : 'tip yok'}${t && t.mate ? '   ·   Kablaj ucu: ' + t.mate : ''}`, {fs:10.5, c:'#333'});
  s += hcT(x + 10, y + 52, `${(HC_FACE.find(f => f[0] === mode) || HC_FACE[0])[1]} · katalog görünümü${t && t.gender ? ' · ' + t.gender : ''}`, {fs:10.5, c:'#1f4e8c', b:true});
  const top = y + 62, tw = Math.min(250, w * 0.36), iw = w - tw - 30, ih = h - (top - y) - 10, ks = mode === 'FR' ? ['F', 'R'] : [mode];
  ks.forEach((k, i) => { const src = hcTImg(t, k), bw = (iw - (ks.length - 1) * 10) / ks.length, bx = x + 10 + i * (bw + 10);
    s += hcT(bx, top + 10, k === 'F' ? 'ÖN (eşleşme yüzü)' : 'ARKA (kablo giriş yüzü)', {fs:9.5, b:true, c:'#555'});
    s += src ? `<image x="${bx}" y="${top + 16}" width="${bw}" height="${ih - 16}" href="${src}" preserveAspectRatio="xMidYMid meet"/>`
      : `<rect x="${bx}" y="${top + 16}" width="${bw}" height="${ih - 16}" fill="#fafafa" stroke="#bbb" stroke-dasharray="5 4"/>` + hcT(bx + bw / 2, top + ih / 2, 'Katalog görünümü eklenmemiş', {fs:12, a:'middle', c:'#888', b:true}) + hcT(bx + bw / 2, top + ih / 2 + 16, 'Konnektör kütüphanesi → tip → ' + (k === 'F' ? 'Ön' : 'Arka') + ' görünüm', {fs:9.5, a:'middle', c:'#888'}); });
  const pins = hcPins(p).filter(q => hcPinUsed(q.d) || wired.has(q.no)), tx = x + w - tw - 10, rh = 13, maxR = Math.floor((ih - 18) / rh) - 1;
  s += `<rect x="${tx}" y="${top}" width="${tw}" height="${rh + 4}" fill="#34495e"/>` + hcT(tx + 4, top + 12, 'Pin', {fs:9, b:true, c:'#fff'}) + hcT(tx + 34, top + 12, 'Sinyal', {fs:9, b:true, c:'#fff'}) + hcT(tx + tw - 56, top + 12, 'Hat', {fs:9, b:true, c:'#fff'});
  pins.slice(0, maxR).forEach((q, i) => { const yy = top + rh + 4 + i * rh, cat = hcCat(hcPinCat(q.d));
    s += `<rect x="${tx}" y="${yy}" width="${tw}" height="${rh}" fill="${i % 2 ? '#f4f6f9' : '#fff'}"/><rect x="${tx}" y="${yy}" width="3" height="${rh}" fill="${cat ? cat.col : '#ccc'}"/>` + hcT(tx + 6, yy + 10, q.no, {fs:9, b:true}) + hcT(tx + 34, yy + 10, (q.d.sig || (hcLabel(q.d.lbl) || {}).name || '').slice(0, Math.floor((tw - 100) / 5.2)), {fs:9}) + hcT(tx + tw - 56, yy + 10, wired.get(q.no) || '—', {fs:8.5, c:'#555'}); });
  if(pins.length > maxR) s += hcT(tx + 4, top + rh + 4 + maxR * rh + 10, `… ${pins.length - maxR} pin daha (hat listesinde)`, {fs:9, c:'#888'});
  s += `<rect x="${tx}" y="${top}" width="${tw}" height="${rh + 4 + Math.min(pins.length, maxR) * rh}" fill="none" stroke="#34495e" stroke-width="0.8"/>`;
  return s;
};
/* kablaj detayında görünüm seçimi (antet alanlarının yanında) */
{ const rC = VIEWS['@hccable'].render; VIEWS['@hccable'].render = () => { const h = rC(), c = HCS.cab && hcR().cables[HCS.cab]; if(!c) return h; const v = (c.dwg && c.dwg.face) || 'F';
  return h.replace('<div class="hcsec">Hatlar', `<div style="font-size:12px;margin:6px 0"><label>Teknik resimde konnektör görünümü <select data-hc9f="face">${HC_FACE.map(([k, l]) => hcOpt(k, l, v)).join('')}</select></label> <span class="muted">görünümler konnektör kütüphanesindeki katalog resimlerinden alınır</span></div><div class="hcsec">Hatlar`); }; }
document.addEventListener('change', ev => { const t = ev.target; if(!t.dataset || t.dataset.hc9f !== 'face' || ST.cur !== '@hccable') return; const c = hcR().cables[HCS.cab]; if(!c) return; snap(); c.dwg = Object.assign({}, c.dwg || {}, {face:t.value}); afterChange(); });
/* ---------- içten geçişli birimler ve hat zincirleri ---------- */
const hcThru = u => !!(u && u.hcThru);
const HC9C = {rev:-1, v:null};
function hcChains(){
  if(HC9C.rev === REV && HC9C.v) return HC9C.v;
  const L = hcLines(), par = new Map(L.map(l => [l.id, l.id])), f = x => { while(par.get(x) !== x){ par.set(x, par.get(par.get(x))); x = par.get(x); } return x; }, un = (a, b) => par.set(f(a), f(b));
  const lineOf = new Map(); L.forEach(l => l.pins.forEach(p => lineOf.set(p.key, l)));
  /* v1.66: geçiş konnektörü (u.hcInline) pin numarasıyla 1:1; birim içi geçişler (u.hcLinks [{a, b}] port|pin) — bu pinler uç sayılmaz */
  const thruKeys = new Set();
  hcUnits().forEach(u => (u.hcLinks || []).forEach(k => { const la = lineOf.get(k.a), lb = lineOf.get(k.b); if(la && lb){ un(la.id, lb.id); thruKeys.add(k.a); thruKeys.add(k.b); } }));
  hcUnits().filter(hcThru).forEach(u => { const by = new Map(); hcUnitConns(u.id).forEach(p => hcPins(p).forEach(q => { const s = u.hcInline ? '#' + q.no : String(q.d.sig || '').trim().toLocaleLowerCase('tr'); if(!s) return; const l = lineOf.get(p.id + '|' + q.no); if(!l) return; if(!by.has(s)) by.set(s, []); by.get(s).push(l); }));
    by.forEach(ls => ls.slice(1).forEach(l => un(ls[0].id, l.id))); });
  const G = new Map(); L.forEach(l => { const r = f(l.id); if(!G.has(r)) G.set(r, []); G.get(r).push(l); });
  const v = [...G.values()].map(ls => { const pins = ls.flatMap(l => l.pins), cats = [...new Set(ls.flatMap(l => l.cats))], ends = pins.filter(p => !hcThru(E(p.port.owner)) && !thruKeys.has(p.key));
    return {id:ls.map(l => l.id).sort().join(';'), lines:ls, cables:[...new Set(ls.map(l => l.cable))], pins, ends, cats, cat:cats[0] || '', name:[...new Set(ls.map(l => l.name))].join(' / '), lbls:[...new Set(pins.map(p => p.d.lbl).filter(Boolean))], units:[...new Set(pins.map(p => p.port.owner))]}; });
  HC9C.rev = REV; HC9C.v = v; return v;
}
const hcPinTxt = p => `${(E(p.port.owner) || {}).name || '?'} ${p.port.name}-${p.no}`;
function hcChainRoute(ch){ return ch.lines.map(l => `[${l.cable.name}] ` + l.pins.map(hcPinTxt).join(' ↔ ')).join('  ⇒  '); }
/* birim başlığında "içten geçişli" seçeneği */
{ const _uh = hcUnitHTML; hcUnitHTML = function(){ const h = _uh.apply(this, arguments), u = E(HC.unit); if(!u) return h; const mk = ' arayüz</span>', i = h.indexOf(mk); if(i < 0) return h;
  return h.slice(0, i + mk.length) + `<label class="vchk" style="font-size:12px" title="Ara kutu / dağıtım kutusu gibi birimlerde aynı sinyal adlı pinler içeride bağlı sayılır; hat tablosu ve testlerde hat bu birimden geçerek diğer kablajlara devam eder"><input type="checkbox" data-hc9f="thru"${u.hcThru ? ' checked' : ''}> İçten geçişli birim (aynı sinyal adlı pinler içeride bağlı)</label>` + h.slice(i + mk.length); }; }
document.addEventListener('change', ev => { const t = ev.target; if(!t.dataset || t.dataset.hc9f !== 'thru' || ST.cur !== '@hcunits') return; const u = E(HC.unit); if(!u) return; snap(); u.hcThru = t.checked; afterChange(); });
/* ---------- hat tablosu ---------- */
function hcRouteRows(){
  const cats = HC9.cats, q = String(HC9.q || '').toLocaleLowerCase('tr');
  return hcChains().filter(ch => (!cats || !cats.size || ch.cats.some(c => cats.has(c)) || (cats.has('') && !ch.cats.length)) && (!HC9.lbl || ch.lbls.includes(HC9.lbl)) && (!q || [ch.name, hcChainRoute(ch)].join(' ').toLocaleLowerCase('tr').includes(q)))
    .sort((a, b) => (a.cat || '~').localeCompare(b.cat || '~') || a.name.localeCompare(b.name, 'tr', {numeric:true}))
    .map((ch, i) => ({no:i + 1, ch, name:ch.name, cat:(hcCat(ch.cat) || {}).name || '—', route:hcChainRoute(ch), cables:ch.cables.map(c => c.name).join(', '), conns:[...new Set(ch.pins.map(p => `${(E(p.port.owner) || {}).name} ${p.port.name}`))].join(', '), pins:ch.pins.map(hcPinTxt).join(', '), n:ch.pins.length}));
}
function hcRouteBar(){
  const H = hcR(), sel = HC9.cats || new Set();
  return `<span style="font-size:12px">Hat tipleri:</span>${H.cats.map(c => `<label class="vchk" style="font-size:12px"><input type="checkbox" data-hc9c="${c.id}"${sel.has(c.id) ? ' checked' : ''}> ${esc(c.name)}</label>`).join('')}
    <label>Etiket <select data-hc9f="lbl" class="noi18n">${hcOpt('', '— tümü —', HC9.lbl)}${H.labels.map(l => hcOpt(l.id, l.name + ((hcCat(l.cat) || {}).name ? ' (' + hcCat(l.cat).name + ')' : ''), HC9.lbl)).join('')}</select></label>
    <input data-hc9f="q" placeholder="Ara" value="${esc(HC9.q)}" style="width:140px"><span class="vsep"></span><button class="vb pri" data-hc9="pdf">PDF indir</button><button class="vb" data-hc9="xl">Excel</button>`;
}
function hcRouteHTML(){
  const R = hcRouteRows(), sel = HC9.cats;
  return `<div style="padding:10px"><p class="muted" style="font-size:12px;margin-top:0">Seçilen hat tiplerindeki${HC9.lbl ? ' ve "' + esc((hcLabel(HC9.lbl) || {}).name || '') + '" etiketli' : ''} her hattın uçtan uca geçtiği kablajlar ve konnektör pinleri. ${sel && sel.size ? '' : 'Hat tipi seçilmedi: tüm hatlar listeleniyor. '}İçten geçişli birimlerden geçen hatlar tek satırda, birden çok kablajla gösterilir (⇒).</p>
    <div style="font-size:12px;margin-bottom:6px"><b>${R.length}</b> hat · ${new Set(R.flatMap(r => r.ch.cables)).size} kablaj · ${new Set(R.flatMap(r => r.ch.pins.map(p => p.port.id))).size} konnektör · ${R.reduce((a, r) => a + r.n, 0)} pin</div>
    <div style="max-height:calc(100vh - 230px);overflow:auto"><table class="hcpt" style="width:100%"><thead><tr><th>No</th><th>Hat</th><th>Hat tipi</th><th>Güzergâh (kablaj ve pinler)</th><th>Kablajlar</th><th>Konnektörler</th></tr></thead><tbody>
    ${R.map(r => `<tr><td>${r.no}</td><td class="noi18n"><b>${esc(r.name)}</b></td><td>${hcChip(hcCat(r.ch.cat)) || '—'}</td><td class="noi18n" style="font-size:11.5px">${esc(r.route)}</td><td class="noi18n">${r.ch.cables.map(c => `<a href="#" data-hc9="cab" data-k="${c.id}">${esc(c.name)}</a>`).join(', ')}</td><td class="noi18n" style="font-size:11.5px">${esc(r.conns)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Seçime uyan hat yok</td></tr>'}</tbody></table></div></div>`;
}
VIEWS['@hcroute'] = {tr:'Hat Tablosu', ic:'TBL', note:'Haberleşme, güç, ayrık… hat tiplerinden ve / veya bir etiketten seçin: her hattın geçtiği kablajlar ve konnektör pinleri tablo halinde listelenir (ör. Görev Bilgisayarı J1-1 ↔ Sensör J2-3).<br><br>Birim arayüzlerinde <b>içten geçişli</b> işaretlenen birimlerde (ara kutu, dağıtım kutusu) aynı sinyal adlı pinler içeride bağlı sayılır; hat birden çok kablajdan geçerek tek satırda gösterilir.<br><br>PDF (A3) ve Excel olarak indirilebilir.', render:hcRouteHTML, bar:hcRouteBar, status:() => hcRouteRows().length + ' hat'};
async function hcRoutePdf(){
  const R = hcRouteRows(); if(!R.length) return toast('Seçime uyan hat yok');
  const cols = [['No', 34], ['Hat', 150], ['Hat tipi', 80], ['Güzergâh (kablaj ve pinler)', 820], ['Kablajlar', 120], ['Konnektörler', 300]], RH = 15;
  const sel = HC9.cats && HC9.cats.size ? [...HC9.cats].map(k => (hcCat(k) || {}).name || k).join(', ') : 'tüm hat tipleri';
  const title = 'Hat tablosu — ' + sel + (HC9.lbl ? ' — etiket: ' + ((hcLabel(HC9.lbl) || {}).name || '') : '');
  const per = Math.floor((HC_PH - 20 - HC_TBH - 30 - 70) / RH) - 1, pages = Math.ceil(R.length / per), fit = (s, wd) => { const m = Math.floor(wd / 5.4); return s.length > m ? s.slice(0, m - 1) + '…' : s; };
  const pseudo = {name:title, dwg:{title, no:'HAT-' + (HC9.cats && HC9.cats.size === 1 ? ((hcCat([...HC9.cats][0]) || {}).name || 'TBL') : 'TABLO').toLocaleUpperCase('tr').replace(/[^A-Z0-9ÇĞİÖŞÜ]+/g, '-'), rev:'A', date:new Date().toLocaleDateString('tr-TR')}};
  const out = []; toast('Hat tablosu PDF hazırlanıyor…');
  for(let i = 0; i < pages; i++){ const part = R.slice(i * per, i * per + per);
    let s = hcT(30, 40, title.toLocaleUpperCase('tr'), {fs:15, b:true}) + hcT(30, 58, `${R.length} hat · ${new Set(R.flatMap(r => r.ch.cables)).size} kablaj · sayfa ${i + 1} / ${pages}`, {fs:10.5, c:'#444'});
    s += hcTable(30, 70, cols, part.map(r => [String(r.no), fit(r.name, 150), r.cat, fit(r.route, 820), fit(r.cables, 120), fit(r.conns, 300)]), RH).svg;
    const im = await svgToFlate({str:hcFrame(s + hcTitleBlock(pseudo, i + 1, pages, 'Hat tablosu')), w:HC_PW, h:HC_PH}, 2); out.push(Object.assign(im, {pw:1190.55, ph:841.89, dw:1190.55, dh:841.89, dx:0, dy:0})); }
  download(buildPdf(out), fileSafe((E(M.rootId) ? E(M.rootId).name + ' - ' : '') + title) + '.pdf');
}
function hcRouteXlsx(){ const R = hcRouteRows(), hd = a => a.map(v => ({v, s:1}));
  download(buildXlsx([{name:'Hat tablosu', rows:[hd(['No', 'Hat', 'Hat tipi', 'Güzergâh', 'Kablajlar', 'Konnektörler', 'Pinler', 'Pin sayısı'])].concat(R.map(r => [r.no, r.name, r.cat, r.route, r.cables, r.conns, r.pins, r.n])), widths:[5, 24, 12, 90, 14, 40, 60, 8], header:true, freeze:[1, 2]}]), fileSafe((E(M.rootId) ? E(M.rootId).name + ' - ' : '') + 'hat tablosu') + '.xlsx'); }
(() => {
  const on = () => ST.cur === '@hcroute';
  document.addEventListener('change', ev => { if(!on()) return; const t = ev.target;
    if(t.dataset.hc9c != null){ HC9.cats = HC9.cats || new Set(); if(t.checked) HC9.cats.add(t.dataset.hc9c); else HC9.cats.delete(t.dataset.hc9c); renderView(); renderStatus && renderStatus(); return; }
    if(t.dataset.hc9f === 'lbl'){ HC9.lbl = t.value; renderView(); } });
  document.addEventListener('input', ev => { if(on() && ev.target.dataset && ev.target.dataset.hc9f === 'q'){ HC9.q = ev.target.value; renderView(); } });
  document.addEventListener('keydown', ev => { if(on() && ev.target.dataset && ev.target.dataset.hc9f === 'q') ev.stopPropagation(); }, true);
  document.addEventListener('click', ev => { const b = ev.target.closest && ev.target.closest('[data-hc9]'); if(!b) return; const a = b.dataset.hc9;
    if(a === 'alldwg'){ ev.preventDefault(); return hcDrawingPdf(hcCables(), false); }
    if(a === 'route'){ ev.preventDefault(); return openD('@hcroute'); }
    if(!on()) return; ev.preventDefault();
    if(a === 'pdf') return hcRoutePdf();
    if(a === 'xl') return hcRouteXlsx();
    if(a === 'cab') return hcOpenCable(b.dataset.k); });
})();
/* sistem şeması çubuğu: toplu bağlantı şemaları ve hat tablosu */
{ const bS = VIEWS['@hcsys'].bar; VIEWS['@hcsys'].bar = () => bS() + `<span class="vsep"></span><button class="vb" data-hc9="alldwg" title="Bütün kablajların bağlantı şemaları, hat listeleri, BOM ve konnektör görünümleri tek PDF">Tüm bağlantı şemaları (PDF)</button><button class="vb" data-hc9="route" title="Hat tiplerine / etikete göre hatların geçtiği kablaj ve konnektörler">Hat tablosu</button>`; }
{ const _m = hcLibMenu; hcLibMenu = () => { const r = _m(); const i = r.findIndex(x => x && x.t && /^Kablaj özeti/.test(x.t)); r.splice(i < 0 ? r.length : i + 1, 0, {t:'Hat tablosu (kablaj ve konnektör güzergâhı)', f:() => openD('@hcroute')}, {t:'Tüm bağlantı şemaları (PDF)', f:() => hcDrawingPdf(hcCables(), false)}); return r; }; }
if(typeof MENU_ADV !== 'undefined') MENU_ADV.analysis = new RegExp(MENU_ADV.analysis.source + '|^Hat tablosu|^Tüm bağlantı şemaları');
if(typeof MENU_GROUPS !== 'undefined'){ const g = MENU_GROUPS.analysis.cls.find(x => x[0] === 'Kablaj ve konnektörler'); if(g) g[1] = new RegExp(g[1].source + '|Hat tablosu|Tüm bağlantı şemaları'); }
