'use strict'
// AFK Bot - Node tarafi (nodejs-mobile icinde calisir).
// Arayuz (WebView) ile 'bridge' uzerinden mesajlasir. Sohbet oyunu ve gunluk sayac yoktur.

const { channel, getDataPath } = require('bridge')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const mineflayer = require('mineflayer')

// ====== SABIT AYARLAR ======
const A = {
  HOST: 'oyna.aesirmc.com',
  PORT: 25565,
  VERSION: false,               // gerekirse '1.20.1' gibi yaz
  LOGIN_BEKLEME: 5000,          // girisden kac ms sonra /login
  USEITEM_BEKLEME: 5000,        // /login'den kac ms sonra menu
  MENU_ESYA_SLOT: 1,            // lobide menu esyasinin hotbar slotu (1-9)
  SLOT: 30,                     // menude Prison'un slotu
  TIKLAMA_BEKLEME: 5000,        // menu acildiktan sonra tiklamadan once
  MENU_SONRASI_BEKLEME: 10000,  // Prison tiklandiktan sonra /warp afk'a kadar
  WARP_KOMUTU: '/warp afk',
  WARP_BEKLEME: 5000,           // /warp afk'tan sonra yuruyuse kadar
  WARP_TEKRAR: 2,               // isinlanma gorunmezse tekrar sayisi
  ISINLANMA_ESIK: 5,            // bu kadar blokdan az yer degistirdiyse isinlanma olmadi say
  YURUME_BLOK: 15,
  YURUME_ZAMAN_ASIMI: 20000,
  RESTART_SAAT: '06:05',        // restart sonrasi Prison'a gecis saati (Turkiye saati)
  TRADE_PAY: 100,               // tablodaki degerden en az bu kadar dusulur
  TRADE_ISINLANMA_BEKLEME: 10000,
  TRADE_ISTEK_BEKLEME: 5000,
  TRADE_PENCERE_ZAMAN_ASIMI: 40000,
  TRADE_ADIM_BEKLEME: 5000,
  TRADE_ONAY_SLOT: 45,          // onay blogu (46. slot = 45)
  TRADE_ONAY_BEKLEME: 6000,
  TRADE_SONRASI_BEKLEME: 5000,
  TRADE_ARALIK: 60000,
  TRADE_KALEMLER: [             // slot numaralari 0'dan baslar (2. slot = 1)
    { ad: 'JETON', anahtar: 'JETON', slot: 1, min: 1, aktif: true },
    { ad: 'MADEN RUHU', anahtar: 'MADEN RUHU', slot: 2, min: 1, aktif: true },
    { ad: 'MUCEVHER', anahtar: 'MUCEVHER', slot: 3, min: 1, aktif: true }
  ]
}
// ===========================

// ---------- Zaman (Turkiye UTC+3, Intl gerekmez) ----------
function simdi() {
  const d = new Date(Date.now() + 3 * 3600 * 1000)
  const p2 = (n) => String(n).padStart(2, '0')
  return {
    tarih: d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()),
    saat: p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()),
    saniyeli: p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()) + ':' + p2(d.getUTCSeconds()),
    dk: d.getUTCHours() * 60 + d.getUTCMinutes(),
    sn: d.getUTCSeconds()
  }
}

// Restart penceresindeyse (hedeften 5 dk once ile hedef arasi) hedefe kalan ms, degilse 0
function hedefeKalanMs() {
  const t = simdi()
  const [hh, mm] = A.RESTART_SAAT.split(':').map(Number)
  const hedefDk = hh * 60 + mm
  if (t.dk >= hedefDk - 5 && t.dk < hedefDk) return ((hedefDk - t.dk) * 60 - t.sn) * 1000
  return 0
}

const bekle = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------- Gunluk (arayuze gonderilir) ----------
const gunluk = []
function log(m) {
  const s = simdi().saniyeli + '  ' + m
  gunluk.push(s)
  if (gunluk.length > 300) gunluk.shift()
  try { channel.send('log', s) } catch (e) {}
}

// ---------- Kayit (AES-256-GCM, uygulamanin ozel klasorunde) ----------
const dosyaYolu = (ad) => path.join(getDataPath(), ad)

function anahtarAl() {
  const y = dosyaYolu('k.bin')
  try { return fs.readFileSync(y) } catch (e) {
    const k = crypto.randomBytes(32)
    fs.writeFileSync(y, k)
    return k
  }
}

function profilKaydet(profil) {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', anahtarAl(), iv)
  const enc = Buffer.concat([c.update(JSON.stringify(profil), 'utf8'), c.final()])
  fs.writeFileSync(dosyaYolu('a.bin'), JSON.stringify({ iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), v: enc.toString('base64') }))
}

function profilOku() {
  try {
    const d = JSON.parse(fs.readFileSync(dosyaYolu('a.bin'), 'utf8'))
    const dc = crypto.createDecipheriv('aes-256-gcm', anahtarAl(), Buffer.from(d.iv, 'base64'))
    dc.setAuthTag(Buffer.from(d.tag, 'base64'))
    return JSON.parse(Buffer.concat([dc.update(Buffer.from(d.v, 'base64')), dc.final()]).toString('utf8'))
  } catch (e) { return null }
}

function profilSil() {
  try { fs.unlinkSync(dosyaYolu('a.bin')) } catch (e) {}
}

// ---------- Metin bilesenleri ve skor tablosu ----------
function nbtSade(x) {
  if (x && typeof x === 'object' && typeof x.type === 'string' && 'value' in x) {
    const t = x.type, v = x.value
    if (t === 'compound') { const o = {}; for (const k in v) o[k] = nbtSade(v[k]); return o }
    if (t === 'list') return (v.value || []).map((e) => nbtSade({ type: v.type, value: e }))
    return v
  }
  return x
}

function bilesenMetni(x) {
  if (x === null || x === undefined) return ''
  if (typeof x === 'string') {
    const t = x.trim()
    if (t[0] === '{' || t[0] === '[' || t[0] === '"') { try { return bilesenMetni(JSON.parse(t)) } catch (e) {} }
    return x
  }
  if (typeof x === 'number' || typeof x === 'boolean') return String(x)
  if (Array.isArray(x)) return x.map(bilesenMetni).join('')
  if (typeof x === 'object') {
    if (typeof x.type === 'string' && 'value' in x) return bilesenMetni(nbtSade(x))
    let s = ''
    if (typeof x.text === 'string') s += x.text
    else if (x.text !== undefined) s += bilesenMetni(x.text)
    if (!s && typeof x.translate === 'string') s += x.translate
    if (x.extra !== undefined) s += bilesenMetni(x.extra)
    return s
  }
  return ''
}

function skorTemizle(s) {
  return String(s).replace(/§[0-9a-fk-or]/gi, '').replace(/[\uE000-\uF8FF]/g, '').replace(/\s+/g, ' ').trim()
}

const skorDurum = { hedefler: {}, sidebar: null, skorlar: {}, takimlar: {}, oyuncuTakim: {} }

function skorTakipBaslat(bot) {
  const c = bot._client
  if (!c) return
  Object.assign(skorDurum, { hedefler: {}, sidebar: null, skorlar: {}, takimlar: {}, oyuncuTakim: {} })
  c.on('scoreboard_objective', (p) => {
    if (p.action === 1) delete skorDurum.hedefler[p.name]
    else skorDurum.hedefler[p.name] = bilesenMetni(p.displayText)
  })
  c.on('scoreboard_display_objective', (p) => {
    if (p.position === 1 || p.position === 'sidebar') skorDurum.sidebar = p.name || null
  })
  c.on('scoreboard_score', (p) => {
    const hedef = p.scoreName !== undefined ? p.scoreName : p.objective_name
    const isim = p.itemName !== undefined ? p.itemName : p.entity_name
    if (hedef === undefined || isim === undefined) return
    if (p.action === 1) { if (skorDurum.skorlar[hedef]) delete skorDurum.skorlar[hedef][isim]; return }
    if (!skorDurum.skorlar[hedef]) skorDurum.skorlar[hedef] = {}
    skorDurum.skorlar[hedef][isim] = { deger: Number(p.value) || 0, gosterim: (p.display_name !== undefined && p.display_name !== null) ? bilesenMetni(p.display_name) : '' }
  })
  c.on('reset_score', (p) => {
    const hedef = p.scoreName !== undefined ? p.scoreName : (p.objective_name !== undefined ? p.objective_name : p.objectiveName)
    const isim = p.itemName !== undefined ? p.itemName : (p.entity_name !== undefined ? p.entity_name : p.entityName)
    if (isim === undefined) return
    if (hedef !== undefined && hedef !== null) { if (skorDurum.skorlar[hedef]) delete skorDurum.skorlar[hedef][isim] }
    else for (const h in skorDurum.skorlar) delete skorDurum.skorlar[h][isim]
  })
  const takimIsleyici = (p) => {
    const ad = p.team
    if (!ad) return
    const mod = typeof p.mode === 'number' ? ['add', 'remove', 'change', 'join', 'leave'][p.mode] : p.mode
    const oyuncular = Array.isArray(p.players) ? p.players : []
    if (mod === 'remove') {
      const t = skorDurum.takimlar[ad]
      if (t) t.oyuncular.forEach((o) => { delete skorDurum.oyuncuTakim[o] })
      delete skorDurum.takimlar[ad]
      return
    }
    let t = skorDurum.takimlar[ad]
    if (!t) t = skorDurum.takimlar[ad] = { prefix: '', suffix: '', oyuncular: [] }
    if (mod === 'add' || mod === 'change') { t.prefix = bilesenMetni(p.prefix); t.suffix = bilesenMetni(p.suffix) }
    if (mod === 'add' || mod === 'join') oyuncular.forEach((o) => { if (!t.oyuncular.includes(o)) t.oyuncular.push(o); skorDurum.oyuncuTakim[o] = ad })
    if (mod === 'leave') oyuncular.forEach((o) => { t.oyuncular = t.oyuncular.filter((x) => x !== o); delete skorDurum.oyuncuTakim[o] })
  }
  c.on('teams', takimIsleyici)
  c.on('scoreboard_team', takimIsleyici)
}

function skorSatirlari() {
  const hedef = skorDurum.sidebar
  if (!hedef) return null
  const ogeler = Object.entries(skorDurum.skorlar[hedef] || {}).sort((a, b) => b[1].deger - a[1].deger)
  const satirlar = []
  for (const [isim, o] of ogeler) {
    let metin
    if (o.gosterim) metin = o.gosterim
    else {
      const t = skorDurum.takimlar[skorDurum.oyuncuTakim[isim]]
      metin = (t ? t.prefix : '') + isim + (t ? t.suffix : '')
    }
    const temiz = skorTemizle(metin)
    if (temiz) satirlar.push(temiz)
  }
  return { baslik: skorTemizle(skorDurum.hedefler[hedef] || hedef), satirlar }
}

function skorYazdir() {
  const s = skorSatirlari()
  if (!s) { log('Skor tablosu henuz gelmedi (Prison\'a gectikten sonra dene)'); return }
  log('Skor tablosu: ' + s.baslik)
  s.satirlar.forEach((l) => log('   ' + l))
}

// ---------- Sayi cevirme (32.7K -> 32700) ----------
const KUCUK_HARF = { 'ᴀ': 'A', 'ʙ': 'B', 'ᴄ': 'C', 'ᴅ': 'D', 'ᴇ': 'E', 'ꜰ': 'F', 'ɢ': 'G', 'ʜ': 'H', 'ɪ': 'I', 'ᴊ': 'J', 'ᴋ': 'K', 'ʟ': 'L', 'ᴍ': 'M', 'ɴ': 'N', 'ᴏ': 'O', 'ᴘ': 'P', 'ǫ': 'Q', 'ʀ': 'R', 'ꜱ': 'S', 'ᴛ': 'T', 'ᴜ': 'U', 'ᴠ': 'V', 'ᴡ': 'W', 'ʏ': 'Y', 'ᴢ': 'Z', 'ı': 'I', 'İ': 'I', 'Ü': 'U', 'ü': 'U', 'Ö': 'O', 'ö': 'O', 'Ç': 'C', 'ç': 'C', 'Ş': 'S', 'ş': 'S', 'Ğ': 'G', 'ğ': 'G' }
const BIRIMLER = { '': 1, K: 1e3, M: 1e6, B: 1e9, T: 1e12 }

function duzYazi(s) {
  return String(s).split('').map((c) => KUCUK_HARF[c] || c).join('').toUpperCase()
}

function kisaSayiCoz(metin) {
  const m = String(metin).trim().match(/^([\d.,]+)\s*([A-Z]*)$/)
  if (!m) return null
  const birim = m[2]
  if (!(birim in BIRIMLER)) return null
  const sayi = birim ? m[1].replace(',', '.') : m[1].replace(/[.,]/g, '')
  const v = Number(sayi)
  if (!isFinite(v)) return null
  return Math.round(v * BIRIMLER[birim])
}

function kisaSayiAyrinti(metin) {
  const m = String(metin).trim().match(/^([\d.,]+)\s*([A-Z]*)$/)
  if (!m) return null
  const birim = m[2]
  if (!(birim in BIRIMLER)) return null
  let adim = 1
  if (birim) {
    const ondalik = m[1].replace(',', '.').split('.')[1]
    adim = BIRIMLER[birim] / Math.pow(10, ondalik ? ondalik.length : 0)
  }
  const sayi = kisaSayiCoz(metin)
  return sayi === null ? null : { sayi, adim }
}

function skorDegeri(anahtar) {
  const s = skorSatirlari()
  if (!s) return null
  const a = duzYazi(anahtar)
  for (const satir of s.satirlar) {
    const d = duzYazi(satir)
    const i = d.indexOf(a)
    if (i < 0) continue
    const kalan = d.slice(i + a.length).replace(/^[\s:]+/, '')
    const sayi = kisaSayiCoz(kalan)
    if (sayi !== null) return { satir, kalan, sayi }
  }
  return null
}

// Gonderilecek miktar = tablodaki deger - pay (pay en az TRADE_PAY, tablo cok yuvarlaksa yarim basamak)
function tradeHesap(anahtar) {
  const d = skorDegeri(anahtar)
  if (!d) return null
  const a = kisaSayiAyrinti(d.kalan)
  if (!a) return null
  const pay = Math.max(A.TRADE_PAY, Math.ceil(a.adim / 2))
  return { gosterilen: d.kalan, tablo: a.sayi, pay, gonderilecek: Math.max(0, a.sayi - pay) }
}

// ---------- Oturum durumu ----------
let elleDurduruldu = false   // kullanici Durdur'a bastiysa uygulama yeniden acilana kadar otomatik baslatma yapma
let S = null   // { profil, bot, calisiyor, asama, timers, tradeMesgul, sonTradeZamani, sonAkisZamani, sonZamanlayiciTarih, aktifAkis }

function canli(bot) { return !!S && S.calisiyor && S.bot === bot && !!bot.entity }

function asamaYaz(asama) {
  if (S) S.asama = asama
  durumGonder()
}

function durumGonder() {
  const k = profilOku()
  channel.send('durum', {
    calisiyor: !!(S && S.calisiyor),
    asama: S ? S.asama : 'Durdu',
    kayitli: !!k,
    kullanici: S ? S.profil.kullanici : (k ? k.kullanici : ''),
    alici: S ? S.profil.alici : (k ? k.alici : ''),
    otomatik: S ? !!S.profil.otomatik : (k ? !!k.otomatik : false)
  })
}

// ---------- Yurume ve warp ----------
function yuru(bot, hedef) {
  if (!bot.entity) { log('Yuruyus iptal: bot konumu yok'); return }
  const bas = { x: bot.entity.position.x, z: bot.entity.position.z }
  const baslangicZamani = Date.now()
  let sonKonum = { x: bas.x, z: bas.z }
  let sonKontrol = Date.now()
  log('Yuruyus basladi (' + hedef + ' blok)')
  bot.setControlState('forward', true)
  const sayac = setInterval(() => {
    if (!canli(bot)) { clearInterval(sayac); try { bot.setControlState('forward', false) } catch (e) {} return }
    const p = bot.entity.position
    const gidilen = Math.hypot(p.x - bas.x, p.z - bas.z)
    const durdur = (sebep) => {
      clearInterval(sayac)
      bot.setControlState('forward', false)
      bot.setControlState('jump', false)
      log(sebep + ': ' + gidilen.toFixed(1) + ' blok')
    }
    if (gidilen >= hedef) { durdur('Yuruyus bitti'); return }
    if (Date.now() - baslangicZamani > A.YURUME_ZAMAN_ASIMI) { durdur('Yuruyus zaman asimi'); return }
    if (Date.now() - sonKontrol > 1500) {
      const ilerleme = Math.hypot(p.x - sonKonum.x, p.z - sonKonum.z)
      bot.setControlState('jump', ilerleme < 0.3)
      sonKonum = { x: p.x, z: p.z }
      sonKontrol = Date.now()
    }
  }, 100)
}

// /warp afk yazar, konum degisimiyle isinlandigini dogrular, olmadiysa tekrar dener, sonra devam eder
function warpGit(bot, deneme, sonra) {
  const once = bot.entity ? { x: bot.entity.position.x, y: bot.entity.position.y, z: bot.entity.position.z } : null
  try { bot.chat(A.WARP_KOMUTU); log(A.WARP_KOMUTU + ' gonderildi' + (deneme > 0 ? ' (tekrar ' + deneme + ')' : '')) } catch (e) {}
  setTimeout(() => {
    if (!canli(bot)) return
    let tasindi = true
    if (once && bot.entity) {
      const p = bot.entity.position
      const mesafe = Math.hypot(p.x - once.x, p.y - once.y, p.z - once.z)
      tasindi = mesafe >= A.ISINLANMA_ESIK
      log('Isinlanma kontrolu: ' + mesafe.toFixed(1) + ' blok ' + (tasindi ? '(tamam)' : '(isinlanma gorunmuyor)'))
    }
    if (!tasindi && deneme < A.WARP_TEKRAR) { warpGit(bot, deneme + 1, sonra); return }
    sonra()
  }, A.WARP_BEKLEME)
}

// ---------- Takas (trade) ----------
function pencereBasligi(w) { return w ? skorTemizle(bilesenMetni(w.title)) : '' }
function takasPencereMi(w) { return !!w && duzYazi(pencereBasligi(w)).includes('TAKAS') }

function takasKarsiTaraf(w) {
  const t = pencereBasligi(w)
  const i = duzYazi(t).indexOf('TAKAS')
  if (i < 0) return ''
  return t.slice(i + 5).replace(/^[\s:]+/, '').split(/\s+/)[0] || ''
}

async function tradePencereBekle(bot, kosul, ms) {
  const bitis = Date.now() + ms
  while (Date.now() < bitis) {
    if (!canli(bot)) return false
    if (kosul(bot.currentWindow)) return true
    await bekle(250)
  }
  return false
}

function tradeTabelaBekle(bot, ms) {
  return new Promise((coz) => {
    const c = bot._client
    let bitti = false
    const dinle = (p) => { if (bitti) return; bitti = true; clearTimeout(z); coz(p) }
    const z = setTimeout(() => { if (bitti) return; bitti = true; c.removeListener('open_sign_entity', dinle); coz(null) }, ms)
    c.once('open_sign_entity', dinle)
  })
}

function tradeTabelaYaz(bot, p, metin) {
  bot._client.write('update_sign', { location: p.location, isFrontText: p.isFrontText !== undefined ? p.isFrontText : true, text1: metin, text2: '', text3: '', text4: '' })
}

function tradeIptal(bot, sebep) {
  log('TAKAS IPTAL: ' + sebep)
  try { if (bot.currentWindow) bot.closeWindow(bot.currentWindow) } catch (e) {}
}

async function tradeAfkaDon(bot) {
  if (!canli(bot)) { log('AFK donus iptal: bot sunucuda degil'); return }
  try { if (bot.currentWindow) bot.closeWindow(bot.currentWindow) } catch (e) {}
  log('Takas bitti, ' + (A.TRADE_SONRASI_BEKLEME / 1000) + ' sn sonra ' + A.WARP_KOMUTU + ' ile AFK bolgesine donuluyor')
  await bekle(A.TRADE_SONRASI_BEKLEME)
  if (!canli(bot)) return
  asamaYaz('AFK bolgesine donuluyor')
  await new Promise((coz) => {
    warpGit(bot, 0, () => { yuru(bot, A.YURUME_BLOK); asamaYaz('AFK bolgesinde'); coz() })
    setTimeout(coz, 60000)
  })
}

async function tradeBaslat(bot, kaynak) {
  if (!canli(bot)) { log('Takas yapilamadi: bot sunucuda degil'); return }
  if (S.tradeMesgul) { log('Takas zaten suruyor'); return }
  const gecen = Date.now() - S.sonTradeZamani
  if (gecen < A.TRADE_ARALIK) { log('Takas cok sik istendi, ' + Math.ceil((A.TRADE_ARALIK - gecen) / 1000) + ' sn sonra tekrar dene'); return }
  const alici = S.profil.alici
  S.tradeMesgul = true
  S.sonTradeZamani = Date.now()
  try {
    asamaYaz('Takas yapiliyor')
    log('TAKAS basladi (' + kaynak + ') -> alici: ' + alici)
    bot.chat('/tpa ' + alici)
    log('/tpa ' + alici + ' gonderildi, ' + (A.TRADE_ISINLANMA_BEKLEME / 1000) + ' sn bekleniyor')
    await bekle(A.TRADE_ISINLANMA_BEKLEME)
    if (!canli(bot)) return
    bot.chat('/trade ' + alici)
    log('/trade ' + alici + ' gonderildi, ' + (A.TRADE_ISTEK_BEKLEME / 1000) + ' sn bekleniyor')
    await bekle(A.TRADE_ISTEK_BEKLEME)

    if (!(await tradePencereBekle(bot, takasPencereMi, A.TRADE_PENCERE_ZAMAN_ASIMI))) { tradeIptal(bot, 'takas ekrani acilmadi (istek kabul edilmedi mi?)'); return }
    const karsi = takasKarsiTaraf(bot.currentWindow)
    if (duzYazi(karsi) !== duzYazi(alici)) { tradeIptal(bot, 'takas ekrani baska biriyle acildi: "' + karsi + '" (sadece ' + alici + ')'); return }
    log('Takas ekrani acildi: ' + pencereBasligi(bot.currentWindow))

    let gonderilen = 0
    for (const k of A.TRADE_KALEMLER) {
      if (!k.aktif) continue
      const h = tradeHesap(k.anahtar)
      if (!h) { log('TAKAS: ' + k.ad + ' skor tablosunda okunamadi, atlandi'); continue }
      if (h.gonderilecek < k.min) { log('TAKAS: ' + k.ad + ' cok az (' + h.gosterilen + '), atlandi'); continue }
      if (!takasPencereMi(bot.currentWindow) && !(await tradePencereBekle(bot, takasPencereMi, 10000))) { tradeIptal(bot, 'takas ekrani kapandi'); return }
      if (duzYazi(takasKarsiTaraf(bot.currentWindow)) !== duzYazi(alici)) { tradeIptal(bot, 'karsi taraf degisti'); return }
      log('TAKAS: ' + k.ad + ' -> tabloda ' + h.gosterilen + ' (' + h.tablo + ') - ' + h.pay + ' = ' + h.gonderilecek)
      const tabela = tradeTabelaBekle(bot, 10000)
      bot.clickWindow(k.slot, 0, 0).catch(() => {})
      const p = await tabela
      if (!p) { tradeIptal(bot, 'tabela ekrani acilmadi (' + k.ad + ', slot ' + k.slot + ')'); return }
      await bekle(1000)
      tradeTabelaYaz(bot, p, String(h.gonderilecek))
      log('Tabelaya yazildi: ' + h.gonderilecek)
      gonderilen++
      await bekle(A.TRADE_ADIM_BEKLEME)
    }
    if (gonderilen === 0) { tradeIptal(bot, 'gonderilecek bir sey yok'); return }

    if (!takasPencereMi(bot.currentWindow) && !(await tradePencereBekle(bot, takasPencereMi, 10000))) { tradeIptal(bot, 'onay oncesi takas ekrani kapandi'); return }
    bot.clickWindow(A.TRADE_ONAY_SLOT, 0, 0).catch(() => {})
    log('Onay verildi (slot ' + A.TRADE_ONAY_SLOT + '), ' + (A.TRADE_ONAY_BEKLEME / 1000) + ' sn bekleniyor')
    await bekle(A.TRADE_ONAY_BEKLEME)
    if (await tradePencereBekle(bot, (w) => !takasPencereMi(w), 30000)) log('TAKAS tamamlandi (takas ekrani kapandi)')
    else log('TAKAS: takas ekrani hala acik, karsi tarafin onayi bekleniyor olabilir')
  } catch (e) {
    log('TAKAS hata: ' + e.message)
    try { if (bot.currentWindow) bot.closeWindow(bot.currentWindow) } catch (x) {}
  } finally {
    try { await tradeAfkaDon(bot) } catch (e) { log('AFK donus hatasi: ' + e.message) }
    if (S) S.tradeMesgul = false
  }
}

// Ozel mesaj "<alici> ... trade" ise takasi baslatir (sadece alici hesaptan)
function tradeMesajKontrol(bot, msg) {
  if (!S) return
  const temiz = skorTemizle(msg)
  if (!/trade/i.test(temiz)) return
  const ad = S.profil.alici.replace(/[^A-Za-z0-9_]/g, '')
  const uygun = new RegExp('^[^A-Za-z0-9_]*' + ad + '(?![A-Za-z0-9_])', 'i').test(temiz) && /\btrade\s*$/i.test(temiz)
  if (uygun) { log('Takas mesaji alindi: ' + temiz); tradeBaslat(bot, 'mesaj') }
}

// ---------- Baglanti ve AFK dongusu ----------
function prisonAkisi(bot, kaynak) {
  if (!canli(bot)) return
  if (Date.now() - S.sonAkisZamani < 120000) return
  S.sonAkisZamani = Date.now()
  S.tiklandi = false
  log('Prison akisi basladi (' + kaynak + ')')
  asamaYaz('Prison\'a geciliyor')
  try { bot.setQuickBarSlot(A.MENU_ESYA_SLOT - 1) } catch (e) {}
  setTimeout(() => {
    if (!canli(bot)) return
    try { S.useitemGitti = true; bot.activateItem(); log('Menu acildi (useitem)') } catch (e) {}
  }, 500)
}

function baglan() {
  if (!S || !S.calisiyor) return
  asamaYaz('Baglaniyor')
  log('Baglaniyor: ' + A.HOST + ' (' + S.profil.kullanici + ')')
  const bot = mineflayer.createBot({
    host: A.HOST,
    port: A.PORT,
    username: S.profil.kullanici,
    auth: 'offline',
    ...(A.VERSION ? { version: A.VERSION } : {})
  })
  S.bot = bot
  S.girisYapildi = false
  S.useitemGitti = false
  S.tiklandi = false
  skorTakipBaslat(bot)
  bot.on('messagestr', (m, p) => { if (p !== 'game_info') tradeMesajKontrol(bot, m) })

  bot.on('spawn', () => {
    if (!S || S.bot !== bot || S.girisYapildi) return
    S.girisYapildi = true
    log('Sunucuya girildi')
    asamaYaz('Giris yapiliyor')
    setTimeout(() => {
      if (!canli(bot)) return
      try { bot.chat('/login ' + S.profil.sifre); log('/login gonderildi') } catch (e) {}
    }, A.LOGIN_BEKLEME)
    const normal = A.LOGIN_BEKLEME + A.USEITEM_BEKLEME
    const restart = hedefeKalanMs()
    if (restart > normal) log('Restart saati bekleniyor: ' + A.RESTART_SAAT + ' (' + Math.round(restart / 1000) + ' sn)')
    setTimeout(() => prisonAkisi(bot, 'giris'), Math.max(normal, restart))
  })

  bot.on('windowOpen', () => {
    if (!canli(bot) || !S.useitemGitti || S.tiklandi) return
    if (S.tradeMesgul) return
    S.tiklandi = true
    setTimeout(async () => {
      if (!canli(bot)) return
      try {
        await bot.clickWindow(A.SLOT, 0, 0)
        log('Slot ' + A.SLOT + ' tiklandi (Prison)')
      } catch (e) {
        log('Tiklama hatasi: ' + e.message)
        return
      }
      setTimeout(() => {
        if (!canli(bot)) return
        asamaYaz('Warp AFK\'ya gidiliyor')
        warpGit(bot, 0, () => { yuru(bot, A.YURUME_BLOK); asamaYaz('AFK bolgesinde') })
      }, A.MENU_SONRASI_BEKLEME)
    }, A.TIKLAMA_BEKLEME)
  })

  bot.on('kicked', (r) => log('Atildi: ' + skorTemizle(bilesenMetni(r))))
  bot.on('error', (e) => log('Hata: ' + e.message))
  bot.on('end', () => {
    if (!S || S.bot !== bot) return
    if (!S.calisiyor) return
    asamaYaz('Yeniden baglaniyor')
    log('Baglanti koptu, 10 sn sonra tekrar denenecek')
    S.timer = setTimeout(baglan, 10000)
  })
}

function oturumBaslat(profil, kaynak) {
  if (S && S.calisiyor) { log('Bot zaten calisiyor'); durumGonder(); return }
  S = { profil, bot: null, calisiyor: true, asama: 'Baslatiliyor', timer: null, tradeMesgul: false, sonTradeZamani: 0, sonAkisZamani: 0, sonZamanlayiciTarih: '', girisYapildi: false, useitemGitti: false, tiklandi: false }
  log('Baslatildi (' + kaynak + ')')
  baglan()
}

function oturumDurdur(sebep) {
  if (!S) { durumGonder(); return }
  S.calisiyor = false
  clearTimeout(S.timer)
  const bot = S.bot
  S.asama = 'Durdu'
  try { if (bot) bot.quit() } catch (e) {}
  log('Durduruldu' + (sebep ? ' (' + sebep + ')' : ''))
  S = null
  durumGonder()
}

// Her gun RESTART_SAAT'te bagliysa Prison akisini bastan calistir
setInterval(() => {
  if (!S || !S.calisiyor) return
  const t = simdi()
  if (t.saat !== A.RESTART_SAAT || S.sonZamanlayiciTarih === t.tarih) return
  S.sonZamanlayiciTarih = t.tarih
  if (S.bot && canli(S.bot) && !S.tradeMesgul) {
    log('Zamanlayici ' + A.RESTART_SAAT + ': lobiden Prison\'a geciliyor')
    prisonAkisi(S.bot, 'zamanlayici')
  } else {
    log('Zamanlayici ' + A.RESTART_SAAT + ': bot bagli degil, baglaninca akis kendiliginden calisir')
  }
}, 10000)

// ---------- Arayuz mesajlari ----------
const adGecerli = (s) => /^[A-Za-z0-9_]{3,16}$/.test(s || '')

channel.addListener('hazir', () => {
  channel.send('gecmis', gunluk.slice())
  durumGonder()
  const k = profilOku()
  if (k && k.otomatik && !S && !elleDurduruldu) oturumBaslat(k, 'otomatik baslatma')
})

channel.addListener('baslat', (veri) => {
  try {
    veri = veri || {}
    if (!veri.onay) { channel.send('hata', 'Devam etmek icin bilgilendirmeyi onaylamalisin.'); return }
    if (!adGecerli(veri.kullanici)) { channel.send('hata', 'Oyun hesabi adi 3-16 karakter olmali (harf, rakam, alt cizgi).'); return }
    if (!adGecerli(veri.alici)) { channel.send('hata', 'Takas alacak hesap adi 3-16 karakter olmali (harf, rakam, alt cizgi).'); return }
    if (veri.kullanici.toLowerCase() === veri.alici.toLowerCase()) { channel.send('hata', 'Takas alacak hesap, AFK hesabindan farkli olmali.'); return }
    const kayit = profilOku()
    let sifre = String(veri.sifre || '')
    if (!sifre && kayit && kayit.kullanici === veri.kullanici) sifre = kayit.sifre
    if (!sifre) { channel.send('hata', 'Sifre bos olamaz.'); return }
    if (sifre.length > 64 || /\s/.test(sifre)) { channel.send('hata', 'Sifre bosluk icermemeli ve en fazla 64 karakter olmali.'); return }
    const profil = { kullanici: veri.kullanici, sifre, alici: veri.alici, otomatik: !!veri.otomatik }
    profilKaydet(profil)
    elleDurduruldu = false
    oturumBaslat(profil, 'elle')
  } catch (e) { channel.send('hata', 'Baslatilamadi: ' + e.message) }
})

channel.addListener('durdur', () => { elleDurduruldu = true; oturumDurdur('elle') })
channel.addListener('trade', () => { if (S && S.bot) tradeBaslat(S.bot, 'elle'); else log('Takas icin once botu baslat') })
channel.addListener('skor', () => skorYazdir())
channel.addListener('sil', () => {
  elleDurduruldu = true
  if (S && S.calisiyor) oturumDurdur('kayitlar siliniyor')
  profilSil()
  log('Kayitli bilgiler silindi')
  durumGonder()
})

// nodejs-mobile'da yakalanmayan hata calisma ortamini kapatir ve yeniden baslatilamaz; bu yuzden yut ve yaz
process.on('uncaughtException', (e) => { log('Beklenmeyen hata: ' + (e && e.message)) })
process.on('unhandledRejection', (e) => { log('Beklenmeyen hata: ' + (e && e.message ? e.message : e)) })

log('AFK Bot hazir')
