# AFK Bot (APK projesi)

Oyun hesabı için telefonda çalışan AFK botu. Kullanıcı adı ve şifre uygulamanın içinden girilir.

**Ne yapar:** hesaba giriş yapar (`/login`), menüden Prison'u seçer, `/warp afk` bölgesine gidip 15 blok yürür ve orada bekler. Her gün 06:05'te lobiye düştüyse Prison'a geri döner. Takas alacak hesap bu hesaba özel mesajla `trade` yazarsa, hesaptaki **jeton, maden ruhu ve mücevheri** o hesaba takas eder, sonra AFK bölgesine döner. Sohbet oyunları ve günlük sayaç yoktur.

**Açıklık:** takas özelliği giriş ekranında açıkça yazılıdır ve "Okudum, kabul ediyorum" kutusu işaretlenmeden Başlat çalışmaz. Alıcı hesap, uygulamayı kullanan kişinin kendi girdiği hesaptır. Şifre yalnızca telefonda şifreli saklanır ve sunucuya sadece `/login` için gönderilir.

## Önce bilmen gerekenler (dürüst not)

Bu projedeki **Node.js tarafı ve arayüz mantığı** sahte sunucu ve sahte arayüzle baştan sona test edildi (giriş, Prison, `/warp afk`, yürüme, takas, 06:05, kayıt, durdurma). **Android derlemesi ve gerçek telefonda çalışması denenmedi**, çünkü hazırlandığı ortamda Android SDK ve internet yoktu. İlk derlemede hata çıkabilir. Çıkan hatanın tamamını kopyalayıp gönderirsen düzeltilir.

Bilinen riskler:

- Uygulama, Node.js'i telefona gömmek için `capacitor-nodejs` eklentisini kullanır. Eklentinin yazarı artık yeni projelerde önermiyor ve içindeki Node sürümü 18. Mineflayer Node 18'i destekler ama bu bir risk.
- Android, arka plandaki uygulamaları kapatabilir. Bu yüzden projede küçük bir "ön plan servisi" (Java) var. Telefonda **pil kısıtlamasını kapatmak** (uygulamadaki "Pil izni" düğmesi) şart.
- Uygulama büyük olur (yüz MB civarı) ve ilk açılışta dosyalar telefona açıldığı için bir iki dakika sürebilir.
- Mineflayer sürümü sunucunun Minecraft sürümüyle uyumlu olmalı. Termux'taki botunun çalıştığı sürümü kullan: `cd ~/mcbot && npm ls mineflayer` yaz, çıkan sürümü `static/nodejs/package.json` içindeki `mineflayer` satırına yaz.

## Derleme yolu A: GitHub ile (bilgisayara gerek yok)

1. github.com'da ücretsiz hesap aç, **New repository** ile (Private seçebilirsin) boş bir depo oluştur.
2. Bu zip'in içindeki **dosyaların hepsini** (klasörün kendisini değil, içindekileri; `.github` klasörü dahil) depoya yükle. Web arayüzünde "Add file > Upload files" ile sürükle bırak yapabilirsin. `.github` klasörü gizli görünebilir, yüklendiğinden emin ol.
3. Depoda **Actions** sekmesine gir, soldan **APK derle**'yi seç, **Run workflow**'a bas.
4. 10-20 dakika sonra çalışma yeşil olursa, çalışmanın sayfasının altındaki **Artifacts** bölümünden `afk-bot-apk`'yı indir. İçinden `app-debug.apk` çıkar.
5. Kırmızı olursa, hatalı adımı aç, en alttaki hata satırlarını kopyala ve gönder.

Eklenti indirilemezse `package.json` içindeki `capacitor-nodejs` adresindeki sürüm numarasını (`v1.0.0-beta.10`) github.com/hampoelz/Capacitor-NodeJS/releases sayfasındaki en yeni sürümle değiştir.

## Derleme yolu B: Bilgisayarda

Gerekenler: Node.js 22, JDK 21, Android Studio (içindeki Android SDK ile).

```
npm install
npm run node:kur
npm run hazirla
npm run android:ekle
npx cap sync android
cd android
./gradlew assembleDebug        # Windows'ta: gradlew.bat assembleDebug
```

APK şurada çıkar: `android/app/build/outputs/apk/debug/app-debug.apk`

Kodu değiştirdikten sonra tekrar derlemek için kökte `npm run apk` yeterli.

## Telefona kurulum ve ilk kullanım

1. APK'yı telefona at, aç. "Bilinmeyen kaynaklardan yükle" izni isteyebilir. Play Protect uyarı verirse "Yine de yükle" de (uygulama Google Play'de yayınlanmış değil).
2. Uygulamayı aç. Oyun hesabı, şifre ve takas alacak hesabı gir, "Okudum, kabul ediyorum" kutusunu işaretle, **Başlat**'a bas.
3. **Pil izni** düğmesine bas, açılan ekranda "Kısıtlama yok" (ya da "İzin ver") seç. Ayarlar'dan bildirim iznini de ver.
4. Ana hesabından `/msg <AFK hesap adı> trade` yazınca bot `/tpa` yapar, 10 sn bekler (bu sürede isteği kabul et), `/trade` gönderir ve takas ekranı açılınca miktarları girip onaylar. Onay sonrası 5 saniyelik geri sayım olur.

Günlük bölümü her adımı yazar, bir yerde takılırsa nedenini orada görürsün.

## Ayarlar

Sabit ayarlar `node-kaynak/index.js` dosyasının en üstündeki `A` bölümünde: sunucu adresi, menüdeki Prison slotu, bekleme süreleri, takas slotları, restart saati, yürüme mesafesi. Değiştirince `npm run apk` ile yeniden derle.

- Sunucu sürümünü sabitlemek için `VERSION: '1.21.1'` gibi yaz.
- Takas edilecek kalemleri kapatmak için `TRADE_KALEMLER` içinde `aktif: false` yap.
- Tablodaki değerden düşülecek pay `TRADE_PAY` (100). Yuvarlama büyükse (örneğin `399.6B`) pay otomatik büyür, böylece bakiyenden fazla miktar yazılmaz.

## Kodun karıştırılması

`npm run hazirla` sırasında `node-kaynak/index.js`, `javascript-obfuscator` ile okunması zor hale getirilip `static/nodejs/index.js` olarak yazılır. APK'ya bu karıştırılmış dosya girer. Bu, kodu kopyalamayı zorlaştırır ama imkânsız kılmaz (telefonda çalışan kod her zaman çözülebilir). Karıştırma bir sorun çıkarırsa düz kopya için `OBF=0 npm run node:hazirla` kullan.

Kayıtlı kullanıcı adı ve şifre, uygulamanın özel klasöründe AES-256 ile şifreli saklanır. Anahtar aynı klasörde durduğu için bu, diğer uygulamalara ve yanlışlıkla bakan gözlere karşı korur, telefonu kökten ele geçiren birine karşı değil.

## Sorun giderme

- **Uygulama açılıyor ama "Hazır" yazısı gelmiyor:** Node başlamamış olabilir. Bilgisayardan `adb logcat` ile bak ya da hata mesajını gönder.
- **Bağlanıyor ama atılıyor ya da "unsupported protocol" diyor:** `VERSION` ayarına sunucunun Minecraft sürümünü yaz ve Mineflayer sürümünü yukarıdaki gibi eşitle.
- **Prison'a geçmiyor / yanlış yere tıklıyor:** `SLOT` ve `MENU_ESYA_SLOT` değerlerini sunucundaki menüye göre ayarla.
- **Takasta "tabela ekranı açılmadı" diyor:** sunucunun tabela paketi farklı olabilir, günlüğü gönder.
- **Birkaç saat sonra bağlantı kopuyor:** pil kısıtlamasının kapalı olduğundan ve bildirimin görünür kaldığından emin ol.

## Klasör yapısı

```
node-kaynak/index.js     bot kodu (okunabilir hali)
static/nodejs/           telefona gömülen Node projesi (package.json burada)
src/                     arayüz (HTML, CSS, JS)
android-ekler/           Java: on plan servisi ve pil izni eklentisi
scripts/                 hazırlama ve Android kurulum betikleri
.github/workflows/       GitHub'da APK derleme ayarı
capacitor.config.json    uygulama adı ve eklenti ayarı
```
