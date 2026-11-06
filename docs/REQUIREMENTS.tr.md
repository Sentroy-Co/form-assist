# Yeniden kullanılabilir AI form asistanı geliştirme promptu

Sen kıdemli bir SDK, frontend ve geliştirici araçları mühendisisin. Yeni ve bağımsız bir repository içinde, farklı projelere eklenebilen bir AI form asistanı paketi geliştir. Bu bir ürün geliştirme görevidir; yalnızca tasarım önerisi veya çalışan görünümünde bir demo teslim etme. Mevcut Paramarta sitesine henüz entegrasyon yapma.

Çalışma adı `@arasors/form-assist` olsun. Bu isim ve npm scope'u taslaktır; kullanılabilirliğini araştır, paket yayımlamadan önce repository sahibinin açık yayın talimatını bekle. Kaynak kodu, örnekler ve yerel paket çıktıları incelemeye hazır olmalı.

## Ürün amacı

Geliştirici paketimizi kurar, sunucuda kullanacağı sağlayıcıyı, modeli ve kimlik bilgisini tanımlar. Hangi formun hangi alanlarına yardım edilebileceğini, alanların mevcut değerlerini, kurallarını ve seçeneklerini belirtir. Projesine hazır glass/neon butonumuzu ekler. Kullanıcı bu butona basıp doğal dilde ne istediğini anlatır; asistan geçerli form değişiklikleri önerir ve onaylanan değişiklikler ilgili formun state'ine uygulanır.

Örnek: “Bu notlardan İngilizce bir makale taslağı oluştur; başlık, kısa açıklama ve SEO etiketlerini de hazırla.” Aynı motor ürün, etkinlik, profil veya başka bir iş formunda farklı bir şemayla kullanılabilmeli. Makale alanlarını veya belirli bir markayı çekirdeğe gömme.

İki eşit derecede desteklenen kullanım sun:

1. Hazır, aynı görsel kimliğe sahip buton ve Spotlight arayüzü.
2. Arayüzsüz çekirdek ve olaylar; geliştiricinin tamamen kendi arayüzünü oluşturması.

## Mimari ve paket sınırları

TypeScript strict bir monorepo öner ve uygulamadan önce kısa bir mimari karar kaydı yaz. Sorumluluklar şu sınırları korusun; birebir paket isimlerini gerekçeli olarak sadeleştirebilirsin:

- `core`: Şema, state machine, öneriler, doğrulama, değişiklik planı ve olay sözleşmeleri. DOM, React veya belirli bir sağlayıcı SDK'sına bağımlı olmasın.
- `server`: Sağlayıcı çağrıları, yetkilendirme kancaları, güvenli credential çözümleme, süre ve kullanım sınırları. Tarayıcı bundle'ına alınmasın.
- `providers`: Google Gemini, Anthropic, OpenAI, Cloudflare Workers AI, Cloudflare AI Gateway, Vercel AI Gateway ve uygunluğu doğrulanmış özel endpoint adaptörleri. İsteğe bağlı importlarla kullanılmayan SDK'ları yükleme.
- `browser`: Form bağlama, snapshot/revision yönetimi, iptal ve sunucuyla iletişim. Gizli sağlayıcı anahtarı kabul etmesin.
- `ui`: Framework bağımsız hazır arayüz. Autonomous Web Components ve Shadow DOM değerlendir; global stil sızıntısı olmadan aynı deneyimi sun. Bu bir mimari öneridir, uyumluluğunu örneklerle doğrula. [Web Components temeli](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements).
- Framework ve form kütüphanesi adaptörleri: Ana motoru tekrar yazmadan framework state'ini okuyup güncellesin.
- `cli`: Aynı iş mantığını kullanan, diğer programların process olarak çağırabileceği araç.
- `examples`, `docs` ve ortak JSON Schema/protokol fixture'ları.

ESM, tip bildirimleri, açık export sınırları, tree shaking ve doğru peer dependency tanımları sağla. Core import edilirken DOM veya secret çözümleme çalışmasın. SSR sırasında `window`/`document` okunmasın. Node ve Workers için gerekli runtime adaptörlerini açıkça ayır; edge uyumluluğunu Node kodunu gizlice paketleyerek iddia etme.

## Hazır glass ve neon arayüz

Arayüz ürünün imzası olacak. Genel bir chat widget görünümü istemiyorum.

- Buton beyaz, yarı saydam, sütlü cam yüzeyli; zarif ikon, okunur koyu metin ve yumuşak köşeler içersin. Çevresinde ince RGB ışık ve dışarı yayılan kontrollü bir renk halesi olsun.
- Normalde çok hafif bir ışık hareketi bulunsun. Hover ve klavye focus sırasında cyan, mor, pembe ve mavi renkler kenar boyunca akıp yer değiştirsin. Sert strobe, göz yoran parlamalar ve kalın gökkuşağı çerçevesi kullanma.
- Tıklanınca buton hissinden devam eden bir geçişle sayfa üzerinde atmosferik renk halesi ve glass katman açılsın. Varsayılan scope viewport olsun; yalnızca belirlenen bir container üzerinde açılma seçeneği de sun.
- Üstünde Apple Spotlight hissinde, merkezlenmiş geniş bir komut/girdi alanı yer alsın. İlk karşılama “Nasıl yardımcı olabilirim?” olsun; tüm metinler i18n üzerinden değiştirilebilsin.
- Altında bağlama uygun örnek komutlar, hedef form/alan bilgisi ve mevcut işlemin durumu gösterilsin. İlk odak input'a gelsin. Dar ekranda sheet benzeri okunur bir yerleşime dönüşsün; sanal klavye ve safe-area hesaba katılsın.
- Akış: açılma → kullanıcı girdisi → düşünme/üretim → alan bazlı öneri karşılaştırması → seçilenleri uygula → sonuç. Loading, streaming, iptal, tekrar deneme ve hata durumlarını tasarla.
- Önerilen alanlar eski/yeni değerleriyle karşılaştırılabilsin. Kullanıcı tek alanı veya seçtiklerini kabul edebilsin. Uzun Markdown metinlerini okunur önizleme ve metin diff'iyle göster.
- İlk sürümde mikrofon, konuşma kaydı veya sesli asistan ekleme; işlevsiz ikon gösterme.
- `open`, `close`, `toggle` gibi programatik kontrol ve yapılandırılabilir kısayol sun. Global kısayolu varsayılan olarak uygulamaları veya tarayıcıyı bozacak şekilde sahiplenme; IME composition sırasında Enter ile yanlışlıkla gönderme.
- Tema için CSS custom properties, gerekiyorsa `::part`, radius, yoğunluk, renk paleti, metinler, ikon, portal root ve z-index seçenekleri ver. Kendi UI'ını yapan geliştirici hazır CSS'i indirmek zorunda kalmasın.
- Dialog etiketi, focus trap/restore, Escape, ekran okuyucu duyuruları, kontrast, klavye ile öneri seçimi ve reduced-motion desteği eksiksiz olsun. Streaming her token'da ekran okuyucuyu konuşturmasın.
- Tam ekran blur katmanını sürekli yeniden boyama. Hareketi ağırlıkla transform/opacity ile kur; animasyonları arayüz kapalıyken ve sekme görünmezken durdur. Unmount sırasında scroll lock, listener ve portal kalıntısı bırakma. WebGL zorunlu olmasın.

## Form sözleşmesi

Şema esaslı, JSON ile taşınabilir bir sözleşme tasarla. Temel standart JSON Schema olsun; TypeScript/Zod gibi araçlar ayrı dönüştürücüler olabilir. Runtime'da çalıştırılacak fonksiyonlar ile seri hale getirilebilir protokol verisini ayır.

Her formda kararlı `formId`, şema sürümü ve revision; her alanda kararlı path, açıklama, tip, gerekli/isteğe bağlı durumu, mevcut değer, sınırlar, read-only ve AI tarafından yazılabilirlik bilgisi bulunsun. String, uzun metin, Markdown, number, boolean, date, enum, çoklu seçim, nested object ve array desteklenebilsin. Null, boş string ve eksik değer aynı şey sayılmasın.

Seçimlerde kullanıcıya görünen label ile kaydedilen value ayrı olsun. Model yalnızca izinli value'ları döndürsün. Bağımlı seçenekleri ve asenkron option resolver'ları desteklemek için açık bir kanca sun. İzin verilmeyen değerleri sessizce en yakın seçeneğe dönüştürme.

Öneri sonucu doğrudan formun tamamını değiştirmek yerine sürümlü bir değişiklik planı dönsün. Örnek sözleşme:

```json
{
  "protocolVersion": "1",
  "requestId": "request-id",
  "formId": "article-editor",
  "baseRevision": "revision-id",
  "changes": [
    {
      "op": "replace",
      "path": "/title",
      "value": "Suggested article title",
      "reason": "User requested a concise title"
    }
  ],
  "questions": [],
  "warnings": []
}
```

Bu örnek hedef davranışı anlatır; uygularken tipleri ve operasyon semantiğini tamamla. Path allowlist, array sınırları ve prototype pollution koruması uygula. `baseRevision` kontrol edilmeden eski bir öneri yeni kullanıcı girdisini ezmesin. Kullanıcı üretim sürerken formu değiştirirse çatışmayı göster ve yeniden değerlendirme iste.

Model çıktısını sunucuda doğrula; tarayıcıda uygularken tekrar form kurallarıyla kontrol et. Streaming sırasında eksik JSON'u gerçek input'lara yazma. Belirsiz veya eksik bilgide soru sor; tarih, kişi bilgisi, kaynak, hukuki dayanak veya ürün özelliği uydurma. Salt okunur, gizli, password/file ve hassas alanları varsayılan olarak AI bağlamından çıkar.

Native form adaptörü sadece açıkça seçilmiş formun alanlarını okuyabilsin; bütün DOM'u veya sayfa metinlerini otomatik toplamasın. Controlled React input'larında DOM `value` atamakla yetinme; ilgili form kütüphanesinin setter ve validation mekanizmasını kullan.

Varsayılan davranış kullanıcı onayından sonra form state'ini doldurmaktır. Asistan kendi başına kaydetmez, submit etmez, makale yayımlamaz, ödeme başlatmaz veya kaydı silmez. Uygulama isterse bu işlemleri ayrı, kendi yetkilendirmesi ve kullanıcı onayı olan callback'lerle bağlayabilir. Uygulama kapsamındaki son değişiklik grubunu geri alma desteği ver; sonradan yapılmış kullanıcı düzenlemelerini geri alma işlemiyle ezme.

## Sağlayıcılar ve model seçimi

Provider adı, model adı ve credential aynı kavram değildir. Özellikle Cloudflare Workers AI ile Cloudflare AI Gateway'i ayrı bağlantı türleri olarak ele al; Vercel AI Gateway'i belirli bir model ailesi sanma.

- Google AI Studio'dan alınan Gemini API bağlantısı.
- Anthropic/Claude API bağlantısı.
- OpenAI API bağlantısı.
- Cloudflare Workers AI: desteklenen runtime'da binding veya belgelenmiş HTTP bağlantısı.
- Cloudflare AI Gateway: account/gateway kimlikleri, gateway kimlik doğrulaması ve upstream credential/BYOK politikası.
- Vercel AI Gateway: gateway credential veya desteklenen sunucu kimliği; gerekiyorsa ayrıca upstream BYOK.
- Özel OpenAI uyumlu endpoint: hangi protokol ve yeteneklerin doğrulandığını belirt; uyumlu denmesini bütün özelliklerin çalıştığı anlamına getirme.

Her adaptör authentication, model listeleme veya manuel model girişi, structured output, streaming, cancellation ve usage yeteneklerini bildirsin. Sağlayıcının sunmadığı özelliği varmış gibi gösterme. Desteklenmeyen şema/model kombinasyonunda anlaşılır hata veya açıkça seçilmiş ve doğrulanan alternatif yol kullan.

Model ID'lerini hafızadan yazma. Uygulama tarihinde resmi belge veya katalogdan doğrula, sürümleri kaydet, seçim yapılandırmasını dışarı aç. Sağlayıcı değiştirmek için form veya UI kodu değişmemeli. Ara bir SDK seçersen güncel belgelerini okuyup sürümünü sabitle; paketin public API'sini bu SDK'nın iç tiplerine bağlama.

Timeout, AbortSignal, rate limit, Retry-After ve sınırlı retry davranışlarını normalize et. Paket kendi başına başka bir sağlayıcıya veya credential'a sessiz fallback yapmasın. Gateway'in kendi fallback ve faturalandırma davranışını ayrıca belgele: örneğin Vercel BYOK başarısız olduğunda sistem credential'ına dönebilir. Katı credential/bütçe şartı yapılandırmayla garanti edilemiyorsa bunu destekleniyor diye sunma; o modu reddet veya doğrudan sağlayıcı bağlantısını öner. [Vercel BYOK davranışı](https://vercel.com/docs/ai-gateway/authentication-and-byok/byok), [Cloudflare BYOK yapılandırması](https://developers.cloudflare.com/ai-gateway/configuration/bring-your-own-keys/).

## Anahtar kaydetme ve yönetim bileşeni

Sunucuda kullanılacak sınıf veya factory gerçek `apiKey` ya da `credentialRef` alabilir. Tarayıcıdaki buton sadece uygulamanın endpoint'ini ve izinli bağlantının kimliğini alır. Anahtarı component prop'una, HTML'e, istemci environment değişkenine, localStorage'a veya model promptuna koyma. [OpenAI anahtar güvenliği](https://developers.openai.com/api/reference/overview).

Anahtar yönetimi kullanılabilir bir modül olsun; sadece environment değişkenleri gösterip “admin'den kaydetme hazır” deme. Host uygulamanın kendi admin paneline bağlayabileceği credential yönetim arayüzü ve server API sözleşmesi sun:

- Sağlayıcı, bağlantı adı, gerekli kimlik alanları, model, varsayılan bağlantı ve etkinlik durumu.
- Anahtar ekleme/değiştirme, kaldırma ve sınırlı bir bağlantı testi. Testin gerçek API çağrısı ve küçük de olsa maliyet yaratabileceği gösterilsin.
- Kaydettikten sonra credential değeri read endpoint'lerinden geri dönmesin; yalnızca maskelenmiş özet ve durum bilgisi gösterilsin.
- `CredentialStore` arayüzü: environment çözümleyicisi, local kullanım için process belleği ve opsiyonel kalıcı şifreli storage adaptörü. Üretimde kalıcı kayıt seçiliyorsa gerçek storage implementasyonu ve testleri sağla.
- Kalıcı şifrelemede anahtar veritabanının dışında tutulsun; AEAD, key ID ve rotasyon stratejisi kullan. Secret manager adaptörü de eklenebilsin. Storage/database ürününü çekirdeğe zorunlu bağımlılık yapma.
- Çoklu kullanıcı ve projede tenant kapsamı sunucu oturumundan gelsin. Tarayıcıdan gelen `tenantId`/`credentialId` başka kullanıcının anahtarına erişim sağlamasın. Host uygulama yetkilendirmesi olmadan yönetim endpoint'lerini açma.
- Hatalar, loglar, telemetry ve debug çıktıları credential'ları redakte etsin. Ham prompt/form verisi için logging varsayılan olarak kapalı olsun.

Credential için kullanılan Gemini/Claude/OpenAI platform bağlantılarını dokümanda belirt: [Google AI Studio](https://ai.google.dev/gemini-api/docs/api-key), [Claude API anahtarı](https://platform.claude.com/docs/en/get-api-key), [OpenAI kimlik doğrulaması](https://developers.openai.com/api/reference/overview). Chat ürünü oturumunu API credential'ı yerine kullanma.

## Framework ve UI kütüphanesi uyumluluk listesi

`COMPATIBILITY.md` içinde aşağıdakiler için sürüm, yaklaşım, örnek, test ve destek durumunu içeren bir tablo hazırla. Bu liste hedef kapsamdır; araştırılmadan bir popülerlik sıralaması veya hepsine tamamlanmış destek iddiası üretme.

| Katman | Araştırılacak hedefler |
| --- | --- |
| Web ve SSR | Vanilla JS/TS, React, Next.js, React Router framework mode/Remix kullanan projeler, Vue/Nuxt, Angular, Svelte/SvelteKit, Solid/SolidStart, Astro, Lit/Web Components |
| React UI | shadcn/ui ve Radix, Material UI, Chakra UI, Mantine, Ant Design, Headless UI |
| Vue UI | Vuetify, PrimeVue, Quasar, Naive UI |
| Angular UI | Angular Material, PrimeNG, NG-ZORRO |
| Svelte UI | Skeleton, shadcn-svelte, Flowbite Svelte |
| CSS tabanı | Plain CSS, Tailwind CSS, Bootstrap, daisyUI |
| Form state | Native HTML forms, React Hook Form, Formik, TanStack Form, VeeValidate, Angular Reactive Forms, SvelteKit Superforms |
| Diğer backend'ler | Rust servisleri ve ASP.NET Core/C#; browser UI'ı Web Component/JS ile, server motoru CLI veya HTTP sözleşmesiyle bağla |

Hazır arayüz için bütün framework'lerin UI kütüphanelerini zorunlu dependency yapma. Web Component'in bir projede mount olması, o projenin controlled form bileşenlerine otomatik destek verdiği anlamına gelmez; özel binding ihtiyacını açıkça göster.

İlk dikey teslim core + server + hazır UI + native form + React/Next.js + React Hook Form + CLI olsun. Sonraki teslimlerde Vue, Svelte ve Angular adaptörlerini ayrı test et. Durumları `tested`, `experimental`, `planned` gibi açıkça ayır. Planlanan şeyi çalışan örnek listesine katma.

## CLI ve dil bağımsız protokol

CLI'ın TypeScript/Node ile aynı motoru kullanması kabul edilir. Rust ve C# kullanıcıları Node import etmek zorunda kalmadan process başlatıp JSON alışverişi yapabilsin; Node runtime gereksinimini açıkça belgele. Native binary gerekiyorsa ayrı tasarım kararı yaz, ikinci bir provider motoru kopyalama.

En az şu iş akışlarını tasarla ve çalışır hale getir:

```text
form-assist init
form-assist validate-schema --stdin
form-assist connections list --json
form-assist models list --connection <id> --json
form-assist propose --connection <id> --model <id> --stdin --json
form-assist propose --connection <id> --model <id> --stdin --stream
form-assist doctor --json
```

Normal modda stdin bir JSON request, stdout bir JSON result olsun. Streaming modunda stdout sürümlü NDJSON olayları üretsin. Progress ve insan odaklı loglar yalnızca stderr'e yazılsın. Kararlı exit code'lar, request ID, hata tipleri, timeout, Ctrl+C ve pipe kapanması tanımlansın. Secret değerlerini CLI argümanı olarak isteme; environment, server credential store veya uygun yerel keychain kullan.

Rust'ta `std::process`/serde, C#'ta `ProcessStartInfo`/System.Text.Json ile çalışan örnek istemciler sun. Shell string birleştirmeden argüman listesi kullan; stdin'i kapat, stdout ve stderr'i deadlock olmadan oku, timeout'ta süreci temizle. Aynı request/response fixture'larını iki dilde de doğrula. CLI forma ait DOM'u yönetmez; doğrulanmış değişiklik planını döndürür, host uygulama uygular.

HTTP taşıması için framework bağımsız handler ve OpenAPI sözleşmesi sağla; Next.js ve Workers örnek adaptörleri ekle. Streaming olayları ile non-streaming sonuç aynı mantıksal şemaya dayansın. Başlangıçta herkese açık, kimliksiz bir proxy sunucusu açma.

## Güvenilirlik ve uygulama sınırları

Sunucu hangi formun, alanların, bağlantıların ve modellerin kullanılabileceğini doğrulasın; kullanıcı gönderdiği JSON ile bu izinleri genişletemesin. Gelen şema ile sunucuya kayıtlı şemayı karıştırma. Request ve output boyutu, alan sayısı, süre, eşzamanlı istek ve token limitleri olsun. Özel endpoint'ler için SSRF ve kontrolsüz redirect riskini host allowlist/policy ile ele al; bütün kullanım senaryolarına açık local endpoint izni verme.

Form metnini, seçim label'larını ve dışarıdan alınan içeriği talimat yetkisine sahip veri sayma. Asistan yalnızca izinli form değişikliklerini önersin; sayfa dolaşması, shell çalıştırması veya rastgele tool çağrısı gerekmesin. İstemci temizliği, güvenli Markdown gösterimi ve CSP uyumluluğunu test et. Üçüncü taraf telemetry, veri saklama veya zorunlu hosted hesap ekleme.

## Testler ve teslim ölçütleri

Sadece snapshot veya mock çağrılarıyla “tüm sağlayıcılar çalışıyor” deme. Şunları doğrula:

- Şema/enum sınırları, nested alanlar, izinsiz path, read-only alanlar, hatalı model çıktısı ve revision çatışması.
- Kullanıcının üretim sırasında yazdığı değerin ezilmemesi, seçili alan uygulaması, güvenli undo ve kendi kendine submit/publish yapılmaması.
- Streaming/cancel, timeout, 401/403/429/5xx, yarım kalan JSON ve retry bütçesi.
- Çapraz tenant credential erişimi, istemci bundle'ında secret sızıntısı ve redaksiyon.
- Provider contract testleri; gerçek bağlantı testleri yalnızca açıkça sağlanmış anahtarlarla opt-in. Test edilmemiş bağlantıları dürüstçe işaretle.
- Web Component, React controlled state, React Hook Form, SSR/hydration ve iki formun aynı sayfada birbirine karışmaması.
- Desktop/mobile, klavye, ekran okuyucu, reduced motion, dark/light host, stacked modal ve unmount temizliği.
- Rust ve C# için aynı sürümlü JSON fixture'larıyla gerçek CLI entegrasyon testi.
- Paket build/export kontrolü; temiz bir tüketici projesine yerel tarball kurulumu ve çalışan örnek.

Teslimde kaynak, kilit dosyası, yayınlanmamış yerel paketler, README, quickstart, API/protokol referansı, uyumluluk matrisi, örnekler, katkı rehberi ve lisans kararı bulunsun. Boyut ve performans bütçelerini ölç; tahmini değerleri gerçek ölçüm gibi sunma. Yerel görsel demo sağlayıcısız fixture moduyla da açılabilsin; bu mod açıkça “demo” olarak etiketlensin.

İlk olarak kısa mimari planı ve paket sınırlarını çıkar, ardından ilk dikey sürümü gerçekten uygula. Sonraki adaptörlerin durumunu açıkça raporla. Bana sadece plan verip bırakma; testleri geçen, başka bir projeye kurulabilen bir paket teslim et. Dış servise yayın veya ücretli kaynak açma işlemini kendiliğinden yapma.

## Daha sonra yapılacak makale editörü entegrasyonu

Paketi belirli bir CMS'ye bağımlı yapmadan örnek bir makale reçetesi hazırla: title, excerpt, Markdown body, SEO title, description, tags, category ve cover alt. Alanların uzunlukları, izinli kategorileri ve seçenekleri host şemadan gelsin. Credential yönetimi public site settings tablosundan ayrı, sunucuda korunan bir yerde kalsın.

Bu reçete mevcut bir makalenin sabit slug'ını, yayın durumunu veya tarihini kendiliğinden değiştirmesin. Yeni makalede slug önerilebilir; daha önce kaydedilmiş makalede read-only olsun. Kaynak verilmeden mevzuat, mahkeme kararı veya uzman görüşü üretmesin. Asistanın uyguladığı içerik formda incelenebilir kalsın; yayına alma işlemi mevcut editörün normal kullanıcı eylemi olsun. Gerçek projeye entegrasyonu paket teslim edildikten sonra ayrı görev olarak yapacağız.
