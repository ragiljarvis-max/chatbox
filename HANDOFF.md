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
