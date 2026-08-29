# JARVIS ULTIMATE v4

Kişisel JARVIS sistemi: PWA/iPhone, Windows Agent, kalıcı hafıza, görevler, dosya arama, ekran/görsel analizi, Google entegrasyonları, push bildirimleri, sabah/akşam rutinleri ve API maliyet kontrolü.

## v4'te tamamlananlar

- **Anlık konum paylaşımı (iPhone/PWA):** “Ömer'e şu anki konumumu gönder” gibi komutlar JARVIS ekranında konumu hazırlar. Güvenlik gereği **ONAYLA VE PAYLAŞ** düğmesine dokununca iOS paylaşım ekranı açılır. iOS/PWA, WhatsApp'ta belirli bir kişiye kullanıcı dokunuşu olmadan otomatik gönderime izin vermez.
- **Konum gizliliği:** anlık koordinat kaydı 24 saat sonra geçersiz olur.
- **Sabah rutini:** her gün **09:30 Europe/Istanbul**. Açık/gecikmiş görevler + Google bağlıysa takvim ve okunmamış Gmail özeti. Sonuç JARVIS paneline ve push bildirime gider.
- **Akşam rutini:** her gün **19:00 Europe/Istanbul**. Tamamlanan/kalan görevler + yarınki takvim + okunmamış Gmail + günlük JARVIS işlem sayısı. Panel + push.
- **Google zorunlu değil:** bağlı değilse rutinler görevler/JARVIS verileriyle çalışmaya devam eder.
- **Güvenlik:** okuma/özetleme otomatik; konum paylaşımı ve takvim oluşturma onaylı; ödeme, şifre değişikliği, kalıcı dosya silme ve keyfi shell komutu yok.
- **API maliyet kontrolü:** varsayılan ekonomi modeli `gpt-5-mini`, zor görevlerde `gpt-5.4-mini`; günlük ve aylık USD limitleri; %80 bütçeden sonra ekonomi moduna zorlar; limit dolunca ücretli AI çağrılarını durdurur.
- **Ücretsiz ses varsayılanı:** `NEXT_PUBLIC_PREMIUM_TTS=false` iken mümkünse cihazın yerleşik TTS'i kullanılır; OpenAI TTS masrafı oluşmaz.

## v3 kullanıyorsan

Supabase > SQL Editor içinde **yalnızca** şu dosyayı çalıştır:

`supabase/migrate-v3-to-v4.sql`

Eski `.env.local` değerlerini yeni `.env.local` dosyasına taşı ve yeni v4 değişkenlerini ekle.

## Yeni kurulum

1. `.env.example` dosyasını `.env.local` olarak kopyala.
2. Supabase SQL Editor'da `supabase/schema.sql` çalıştır.
3. `npm install`
4. `npm run dev`
5. `http://localhost:3000`

Windows Agent için eski eşleşmiş `windows-agent/.env` dosyanı v4 klasörüne kopyala. Ardından `windows-agent/install.bat`; test için `run.bat`; düzgünse `install-background.bat`.

## Push bildirimi

Önce:

`npm run vapid`

çıktıdaki iki değeri `.env.local` / Vercel Environment Variables içine koy:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

Ayrıca `VAPID_SUBJECT=mailto:senin-emailin@example.com` ve güçlü bir `CRON_SECRET` tanımla. iPhone'da siteyi **Ana Ekrana Ekle**, sonra JARVIS > RUTİNLER > **iPhone Bildirimlerini Aç**.

## Rutin saatleri

`vercel.json` UTC kullanır:

- 06:30 UTC = 09:30 Türkiye
- 16:00 UTC = 19:00 Türkiye

Rutinler AI çağrısı kullanmadan deterministik hazırlanır; bu nedenle sabah/akşam rutinlerinin kendisi normalde OpenAI token maliyeti üretmez.

## API maliyet ayarları

```env
OPENAI_MODEL_ECONOMY=gpt-5-mini
OPENAI_MODEL_SMART=gpt-5.4-mini
OPENAI_MODEL_VISION=gpt-5.4-mini
JARVIS_MODEL_MODE=AUTO
JARVIS_DAILY_BUDGET_USD=0.50
JARVIS_MONTHLY_BUDGET_USD=10
NEXT_PUBLIC_PREMIUM_TTS=false
```

`AUTO`: çoğu iş ekonomi modeli, yalnızca gerçekten zor işlerde smart model.
`ECONOMY`: her normal metin işi ekonomi modeli.
`MAX`: normal metin işlerinde smart model.

## Vercel

GitHub repo kökü bu klasörün içeriği olmalı. Vercel'e `.env.local` yükleme; değerleri **Project Settings > Environment Variables** içine ayrı ayrı ekle. Production URL oluşunca:

- `NEXT_PUBLIC_APP_URL=https://...vercel.app`
- `GOOGLE_REDIRECT_URI=https://...vercel.app/api/integrations/google/callback`
- Windows Agent: `JARVIS_URL=https://...vercel.app`

## iPhone konum paylaşımı

Örnek:

`Jarvis, Ömer'e şu anki konumumu gönder.`

JARVIS GPS'i alır ve konum linkini hazırlar. Son aşama iOS paylaşım ekranıdır; **kime gönderileceğini iOS/WhatsApp ekranından seçmen gerekir**. Bu kullanıcı onayı güvenlik modelinin parçasıdır.
