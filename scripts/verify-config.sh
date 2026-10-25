#!/usr/bin/env bash
#
# verify-config.sh - 断言 defconfig 展开后的 .config 里，我们要求的符号一个都没丢
#
# 为什么必须有这一步：Kconfig 对 "名字不存在" 和 "依赖不满足" 的符号都是**静默丢弃**，
# make 照样构建成功，出来的固件却少功能（中文语言包、预置插件的依赖都踩过这个坑）。
# 所以 defconfig 之后逐条核对，缺任何一条就直接失败，不放行构建。
#
# 用法：scripts/verify-config.sh [path/to/.config]
#

set -uo pipefail

CFG="${1:-openwrt/.config}"

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
CONFIG_PACKAGE_luci-i18n-base-zh-cn=y
CONFIG_PACKAGE_luci-i18n-argon-config-zh-cn=y
CONFIG_PACKAGE_luci-i18n-passwall-zh-cn=y

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
CONFIG_PACKAGE_iptables=y
CONFIG_PACKAGE_iptables-mod-tproxy=y
CONFIG_PACKAGE_coreutils-nohup=y

CONFIG_PACKAGE_htop=y
CONFIG_PACKAGE_ethtool=y
CONFIG_PACKAGE_tcpdump=y
CONFIG_PACKAGE_iperf3=y
CONFIG_PACKAGE_bind-dig=y
CONFIG_PACKAGE_mtr=y
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
	[ -n "${s}" ] || continue
	grep -qxF "${s}" "${CFG}" || missing="${missing}
          ${s}"
done <<< "${REQUIRED_Y}"

kept_on=""
while IFS= read -r s; do
	[ -n "${s}" ] || continue
	grep -qxF "${s}=y" "${CFG}" && kept_on="${kept_on} ${s}"
done <<< "${REQUIRED_OFF}"

i18n_count=$(grep -cE '^CONFIG_PACKAGE_luci-i18n-.*zh-cn=y$' "${CFG}" || true)
prebuilt_count=$(grep -cE '^CONFIG_PACKAGE_(luci-app-openclash|ninjadesktop-lite)=y$' "${CFG}" || true)

echo "    检查 ${CFG}"
echo "    简体中文语言包已点亮：${i18n_count} 个"
echo "    预置插件包已选中：${prebuilt_count}/2"

status=0
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
