#!/usr/bin/env bash
#
# inspect-local-apks.sh - 把两个本地现成插件包的**真实元数据**导出来存档
#
# 用途：核对"厂商包自己声明的依赖"和"本仓库编进镜像的依赖"是否一致。
# 这是排障证据，不参与验收判定（判定由 verify-config.sh / verify-image.sh 负责），
# 所以任何一步失败都只告警，不中断构建。
#
# 依赖 OpenWrt 构建出来的 host 侧 apk-tools（与 25.12 打包用的是同一个版本 3.0.5），
# 因此必须等到 tools 阶段跑完之后再调用。
#
# 用法：scripts/inspect-local-apks.sh [openwrt 源码目录] [输出目录]
#

set -uo pipefail

SRC="${1:-openwrt}"
OUT="${2:-artifacts}"
APK_BIN="${SRC}/staging_dir/host/bin/apk"

mkdir -p "${OUT}"

if [ ! -x "${APK_BIN}" ]; then
	echo "[warn] ${APK_BIN} 还不存在（host apk-tools 尚未构建），跳过元数据存档"
	exit 0
fi

version=$("${APK_BIN}" --version 2>&1 | head -1)
echo "    host apk: ${version}"

for f in "${SRC}"/local-packages/*.apk; do
	[ -e "${f}" ] || continue
	name=$(basename "${f}")
	echo "    adbdump ${name}"
	# adbdump 输出的是整个 ADB 结构（含文件清单），体积可能不小，只存档不判定
	if ! "${APK_BIN}" adbdump "${f}" > "${OUT}/apk-metadata-${name}.txt" 2>&1; then
		echo "[warn] adbdump ${name} 失败，见 ${OUT}/apk-metadata-${name}.txt"
		continue
	fi
	grep -aE '^(luci-app-openclash|ninjadesktop-lite)|depends|arch|version|license|origin|maintainer' \
		"${OUT}/apk-metadata-${name}.txt" | head -40 || true
done

# 同时把本次构建真正选中/装入的相关包记下来，便于对照
if [ -f "${SRC}/.config" ]; then
	grep -E '^CONFIG_PACKAGE_(dnsmasq-full|bash|curl|ca-bundle|ip-full|jsonfilter|ruby|ruby-yaml|kmod-tun|unzip|ipset|iptables|luci-compat|luci-lua-runtime|luci-app-openclash|ninjadesktop-lite)=' \
		"${SRC}/.config" > "${OUT}/selected-vendor-deps.txt" || true
	echo "    已写入 ${OUT}/selected-vendor-deps.txt"
fi

exit 0
