#!/usr/bin/env bash
#
# verify-image.sh - 构建完成后断言：两个本地现成插件包**已经在镜像里装好了**
#
# 这个仓库的核心要求是"编译完成即已安装，不在首次开机安装"，所以必须有一道
# 客观验收，而不是等刷完机去 LuCI 里找。三道检查：
#   1) 产物里有 legacy BIOS 的 combined 镜像，且没有 EFI 镜像；
#   2) 固件 .manifest（由 staged rootfs 的 apk 数据库生成）里两个包都在；
#   3) staged rootfs 的 /lib/apk/db/installed 里两个包都在。
#
# 用法：scripts/verify-image.sh [openwrt 源码目录]
#

set -uo pipefail

SRC="${1:-openwrt}"
TARGETS="${SRC}/bin/targets/x86/64"

if [ ! -d "${TARGETS}" ]; then
	echo "[error] 找不到 ${TARGETS}，构建可能没跑到出镜像这一步" >&2
	exit 1
fi

status=0

# ---- 1. 镜像产物 ----
mapfile -t BIOS_IMAGES < <(find "${TARGETS}" -maxdepth 1 -type f \
	-name '*squashfs-combined.img.gz' ! -name '*efi*' | sort)
mapfile -t EFI_IMAGES < <(find "${TARGETS}" -maxdepth 1 -type f -name '*efi*' | sort)

if [ "${#BIOS_IMAGES[@]}" -eq 0 ]; then
	echo "[error] 没有找到 squashfs-combined 的 BIOS 镜像 .img.gz" >&2
	status=1
else
	for f in "${BIOS_IMAGES[@]}"; do
		echo "    BIOS 镜像: ${f}"
		echo "      size=$(stat -c%s "${f}") bytes  sha256=$(sha256sum "${f}" | awk '{print $1}')"
	done
fi
if [ "${#EFI_IMAGES[@]}" -ne 0 ]; then
	echo "[warn] 产物里有 EFI 相关文件，seed.config 里应已关闭 EFI：" >&2
	printf '           %s\n' "${EFI_IMAGES[@]}" >&2
fi

# 顺带核对 grub efi 符号确实是关的（写错符号名会静默保持 y）
if grep -qxF 'CONFIG_GRUB_EFI_IMAGES=y' "${SRC}/.config" 2>/dev/null; then
	echo "[error] .config 里 CONFIG_GRUB_EFI_IMAGES=y，EFI 镜像仍会生成" >&2
	status=1
fi

# ---- 2 & 3. 包是否真的进了镜像 ----
mapfile -t MANIFESTS < <(find "${TARGETS}" -maxdepth 1 -type f -name '*.manifest' | sort)
if [ "${#MANIFESTS[@]}" -eq 0 ]; then
	echo "[error] 没有找到 .manifest，无法核对已安装包清单" >&2
	status=1
else
	for pkg in luci-app-openclash ninjadesktop-lite; do
		if grep -hqw -- "${pkg}" "${MANIFESTS[@]}"; then
			line=$(grep -hw -- "${pkg}" "${MANIFESTS[@]}" | head -1)
			echo "    manifest 已包含: ${line}"
		else
			echo "[error] ${pkg} 不在固件 manifest 里 —— 镜像里没有装上它" >&2
			status=1
		fi
	done
fi

DBS=()
for db in "${SRC}"/build_dir/target-*/root-*/lib/apk/db/installed \
          "${SRC}"/build_dir/target-*/root.*/lib/apk/db/installed; do
	[ -f "${db}" ] && DBS+=("${db}")
done
if [ "${#DBS[@]}" -eq 0 ]; then
	echo "[warn] 没找到 staged rootfs 的 apk 数据库，跳过第三道核对" >&2
else
	# 25.12 的 lib/apk/db/installed 是 ADB 二进制格式，只能做子串探测，
	# 因此这一道只作旁证；权威判据是上面由该数据库直接导出的 manifest。
	for pkg in luci-app-openclash ninjadesktop-lite; do
		if grep -aqF -- "${pkg}" "${DBS[0]}"; then
			echo "    rootfs apk 数据库可探测到: ${pkg}"
		else
			echo "[warn] 未在 ${DBS[0]} 里探测到 ${pkg}（以 manifest 结果为准）" >&2
		fi
	done
fi

# ---- 4. 运行依赖是否也在清单里（缺一个就意味着刷机后要联网补装） ----
if [ "${#MANIFESTS[@]}" -ne 0 ]; then
	missing_deps=""
	for pkg in dnsmasq-full bash curl ca-bundle ip-full jsonfilter ruby ruby-yaml \
		kmod-tun unzip luci-lua-runtime luci-compat; do
		grep -hqw -- "${pkg}" "${MANIFESTS[@]}" || missing_deps="${missing_deps} ${pkg}"
	done
	if [ -n "${missing_deps}" ]; then
		echo "[error] manifest 里缺少这些运行依赖：${missing_deps}" >&2
		status=1
	else
		echo "    预置插件的运行依赖全部在镜像内"
	fi
fi

if [ "${status}" -ne 0 ]; then
	echo "[error] 验收未通过。不要刷这个镜像，先按上面的报错修 seed.config 或 Makefile" >&2
else
	echo "[ok] 验收通过：两个预置包与其依赖都在镜像内，首次开机不需要装任何东西"
fi

exit ${status}
