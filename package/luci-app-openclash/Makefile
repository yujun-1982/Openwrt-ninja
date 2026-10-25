#
# luci-app-openclash - 把本地现成的 .apk 变成 OpenWrt 正常构建出来的包
#
# 为什么要绕这一层：
#   这个组件只有厂商给的预置包（内含 mihomo 核心），没有可编译的源码。要让它
#   "在编译完成后就已经装上"，唯一干净的做法是让它进入 OpenWrt 自己的包体系：
#   Build/Prepare 校验预置包 -> Package/install 用 host 侧 apk-tools 解出 payload
#   -> package-pack.mk 用 apk mkpkg 把它打成**本次构建**的 .apk -> package/install
#   阶段随其它包一起被 `apk add --initdb --no-scripts` 装进 staged rootfs。
#   于是它出现在固件的 .manifest 和镜像的 /lib/apk/db 里，首次开机不再装任何东西。
#
#   （依据：上游 package/Makefile 的 APK_INSTALL_ARGS 完全来自 .config 里选中的真实
#    包，所以"只有成品、没有 Makefile"的组件是进不了 rootfs 的。）
#
# 顺带把依赖管住：元数据由下面这段 Makefile 说了算，不照抄厂商包里那份声明。
#
# apk extract 只还原 data 段，厂商包自带的 post-install 脚本不会被带进来 ——
# 编译期不会拿宿主机去跑 uci/init.d，这正是我们要的行为。
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-openclash
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

PKG_LICENSE:=GPL-3.0-only
PKG_MAINTAINER:=OpenClash upstream (vernesong), repacked by Openwrt-ninja
PKG_URL:=https://github.com/vernesong/OpenClash

# 预置包在本仓库的 local-packages/ 里，build.sh 会把它软链成 $(TOPDIR)/local-packages
VENDOR_APK:=$(TOPDIR)/local-packages/$(PKG_NAME)-$(PKG_VERSION)-r1.apk
# 预置包的 SHA-256。换文件必须同时改这里和 local-packages/SHA256SUMS，
# 否则构建直接失败（宁可不出固件，也不出"装了个来路不明的包"的固件）
VENDOR_SHA256:=f0183642c3c656390d0e1dadba06800786f9f8938e106c90c2f07c0ebae72bfb

include $(INCLUDE_DIR)/package.mk

# 这个包没有可编译的源码：必须覆盖默认的 Build/Compile。
# 否则框架会执行 `make -C $(PKG_BUILD_DIR)`，而该目录是空的，直接报
# "No targets specified and no makefile found"（在 .built 阶段 Error 2）。
define Build/Compile
endef

# 厂商包的 arch 是 noarch（核心按架构分文件放在 /etc/openclash/core 里）。
# PKGARCH 必须写在 define Package/... 内部：BuildPackage 先 eval Package/Default
# （它无条件把 PKGARCH 设成 $(ARCH_PACKAGES)），再 eval 本包的定义 —— 写在文件顶部
# 会被 Default 覆盖掉。
define Package/luci-app-openclash
  SECTION:=custom
  CATEGORY:=Custom
  TITLE:=OpenClash (Ninja edition) - repackaged prebuilt
  PKGARCH:=all
  DEPENDS:=+luci-compat +luci-lua-runtime +dnsmasq-full +bash +curl +ca-bundle \
	+ip-full +jsonfilter +ruby +ruby-yaml +kmod-tun +unzip
endef

define Package/luci-app-openclash/description
	LuCI support for clash (Ninja edition: Ninja UA + mihomo-ninja core).
	Not built from source here: the payload comes from the prebuilt .apk in
	local-packages/ and is repacked by this build, so metadata and dependency
	names stay under this repo's control and the package lands in the rootfs
	during the build instead of on first boot.
endef

# 只做两件事：确认预置包在、确认它没被换过。
# $(PKG_BUILD_DIR) 由 package.mk 在调用 Build/Prepare 之前自己建好。
# 下面所有 shell 变量/命令替换都写成四个 $，不是笔误：本文件会经
# $(eval $(call BuildPackage,...)) 展开一次，recipe 执行时再展开第二次。
# 只写两个 $ 时，第一次展开后就成了 $(...)，被 make 当成变量名，命令替换结果
# 恒为空（真机表现：校验失败且 "actual:" 后面是空的；install 里的
# [ -z "$(ls -A ...)" ] 也会永远成立并误报"没解出任何文件"）。
define Build/Prepare
	@if [ ! -f "$(VENDOR_APK)" ]; then \
		echo "ERROR: 找不到预置包 $(VENDOR_APK)"; \
		echo "       请先在仓库根目录执行 ./build.sh（它建立 openwrt/local-packages 软链）"; \
		exit 1; \
	fi
	@h="$$$$($(MKHASH) sha256 "$(VENDOR_APK)")"; \
	if [ "$$$$h" != "$(VENDOR_SHA256)" ]; then \
		echo "ERROR: $(PKG_NAME) 预置包校验和不匹配，构建中止"; \
		echo "  expected: $(VENDOR_SHA256)"; \
		echo "  actual:   $$$$h"; \
		exit 1; \
	fi
endef

# 这三条注释掉在本 define 外面，是因为 make 会把这里展开成多条 shell 命令行，
# 只保留能被 shell 解释的东西最稳。
#   1) apk extract 解出厂商包的 data 段
#   2) 删掉解出来的 apk 数据库残片（本次构建会重新生成）
#   3) 厂商包在 Windows 侧打的，可执行位不可靠：按目录约定 + shebang 双重补齐
# apk extract 必须带 --allow-untrusted：厂商包用我们不知道的密钥签名，
# 不加这个全局选项会以 "UNTRUSTED signature" 退出 99（要写在 extract 之前）。
define Package/luci-app-openclash/install
	$(INSTALL_DIR) $(1)
	$(STAGING_DIR_HOST)/bin/apk --allow-untrusted extract --destination $(1) "$(VENDOR_APK)"
	rm -rf $(1)/lib/apk/db
	@find $(1) -type f | while read -r f; do \
		case "$$$$f" in \
			*/etc/init.d/*|*/usr/bin/*|*/usr/sbin/*|*/usr/libexec/*) chmod 0755 "$$$$f" ;; \
			*) head -n 1 "$$$$f" 2>/dev/null | grep -q '^#!' && chmod 0755 "$$$$f" ;; \
		esac; \
	done; exit 0
	@if [ -z "$$$$(ls -A $(1))" ]; then \
		echo "ERROR: apk extract 从 $(VENDOR_APK) 没解出任何文件"; \
		echo "       多半是这个包不是 25.12 的 APKv4 格式，用 scripts/inspect-local-apks.sh 核对"; \
		exit 1; \
	fi
endef

$(eval $(call BuildPackage,luci-app-openclash))
