#!/usr/bin/env bash
#
# verify-config.sh - 断言 defconfig 展开后的 .config 里，我们要求的符号一个都没丢
#
# 为什么必须有这一步：Kconfig 对 "名字不存在" 和 "依赖不满足" 的符号都是**静默丢弃**，
# make 照样构建成功，出来的固件却少功能（中文语言包、预置插件的依赖都踩过这个坑）。
# 所以 defconfig 之后逐条核对，缺任何一条就直接失败，不放行构建。
#
# 两道检查：
#   A) 手工维护的必选符号清单（REQUIRED_Y / REQUIRED_OFF）——表达"这套固件必须有什么"；
#   B) 全量比对 seed.config 的每一条 CONFIG_* 赋值——不依赖清单是否写全，25.12 里
#      CCACHE 藏在 `if DEVEL` 菜单里被静默丢弃，就是 B 抓出来的（A 当时没覆盖到）。
#
# 用法：scripts/verify-config.sh [path/to/.config] [path/to/seed.config]
#

set -uo pipefail

CFG="${1:-openwrt/.config}"
SEED="${2:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)/seed.config}"

if [ ! -f "${CFG}" ]; then
	echo "[error] 找不到 ${CFG}（请在仓库根目录执行，或把 .config 路径作为参数传进来）" >&2
	exit 1
fi

# 必须为 y 的符号
REQUIRED_Y="
CONFIG_TARGET_x86=y
CONFIG_TARGET_x86_64=y
CONFIG_TARGET_x86_64_DEVICE_generic=y
CONFIG_TARGET_ROOTFS_SQUASHFS=y
CONFIG_TARGET_IMAGES_GZIP=y
CONFIG_TARGET_KERNEL_PARTSIZE=256
CONFIG_TARGET_ROOTFS_PARTSIZE=1024
CONFIG_GRUB_IMAGES=y
CONFIG_GRUB_CONSOLE=y
CONFIG_GRUB_BAUDRATE=115200
CONFIG_GRUB_TIMEOUT=\"0\"
CONFIG_GRUB_BOOTOPTS=\"quiet loglevel=0\"

CONFIG_PACKAGE_luci=y
CONFIG_PACKAGE_luci-app-firewall=y
CONFIG_PACKAGE_luci-app-package-manager=y
CONFIG_PACKAGE_luci-compat=y
CONFIG_PACKAGE_luci-lua-runtime=y

CONFIG_LUCI_LANG_zh_Hans=y
# 简体中文翻译包（luci.mk 规则：有 po/zh_Hans/*.po 才会生成 luci-i18n-<basename>-zh-cn，
# 包名后缀是 alias 后的 zh-cn，不是目录名 zh_Hans）。
# 注意 luci-i18n-argon-config-zh-cn 来自**主题仓库** jerrykuku/luci-theme-argon
# （它的 Makefile 写了 LUCI_BASENAME:=argon-config），不是那个设置页小仓库。
CONFIG_PACKAGE_luci-i18n-base-zh-cn=y
CONFIG_PACKAGE_luci-i18n-firewall-zh-cn=y
CONFIG_PACKAGE_luci-i18n-package-manager-zh-cn=y
CONFIG_PACKAGE_luci-i18n-argon-config-zh-cn=y
CONFIG_PACKAGE_luci-i18n-passwall-zh-cn=y
CONFIG_PACKAGE_luci-i18n-timecontrol-zh-cn=y
CONFIG_PACKAGE_luci-i18n-softethervpn-zh-cn=y

CONFIG_PACKAGE_luci-theme-argon=y
CONFIG_PACKAGE_luci-app-argon-config=y
CONFIG_PACKAGE_luci-app-passwall=y
CONFIG_PACKAGE_luci-app-timecontrol=y
CONFIG_PACKAGE_luci-app-softethervpn=y
CONFIG_PACKAGE_softethervpn5-server=y

CONFIG_PACKAGE_kmod-wireguard=y
CONFIG_PACKAGE_wireguard-tools=y
CONFIG_PACKAGE_luci-proto-wireguard=y
CONFIG_PACKAGE_kmod-nft-offload=y

CONFIG_PACKAGE_luci-app-openclash=y
CONFIG_PACKAGE_ninjadesktop-lite=y

CONFIG_PACKAGE_dnsmasq-full=y
CONFIG_PACKAGE_bash=y
CONFIG_PACKAGE_curl=y
CONFIG_PACKAGE_ca-bundle=y
CONFIG_PACKAGE_jsonfilter=y
CONFIG_PACKAGE_unzip=y
CONFIG_PACKAGE_ruby=y
CONFIG_PACKAGE_ruby-yaml=y
CONFIG_PACKAGE_ip-full=y
CONFIG_PACKAGE_kmod-tun=y
CONFIG_PACKAGE_ipset=y
# 25.12 里没有 CONFIG_PACKAGE_iptables / _ip6tables 这两个符号：iptables 与 ip6tables
# 只是 iptables-nft / iptables-zz-legacy（及 ip6tables-*）通过 PROVIDES 提供的虚拟名。
# 本固件是 firewall4/nftables，所以断言的是 nft 变体。
CONFIG_PACKAGE_iptables-nft=y
CONFIG_PACKAGE_ip6tables-nft=y
CONFIG_PACKAGE_iptables-mod-tproxy=y
CONFIG_PACKAGE_coreutils-nohup=y

CONFIG_PACKAGE_htop=y
CONFIG_PACKAGE_ethtool=y
CONFIG_PACKAGE_tcpdump=y
CONFIG_PACKAGE_iperf3=y
CONFIG_PACKAGE_bind-dig=y
# mtr 在 25.12 拆成变体包，裸 mtr 只是 Makefile 里的 /Default 模板名，不是可选符号
CONFIG_PACKAGE_mtr-nojson=y
CONFIG_PACKAGE_pciutils=y
CONFIG_PACKAGE_usbutils=y
"

# 必须明确保持关闭的符号
REQUIRED_OFF="
CONFIG_GRUB_EFI_IMAGES
CONFIG_TARGET_ROOTFS_EXT4FS
CONFIG_PACKAGE_dnsmasq
CONFIG_PACKAGE_softethervpn5-client
CONFIG_TARGET_IMAGES_ZSTD
CONFIG_VDI_IMAGES
CONFIG_VMDK_IMAGES
"

missing=""
while IFS= read -r s; do
	# 跳过空行与注释行：清单里允许写说明，不会当成待断言的符号
	[ -n "${s}" ] || continue
	case "${s}" in
		'#'*) continue ;;
	esac
	grep -qxF "${s}" "${CFG}" || missing="${missing}
          ${s}"
done <<< "${REQUIRED_Y}"

kept_on=""
while IFS= read -r s; do
	[ -n "${s}" ] || continue
	case "${s}" in
		'#'*) continue ;;
	esac
	grep -qxF "${s}=y" "${CFG}" && kept_on="${kept_on} ${s}"
done <<< "${REQUIRED_OFF}"

# B) seed.config 的全量比对：每一条 CONFIG_* 赋值都必须在展开后的 .config 里原样存在
seed_dropped=""
seed_total=0
seed_drop_count=0
if [ -f "${SEED}" ]; then
	while IFS= read -r l; do
		case "${l}" in
			CONFIG_*) ;;
			*) continue ;;
		esac
		seed_total=$((seed_total + 1))
		grep -qxF "${l}" "${CFG}" || {
			seed_dropped="${seed_dropped}
          ${l}"
			seed_drop_count=$((seed_drop_count + 1))
		}
	done < "${SEED}"
fi

i18n_count=$(grep -cE '^CONFIG_PACKAGE_luci-i18n-.*zh-cn=y$' "${CFG}" || true)
prebuilt_count=$(grep -cE '^CONFIG_PACKAGE_(luci-app-openclash|ninjadesktop-lite)=y$' "${CFG}" || true)

echo "    检查 ${CFG}"
echo "    简体中文语言包已点亮：${i18n_count} 个"
for l in $(grep -oE '^CONFIG_PACKAGE_luci-i18n-[a-z0-9_-]+-zh-cn=y$' "${CFG}" | sed -e 's/^CONFIG_PACKAGE_//' -e 's/=y$//'); do
	echo "      - ${l}"
done
echo "    预置插件包已选中：${prebuilt_count}/2"
if [ -f "${SEED}" ]; then
	echo "    seed.config 全量比对：${seed_total} 条赋值，丢弃 ${seed_drop_count} 条"
else
	echo "    [warn] 找不到 ${SEED}，跳过全量比对" >&2
fi

status=0
if [ -n "${seed_dropped}" ]; then
	echo "[error] seed.config 里这些赋值没有出现在展开后的 .config：${seed_dropped}" >&2
	echo "        seed.config 的写法必须与当前分支的符号名一致；被丢弃就说明这个名字" >&2
	echo "        在当前 OpenWrt 版本上不存在（或它的菜单门禁没打开、依赖没满足）。" >&2
	status=1
fi
if [ -n "${missing}" ]; then
	echo "[error] defconfig 丢弃了这些符号：${missing}" >&2
	echo "        原因只有三种：符号名在当前分支不存在；它的依赖没满足；" >&2
	echo "        或者它是没有提示语的隐藏符号（只能靠总开关点亮，见 seed.config 注释）。" >&2
	echo "        去对应 feed 里确认真实名字，改 seed.config 后重跑，不要靠 make 构建成功来验收。" >&2
	status=1
fi
if [ -n "${kept_on}" ]; then
	echo "[error] 这些符号本应关闭，实际却是 y：${kept_on}" >&2
	echo "        多半是符号名写错了（旧分支的名字），或依赖把它拉回来了。" >&2
	status=1
fi

exit ${status}
