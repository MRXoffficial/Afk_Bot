// "cap add android" sonrasi calistirilir: Java eklentisini kopyalar, AndroidManifest'e izinleri ve servisi ekler,
// MainActivity'ye eklentiyi kaydeder. Tekrar calistirmak guvenlidir (ayni seyi iki kez eklemez).
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const KOK = process.env.ANDROID_KOK || 'android'
const JAVA_KOK = join(KOK, 'app/src/main/java')
const MANIFEST = join(KOK, 'app/src/main/AndroidManifest.xml')

function bul(klasor, ad) {
  if (!existsSync(klasor)) return null
  for (const x of readdirSync(klasor)) {
    const y = join(klasor, x)
    if (statSync(y).isDirectory()) { const r = bul(y, ad); if (r) return r }
    else if (x === ad) return y
  }
  return null
}

const mainYol = bul(JAVA_KOK, 'MainActivity.java')
if (!mainYol) {
  console.error('HATA: MainActivity.java bulunamadi (' + JAVA_KOK + '). Once "npx cap add android" calistir.')
  console.error('Kotlin sablonu kullaniliyorsa README\'deki "elle kurulum" bolumune bak.')
  process.exit(1)
}
let main = readFileSync(mainYol, 'utf8')
const paket = (main.match(/^package\s+([\w.]+);/m) || [])[1]
if (!paket) { console.error('HATA: MainActivity paket adi okunamadi'); process.exit(1) }
const javaKlasor = mainYol.slice(0, mainYol.lastIndexOf('/') === -1 ? mainYol.lastIndexOf('\\') : mainYol.lastIndexOf('/'))

// 1) Java dosyalari (paket adini MainActivity'ninkiyle esitle)
for (const ad of ['KeepAlivePlugin.java', 'KeepAliveService.java']) {
  let k = readFileSync(join('android-ekler', ad), 'utf8').replace(/^package\s+[\w.]+;/m, 'package ' + paket + ';')
  mkdirSync(javaKlasor, { recursive: true })
  writeFileSync(join(javaKlasor, ad), k)
  console.log('Kopyalandi: ' + join(javaKlasor, ad))
}

// 2) MainActivity: eklentiyi kaydet
if (!main.includes('KeepAlivePlugin')) {
  const bos = /public class MainActivity extends BridgeActivity\s*\{\s*\}/
  if (!bos.test(main)) {
    console.error('UYARI: MainActivity beklenen bicimde degil. registerPlugin(KeepAlivePlugin.class); satirini onCreate icinde super.onCreate\'den ONCE elle ekle.')
  } else {
    main = main.replace(bos, 'public class MainActivity extends BridgeActivity {\n    @Override\n    public void onCreate(Bundle savedInstanceState) {\n        registerPlugin(KeepAlivePlugin.class);\n        super.onCreate(savedInstanceState);\n    }\n}')
    if (!main.includes('import android.os.Bundle;')) main = main.replace(/^(package\s+[\w.]+;\s*)/m, '$1import android.os.Bundle;\n')
    writeFileSync(mainYol, main)
    console.log('MainActivity guncellendi')
  }
} else console.log('MainActivity zaten guncel')

// 3) AndroidManifest: izinler ve servis
if (!existsSync(MANIFEST)) { console.error('HATA: AndroidManifest.xml bulunamadi'); process.exit(1) }
let m = readFileSync(MANIFEST, 'utf8')
const izinler = [
  'android.permission.INTERNET',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
  'android.permission.WAKE_LOCK',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS'
]
const eksikIzin = izinler.filter((i) => !m.includes('"' + i + '"'))
if (eksikIzin.length) {
  m = m.replace('</manifest>', eksikIzin.map((i) => '    <uses-permission android:name="' + i + '" />').join('\n') + '\n</manifest>')
  console.log('Izinler eklendi: ' + eksikIzin.join(', '))
}
if (!m.includes('KeepAliveService')) {
  const servis = '        <service\n            android:name=".KeepAliveService"\n            android:exported="false"\n            android:foregroundServiceType="specialUse">\n            <property\n                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"\n                android:value="Oyun sunucusuna surekli acik kalan baglanti" />\n        </service>\n'
  m = m.replace(/[ \t]*<\/application>/, servis + '    </application>')
  console.log('Servis eklendi')
}
writeFileSync(MANIFEST, m)
console.log('Android ekleri tamam.')
