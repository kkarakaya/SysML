/* ================= v1.54: KABLAJ — KONNEKTÖR KÜTÜPHANESİ, HAT ETİKETLERİ, BİRİM ARAYÜZLERİ VE PINOUT =================
   Veri modeli (M.hrn, ilk yazmada oluşur; okuma yolları modeli değiştirmez):
     cats      [{id, name, col, desc}]                       hat tipi / arayüz türü (Haberleşme, Güç, Ayrık…)
     labels    [{id, name, cat, dir, vmin, vmax, desc}]      kullanıcı tanımlı hat etiketleri (RS422_TX+, 28V…)
     rules     [{id, a, b}]                                  eşleşme kuralları: a etiketli pin b etiketli pine bağlanır (TX+ ↔ RX+)
     contacts  [{id, imax, awgThick, awgThin, note}]         kontak boyutları: akım sınırı ve kabul edilen AWG aralığı
     ctypes    {id: konnektör tipi}                          kullanıcı tipleri (HC_LIB yerleşik tipleri kodda, salt okunur)
     cables    {id: {id, name, len, nodes:[{id, kind:'conn'|'splice', port}], wires:[{id, a:{n, pin}, b:{n, pin}, awg, color, grp, on}]}}
               (v1.55 kablaj şeması: dallanma = 2'den çok konnektör düğümü, splice = kind 'splice' düğümü)
   Birim = Block; arayüz (konnektör) = Block'a ait Port, port.hc = {ct, cat, desc, pins:{no:{sig, lbl, cat, dir, vmin, vmax, inom, ipk, pair, shield, note}}}. */
const HC_DIRS = [['', '—'], ['in', 'Giriş'], ['out', 'Çıkış'], ['bi', 'Çift yönlü'], ['src', 'Güç kaynağı (çıkış)'], ['snk', 'Güç girişi (yük)'], ['rtn', 'Dönüş / GND'], ['pas', 'Pasif']];
const HC_GENDERS = ['Erkek (pin)', 'Dişi (soket)', 'Hermafrodit'];
const HC_BODIES = ['Plug (kablo ucu)', 'Receptacle — duvar flanşlı', 'Receptacle — jam-nut', 'Receptacle — kutu montaj', 'Inline receptacle', 'PCB montaj'];
const HC_LOCKS = ['Vidalı (threaded)', 'Bayonet', 'Push-pull', 'Vidalı kilit (jackscrew)', 'Klips / mandal', 'Yok'];
const HC_TERMS = ['Crimp', 'Lehim kabı', 'PCB (düz)', 'PCB (90°)', 'Tel uçlu (pigtail)'];
const HC_START = ['Sol üst', 'Sağ üst', 'Sol alt', 'Sağ alt'];
const HC_VIEWS = ['Ön yüz (eşleşme yüzü)', 'Arka yüz (kablo girişi)'];
const HC_LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZabcdefghijkmnprstuvwxyz'.split('');   /* MIL-DTL-38999 harf dizisi: I, O, Q (ve i, l, o, q) yok */
function hcDefaults(){
  const C = (id, name, col, desc) => ({id, name, col, desc});
  const cats = [C('c_com', 'Haberleşme', '#2e86de', 'Seri / ağ haberleşme hatları'), C('c_pwr', 'Güç', '#c0392b', 'Besleme ve dönüş hatları'), C('c_dis', 'Ayrık', '#8e44ad', 'Ayrık (discrete) giriş/çıkış sinyalleri'),
    C('c_ana', 'Analog', '#16a085', 'Analog ölçüm / sensör sinyalleri'), C('c_rf', 'RF', '#d35400', 'RF / koaksiyel'), C('c_vid', 'Video', '#2c3e50', 'Video hatları'), C('c_shd', 'Şasi / Ekran', '#7f8c8d', 'Şasi, ekran (shield) ve topraklama')];
  const L = (id, name, cat, dir, vmin, vmax, desc) => ({id, name, cat, dir, vmin:vmin == null ? '' : vmin, vmax:vmax == null ? '' : vmax, desc:desc || ''});
  const labels = [L('l_28v', '28V', 'c_pwr', '', 22, 32, '28 VDC besleme (MIL-STD-704)'), L('l_28r', '28V_RTN', 'c_pwr', 'rtn', 0, 0, '28 VDC dönüş'), L('l_5v', '5V', 'c_pwr', '', 4.75, 5.25),
    L('l_gnd', 'GND', 'c_pwr', 'rtn', 0, 0, 'Sinyal toprağı'), L('l_txp', 'RS422_TX+', 'c_com', 'out', -6, 6), L('l_txn', 'RS422_TX-', 'c_com', 'out', -6, 6), L('l_rxp', 'RS422_RX+', 'c_com', 'in', -6, 6), L('l_rxn', 'RS422_RX-', 'c_com', 'in', -6, 6),
    L('l_canh', 'CAN_H', 'c_com', 'bi', -2, 7), L('l_canl', 'CAN_L', 'c_com', 'bi', -2, 7), L('l_di', 'DISC_IN', 'c_dis', 'in', 0, 32), L('l_do', 'DISC_OUT', 'c_dis', 'out', 0, 32), L('l_shd', 'SHIELD', 'c_shd', 'pas')];
  const R = (a, b) => ({id:'r_' + a + '_' + b, a, b});
  const rules = [R('l_txp', 'l_rxp'), R('l_txn', 'l_rxn'), R('l_do', 'l_di')];
  const K = (id, imax, awgThick, awgThin, note) => ({id, imax, awgThick, awgThin, note});
  const contacts = [K('#22D', 5, 22, 28, 'MIL-DTL-38999 / HD D-Sub'), K('#20', 7.5, 20, 24, 'MIL-DTL-38999 / 26482'), K('#16', 13, 16, 20, 'MIL-DTL-38999 / 26482'), K('#12', 23, 12, 14, 'MIL-DTL-38999'),
    K('#8', 46, 8, 10, 'Güç kontağı'), K('D-Sub #20', 5, 20, 24, 'MIL-DTL-24308 standart yoğunluk'), K('Micro-D TwistPin', 3, 24, 30, 'MIL-DTL-83513'),
    K('Fisher Ø0.7', 4, 24, 28, 'Fisher Core S102 — yaklaşık, katalogla doğrulayın'), K('Fisher Ø0.9', 6, 22, 26, 'Fisher Core S103 — yaklaşık, katalogla doğrulayın'), K('Fisher Ø1.3', 10, 20, 24, 'Fisher Core S104 — yaklaşık, katalogla doğrulayın')];
  return {v:1, cats, labels, rules, contacts, ctypes:{}, cables:{}};
}
let HC_DEF0 = null;
function hcM(){ if(!M.hrn) M.hrn = hcDefaults(); const d = hcDefaults(); for(const k in d) if(M.hrn[k] == null) M.hrn[k] = d[k]; return M.hrn; }
const hcR = () => (M && M.hrn) || HC_DEF0 || (HC_DEF0 = hcDefaults());
/* ---------- yerleşik konnektör kütüphanesi (örnek tipler — parça numaralarını katalogla doğrulayın) ---------- */
function hcPinList(n, size, letters){ return Array.from({length:n}, (_, i) => ({no:letters ? (HC_LETTERS[i] || 'X' + (i + 1)) : String(i + 1), size})); }
const HC_LIB = (() => {
  const L = [], add = o => L.push(Object.assign({builtin:true, shape:'circ', start:'Sol üst', view:'Ön yüz (eşleşme yüzü)', custom:{}, note:'Yerleşik örnek tip — parça numarası ve kontak bilgisini üretici kataloğuyla doğrulayın.'}, o));
  const SH = {9:'A', 11:'B', 13:'C', 15:'D', 17:'E', 19:'F', 21:'G', 23:'H', 25:'J'};
  [['11-35', 13, '#22D', 0], ['13-35', 22, '#22D', 0], ['15-35', 37, '#22D', 0], ['17-35', 55, '#22D', 0], ['13-98', 10, '#20', 1], ['15-5', 5, '#16', 1]].forEach(([ins, n, size, lt]) => {
    const [sh, ar] = ins.split('-'), base = {fam:'MIL-DTL-38999 Seri III', std:'MIL-DTL-38999', mfr:'Amphenol (TV / D38999)', shell:sh, insert:ins, key:'N (normal)', lock:'Vidalı (threaded)', term:'Crimp', vmax:size === '#22D' ? 400 : 1000, tmin:-65, tmax:200, ip:'IP67 (eşleşmiş)', finish:'W — zeytin yeşili kadmiyum', backshell:'M85049 uyumlu'};
    add(Object.assign({}, base, {id:'lib:38999-20-' + ins + 'P', name:`38999 /20 duvar recep. ${ins} pin`, pn:`D38999/20W${SH[sh]}${ar}PN`, mate:`D38999/26W${SH[sh]}${ar}SN`, gender:'Erkek (pin)', body:'Receptacle — duvar flanşlı', pins:hcPinList(n, size, lt)}));
    add(Object.assign({}, base, {id:'lib:38999-24-' + ins + 'P', name:`38999 /24 jam-nut recep. ${ins} pin`, pn:`D38999/24W${SH[sh]}${ar}PN`, mate:`D38999/26W${SH[sh]}${ar}SN`, gender:'Erkek (pin)', body:'Receptacle — jam-nut', pins:hcPinList(n, size, lt)}));
    add(Object.assign({}, base, {id:'lib:38999-26-' + ins + 'S', name:`38999 /26 plug ${ins} soket`, pn:`D38999/26W${SH[sh]}${ar}SN`, mate:`D38999/20W${SH[sh]}${ar}PN`, gender:'Dişi (soket)', body:'Plug (kablo ucu)', pins:hcPinList(n, size, lt)}));
  });
  [['10-6', 6], ['14-19', 19]].forEach(([ins, n]) => {
    const [sh] = ins.split('-'), base = {fam:'MIL-DTL-26482 Seri 1', std:'MIL-DTL-26482', mfr:'Amphenol (PT / MS3100)', shell:sh, insert:ins, key:'N (normal)', lock:'Bayonet', term:'Lehim kabı', vmax:600, tmin:-55, tmax:125, ip:'IP67 (eşleşmiş)', finish:'Kadmiyum / zeytin yeşili', backshell:'MS3057 kablo kelepçesi'};
    add(Object.assign({}, base, {id:'lib:26482-12-' + ins + 'P', name:`26482 MS3112 kutu recep. ${ins} pin`, pn:`MS3112E${ins}P`, mate:`MS3116F${ins}S`, gender:'Erkek (pin)', body:'Receptacle — kutu montaj', pins:hcPinList(n, '#20', 1)}));
    add(Object.assign({}, base, {id:'lib:26482-16-' + ins + 'S', name:`26482 MS3116 plug ${ins} soket`, pn:`MS3116F${ins}S`, mate:`MS3112E${ins}P`, gender:'Dişi (soket)', body:'Plug (kablo ucu)', pins:hcPinList(n, '#20', 1)}));
  });
  [[9, 'A'], [15, 'B'], [25, 'D'], [37, 'F'], [51, 'G']].forEach(([n, c]) => {
    const base = {fam:'Micro-D MIL-DTL-83513', std:'MIL-DTL-83513', mfr:'Glenair / Amphenol / ITT Cannon', shape:'rect', shell:c, insert:String(n), key:'D gövde', lock:'Vidalı kilit (jackscrew)', term:'Tel uçlu (pigtail)', vmax:250, tmin:-55, tmax:125, ip:'—', finish:'Kadmiyum / nikel', backshell:'Micro-D backshell (M83513/05)'};
    add(Object.assign({}, base, {id:'lib:md-' + n + 'P', name:`Micro-D ${n} pin plug`, pn:`M83513/01-${c}`, mate:`M83513/02-${c}`, gender:'Erkek (pin)', body:'Plug (kablo ucu)', pins:hcPinList(n, 'Micro-D TwistPin')}));
    add(Object.assign({}, base, {id:'lib:md-' + n + 'S', name:`Micro-D ${n} soket recep.`, pn:`M83513/02-${c}`, mate:`M83513/01-${c}`, gender:'Dişi (soket)', body:'Receptacle — kutu montaj', pins:hcPinList(n, 'Micro-D TwistPin')}));
  });
  [['DE', 9, 'D-Sub #20', ''], ['DA', 15, 'D-Sub #20', ''], ['DB', 25, 'D-Sub #20', ''], ['DC', 37, 'D-Sub #20', ''], ['DD', 50, 'D-Sub #20', ''], ['DE', 15, '#22D', 'HD'], ['DA', 26, '#22D', 'HD'], ['DB', 44, '#22D', 'HD']].forEach(([sh, n, size, hd]) => {
    const base = {fam:hd ? 'D-Sub yüksek yoğunluk' : 'D-Sub MIL-DTL-24308', std:'MIL-DTL-24308', mfr:'Amphenol / ITT Cannon / Glenair', shape:'rect', shell:sh, insert:String(n) + (hd ? ' HD' : ''), key:'D gövde', lock:'Vidalı kilit (jackscrew)', term:'Crimp', vmax:hd ? 300 : 500, tmin:-55, tmax:125, ip:'—', finish:'Nikel / kadmiyum', backshell:'D-Sub EMI backshell'};
    add(Object.assign({}, base, {id:`lib:ds-${sh}${n}${hd}P`, name:`${sh}-${n}${hd ? ' HD' : ''} pin (erkek)`, pn:`${sh}${hd ? 'M' : ''}-${n}P`, mate:`${sh}${hd ? 'M' : ''}-${n}S`, gender:'Erkek (pin)', body:'Plug (kablo ucu)', pins:hcPinList(n, size)}));
    add(Object.assign({}, base, {id:`lib:ds-${sh}${n}${hd}S`, name:`${sh}-${n}${hd ? ' HD' : ''} soket (dişi)`, pn:`${sh}${hd ? 'M' : ''}-${n}S`, mate:`${sh}${hd ? 'M' : ''}-${n}P`, gender:'Dişi (soket)', body:'Receptacle — kutu montaj', pins:hcPinList(n, size)}));
  });
  [['102', 4, 'Fisher Ø0.7'], ['103', 7, 'Fisher Ø0.9'], ['104', 12, 'Fisher Ø1.3']].forEach(([s, n, size]) => {
    const base = {fam:'Fisher Core Series', std:'Üretici standardı', mfr:'Fisher Connectors', shell:'S' + s, insert:n + ' kontak', key:'Kılavuz kanal', lock:'Push-pull', term:'Lehim kabı', vmax:250, tmin:-55, tmax:135, ip:'IP68 (eşleşmiş)', finish:'Krom / siyah krom', backshell:'Kablo kelepçeli gövde'};
    add(Object.assign({}, base, {id:`lib:fi-${s}-${n}S`, name:`Fisher S${s} ${n} kontak plug`, pn:`S ${s} A0xx (doğrulayın)`, mate:`DEE ${s} A0xx`, gender:'Erkek (pin)', body:'Plug (kablo ucu)', pins:hcPinList(n, size)}));
    add(Object.assign({}, base, {id:`lib:fi-${s}-${n}R`, name:`Fisher DEE${s} ${n} kontak panel recep.`, pn:`DEE ${s} A0xx (doğrulayın)`, mate:`S ${s} A0xx`, gender:'Dişi (soket)', body:'Receptacle — duvar flanşlı', pins:hcPinList(n, size)}));
  });
  return L;
})();
const HC_LIB_IDX = Object.fromEntries(HC_LIB.map(t => [t.id, t]));
const hcType = id => (id && ((M && M.hrn && M.hrn.ctypes[id]) || HC_LIB_IDX[id])) || null;
const hcTypes = () => HC_LIB.concat(Object.values(hcR().ctypes || {})).sort((a, b) => (a.fam || '').localeCompare(b.fam || '', 'tr') || (a.name || '').localeCompare(b.name || '', 'tr', {numeric:true}));
const hcCat = id => hcR().cats.find(c => c.id === id) || null;
const hcLabel = id => hcR().labels.find(l => l.id === id) || null;
const hcContact = id => hcR().contacts.find(c => c.id === id) || null;
const hcIsConn = e => !!(e && e.kind === 'Port' && e.hc);
const hcUnitConns = uid0 => kidsOf(uid0).filter(hcIsConn).sort((a, b) => String(a.name).localeCompare(String(b.name), 'tr', {numeric:true}));
const hcUnits = () => Object.values(M.els).filter(e => e.kind === 'Block' && (e.hcUnit || kidsOf(e.id).some(hcIsConn))).sort(sortEls);
/* port pin listesi: tipin kontak listesi sırasıyla, tipte olmayan dolu pinler sonda */
function hcPins(port){
  const t = hcType(port.hc && port.hc.ct), P = (port.hc && port.hc.pins) || {}, out = (t ? t.pins || [] : []).map(c => ({no:c.no, size:c.size, d:P[c.no] || {}}));
  Object.keys(P).forEach(no => { if(!out.some(x => x.no === no) && hcPinUsed(P[no])) out.push({no, size:'', d:P[no], orphan:true}); });
  return out;
}
const hcPinUsed = d => !!(d && (d.sig || d.lbl || d.cat || d.dir || d.note || d.inom || d.ipk));
const hcPinCat = d => (d && d.lbl && hcLabel(d.lbl) ? hcLabel(d.lbl).cat : d && d.cat) || '';
const hcNum = v => v === '' || v == null ? null : numOf(v);
/* ---------- pin denetimi (tek pin) ve pin-pin uyumluluk (kablajda kullanılır) ---------- */
function hcPinIssues(port, p){
  const d = p.d, out = []; if(!hcPinUsed(d)) return out;
  const k = hcContact(p.size), ip = Math.max(hcNum(d.ipk) || 0, hcNum(d.inom) || 0);
  if(k && ip > k.imax) out.push(['hata', `Akım ${ip} A, ${p.size} kontak sınırı ${k.imax} A`]);
  if(hcNum(d.vmin) != null && hcNum(d.vmax) != null && hcNum(d.vmin) > hcNum(d.vmax)) out.push(['hata', 'Gerilim min > maks']);
  const t = hcType(port.hc.ct), vx = t && hcNum(t.vmax); if(vx != null){ const v = Math.max(Math.abs(hcNum(d.vmin) || 0), Math.abs(hcNum(d.vmax) || 0)); if(v > vx) out.push(['uyarı', `Gerilim ${v} V, konnektör çalışma gerilimi ${vx} V`]); }
  if(d.pair){ const q = (port.hc.pins || {})[d.pair]; if(!q) out.push(['uyarı', `Çift eşi pin ${d.pair} tanımsız`]); else if(q.pair !== p.no) out.push(['uyarı', `Çift eşi pin ${d.pair}, karşılığı bu pini göstermiyor`]); }
  if(p.orphan) out.push(['uyarı', 'Konnektör tipinde bu pin yok']);
  const cc = hcPinCat(d), pc = port.hc.cat; if(cc && pc && cc !== pc && !/c_shd/.test(cc)) out.push(['bilgi', `Hat tipi (${(hcCat(cc) || {}).name || cc}) arayüz türünden (${(hcCat(pc) || {}).name || pc}) farklı`]);
  return out;
}
function hcRange(d){ const a = hcNum(d.vmin), b = hcNum(d.vmax); return a == null && b == null ? null : [a == null ? -Infinity : a, b == null ? Infinity : b]; }
/* iki pin birbirine bağlanırsa: [[önem, mesaj]…] — boş liste uyumlu demektir */
function hcPinCompat(a, b){
  const out = []; a = a || {}; b = b || {};
  const ua = hcPinUsed(a), ub = hcPinUsed(b);
  if(!ua && !ub) return out;
  if(!ua || !ub) return [['uyarı', 'Bir uç tanımsız (boş pin)']];
  const ca = hcPinCat(a), cb = hcPinCat(b);
  if(ca && cb && ca !== cb) out.push(['hata', `Hat tipi uyuşmuyor: ${(hcCat(ca) || {}).name || ca} ↔ ${(hcCat(cb) || {}).name || cb}`]);
  if(a.lbl && b.lbl && a.lbl !== b.lbl && !hcR().rules.some(r => (r.a === a.lbl && r.b === b.lbl) || (r.a === b.lbl && r.b === a.lbl))) out.push(['uyarı', `Etiket eşleşmiyor: ${(hcLabel(a.lbl) || {}).name} ↔ ${(hcLabel(b.lbl) || {}).name}`]);
  const ra = hcRange(a), rb = hcRange(b);
  if(ra && rb && (ra[1] < rb[0] || rb[1] < ra[0])) out.push(['hata', `Gerilim aralıkları örtüşmüyor: ${hcRangeTxt(a)} ↔ ${hcRangeTxt(b)}`]);
  const da = a.dir || (a.lbl && (hcLabel(a.lbl) || {}).dir) || '', db = b.dir || (b.lbl && (hcLabel(b.lbl) || {}).dir) || '';
  if((da === 'out' && db === 'out') || (da === 'src' && db === 'src')) out.push(['hata', 'İki çıkış / iki kaynak birbirine bağlanıyor']);
  else if(da === 'in' && db === 'in') out.push(['uyarı', 'İki giriş birbirine bağlanıyor (sürücü yok)']);
  else if((da === 'src' && db === 'out') || (da === 'out' && db === 'src')) out.push(['hata', 'Güç kaynağı sinyal çıkışına bağlanıyor']);
  return out;
}
const hcRangeTxt = d => { const a = hcNum(d.vmin), b = hcNum(d.vmax); return a == null && b == null ? '—' : (a == null ? '…' : a) + '–' + (b == null ? '…' : b) + ' V'; };
/* konnektör özeti: dolu pin, hat tipi sayıları, sorunlar */
function hcConnStats(port){
  const pins = hcPins(port), used = pins.filter(p => hcPinUsed(p.d)), byCat = {}, iss = [];
  used.forEach(p => { const c = hcPinCat(p.d) || ''; byCat[c] = (byCat[c] || 0) + 1; hcPinIssues(port, p).forEach(x => iss.push([x[0], 'Pin ' + p.no + ': ' + x[1]])); });
  if(!port.hc.ct) iss.unshift(['uyarı', 'Konnektör tipi seçilmemiş']);
  return {pins, used, byCat, iss, total:pins.length};
}
/* ---------- görünüm durumu ---------- */
const HC = {tab:'types', sel:'', q:'', unit:'', port:''};
const hcOpt = (v, l, cur) => `<option value="${esc(v)}"${String(v) === String(cur == null ? '' : cur) ? ' selected' : ''}>${esc(l)}</option>`;
const hcChip = c => c ? `<span class="hcchip" style="background:${esc(c.col || '#888')}">${esc(c.name)}</span>` : '';
const hcSev = s => s === 'hata' ? '✖' : s === 'uyarı' ? '⚠' : 'ℹ';
(() => { const st = document.createElement('style'); st.textContent = `
.hcwrap{display:flex;gap:14px;align-items:flex-start;padding:10px}.hclist{width:300px;flex:none;max-height:calc(100vh - 190px);overflow:auto;border:1px solid var(--bd,#ccd);border-radius:6px}
.hclist .hcg{font-weight:600;font-size:11px;padding:6px 8px;background:var(--hd,#eef1f6);position:sticky;top:0}.hclist .hci{padding:4px 8px 4px 14px;cursor:pointer;font-size:12px;border-top:1px solid transparent}
.hclist .hci:hover{background:#eef5ff}.hclist .hci.on{background:#d6e8ff;font-weight:600}.hclist .hci small{color:#888;margin-left:4px}.hcmain{flex:1;min-width:0}
.hcform{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:6px 14px;margin:8px 0}.hcform label{display:flex;flex-direction:column;font-size:11px;color:#667}.hcform input,.hcform select{font-size:12px;padding:3px 4px}
.hcchip{display:inline-block;color:#fff;border-radius:9px;padding:0 7px;font-size:11px;line-height:17px;margin-right:4px;white-space:nowrap}
.hccards{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.hccard{border:1px solid #ccd;border-radius:6px;padding:6px 10px;cursor:pointer;min-width:170px;font-size:12px;background:var(--bg,#fff)}
.hccard.on{border-color:#2e86de;box-shadow:0 0 0 2px #2e86de55}.hccard b{font-size:13px}.hccard .muted{font-size:11px}
table.hcpt{border-collapse:collapse;font-size:12px}table.hcpt th{background:var(--hd,#eef1f6);position:sticky;top:0;font-weight:600;padding:3px 5px;text-align:left;white-space:nowrap}
table.hcpt td{border-top:1px solid #e3e6ec;padding:1px 3px}table.hcpt input,table.hcpt select{font-size:12px;border:1px solid transparent;background:transparent;padding:2px 3px;width:100%;box-sizing:border-box}
table.hcpt input:hover,table.hcpt select:hover,table.hcpt input:focus,table.hcpt select:focus{border-color:#9ab}table.hcpt tr.unused td{color:#999}table.hcpt td.iss{font-size:11px;white-space:nowrap}
.hcimg{max-width:220px;max-height:160px;border:1px solid #ccd;border-radius:4px;display:block;margin:4px 0}.hcsec{margin:14px 0 4px;font-weight:600;font-size:13px}
`; document.head.appendChild(st); })();
/* ---------- kütüphane görünümü: tipler, hat tipleri/etiketler/kurallar, kontak boyutları ---------- */
const HC_TF = [['name', 'Ad'], ['fam', 'Aile / seri', 'fam'], ['std', 'Standart'], ['mfr', 'Üretici'], ['pn', 'Parça no'], ['mate', 'Eşleşen konnektör PN'], ['shell', 'Kabuk boyutu'], ['insert', 'Insert düzeni'],
  ['gender', 'Kontak cinsiyeti', HC_GENDERS], ['body', 'Gövde tipi', HC_BODIES], ['key', 'Kutuplama / keying'], ['lock', 'Kilit tipi', HC_LOCKS], ['term', 'Kontak sonlandırma', HC_TERMS],
  ['vmax', 'Maks. çalışma gerilimi (V)'], ['tmin', 'Sıcaklık min (°C)'], ['tmax', 'Sıcaklık maks (°C)'], ['ip', 'Sızdırmazlık / IP'], ['finish', 'Kaplama'], ['backshell', 'Backshell / EMI'], ['weight', 'Ağırlık (g)'],
  ['shape', 'Gövde şekli', [['circ', 'Dairesel'], ['rect', 'Dikdörtgen']]], ['view', 'Pin numaraları hangi yüzden', HC_VIEWS], ['start', 'Numaralandırma başlangıcı', HC_START], ['rows', 'Pin satır sayısı (çizim)'], ['note', 'Not']];
function hcLibBar(){
  const tab = (k, t) => `<button class="vb${HC.tab === k ? ' pri' : ''}" data-hca="tab" data-k="${k}">${t}</button>`;
  return `${tab('types', 'Konnektör tipleri')}${tab('labels', 'Hat tipleri ve etiketler')}${tab('contacts', 'Kontak boyutları')}<span class="vsep"></span>` +
    (HC.tab === 'types' ? `<button class="vb pri" data-hca="tnew">+ Yeni tip</button><button class="vb" data-hca="tcopy" title="Seçili tipi düzenlenebilir kopya olarak çoğalt">Kopyala</button><button class="vb" data-hca="tdel">Sil</button><input data-hcf="q" placeholder="Ara (ad, PN, aile)" value="${esc(HC.q)}">`
      : HC.tab === 'labels' ? `<button class="vb pri" data-hca="lnew">+ Etiket</button><button class="vb" data-hca="cnew">+ Hat tipi</button><button class="vb" data-hca="rnew">+ Eşleşme kuralı</button>` : `<button class="vb pri" data-hca="knew">+ Kontak boyutu</button>`);
}
function hcLibHTML(){ return HC.tab === 'labels' ? hcLabelsHTML() : HC.tab === 'contacts' ? hcContactsHTML() : hcTypesHTML(); }
function hcTypesHTML(){
  const q = HC.q.toLowerCase(), all = hcTypes().filter(t => !q || [t.name, t.pn, t.fam, t.mfr].join(' ').toLowerCase().includes(q));
  if(!HC.sel || !hcType(HC.sel)) HC.sel = all[0] ? all[0].id : '';
  let fam = null, list = '';
  all.forEach(t => { if(t.fam !== fam){ fam = t.fam; list += `<div class="hcg">${esc(fam || 'Diğer')}</div>`; } list += `<div class="hci${t.id === HC.sel ? ' on' : ''}" data-hcsel="${esc(t.id)}">${esc(t.name)}<small>${(t.pins || []).length} pin${t.builtin ? '' : ' · kullanıcı'}</small></div>`; });
  const t = hcType(HC.sel); if(!t) return `<div class="hcwrap"><div class="hclist">${list || '<div class="hci">Tip yok</div>'}</div><div class="hcmain muted">Soldan bir tip seçin veya <b>+ Yeni tip</b> ile oluşturun.</div></div>`;
  const ro = !!t.builtin, dis = ro ? ' disabled' : '', fams = [...new Set(hcTypes().map(x => x.fam).filter(Boolean))];
  const fld = ([k, l, o]) => `<label>${esc(l)}${Array.isArray(o) ? `<select data-hct="${k}"${dis}>${hcOpt('', '—', t[k])}${o.map(x => Array.isArray(x) ? hcOpt(x[0], x[1], t[k]) : hcOpt(x, x, t[k])).join('')}</select>` : `<input data-hct="${k}" value="${esc(t[k] == null ? '' : t[k])}"${o === 'fam' ? ' list="hcFams"' : ''}${dis}>`}</label>`;
  const used = Object.values(M.els).filter(e => hcIsConn(e) && e.hc.ct === t.id);
  const sizes = hcR().contacts, cnt = {}; (t.pins || []).forEach(p => cnt[p.size] = (cnt[p.size] || 0) + 1);
  return `<div class="hcwrap"><div class="hclist">${list}</div><div class="hcmain">
    <h3 style="margin:0">${esc(t.name)} ${ro ? '<span class="muted" style="font-size:12px;font-weight:normal">(yerleşik, salt okunur — düzenlemek için <b>Kopyala</b>)</span>' : ''}</h3>
    <div class="muted" style="font-size:12px">${(t.pins || []).length} kontak: ${Object.entries(cnt).map(([k, v]) => v + ' × ' + esc(k || '?')).join(', ') || '—'} · ${used.length} arayüzde kullanılıyor</div>
    <datalist id="hcFams">${fams.map(f => `<option value="${esc(f)}">`).join('')}</datalist>
    <div class="hcform">${HC_TF.map(fld).join('')}</div>
    <div class="hcsec">Resim</div>${t.img ? `<img class="hcimg" src="${esc(t.img)}" alt="">` : '<div class="muted" style="font-size:12px">Resim yok</div>'}${ro ? '' : `<button class="vb" data-hca="img">Resim yükle…</button>${t.img ? '<button class="vb" data-hca="imgdel">Kaldır</button>' : ''}`}
    <div class="hcsec">Ek özellikler</div>
    <table class="hcpt"><thead><tr><th>Özellik</th><th>Değer</th><th></th></tr></thead><tbody>${Object.entries(t.custom || {}).map(([k, v], i) => `<tr><td><input data-hcx="k|${i}" value="${esc(k)}"${dis}></td><td><input data-hcx="v|${i}" value="${esc(v)}"${dis}></td><td>${ro ? '' : `<button class="vb" data-hca="xdel" data-i="${i}">✕</button>`}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">—</td></tr>'}</tbody></table>
    ${ro ? '' : '<button class="vb" data-hca="xadd">+ Özellik</button>'}
    <div class="hcsec">Kontaklar</div>
    ${ro ? '' : `<div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap;font-size:12px;margin-bottom:6px"><label>Pin sayısı <input id="hcGenN" type="number" min="1" max="400" value="${(t.pins || []).length || 10}" style="width:60px"></label>
      <label>Numaralandırma <select id="hcGenL">${hcOpt('0', 'Sayısal (1, 2, 3…)', '0')}${hcOpt('1', 'Harf (A, B, C… I/O/Q yok)', '')}</select></label>
      <label>Kontak boyutu <select id="hcGenS">${sizes.map(k => hcOpt(k.id, k.id + ' (' + k.imax + ' A)', '#20')).join('')}</select></label><button class="vb" data-hca="gen" title="Kontak listesini yeniden oluşturur; aynı numaralı pinlerin bilgileri arayüzlerde korunur">Listeyi oluştur</button></div>`}
    <div style="max-height:320px;overflow:auto;display:inline-block"><table class="hcpt"><thead><tr><th>Pin</th><th>Kontak boyutu</th><th>Maks. akım</th><th>AWG aralığı</th>${ro ? '' : '<th></th>'}</tr></thead><tbody>
      ${(t.pins || []).map((p, i) => { const k = hcContact(p.size); return `<tr><td><input data-hcpn="no|${i}" value="${esc(p.no)}" style="width:50px"${dis}></td><td><select data-hcpn="size|${i}"${dis}>${hcOpt('', '—', p.size)}${sizes.map(x => hcOpt(x.id, x.id, p.size)).join('')}</select></td><td>${k ? k.imax + ' A' : ''}</td><td>${k ? k.awgThick + '–' + k.awgThin : ''}</td>${ro ? '' : `<td><button class="vb" data-hca="pdel" data-i="${i}">✕</button></td>`}</tr>`; }).join('')}
    </tbody></table></div>${ro ? '' : '<div><button class="vb" data-hca="padd">+ Pin</button></div>'}
  </div></div>`;
}
function hcLabelsHTML(){
  const H = hcR(), catSel = (attr, v) => `<select ${attr}>${hcOpt('', '—', v)}${H.cats.map(c => hcOpt(c.id, c.name, v)).join('')}</select>`;
  const lblSel = (attr, v) => `<select ${attr}>${hcOpt('', '—', v)}${H.labels.map(l => hcOpt(l.id, l.name, v)).join('')}</select>`;
  const useL = id => Object.values(M.els).filter(hcIsConn).reduce((n, p) => n + Object.values(p.hc.pins || {}).filter(d => d.lbl === id).length, 0);
  return `<div style="padding:10px">
    <p class="muted" style="font-size:12px;margin:0 0 8px">Hat tipleri arayüzlerin ve pinlerin sınıfıdır (özetler ve mimari görünümleri bunlara göre süzülür). Etiketler pinlere atanır; kablajda aynı etiketli pinler veya bir eşleşme kuralıyla eşlenen etiketler doğru bağlantı sayılır, farklı hat tipleri hata olarak işaretlenir.</p>
    <div class="hcsec">Hat tipleri</div>
    <table class="hcpt"><thead><tr><th>Ad</th><th>Renk</th><th>Açıklama</th><th></th></tr></thead><tbody>${H.cats.map((c, i) => `<tr><td><input data-hcc="name|${i}" value="${esc(c.name)}"></td><td><input type="color" data-hcc="col|${i}" value="${esc(c.col || '#888888')}" style="width:44px;padding:0"></td><td><input data-hcc="desc|${i}" value="${esc(c.desc || '')}" style="min-width:280px"></td><td><button class="vb" data-hca="cdel" data-i="${i}">✕</button></td></tr>`).join('')}</tbody></table>
    <div class="hcsec">Etiketler</div>
    <table class="hcpt"><thead><tr><th>Etiket</th><th>Hat tipi</th><th>Varsayılan yön</th><th>V min</th><th>V maks</th><th>Açıklama</th><th>Kullanım</th><th></th></tr></thead><tbody>${H.labels.map((l, i) => `<tr><td><input data-hcl="name|${i}" value="${esc(l.name)}"></td><td>${catSel(`data-hcl="cat|${i}"`, l.cat)}</td><td><select data-hcl="dir|${i}">${HC_DIRS.map(([v, t]) => hcOpt(v, t, l.dir)).join('')}</select></td><td><input data-hcl="vmin|${i}" value="${esc(l.vmin)}" style="width:60px"></td><td><input data-hcl="vmax|${i}" value="${esc(l.vmax)}" style="width:60px"></td><td><input data-hcl="desc|${i}" value="${esc(l.desc || '')}" style="min-width:200px"></td><td>${useL(l.id)} pin</td><td><button class="vb" data-hca="ldel" data-i="${i}">✕</button></td></tr>`).join('')}</tbody></table>
    <div class="hcsec">Eşleşme kuralları <span class="muted" style="font-weight:normal;font-size:12px">— aynı etiket her zaman eşleşir; farklı etiketli uçlar için (ör. RS422_TX+ ↔ RS422_RX+)</span></div>
    <table class="hcpt"><thead><tr><th>Etiket</th><th></th><th>Karşı uç etiketi</th><th></th></tr></thead><tbody>${H.rules.map((r, i) => `<tr><td>${lblSel(`data-hcr="a|${i}"`, r.a)}</td><td>↔</td><td>${lblSel(`data-hcr="b|${i}"`, r.b)}</td><td><button class="vb" data-hca="rdel" data-i="${i}">✕</button></td></tr>`).join('') || '<tr><td colspan="4" class="muted">Kural yok</td></tr>'}</tbody></table>
  </div>`;
}
function hcContactsHTML(){
  const K = hcR().contacts;
  return `<div style="padding:10px"><p class="muted" style="font-size:12px;margin:0 0 8px">Pin akımı kontak sınırını aşarsa uyarı verilir; AWG aralığı kablaj tel önerisinde üst/alt sınırdır (kalın = küçük AWG numarası). Değerler örnektir, kullandığınız kontak kataloğuyla güncelleyin.</p>
    <table class="hcpt"><thead><tr><th>Kontak boyutu</th><th>Maks. akım (A)</th><th>En kalın AWG</th><th>En ince AWG</th><th>Not</th><th></th></tr></thead><tbody>${K.map((k, i) => `<tr><td><input data-hck="id|${i}" value="${esc(k.id)}"></td><td><input data-hck="imax|${i}" value="${esc(k.imax)}" style="width:70px"></td><td><input data-hck="awgThick|${i}" value="${esc(k.awgThick)}" style="width:60px"></td><td><input data-hck="awgThin|${i}" value="${esc(k.awgThin)}" style="width:60px"></td><td><input data-hck="note|${i}" value="${esc(k.note || '')}" style="min-width:260px"></td><td><button class="vb" data-hca="kdel" data-i="${i}">✕</button></td></tr>`).join('')}</tbody></table></div>`;
}
/* ---------- birim arayüzleri ve pinout görünümü ---------- */
function hcUnitBar(){
  const us = hcUnits(), others = Object.values(M.els).filter(e => e.kind === 'Block' && !us.includes(e)).sort(sortEls);
  if(HC.unit && !E(HC.unit)) HC.unit = '';
  return `<label>Birim <select data-hcf="unit" class="noi18n">${hcOpt('', '— seçin —', HC.unit)}${us.length ? `<optgroup label="Birimler">${us.map(u => hcOpt(u.id, u.name, HC.unit)).join('')}</optgroup>` : ''}${others.length ? `<optgroup label="Diğer bloklar">${others.map(u => hcOpt(u.id, u.name, HC.unit)).join('')}</optgroup>` : ''}</select></label>
    <button class="vb pri" data-hca="unew">+ Yeni birim</button><button class="vb pri2" data-hca="padd2"${HC.unit ? '' : ' disabled'}>+ Arayüz (konnektör)</button><span class="vsep"></span>
    <button class="vb" data-hca="xl" title="Seçili birimin (seçili değilse tüm birimlerin) pinout tablosu">Pinout Excel</button><button class="vb" data-hca="lib">Konnektör kütüphanesi</button>`;
}
function hcUnitHTML(){
  const u = E(HC.unit);
  if(!u){
    const us = hcUnits();
    return `<div style="padding:12px"><p class="muted" style="font-size:12px">Bir birim seçin veya <b>+ Yeni birim</b> ile oluşturun. Her birime arayüzlerini (konnektörlerini) ekleyip tiplerini seçin, sonra pinout tablosunu doldurun.</p>
      <div class="hccards">${us.map(x => { const cs = hcUnitConns(x.id); return `<div class="hccard" data-hcunit="${x.id}"><b class="noi18n">${esc(x.name)}</b><div class="muted">${cs.length} arayüz · ${cs.reduce((n, p) => n + hcConnStats(p).used.length, 0)} dolu pin</div></div>`; }).join('') || '<span class="muted">Henüz birim yok.</span>'}</div></div>`;
  }
  const cs = hcUnitConns(u.id); if(!cs.find(p => p.id === HC.port)) HC.port = cs[0] ? cs[0].id : '';
  const tot = {}; cs.forEach(p => { const s = hcConnStats(p); Object.entries(s.byCat).forEach(([k, v]) => tot[k] = (tot[k] || 0) + v); });
  let h = `<div style="padding:10px"><div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap"><h3 style="margin:0" class="noi18n">${esc(u.name)}</h3><span class="muted" style="font-size:12px">${cs.length} arayüz</span>${Object.entries(tot).map(([k, v]) => { const c = hcCat(k); return c ? hcChip({name:c.name + ' ' + v, col:c.col}) : `<span class="hcchip" style="background:#999">Tipsiz ${v}</span>`; }).join('')}</div>`;
  h += `<div class="hccards">${cs.map(p => { const s = hcConnStats(p), t = hcType(p.hc.ct), nE = s.iss.filter(x => x[0] === 'hata').length, nW = s.iss.filter(x => x[0] === 'uyarı').length;
    return `<div class="hccard${p.id === HC.port ? ' on' : ''}" data-hcport="${p.id}"><b class="noi18n">${esc(p.name)}</b> ${hcChip(hcCat(p.hc.cat))}<div class="muted noi18n">${esc(t ? t.name : 'tip seçilmedi')}</div><div class="muted">${s.used.length} / ${s.total} pin dolu${nE ? ` · <span style="color:#c0392b">${nE} hata</span>` : ''}${nW ? ` · <span style="color:#b9770e">${nW} uyarı</span>` : ''}</div></div>`; }).join('') || '<span class="muted" style="font-size:12px">Bu birimin arayüzü yok — <b>+ Arayüz (konnektör)</b> ile ekleyin.</span>'}</div>`;
  const p = E(HC.port); if(p) h += hcPortHTML(p);
  return h + '</div>';
}
function hcPortHTML(p){
  const H = hcR(), t = hcType(p.hc.ct), s = hcConnStats(p), types = hcTypes();
  let fam = null, topts = hcOpt('', '— tip seçin —', p.hc.ct);
  types.forEach(x => { if(x.fam !== fam){ if(fam !== null) topts += '</optgroup>'; fam = x.fam; topts += `<optgroup label="${esc(fam || 'Diğer')}">`; } topts += hcOpt(x.id, x.name + (x.pn ? ' — ' + x.pn : ''), p.hc.ct); }); if(fam !== null) topts += '</optgroup>';
  const lblOpts = v => { let o = hcOpt('', '—', v); H.cats.forEach(c => { const ls = H.labels.filter(l => l.cat === c.id); if(ls.length) o += `<optgroup label="${esc(c.name)}">${ls.map(l => hcOpt(l.id, l.name, v)).join('')}</optgroup>`; }); const nc = H.labels.filter(l => !hcCat(l.cat)); if(nc.length) o += `<optgroup label="Tipsiz">${nc.map(l => hcOpt(l.id, l.name, v)).join('')}</optgroup>`; return o + hcOpt('__new', '+ Yeni etiket…', ''); };
  let h = `<div class="hcform" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">
    <label>Arayüz adı (referans)<input data-hcq="name" value="${esc(p.name)}" class="noi18n"></label>
    <label>Konnektör tipi<select data-hcq="ct">${topts}</select></label>
    <label>Arayüz türü<select data-hcq="cat">${hcOpt('', '—', p.hc.cat)}${H.cats.map(c => hcOpt(c.id, c.name, p.hc.cat)).join('')}</select></label>
    <label>Açıklama<input data-hcq="desc" value="${esc(p.hc.desc || '')}"></label></div>
    <div style="font-size:12px;margin:-2px 0 6px">${t ? `<span class="muted">${esc([t.pn, t.gender, t.body, t.shell && 'kabuk ' + t.shell, t.lock].filter(Boolean).join(' · '))}</span> ` : ''}<button class="vb" data-hca="ptype"${t ? '' : ' disabled'}>Tipi kütüphanede aç</button> <button class="vb" data-hca="pdup">Arayüzü çoğalt</button> <button class="vb" data-hca="pclr">Pinout'u temizle</button> <button class="vb" data-hca="prm" style="color:#c0392b">Arayüzü sil</button></div>`;
  if(s.iss.length) h += `<div class="gaps" style="background:#fdf6ec;border:1px solid #f0d9b5;color:#7a4b0b;font-size:12px;padding:5px 8px;border-radius:4px;margin-bottom:6px;max-height:90px;overflow:auto">${s.iss.map(([sv, m]) => hcSev(sv) + ' ' + esc(m)).join('<br>')}</div>`;
  if(!t && !s.pins.length) return h + '<p class="muted" style="font-size:12px">Pinout girmek için önce konnektör tipini seçin. Listede yoksa <b>Konnektör kütüphanesi → + Yeni tip</b> ile oluşturun.</p>';
  const cols = ['Pin', 'Kontak', 'Sinyal adı', 'Etiket', 'Hat tipi', 'Yön', 'V min', 'V maks', 'I nom (A)', 'I tepe (A)', 'Çift eşi', 'Ekranlı', 'Not', 'Durum'];
  h += `<div style="max-height:calc(100vh - 330px);overflow:auto"><table class="hcpt"><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>`;
  s.pins.forEach(pp => {
    const d = pp.d, a = f => `data-hcp="${esc(pp.no)}|${f}"`, iss = hcPinIssues(p, pp), lb = d.lbl && hcLabel(d.lbl), cat = hcCat(hcPinCat(d));
    h += `<tr class="${hcPinUsed(d) ? '' : 'unused'}"><td><b>${esc(pp.no)}</b></td><td>${esc(pp.size || '')}</td><td><input ${a('sig')} value="${esc(d.sig || '')}" style="min-width:110px" class="noi18n"></td>
      <td><select ${a('lbl')} style="min-width:110px">${lblOpts(d.lbl)}</select></td>
      <td>${lb ? hcChip(cat) || '<span class="muted">—</span>' : `<select ${a('cat')}>${hcOpt('', '—', d.cat)}${H.cats.map(c => hcOpt(c.id, c.name, d.cat)).join('')}</select>`}</td>
      <td><select ${a('dir')}>${HC_DIRS.map(([v, tx]) => hcOpt(v, tx, d.dir)).join('')}</select></td>
      <td><input ${a('vmin')} value="${esc(d.vmin == null ? '' : d.vmin)}" style="width:52px"></td><td><input ${a('vmax')} value="${esc(d.vmax == null ? '' : d.vmax)}" style="width:52px"></td>
      <td><input ${a('inom')} value="${esc(d.inom == null ? '' : d.inom)}" style="width:52px"></td><td><input ${a('ipk')} value="${esc(d.ipk == null ? '' : d.ipk)}" style="width:52px"></td>
      <td><input ${a('pair')} value="${esc(d.pair || '')}" style="width:46px"></td><td style="text-align:center"><input type="checkbox" ${a('shield')}${d.shield ? ' checked' : ''} style="width:auto"></td>
      <td><input ${a('note')} value="${esc(d.note || '')}" style="min-width:120px"></td><td class="iss" title="${esc(iss.map(x => x[1]).join('\n'))}">${iss.map(x => `<span style="color:${x[0] === 'hata' ? '#c0392b' : x[0] === 'uyarı' ? '#b9770e' : '#2e86de'}">${hcSev(x[0])}</span>`).join(' ')}</td></tr>`;
  });
  return h + '</tbody></table></div><p class="muted" style="font-size:11px">Etiket seçildiğinde boş olan yön ve gerilim alanları etiketin varsayılanlarıyla dolar. Çift eşi: diferansiyel çiftin diğer pini (ör. TX+ için TX- pin no). Etiket yoksa hat tipini doğrudan seçebilirsiniz.</p>';
}
/* ---------- işlemler ---------- */
function hcNewPort(unitId, name){
  const n = hcUnitConns(unitId).length + 1, p = mk('Port', unitId, {name:name || 'J' + n, hc:{ct:'', cat:'', desc:'', pins:{}}});
  return p;
}
function hcNewUnit(name, pkg){ const b = mk('Block', pkg || nearestPkg(ST.tsel || M.rootId), {name:name || 'Birim'}); b.hcUnit = true; return b; }
function hcSetPin(port, no, f, v){
  const P = port.hc.pins = port.hc.pins || {}, d = P[no] = Object.assign({}, P[no] || {});
  if(f === 'shield') d.shield = !!v; else if(['vmin', 'vmax', 'inom', 'ipk'].includes(f)) d[f] = v === '' ? '' : (numOf(v) == null ? d[f] : numOf(v)); else d[f] = v;
  if(f === 'lbl' && v){ const l = hcLabel(v); if(l){ if(!d.dir && l.dir) d.dir = l.dir; if((d.vmin === '' || d.vmin == null) && l.vmin !== '') d.vmin = l.vmin; if((d.vmax === '' || d.vmax == null) && l.vmax !== '') d.vmax = l.vmax; if(!d.sig) d.sig = l.name; } delete d.cat; }
  if(f === 'pair' && v && P[v] && !P[v].pair){ P[v] = Object.assign({}, P[v], {pair:no}); }
  if(!hcPinUsed(d) && !d.vmin && !d.vmax && !d.pair && !d.shield) delete P[no];
}
function hcPinoutRows(units){
  const rows = [['Birim', 'Arayüz', 'Arayüz türü', 'Konnektör tipi', 'Parça no', 'Pin', 'Kontak', 'Sinyal adı', 'Etiket', 'Hat tipi', 'Yön', 'V min', 'V maks', 'I nom (A)', 'I tepe (A)', 'Çift eşi', 'Ekranlı', 'Not', 'Denetim'].map(v => ({v, s:1}))];
  units.forEach(u => hcUnitConns(u.id).forEach(p => { const t = hcType(p.hc.ct); hcPins(p).forEach(pp => { const d = pp.d, c = hcCat(hcPinCat(d)); rows.push([u.name, p.name, (hcCat(p.hc.cat) || {}).name || '', t ? t.name : '', t ? t.pn || '' : '', pp.no, pp.size || '', d.sig || '', (hcLabel(d.lbl) || {}).name || '', c ? c.name : '', (HC_DIRS.find(x => x[0] === (d.dir || '')) || ['', ''])[1].replace('—', ''), d.vmin == null ? '' : d.vmin, d.vmax == null ? '' : d.vmax, d.inom == null ? '' : d.inom, d.ipk == null ? '' : d.ipk, d.pair || '', d.shield ? 'Evet' : '', d.note || '', hcPinIssues(p, pp).map(x => x[1]).join('; ')]); }); }));
  return rows;
}
function hcPinoutXlsx(){
  const u = E(HC.unit), units = u ? [u] : hcUnits(); if(!units.length) return toast('Birim yok');
  const rows = hcPinoutRows(units); if(rows.length < 2) return toast('Pinout boş');
  download(buildXlsx([{name:'Pinout', rows, widths:[18, 10, 12, 26, 22, 6, 10, 18, 14, 12, 12, 7, 7, 8, 8, 8, 7, 20, 40], header:true, freeze:[1, 0]}]), fileSafe((u ? u.name : 'Birimler') + ' - pinout') + '.xlsx');
}
function hcImgPick(t){
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => { const f = inp.files && inp.files[0]; if(!f) return; const r = new FileReader();
    r.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, 480 / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
      snap(); t.img = cv.toDataURL(/png/i.test(f.type) ? 'image/png' : 'image/jpeg', 0.85); afterChange(); renderView(); }; im.src = r.result; };
    r.readAsDataURL(f); };
  inp.click();
}
function hcUserType(id){ const H = hcM(); return H.ctypes[id] || null; }
function hcCopyType(t){ const H = hcM(), c = JSON.parse(JSON.stringify(t)); c.id = 'ct' + uid(); delete c.builtin; c.name = t.name + (t.builtin ? '' : ' (kopya)'); c.note = t.builtin ? '' : c.note; H.ctypes[c.id] = c; return c; }
const hcLibMenu = () => [{t:'Konnektör kütüphanesi', f:() => { HC.tab = 'types'; openD('@hclib'); }}, {t:'Hat tipleri ve etiketler', f:() => { HC.tab = 'labels'; openD('@hclib'); }}, {t:'Birim arayüzleri ve pinout', f:() => openD('@hcunits')}];
VIEWS['@hclib'] = {tr:'Konnektör Kütüphanesi', ic:'CON', note:'Konnektör tiplerini, hat tiplerini, etiketleri, eşleşme kurallarını ve kontak boyutlarını yönetin.<br><br><b>Yerleşik tipler</b> (MIL-DTL-38999, 26482, Micro-D, D-Sub, Fisher) salt okunurdur; <b>Kopyala</b> ile düzenlenebilir tip oluşturun ya da <b>+ Yeni tip</b> ile sıfırdan tanımlayın.<br><br>Kontak listesi pin numaralarını ve kontak boyutlarını belirler; pin akımı kontak sınırını aşarsa uyarı verilir.', render:hcLibHTML, bar:hcLibBar, status:() => hcTypes().length + ' konnektör tipi · ' + hcR().labels.length + ' etiket'};
VIEWS['@hcunits'] = {tr:'Birim Arayüzleri ve Pinout', ic:'PIN', note:'Her birim için arayüzleri (konnektörleri) tanımlayın: konnektör tipi, arayüz türü (haberleşme, güç…) ve pin pin pinout.<br><br>Pinlere etiket atayın; kablaj şemasında eşleştirme denetimi bu etiketlere, hat tiplerine, yönlere ve gerilim aralıklarına göre yapılır.<br><br>Arayüzler modelde bloğun portlarıdır; IBD, ICD ve N² matrisinde de görünür.', render:hcUnitHTML, bar:hcUnitBar, status:() => hcUnits().length + ' birim · ' + Object.values(M.els).filter(hcIsConn).length + ' arayüz'};
/* ---------- menü, araç çubuğu, iş akışı ---------- */
HOOKS.menu.analysis.unshift(r => r.push(...hcLibMenu()));   /* gruplama / Temel süzgecinden (menuFinal) önce */
if(typeof MENU_ADV !== 'undefined') MENU_ADV.analysis = new RegExp(MENU_ADV.analysis.source + '|^Konnektör kütüphanesi|^Hat tipleri ve etiketler|^Birim arayüzleri');   /* Temel görünümde Kablaj ▾ menüsünde */
if(typeof MENU_GROUPS !== 'undefined'){ MENU_GROUPS.analysis.cls.unshift(['Kablaj ve konnektörler', /Konnektör kütüphanesi|Hat tipleri ve etiketler|Birim arayüzleri|Kablaj/]); MENU_GROUPS.analysis.show.splice(1, 0, 'Kablaj ve konnektörler'); }
ACT.harnessMenu = () => { const b = document.querySelector('[data-act="harnessMenu"]').getBoundingClientRect(); setTimeout(() => menu(b.left, b.bottom + 4, hcLibMenu()), 0); };
(() => { const tb = document.querySelector('#toolbar [data-act="analysisMenu"]');
  if(tb && !document.querySelector('#toolbar [data-act="harnessMenu"]')){ tb.insertAdjacentHTML('afterend', '<button data-act="harnessMenu" title="Konnektör kütüphanesi, hat etiketleri, birim arayüzleri ve pinout, kablaj şeması">Kablaj ▾</button>'); if(typeof TB_IC !== 'undefined') TB_IC.harnessMenu = 'tools'; if(typeof decorateToolbar === 'function') decorateToolbar(); } })();
if(typeof WF_STEPS !== 'undefined'){
  const i = WF_STEPS.findIndex(s => /Mimariyi/.test(s.t));
  WF_STEPS.splice(i + 1, 0, {n:'', t:'Arayüzleri ve kablajı tasarla', d:'Birimlerin arayüzlerini (konnektörlerini) ekleyin, konnektör tiplerini seçin ve pinout\'u girin; sonra kablaj şemasında birimleri bağlayıp eşleştirme denetimini yapın.',
    k:() => hcUnits().length + ' birim, ' + Object.values(M.els).filter(hcIsConn).length + ' arayüz',
    a:[['Konnektör kütüphanesi', /^Konnektör kütüphanesi/], ['Hat tipleri ve etiketler', /^Hat tipleri ve etiketler/], ['Birim arayüzleri ve pinout', /^Birim arayüzleri/]]});
  WF_STEPS.forEach((s, j) => s.n = String(j + 1));
}
/* özellikler paneli: konnektör portu için özet ve kısayol */
HOOKS.props.push((t, panel) => {
  const e = t && t.el; if(!panel || !e) return;
  if(hcIsConn(e)){ const s = hcConnStats(e), ty = hcType(e.hc.ct); panel.insertAdjacentHTML('beforeend', `<div class="pf"><label>Konnektör</label><div>${esc(ty ? ty.name : 'tip seçilmedi')}<br>${s.used.length} / ${s.total} pin dolu${s.iss.length ? ' · ' + s.iss.length + ' uyarı' : ''}<br><button class="pbtn" data-hcgo="${e.id}">Pinout'u aç</button></div></div>`); }
  else if(e.kind === 'Block' && (e.hcUnit || kidsOf(e.id).some(hcIsConn))) panel.insertAdjacentHTML('beforeend', `<div class="pf"><label>Birim arayüzleri</label><div>${hcUnitConns(e.id).length} arayüz <button class="pbtn" data-hcgo="${e.id}">Pinout'u aç</button></div></div>`);
});
document.addEventListener('click', ev => { const b = ev.target.closest && ev.target.closest('[data-hcgo]'); if(!b) return; const e = E(b.dataset.hcgo); if(!e) return; if(e.kind === 'Port'){ HC.unit = e.owner; HC.port = e.id; } else HC.unit = e.id; openD('@hcunits'); });
/* model doğrulama */
VALIDATORS.push((add, els) => { els.forEach(e => { if(!hcIsConn(e)) return; const s = hcConnStats(e); s.iss.forEach(([sv, m]) => add(sv, 'Konnektör pinout', e, m)); }); });
/* ---------- olaylar ---------- */
(() => {
  const V = $('#view'), onL = () => ST.cur === '@hclib', onU = () => ST.cur === '@hcunits';
  const save = f => { snap(); const r = f(); afterChange(); renderViewBar(); renderView(); return r; };
  V.addEventListener('keydown', ev => { if((onL() || onU()) && ev.target.matches && ev.target.matches('input,select')){ ev.stopPropagation(); if(ev.key === 'Enter') ev.target.blur(); } });
  V.addEventListener('input', ev => { const t = ev.target; if(onL() && t.dataset.hcf === 'q'){ HC.q = t.value; renderView(); } });
  V.addEventListener('change', ev => {
    const t = ev.target, v = t.type === 'checkbox' ? t.checked : t.value.trim();
    if(onL()){
      const H = () => hcM(), ty = () => hcUserType(HC.sel);
      if(t.dataset.hct){ const x = ty(); if(!x) return; return save(() => { const k = t.dataset.hct; x[k] = ['vmax', 'tmin', 'tmax', 'weight', 'rows'].includes(k) ? (v === '' ? '' : numOf(v) == null ? x[k] : numOf(v)) : v; }); }
      if(t.dataset.hcx){ const x = ty(); if(!x) return; const [f, i] = t.dataset.hcx.split('|'), ent = Object.entries(x.custom || {}); if(!ent[+i]) return; return save(() => { if(f === 'k') ent[+i][0] = v || ent[+i][0]; else ent[+i][1] = v; x.custom = Object.fromEntries(ent); }); }
      if(t.dataset.hcpn){ const x = ty(); if(!x) return; const [f, i] = t.dataset.hcpn.split('|'); return save(() => { const p = x.pins[+i]; if(!p) return; if(f === 'no'){ if(v && !x.pins.some((q, j) => j !== +i && q.no === v)){ hcRenamePin(x.id, p.no, v); p.no = v; } else toast('Pin numarası boş veya yinelenen'); } else p.size = v; }); }
      const gen = (attr, arr, nums) => { if(!t.dataset[attr]) return false; const [f, i] = t.dataset[attr].split('|'); save(() => { const o = arr()[+i]; if(!o) return; o[f] = nums.includes(f) ? (v === '' ? '' : numOf(v) == null ? o[f] : numOf(v)) : v; }); return true; };
      if(gen('hcc', () => H().cats, [])) return; if(gen('hcl', () => H().labels, ['vmin', 'vmax'])) return; if(gen('hcr', () => H().rules, [])) return; if(gen('hck', () => H().contacts, ['imax', 'awgThick', 'awgThin'])) return;
    }
    if(onU()){
      if(t.dataset.hcf === 'unit'){ HC.unit = t.value; HC.port = ''; renderViewBar(); renderView(); return; }
      const p = E(HC.port);
      if(t.dataset.hcq && p){ const k = t.dataset.hcq; return save(() => { if(k === 'name') p.name = v || p.name; else if(k === 'ct'){ p.hc.ct = v; const ty = hcType(v); if(ty && !p.hc.cat){ /* tür boşsa ilk pin etiketlerinden çıkarılır; kullanıcı seçer */ } } else p.hc[k] = v; }); }
      if(t.dataset.hcp && p){ const [no, f] = t.dataset.hcp.split('|');
        if(f === 'lbl' && v === '__new') return quickForm('Yeni etiket', [{k:'name', l:'Etiket adı', v:''}, {k:'cat', l:'Hat tipi', t:'select', v:p.hc.cat || '', opts:[['', '—']].concat(hcR().cats.map(c => [c.id, c.name]))}, {k:'vmin', l:'V min', v:''}, {k:'vmax', l:'V maks', v:''}],
          r => { if(!r.name) return 'Etiket adı gerekli'; if(hcR().labels.some(l => l.name === r.name)) return 'Bu etiket zaten var'; save(() => { const l = {id:'l' + uid(), name:r.name, cat:r.cat, dir:'', vmin:numOf(r.vmin) == null ? '' : numOf(r.vmin), vmax:numOf(r.vmax) == null ? '' : numOf(r.vmax), desc:''}; hcM().labels.push(l); hcSetPin(p, no, 'lbl', l.id); }); });
        return save(() => hcSetPin(p, no, f, v)); }
    }
  });
  document.addEventListener('click', ev => {
    if(!onL() && !onU()) return;
    const sel = ev.target.closest('[data-hcsel]'); if(sel){ HC.sel = sel.dataset.hcsel; renderView(); return; }
    const un = ev.target.closest('[data-hcunit]'); if(un){ HC.unit = un.dataset.hcunit; HC.port = ''; renderViewBar(); renderView(); return; }
    const pc = ev.target.closest('[data-hcport]'); if(pc){ HC.port = pc.dataset.hcport; renderView(); return; }
    const b = ev.target.closest('[data-hca]'); if(!b) return;
    const a = b.dataset.hca, i = +b.dataset.i;
    if(a === 'tab'){ HC.tab = b.dataset.k; renderViewBar(); renderView(); return; }
    if(a === 'lib'){ HC.tab = 'types'; openD('@hclib'); return; }
    if(a === 'tnew') return quickForm('Yeni konnektör tipi', [{k:'name', l:'Ad', v:'Yeni konnektör'}, {k:'fam', l:'Aile / seri', v:'', list:[...new Set(hcTypes().map(x => x.fam).filter(Boolean))]}, {k:'n', l:'Pin sayısı', v:'10'},
      {k:'gender', l:'Kontak cinsiyeti', t:'select', v:HC_GENDERS[0], opts:HC_GENDERS.map(x => [x, x])}, {k:'body', l:'Gövde tipi', t:'select', v:HC_BODIES[0], opts:HC_BODIES.map(x => [x, x])}, {k:'shape', l:'Gövde şekli', t:'select', v:'circ', opts:[['circ', 'Dairesel'], ['rect', 'Dikdörtgen']]},
      {k:'size', l:'Kontak boyutu', t:'select', v:'#20', opts:hcR().contacts.map(k => [k.id, k.id + ' (' + k.imax + ' A)'])}],
      r => { const n = Math.max(1, Math.min(400, parseInt(r.n, 10) || 0)); if(!r.name) return 'Ad gerekli'; save(() => { const H = hcM(), id = 'ct' + uid(); H.ctypes[id] = {id, name:r.name, fam:r.fam, gender:r.gender, body:r.body, shape:r.shape, start:'Sol üst', view:HC_VIEWS[0], custom:{}, pins:hcPinList(n, r.size)}; HC.sel = id; HC.q = ''; }); },
      'Diğer özellikleri (PN, kabuk, kilit, sıcaklık, kaplama…) oluşturduktan sonra formdan girebilirsiniz.');
    if(a === 'tcopy'){ const t = hcType(HC.sel); if(!t) return; return save(() => { HC.sel = hcCopyType(t).id; HC.q = ''; toast('Düzenlenebilir kopya oluşturuldu'); }); }
    if(a === 'tdel'){ const t = hcType(HC.sel); if(!t) return; if(t.builtin) return toast('Yerleşik tip silinemez'); const n = Object.values(M.els).filter(e => hcIsConn(e) && e.hc.ct === t.id).length; if(n && !confirm(`${n} arayüz bu tipi kullanıyor; tip bağlantısı kaldırılacak. Silinsin mi?`)) return;
      return save(() => { Object.values(M.els).forEach(e => { if(hcIsConn(e) && e.hc.ct === t.id) e.hc.ct = ''; }); delete hcM().ctypes[t.id]; HC.sel = ''; }); }
    if(a === 'img'){ const t = hcUserType(HC.sel); if(t) hcImgPick(t); return; }
    if(a === 'imgdel'){ const t = hcUserType(HC.sel); if(t) save(() => { delete t.img; }); return; }
    if(a === 'xadd'){ const t = hcUserType(HC.sel); if(!t) return; return save(() => { t.custom = t.custom || {}; let k = 'Özellik', j = 1; while(t.custom[k + (j > 1 ? ' ' + j : '')] != null) j++; t.custom[k + (j > 1 ? ' ' + j : '')] = ''; }); }
    if(a === 'xdel'){ const t = hcUserType(HC.sel); if(!t) return; return save(() => { t.custom = Object.fromEntries(Object.entries(t.custom || {}).filter((_, j) => j !== i)); }); }
    if(a === 'gen'){ const t = hcUserType(HC.sel); if(!t) return; const n = Math.max(1, Math.min(400, parseInt($('#hcGenN').value, 10) || 0)), lt = $('#hcGenL').value === '1', size = $('#hcGenS').value;
      if((t.pins || []).length && !confirm('Kontak listesi yeniden oluşturulacak. Devam edilsin mi?')) return; return save(() => { t.pins = hcPinList(n, size, lt); }); }
    if(a === 'padd'){ const t = hcUserType(HC.sel); if(!t) return; return save(() => { t.pins = t.pins || []; let n = t.pins.length + 1; while(t.pins.some(p => p.no === String(n))) n++; t.pins.push({no:String(n), size:(t.pins[t.pins.length - 1] || {}).size || '#20'}); }); }
    if(a === 'pdel'){ const t = hcUserType(HC.sel); if(!t) return; return save(() => { t.pins.splice(i, 1); }); }
    if(a === 'lnew') return save(() => { const H = hcM(); H.labels.push({id:'l' + uid(), name:'YENİ_ETİKET_' + (H.labels.length + 1), cat:'', dir:'', vmin:'', vmax:'', desc:''}); });
    if(a === 'cnew') return save(() => { const H = hcM(); H.cats.push({id:'c' + uid(), name:'Yeni hat tipi', col:'#607d8b', desc:''}); });
    if(a === 'rnew') return save(() => { const H = hcM(); H.rules.push({id:'r' + uid(), a:'', b:''}); });
    if(a === 'knew') return save(() => { const H = hcM(); H.contacts.push({id:'Yeni kontak ' + (H.contacts.length + 1), imax:5, awgThick:20, awgThin:24, note:''}); });
    if(a === 'ldel'){ const H = hcM(), l = H.labels[i]; if(!l) return; return save(() => { H.labels.splice(i, 1); H.rules = H.rules.filter(r => r.a !== l.id && r.b !== l.id); Object.values(M.els).forEach(e => { if(hcIsConn(e)) Object.values(e.hc.pins || {}).forEach(d => { if(d.lbl === l.id){ d.cat = l.cat; delete d.lbl; } }); }); }); }
    if(a === 'cdel'){ const H = hcM(), c = H.cats[i]; if(!c) return; return save(() => { H.cats.splice(i, 1); H.labels.forEach(l => { if(l.cat === c.id) l.cat = ''; }); Object.values(M.els).forEach(e => { if(hcIsConn(e)){ if(e.hc.cat === c.id) e.hc.cat = ''; Object.values(e.hc.pins || {}).forEach(d => { if(d.cat === c.id) delete d.cat; }); } }); }); }
    if(a === 'rdel') return save(() => { hcM().rules.splice(i, 1); });
    if(a === 'kdel') return save(() => { hcM().contacts.splice(i, 1); });
    if(a === 'unew') return quickForm('Yeni birim', [{k:'name', l:'Birim adı', v:'Birim ' + (hcUnits().length + 1)}, {k:'own', l:'Paket', t:'select', v:nearestPkg(ST.tsel || M.rootId), opts:Object.values(M.els).filter(e => e.kind === 'Package' || e.kind === 'Model').sort(sortEls).map(e => [e.id, pathOf(e.id) || e.name])}],
      r => { if(!r.name) return 'Ad gerekli'; save(() => { const u = hcNewUnit(r.name, r.own); HC.unit = u.id; HC.port = ''; }); renderTree(); });
    if(a === 'padd2'){ const u = E(HC.unit); if(!u) return; return quickForm('Yeni arayüz (konnektör)', [{k:'name', l:'Arayüz adı (referans)', v:'J' + (hcUnitConns(u.id).length + 1)}, {k:'cat', l:'Arayüz türü', t:'select', v:'', opts:[['', '—']].concat(hcR().cats.map(c => [c.id, c.name]))},
      {k:'ct', l:'Konnektör tipi', t:'select', v:'', opts:[['', '— sonra seçeceğim —']].concat(hcTypes().map(x => [x.id, (x.fam ? x.fam + ' · ' : '') + x.name]))}],
      r => { save(() => { const p = hcNewPort(u.id, r.name); p.hc.cat = r.cat; p.hc.ct = r.ct; HC.port = p.id; }); renderTree(); }); }
    const p = E(HC.port);
    if(a === 'ptype' && p){ HC.tab = 'types'; HC.sel = p.hc.ct; HC.q = ''; openD('@hclib'); return; }
    if(a === 'pdup' && p) return save(() => { const q = hcNewPort(p.owner, p.name + '_2'); q.hc = JSON.parse(JSON.stringify(p.hc)); HC.port = q.id; });
    if(a === 'pclr' && p){ if(!confirm(p.name + ' pinout bilgileri silinsin mi?')) return; return save(() => { p.hc.pins = {}; }); }
    if(a === 'prm' && p){ if(!confirm(p.name + ' arayüzü modelden silinsin mi?')) return; save(() => { delModel([p.id]); HC.port = ''; }); renderTree(); return; }
    if(a === 'xl') return hcPinoutXlsx();
  });
})();
/* tipte pin numarası değişince arayüzlerdeki pinout anahtarını taşı */
function hcRenamePin(ctId, from, to){ Object.values(M.els).forEach(e => { if(hcIsConn(e) && e.hc.ct === ctId && e.hc.pins && e.hc.pins[from] && !e.hc.pins[to]){ e.hc.pins[to] = e.hc.pins[from]; delete e.hc.pins[from]; Object.values(e.hc.pins).forEach(d => { if(d.pair === from) d.pair = to; }); } }); }
