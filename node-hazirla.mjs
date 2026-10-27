// node-kaynak/index.js dosyasini static/nodejs/index.js olarak hazirlar.
// Varsayilan: kodu karistirir (obfuscate). Duz kopya icin:  OBF=0 npm run node:hazirla
import { execSync } from 'node:child_process'
import { copyFileSync, mkdirSync } from 'node:fs'

const kaynak = 'node-kaynak/index.js'
const hedef = 'static/nodejs/index.js'
mkdirSync('static/nodejs', { recursive: true })

if (process.env.OBF === '0') {
  copyFileSync(kaynak, hedef)
  console.log('Duz kopya yapildi (OBF=0): ' + hedef)
  process.exit(0)
}

try {
  execSync(
    'npx --no-install javascript-obfuscator ' + kaynak + ' --output ' + hedef +
    ' --target node --compact true --string-array true --string-array-encoding base64' +
    ' --string-array-threshold 1 --identifier-names-generator hexadecimal',
    { stdio: 'inherit' }
  )
  console.log('Kod karistirildi: ' + hedef)
} catch (e) {
  if (process.env.OBF_ZORUNLU === '1') { console.error('HATA: karistirma basarisiz (OBF_ZORUNLU=1)'); process.exit(1) }
  copyFileSync(kaynak, hedef)
  console.log('UYARI: karistirma basarisiz oldu, duz kopya yapildi: ' + hedef)
}
