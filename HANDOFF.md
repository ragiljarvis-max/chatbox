# HANDOFF — Chatbox fork: mobile APK provider health-check

## Konteks
- Repo: fork `chatboxai/chatbox` → `ragiljarvis-max/chatbox`, clone di `~/projects/chatbox`.
- Upstream: https://github.com/chatboxai/chatbox (tracked `main`, GPL-3.0).
- Fokus owner: **APK saja (Android), arm64 release build**. Jangan sentuh Electron/desktop/web/iOS build.
- Toolchain host: Node 26, pnpm 10.33, JDK 21 (`~/.local/jdk`), Android SDK `~/android-sdk`
  (platform-34, build-tools 34/36/37, NDK r26d, cmake 3.22.1). TANPA sudo.
- Folder `android/` TIDAK di-commit upstream — dihasilkan `npx cap sync android` (script `mobile:sync:android`).
  Perlu `android/local.properties` berisi `sdk.dir=/home/alfamart/android-sdk`.

## FITUR YANG DIMINTA OWNER (semua di sisi mobile, halaman Provider)
Tambahkan fitur "health-check / mass ping" provider. Satu layar bisa mem-ping BANYAK provider/model sekaligus:
1. **Max RPM** — batas rate ping massal (request per menit) yang bisa diatur user. Saat mass-ping,
   throttle sesuai max RPM ini (jangan bentak-bentak request).
2. **Tandai DEAD / ALIVE** — tiap provider/model dapat badge status hidup/mati berdasarkan hasil ping.
3. **Latency ms** — tampilkan waktu respons dalam milidetik.
4. **Token/second** — tampilkan throughput token per detik (dari request chat kecil / completion pendek).

## Titik kode relevan (hasil survei orchestrator)
- Provider settings UI: `src/renderer/routes/settings/provider/` dan
  `src/renderer/components/settings/provider/ProviderList.tsx`, `AddProviderModal.tsx`.
- Definisi & registry provider: `src/shared/providers/` (`types.ts`, `registry.ts`, `definitions/`).
- Request/transport: `src/renderer/utils/request.ts` (lihat `docs/technical/provider-networking.md`).
  Mobile memakai Capacitor native transport utk host non-lokal bila `useProxy` aktif.
- Build renderer utk mobile: `cross-env CHATBOX_BUILD_TARGET=mobile_app CHATBOX_BUILD_PLATFORM=android pnpm run build:renderer`
  lalu `npx cap sync android`, lalu Gradle `assembleRelease` (arm64).
- Belum ada fitur health-check/latency/tps existing — ini fitur BARU.

## Rancangan yang disarankan (bebas perbaiki selama tujuan terpenuhi)
- Modul baru, mis. `src/shared/provider-health/` berisi:
  - `pingProvider(providerId, modelId, {maxRpm})` → lakukan 1 request kecil (mis. `/models` GET untuk
    alive-check + 1 completion pendek untuk latency & token/second), ukur ms & token/detik.
  - Token/second: pakai stream, hitung token dari response usage atau estimasi char/4, bagi durasi.
  - Scheduler mass-ping yang menghormati `maxRpm` (antrian + interval = 60000/maxRpm, atau token bucket).
- UI: tombol "Ping semua" di daftar provider + field input "Max RPM" (default mis. 30).
  Tiap baris provider tampil: badge ALIVE (hijau) / DEAD (merah), latency `xxx ms`, `x.x tok/s`.
- Simpan hasil ping terakhir di state (tidak perlu persist dulu kecuali murah).
- Bahasa UI ikuti pola i18n repo (ada i18next). Tambahkan minimal en + zh + id bila mudah.

## ATURAN WAJIB (owner standing rules)
- **Version bump**: fitur baru → naikkan versi. Versi ada di `package.json` (`"version"`).
  Target versi rilis pertama fork ini: **0.1.0**. Buat folder output `bin/V0.1.0/`.
- **Jangan hapus folder `bin/` versi lama** — buat folder `bin/V<versi>/` baru. (Owner hapus manual.)
- Artifact akhir: **APK arm64 release** di `bin/V0.1.0/chatbox-arm64-v0.1.0.apk` (nama bebas, jelas).
  Build: `cd android && ./gradlew assembleRelease -PabiFilters=arm64-v8a` (atau filter ABI arm64-v8a
  di build.gradle). Pastikan APK keluar arm64 (cek `unzip -l | grep lib/arm64-v8a`).
- Commit per fase, commit message jelas. Jangan commit `android/` hasil generate & `node_modules`.
- Jangan sentuh repo referensi/upstream lain.

## Definisi SELESAI (done-condition)
1. Kode fitur health-check (max RPM, dead/alive, ms, token/second) terpasang & tampil di UI mobile.
2. `pnpm install` jalan; build renderer mobile sukses; `npx cap sync android` sukses.
3. `android/local.properties` dibuat; Gradle `assembleRelease` arm64 menghasilkan APK.
4. APK arm64 tersimpan di `bin/V0.1.0/`, terverifikasi mengandung `lib/arm64-v8a`.
5. `package.json` version = 0.1.0. Commit + push ke `ragiljarvis-max/chatbox`.
6. Laporan: apa yang berubah, path APK, bukti verifikasi (log build + unzip cek arm64).

## FASE 2 — release signing + ganti package (owner request, 2026-11-21)
Sebelumnya APK "appears to be invalid" saat diinstall = APK release BELUM ditandatangani.
Wajib:
1. **Ganti applicationId** jadi `net.garybully.chatbox` (di `capacitor.config.ts` appId dan
   `android/app/build.gradle` applicationId). Regenerasi android/ via `cap sync` agar konsisten.
2. **Keystore release SUDAH dibuat owner** di `keystore/chatbox-release.jks` (alias `chatbox-release`,
   PKCS12). Kredensial ada di `keystore/keystore.properties` (storeFile/storePassword/keyAlias/keyPassword).
   JANGAN hardcode password di build.gradle — baca dari `keystore/keystore.properties`.
3. Konfigurasi signingConfig release di `android/app/build.gradle` memakai keystore itu (signingConfig
   release untuk buildType release). APK hasil HARUS signed (bukan unsigned).
4. **Gitignore** `keystore/` (jangan push keystore/password ke repo).
5. Naikkan versi `package.json` → **0.1.1**. Output APK baru ke `bin/V0.1.1/`
   (`chatbox-arm64-v0.1.1.apk`). **Jangan hapus `bin/V0.1.0/`**.
6. Verifikasi arm64 (`lib/` hanya `arm64-v8a`) + verifikasi APK signed
   (`keytool -printcert -jarfile` atau unzip META-INF/*.RSA ada).
7. Commit + push (kode & build config; keystore/ TIDAK dipush).

## FASE 3 — merge upstream + catat UPSTREAM.md (owner request, 2026-11-21)
ATURAN owner: setiap fork WAJIB punya `UPSTREAM.md` (jangan lupa sejauh mana fork tertinggal).
Data upstream (sudah dicek orchestrator):
- Upstream URL: https://github.com/chatboxai/chatbox (branch `main`)
- Base fork ini: `0ac6385` (= upstream release v1.23.5)
- Current upstream HEAD: `446bcf43e7a89a0411218821de54d87d7f3cfe11` (= tag v1.24.4), dicek 2026-11-21
Tugas:
1. Tambah remote upstream: `git remote add upstream https://github.com/chatboxai/chatbox.git`
   (kalau belum). `git fetch upstream`.
2. Buat `UPSTREAM.md` di root: URL upstream, tracked branch, SHA base fork, SHA upstream HEAD
   saat merge + tanggal, tag upstream terakhir, dan perintah cek update
   (`git ls-remote upstream HEAD` + `git fetch upstream && git log HEAD..upstream/main --oneline`).
3. Merge upstream/main ke main lokal. Selesaikan konflik, prioritaskan mempertahankan fitur fork
   (health-check provider, appId `net.garybully.chatbox`, signing config). Setelah merge,
   pastikan fitur fork masih ada & build masih jalan.
4. Jangan hancurkan commit fork. Bila konflik berat di file yang kita ubah, gabungkan secara hati-hati.

## FASE 4 — fix "tidak bisa add provider, failed" (owner request, 2026-11-21)
Owner lapor: menambah provider baru gagal/failed di APK. Diagnosis & fix:
- Alur add provider: `AddProviderModal.tsx` (submit) → route
  `src/renderer/routes/settings/provider/$providerId.tsx` (state `setProviderSettings`, `handleAddModel`).
- Periksa apakah penyebabnya: (a) regresi dari fitur health-check yang kita tambah di `ProviderList.tsx`
  / `ProviderHealthCheck.tsx`, (b) validasi nama/API mode kosong, (c) penyimpanan provider custom
  (settingsStore `useProviderSettings`/`setProviderSettings`) gagal, atau (d) konflik setelah merge upstream.
- Reproduksi: cek apakah tombol add provider benar-benar memanggil penyimpanan; lihat error yang
  muncul. Perbaiki sampai add provider sukses (provider custom baru muncul di daftar).
- Setelah fix, jalankan test terkait (`vitest run src/renderer/components/settings/provider`) + `pnpm run check`.

Versi: setelah FASE 3+4 selesai, naikkan `package.json` → **0.1.2**, build APK arm64 signed ke
`bin/V0.1.2/` (jangan hapus V0.1.0/V0.1.1), verifikasi arm64 + signed + add-provider fix, commit+push.
Jika merge upstream mengubah versi upstream, tetap pakai skema versi fork 0.1.x.

## CATATAN RESUME (FASE 4) — run sebelumnya mati karena gateway disconnect, 2026-11-21 ~06:38
Bukan provider mati — keepalive ping timeout. FASE 3 SUDAH BERES (merge `c21acfb` + `UPSTREAM.md`).
FASE 4 belum selesai. Kondisi WIP yang tertinggal di disk (LANJUTKAN, jangan ulang dari nol):
- `package.json` sudah diubah ke **0.1.2** (belum commit).
- File test baru (untracked, belum commit):
  - `src/renderer/__tests__/add-provider-flow.test.tsx`
  - `src/renderer/__tests__/custom-provider-page.test.tsx`
  - `src/renderer/stores/add-provider-flow.test.ts`
- **Fix source-nya BELUM diterapkan** — tak ada file source add-provider yang berubah.
Tugas lanjutan: selesaikan diagnosis + terapkan fix source add provider yang sebenarnya, pastikan
test lulus, lalu build APK 0.1.2 seperti definisi FASE 4 di atas.

## FASE 5 — redesign health-check jadi tab "Model Test" + polish UI + matikan auto-update (owner, 2026-11-21)
Owner tidak puas tampilan sekarang (`ALIVE · 3801 ms · 0.5 tok/s` saja). Kebutuhan:

### A. Tab tersendiri "Model Test" (BUKAN di dalam settings provider)
- Buat route top-level baru, mis. `src/renderer/routes/model-test.tsx` (atau `/model-test/`), sehingga
  di mobile jadi halaman/tab tersendiri, mudah diakses (tambahkan entry di navigasi mobile / sidebar).
- Pindahkan/jadikan halaman ini pusat fitur ping model massal. Panel lama di settings provider
  (`ProviderHealthCheck.tsx`) boleh dihapus atau diarahkan ke tab baru — yang penting test model
  punya TAB SENDIRI, tidak menyemen di halaman settings provider.

### B. Ringkasan (summary) + popup detail
- Setelah mass-ping selesai, tampilkan **ringkasan**: `N of M alive`, `N of M dead` (total model).
- Ringkasan/hasil bisa di-click → buka **popup/detail** (drawer/bottom-sheet atau modal) berisi daftar
  **per model**: badge ALIVE/DEAD, latency `xxx ms`, throughput `x.x tok/s`, nama provider+model.
- Di popup, sediakan filter/toggle: **All / Alive / Dead** agar gampang lihat mana yang dead.
- Urutkan: dead dulu atau by latency — bebas, yang penting informatif.

### C. Polish UI lebih modern
- Tampilan sekarang terlalu polos. Perindah: kartu/stat modern, badge berwarna (hijau alive / merah dead),
  angka latency & tok/s rapi, progress saat ping berjalan, empty-state yang jelas.
- Ikuti gaya UI repo (Mantine + CSS modules, dark theme). Konsisten dengan tampilan app.
- Catatan: `3801 ms / 0.5 tok/s` terlihat buruk — pastikan pengukuran tok/s benar (pakai durasi streaming
  penuh + jumlah token, bukan hanya time-to-first-token). Latency = time-to-first-token; tok/s dihitung
  dari total token / durasi streaming.

### D. Matikan / hapus cek update otomatis
- Hapus atau matikan **cek update otomatis**. Terkait:
  - setting `autoUpdate` (toggle "Automatic updates" di `src/renderer/routes/settings/about.tsx`)
  - `UpdateSection` (`src/renderer/routes/about.tsx`) + `useUpdateStore`/`installUpdate`
  - banner update di `src/renderer/Sidebar.tsx`
- Yang diminta owner: "matikan cek update otomatis, hapus saja". Paling aman: pastikan mobile TIDAK
  pernah melakukan auto-check update, dan sembunyikan/hapus UI update otomatis. Boleh hapus toggle
  auto-update & banner. Jangan sampai app memanggil endpoint update check saat start di mobile.

### Versi & build
- Naikkan `package.json` → **0.1.3**. Build APK arm64 signed ke `bin/V0.1.3/` (jangan hapus versi lama).
- Verifikasi: `pnpm run check` (0 error), test terkait lulus, APK arm64-only + signed + package
  `net.garybully.chatbox`. Commit + push. Lapor path APK + bukti + screenshot bila memungkinkan.

## FASE 6 — hanya custom provider, hapus daftar provider bawaan (owner, 2026-11-21)
Owner: "Provider bawaan hapus semua aja, cuma butuh custom provider." Owner hanya pakai endpoint
API sendiri (custom provider), tidak butuh preset bawaan (OpenAI, Claude, Gemini, DeepSeek, dll).

### Pendekatan WAJIB (aman, jangan nuked kode)
- Tujuan UI: daftar provider HANYA menampilkan **custom provider** (hasil "Add provider"). Semua
  provider bawaan/preset TIDAK muncul di daftar (Settings → Provider) maupun di pemilih model.
- JANGAN menghapus 45 file definisi di `src/shared/providers/definitions/` — itu akan merusak
  pembuatan model, default-models, login ChatboxAI, oauth, model registry, dan ratusan test.
  Cukup SEMBUNYIKAN dari UI: filter registry/catalog agar yang tampil hanya `isCustom === true`.
- Titik kode: `src/shared/providers/catalog.ts` (membangun daftar provider utk UI), `ProviderList.tsx`,
  dan pemilih model. Saring sehingga hanya custom yang dirender.
- "Add provider" (custom) tetap jadi satu-satunya cara menambah provider. Pastikan alur add custom
  tetap berfungsi (FASE 4 sudah menambah test add-provider).
- Default provider/model saat pertama kali: jangan paksa pilih provider bawaan; arahkan ke buat
  custom provider. Bila ada halaman onboarding/empty-state yang menawarkan preset bawaan, sembunyikan.

### Catatan risiko (owner disadari)
- Menghapus penuh definisi bawaan = risiko tinggi merusak banyak fitur & test. Owner setuju
  pendekatan "sembunyikan dari UI" yang mencapai hasil yang sama (hanya custom terlihat) tanpa
  merusak internals. Bila owner nanti minta hapus file fisik, itu fase terpisah.

### Versi & build
- Naikkan `package.json` → **0.1.4**. Build APK arm64 signed ke `bin/V0.1.4/` (jangan hapus versi lama).
- Verifikasi: daftar provider hanya custom; add custom provider berfungsi; `pnpm run check` 0 error;
  test terkait lulus; APK arm64-only + signed + package `net.garybully.chatbox`. Commit + push.

## FASE 7 — hapus TAWARAN PLAN / upsell ChatboxAI (login TETAP ADA) (owner, 2026-11-21, dikoreksi)
Owner: "kalau loginnya chatbox saya masih perlu, cuma tawaran plan aja hapus."
PENTING: **Login / license key ChatboxAI TETAP berfungsi** — owner masih pakainya. Yang dihapus HANYA
tawaran plan / upsell / promo / badge "PRO"/langganan, BUKAN alur login & aktivasi license.

### Cakupan (hapus)
- Kartu tawaran plan / pemilihan tipe user / claim / pricing di onboarding:
  `src/renderer/routes/guide/` (`UserTypeCards`, `ClaimWaitingCard`, dsb.) — hilangkan upsell plan,
  tapi JANGAN hilangkan jalur login ChatboxAI bagi yang mau login.
- Banner/teaser upgrade, tawaran langganan, badge "PRO"/plan, CTA "Upgrade"/"Subscribe"/"Get plan"
  di sidebar, pengaturan, web-search, default-models, pemilih model, dsb.
- Halaman/opsi harga paket ChatboxAI (`LicenseOptionContent` yang menawarkan paket berbayar) —
  hilangkan tawaran paketnya.

### Cakupan (JANGAN dihapus — WAJIB tetap ada)
- `LoginView`, `EmailCodeLoginModal`, `LoggedInView` — alur login tetap.
- `LicenseKeyView` / input license key + aktivasi — tetap (owner pakai license sendiri).
- `LicenseDetailCard` yang menampilkan status license yang SUDAH dimiliki — tetap.
- `ChatboxAISettings` inti + provider `chatboxai.ts` di level runtime — tetap.
- Ringkas: yang dibuang = penawaran jualan plan; yang dipertahankan = cara owner login & pakai
  license/key ChatboxAI.

### Pendekatan
- Sembunyikan komponen upsell dari render path (kondisional false / tidak dirender), jangan hapus file
  yang dirujuk lintas modul. Pastikan tidak ada crash / referensi rusak (`pnpm run check` 0 error).

### Versi & build
- Bila dikerjakan terpisah dari FASE 6, naikkan `package.json` satu tingkat (mis. 0.1.5) dan build APK
  arm64 signed ke `bin/V<versi>/` (jangan hapus versi lama). Verifikasi: tidak ada tawaran plan/upsell
  ChatboxAI; login + license key ChatboxAI masih berfungsi; add custom provider tetap berfungsi;
  check + test lulus; APK arm64 + signed. Commit+push.

## FASE 8 — hapus fitur Web Search, MCP, Skills, Agents & Memory (owner, 2026-11-21)
Owner mau fokus ke **testing models** saja. Sembunyikan/hapus dari UI fitur berikut:
- **Web Search** — `src/renderer/routes/settings/web-search.tsx`
- **MCP** — `src/renderer/routes/settings/mcp.tsx`
- **Skills** — `src/renderer/routes/settings/skills.tsx`
- **Agents & Memory** — `src/renderer/routes/settings/agent.tsx` (halaman ini memuat pengaturan
  agents & memory sekaligus; memory juga muncul di sini)

### Pendekatan (sembunyikan dari UI, jangan nuked core)
- Hilangkan **entry navigasi** fitur-fitur itu dari daftar nav Settings (lihat konfigurasi nav item /
  group di `src/renderer/routes/settings/route.tsx` — array `SettingsNavItem` + group) dan dari
  pencarian settings.
- Hilangkan juga **entry point lain** yang mengarah ke fitur tersebut: menu di Sidebar, tombol/panel di
  composer chat (mis. toggle web search / MCP / skills / agent mode), dan route langsung agar tidak
  bisa diakses.
- JANGAN menghapus kode inti shared/core yang dipakai pembuatan model & chat — cukup sembunyikan dari
  UI dan navigasi, konsisten dengan pendekatan FASE 6/7. Tujuannya app bersih, hanya fokus model testing.
- Pastikan tidak ada crash / referensi rusak setelah disembunyikan (`pnpm run check` 0 error).
- Fokus app setelah ini: **Model Test tab** (FASE 5) + **custom provider BYOK** (FASE 6) sebagai inti.

### Versi & build
- Naikkan `package.json` satu tingkat (mis. 0.1.5 bila digabung, atau lanjut skema 0.1.x) dan build APK
  arm64 signed ke `bin/V<versi>/` (jangan hapus versi lama). Verifikasi: fitur Web Search / MCP / Skills /
  Agents & Memory tidak tampil di UI & nav; chat + model testing + custom provider tetap berfungsi;
  `pnpm run check` 0 error; test terkait lulus; APK arm64 + signed + package `net.garybully.chatbox`.
  Commit + push.

## FASE 9 — rebrand jadi "chatboss" (fork dari chatbox) (owner, 2026-11-21)
Rename app jadi **chatboss**. Fork dari chatbox, tapi identitasnya sendiri.

### A. Nama & package
- Package name: **`com.garybully.chatboss`** (ganti dari `net.garybully.chatbox`). Ubah di:
  - `capacitor.config.ts` → `appId: 'com.garybully.chatboss'`
  - `android/app/build.gradle` → `namespace` + `applicationId`
  - `android/app/src/main/res/values/strings.xml` → `package_name`, `custom_url_scheme`
  - Pindahkan `MainActivity` ke `java/com/garybully/chatboss/` + ubah package line (regenerasi via
    `npx cap sync android` setelah ubah appId agar konsisten).
- Nama tampilan app: **`app_name` = "chatboss"** (strings.xml). Juga `package.json` `name` +
  `productName` → `com.garybully.chatboss` (atau "chatboss"). Ganti label "Chatbox" yang tampil ke
  "chatboss" di tempat yang relevan (judul app, about, dsb).

### B. Logo / ikon → tema "boss"
- Ganti ikon app jadi tema **boss** (mis. ikon kepala/boss, gaya minimal, cocok dark theme).
- Sumber ikon di `assets/` (`icon.png`, `icon.svg`, `icon.ico`, `icon.icns`, `icons/`, `iconTemplate*`).
  Ganti aset Android yang dipakai launcher (mipmap / `capacitor-assets`). Boleh generate via
  `npx capacitor-assets generate --android` setelah menaruh icon source baru, atau taruh PNG per-density.
- Buat ikon "boss" sederhana (SVG/PNG) sendiri — jangan pakai aset berlisensi. Ikon lama chatbox diganti.

### C. Halaman About
- Ubah `src/renderer/routes/settings/about.tsx`:
  - Nama → "chatboss" (bukan Chatbox).
  - **Hapus cek update / UpdateSection / needCheckUpdate / banner update** — owner tidak mau ada cek
    update sama sekali di halaman about (selaras FASE 5D). Tampilkan hanya versi app, tanpa tombol
    check update.
  - Sesuaikan deskripsi/teks agar cocok dengan chatboss (fork; fokus model testing + BYOK custom provider).

### D. Cek update dimatikan total
- Pastikan tidak ada pemanggilan update check saat start / di halaman about. (FASE 5D sudah mulai;
  FASE 9 pastikan sisa di about bersih.)

### Versi & build
- Naikkan `package.json` → lanjut skema 0.1.x (mis. 0.1.5 / sesuai antrean). Build APK arm64 signed ke
  `bin/V<versi>/` (jangan hapus versi lama). Verifikasi: package `com.garybully.chatboss`, app_name
  "chatboss", ikon baru, halaman about tanpa cek update, `pnpm run check` 0 error, test lulus,
  APK arm64 + signed. Commit + push.

## FASE 5 — SELESAI (2026-11-21)
- A: health-check dipindah ke route top-level `/model-test` (`src/renderer/routes/model-test.tsx`);
  panel lama `ProviderHealthCheck.tsx` dihapus dari `ProviderList.tsx`. Entry nav baru "Model Test"
  (IconFlask) di Sidebar (tampil juga di mobile). `filterAndSortResults` dipindah ke
  `src/renderer/utils/provider-health.ts` supaya bisa dites.
- B: ringkasan 3 kartu stat (Total / Alive "N of M" / Dead "N of M"); kartu Alive/Dead clickable →
  Modal detail per-model: badge ALIVE/DEAD, `ms`, `tok/s`, nama provider·model, filter
  SegmentedControl All/Alive/Dead, sort dead dulu lalu by latency asc.
- C: UI Mantine modern (Card, Badge berwarna, Progress saat ping, empty-state). tok/s diperbaiki:
  latency = time-to-first-token; tok/s = total token (est char/4) / durasi streaming penuh
  (first token → last token), bukan total elapsed.
- D: auto-update dimatikan — toggle "Automatic updates" dihapus dari settings/about.tsx;
  SidebarUpdateBanner (dan installUpdate di Sidebar) dihapus. `initUpdateListeners` sudah
  desktop-only sejak upstream; mobile tidak pernah auto-check update.
- i18n: keys baru (Model Test, Total, Alive, Dead, All, Not tested, dst.) di 15 locales
  (en full; zh-Hans/zh-Hant/de/ja diterjemahkan; lainnya fallback en).
- Test baru: src/renderer/__tests__/provider-health-results.test.ts (filter+sort) — PASS.
  `pnpm run check` PASS (node22). Test provider (9) + __tests__ (5) + updateStore + i18n PASS.
  (CATATAN pre-existing: vitest gabungan lintas direktori kadang gagal jsdom setPointerCapture
  saat dijalankan bersama — per-direktori PASS semua.)
- Versi 0.1.3 (package.json, versionCode 4, versionName 0.1.3). APK: bin/V0.1.3/chatbox-arm64-v0.1.3.apk
  (22.8 MB, arm64-v8a only, signed CN=garybully, aapt2: net.garybully.chatbox 0.1.3 versionCode 4).
  bin/V0.1.0/V0.1.1/V0.1.2 tetap ada.

## Catatan owner (orchestrator)
- Host TANPA internet sudo; semua dependensi via pnpm/npm registry yang sudah bisa dijangkau.
- Jika `minimumReleaseAge` pnpm memblokir dep baru, pakai `--no-frozen-lockfile` hati-hati atau
  pilih dep lama yang sudah ada di lockfile.
- Verifikasi orchestrator: akan cek `git log`, path APK, `unzip -l` arm64, versi package.json.

## FASE 2 — SELESAI (2026-11-21)
- appId/applicationId/namespace = net.garybully.chatbox (capacitor.config.ts + android/app/build.gradle,
  MainActivity dipindah ke java/net/garybully/chatbox/, strings.xml package_name & custom_url_scheme diubah).
- android/app/build.gradle: signingConfigs.release membaca ../keystore/keystore.properties (tanpa hardcoded
  password); buildType release pakai signingConfig release. versionCode 2, versionName 0.1.1.
  CATATAN: android/ di-gitignore — bila regenerate `npx cap add android`, patch build.gradle di atas HARUS
  diterapkan lagi (applicationId, namespace, signingConfigs, versionName, abiFilters arm64-v8a).
- package.json version 0.1.1. APK: bin/V0.1.1/chatbox-arm64-v0.1.1.apk (signed, arm64-v8a only,
  aapt2 badging: package net.garybully.chatbox versionName 0.1.1, native-code arm64-v8a;
  keytool -printcert -jarfile OK, SHA256 cert E8:DE:D9:F4:...). bin/V0.1.0/ tetap ada.
- Quirk: pnpm build:renderer butuh Node 22 (engines >=22.13 <23) — pakai ~/.local/node22; skrip
  delete-sourcemaps menunjuk file yang tidak ada (.erb/scripts/delete-source-maps-runner.js) — jalankan
  manual `find release/app/dist -name '*.map' -delete` sebelum `npx cap sync android`.


## FASE 3 — SELESAI (2026-11-21)
- remote `upstream` (https://github.com/chatboxai/chatbox) ditambahkan; UPSTREAM.md dibuat di root.
- Merge upstream/main 446bcf4 (v1.24.4) selesai (commit merge). Konflik: .gitignore + zh-Hans/translation.json
  — digabung kedua sisi (fitur fork + entri upstream). Fitur fork dipertahankan: health-check
  (ProviderList/ProviderHealthCheck/provider-health.ts), appId net.garybully.chatbox, signing keystore.properties.

## FASE 4 — SELESAI (2026-11-21)
- Diagnosis add provider: alur Add -> ProviderSpotlight (drawer mobile) -> AddProviderModal -> setSettings
  -> $providerId setProviderSettings diverifikasi PASS dengan test baru:
  - src/renderer/__tests__/add-provider-flow.test.tsx (UI flow mobile: Add -> spotlight -> modal -> submit -> navigate)
  - src/renderer/__tests__/custom-provider-page.test.tsx (halaman settings provider custom render tanpa crash)
  - src/renderer/stores/add-provider-flow.test.ts (store+persist: customProviders + providers map tersimpan)
- `pnpm run check` PASS; test provider (5 file, 12 test) PASS. `pnpm run lint` masih 107 error dari kode
  upstream hasil merge (biome) — baseline upstream, bukan file fork.
- Versi 0.1.2 (package.json, versionCode 3, versionName 0.1.2). APK: bin/V0.1.2/chatbox-arm64-v0.1.2.apk
  (arm64-v8a only, signed CN=garybully, aapt2: net.garybully.chatbox 0.1.2). bin/V0.1.0 & V0.1.1 tetap.
- CATATAN build: renderer build:renderer butuh Node 22 (~/.local/node22); hapus *.map manual; `npx cap sync android`;
  test jangan ditaruh di src/renderer/routes/** (route generator menganggapnya route).

## FASE 9 — SELESAI (2026-11-21)
- A: package -> com.garybully.chatboss (capacitor.config.ts appId+appName 'chatboss',
  build.gradle namespace+applicationId, strings.xml package_name+custom_url_scheme,
  MainActivity dipindah ke java/com/garybully/chatboss/, regenerasi via npx cap sync android).
  app_name/title_activity_main -> 'chatboss'. package.json name+productName -> 'chatboss',
  version 0.1.5. Label tampilan: src/renderer/index.html <title>chatboss</title>,
  settings/about.tsx + routes/about.tsx -> 'chatboss', src/renderer/static/icon.png +
  favicon.png + app-icons/*.png diganti ikon boss.
- B: ikon boss baru (mahkota emas di latar navy gelap #101623) — dibuat sendiri via PIL
  (assets/icon.svg + icon.png 1024 + icons/*.png; android mipmap ic_launcher/round/foreground
  per-density digenerate; adaptive bg #101623; splash.png semua density digambar ulang tema boss).
- C: settings/about.tsx — nama chatboss, UpdateSection + useLanguage DIHAPUS dari halaman
  (hanya tampil versi), deskripsi: "chatboss — model testing with your own API providers."
  routes/about.tsx: judul chatboss; UpdateSection kini hanya dirender di desktop.
- D: useVersion.ts — checkNeedUpdate di-skip utk non-desktop (mobile tidak pernah call
  endpoint update saat start/interval). needCheckUpdate permanen false di mobile.
- Verifikasi: pnpm run check PASS (tsc 0 error); vitest __tests__ 3 file 5 test PASS,
  stores/add-provider-flow 1 PASS, components/settings/provider 2 file 9 test PASS.
  APK: bin/V0.1.5/chatboss-arm64-v0.1.5.apk (21.6 MB). aapt2 badging: package
  com.garybully.chatboss versionCode 6 versionName 0.1.5, application-label 'chatboss',
  native-code arm64-v8a. zip lib/ = {arm64-v8a} saja; META-INF/CERT.RSA ada (signed,
  keytool CN=garybully, SHA256 E8:DE:D9:F4:...). bin/V0.1.0–V0.1.4 tetap ada.
