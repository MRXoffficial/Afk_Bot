import { NodeJS } from 'capacitor-nodejs'
import { registerPlugin } from '@capacitor/core'

// Android'e ozel kucuk eklenti (android-ekler/ icindeki Java dosyalari): on plan servisi + pil izni
const KeepAlive = registerPlugin('KeepAlive')

const $ = (id) => document.getElementById(id)
const el = {
  levha: document.querySelector('.levha'),
  asama: $('asama'), hesapSatiri: $('hesapSatiri'),
  kullanici: $('kullanici'), sifre: $('sifre'), alici: $('alici'), otomatik: $('otomatik'), onay: $('onay'),
  hata: $('hata'), baslat: $('baslat'), durdur: $('durdur'),
  takas: $('takas'), skor: $('skor'), pil: $('pil'), sil: $('sil'), gunluk: $('gunluk')
}

let calisiyor = false
let kayitli = false
let servisAcik = false

function gonder(eventName, ...args) {
  NodeJS.send({ eventName, args })
}

function hataGoster(mesaj) {
  el.hata.textContent = mesaj || ''
  el.hata.hidden = !mesaj
}

function logEkle(satir) {
  const alta = el.gunluk.scrollTop + el.gunluk.clientHeight >= el.gunluk.scrollHeight - 30
  el.gunluk.textContent += (el.gunluk.textContent ? '\n' : '') + satir
  if (el.gunluk.textContent.length > 20000) el.gunluk.textContent = el.gunluk.textContent.slice(-15000)
  if (alta) el.gunluk.scrollTop = el.gunluk.scrollHeight
}

async function servisAyarla(ac) {
  if (ac === servisAcik) return
  try {
    if (ac) await KeepAlive.start()
    else await KeepAlive.stop()
    servisAcik = ac
  } catch (e) {
    logEkle('(Arka plan servisi ' + (ac ? 'acilamadi' : 'kapatilamadi') + ': ' + (e && e.message ? e.message : e) + ')')
  }
}

function butonlariGuncelle() {
  const dolu = el.kullanici.value.trim() && el.alici.value.trim() && (el.sifre.value || kayitli)
  el.baslat.hidden = calisiyor
  el.durdur.hidden = !calisiyor
  el.baslat.disabled = !(dolu && el.onay.checked)
  el.takas.disabled = !calisiyor
  for (const k of [el.kullanici, el.sifre, el.alici, el.otomatik, el.onay]) k.disabled = calisiyor
}

function durumCiz(d) {
  if (!d) return
  calisiyor = !!d.calisiyor
  kayitli = !!d.kayitli
  el.asama.textContent = d.asama || (calisiyor ? 'Calisiyor' : 'Durdu')
  el.levha.classList.toggle('calisiyor', calisiyor)
  if (d.kullanici && !el.kullanici.value) el.kullanici.value = d.kullanici
  if (d.alici && !el.alici.value) el.alici.value = d.alici
  if (!calisiyor || d.otomatik !== undefined) el.otomatik.checked = !!d.otomatik
  el.sifre.placeholder = kayitli ? 'Kayıtlı şifre kullanılacak' : 'Şifre'
  el.hesapSatiri.textContent = d.kullanici
    ? d.kullanici + ' hesabı, takas alacak hesap: ' + (d.alici || '-')
    : 'Henüz hesap girilmedi'
  if (kayitli && !el.onay.checked) el.onay.checked = true   // daha once onaylanmis ve kaydedilmis
  servisAyarla(calisiyor)
  butonlariGuncelle()
}

for (const k of [el.kullanici, el.sifre, el.alici, el.onay]) k.addEventListener('input', butonlariGuncelle)
el.onay.addEventListener('change', butonlariGuncelle)

el.baslat.addEventListener('click', () => {
  hataGoster('')
  gonder('baslat', {
    kullanici: el.kullanici.value.trim(),
    sifre: el.sifre.value,
    alici: el.alici.value.trim(),
    otomatik: el.otomatik.checked,
    onay: el.onay.checked
  })
  el.sifre.value = ''
})
el.durdur.addEventListener('click', () => { hataGoster(''); gonder('durdur') })
el.takas.addEventListener('click', () => gonder('trade'))
el.skor.addEventListener('click', () => gonder('skor'))
el.pil.addEventListener('click', async () => {
  try {
    const r = await KeepAlive.pilIzni()
    logEkle('Pil kısıtlaması: ' + (r && r.izinli ? 'kapalı (iyi)' : 'açık, açılan ekranda "Kısıtlama yok" seç'))
  } catch (e) { logEkle('Pil izni ekranı açılamadı') }
})
el.sil.addEventListener('click', () => {
  if (!confirm('Kayıtlı kullanıcı adı ve şifre silinsin mi? Bot da durdurulur.')) return
  gonder('sil')
  el.kullanici.value = ''
  el.alici.value = ''
  el.sifre.value = ''
  el.onay.checked = false
})

async function basla() {
  butonlariGuncelle()
  await NodeJS.whenReady()
  NodeJS.addListener('log', (e) => logEkle(e.args[0]))
  NodeJS.addListener('gecmis', (e) => { el.gunluk.textContent = ''; (e.args[0] || []).forEach(logEkle) })
  NodeJS.addListener('durum', (e) => durumCiz(e.args[0]))
  NodeJS.addListener('hata', (e) => hataGoster(e.args[0]))
  gonder('hazir')
}

basla().catch((e) => logEkle('Başlatılamadı: ' + (e && e.message ? e.message : e)))
