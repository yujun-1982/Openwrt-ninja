# local-packages —— 本地现成插件包

这两个包**只有预编译产物，没有可编译源码**，所以放在这里由本仓库在编译期接进
OpenWrt 自己的包体系（见 `../package/*/Makefile` 与 `../README.md`）。
它们不再是"首次开机才安装"的文件，也不在 `files/` overlay 里。

| 文件 | 大小 | SHA-256 |
|---|---|---|
| `luci-app-openclash-1.0.0-r1.apk` | 8 040 617 B | `f0183642c3c656390d0e1dadba06800786f9f8938e106c90c2f07c0ebae72bfb` |
| `ninjadesktop-lite-1.0.4-x86_64.apk` | 41 714 923 B | `753393c796c668d9064c51c0a4f97e0fb6379df776c2302ae1d0edcf6807f91e` |

格式是 OpenWrt 25.12 的 APKv4（文件头 `ADBd` = apk-tools 的 `ADB` + deflate 流），
由 apk-tools 3.0.5 生成 —— 与本仓库构建时 `staging_dir/host/bin/apk` 是同一个版本。

自检：

```sh
cd local-packages && sha256sum -c SHA256SUMS
```

## 替换成新版本时

必须同时改三处，否则构建**直接失败**（这是设计，不是 bug：宁可不出固件，
也不出"少了插件的固件"）：

1. `SHA256SUMS` 里对应那行的哈希；
2. `../package/luci-app-openclash/Makefile` 里的 `VENDOR_SHA256`（NinjaDesktop 在
   `../package/ninjadesktop-lite/Makefile`）；
3. 如果版本号变了，Makefile 里的 `PKG_VERSION` / `VENDOR_APK` 文件名也要跟着改。

文件名请保持原样，wrapper 的 Makefile 是按文件名取包的。

## 可见性提醒

这两个二进制一旦提交，就是**随仓库分发的**。如果本仓库打算公开而这两个包又不该
公开，请把仓库改成 Private，或者删掉提交、改由构建时从别处注入。

## 已核对过的包内元数据（用 apk-tools 解开 ADB 索引读到）

- `luci-app-openclash` 1.0.0-r1，arch `noarch`，license GPL-3.0-only，
  自述依赖 `dnsmasq-full bash curl ca-bundle ip-full jsonfilter ruby ruby-yaml
  kmod-tun unzip`；内含 Lua 时代的 LuCI 页面（`usr/lib/lua/luci/controller/openclash.lua`）
  与 `www/luci-static/resources`、`usr/share/rpcd/acl.d`、`etc/uci-defaults`、
  `etc/openclash/core`（核心）、`etc/openclash/*`、`usr/share/openclash/*`。
- `ninjadesktop-lite` 1.0.4，arch `x86_64`，license `Proprietary`，
  自述依赖只有 `libc`；内含 `usr/bin/ninja-linux-amd64`、`usr/bin/ninjadesktop-watch`、
  `etc/init.d/ninjadesktop`、`etc/config/ninjadesktop`、`etc/ninja/{geoip,geosite,Country}`
  数据，以及**纯 Lua** 的 LuCI 页面（controller + model/cbi，没有 JS/ucode 版本）。

正因为两个包的 UI 都是 Lua 时代的，`seed.config` 额外打开了 `luci-compat` 与
`luci-lua-runtime`；缺了后者，25.12 的 ucode 前端不会渲染 `controller/*.lua`，
页面不会出现（后端服务本身不受影响）。

厂商包自带的 post-install 脚本（例如 NinjaDesktop 那份 `chmod +x`、迁移
`/root/.local/share/ninjadesktop`、`uci get ninjadesktop.main.enabled` 的逻辑）
在重新打包时**被有意丢弃**：`apk extract` 只还原 data 段。本仓库用 Makefile 里的
mode 修正补上它唯一有用的部分（可执行位），其余动作要么不需要，要么会在首次开机
由插件自己的 `etc/uci-defaults` 完成。
