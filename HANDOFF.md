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

## Catatan owner (orchestrator)
- Host TANPA internet sudo; semua dependensi via pnpm/npm registry yang sudah bisa dijangkau.
- Jika `minimumReleaseAge` pnpm memblokir dep baru, pakai `--no-frozen-lockfile` hati-hati atau
  pilih dep lama yang sudah ada di lockfile.
- Verifikasi orchestrator: akan cek `git log`, path APK, `unzip -l` arm64, versi package.json.
