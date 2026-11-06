# İlk dikey sürüm teslimi

Yedi ajanlık çalışma düzeninde altı GPT-6.1 Terra alt ajanı çekirdek, sunucu/credential yönetimi, sağlayıcılar, tarayıcı/form adaptörleri, arayüz ve CLI/dil istemcilerini geliştirdi. Ana ajan mimari sözleşmeleri, demo/dokümantasyon, entegrasyon incelemesi, güvenlik düzeltmeleri, paketleme ve son doğrulamayı üstlendi.

`@sentroy-co/form-assist` bağımsız bir npm workspace paketidir. Core, server, providers, browser, native, React, React Hook Form, UI ve Node storage ayrı export sınırlarına sahiptir. Glass/Spotlight arayüzü ve arayüzsüz controller aynı öneri motorunu kullanır. Sunucu kayıtlı şemayı ve izinleri doğrular; kullanıcı onayıyla seçilen alanlar uygulanır. Yeni düzenlemeleri ezmeden çatışma ve geri alma desteklenir. Credential yönetim API'si, maskelenmiş listeleme ve AES-256-GCM ile yerel kalıcı depolama mevcuttur.

Doğrulama sonuçları:

- Strict TypeScript derlemesi ve tip kontrolü geçti.
- 60 birim/entegrasyon testi geçti.
- Chromium ile 14 masaüstü/mobil/klavye/erişilebilirlik senaryosu geçti.
- Next.js 16.4.5 üretim derlemesi ve gerçek SSR/hydration/iki form izolasyonu testi geçti.
- Rust 1.99.1 ve C#/.NET 8.0.427 istemcileri aynı fixture'larla gerçek Node CLI sürecine bağlandı.
- Tarball temiz bir tüketici projesine kuruldu; export ve SSR kontrolleri geçti.
- Browser bundle'larına sunucu kodunun girmediği ve Workers grafiğinde Node storage bulunmadığı doğrulandı.

Çalıştırma:

```sh
npm ci
npm run build
npm test
npx playwright install chromium
npm run test:browser
npm run demo
```

Demo http://localhost:5173 adresinde açılır; sabit örnek yanıt kullandığı açıkça etiketlenmiştir. Anahtar veya dış servis gerektirmez. Yerel paket üretimi için `npm run pack:local`, temiz kurulum kontrolü için `npm run verify:package` kullanılır. Rust/.NET araçları `.tools` altında bu çalışma ortamına kurulmuştur; kaynak ZIP'e dahil değildir. Kendi makinenizde Cargo ve .NET 8 gereklidir.

Canlı sağlayıcı çağrıları yapılmadı; sağlayıcı sonuçları transport sözleşme testleridir. Model ID'si açık yapılandırmadan gelir. NDJSON tam sonuç/yaşam döngüsü olayları sunar; token akışı ve otomatik model katalogları bu sürümde yoktur. Diğer framework adaptörleri uyumluluk matrisinde planlanan olarak işaretlidir. Workers üretime dağıtılmadı. Ekran okuyucuyla manuel test ve Firefox/WebKit doğrulaması yapılmadı. Paket yayınlanmadı, mevcut CMS'ye entegrasyon yapılmadı; lisans ve npm scope sahipliği yayın öncesinde sahip tarafından kararlaştırılmalıdır.

Ayrıntılar: [doğrulama](VALIDATION.md), [uyumluluk](../COMPATIBILITY.md), [sunucu](SERVER.md), [sağlayıcılar](PROVIDERS.md), [ölçülmüş boyutlar](measurements.json), [ölçülmüş performans](performance.json).

## Sentroy lansman güncellemesi

Paket kapsam adı `@sentroy-co/form-assist` olarak düzenlendi. Sentroy logosu ve kendi README düzeninden hareketle yeni README ile koyu/açık temalı lansman demosu hazırlandı. İmleç takibi yapan ızgara, çalışan şema/entegrasyon gezinmesi, 54 dilin tamamında UI ve demo metinleri, tarayıcı dili algılama, elle dil seçimi ve RTL desteği eklendi. Dil değişimi kullanıcı düzenlemelerini ve önerileri korur. Kataloglar ayrı modüller halinde gerektiğinde yüklenir. Üretim çıktısı repo alt yolunda da test edildi.

GitHub repo oluşturma isteği hem CLI GraphQL hem REST tarafında mevcut bağlantının yetkisi nedeniyle `Resource not accessible by integration` / HTTP 403 ile reddedildi. Bu teknik erişim eksikliği giderilmeden repo oluşturulduğu veya GitHub yayını yapıldığı iddia edilmez. Kaynak ve statik lansman arşivleri yerel teslim için hazırdır.
