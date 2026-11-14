include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-appmanager
PKG_VERSION:=1.0.0
PKG_RELEASE:=1
PKG_LICENSE:=MIT
PKG_MAINTAINER:=OpenWrt Ninja

LUCI_TITLE:=LuCI 应用管理 - OpenClash 按设备/应用联网管控
LUCI_DESCRIPTION:=在“管控”下增加“应用管理”：按设备 IP + 应用域名生成 AND 规则，写入 OpenClash 自定义规则与运行配置，规则在=封禁、注释=放行。
LUCI_DEPENDS:=+luci-base
LUCI_PKGARCH:=all

define Package/$(PKG_NAME)/conffiles
/etc/appmanager/config
endef

define Package/$(PKG_NAME)/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	chmod 755 /usr/sbin/appmanager /etc/uci-defaults/91-appmanager-perms 2>/dev/null
	rm -f /tmp/luci-indexcache.*
	rm -rf /tmp/luci-modulecache/
	/etc/init.d/rpcd reload 2>/dev/null
}
exit 0
endef

include $(TOPDIR)/feeds/luci/luci.mk
