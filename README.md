# Openwrt-ninja

OpenWrt **25.12** x86/64 定制固件的构建配置仓库。官方 OpenWrt 源码保持不动，所有定制通过
`seed.config` + `files/` overlay + 额外 feed 注入；两个只有预编译产物的插件包通过
`package/` 里的 wrapper 接进 OpenWrt 自己的包体系。

结构来自这两个参考仓库，并按下面的要求做了改动：

- 参考 [yujun-1982/LEDE-ni](https://github.com/yujun-1982/LEDE-ni)（`build.sh` + `seed.config` + `files/` 的写法与踩坑记录）
- 参考 [yujun-1982/OpenWrt](https://github.com/yujun-1982/OpenWrt)（`local-packages/` + Actions 手动触发）
- **`luci-app-openclash-1.0.0-r1.apk` 与 `ninjadesktop-lite-1.0.4-x86_64.apk` 在编译完成后就已经装上**，不再有首次开机安装的 uci-defaults 脚本
- SoftEther 的 LuCI 页面改用外部 feed：`src-git softethervpn https://github.com/yujun-1982/luci-app-softethervpn.git`
- 逐条核实预置包的依赖在当前分支的真实包名（结论见下）

一条本地命令即可编译，也可以只在 GitHub Actions 上手动触发，两边跑的是同一个 `build.sh`。

---

## 1. 本地 Ubuntu 编译

```bash
# 构建依赖（Ubuntu 24.04，与 .github/workflows/build.yml 同一份清单）
sudo apt-get update
sudo apt-get install -y build-essential clang bison flex g++-multilib gcc-multilib \
  git git-svn libncurses5-dev libssl-dev libelf-dev python3 python3-setuptools \
  rsync swig unzip zlib1g-dev file wget gettext ccache subversion

git clone https://github.com/<你>/Openwrt-ninja.git
cd Openwrt-ninja
./build.sh                      # 准备源码树 / feed / .config / overlay + 校验
cd openwrt && make -j$(nproc) V=s
```

想一条命令走到底（准备 + 编译 + 验收）：

```bash
./build.sh --build
```

换 OpenWrt 版本（分支或 tag 都行）：

```bash
OPENWRT_REF=v25.12.6 ./build.sh --build
```

产物：

```
openwrt/bin/targets/x86/64/openwrt-x86-64-generic-squashfs-combined.img.gz
```

> 不要用 root 编译，也不要放在带空格的 Windows 路径下——这是 OpenWrt 的硬性要求。

## 2. GitHub Actions 手动编译

1. **Actions** → **Build OpenWrt x86_64 BIOS** → **Run workflow**
2. `openwrt_ref` 保持 `openwrt-25.12`（或选某个 tag），`jobs` 保持 `3`
3. 跑完下载 artifact：镜像、`.manifest`、`.buildinfo`、最终 `.config`、日志、SHA-256

工作流**只有手动触发**：这套固件依赖 `local-packages/` 里的两个包，缺包时 `build.sh`
会在预检阶段直接失败，不会出"少了插件的固件"。runner 4 核 16 GB，全量构建（含
ruby、LuCI、PassWall、内核）通常 2～4 小时，`dl/` 与 `.ccache/` 走 actions/cache。

---

## 3. 目录结构

```
Openwrt-ninja/
├── build.sh                    准备 + 校验（--build 时再编译 + 验收）
├── seed.config                 复制成 openwrt/.config，由 make defconfig 展开
├── files/                      rootfs overlay（注意：整文件替换，不是合并）
│   ├── etc/config/network        br-lan(仅 eth0) 静态 10.10.10.2/24
│   ├── etc/config/firewall       lan zone 开启 nftables 软件分流
│   ├── etc/init.d/softethervpnserver        空实现，顶掉上游的 vpnserver 自启（见 §7）
│   ├── etc/uci-defaults/96-set-luci-ui  只用 uci set 改 lang/mediaurlbase
│   └── usr/share/luci/menu.d/99-custom-menu-parents.json  补 "管控" 父节点
├── package/                    以 src-link 形式注册成 custom feed
│   ├── luci-app-openclash/Makefile      预置 apk → 本次构建的包
│   └── ninjadesktop-lite/Makefile       同上
├── local-packages/             两个现成插件包 + SHA256SUMS（必需，构建会校验）
├── scripts/
│   ├── verify-config.sh        defconfig 后逐条断言符号没被静默丢弃
│   ├── verify-image.sh         构建后断言两个包与其依赖真的在镜像里
│   └── inspect-local-apks.sh   导出厂商包真实元数据（存档，不参与判定）
├── .gitattributes              脚本/overlay/Makefile 钉 LF，*.apk *.ipk 钉 binary（防 autocrlf 毁二进制）
├── .gitignore                  忽略 /openwrt/ 与 /artifacts/；local-packages/*.apk 故意入库
└── .github/workflows/build.yml 手动触发
```

---

## 4. 两个预置插件包是怎么"在编译期装上"的

**这是本仓库和普通定制固件仓库最不一样的地方，也是它唯一的难点。**

厂商给的是 `.apk` 成品（没有可编译源码）。OpenWrt 25.12 在 `package/install` 阶段是这样
组装 rootfs 的（`package/Makefile`，上游实现）：

```make
APK_INSTALL_ARGS = $(foreach pkg,$(shell cat $(PACKAGE_INSTALL_FILES) ...),$(pkg)...) ...
$(call apk,$(TARGET_DIR)) add --no-cache --initdb --no-scripts --arch $(ARCH_PACKAGES) \
        --repositories-file /dev/null --repository file://$(PACKAGE_DIR_ALL)/packages.adb \
        $(APK_INSTALL_ARGS)
```

`APK_INSTALL_ARGS` 完全来自 `.config` 里选中的**真实包**。所以要让一个只有成品的组件
"编译完就装好"，它必须在构建体系里存在为一个真包。做法就是 `package/` 里的两个 wrapper：

| 阶段 | 发生什么 |
|---|---|
| `Build/Prepare` | 检查 `$(TOPDIR)/local-packages/<文件>` 存在，且 SHA-256 等于 Makefile 里钉住的值；不符就中止 |
| `Package/*/install` | 用 **host 侧 apk-tools** 把厂商包解出来：`staging_dir/host/bin/apk extract --destination $(IDIR)` |
| 打包 | `package-pack.mk` 用 `apk mkpkg` 把 IDIR 打成**本次构建的 .apk**，元数据（版本/arch/**依赖**）由 wrapper 的 Makefile 决定 |
| `package/install` | 它和其它上千个包一起被 `apk add --no-scripts` 装进 staged rootfs，写进 `/lib/apk/db` |
| 镜像组装 | `prepare_rootfs` 跑 post-install、按 `/etc/init.d/*` 建 rc.d 链接，然后压成 squashfs |
| 交付 | 出现在 `.manifest` 里，刷机后 `apk info` 直接看得到，**首次开机不做任何安装** |

几个关键点：

- `apk extract` 只还原 **data 段**，厂商包自带的 post-install 脚本不会进来 ——
  编译期不会拿宿主机去执行 `uci` / `init.d`，这是有意的。
- `--no-scripts` 是上游 `apk add` 自带的，同理。
- host `apk` 不是外部依赖：`package/Makefile` 里 `$(curdir)//compile +=
  $(curdir)/system/apk/host/compile`，OpenWrt 一定会先把它建出来。25.12 与 master 都把
  apk-tools 钉在 `b5a31c0` = **3.0.5**；`extract` 和 `adbdump` 在 apk-tools 的**基础
  applet 列表**里（根 `meson.build` 的 `applets = [...]`，`minimal` 只往里加
  `mkpkg/mkndx/...`），所以 host 侧（非 minimal）和设备侧（minimal）都有这两个命令
  （`src/app_extract.c` 的选项是 `--destination` 与 `--no-chown`）。
- rootfs 有一层缓存（`build_dir/target-*/rootfs-cache-*`），其 key 覆盖 `.config`、
  `packages.adb`、host apk 二进制和 `files/` 的全部内容。换掉厂商包 → `packages.adb`
  变 → 缓存自动失效，不会拿旧 rootfs 蒙你。
- 厂商包在 Windows 侧打的，可执行位不可靠；Makefile 的 install 步骤会把
  `etc/init.d/*`、`usr/{bin,sbin,libexec}/*` 以及任何以 `#!` 开头的文件补成 `0755`。

### 怎么确认它真的装上了（不要靠"刷机后自己找"）

```bash
scripts/verify-image.sh openwrt          # ./build.sh --build 会自动跑
```

它做四道检查：BIOS combined 镜像存在且没有 EFI 产物；`.manifest` 含
`luci-app-openclash` 与 `ninjadesktop-lite`；staged rootfs 的 apk 数据库里能探到这两个名字；
以及 `dnsmasq-full bash curl ca-bundle ip-full jsonfilter ruby ruby-yaml kmod-tun unzip
luci-compat luci-lua-runtime` 全都在清单内。任何一项不满足就退出码非 0。

刷机后在设备上：

```sh
apk info | grep -E 'openclash|ninjadesktop'
ls /etc/openclash/core /usr/bin/ninja-linux-amd64
cat /tmp/uci-defaults-*.log            # 只剩 96-set-luci-ui，不再有装包脚本
```

---

## 5. 依赖核实结果（回答"ruby 是不是改名成 ruby3 了"）

**没有改名。** `openwrt-25.12` 的 packages feed 里 `lang/ruby` 仍是 `PKG_NAME:=ruby`
（版本 3.4.9），子包仍是 `ruby-<库名>`；官方仓库能直接查到
`ruby-3.4.9-r1.apk` 与 `ruby-yaml-3.4.9-r1.apk`。`ruby` / `ruby-yaml` 这两个写法是对的。

厂商包自己声明的依赖（用 apk-tools 解开包内 ADB 索引读到的，不是猜的）与 25.12 的实际情况：

| 包内声明 | 25.12 里的真实包 | 来源 | 结论 |
|---|---|---|---|
| `dnsmasq-full` | dnsmasq-full | 主仓库 `package/network/services/dnsmasq` | 有效 |
| `bash` | bash | packages `utils/bash` | 有效 |
| `curl` | curl | packages `net/curl` | 有效 |
| `ca-bundle` | ca-bundle | 主仓库 `package/system/ca-certificates` | 有效 |
| `ip-full` | ip-full | 主仓库 `package/network/utils/iproute2` | 有效 |
| `jsonfilter` | jsonfilter | 主仓库 `package/utils/jsonfilter` | 有效 |
| `ruby` | ruby 3.4.9 | packages `lang/ruby` | 有效，**未改名** |
| `ruby-yaml` | ruby-yaml | packages `lang/ruby`（`RubyBuildPackage,yaml`） | 有效，**未改名** |
| `kmod-tun` | kmod-tun | 主仓库 `package/kernel/linux/modules/netsupport.mk` | 有效 |
| `unzip` | unzip | packages `utils/unzip` | 有效 |
| —（NinjaDesktop 只声明了 `libc`） | | | 见下方 Lua 运行时一行 |

在此基础上，`seed.config` 还额外把这些**编进镜像**（而不是等 `apk add` 去联网拉）：
`ipset`、`iptables`、`iptables-mod-tproxy`、`ip6tables`、`kmod-ipt-{tproxy,nat,nat6}`、
`coreutils`、`coreutils-nohup` —— OpenClash 的脚本会用到它们，但厂商包没声明。

**`luci-compat` + `luci-lua-runtime`（新增，重要）**：两个插件的 Web 页面都还是 Lua 时代的
（`usr/lib/lua/luci/controller/*.lua`，NinjaDesktop 还是纯 CBI-Lua，没有 JS 版本）。
25.12 的 LuCI 前端已经换成 ucode/JS，`luci-compat` 现在**只剩 luasrc 的库文件、不再带
dispatcher**；旧式 controller 要靠 `luci-lua-runtime`（带 `luasrc/dispatcher.lua` 与
`ucodebridge.lua`，依赖 `ucode-mod-lua`）才会渲染。`luci-lua-runtime-26.288.56989~75a306d.apk`
在 25.12 官方 luci feed 里存在，所以这里打开它。

所有上面这些名字都会由 `scripts/verify-config.sh` 在 `make defconfig` 之后逐条断言。
Kconfig 对"名字不存在"和"依赖没满足"的符号是**静默丢弃**的，构建照样成功、固件却是半成品 ——
所以这一步不是可选项。

### 简体中文覆盖到什么程度

不写 `CONFIG_PACKAGE_luci-i18n-*`（它们是 `HIDDEN:=1` 的符号，写了会被丢），只开总开关
`CONFIG_LUCI_LANG_zh_Hans=y`；凡是**被构建**且**仓库里有 `po/zh_Hans/`** 的组件，翻译包自动点亮。
`verify-config.sh` 会断言下面这些，并把解析结果逐条打印出来：

| 组件 | 翻译包 | 来源 |
|---|---|---|
| `luci-base` + core 的 network/status/system 模块 | `luci-i18n-base-zh-cn` | 官方 luci feed（模块自己没有 po，字符串都在 luci-base 里） |
| `luci-app-firewall` | `luci-i18n-firewall-zh-cn` | 官方 luci feed |
| `luci-app-package-manager` | `luci-i18n-package-manager-zh-cn` | 官方 luci feed |
| Argon 主题 | `luci-i18n-argon-config-zh-cn` | **主题仓库** `jerrykuku/luci-theme-argon`（它写了 `LUCI_BASENAME:=argon-config`；设置页那个小仓库自己没有 po） |
| `luci-app-passwall` | `luci-i18n-passwall-zh-cn` | passwall 的 `po/zh_Hans` 是指向 `zh-cn` 的**符号链接**，Linux 检出下有效 |
| `luci-app-timecontrol` | `luci-i18n-timecontrol-zh-cn` | sirpdboy feed，真 `po/zh_Hans/` 目录 |
| `luci-app-softethervpn` | `luci-i18n-softethervpn-zh-cn` | 我们的 feed，另还捆绑 `.lmo` |

**这几类没有简体中文，而且不是配置漏了**：

- `luci-proto-wireguard`、`luci-proto-ppp`、`luci-compat`、`luci-lua-runtime`、`luci-lib-*`
  上游**根本没有 `po/zh_Hans`** —— 没有包可装，相关字段是英文。
- `luci-app-openclash`：不受开关影响，靠包内自带的 `usr/lib/lua/luci/i18n/openclash.zh-cn.lmo` ✓ 有简体。
- `ninjadesktop-lite`：**包内没有任何翻译文件**（扫过完整文件清单，没有 i18n 目录、没有 `.lmo`），
  界面是英文。它是专有预置包，本仓库无法给它补翻译，只能等厂商出中文或自己做汉化补丁。

还有个坑值得记住：第三方仓库如果只有 `po/zh-cn/` 目录而没有 `po/zh_Hans/`，在 25.12 下
**不会生成任何翻译包**（luci.mk 的语言列表被 `$(if $(LUCI_LANG.$(lang)))` 过滤，映射表里只有
`zh_Hans`/`zh_Hant`）；而生成出来的包名后缀是 `zh-cn`（alias），不是目录名 `zh_Hans`。

---

## 6. 配置概要

| 项 | 值 |
|---|---|
| OpenWrt | `openwrt-25.12` 分支（可选 tag，如 `v25.12.6`）；apk 包管理 + ucode/JS LuCI |
| 架构 | x86/64 generic |
| Rootfs | squashfs（只读 + overlayfs journaling） |
| 分区 | Kernel 256 MiB / Rootfs 1024 MiB |
| 引导 | GRUB，**仅 legacy BIOS**，`CONFIG_GRUB_EFI_IMAGES` 明确关闭；串口控制台 115200，`quiet loglevel=0`，timeout `"0"` |
| 镜像格式 | 只出 gzip 压缩的 `.img.gz`（不出 ext4 / EFI / VDI / VMDK） |
| LAN | `br-lan` 桥（仅 `eth0`）静态 `10.10.10.2/24`；镜像**不预创建** `tap_eth0`，见 §7 |
| root 密码 | **空**（Web 直接进；SSH 密码登录会被 dropbear 拒绝） |
| 主题/语言 | Argon + Argon 设置页；简体中文（靠 `CONFIG_LUCI_LANG_zh_Hans=y` 点亮） |
| 分流 | nftables 软件分流开启，硬件分流关闭 |
| 预置插件 | 编译期装入，见 §4 |

## 7. 插件

| 组件 | 来源 | 说明 |
|---|---|---|
| `luci-theme-argon` / `luci-app-argon-config` | `jerrykuku/*` | 单包仓库，**不能**当 feed 注册，`build.sh` 直接 clone 到 `package/feeds/argon/` |
| `luci-app-passwall` | `xiaorouji/luci-app-passwall` + `xiaorouji/openwrt-passwall-packages` | 需要两个 feed |
| `luci-app-timecontrol` | `sirpdboy/luci-app-timecontrol` | 上网时间控制；需要 `99-custom-menu-parents.json` 补 `admin/control` 父节点 |
| `luci-app-softethervpn` | `src-git softethervpn https://github.com/yujun-1982/luci-app-softethervpn.git` | SoftEther 服务控制页 + 自己的 init 脚本、配置持久化、300 秒自动保存压缩、关机 Flush、sysupgrade 保留清单；postinst 会把上游 `/etc/init.d/softethervpnserver` 关掉，避免两个脚本抢同一个 `vpnserver` |
| `softethervpn5-server` | 官方 packages feed | **服务端**。没有任何 LuCI 应用会拉它，必须显式勾选；`softethervpn5-client` 显式不装 |
| WireGuard | 官方 feed | 只装 `kmod-wireguard` + `wireguard-tools` + `luci-proto-wireguard`，**不预置接口/密钥/规则**：私钥是站点级机密，而这个仓库是随公开分发配置的 |
| `luci-app-openclash` | `local-packages/*.apk` → wrapper 重新打包 | 不含 mihomo 核心（包内 `etc/openclash/core/` 是空目录，首次使用需在页面里联网下载核心） |
| `ninjadesktop-lite` | `local-packages/*.apk` → wrapper 重新打包 | 闭源，`Proprietary` |

### SoftEther 的 tap 与本地网桥（为什么镜像里没有 `tap_eth0`）

镜像**不预创建**任何 TAP，`/etc/config/network` 里也没有 `tap_eth0`。`tap_eth0` 是 SoftEther 在
**tap 模式的 Local Bridge** 下按 `tap_<物理网卡>` 自己创建的设备，属于"配置产物"而不是"固件内容"：
刷完机、还没在 Server Manager (Tools) 里配网桥时，`ip link` 里不应该出现任何 `tap*`。

配好之后（Server Manager → 本地网桥，设备名 `eth0`、勾选 tap 模式），`vpnserver` 会创建
`tap_eth0`，但它**不会自动进 br-lan**——端口要手动加一次（本仓库**不**装自动桥接脚本）：

- LuCI：**网络 → 接口 → 设备** → `br-lan` → 配置 → 网桥端口 里勾上 `tap_eth0` → 保存并应用；
- 命令行等价：`uci add_list network.@device[0].ports='tap_eth0'; uci commit network; /etc/init.d/network reload`。

**不能**把 `tap_eth0` 预先写进 `network` 的 `ports` 指望它自己生效：netifd 只在 ifup 时组装一次
网桥，端口当时不存在就被跳过（开机时 SoftEther 还没创建 tap）。所以手动模式下的现实是：
配置里保留 `tap_eth0` 这个端口，开机时它会被跳过；等 SoftEther 起来、tap 出现后，
重新"保存并应用"一次（或 `ip link set tap_eth0 master br-lan`）把桥接补上。
想要免这一步就恢复 `files/etc/hotplug.d/net/30-softether-tap`（设备一出现即自动入桥）。

注意 `vpn_server.config` 被 feed 的 uci-defaults 写进了 `/etc/sysupgrade.conf`
（`/usr/libexec/softethervpn/vpn_server.config`），**会跨 sysupgrade 保留**。所以：
想验证"干净镜像里没有 tap"，要么刷机时不保留配置（`sysupgrade -n`），要么先在 Server Manager 里
删掉现有本地网桥；否则升级后 tap 仍会出现——那是旧配置还在，不是镜像又预置了它。

还有一条自启路径必须堵住：`softethervpn5-server` 自带的上游 init 脚本
`/etc/init.d/softethervpnserver`（procd，`START=91`）会被 `prepare_rootfs` 建成自启链接。
feed 的 postinst 里虽然有 `disable` 它，但那段写在 `if [ -z "${IPKG_INSTROOT}" ]` 里、只在
**真机安装**时执行，编译期装包不会走；uci-defaults 的那份又要等到 `S95done`，晚于 S91。
于是**首次开机**它会按上一次刷机留下的 `vpn_server.config` 抢先拉起 vpnserver（并创建 tap）。
所以 `files/etc/init.d/softethervpnserver` 用空实现覆盖了它：镜像里不再有第二个东西能拉起
vpnserver。要起服务请用 `/etc/init.d/softethervpn start` 或 LuCI 的 **VPN → SoftEther VPN**。

关于 `files/usr/share/luci/menu.d/99-custom-menu-parents.json`：`luci-app-timecontrol` 只声明子节点
`admin/control/timecontrol`，从不声明父节点 `admin/control`。旧的 Lua dispatcher 会自动补中间层级，
25.12 的 ucode dispatcher 不会，于是"管控"整项在菜单里消失（页面本身能直达）。排查时注意 LuCI 把菜单树
缓存在**浏览器会话数据**里，服务端修好了界面也可能不刷新——重新登录，或 `ui.menu.flushCache()`。

---

## 8. 首次开机

把一台电脑接到路由器 LAN 侧，手动设成 `10.10.10.0/24` 内的地址（如 `10.10.10.10/24`），
打开 `http://10.10.10.2/`。WAN/LAN 的物理口映射取决于硬件，本项目不做假设。

## 9. 安全提醒

- 订阅链接、API token 一律走 **GitHub Secrets** 构建期注入，**绝不提交**进 `seed.config` 或 `files/`。
- 镜像里 root 是**空密码**（`/etc/shadow` 的 root 字段为空）。Web 可直接进；要用 SSH 先在
  系统 → 管理权 设密码，或给 dropbear 加 `-B`。**不要把这套固件直接暴露到公网**。
- SoftEther 的服务端管理密码必须单独用 `vpncmd` 的 `ServerPasswordSet` 设置，并且
  **把密码登记到设备**上（`umask 077; printf '%s\n' '密码' > /etc/softethervpn/management.password`），
  否则 Flush / 自动保存那两条写盘通道全部失效，HUB 和用户会随重启丢失。密码不要提交进仓库。
- `local-packages/*.apk` 一旦提交就是随仓库分发。NinjaDesktop 是 `Proprietary`：
  如果本仓库公开而你不打算分发它，请把仓库改成 **Private**，或者把这两个文件从版本库里去掉、
  改成构建前手工放入（`build.sh` 的预检和 Makefile 里的哈希校验会替你把关，缺文件就直接失败）。

## 10. 已知限制（先看这里，别当 bug 报）

1. **真机进度（截至本次修改）**：准备阶段已在 Ubuntu 24.04.5（8 核 / 9 GB / 4 GB swap）
   跑通——clone `openwrt-25.12`、5 个 feed 全部解析、Argon 两处 clone、`make defconfig`
   成功、`verify-config.sh` 全绿（**seed.config 69 条赋值零丢弃、7 个简体中文包点亮、
   `luci-app-openclash` 与 `ninjadesktop-lite` 2/2 选中**）。完整编译在进行中；
   **仍未被真实执行过的是 `apk extract` 解包、镜像组装后的 rootfs 装入、以及刷机后 Lua 界面**。
   所以这一条从"完全没跑过"降级为"后半程待验证"，但刷机前仍要按 §4 的验收逐条看日志。
2. **两个插件的 Web 界面能不能出页面，取决于 `luci-lua-runtime` 是否真的兼容这两个包**。
   后端服务与 UCI 配置不受影响（可以全程用 `uci`）。如果菜单里没有 OpenClash / NinjaDesktop，
   先 `apk info luci-lua-runtime luci-compat` 确认在装，再看 `/cgi-bin/luci/` 的报错；
   这两个包的 Lua 控制器要迁到 ucode/JS 才能长期无忧。
3. **文件冲突会中止构建**：厂商包内如果含了别的包也拥有的文件，`apk add` 会报
   "unable to overwrite" 之类错误并让 `make` 失败。这是正确的行为（宁可不出固件），
   处理方式是在 `seed.config` 里撤掉冲突的那个包，或让插件包让路。
4. **HTTPS 仍不可用**：镜像里没有证书生成器（`px5g` / `openssl` CLI 都没有），uhttpd 只挂 80。
   要开箱 HTTPS 就在 `seed.config` 加 `CONFIG_PACKAGE_px5g-mbedtls=y` 重新构建。
5. `rpcd` 的 `timeout` 默认 30 秒，慢页面加载期间会话会过期 —— 仍未处理。
6. NinjaDesktop 包 41 MiB（解包后约 113 MiB），rootfs 1024 MiB 够用，但 `squashfs`
   镜像会明显变大；如果之后再加桌面组件要注意分区余量。
7. 全量构建很重（ruby + LuCI + PassWall + 内核）。GitHub Actions 上一次跑 2～4 小时；
   runner 内存不足时把 `jobs` 调成 `2`。
8. **NinjaDesktop 的界面是英文**：那个专有包里没有任何翻译文件（见 §5 的覆盖表）。
   其余 LuCI 部分是简体中文；`luci-i18n-*` 的解析结果每次构建都会打印出来，不用猜。

## 11. 故障排查

| 现象 | 先看 | 说明 |
|---|---|---|
| `defconfig 丢弃了这些符号` | `scripts/verify-config.sh` 的输出 | 名字在当前分支不存在／依赖没满足／它是无提示语的隐藏符号（只能靠总开关点亮）。去对应 feed 确认真实名字，改 `seed.config` 重跑 |
| `预置包校验和不匹配` | `local-packages/SHA256SUMS` | 包被换过。三处哈希要一起改（见 `local-packages/README.md`） |
| `找不到预置包 $(TOPDIR)/local-packages/...` | `ls -l openwrt/local-packages` | 忘了跑 `./build.sh`：它建立这个软链 |
| `apk extract` 报错 | 该步骤的日志 | 说明厂商包不是 25.12 的 APKv4。用 `scripts/inspect-local-apks.sh` 导出的元数据核对，或找厂商要对应 25.12 的包 |
| 固件里没有插件 | `*.manifest`、`scripts/verify-image.sh` | manifest 由 rootfs 的 apk 数据库生成，是最权威的判据 |
| LuCI 页面停在"加载视图中" | `/tmp/uci-defaults-96-set-luci-ui.log` | `luci.main.resourcebase` 被弄丢了。**教训：`files/etc/config/<x>` 是整文件替换**，会连带删掉打包默认值；改配置优先用 uci-defaults 里的 `uci set` |
| 脚本执行不了 / UCI 解析失败 | 文件行尾 | 在 Windows 上检出被转成 CRLF 了；`.gitattributes` 已钉 LF，若仍出问题检查编辑器设置 |
| feed force-push 导致 overlay 没生效 | `build.sh` Step 2 的 warn | 脚本会把分叉的 feed 对齐到上游，再继续走 defconfig |
| 全量比对报 `丢弃 N 条` | 那几行的符号名 | 真机上撞到的三类（已修）：`iptables` / `ip6tables` 在 25.12 只是 `PROVIDES` 虚拟名，真实符号是 `iptables-nft`/`ip6tables-nft`（或 `-zz-legacy`）；`mtr` 变成变体包 `mtr-nojson`/`mtr-json`，裸 `mtr` 只是 Makefile 里的 `/Default` 模板名；`CCACHE` 在 `config/Config-devel.in` 里带 `if DEVEL` 门禁，得同时写 `CONFIG_DEVEL=y`（`CONFIG_DEVEL` 在 rules.mk/include/target 里没有任何引用，纯粹是菜单门禁，不影响镜像内容） |
