# UPSTREAM — pelacakan fork

- Upstream URL: https://github.com/chatboxai/chatbox (branch `main`, remote `upstream`)
- Base fork: `0ac6385` (= upstream release v1.23.5)
- Upstream HEAD saat merge: `446bcf43e7a89a0411218821de54d87d7f3cfe11` (= tag v1.24.4), dicek 2026-11-21
- Fork fitur yang wajib dipertahankan saat merge:
  - health-check provider (max RPM, ALIVE/DEAD, latency ms, token/second)
  - appId `net.garybully.chatbox`
  - release signing via `keystore/keystore.properties` (jangan push keystore)

## Cek update upstream

```sh
git ls-remote upstream HEAD
git fetch upstream
git log HEAD..upstream/main --oneline
```

Bila ada commit baru: merge `upstream/main`, pertahankan fitur fork di atas, lalu update
SHA/tanggal di file ini.
