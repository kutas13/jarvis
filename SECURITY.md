# JARVIS v4 Security Model

## Otomatik
- Okuma, arama, özetleme
- Güvenli dosya arama
- Görev/takvim okuma
- Sabah/akşam rapor üretimi
- Hafıza ve davranış sinyallerinin hassas olmayan kısmı

## Kullanıcı onayı gereken
- iPhone konum paylaşımı (iOS share sheet açılmadan önce)
- Google Calendar etkinliği oluşturma
- Windows masaüstü click/type gibi etkileşimler

## Bilerek sunulmayan
- Para/ödeme işlemleri
- Şifre veya güvenlik ayarı değiştirme
- Kalıcı dosya silme
- Keyfi PowerShell/CMD/shell yürütme
- JARVIS'in kendi yetkisini artırması veya production kodunu kendi kendine deploy etmesi

## Konum
Anlık GPS koordinatı sadece paylaşım işini yürütmek için tutulur ve `location_events.expires_at` ile 24 saatlik geçerlilik süresine sahiptir. Uzun dönem hafızaya otomatik yazılmaz.

## Secrets
`.env`, `.env.local` ve `windows-agent/.env` `.gitignore` kapsamındadır. API key, service role key, pairing secret ve device token GitHub'a commit edilmemelidir.
