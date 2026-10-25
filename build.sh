#!/usr/bin/env bash
#
# build.sh - 把官方 OpenWrt 源码树准备成本仓库的定制固件构建环境
#
#   ./build.sh            只做准备 + 校验，把漫长的编译留在你手里
#   ./build.sh --build    准备 + 编译 + 构建后验收（GitHub Actions 用的就是这条）
#
# 它会做：
#   1. 检查本地现成插件包（local-packages/）及其 SHA-256
#   2. clone 官方 OpenWrt（OPENWRT_REF，默认 openwrt-25.12）
#   3. 注入 feed：packages/luci 官方源 + passwall(两个) + timecontrol
#      + softethervpn + 本仓库 package/ 作为 src-link custom feed + Argon 主题
#   4. 把 seed.config 写成 .config，把 files/ 拷成 rootfs overlay，
#      并把 local-packages/ 软链进源码树（wrapper 包的 Makefile 按 $(TOPDIR)/local-packages 取包）
#   5. make defconfig 展开依赖
#   6. scripts/verify-config.sh 逐条断言符号没被 Kconfig 静默丢弃
#   7. 需要时 make + scripts/verify-image.sh 验收预置包确实进了镜像
#
# 它从不修改官方源码内容本身：所有定制都通过 feed、seed.config 和 files/ 注入。
# custom feed 用的是**本目录**而不是 GitHub 地址，保证 feed、seed.config、files/
# 永远来自同一个 revision，不会出现"配置和包不匹配"。
#

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
step()  { echo -e "\n${CYAN}==> $*${NC}"; }
info()  { echo -e "    ${GREEN}[ok]${NC} $*"; }
warn()  { echo -e "    ${YELLOW}[warn]${NC} $*"; }
error() { echo -e "    ${RED}[error]${NC} $*" >&2; }

BUILD=0
usage() {
	cat <<'EOF'
用法：./build.sh [--build]

  ./build.sh          只做准备与校验，把漫长的编译留在你手里
                      （结尾会打印要执行的 make 命令）
  ./build.sh --build  准备 + make + 构建后验收（GitHub Actions 用这条）

可用环境变量：
  OPENWRT_REF   官方 OpenWrt 的分支或 tag，默认 openwrt-25.12
  OPENWRT_DIR   源码树位置，默认 <仓库目录>/openwrt
  JOBS          make -j 的并行度，默认 nproc
  OPENWRT_DL_DIR / OPENWRT_CCACHE_DIR
                把 dl/ 与 .ccache/ 指到别处（CI 用来接缓存）
  COLLECT_ARTIFACTS=1  把产物集中复制到 artifacts/
EOF
}
for arg in "$@"; do
	case "${arg}" in
		--build) BUILD=1 ;;
		-h|--help) usage; exit 0 ;;
		*) error "未知参数：${arg}（可用：--build，详见 --help）"; exit 1 ;;
	esac
done

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
OPENWRT_REPO="${OPENWRT_REPO:-https://github.com/openwrt/openwrt.git}"
# 25.12+ 才是 apk 包管理 + ucode/JS 版 LuCI。不要用更老的稳定分支：
# 本仓库的 wrapper 包和 .apk 都是按 25.12 的规则写的。
# 这里用**发行分支**而不是 master，构建才可复现；想要某个点版本就传 tag，
# 例如 OPENWRT_REF=v25.12.6 ./build.sh
OPENWRT_REF="${OPENWRT_REF:-openwrt-25.12}"
OPENWRT_DIR="${OPENWRT_DIR:-${SCRIPT_DIR}/openwrt}"
JOBS="${JOBS:-$(nproc)}"

# Argon 主题是"仓库根就是单个包"，scripts/feeds 没法当 feed 注册，直接 clone 到
# package/feeds/ 下面。设置页在另一个独立仓库里（系统 -> Argon 设置）。
ARGON_THEME_URL="https://github.com/jerrykuku/luci-theme-argon.git"
ARGON_CONFIG_URL="https://github.com/jerrykuku/luci-app-argon-config.git"

# PassWall 需要两个 feed：LuCI 应用 + 后端包
PASSWALL_FEED_NAME="passwall"
PASSWALL_FEED_URL="https://github.com/xiaorouji/luci-app-passwall.git"
PASSWALL_PKG_FEED_NAME="passwall_packages"
PASSWALL_PKG_FEED_URL="https://github.com/xiaorouji/openwrt-passwall-packages.git"

TIMECONTROL_FEED_NAME="timecontrol"
TIMECONTROL_FEED_URL="https://github.com/sirpdboy/luci-app-timecontrol.git"

# SoftEther 的 LuCI 管理页（自带服务脚本、配置持久化、Flush、sysupgrade 保留清单）
SOFTETHER_FEED_NAME="softethervpn"
SOFTETHER_FEED_URL="https://github.com/yujun-1982/luci-app-softethervpn.git"

# 本仓库 package/ 目录里的包，以 src-link feed 暴露出去
CUSTOM_FEED_NAME="custom"

VENDOR_APKS=(
	"luci-app-openclash-1.0.0-r1.apk"
	"ninjadesktop-lite-1.0.4-x86_64.apk"
)

# ------------------------------------------------------------
step "Step 0: 预检"
if [ ! -f "${SCRIPT_DIR}/seed.config" ]; then
	error "seed.config 不存在，请在仓库根目录执行"
	exit 1
fi
if [ ! -d "${SCRIPT_DIR}/files" ] || [ ! -d "${SCRIPT_DIR}/package" ]; then
	error "files/ 或 package/ 不存在，仓库不完整"
	exit 1
fi
for f in "${VENDOR_APKS[@]}"; do
	[ -f "${SCRIPT_DIR}/local-packages/${f}" ] || {
		error "缺少本地现成插件包：local-packages/${f}"
		error "这两个包是必需的，缺了构建会直接失败（不会出半成品固件）"
		exit 1
	}
done
if [ -f "${SCRIPT_DIR}/local-packages/SHA256SUMS" ]; then
	(cd "${SCRIPT_DIR}/local-packages" && sha256sum -c --ignore-missing SHA256SUMS) \
		&& info "local-packages 校验通过" \
		|| { error "local-packages 校验和不匹配：包被改动过，构建中止"; exit 1; }
else
	warn "local-packages/SHA256SUMS 不存在，跳过校验（wrapper 包的 Makefile 里还有一份硬校验）"
fi
command -v git >/dev/null || { error "需要 git"; exit 1; }
command -v make >/dev/null || warn "没找到 make：Ubuntu 上先装构建依赖（见 README『本地编译』一节）"

# ------------------------------------------------------------
step "Step 1: OpenWrt 源码（${OPENWRT_REF}）"
if [ ! -d "${OPENWRT_DIR}/.git" ]; then
	git clone --depth 1 -b "${OPENWRT_REF}" "${OPENWRT_REPO}" "${OPENWRT_DIR}"
	info "已 clone ${OPENWRT_REPO} @ ${OPENWRT_REF}"
else
	info "复用已有源码树，更新到 ${OPENWRT_REF}"
	git -C "${OPENWRT_DIR}" fetch --depth 1 origin "${OPENWRT_REF}"
	# -f 是必要的：上一次运行会改过 feeds.conf.default，不强制的话 git 会因为
	# "local changes would be overwritten" 直接失败。官方源码我们本来就不改。
	git -C "${OPENWRT_DIR}" checkout -q -f -B ninja-target FETCH_HEAD
fi
info "源码树 HEAD = $(git -C "${OPENWRT_DIR}" rev-parse --short HEAD) ($(git -C "${OPENWRT_DIR}" log -1 --format=%s | cut -c1-60))"

# CI 可选加速：把源码下载目录和 ccache 指向已经缓存好的位置（OpenWrt 认的是
# $(TOPDIR)/dl 和 $(TOPDIR)/.ccache，所以这里用软链，不跟 make 抢变量）。
if [ -n "${OPENWRT_DL_DIR:-}" ]; then
	mkdir -p "${OPENWRT_DL_DIR}"
	rm -rf "${OPENWRT_DIR}/dl"
	ln -sfn "${OPENWRT_DL_DIR}" "${OPENWRT_DIR}/dl"
	info "openwrt/dl -> ${OPENWRT_DL_DIR}"
fi
if [ -n "${OPENWRT_CCACHE_DIR:-}" ]; then
	mkdir -p "${OPENWRT_CCACHE_DIR}"
	rm -rf "${OPENWRT_DIR}/.ccache"
	ln -sfn "${OPENWRT_CCACHE_DIR}" "${OPENWRT_DIR}/.ccache"
	info "openwrt/.ccache -> ${OPENWRT_CCACHE_DIR}"
fi

if git -C "${SCRIPT_DIR}" rev-parse --short HEAD >/dev/null 2>&1; then
	info "配置仓库 = $(git -C "${SCRIPT_DIR}" rev-parse --short HEAD) ($(git -C "${SCRIPT_DIR}" log -1 --format=%s | cut -c1-60))"
	[ -z "$(git -C "${SCRIPT_DIR}" status --porcelain)" ] || {
		warn "配置仓库有未提交改动："
		git -C "${SCRIPT_DIR}" status --short | sed 's/^/         /'
	}
fi

# ------------------------------------------------------------
step "Step 2: feeds"
cd "${OPENWRT_DIR}"

for f in "${PASSWALL_FEED_NAME}" "${PASSWALL_PKG_FEED_NAME}" "${TIMECONTROL_FEED_NAME}" "${SOFTETHER_FEED_NAME}"; do
	sed -i "/^src-git[^ ]* ${f} /d" feeds.conf.default
done
sed -i "/^src-link[^ ]* ${CUSTOM_FEED_NAME} /d" feeds.conf.default

# 注意：这里刻意用本地路径，而不是 GitHub 地址，见文件头注释。
echo "src-git ${PASSWALL_FEED_NAME} ${PASSWALL_FEED_URL}"                       >> feeds.conf.default
echo "src-git ${PASSWALL_PKG_FEED_NAME} ${PASSWALL_PKG_FEED_URL}"              >> feeds.conf.default
echo "src-git ${TIMECONTROL_FEED_NAME} ${TIMECONTROL_FEED_URL}"                >> feeds.conf.default
echo "src-git ${SOFTETHER_FEED_NAME} ${SOFTETHER_FEED_URL}"                    >> feeds.conf.default
echo "src-link ${CUSTOM_FEED_NAME} ${SCRIPT_DIR}/package"                      >> feeds.conf.default

mkdir -p package/feeds/argon
rm -rf package/feeds/argon/luci-theme-argon package/feeds/argon/luci-app-argon-config
git clone --depth 1 "${ARGON_THEME_URL}"  package/feeds/argon/luci-theme-argon
git clone --depth 1 "${ARGON_CONFIG_URL}" package/feeds/argon/luci-app-argon-config
info "Argon 主题 + 设置页已 clone 到 package/feeds/argon/"

# 上游 feed 偶尔会 force-push，让 feeds update 死在 "Not possible to fast-forward"。
# 本脚本跑在 set -e 下，那时会在拷 overlay 之前就退出，后面的 make 于是又用上一次的
# overlay 打包，固件静默少东西。先把分叉的 feed 对齐到上游分支。
for feed_dir in feeds/*; do
	[ -d "${feed_dir}/.git" ] || continue
	feed_name=$(basename "${feed_dir}")
	if ! git -C "${feed_dir}" fetch -q origin >/dev/null 2>&1; then
		warn "feed ${feed_name}: fetch 失败，保持原样"
		continue
	fi
	feed_branch=$(git -C "${feed_dir}" rev-parse --abbrev-ref HEAD 2>/dev/null || true)
	[ -n "${feed_branch}" ] && [ "${feed_branch}" != "HEAD" ] || continue
	if ! git -C "${feed_dir}" merge-base --is-ancestor HEAD "origin/${feed_branch}" >/dev/null 2>&1; then
		warn "feed ${feed_name} 与 origin/${feed_branch} 分叉（上游重写），重置对齐"
		git -C "${feed_dir}" reset -q --hard "origin/${feed_branch}"
	fi
done

./scripts/feeds update -a
./scripts/feeds install -a
problem=$(./scripts/feeds install -a 2>&1 | grep -i 'ignoring' || true)
[ -z "${problem}" ] || { error "feeds install 有问题：${problem}"; exit 1; }

# 关键包必须真的进到包树里，缺一个就说明上游目录结构或 feed 名字变了
for pair in "passwall:luci-app-passwall" "timecontrol:luci-app-timecontrol" \
            "softethervpn:luci-app-softethervpn" \
            "custom:luci-app-openclash" "custom:ninjadesktop-lite"; do
	feed=${pair%%:*}; pkg=${pair##*:}
	if [ ! -f "package/feeds/${feed}/${pkg}/Makefile" ]; then
		error "feed ${feed} 里找不到包 ${pkg} —— 上游目录结构可能变了"
		exit 1
	fi
done
if [ ! -d package/feeds/passwall_packages ] || [ -z "$(ls -A package/feeds/passwall_packages)" ]; then
	error "PassWall 的后端包 feed (passwall_packages) 是空的，luci-app-passwall 依赖它"
	exit 1
fi
info "feed 与包都已就位"

# ------------------------------------------------------------
step "Step 3: 把本地现成插件包接进源码树"
ln -sfn "${SCRIPT_DIR}/local-packages" "${OPENWRT_DIR}/local-packages"
info "$(readlink -f "${OPENWRT_DIR}/local-packages")  <- openwrt/local-packages"

# ------------------------------------------------------------
step "Step 4: seed.config 与 files/ overlay"
cp "${SCRIPT_DIR}/seed.config" "${OPENWRT_DIR}/.config"
info "seed.config -> .config"
rm -rf "${OPENWRT_DIR}/files"
cp -a "${SCRIPT_DIR}/files" "${OPENWRT_DIR}/files"
# 在 Windows 上检出时执行位可能被丢掉，overlay 里的 init.d / uci-defaults 统一补 0755，
# 免得刷完机服务起不来（prepare_rootfs 会按 /etc/init.d/* 建 rc.d 链接）。
chmod 0755 "${OPENWRT_DIR}/files/etc/init.d/"* "${OPENWRT_DIR}/files/etc/uci-defaults/"* 2>/dev/null || true
info "files/ -> openwrt/files/"
warn "overlay 是**整文件替换**，不是合并：files/etc/config/<x> 会完整顶掉 <x> 包自带的默认配置。"
warn "要改配置优先用 uci-defaults 里的 uci set（见 files/etc/uci-defaults/96-set-luci-ui）。"

# ------------------------------------------------------------
step "Step 5: 展开依赖 make defconfig"
make defconfig
info ".config 已展开"

step "Step 6: 校验解析结果"
"${SCRIPT_DIR}/scripts/verify-config.sh" "${OPENWRT_DIR}/.config"

echo
echo -e "${GREEN}环境准备完成。${NC}"
echo "    编译：cd ${OPENWRT_DIR} && make -j${JOBS} V=s"
echo "    产物：${OPENWRT_DIR}/bin/targets/x86/64/openwrt-x86-64-generic-squashfs-combined.img.gz"
echo "    验收：${SCRIPT_DIR}/scripts/verify-image.sh ${OPENWRT_DIR}"
echo
echo -e "${CYAN}两个本地现成插件包（OpenClash / NinjaDesktop）已经在 make 的"
echo -e "package/install 阶段随其它包一起装进 rootfs，不再有首次开机安装脚本。${NC}"

if [ "${BUILD}" = "1" ]; then
	step "Step 7: 下载源码包"
	make -j"${JOBS}" download

	step "Step 8: 编译固件"
	make -j"${JOBS}" V=s

	step "Step 9: 构建后验收"
	"${SCRIPT_DIR}/scripts/verify-image.sh" "${OPENWRT_DIR}"

	"${SCRIPT_DIR}/scripts/inspect-local-apks.sh" "${OPENWRT_DIR}" "${SCRIPT_DIR}/artifacts" || true

	# CI 需要一份集中放好的产物；本地默认不复制（镜像本来就在 bin/targets 里）
	if [ "${COLLECT_ARTIFACTS:-0}" = "1" ] || [ "${CI:-false}" = "true" ]; then
		step "Step 10: 收集产物"
		mkdir -p "${SCRIPT_DIR}/artifacts"
		find "${OPENWRT_DIR}/bin/targets" -type f \
			\( -name '*.img.gz' -o -name '*.img' -o -name '*.manifest' -o -name '*.buildinfo' \) \
			-exec cp {} "${SCRIPT_DIR}/artifacts/" \;
		cp "${OPENWRT_DIR}/.config" "${SCRIPT_DIR}/artifacts/final.config"
		( cd "${SCRIPT_DIR}/artifacts" \
			&& find . -maxdepth 1 -type f ! -name 'IMAGES.sha256' -printf '%P\n' \
				| sort | xargs -r sha256sum > IMAGES.sha256 )
		ls -la "${SCRIPT_DIR}/artifacts"
		info "产物已集中到 ${SCRIPT_DIR}/artifacts/"
	fi

	info "完成，可以下载/烧写镜像了"
fi
