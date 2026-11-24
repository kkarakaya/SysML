/* ================= v1.59 — Haberleşme protokol profilleri, port arayüzleri ve doküman ekleri =================
   Veri: M.hrn.protos = [profil], M.hrn.files = {ekId: ek}
   Port: p.hc.ifs = [{id, pr, role, pins:[no], ov:{alan:değer}, note}], p.hc.att = [ekId]; profil.att = [ekId]
   Ek:  {id, name, size, t, mtime, path (masaüstü: <model>_ekler içindeki tam yol), rel (model klasörüne göre), data (tarayıcı: base64), rev} */
const HP_PHY = [
  ['RS-232', {baud:115200}], ['RS-422', {baud:115200}], ['RS-485', {baud:115200}], ['CAN 2.0A', {baud:500000}], ['CAN 2.0B', {baud:500000}], ['CAN FD', {baud:2000000}],
  ['MIL-STD-1553B', {baud:1000000}], ['ARINC 429', {baud:100000}], ['Ethernet UDP', {baud:100000000}], ['Ethernet TCP', {baud:100000000}], ['SpaceWire', {baud:100000000}],
  ['SPI', {baud:1000000}], ['I2C', {baud:400000}], ['LVDS (özel)', {baud:0}], ['Diğer', {baud:0}]];
const HP_SERIAL = /^RS-|^LVDS/;
const HP_CRC = {
  'Yok':{w:0}, 'Checksum-8 (toplam)':{w:8}, 'XOR-8':{w:8}, 'CRC-8 (0x07)':{w:8, poly:'0x07', init:'0x00'},
  'CRC-16/CCITT-FALSE':{w:16, poly:'0x1021', init:'0xFFFF'}, 'CRC-16/XMODEM':{w:16, poly:'0x1021', init:'0x0000'}, 'CRC-16/MODBUS':{w:16, poly:'0x8005', init:'0xFFFF', ref:true},
  'CRC-16/ARC':{w:16, poly:'0x8005', init:'0x0000', ref:true}, 'CRC-32 (ISO-HDLC)':{w:32, poly:'0x04C11DB7', init:'0xFFFFFFFF', ref:true, xor:'0xFFFFFFFF'}, 'Özel':{w:16}};
const HP_FTYPES = [['u8', 1], ['i8', 1], ['u16', 2], ['i16', 2], ['u32', 4], ['i32', 4], ['u64', 8], ['f32', 4], ['f64', 8], ['bit alanı', 0], ['char[]', 0], ['bayt dizisi', 0]];
const HP_ROLES = [['', '—'], ['M', 'Ana / kontrolcü (BC, master)'], ['S', 'Uç birim (RT, slave)'], ['P', 'Eşdüzey (peer)']];
/* profilde karşılaştırılan ve port başına geçersiz kılınabilen alanlar: [alan, etiket, tür] */
const HP_FIELDS = [
  ['phy', 'Fiziksel katman', 'phy'], ['baud', 'Hız (bit/s)', 'n'], ['data', 'Veri biti', 'n'], ['parity', 'Eşlik', 'par'], ['stop', 'Dur biti', 'n'], ['flow', 'Akış kontrolü', 's'],
  ['addr', 'Adres / kimlik (RT adresi, CAN ID, IP:port)', 's'], ['endian', 'Bayt sırası', 'end'], ['hdr', 'Başlık / senkron baytları (hex)', 's'],
  ['idOff', 'Komut ID ofseti (bayt)', 'n'], ['idSize', 'Komut ID boyu (bayt)', 'n'], ['lenOff', 'Uzunluk alanı ofseti', 'n'], ['lenSize', 'Uzunluk alanı boyu', 'n'], ['lenMode', 'Uzunluk neyi sayar', 'lm'],
  ['crc', 'CRC / sağlama', 'crc'], ['crcPoly', 'CRC polinomu', 's'], ['crcInit', 'CRC başlangıç', 's'], ['crcCov', 'CRC kapsamı', 'cov'], ['tail', 'Son bayt(lar) (hex)', 's'],
  ['maxLen', 'Maks. çerçeve (bayt)', 'n'], ['period', 'Periyot (ms)', 'n'], ['timeout', 'Zaman aşımı (ms)', 'n']];
const HP_CMP = ['phy', 'baud', 'data', 'parity', 'stop', 'endian', 'hdr', 'idOff', 'idSize', 'lenOff', 'lenSize', 'lenMode', 'crc', 'crcPoly', 'crcInit', 'crcCov', 'tail'];
const HP_SEL = {par:[['N', 'Yok (N)'], ['E', 'Çift (E)'], ['O', 'Tek (O)']], end:[['big', 'Big endian (MSB önce)'], ['little', 'Little endian (LSB önce)']], lm:[['payload', 'Yalnız veri (payload)'], ['frame', 'Tüm çerçeve'], ['after', 'Uzunluk alanından sonrası']], cov:[['hdr+payload', 'Başlık + veri'], ['payload', 'Yalnız veri'], ['all', 'CRC hariç tüm çerçeve']]};
function hpDefaults(){
  return [
    {id:'pr_ser1', name:'Örnek seri protokol (RS-422)', phy:'RS-422', baud:115200, data:8, parity:'N', stop:1, flow:'Yok', endian:'big', hdr:'AA 55', idOff:2, idSize:1, lenOff:3, lenSize:2, lenMode:'payload', crc:'CRC-16/CCITT-FALSE', crcPoly:'0x1021', crcInit:'0xFFFF', crcCov:'hdr+payload', tail:'', maxLen:256, period:20, timeout:100, ver:'A', ref:'', note:'Örnek: başlık AA 55, 1 bayt komut ID, 2 bayt uzunluk, CRC-16 sonda.', att:[],
      msgs:[{id:'m1', mid:'0x01', name:'Durum isteği', dir:'M>S', period:100, note:'', fields:[]},
            {id:'m2', mid:'0x81', name:'Durum yanıtı', dir:'S>M', period:100, note:'', fields:[{name:'Durum', type:'u8', size:1, unit:'', scale:'', min:'0', max:'3', note:'0 kapalı, 1 hazır, 2 çalışıyor, 3 arıza'}, {name:'Sıcaklık', type:'i16', size:2, unit:'°C', scale:'0.1', min:'-400', max:'1250', note:''}, {name:'Besleme gerilimi', type:'u16', size:2, unit:'V', scale:'0.01', min:'0', max:'3500', note:''}]}]},
    {id:'pr_can1', name:'Örnek CAN 2.0B (500 kbit/s)', phy:'CAN 2.0B', baud:500000, data:'', parity:'', stop:'', flow:'', endian:'little', hdr:'', idOff:'', idSize:4, lenOff:'', lenSize:'', lenMode:'payload', crc:'Yok', crcPoly:'', crcInit:'', crcCov:'', tail:'', maxLen:8, period:10, timeout:50, ver:'A', ref:'', note:'CAN çerçevesinin kendi CRC\'si donanımdadır; ID 29 bit genişletilmiş.', att:[],
      msgs:[{id:'m1', mid:'0x18FF0010', name:'Kalp atışı', dir:'P', period:100, note:'', fields:[{name:'Sayaç', type:'u8', size:1, unit:'', scale:'', min:'0', max:'255', note:''}]}]}];
}
let HP_DEF0 = null;
const hpList = () => (M && M.hrn && M.hrn.protos) || HP_DEF0 || (HP_DEF0 = hpDefaults());
function hpM(){ const H = hcM(); if(!H.protos) H.protos = hpDefaults(); if(!H.files) H.files = {}; return H; }
const hpGet = id => hpList().find(p => p.id === id);
const hpFiles = () => (M && M.hrn && M.hrn.files) || {};
const hpFile = id => hpFiles()[id];
const hpIfs = p => (p && p.hc && p.hc.ifs) || [];
const hpAtts = o => ((o && (o.hc ? o.hc.att : o.att)) || []).map(hpFile).filter(Boolean);
const hpCrcW = pr => pr.crc === 'Özel' ? (hcNum(pr.crcW) || 16) : ((HP_CRC[pr.crc] || {}).w || 0);
const hpHexLen = s => String(s || '').replace(/0x/gi, '').replace(/[^0-9a-f]/gi, '').length >> 1;
const hpNormHex = s => String(s || '').replace(/0x/gi, '').replace(/[^0-9a-f]/gi, '').toUpperCase().replace(/(..)(?=.)/g, '$1 ');
function hpEff(ifc){ const pr = hpGet(ifc.pr); if(!pr) return null; const e = Object.assign({}, pr); Object.entries(ifc.ov || {}).forEach(([k, v]) => { if(v !== '' && v != null) e[k] = v; }); return e; }
/* arayüzün kapsadığı pinler: seçili pinler, yoksa konnektörün haberleşme tipindeki dolu pinleri (hiç yoksa tüm dolu pinler) */
function hpIfPins(p, ifc){
  if(ifc.pins && ifc.pins.length) return ifc.pins.map(String);
  const used = hcPins(p).filter(x => hcPinUsed(x.d)), com = used.filter(x => hcPinCat(x.d) === 'c_com' || (!hcPinCat(x.d) && p.hc.cat === 'c_com'));
  return (com.length ? com : used).map(x => String(x.no));
}
function hpMsgLen(m){ return (m.fields || []).reduce((a, f) => a + (hcNum(f.size) || (HP_FTYPES.find(t => t[0] === f.type) || [0, 0])[1] || 0), 0); }
function hpFrame(pr){
  const r = [], hl = hpHexLen(pr.hdr);
  if(hl) r.push({name:'Başlık / senkron', off:0, size:hl, val:hpNormHex(pr.hdr)});
  if(hcNum(pr.idSize)) r.push({name:'Komut / mesaj ID', off:hcNum(pr.idOff), size:hcNum(pr.idSize), val:''});
  if(hcNum(pr.lenSize)) r.push({name:'Uzunluk', off:hcNum(pr.lenOff), size:hcNum(pr.lenSize), val:{payload:'veri bayt sayısı', frame:'tüm çerçeve', after:'uzunluk alanından sonrası'}[pr.lenMode || 'payload'] || ''});
  const end = r.reduce((a, x) => Math.max(a, (x.off == null ? a : x.off) + x.size), 0);
  r.forEach(x => { if(x.off == null) x.off = ''; });
  r.push({name:'Veri (payload)', off:end, size:'N', val:'mesaja göre'});
  const cw = hpCrcW(pr); if(cw) r.push({name:'CRC (' + pr.crc + ')', off:end + ' + N', size:cw / 8, val:pr.crc === 'Yok' ? '' : [pr.crcPoly && 'poly ' + pr.crcPoly, pr.crcInit && 'init ' + pr.crcInit, 'kapsam: ' + ((HP_SEL.cov.find(c => c[0] === pr.crcCov) || [])[1] || '—')].filter(Boolean).join(', ')});
  const tl = hpHexLen(pr.tail); if(tl) r.push({name:'Son bayt(lar)', off:'sonda', size:tl, val:hpNormHex(pr.tail)});
  return r;
}
/* ---------- uyumluluk: kablajla birbirine bağlanan arayüz çiftleri ---------- */
const HPC = {rev:-1, v:null};
function hpPairs(){
  if(HPC.rev === REV && HPC.v) return HPC.v;
  const ifOf = new Map();
  Object.values(M.els).forEach(p => { if(!hcIsConn(p)) return; hpIfs(p).forEach(ifc => hpIfPins(p, ifc).forEach(no => ifOf.set(p.id + '|' + no, {p, ifc}))); });
  const pairs = new Map(), lone = new Map();
  hcLines().forEach(l => {
    const ends = l.pins.map(x => ({x, f:ifOf.get(x.key)}));
    for(let i = 0; i < ends.length; i++) for(let j = i + 1; j < ends.length; j++){
      const a = ends[i], b = ends[j]; if(a.x.port.id === b.x.port.id) continue;
      if(a.f && b.f){ const k = [a.f.ifc.id, b.f.ifc.id].sort().join('~'); if(!pairs.has(k)) pairs.set(k, {a:a.f, b:b.f, cables:new Set(), lines:[]}); const P = pairs.get(k); P.cables.add(l.cable); P.lines.push(l); }
      else if(a.f || b.f){ const f = a.f || b.f, o = a.f ? b.x : a.x; const k = f.ifc.id + '>' + o.port.id; if(!lone.has(k)) lone.set(k, {f, o, cables:new Set()}); lone.get(k).cables.add(l.cable); }
    }
  });
  const v = {pairs:[...pairs.values()].map(P => Object.assign(P, {iss:hpCompat(P.a, P.b)})), lone:[...lone.values()].filter(L => L.o.port.hc && (hcPinCat(L.o.d) === 'c_com' || L.o.port.hc.cat === 'c_com'))};
  HPC.rev = REV; HPC.v = v; return v;
}
const hpIfLabel = f => `${(E(f.p.owner) || {}).name || '?'} ${f.p.name}` + (hpGet(f.ifc.pr) ? ' (' + hpGet(f.ifc.pr).name + ')' : '');
const hpVal = (k, v) => { const F = HP_FIELDS.find(x => x[0] === k); if(v === '' || v == null) return '—'; if(F && HP_SEL[F[2]]) return (HP_SEL[F[2]].find(o => o[0] === v) || [0, v])[1]; return String(v); };
function hpCompat(fa, fb){
  const out = [], A = hpEff(fa.ifc), B = hpEff(fb.ifc);
  if(!A || !B){ out.push(['uyarı', 'Arayüzün protokol profili silinmiş']); return out; }
  const norm = (k, v) => k === 'hdr' || k === 'tail' ? hpNormHex(v) : /^crc(Poly|Init)$/.test(k) ? String(v || '').toLowerCase().replace(/^0x0*/, '') : String(v == null ? '' : v).trim();
  if(norm('phy', A.phy) !== norm('phy', B.phy)) out.push(['hata', `Fiziksel katman farklı: ${A.phy || '—'} ↔ ${B.phy || '—'}`]);
  else HP_CMP.slice(1).forEach(k => { if(k.startsWith('crc') && k !== 'crc' && (A.crc !== 'Özel' || B.crc !== 'Özel')) return; const a = norm(k, A[k]), b = norm(k, B[k]); if(a !== b && a !== '' && b !== '') out.push(['hata', `${(HP_FIELDS.find(x => x[0] === k) || [0, k])[1]} uyumsuz: ${hpVal(k, A[k])} ↔ ${hpVal(k, B[k])}`]); });
  const ra = fa.ifc.role || '', rb = fb.ifc.role || '';
  if(ra && ra === rb && ra !== 'P') out.push(['uyarı', `İki uç da "${HP_ROLES.find(r => r[0] === ra)[1]}" rolünde`]);
  if(A.id !== B.id){   /* farklı profiller: mesaj kümelerini karşılaştır */
    const ma = new Map((A.msgs || []).map(m => [String(m.mid).toLowerCase(), m])), mb = new Map((B.msgs || []).map(m => [String(m.mid).toLowerCase(), m]));
    if(ma.size && mb.size){
      ma.forEach((m, k) => { const o = mb.get(k); if(!o) out.push(['uyarı', `${m.mid} "${m.name}" mesajı karşı profilde (${B.name}) yok`]); else { const la = hpMsgLen(m), lb = hpMsgLen(o); if(la && lb && la !== lb) out.push(['hata', `${m.mid} mesaj uzunluğu farklı: ${la} ↔ ${lb} bayt`]); } });
      mb.forEach((m, k) => { if(!ma.has(k)) out.push(['uyarı', `${m.mid} "${m.name}" mesajı karşı profilde (${A.name}) yok`]); });
    }
  }
  if(A.addr && B.addr && fa.ifc.ov && fb.ifc.ov && fa.ifc.ov.addr && fa.ifc.ov.addr === fb.ifc.ov.addr && /^Ethernet/.test(A.phy) && !/:/.test(A.addr)) out.push(['uyarı', `İki uç aynı adreste: ${A.addr}`]);
  return out;
}
function hpIssuesFor(filter){
  const v = hpPairs(), out = [];
  v.pairs.forEach(P => { if(filter && !filter(P.a, P.b)) return; P.iss.forEach(([sev, m]) => out.push({sev, msg:`${hpIfLabel(P.a)} ↔ ${hpIfLabel(P.b)}: ${m}`, el:P.a.p.id, cables:P.cables})); });
  v.lone.forEach(L => { if(filter && !filter(L.f, null)) return; out.push({sev:'bilgi', msg:`${hpIfLabel(L.f)}: karşı uçta (${(E(L.o.port.owner) || {}).name} ${L.o.port.name}) haberleşme arayüzü tanımlı değil`, el:L.f.p.id, cables:L.cables}); });
  return out;
}
/* kablaj denetimine protokol bulguları */
{ const _ci = hcCableIssues; hcCableIssues = function(c){ const r = _ci.apply(this, arguments); try { hpIssuesFor().filter(x => x.cables.has(c) && x.sev !== 'bilgi').forEach(x => r.push({sev:x.sev, msg:'Protokol: ' + x.msg})); } catch(e){} return r; }; }
VALIDATORS.push((add) => { if(!M.hrn || !M.hrn.protos) return; hpIssuesFor().forEach(x => add(x.sev, 'Haberleşme protokolü', x.el, x.msg));
  Object.values(M.els).forEach(p => hpIfs(p).forEach(ifc => { if(!hpGet(ifc.pr)) add('uyarı', 'Haberleşme protokolü', p.id, `${p.name}: arayüzün protokol profili yok / silinmiş`); })); });
/* ---------- ekler ---------- */
const hpDir = () => curPath ? curPath.replace(/[\\/][^\\/]*$/, '') : '';
const hpSep = () => /\\/.test(curPath) ? '\\' : '/';
function hpFilePath(f){ if(f.rel && curPath) return hpDir() + hpSep() + f.rel.replace(/[\\/]/g, hpSep()); return f.path || ''; }
const hpSize = n => n == null ? '' : n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
const hpExt = n => (String(n).match(/\.([a-z0-9]+)$/i) || [0, ''])[1].toLowerCase();
const HP_MIME = {pdf:'application/pdf', docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', doc:'application/msword', xls:'application/vnd.ms-excel', txt:'text/plain', csv:'text/csv', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'};
function hpNAttach(replace){ return new Promise(res => { const id = ++nSeq; nWait[id] = res; window.nativeAttach(id, curPath || '', replace || '').catch(e => { delete nWait[id]; res({error:String(e)}); }); }); }
const hpB64 = u8 => { let s = ''; for(let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
function hpPickBrowser(){ return new Promise(res => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.docx,.doc,.xlsx,.xls,.pdf,.txt,.csv,.pptx,.png,.jpg,.jpeg'; inp.onchange = async () => { const f = inp.files[0]; if(!f) return res(null); res({name:f.name, size:f.size, u8:new Uint8Array(await f.arrayBuffer())}); }; inp.click(); }); }
const HP_MAXB = 15 * 1048576;
/* yeni ek veya mevcut ekin güncellenmesi (fid) — owner: port veya profil */
async function hpAttach(owner, fid){
  const old = fid && hpFile(fid);
  if(NATIVE && typeof window.nativeAttach === 'function'){
    const r = await hpNAttach(old ? hpFilePath(old) : ''); if(r.error) return toast('Ek kopyalanamadı: ' + r.error); if(!r.path) return;
    const rel = curPath && r.path.startsWith(hpDir()) ? r.path.slice(hpDir().length + 1) : '';
    snap(); const H = hpM(), id = old ? old.id : uid('att');
    H.files[id] = Object.assign(old || {}, {id, name:old ? old.name : r.name, size:r.size, mtime:r.mtime, path:r.path, rel, t:old ? old.t : Date.now(), rev:old ? (old.rev || 1) + 1 : 1, src:r.name});
    if(!old) hpLink(owner, id); afterChange(); hpRefresh();
    toast(old ? 'Ek güncellendi: ' + H.files[id].name : `Ek kopyalandı: ${r.path}` + (curPath ? '' : ' (model kaydedilmediği için uygulama klasörüne)'));
    return H.files[id];
  }
  const f = await hpPickBrowser(); if(!f) return;
  if(f.size > HP_MAXB) return toast(`Dosya çok büyük (${hpSize(f.size)}); tarayıcı sürümünde en fazla ${hpSize(HP_MAXB)} gömülebilir. Masaüstü uygulamasında boyut sınırı yoktur.`);
  snap(); const H = hpM(), id = old ? old.id : uid('att');
  H.files[id] = Object.assign(old || {}, {id, name:old ? old.name : f.name, size:f.size, mtime:new Date().toISOString(), data:hpB64(f.u8), t:old ? old.t : Date.now(), rev:old ? (old.rev || 1) + 1 : 1, src:f.name});
  if(!old) hpLink(owner, id); afterChange(); hpRefresh(); toast((old ? 'Ek güncellendi: ' : 'Ek modele gömüldü: ') + H.files[id].name);
  return H.files[id];
}
function hpLink(owner, id){ if(owner.kind === 'Port'){ owner.hc.att = (owner.hc.att || []).concat([id]); } else { owner.att = (owner.att || []).concat([id]); } }
function hpOwners(fid){ const r = []; Object.values(M.els).forEach(p => { if(p.hc && (p.hc.att || []).includes(fid)) r.push(p); }); hpList().forEach(pr => { if((pr.att || []).includes(fid)) r.push(pr); }); return r; }
function hpUnlink(owner, fid){ snap(); if(owner.kind === 'Port') owner.hc.att = (owner.hc.att || []).filter(x => x !== fid); else owner.att = (owner.att || []).filter(x => x !== fid);
  if(!hpOwners(fid).length && M.hrn && M.hrn.files) delete M.hrn.files[fid]; afterChange(); hpRefresh(); }
async function hpOpen(fid){
  const f = hpFile(fid); if(!f) return;
  if(f.data){ const bin = atob(f.data), u8 = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const blob = new Blob([u8], {type:HP_MIME[hpExt(f.name)] || 'application/octet-stream'});
    if(/^(pdf|png|jpe?g|txt)$/.test(hpExt(f.name)) && !NATIVE){ const u = URL.createObjectURL(blob), w = window.open(u, '_blank'); if(w) return; }
    download(blob, f.name); toast('Ek indirildi. Düzenledikten sonra "Güncelle" ile yeni sürümü yükleyin.'); return; }
  if(NATIVE && typeof window.nativeOpenFile === 'function'){
    let p = hpFilePath(f), e = await window.nativeOpenFile(p);
    if(e && f.path && f.path !== p){ p = f.path; e = await window.nativeOpenFile(p); }
    if(e) return toast('Ek açılamadı: ' + e + ' — ' + p);
    toast('Açıldı: ' + f.name + ' (kaydettiğinizde ek klasöründeki dosya güncellenir)'); return; }
  toast('Bu ek masaüstü uygulamasında eklenmiş (' + (f.rel || f.path) + '); tarayıcıdan açılamaz.');
}
async function hpSaveAs(fid){
  const f = hpFile(fid); if(!f) return;
  if(f.data){ const bin = atob(f.data), u8 = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return download(new Blob([u8], {type:HP_MIME[hpExt(f.name)] || 'application/octet-stream'}), f.name); }
  if(NATIVE && typeof window.nativeRead === 'function'){ toast('Dosya: ' + hpFilePath(f)); if(typeof window.nativeOpenFile === 'function') window.nativeOpenFile(hpFilePath(f).replace(/[\\/][^\\/]*$/, '')); }
}
async function hpStat(){ if(!NATIVE || typeof window.nativeFileInfo !== 'function') return 0; let ch = 0;
  for(const f of Object.values(hpFiles())){ if(f.data) continue; const r = await window.nativeFileInfo(hpFilePath(f)); if(r.error){ if(!f.missing){ f.missing = true; ch++; } continue; } if(f.missing){ delete f.missing; ch++; } if(r.mtime !== f.mtime){ f.mtime = r.mtime; f.size = r.size; ch++; } }
  return ch; }
function hpAttHTML(owner, kind){
  const L = hpAtts(owner), ok = owner.kind === 'Port' ? owner.id : owner.id;
  return `<div class="hcsec">Ekli dokümanlar <span class="muted" style="font-weight:400;font-size:11px">${NATIVE ? 'dosyalar modelin yanındaki "' + esc(curPath ? curPath.replace(/^.*[\\/]/, '').replace(/\.[^.]*$/, '') : '(kaydedilmemiş model)') + '_ekler" klasörüne kopyalanır; Aç → Word/Excel\'de düzenleyip kaydedin' : 'tarayıcı sürümünde dosyalar modele gömülür; Aç indirir, düzenlenen dosyayı Güncelle ile yükleyin'}</span></div>
    <table class="hcpt"><thead><tr><th>Dosya</th><th>Boyut</th><th>Değişiklik</th><th>Sürüm</th><th></th></tr></thead><tbody>${L.map(f => `<tr${f.missing ? ' style="background:#fdecea"' : ''}><td class="noi18n"><a href="#" data-hp6="fopen" data-k="${f.id}">${esc(f.name)}</a>${f.missing ? ' <span style="color:#c0392b">dosya bulunamadı</span>' : ''}${f.data ? ' <span class="muted" style="font-size:10px">gömülü</span>' : ''}</td><td>${hpSize(f.size)}</td><td>${f.mtime ? new Date(f.mtime).toLocaleString('tr-TR') : ''}</td><td>${f.rev || 1}</td>
      <td style="white-space:nowrap"><button class="vb" data-hp6="fopen" data-k="${f.id}">Aç</button> <button class="vb" data-hp6="fupd" data-k="${f.id}" data-o="${kind}|${ok}" title="Başka bir dosyayla değiştir">Güncelle</button> <button class="vb" data-hp6="fsave" data-k="${f.id}">${f.data ? 'İndir' : 'Klasörü aç'}</button> <button class="vb" data-hp6="fdel" data-k="${f.id}" data-o="${kind}|${ok}" style="color:#c0392b">Kaldır</button></td></tr>`).join('') || '<tr><td colspan="5" class="muted">Ek yok</td></tr>'}</tbody></table>
    <button class="vb" data-hp6="fadd" data-o="${kind}|${ok}">+ Doküman ekle (Word, Excel, PDF…)</button>`;
}
/* ---------- protokol profilleri görünümü ---------- */
const HPV = {sel:'', msg:''};
function hpUsers(prId){ const r = []; Object.values(M.els).forEach(p => { if(!hcIsConn(p)) return; hpIfs(p).forEach(ifc => { if(ifc.pr === prId) r.push({p, ifc}); }); }); return r; }
function hpInput(o, k, t, attr){ const v = o[k] == null ? '' : o[k];
  if(t === 'phy') return `<select ${attr}>${HP_PHY.map(([n]) => hcOpt(n, n, v)).join('')}</select>`;
  if(t === 'crc') return `<select ${attr}>${Object.keys(HP_CRC).map(n => hcOpt(n, n, v)).join('')}</select>`;
  if(HP_SEL[t]) return `<select ${attr}>${hcOpt('', '—', v)}${HP_SEL[t].map(([a, b]) => hcOpt(a, b, v)).join('')}</select>`;
  return `<input ${attr} value="${esc(v)}"${t === 'n' ? ' style="width:90px"' : ''}>`; }
function hpBar(){
  const L = hpList(); if(HPV.sel && !hpGet(HPV.sel)) HPV.sel = '';
  return `<label>Profil <select data-hp6f="sel" class="noi18n">${hcOpt('', '— tüm profiller —', HPV.sel)}${L.map(p => hcOpt(p.id, p.name, HPV.sel)).join('')}</select></label><button class="vb pri" data-hp6="new">+ Yeni profil</button><button class="vb" data-hp6="dup"${HPV.sel ? '' : ' disabled'}>Çoğalt</button><button class="vb" data-hp6="del"${HPV.sel ? '' : ' disabled'} style="color:#c0392b">Sil</button>
    <span class="vsep"></span><button class="vb" data-hp6="docx">Yazılım ICD (Word)</button><button class="vb" data-hp6="xlsx">ICD Excel</button>${NATIVE ? '<button class="vb" data-hp6="stat" title="Word/Excel\'de değiştirilen eklerin boyut ve tarihini yenile">↻ Ekleri yenile</button>' : ''}`;
}
function hpHTML(){ const pr = hpGet(HPV.sel); return pr ? hpProfHTML(pr) : hpListHTML(); }
function hpListHTML(){
  const L = hpList(), iss = hpIssuesFor(), v = hpPairs();
  return `<div style="padding:12px"><p class="muted" style="font-size:12px;margin-top:0">Protokol profilleri yeniden kullanılabilir haberleşme tanımlarıdır (fiziksel katman, çerçeve yapısı, endian, komut ID, uzunluk, CRC, mesaj listesi). Profilleri <b>Birim arayüzleri</b> ekranında konnektörlere atayın; port başına hız, adres gibi alanları geçersiz kılabilirsiniz. Kablajla bağlanan iki ucun protokolleri karşılaştırılır.</p>
    <div class="hccards">${L.map(p => { const u = hpUsers(p.id); return `<div class="hccard" data-hp6="open" data-k="${p.id}"><b class="noi18n">${esc(p.name)}</b><div class="muted">${esc(p.phy || '')}${p.baud ? ' · ' + (+p.baud).toLocaleString('tr-TR') + ' bit/s' : ''} · ${p.endian === 'little' ? 'LE' : 'BE'} · ${esc(p.crc || '')}</div><div class="muted">${(p.msgs || []).length} mesaj · ${u.length} arayüzde · ${hpAtts(p).length} ek</div></div>`; }).join('')}</div>
    <div class="hcsec">Bağlı arayüz çiftleri (${v.pairs.length})</div>
    <table class="hcpt"><thead><tr><th>Uç A</th><th>Uç B</th><th>Kablaj</th><th>Hat</th><th>Durum</th></tr></thead><tbody>${v.pairs.map(P => `<tr><td class="noi18n">${esc(hpIfLabel(P.a))}</td><td class="noi18n">${esc(hpIfLabel(P.b))}</td><td class="noi18n">${[...P.cables].map(c => esc(c.name)).join(', ')}</td><td>${P.lines.length}</td><td>${P.iss.length ? P.iss.map(([s, m]) => `<div style="color:${s === 'hata' ? '#c0392b' : '#b9770e'}">${hcSev(s)} ${esc(m)}</div>`).join('') : '<span style="color:#27ae60">✓ uyumlu</span>'}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Kablajla bağlı, iki ucunda da haberleşme arayüzü tanımlı çift yok.</td></tr>'}</tbody></table>
    ${iss.filter(x => x.sev === 'bilgi').length ? `<div class="muted" style="font-size:12px;margin-top:6px">${iss.filter(x => x.sev === 'bilgi').map(x => 'ℹ ' + esc(x.msg)).join('<br>')}</div>` : ''}</div>`;
}
function hpProfHTML(pr){
  const f = (k, l, t) => `<label>${esc(l)}${hpInput(pr, k, t, `data-hp6p="${k}"`)}</label>`, F = k => { const x = HP_FIELDS.find(y => y[0] === k); return f(k, x[1], x[2]); };
  const users = hpUsers(pr.id), iss = hpIssuesFor((a, b) => a.ifc.pr === pr.id || (b && b.ifc.pr === pr.id));
  let h = `<div style="padding:10px"><div class="hcform" style="grid-template-columns:2fr 1fr 1fr 2fr;margin-top:0">${f('name', 'Profil adı', 's')}${f('ver', 'Sürüm', 's')}${f('ref', 'Doküman referansı', 's')}${f('note', 'Açıklama', 's')}</div>
    <div class="hcsec">Fiziksel katman</div><div class="hcform" style="grid-template-columns:repeat(auto-fill,minmax(170px,1fr))">${['phy', 'baud', 'data', 'parity', 'stop', 'flow', 'addr'].map(F).join('')}</div>
    <div class="hcsec">Çerçeve yapısı</div><div class="hcform" style="grid-template-columns:repeat(auto-fill,minmax(170px,1fr))">${['endian', 'hdr', 'idOff', 'idSize', 'lenOff', 'lenSize', 'lenMode', 'tail', 'maxLen', 'period', 'timeout'].map(F).join('')}</div>
    <div class="hcsec">CRC / sağlama</div><div class="hcform" style="grid-template-columns:repeat(auto-fill,minmax(170px,1fr))">${['crc', 'crcPoly', 'crcInit', 'crcCov'].map(F).join('')}${pr.crc === 'Özel' ? f('crcW', 'CRC genişliği (bit)', 'n') : ''}</div>
    <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start"><div><div class="hcsec">Çerçeve düzeni</div><table class="hcpt"><thead><tr><th>Alan</th><th>Ofset</th><th>Boy (bayt)</th><th>Değer / açıklama</th></tr></thead><tbody>${hpFrame(pr).map(r => `<tr><td>${esc(r.name)}</td><td>${esc(r.off)}</td><td>${esc(r.size)}</td><td class="noi18n">${esc(r.val)}</td></tr>`).join('')}</tbody></table></div>
    <div style="flex:1;min-width:380px"><div class="hcsec">Bu profili kullanan arayüzler (${users.length})</div><table class="hcpt"><thead><tr><th>Birim</th><th>Konnektör</th><th>Rol</th><th>Pinler</th><th>Geçersiz kılınan</th></tr></thead><tbody>${users.map(({p, ifc}) => `<tr><td class="noi18n"><a href="#" data-hcgo="${p.id}">${esc((E(p.owner) || {}).name || '')}</a></td><td class="noi18n">${esc(p.name)}</td><td>${esc((HP_ROLES.find(r => r[0] === (ifc.role || '')) || [0, ''])[1])}</td><td class="noi18n">${esc(hpIfPins(p, ifc).join(', '))}</td><td class="noi18n" style="font-size:11px">${esc(Object.entries(ifc.ov || {}).filter(([, v]) => v !== '' && v != null).map(([k, v]) => (HP_FIELDS.find(x => x[0] === k) || [0, k])[1] + ': ' + hpVal(k, v)).join('; '))}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Henüz bir konnektöre atanmadı (Birim arayüzleri → konnektör → Haberleşme arayüzleri).</td></tr>'}</tbody></table>
    ${iss.length ? `<div style="font-size:12px;margin-top:4px">${iss.map(x => `<div style="color:${x.sev === 'hata' ? '#c0392b' : x.sev === 'uyarı' ? '#b9770e' : '#667'}">${hcSev(x.sev)} ${esc(x.msg)}</div>`).join('')}</div>` : ''}</div></div>`;
  h += `<div class="hcsec">Mesajlar (${(pr.msgs || []).length}) <button class="vb" data-hp6="madd">+ Mesaj</button></div><table class="hcpt"><thead><tr><th>ID</th><th>Mesaj adı</th><th>Yön</th><th>Periyot (ms)</th><th>Veri boyu</th><th>Not</th><th></th></tr></thead><tbody>`;
  (pr.msgs || []).forEach(m => { const a = k => `data-hp6m="${m.id}|${k}"`, on = HPV.msg === m.id;
    h += `<tr${on ? ' style="background:#eef5ff"' : ''}><td><input ${a('mid')} value="${esc(m.mid)}" style="width:90px" class="noi18n"></td><td><input ${a('name')} value="${esc(m.name)}" class="noi18n"></td><td><select ${a('dir')}>${[['M>S', 'Ana → uç'], ['S>M', 'Uç → ana'], ['P', 'Çift yönlü / eşdüzey']].map(([x, y]) => hcOpt(x, y, m.dir)).join('')}</select></td><td><input ${a('period')} value="${esc(m.period == null ? '' : m.period)}" style="width:70px"></td><td>${hpMsgLen(m)} bayt</td><td><input ${a('note')} value="${esc(m.note || '')}"></td>
      <td style="white-space:nowrap"><button class="vb${on ? ' pri' : ''}" data-hp6="mfld" data-k="${m.id}">Alanlar (${(m.fields || []).length}) ${on ? '▴' : '▾'}</button> <button class="vb" data-hp6="mdel" data-k="${m.id}" style="color:#c0392b">✕</button></td></tr>`;
    if(on){ let off = 0;
      h += `<tr><td colspan="7" style="padding:4px 4px 10px 28px;background:#f8fafd"><table class="hcpt" style="width:100%"><thead><tr><th>Ofset</th><th>Alan adı</th><th>Tip</th><th>Boy (bayt)</th><th>Birim</th><th>LSB / ölçek</th><th>Min</th><th>Maks</th><th>Açıklama</th><th></th></tr></thead><tbody>${(m.fields || []).map((fl, i) => { const b = k => `data-hp6x="${m.id}|${i}|${k}"`, o = off; off += hcNum(fl.size) || (HP_FTYPES.find(t => t[0] === fl.type) || [0, 0])[1] || 0;
        return `<tr><td>${o}</td><td><input ${b('name')} value="${esc(fl.name)}" class="noi18n"></td><td><select ${b('type')}>${HP_FTYPES.map(([t]) => hcOpt(t, t, fl.type)).join('')}</select></td><td><input ${b('size')} value="${esc(fl.size == null ? '' : fl.size)}" style="width:50px"></td><td><input ${b('unit')} value="${esc(fl.unit || '')}" style="width:60px"></td><td><input ${b('scale')} value="${esc(fl.scale || '')}" style="width:60px"></td><td><input ${b('min')} value="${esc(fl.min || '')}" style="width:60px"></td><td><input ${b('max')} value="${esc(fl.max || '')}" style="width:60px"></td><td><input ${b('note')} value="${esc(fl.note || '')}"></td><td><button class="vb" data-hp6="xdel" data-k="${m.id}" data-i="${i}">✕</button></td></tr>`; }).join('')}</tbody></table><button class="vb" data-hp6="xadd" data-k="${m.id}">+ Alan</button> <span class="muted" style="font-size:11px">Bayt sırası profildeki ayara (${pr.endian === 'little' ? 'little' : 'big'} endian) göredir. Boy boşsa tipten alınır.</span></td></tr>`; }
  });
  h += `</tbody></table>` + hpAttHTML(pr, 'pr') + '</div>';
  return h;
}
VIEWS['@hcproto'] = {tr:'Haberleşme Protokolleri', ic:'ICD', note:'<b>Protokol profili:</b> fiziksel katman (RS-422, CAN, 1553, Ethernet…), hız, veri/eşlik/dur biti, bayt sırası (endian), başlık baytları, komut ID ve uzunluk alanlarının yeri, CRC tipi / polinomu / kapsamı, mesaj listesi ve mesaj alanları.<br><br>Profiller konnektörlere <b>Birim arayüzleri</b> ekranından atanır; port başına adres, hız gibi alanlar geçersiz kılınabilir.<br><br>Kablajla bağlanan uçlarda fiziksel katman, hız, çerçeve, endian, CRC ve mesaj farkları <b>uyumsuzluk</b> olarak raporlanır.<br><br><b>Yazılım ICD</b>: Word ve Excel.', render:hpHTML, bar:hpBar, status:() => { const v = hpPairs(); return hpList().length + ' profil · ' + v.pairs.length + ' bağlı çift · ' + v.pairs.filter(P => P.iss.some(x => x[0] === 'hata')).length + ' uyumsuz'; }};
function hpRefresh(){ if(typeof ST !== 'undefined' && /^@hc/.test(ST.cur || '')){ renderViewBar(); renderView(); } }
/* ---------- birim arayüzleri: konnektörde haberleşme arayüzleri + ekler ---------- */
function hpPortBlock(p){
  const L = hpIfs(p), prs = hpList(), iss = hpIssuesFor((a, b) => a.p === p || (b && b.p === p));
  let h = `<div style="border:1px solid #dde;border-radius:6px;padding:6px 8px;margin:4px 0 8px;background:#fbfcfe"><div class="hcsec" style="margin-top:0">Haberleşme arayüzleri <span class="muted" style="font-weight:400;font-size:11px">bir konnektörde birden çok arayüz olabilir (ör. RS-422 + CAN); pin listesi boşsa konnektörün haberleşme pinleri</span></div>
    <table class="hcpt"><thead><tr><th>Protokol profili</th><th>Rol</th><th>Pinler</th><th>Geçersiz kılınan alanlar</th><th>Not</th><th></th></tr></thead><tbody>${L.map(ifc => { const a = k => `data-hp6i="${ifc.id}|${k}"`;
      return `<tr><td><select ${a('pr')} class="noi18n">${hcOpt('', '— profil seçin —', ifc.pr)}${prs.map(x => hcOpt(x.id, x.name, ifc.pr)).join('')}</select></td><td><select ${a('role')}>${HP_ROLES.map(([x, y]) => hcOpt(x, y, ifc.role || '')).join('')}</select></td>
        <td><input ${a('pins')} value="${esc((ifc.pins || []).join(', '))}" placeholder="${esc(hpIfPins(p, ifc).join(', ') || 'tümü')}" style="width:120px" class="noi18n"></td><td class="noi18n" style="font-size:11px">${esc(Object.entries(ifc.ov || {}).filter(([, v]) => v !== '' && v != null).map(([k, v]) => (HP_FIELDS.find(x => x[0] === k) || [0, k])[1] + ': ' + hpVal(k, v)).join('; ')) || '<span class="muted">—</span>'}</td>
        <td><input ${a('note')} value="${esc(ifc.note || '')}"></td><td style="white-space:nowrap"><button class="vb" data-hp6="ov" data-k="${ifc.id}"${hpGet(ifc.pr) ? '' : ' disabled'}>Geçersiz kıl…</button> <button class="vb" data-hp6="popen" data-k="${ifc.pr}"${hpGet(ifc.pr) ? '' : ' disabled'}>Profili aç</button> <button class="vb" data-hp6="idel" data-k="${ifc.id}" style="color:#c0392b">✕</button></td></tr>`; }).join('') || '<tr><td colspan="6" class="muted">Tanımlı haberleşme arayüzü yok</td></tr>'}</tbody></table>
    <button class="vb" data-hp6="iadd">+ Haberleşme arayüzü</button> <button class="vb" data-hp6="pnew" title="Yeni bir protokol profili oluştur ve bu konnektöre ata">+ Yeni profil oluştur ve ata</button>
    ${iss.length ? `<div style="font-size:12px;margin-top:4px">${iss.map(x => `<div style="color:${x.sev === 'hata' ? '#c0392b' : x.sev === 'uyarı' ? '#b9770e' : '#667'}">${hcSev(x.sev)} ${esc(x.msg)}</div>`).join('')}</div>` : ''}
    ${hpAttHTML(p, 'port')}</div>`;
  return h;
}
{ const _ph = hcPortHTML; hcPortHTML = function(p){ const h = _ph.apply(this, arguments), mk = 'Arayüzü sil</button></div>', i = h.indexOf(mk); return i < 0 ? h + hpPortBlock(p) : h.slice(0, i + mk.length) + hpPortBlock(p) + h.slice(i + mk.length); }; }
/* sistem şemasında konnektör rozetleri (protokol, ek sayısı) */
function hcPortBadgeLen(p){ const m = hcPortBadge(p, 0, 0).match(/>([^<]*)<\/text>/); return m ? m[1].replace(/&[a-z]+;/g, '&').length : 0; }
function hcPortBadge(p, x, y){ const L = hpIfs(p), A = hpAtts(p); if(!L.length && !A.length) return '';
  const ab = ph => ({'CAN 2.0A':'CAN', 'CAN 2.0B':'CAN', 'MIL-STD-1553B':'1553', 'ARINC 429':'A429', 'Ethernet UDP':'ETH', 'Ethernet TCP':'ETH', 'SpaceWire':'SpW', 'LVDS (özel)':'LVDS'})[ph] || ph;
  const t = [...new Set(L.map(i => ab((hpEff(i) || {}).phy)).filter(Boolean))].join('+') + (A.length ? ' 📎' + A.length : '');
  return `<text x="${x}" y="${y}" font-size="9.5" text-anchor="end" fill="#6c3483" data-hp6port="${p.id}" style="cursor:pointer" class="noi18n">${esc(t)}</text>`; }
function hpPortMenu(pid, ev){ const p = E(pid); if(!p) return; const items = [];
  hpIfs(p).forEach(ifc => { const pr = hpGet(ifc.pr); if(pr) items.push({t:'Protokol: ' + pr.name + (ifc.role ? ' (' + ifc.role + ')' : ''), f:() => { HPV.sel = pr.id; openD('@hcproto'); }}); hpAtts(pr || {}).forEach(f => items.push({t:'📎 ' + f.name + ' (profil)', f:() => hpOpen(f.id)})); });
  hpAtts(p).forEach(f => items.push({t:'📎 ' + f.name, f:() => hpOpen(f.id)}));
  items.push('-', {t:'Arayüz ayrıntıları (pinout, protokol, ekler)…', f:() => { HC.unit = p.owner; HC.port = p.id; openD('@hcunits'); }});
  menu(ev.clientX, ev.clientY, items); }
/* ---------- yazılım ICD: Word ve Excel ---------- */
function hpIcdBlocks(L){
  const B = [], H = (lv, x) => B.push({t:'h', lv, x}), P = x => B.push({t:'p', x}), TB = (head, rows, w) => B.push({t:'table', head, rows, w});
  H(1, '1. Kapsam'); P('Bu doküman, modeldeki haberleşme protokol profillerini (fiziksel katman, çerçeve yapısı, CRC, mesaj listesi ve mesaj alanları) ve bu profilleri kullanan birim arayüzlerini tanımlar.');
  TB(['Profil', 'Fiziksel katman', 'Hız (bit/s)', 'Endian', 'CRC', 'Mesaj', 'Kullanan arayüz'], L.map(pr => [pr.name, pr.phy || '', pr.baud ? (+pr.baud).toLocaleString('tr-TR') : '', hpVal('endian', pr.endian), pr.crc || '', (pr.msgs || []).length, hpUsers(pr.id).length]), [24, 14, 12, 14, 16, 8, 12]);
  L.forEach((pr, i) => { const n = i + 2;
    H(1, `${n}. ${pr.name}`); if(pr.note) P(pr.note);
    H(2, `${n}.1 Fiziksel katman ve çerçeve parametreleri`);
    TB(['Parametre', 'Değer'], [['Sürüm', pr.ver || ''], ['Doküman referansı', pr.ref || '']].concat(HP_FIELDS.filter(([k]) => pr[k] !== '' && pr[k] != null).map(([k, l]) => [l, hpVal(k, pr[k])])), [40, 60]);
    H(2, `${n}.2 Çerçeve düzeni`); TB(['Alan', 'Ofset', 'Boy (bayt)', 'Değer / açıklama'], hpFrame(pr).map(r => [r.name, String(r.off), String(r.size), r.val]), [28, 14, 14, 44]);
    H(2, `${n}.3 Mesaj listesi`); TB(['ID', 'Mesaj', 'Yön', 'Periyot (ms)', 'Veri boyu (bayt)', 'Not'], (pr.msgs || []).map(m => [m.mid, m.name, {'M>S':'Ana → uç', 'S>M':'Uç → ana', P:'Çift yönlü'}[m.dir] || '', m.period == null ? '' : String(m.period), String(hpMsgLen(m)), m.note || '']), [12, 26, 14, 12, 12, 24]);
    (pr.msgs || []).filter(m => (m.fields || []).length).forEach((m, j) => { H(3, `${n}.3.${j + 1} ${m.mid} ${m.name}`); let off = 0;
      TB(['Ofset', 'Alan', 'Tip', 'Boy', 'Birim', 'LSB', 'Aralık', 'Açıklama'], m.fields.map(f => { const o = off; off += hcNum(f.size) || (HP_FTYPES.find(t => t[0] === f.type) || [0, 0])[1] || 0; return [String(o), f.name, f.type, String(f.size || ''), f.unit || '', f.scale || '', [f.min, f.max].filter(x => x !== '' && x != null).join(' … '), f.note || '']; }), [8, 20, 10, 7, 9, 9, 13, 24]); });
    const us = hpUsers(pr.id); H(2, `${n}.4 Kullanan arayüzler`);
    if(us.length) TB(['Birim', 'Konnektör', 'Rol', 'Pinler', 'Geçersiz kılınan alanlar'], us.map(({p, ifc}) => [(E(p.owner) || {}).name || '', p.name, (HP_ROLES.find(r => r[0] === (ifc.role || '')) || [0, ''])[1], hpIfPins(p, ifc).join(', '), Object.entries(ifc.ov || {}).filter(([, v]) => v !== '' && v != null).map(([k, v]) => (HP_FIELDS.find(x => x[0] === k) || [0, k])[1] + ': ' + hpVal(k, v)).join('; ')]), [20, 12, 20, 18, 30]); else P('Bu profil henüz bir arayüze atanmadı.');
    const at = hpAtts(pr).concat(...us.map(({p}) => hpAtts(p))); if(at.length){ H(2, `${n}.5 Ekli dokümanlar`); TB(['Dosya', 'Boyut', 'Sürüm'], [...new Set(at)].map(f => [f.name, hpSize(f.size), String(f.rev || 1)]), [60, 20, 20]); }
  });
  const iss = hpIssuesFor(); H(1, `${L.length + 2}. Uyumluluk bulguları`);
  if(iss.length) TB(['Önem', 'Bulgu'], iss.map(x => [x.sev, x.msg]), [12, 88]); else P('Kablajla bağlı arayüz çiftlerinde protokol uyumsuzluğu yok.');
  return B;
}
async function hpIcdDocx(){ const L = HPV.sel ? [hpGet(HPV.sel)] : hpList(); const nm0 = L.length === 1 ? L[0].name : E(M.rootId).name;
  download(await buildDocx(hpIcdBlocks(L), {kind:'icd', title:nm0 + ' Yazılım Arayüz Kontrol Dokümanı', subtitle:'Yazılım ICD — haberleşme protokolleri', author:typeof userName === 'function' ? userName() : ''}), fileSafe(nm0) + ' - Yazılım ICD.docx'); }
function hpIcdXlsx(){ const L = HPV.sel ? [hpGet(HPV.sel)] : hpList(), hd = a => a.map(v => ({v, s:1})), nm0 = L.length === 1 ? L[0].name : E(M.rootId).name;
  download(buildXlsx([
    {name:'Profiller', rows:[hd(['Profil', 'Sürüm', 'Referans'].concat(HP_FIELDS.map(f => f[1])))].concat(L.map(pr => [pr.name, pr.ver || '', pr.ref || ''].concat(HP_FIELDS.map(([k]) => pr[k] == null ? '' : hpVal(k, pr[k]) === '—' ? '' : hpVal(k, pr[k]))))), widths:[28, 8, 16].concat(HP_FIELDS.map(() => 14)), header:true, freeze:[1, 1]},
    {name:'Mesajlar', rows:[hd(['Profil', 'ID', 'Mesaj', 'Yön', 'Periyot (ms)', 'Veri boyu', 'Not'])].concat(L.flatMap(pr => (pr.msgs || []).map(m => [pr.name, m.mid, m.name, m.dir, m.period == null ? '' : m.period, hpMsgLen(m), m.note || '']))), widths:[28, 12, 26, 8, 10, 10, 30], header:true},
    {name:'Alanlar', rows:[hd(['Profil', 'Mesaj ID', 'Mesaj', 'Ofset', 'Alan', 'Tip', 'Boy', 'Birim', 'LSB', 'Min', 'Maks', 'Açıklama'])].concat(L.flatMap(pr => (pr.msgs || []).flatMap(m => { let off = 0; return (m.fields || []).map(f => { const o = off; off += hcNum(f.size) || (HP_FTYPES.find(t => t[0] === f.type) || [0, 0])[1] || 0; return [pr.name, m.mid, m.name, o, f.name, f.type, f.size || '', f.unit || '', f.scale || '', f.min || '', f.max || '', f.note || '']; }); }))), widths:[24, 12, 22, 7, 22, 10, 6, 8, 8, 8, 8, 30], header:true},
    {name:'Arayüzler', rows:[hd(['Profil', 'Birim', 'Konnektör', 'Rol', 'Pinler', 'Geçersiz kılınan'])].concat(L.flatMap(pr => hpUsers(pr.id).map(({p, ifc}) => [pr.name, (E(p.owner) || {}).name || '', p.name, ifc.role || '', hpIfPins(p, ifc).join(', '), Object.entries(ifc.ov || {}).filter(([, v]) => v !== '' && v != null).map(([k, v]) => k + '=' + v).join('; ')]))), widths:[24, 20, 10, 6, 18, 40], header:true},
    {name:'Uyumluluk', rows:[hd(['Önem', 'Bulgu'])].concat(hpIssuesFor().map(x => [x.sev, x.msg])), widths:[10, 120], header:true}
  ]), fileSafe(nm0) + ' - Yazılım ICD.xlsx'); }
/* ---------- olaylar ---------- */
function hpOvDialog(p, ifc){ const e = hpEff(ifc), pr = hpGet(ifc.pr), keys = ['baud', 'addr', 'data', 'parity', 'stop', 'endian', 'crc', 'period', 'timeout'];
  quickForm(`${p.name}: ${pr.name} alanlarını geçersiz kıl`, keys.map(k => ({k, l:(HP_FIELDS.find(x => x[0] === k) || [0, k])[1] + ' (profil: ' + hpVal(k, pr[k]) + ')', v:(ifc.ov || {})[k] == null ? '' : ifc.ov[k]})), r => { snap(); const ov = {}; keys.forEach(k => { if(r[k] !== '' && String(r[k]) !== String(pr[k] == null ? '' : pr[k])) ov[k] = /^(baud|data|stop|period|timeout)$/.test(k) && hcNum(r[k]) != null ? hcNum(r[k]) : r[k]; }); ifc.ov = ov; afterChange(); hpRefresh(); }, 'Boş bırakılan alan profildeki değeri kullanır. Eşlik: N / E / O; bayt sırası: big / little; CRC: profil listesindeki ad. Etkin değer: ' + esc([e.phy, e.baud, e.endian].join(' · ')));
  const ok = $('#qfO'); if(ok) ok.textContent = 'Kaydet'; }
(() => {
  const V = $('#view'), onP = () => ST.cur === '@hcproto', onU = () => ST.cur === '@hcunits';
  const save = f => { snap(); f(); afterChange(); hpRefresh(); };
  V.addEventListener('keydown', ev => { if((onP() || onU()) && ev.target.matches && ev.target.matches('[data-hp6p],[data-hp6m],[data-hp6x],[data-hp6i]')){ ev.stopPropagation(); if(ev.key === 'Enter') ev.target.blur(); } });
  V.addEventListener('change', ev => {
    const t = ev.target, d = t.dataset;
    if(onP() && d.hp6f === 'sel'){ HPV.sel = t.value; HPV.msg = ''; renderViewBar(); renderView(); return; }
    const num = v => v === '' ? '' : hcNum(v) == null ? v : hcNum(v);
    if(onP() && d.hp6p){ const pr = hpGet(HPV.sel); if(!pr) return; const k = d.hp6p, F = HP_FIELDS.find(x => x[0] === k), v = t.value.trim();
      return save(() => { hpM(); const P = hpGet(HPV.sel); if(k === 'name' && !v) return; P[k] = F && F[2] === 'n' ? num(v) : v;
        if(k === 'crc' && HP_CRC[v]){ const c = HP_CRC[v]; if(v !== 'Özel'){ P.crcPoly = c.poly || ''; P.crcInit = c.init || ''; } }
        if(k === 'phy'){ const ph = (HP_PHY.find(x => x[0] === v) || [0, {}])[1]; if(ph.baud && !P.baud) P.baud = ph.baud; } }); }
    if(onP() && d.hp6m){ const [mid, k] = d.hp6m.split('|'); return save(() => { hpM(); const m = (hpGet(HPV.sel).msgs || []).find(x => x.id === mid); if(m) m[k] = k === 'period' ? num(t.value.trim()) : t.value.trim(); }); }
    if(onP() && d.hp6x){ const [mid, i, k] = d.hp6x.split('|'); return save(() => { hpM(); const m = (hpGet(HPV.sel).msgs || []).find(x => x.id === mid), f = m && m.fields[+i]; if(!f) return; f[k] = k === 'size' ? num(t.value.trim()) : t.value.trim();
      if(k === 'type'){ const ft = HP_FTYPES.find(x => x[0] === f.type); if(ft && ft[1]) f.size = ft[1]; } }); }
    if(onU() && d.hp6i){ const p = E(HC.port); if(!p) return; const [iid, k] = d.hp6i.split('|'); return save(() => { const ifc = hpIfs(p).find(x => x.id === iid); if(!ifc) return;
      if(k === 'pins') ifc.pins = t.value.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean); else ifc[k] = t.value; if(k === 'pr'){ ifc.ov = {}; hpM(); } }); }
  });
  document.addEventListener('click', ev => {
    const bp = ev.target.closest && ev.target.closest('[data-hp6port]'); if(bp && ST.cur === '@hcsys'){ ev.preventDefault(); ev.stopPropagation(); return hpPortMenu(bp.dataset.hp6port, ev); }
    if(!onP() && !onU()) return; const b = ev.target.closest('[data-hp6]'); if(!b) return; ev.preventDefault();
    const a = b.dataset.hp6, k = b.dataset.k, pr = hpGet(HPV.sel), port = onU() ? E(HC.port) : null;
    const ownerOf = () => { const [kind, id] = (b.dataset.o || '').split('|'); return kind === 'port' ? E(id) : hpGet(id); };
    if(a === 'open' || a === 'popen'){ HPV.sel = k; HPV.msg = ''; if(a === 'popen') openD('@hcproto'); else { renderViewBar(); renderView(); } return; }
    if(a === 'new' || a === 'pnew') return quickForm('Yeni protokol profili', [{k:'name', l:'Profil adı', v:'Yeni protokol ' + (hpList().length + 1)}, {k:'phy', l:'Fiziksel katman (RS-422, CAN 2.0B, MIL-STD-1553B, Ethernet UDP…)', v:'RS-422'}], r => { if(!r.name) return 'Ad gerekli';
      snap(); const H = hpM(), ph = (HP_PHY.find(x => x[0].toLowerCase() === r.phy.toLowerCase()) || ['Diğer', {baud:0}]), id = uid('pr');
      H.protos.push({id, name:r.name, phy:ph[0], baud:ph[1].baud || '', data:HP_SERIAL.test(ph[0]) ? 8 : '', parity:HP_SERIAL.test(ph[0]) ? 'N' : '', stop:HP_SERIAL.test(ph[0]) ? 1 : '', flow:'', endian:'big', hdr:'', idOff:'', idSize:'', lenOff:'', lenSize:'', lenMode:'payload', crc:'Yok', crcPoly:'', crcInit:'', crcCov:'', tail:'', maxLen:'', period:'', timeout:'', ver:'A', ref:'', note:'', att:[], msgs:[]});
      if(a === 'pnew' && port){ port.hc.ifs = hpIfs(port).concat([{id:uid('if'), pr:id, role:'', pins:[], ov:{}, note:''}]); afterChange(); hpRefresh(); return; }
      HPV.sel = id; afterChange(); renderViewBar(); renderView(); });
    if(a === 'dup' && pr) return save(() => { const H = hpM(), c = JSON.parse(JSON.stringify(hpGet(HPV.sel))); c.id = uid('pr'); c.name += ' (kopya)'; c.att = []; H.protos.push(c); HPV.sel = c.id; });
    if(a === 'del' && pr){ const u = hpUsers(pr.id); if(u.length && !confirmDel(pr, u)) return; return save(() => { const H = hpM(); H.protos = H.protos.filter(x => x.id !== pr.id); HPV.sel = ''; }); }
    if(a === 'madd' && pr) return save(() => { hpM(); const P = hpGet(HPV.sel); P.msgs = P.msgs || []; const m = {id:uid('m'), mid:'0x' + (P.msgs.length + 1).toString(16).toUpperCase().padStart(2, '0'), name:'Yeni mesaj', dir:'M>S', period:'', note:'', fields:[]}; P.msgs.push(m); HPV.msg = m.id; });
    if(a === 'mdel' && pr) return save(() => { hpM(); const P = hpGet(HPV.sel); P.msgs = P.msgs.filter(m => m.id !== k); });
    if(a === 'mfld'){ HPV.msg = HPV.msg === k ? '' : k; renderView(); return; }
    if(a === 'xadd' && pr) return save(() => { hpM(); const m = hpGet(HPV.sel).msgs.find(x => x.id === k); m.fields = m.fields || []; m.fields.push({name:'Alan ' + (m.fields.length + 1), type:'u8', size:1, unit:'', scale:'', min:'', max:'', note:''}); });
    if(a === 'xdel' && pr) return save(() => { hpM(); const m = hpGet(HPV.sel).msgs.find(x => x.id === k); m.fields.splice(+b.dataset.i, 1); });
    if(a === 'docx') return hpIcdDocx();
    if(a === 'xlsx') return hpIcdXlsx();
    if(a === 'stat') return hpStat().then(n => { if(n){ afterChange(); hpRefresh(); } toast(n ? n + ' ek güncellendi' : 'Eklerde değişiklik yok'); });
    if(a === 'iadd' && port) return save(() => { hpM(); port.hc.ifs = hpIfs(port).concat([{id:uid('if'), pr:(hpList()[0] || {}).id || '', role:'', pins:[], ov:{}, note:''}]); });
    if(a === 'idel' && port) return save(() => { port.hc.ifs = hpIfs(port).filter(x => x.id !== k); });
    if(a === 'ov' && port){ const ifc = hpIfs(port).find(x => x.id === k); if(ifc) hpOvDialog(port, ifc); return; }
    if(a === 'fadd'){ const o = ownerOf(); if(o){ if(o.kind !== 'Port') hpM(); hpAttach(o.kind === 'Port' ? o : hpGet(o.id)); } return; }
    if(a === 'fupd'){ const o = ownerOf(); if(o) hpAttach(o, k); return; }
    if(a === 'fopen') return hpOpen(k);
    if(a === 'fsave') return hpSaveAs(k);
    if(a === 'fdel'){ const o = ownerOf(); if(o) hpUnlink(o.kind === 'Port' ? o : hpGet(o.id), k); return; }
  }, true);
})();
function confirmDel(pr, u){ toast(`"${pr.name}" ${u.length} arayüzde kullanılıyor; önce arayüzlerden kaldırın (${u.slice(0, 3).map(x => (E(x.p.owner) || {}).name + ' ' + x.p.name).join(', ')}${u.length > 3 ? '…' : ''}).`); return false; }
/* konnektör çoğaltılınca arayüz kimlikleri yenilenir */
{ const _dm = delModel; delModel = function(ids){ const r = _dm.apply(this, arguments); if(M.hrn && M.hrn.files){ const used = new Set(); Object.values(M.els).forEach(p => ((p.hc || {}).att || []).forEach(x => used.add(x))); hpList().forEach(pr => (pr.att || []).forEach(x => used.add(x))); Object.keys(M.hrn.files).forEach(id => { if(!used.has(id)) delete M.hrn.files[id]; }); } return r; }; }
/* menü, iş akışı */
{ const _m = hcLibMenu; hcLibMenu = () => { const r = _m(); const i = r.findIndex(x => x && x.t && /^Kablaj test tanımı/.test(x.t)); r.splice(i < 0 ? r.length : i, 0, {t:'Haberleşme protokolleri ve yazılım ICD', f:() => openD('@hcproto')}); return r; }; }
if(typeof MENU_ADV !== 'undefined') MENU_ADV.analysis = new RegExp(MENU_ADV.analysis.source + '|^Haberleşme protokolleri');
if(typeof MENU_GROUPS !== 'undefined'){ const g = MENU_GROUPS.analysis.cls.find(x => x[0] === 'Kablaj ve konnektörler'); if(g) g[1] = new RegExp(g[1].source + '|Haberleşme protokol'); }
if(typeof WF_STEPS !== 'undefined'){ const s = WF_STEPS.find(x => /^Arayüzleri ve kablajı tasarla$/.test(x.t)); if(s) s.a.push(['Haberleşme protokolleri', /^Haberleşme protokolleri/]); }
