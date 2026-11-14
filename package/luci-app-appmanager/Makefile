#
# luci-app-appmanager - 按设备 IP + 应用生成 OpenClash/mihomo AND 规则
#
# 这里刻意不用 luci.mk：本包只有一个 JS 视图，没有 po/ 翻译文件，
# 手动列出 root/ 与 htdocs/ 的安装路径更直观，也避免 feed 扫描阶段
# 对 luci.mk 的依赖解析产生歧义。
#
include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-appmanager
PKG_VERSION:=1.0.0
PKG_RELEASE:=1
PKG_LICENSE:=MIT
PKG_MAINTAINER:=OpenWrt Ninja

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-appmanager
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=LuCI 应用管理
  DEPENDS:=+luci-base
  PKGARCH:=all
endef

define Package/luci-app-appmanager/description
  在“管控”下增加“应用管理”：按设备 IP + 应用域名生成 AND 规则，
  写入 OpenClash 自定义规则与运行配置；规则在=封禁、注释=放行。
endef

define Package/luci-app-appmanager/conffiles
/etc/appmanager/config
endef

define Package/luci-app-appmanager/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	chmod 755 /usr/sbin/appmanager /etc/uci-defaults/91-appmanager-perms 2>/dev/null
	rm -f /tmp/luci-indexcache.*
	rm -rf /tmp/luci-modulecache/
	/etc/init.d/rpcd reload 2>/dev/null
}
exit 0
endef

define Build/Compile
endef

define Package/luci-app-appmanager/install
	$(INSTALL_DIR) $(1)/etc/appmanager
	$(INSTALL_DATA) $(CURDIR)/root/etc/appmanager/config $(1)/etc/appmanager/config

	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_BIN) $(CURDIR)/root/etc/uci-defaults/91-appmanager-perms $(1)/etc/uci-defaults/91-appmanager-perms

	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) $(CURDIR)/root/usr/sbin/appmanager $(1)/usr/sbin/appmanager

	$(INSTALL_DIR) $(1)/usr/share/appmanager
	$(INSTALL_DATA) $(CURDIR)/root/usr/share/appmanager/apps.tsv $(1)/usr/share/appmanager/apps.tsv

	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) $(CURDIR)/root/usr/share/luci/menu.d/luci-app-appmanager.json $(1)/usr/share/luci/menu.d/luci-app-appmanager.json

	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) $(CURDIR)/root/usr/share/rpcd/acl.d/luci-app-appmanager.json $(1)/usr/share/rpcd/acl.d/luci-app-appmanager.json

	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/appmanager
	$(INSTALL_DATA) $(CURDIR)/htdocs/luci-static/resources/view/appmanager/overview.js $(1)/www/luci-static/resources/view/appmanager/overview.js
endef

$(eval $(call BuildPackage,luci-app-appmanager))
