#
# ninjadesktop-lite - 把本地现成的 .apk 变成 OpenWrt 正常构建出来的包
#
# 机制与 luci-app-openclash 的 Makefile 完全一致（那份的注释里有完整依据）：
# 校验预置包 -> apk extract 解出 payload -> 本仓库重新打成"本次构建的包" ->
# package/install 阶段随其它包一起装进 staged rootfs，首次开机不做任何安装。
#
# 版本号说明：厂商包元数据里的版本是 "1.0.4"（没有 -rN），我们重建后是 "1.0.4-r1"，
# 是同一份 payload，只是元数据由本仓库生成。
#
# 注意：厂商包里带一个 post-install 脚本（chmod +x、迁移
# /root/.local/share/ninjadesktop、按 uci 状态重新 enable）。apk extract 只还原
# data 段，这个脚本**不会**进入我们的包：编译期不该在宿主机上跑 uci/init.d，
# 迁移逻辑对全新镜像也没意义，唯一有用的 chmod 由下面的 mode 修正补上。
#

include $(TOPDIR)/rules.mk

PKG_NAME:=ninjadesktop-lite
PKG_VERSION:=1.0.4
PKG_RELEASE:=1

PKG_LICENSE:=Proprietary
PKG_MAINTAINER:=NinjaRouter Team (repacked by Openwrt-ninja)
PKG_URL:=https://app.ninjav2.dev/

# 专有包：不提供源码、不可重新构建，payload 完全来自这个文件
VENDOR_APK:=$(TOPDIR)/local-packages/$(PKG_NAME)-$(PKG_VERSION)-x86_64.apk
VENDOR_SHA256:=753393c796c668d9064c51c0a4f97e0fb6379df776c2302ae1d0edcf6807f91e

include $(INCLUDE_DIR)/package.mk

# 这个包没有可编译的源码：必须覆盖默认的 Build/Compile。
# 否则框架会执行 `make -C $(PKG_BUILD_DIR)`，而该目录是空的，直接报
# "No targets specified and no makefile found"（在 .built 阶段 Error 2）。
define Build/Compile
endef

# 厂商包 arch = x86_64，正好等于 Package/Default 给的 $(ARCH_PACKAGES)，所以这里
# 不写 PKGARCH。（要写必须写在 define 内部：Default 会覆盖文件顶部的赋值。）
define Package/ninjadesktop-lite
  SECTION:=custom
  CATEGORY:=Custom
  TITLE:=NinjaRouter for OpenWrt (Lite) - repackaged prebuilt
  DEPENDS:=+luci-compat +luci-lua-runtime
endef

define Package/ninjadesktop-lite/description
	NinjaRouter for OpenWrt - Lite. Proprietary, prebuilt only: ships
	usr/bin/ninja-linux-amd64, usr/bin/ninjadesktop-watch and a Lua-era LuCI
	page (usr/lib/lua/luci/controller/ninjadesktop.lua). Repacked by this build
	so it is already installed in the image instead of on first boot.
endef

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

# apk extract 必须带 --allow-untrusted：厂商包用我们不知道的密钥签名，
# 不加这个全局选项会以 "UNTRUSTED signature" 退出 99（要写在 extract 之前）。
define Package/ninjadesktop-lite/install
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

$(eval $(call BuildPackage,ninjadesktop-lite))
