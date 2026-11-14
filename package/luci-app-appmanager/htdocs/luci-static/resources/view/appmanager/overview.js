'use strict';
'require view';
'require fs';
'require ui';

var DEFAULT_RUNTIME = '/etc/openclash/次元.yaml';
var DEFAULT_CUSTOM = '/etc/openclash/custom/openclash_custom_rules.list';

var APP_META = {
	taobao:          { short: '淘', color: '#ff6a00' },
	hongguo:         { short: '红', color: '#ff3b30' },
	xiaohongshu:     { short: '书', color: '#ff2442' },
	tencentvideo:    { short: '腾', color: '#00a4ff' },
	wechat_channels: { short: '视', color: '#07c160' },
	iqiyi:           { short: '奇', color: '#00b42a' },
	xigua:           { short: '西', color: '#ff5a1f' },
	fanqie:          { short: '番', color: '#ff8a00' },
	douyin:          { short: '抖', color: '#fe2c55' }
};

var PALETTE = [ '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#0891b2', '#16a34a', '#ca8a04', '#dc2626' ];

var CSS = [
	'.am-page{max-width:1120px;margin:0 auto;padding:0 2px 36px;color:inherit}',
	'.am-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:8px 0 16px}',
	'.am-title{font-size:24px;line-height:1.25;font-weight:700;margin:0 0 4px}',
	'.am-sub{margin:0;color:rgba(127,127,127,.95);font-size:13px;line-height:1.6}',
	'.am-hero-actions{display:flex;gap:8px;flex-wrap:wrap}',
	'.am-card{background:rgba(127,127,127,.065);border:1px solid rgba(127,127,127,.22);border-radius:14px;padding:16px;margin:12px 0}',
	'.am-status-card{padding:16px 16px 12px}',
	'.am-status-top{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}',
	'.am-switch-row{display:flex;align-items:center;gap:12px;min-width:240px}',
	'.am-switch{position:relative;display:inline-block;width:46px;height:26px;flex:0 0 auto}',
	'.am-switch input{opacity:0;width:0;height:0;position:absolute}',
	'.am-slider{position:absolute;cursor:pointer;inset:0;background:rgba(127,127,127,.35);transition:.18s;border-radius:26px}',
	'.am-slider:before{position:absolute;content:"";height:20px;width:20px;left:3px;top:3px;background:#fff;transition:.18s;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.25)}',
	'.am-switch input:checked + .am-slider{background:#2563eb}',
	'.am-switch input:checked + .am-slider:before{transform:translateX(20px)}',
	'.am-switch-text{display:flex;flex-direction:column;gap:2px;font-size:13px;line-height:1.45}',
	'.am-switch-text strong{font-size:14px}',
	'.am-stats{display:grid;grid-template-columns:repeat(3,minmax(110px,1fr));gap:10px;margin-top:14px}',
	'.am-stat{background:rgba(127,127,127,.07);border:1px solid rgba(127,127,127,.14);border-radius:10px;padding:9px 11px;display:flex;flex-direction:column;gap:3px}',
	'.am-stat-label{font-size:11px;color:rgba(127,127,127,.95);letter-spacing:.02em}',
	'.am-stat-value{font-size:15px;line-height:1.3}',
	'.am-ok{color:#16a34a}.am-bad{color:#dc2626}.am-warn{color:#d97706}',
	'.am-warnings{margin-top:12px;display:flex;flex-direction:column;gap:6px}',
	'.am-warning{font-size:12px;line-height:1.55;padding:7px 10px;border-radius:8px;background:rgba(217,119,6,.12);border:1px solid rgba(217,119,6,.28)}',
	'.am-warning.bad{background:rgba(220,38,38,.1);border-color:rgba(220,38,38,.28)}',
	'.am-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:22px 2px 8px}',
	'.am-section-head h3{font-size:17px;margin:0 0 3px}',
	'.am-toolbar{display:flex;gap:8px;flex-wrap:wrap}',
	'.am-muted{color:rgba(127,127,127,.95);font-size:12px;line-height:1.55;margin:0}',
	'.am-device{padding:14px 15px 12px;margin:10px 0}',
	'.am-device-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
	'.am-device-num{width:26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:#2563eb;color:#fff;font-size:12px;font-weight:700;flex:0 0 auto}',
	'.am-name-input{max-width:190px;min-width:130px;flex:1 1 150px}',
	'.am-ip-field{display:flex;align-items:center;gap:6px;flex:1 1 190px;max-width:270px}',
	'.am-ip-field span{font-size:11px;font-weight:700;color:rgba(127,127,127,.95)}',
	'.am-ip-input{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;min-width:120px}',
	'.am-device-count{font-size:12px;color:rgba(127,127,127,.95);white-space:nowrap;margin-left:auto}',
	'.am-del-device{flex:0 0 auto}',
	'.am-app-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(122px,1fr));gap:8px;margin-top:12px}',
	'.am-app-chip{position:relative;display:flex;align-items:center;gap:8px;border:1px solid rgba(127,127,127,.25);border-radius:10px;padding:8px 9px;cursor:pointer;user-select:none;background:rgba(127,127,127,.025);transition:border-color .15s,background .15s;min-height:38px}',
	'.am-app-chip:hover{border-color:rgba(37,99,235,.55)}',
	'.am-app-chip.selected{border-color:var(--am-app-color,#2563eb);background:rgba(37,99,235,.08);box-shadow:inset 0 0 0 1px var(--am-app-color,#2563eb)}',
	'.am-app-chip input{position:absolute;opacity:0;width:1px;height:1px}',
	'.am-app-icon{width:22px;height:22px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;background:var(--am-app-color,#2563eb);color:#fff;font-size:11px;font-weight:700;flex:0 0 auto}',
	'.am-app-name{font-size:12px;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
	'.am-app-tick{margin-left:auto;font-size:12px;font-weight:700;color:var(--am-app-color,#2563eb);opacity:0;flex:0 0 auto}',
	'.am-app-chip.selected .am-app-tick{opacity:1}',
	'.am-device-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px;padding-top:9px;border-top:1px dashed rgba(127,127,127,.2)}',
	'.am-device-actions .am-muted{margin-left:auto}',
	'.am-empty{padding:26px 16px;text-align:center;border:1px dashed rgba(127,127,127,.35);border-radius:12px}',
	'.am-empty p{margin:0 0 12px;color:rgba(127,127,127,.95);font-size:13px}',
	'.am-save-btn{font-weight:600}',
	'.am-advanced{margin-top:14px}',
	'.am-advanced summary{cursor:pointer;font-size:14px;font-weight:600;padding:4px 2px;outline:none}',
	'.am-adv-body{padding:12px 2px 0}',
	'.am-adv-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
	'.am-field{display:flex;flex-direction:column;gap:5px;margin-bottom:10px}',
	'.am-field label{font-size:12px;font-weight:600}',
	'.am-field .am-muted{font-weight:400}',
	'.am-check-line{display:flex;align-items:flex-start;gap:8px;font-size:12px;line-height:1.55;margin:6px 0 10px}',
	'.am-check-line input{margin-top:3px}',
	'.am-pre{max-height:380px;overflow:auto;white-space:pre-wrap;word-break:break-word;background:rgba(0,0,0,.18);border:1px solid rgba(127,127,127,.25);border-radius:8px;padding:10px;font-size:12px;line-height:1.55;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}',
	'.am-custom-list{display:flex;flex-direction:column;gap:6px;margin:6px 0 10px}',
	'.am-custom-row{display:flex;align-items:center;gap:8px;font-size:12px;padding:6px 8px;border:1px solid rgba(127,127,127,.2);border-radius:8px}',
	'.am-custom-row .am-grow{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
	'.am-error{color:#dc2626;font-size:12px;line-height:1.5;margin:6px 0}',
	'.am-form{display:flex;flex-direction:column;gap:8px;min-width:min(520px,78vw)}',
	'.am-form textarea{min-height:92px;resize:vertical;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}',
	'.am-footer-note{text-align:center;color:rgba(127,127,127,.9);font-size:11px;line-height:1.7;margin-top:18px}',
	'@media (max-width:720px){.am-page{padding-bottom:24px}.am-stats{grid-template-columns:1fr 1fr}.am-adv-grid{grid-template-columns:1fr}.am-device-count{margin-left:0}.am-device-actions .am-muted{margin-left:0;width:100%}.am-title{font-size:21px}}'
].join('\n');

function parseStatus(text) {
	var st = { devices: [], customApps: [], warnings: [] };
	String(text || '').split(/\r?\n/).forEach(function(line) {
		if (!line) return;
		var sp = line.indexOf(' ');
		var k = sp < 0 ? line : line.slice(0, sp);
		var v = sp < 0 ? '' : line.slice(sp + 1);
		if (k === 'device') {
			var d = v.split('|');
			if (d.length >= 3)
				st.devices.push({ ip: d[0], name: d[1], apps: d[2] ? d[2].split(',') : [] });
		}
		else if (k === 'app') {
			var a = v.split('|');
			if (a.length >= 3)
				st.customApps.push({ id: a[0], name: a[1], targets: a[2] ? a[2].split(',') : [] });
		}
		else if (k === 'warning') {
			st.warnings.push(v);
		}
		else {
			st[k] = v;
		}
	});
	return st;
}

function parseCatalog(text) {
	var apps = [];
	String(text || '').split(/\r?\n/).forEach(function(line) {
		if (!line || line.charAt(0) === '#') return;
		var p = line.split('|');
		if (p.length < 3 || !p[0] || !p[1]) return;
		apps.push({
			id: p[0],
			name: p[1],
			targets: p[2] ? p[2].split(',') : [],
			note: p[3] || '',
			custom: false
		});
	});
	return apps;
}

function mergeCustomApps(apps, st) {
	var seen = {};
	apps.forEach(function(a) { seen[a.id] = true; });
	(st.customApps || []).forEach(function(a) {
		if (!a.id || seen[a.id]) return;
		seen[a.id] = true;
		apps.push({ id: a.id, name: a.name, targets: a.targets || [], note: '自定义应用', custom: true });
	});
	return apps;
}

function isValidIPv4(ip) {
	var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(ip || ''));
	if (!m) return false;
	for (var i = 1; i <= 4; i++) {
		if (m[i].length > 1 && m[i].charAt(0) === '0') return false;
		var n = parseInt(m[i], 10);
		if (n < 0 || n > 255) return false;
	}
	return true;
}

function isValidCidr(value) {
	var s = String(value || '').trim();
	var p = s.split('/');
	if (p.length > 2 || !isValidIPv4(p[0])) return false;
	if (p.length === 2 && !/^(0|[1-9]|[12]\d|3[0-2])$/.test(p[1])) return false;
	return true;
}

function normalizeTarget(value) {
	var t = String(value || '').trim().toLowerCase();
	if (!t) return null;
	if (t.indexOf('ip:') === 0) {
		var c = t.slice(3);
		if (!isValidCidr(c)) return null;
		return 'ip:' + c;
	}
	if (t.indexOf('wildcard:') === 0 || t.indexOf('*') >= 0) {
		var w = t.indexOf('wildcard:') === 0 ? t.slice(9) : t;
		if (!w || w.length > 253 || w.indexOf('.') < 0) return null;
		if (/[^a-z0-9.*-]/.test(w) || w.indexOf('..') >= 0 || w.charAt(0) === '.' || w.charAt(w.length - 1) === '.')
			return null;
		if (/(^|\.)qq\.com$/.test(w) || /(^|\.)weixin\.qq\.com$/.test(w)) return null;
		return 'wildcard:' + w;
	}
	t = t.replace(/^\*\./, '').replace(/^\./, '');
	if (/^(qq\.com|weixin\.qq\.com|wechat\.com|wx\.qq\.com|weixinbridge\.com|weixin\.com)$/.test(t))
		return null;
	if (t.length > 253 || t.indexOf('.') < 0) return null;
	var labels = t.split('.');
	for (var i = 0; i < labels.length; i++) {
		if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(labels[i]))
			return null;
	}
	return t;
}

function splitTargets(value) {
	var out = [], seen = {};
	String(value || '').replace(/[，,;；\s]+/g, '\n').split('\n').forEach(function(t) {
		t = normalizeTarget(t);
		if (t && !seen[t]) {
			seen[t] = true;
			out.push(t);
		}
	});
	return out;
}

function appMeta(app) {
	if (APP_META[app.id]) return APP_META[app.id];
	var h = 0, name = String(app.name || '?');
	for (var i = 0; i < name.length; i++)
		h = ((h * 31) + name.charCodeAt(i)) | 0;
	return {
		short: name.charAt(0) || '?',
		color: PALETTE[Math.abs(h) % PALETTE.length]
	};
}

function execError(res) {
	var s = res && (res.stderr || res.stdout) ? String(res.stderr || res.stdout).trim() : '';
	if (!s && res && res.code !== undefined) s = '退出码 ' + res.code;
	return s || '未知错误';
}

function failed(res) {
	return !!(res && res.code !== undefined && Number(res.code) !== 0);
}

function stat(label, value, cls) {
	return E('div', { class: 'am-stat' }, [
		E('span', { class: 'am-stat-label' }, label),
		E('strong', { class: 'am-stat-value ' + (cls || '') }, value)
	]);
}

return view.extend({
	load: function() {
		return Promise.all([
			fs.exec('/usr/sbin/appmanager', [ 'status' ]).catch(function(err) {
				return { code: -1, stdout: '', stderr: String(err && err.message ? err.message : err) };
			}),
			fs.read('/usr/share/appmanager/apps.tsv').catch(function() { return ''; })
		]);
	},

	render: function(data) {
		var self = this;
		var statusRes = (data && data[0]) || {};
		var catalogText = (data && data[1]) || '';

		if (failed(statusRes)) {
			return E('div', { class: 'am-page' }, [
				E('h2', { class: 'am-title' }, '应用管理'),
				E('div', { class: 'am-card' }, [
					E('p', { class: 'am-error' }, '无法读取后端状态。'),
					E('pre', { class: 'am-pre' }, execError(statusRes)),
					E('p', { class: 'am-muted' }, '请确认 luci-app-appmanager 已安装、/usr/sbin/appmanager 可执行，并刷新页面。')
				])
			]);
		}

		var st = parseStatus(statusRes.stdout);
		var apps = mergeCustomApps(parseCatalog(catalogText), st);
		if (!apps.length) {
			return E('div', { class: 'am-page' }, [
				E('h2', { class: 'am-title' }, '应用管理'),
				E('div', { class: 'am-card' }, [
					E('p', { class: 'am-error' }, '应用库为空或无法读取。'),
					E('p', { class: 'am-muted' }, '请检查 /usr/share/appmanager/apps.tsv 是否存在且至少包含一个应用。')
				])
			]);
		}

		this.status = st;
		this.apps = apps.map(function(a) {
			return { id: a.id, name: a.name, targets: a.targets || [], note: a.note || '', custom: !!a.custom };
		});
		this.state = {
			enabled: st.enabled === '1',
			runtime: st.runtime || DEFAULT_RUNTIME,
			custom: st.custom || DEFAULT_CUSTOM,
			enforce: st.enforce_china_ip !== '0',
			lastApply: st.last_apply || '',
			devices: (st.devices || []).map(function(d) {
				return { ip: d.ip || '', name: d.name || '', apps: (d.apps || []).slice() };
			})
		};

		this.statusBox = E('div', { class: 'am-card am-status-card' });
		this.devicesBox = E('div', {});
		this.customListBox = E('div', { class: 'am-custom-list' });

		var refreshBtn = E('button', {
			'class': 'btn cbi-button',
			'click': function(ev) { ev.preventDefault(); self.handleRefresh(); }
		}, '刷新状态');

		var saveBtn = E('button', {
			'class': 'btn cbi-button cbi-button-apply am-save-btn',
			'click': function(ev) { self.handleApply(ev); }
		}, '保存并生效');

		var addDeviceBtn = E('button', {
			'class': 'btn cbi-button cbi-button-add',
			'click': function(ev) { ev.preventDefault(); self.addDevice(); }
		}, '＋ 添加设备');

		var addAppBtn = E('button', {
			'class': 'btn cbi-button',
			'click': function(ev) { ev.preventDefault(); self.addCustomApp(); }
		}, '＋ 自定义应用');

		var onRuntime = function(ev) { self.state.runtime = ev.target.value.trim(); };
		var onCustom = function(ev) { self.state.custom = ev.target.value.trim(); };

		var runtimeInput = E('input', {
			'type': 'text',
			'class': 'cbi-input-text',
			'value': this.state.runtime,
			'input': onRuntime,
			'change': onRuntime
		});

		var customInput = E('input', {
			'type': 'text',
			'class': 'cbi-input-text',
			'value': this.state.custom,
			'input': onCustom,
			'change': onCustom
		});

		var enforceInput = E('input', {
			'type': 'checkbox',
			'checked': this.state.enforce,
			'change': function(ev) { self.state.enforce = ev.target.checked; }
		});

		var previewBtn = E('button', {
			'class': 'btn cbi-button',
			'click': function(ev) { ev.preventDefault(); self.handlePreview(); }
		}, '预览将写入的规则');

		var doctorBtn = E('button', {
			'class': 'btn cbi-button',
			'click': function(ev) { ev.preventDefault(); self.handleDoctor(); }
		}, '环境检查');

		var resetBtn = E('button', {
			'class': 'btn cbi-button',
			'click': function(ev) {
				ev.preventDefault();
				self.state.runtime = DEFAULT_RUNTIME;
				self.state.custom = DEFAULT_CUSTOM;
				runtimeInput.value = DEFAULT_RUNTIME;
				customInput.value = DEFAULT_CUSTOM;
			}
		}, '恢复默认路径');

		this.root = E('div', { class: 'am-page' }, [
			E('style', [ CSS ]),
			E('div', { class: 'am-hero' }, [
				E('div', {}, [
					E('h2', { class: 'am-title' }, '应用管理'),
					E('p', { class: 'am-sub' }, '按设备 + 按应用，把 AND(源 IP, 目标应用) 规则写到 OpenClash 最顶部；规则在 = 封禁，规则注释 = 放行。')
				]),
				E('div', { class: 'am-hero-actions' }, [ refreshBtn, saveBtn ])
			]),
			this.statusBox,
			E('div', { class: 'am-section-head' }, [
				E('div', {}, [
					E('h3', {}, '设备与应用'),
					E('p', { class: 'am-muted' }, '每台设备单独勾选；同一应用在多台设备上会被合并成一条规则。设备 IP 需固定（DHCP 静态租约）。')
				]),
				E('div', { class: 'am-toolbar' }, [ addDeviceBtn, addAppBtn ])
			]),
			this.devicesBox,
			E('details', { class: 'am-advanced' }, [
				E('summary', {}, '高级设置与诊断'),
				E('div', { class: 'am-adv-body' }, [
					E('div', { class: 'am-adv-grid' }, [
						E('div', { class: 'am-field' }, [
							E('label', {}, 'OpenClash 运行配置'),
							runtimeInput,
							E('p', { class: 'am-muted' }, '默认 /etc/openclash/次元.yaml；必须存在且包含 rules: 段。')
						]),
						E('div', { class: 'am-field' }, [
							E('label', {}, '自定义规则文件'),
							customInput,
							E('p', { class: 'am-muted' }, '默认 /etc/openclash/custom/openclash_custom_rules.list；重建配置后靠它恢复。')
						])
					]),
					E('label', { class: 'am-check-line' }, [
						enforceInput,
						E('span', {}, '关闭 OpenClash 的“绕过中国大陆 IP”（china_ip_route=0）。不关闭时，国内 App 流量在 nft 层就被放行，域名规则不会生效。')
					]),
					E('div', { class: 'am-toolbar' }, [ previewBtn, doctorBtn, resetBtn ]),
					E('div', { class: 'am-section-head', style: 'margin-top:16px' }, [
						E('div', {}, [
							E('h3', {}, '自定义应用'),
							E('p', { class: 'am-muted' }, '用于游戏或未内置的 App。域名一行一个；游戏服务器可用 ip:1.2.3.0/24。')
						])
					]),
					this.customListBox,
					E('p', { class: 'am-muted' }, '每次保存前自动备份到 /etc/appmanager/backup/，保留最近 20 份。')
				])
			]),
			E('p', { class: 'am-footer-note' }, '保存后会重启 OpenClash（约 30–60 秒，期间短暂断网）。规则块由页面托管，请勿手工改 marker 内的内容。')
		]);

		this.renderStatus();
		this.renderDevices();
		this.renderCustomApps();
		if (st.restarting === '1')
			this.startPoll();
		return this.root;
	},

	computeRuleCount: function() {
		var active = {};
		(this.state.devices || []).forEach(function(d) {
			(d.apps || []).forEach(function(id) { active[id] = true; });
		});
		return Object.keys(active).length;
	},

	buildStatus: function() {
		var self = this;
		var st = this.status || {};
		var count = this.computeRuleCount();
		var enabled = this.state.enabled;
		var oc = st.openclash === '1';
		var cn = st.china_ip_route === '0';
		var warnings = [];
		var seen = {};

		function addWarning(text, bad) {
			if (!text || seen[text]) return;
			seen[text] = true;
			warnings.push({ text: text, bad: !!bad });
		}

		(st.warnings || []).forEach(function(w) { addWarning(w, /失效|未运行|不存在|失败/.test(w)); });
		if (enabled && !this.state.devices.length)
			addWarning('已开启管控，但还没有添加设备。', true);
		if (enabled && count === 0)
			addWarning('已开启管控，但还没有勾选任何应用。', true);
		if (st.runtime_exists === '0')
			addWarning('运行配置不存在，保存会失败：' + this.state.runtime, true);
		if (st.china_ip_route === '1')
			addWarning('“绕过中国大陆 IP”仍开启，国内 App 不会进入内核；保存时会尝试自动改为 0。', true);
		if (st.custom_rules_enabled === '0')
			addWarning('OpenClash 自定义规则总开关未开启；保存时会尝试自动打开。', true);
		if (enabled && st.rules && st.active_rules && st.rules !== st.active_rules)
			addWarning('生效规则数与写入数不一致，可能有规则被手动注释。', false);

		var warningNodes = warnings.map(function(w) {
			return E('div', { class: 'am-warning' + (w.bad ? ' bad' : '') }, w.text);
		});

		return E('div', {}, [
			E('div', { class: 'am-status-top' }, [
				E('div', { class: 'am-switch-row' }, [
					E('label', { class: 'am-switch' }, [
						E('input', {
							'type': 'checkbox',
							'checked': enabled,
							'change': function(ev) {
								self.state.enabled = ev.target.checked;
								self.renderStatus();
							}
						}),
						E('span', { class: 'am-slider' })
					]),
					E('div', { class: 'am-switch-text' }, [
						E('strong', {}, enabled ? '管控已开启' : '管控已关闭'),
						E('span', { class: 'am-muted' }, enabled ? '命中规则的连接会被 REJECT；未勾选的应用不受影响。' : '规则仍保留在配置里，但全部被注释，等同放行。')
					])
				]),
				E('div', { class: 'am-stats' }, [
					stat('封禁规则', enabled ? count + ' 条' : '0 条', enabled ? 'am-ok' : ''),
					stat('OpenClash', oc ? '运行中' : '未运行', oc ? 'am-ok' : 'am-bad'),
					stat('国内流量', cn ? '进入内核' : '绕过内核', cn ? 'am-ok' : 'am-bad')
				])
			]),
			warningNodes.length ? E('div', { class: 'am-warnings' }, warningNodes) : null,
			E('p', { class: 'am-muted', style: 'margin-top:10px' },
				((st.last_apply || this.state.lastApply) ? '上次应用：' + (st.last_apply || this.state.lastApply) + '。' : '尚未应用过。') +
				' 当前状态：' + (enabled ? '开' : '关') + '，实际写入 ' + (st.rules || '0') + ' 条，未注释 ' + (st.active_rules || '0') + ' 条。')
		]);
	},

	renderStatus: function() {
		if (!this.statusBox) return;
		while (this.statusBox.firstChild)
			this.statusBox.removeChild(this.statusBox.firstChild);
		this.statusBox.appendChild(this.buildStatus());
	},

	buildDeviceCard: function(dev, idx) {
		var self = this;
		var countEl = E('span', { class: 'am-device-count' }, (dev.apps || []).length + ' 个应用');

		function refreshCount() {
			countEl.textContent = (dev.apps || []).length + ' 个应用';
			self.renderStatus();
		}

		var onName = function(ev) { dev.name = ev.target.value; };
		var onIp = function(ev) { dev.ip = ev.target.value.trim(); };

		var nameInput = E('input', {
			'type': 'text',
			'class': 'cbi-input-text am-name-input',
			'value': dev.name || '',
			'placeholder': '设备名称（可选）',
			'autocomplete': 'off',
			'input': onName,
			'change': onName
		});

		var ipInput = E('input', {
			'type': 'text',
			'class': 'cbi-input-text am-ip-input',
			'value': dev.ip || '',
			'placeholder': '10.10.10.27',
			'autocomplete': 'off',
			'spellcheck': 'false',
			'input': onIp,
			'change': onIp
		});

		var chips = this.apps.map(function(app) {
			var meta = appMeta(app);
			var selected = (dev.apps || []).indexOf(app.id) >= 0;
			var label = E('label', {
				'class': 'am-app-chip' + (selected ? ' selected' : ''),
				'title': app.name + ' · ' + app.targets.length + ' 个目标' + (app.note ? ' · ' + app.note : ''),
				'style': '--am-app-color:' + meta.color
			}, [
				E('input', {
					'type': 'checkbox',
					'checked': selected,
					'change': function(ev) {
						var on = ev.target.checked;
						if (on) {
							if (dev.apps.indexOf(app.id) < 0) dev.apps.push(app.id);
						}
						else {
							dev.apps = dev.apps.filter(function(id) { return id !== app.id; });
						}
						if (label.classList)
							label.classList.toggle('selected', on);
						refreshCount();
					}
				}),
				E('span', { class: 'am-app-icon' }, meta.short),
				E('span', { class: 'am-app-name' }, app.name),
				E('span', { class: 'am-app-tick' }, '✓')
			]);
			return label;
		});

		return E('div', { class: 'am-card am-device' }, [
			E('div', { class: 'am-device-head' }, [
				E('div', { class: 'am-device-num' }, String(idx + 1)),
				nameInput,
				E('div', { class: 'am-ip-field' }, [
					E('span', {}, 'IP'),
					ipInput
				]),
				countEl,
				E('button', {
					'class': 'btn cbi-button cbi-button-remove am-del-device',
					'click': function(ev) {
						ev.preventDefault();
						if (!confirm('删除设备“' + (dev.name || dev.ip || ('#' + (idx + 1))) + '”？保存后生效。'))
							return;
						self.state.devices.splice(idx, 1);
						self.renderDevices();
						self.renderStatus();
					}
				}, '删除')
			]),
			E('div', { class: 'am-app-grid' }, chips),
			E('div', { class: 'am-device-actions' }, [
				E('button', {
					'class': 'btn cbi-button',
					'click': function(ev) {
						ev.preventDefault();
						dev.apps = self.apps.map(function(a) { return a.id; });
						self.renderDevices();
						self.renderStatus();
					}
				}, '全选'),
				E('button', {
					'class': 'btn cbi-button',
					'click': function(ev) {
						ev.preventDefault();
						dev.apps = [];
						self.renderDevices();
						self.renderStatus();
					}
				}, '清空'),
				E('span', { class: 'am-muted' }, 'IP 或 CIDR，例如 10.10.10.27 或 10.10.10.0/24')
			])
		]);
	},

	renderDevices: function() {
		if (!this.devicesBox) return;
		while (this.devicesBox.firstChild)
			this.devicesBox.removeChild(this.devicesBox.firstChild);

		if (!this.state.devices.length) {
			var self = this;
			this.devicesBox.appendChild(E('div', { class: 'am-card am-empty' }, [
				E('p', {}, '还没有设备。添加一台设备，填写它在局域网里的固定 IP，再勾选要封禁的应用。'),
				E('button', {
					'class': 'btn cbi-button cbi-button-add',
					'click': function(ev) { ev.preventDefault(); self.addDevice(); }
				}, '＋ 添加第一台设备')
			]));
			return;
		}

		for (var i = 0; i < this.state.devices.length; i++)
			this.devicesBox.appendChild(this.buildDeviceCard(this.state.devices[i], i));
	},

	renderCustomApps: function() {
		if (!this.customListBox) return;
		while (this.customListBox.firstChild)
			this.customListBox.removeChild(this.customListBox.firstChild);

		var self = this;
		var custom = this.apps.filter(function(a) { return a.custom; });
		if (!custom.length) {
			this.customListBox.appendChild(E('p', { class: 'am-muted' }, '还没有自定义应用。'));
			return;
		}
		custom.forEach(function(app) {
			self.customListBox.appendChild(E('div', { class: 'am-custom-row' }, [
				E('span', { class: 'am-grow' }, app.name + ' · ' + app.targets.length + ' 个目标'),
				E('span', { class: 'am-muted' }, app.targets.slice(0, 2).join(', ') + (app.targets.length > 2 ? ' …' : '')),
				E('button', {
					'class': 'btn cbi-button cbi-button-remove',
					'click': function(ev) {
						ev.preventDefault();
						self.removeCustomApp(app.id);
					}
				}, '删除')
			]));
		});
	},

	addDevice: function() {
		this.state.devices.push({ ip: '', name: '', apps: [] });
		this.renderDevices();
		this.renderStatus();
		var inputs = this.devicesBox.querySelectorAll('.am-ip-input');
		if (inputs.length)
			inputs[inputs.length - 1].focus();
	},

	addCustomApp: function() {
		var self = this;
		var nameInput = E('input', {
			'type': 'text',
			'class': 'cbi-input-text',
			'placeholder': '例如：王者荣耀'
		});
		var targetInput = E('textarea', {
			'class': 'cbi-input-textarea',
			'placeholder': 'game.example.com\ngame2.example.com\nip:1.2.3.0/24'
		});
		var err = E('p', { class: 'am-error' });

		function submit() {
			var name = String(nameInput.value || '').replace(/\|/g, '').trim();
			var targets = splitTargets(targetInput.value);
			if (!name) {
				err.textContent = '请填写应用名称。';
				return;
			}
			if (name.length > 20) {
				err.textContent = '应用名称最多 20 个字符。';
				return;
			}
			if (!targets.length) {
				err.textContent = '至少填写一个有效域名，或 ip:1.2.3.0/24。';
				return;
			}
			if (targets.length > 20) {
				err.textContent = '一个自定义应用最多 20 个目标。';
				return;
			}
			var id = 'custom_' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
			self.apps.push({ id: id, name: name, targets: targets, note: '自定义应用', custom: true });
			ui.hideModal();
			self.renderDevices();
			self.renderCustomApps();
			self.renderStatus();
		}

		ui.showModal('添加自定义应用', [
			E('div', { class: 'am-form' }, [
				E('div', { class: 'am-field' }, [
					E('label', {}, '应用名称'),
					nameInput
				]),
				E('div', { class: 'am-field' }, [
					E('label', {}, '域名 / IP 目标'),
					targetInput,
					E('p', { class: 'am-muted' }, '一行一个，或用逗号分隔。域名不带 https:// 和路径；游戏服务器可写 ip:1.2.3.0/24。微信/QQ 核心域名会被拒绝。')
				]),
				err
			]),
			E('div', { class: 'right' }, [
				E('button', { class: 'btn', 'click': function(ev) { ev.preventDefault(); ui.hideModal(); } }, '取消'),
				E('button', { class: 'btn cbi-button cbi-button-positive', 'click': function(ev) { ev.preventDefault(); submit(); } }, '添加')
			])
		]);
	},

	removeCustomApp: function(id) {
		var app = this.apps.filter(function(a) { return a.id === id; })[0];
		if (!app) return;
		if (!confirm('删除自定义应用“' + app.name + '”？所有设备上的勾选也会移除，保存后生效。'))
			return;
		this.apps = this.apps.filter(function(a) { return a.id !== id; });
		this.state.devices.forEach(function(d) {
			d.apps = (d.apps || []).filter(function(a) { return a !== id; });
		});
		this.renderDevices();
		this.renderCustomApps();
		this.renderStatus();
	},

	validateState: function() {
		var seen = {};
		for (var i = 0; i < this.state.devices.length; i++) {
			var d = this.state.devices[i];
			var ip = String(d.ip || '').trim();
			if (!isValidCidr(ip))
				return '第 ' + (i + 1) + ' 台设备的 IP 不正确：' + (ip || '空') + '。请填 10.10.10.27 或 10.10.10.0/24。';
			if (seen[ip])
				return '设备 IP 重复：' + ip + '。';
			seen[ip] = true;
		}
		if (this.state.enabled && !this.state.devices.length)
			return '已开启管控，但还没有设备。请先添加设备，或关闭管控开关。';
		if (this.state.enabled && this.computeRuleCount() === 0)
			return '已开启管控，但没有勾选任何应用。请至少勾选一个应用，或关闭管控开关。';
		if (!/^\/etc\/openclash\//.test(this.state.runtime) || this.state.runtime.indexOf('..') >= 0)
			return '运行配置路径必须在 /etc/openclash/ 下，且不能包含 ..。';
		if (!/^\/etc\/openclash\//.test(this.state.custom) || this.state.custom.indexOf('..') >= 0)
			return '自定义规则路径必须在 /etc/openclash/ 下，且不能包含 ..。';
		return null;
	},

	buildSpec: function() {
		var lines = [
			'enabled ' + (this.state.enabled ? '1' : '0'),
			'runtime ' + this.state.runtime,
			'custom ' + this.state.custom,
			'enforce_china_ip ' + (this.state.enforce ? '1' : '0')
		];
		this.state.devices.forEach(function(d, i) {
			var name = String(d.name || '').replace(/\|/g, '').replace(/[\r\n]/g, ' ').trim();
			if (!name) name = '设备 ' + (i + 1);
			d.name = name;
			lines.push('device ' + String(d.ip || '').trim() + '|' + name + '|' + (d.apps || []).join(','));
		});
		this.apps.filter(function(a) { return a.custom; }).forEach(function(a) {
			lines.push('app ' + a.id + '|' + String(a.name || '').replace(/\|/g, '') + '|' + a.targets.join(','));
		});
		return lines.join('\n');
	},

	handleRefresh: function() {
		var self = this;
		fs.exec('/usr/sbin/appmanager', [ 'status' ]).then(function(res) {
			if (failed(res)) {
				ui.addNotification('刷新失败', E('p', {}, execError(res)), 'danger');
				return;
			}
			self.status = parseStatus(res.stdout);
			if (self.status.enabled === '0' || self.status.enabled === '1')
				self.state.enabled = self.status.enabled === '1';
			if (self.status.runtime) self.state.runtime = self.status.runtime;
			if (self.status.custom) self.state.custom = self.status.custom;
			if (self.status.enforce_china_ip === '0' || self.status.enforce_china_ip === '1')
				self.state.enforce = self.status.enforce_china_ip === '1';
			self.renderStatus();
		}).catch(function(err) {
			ui.addNotification('刷新失败', E('p', {}, String(err && err.message ? err.message : err)), 'danger');
		});
	},

	handleApply: function(ev) {
		var self = this;
		if (ev && ev.preventDefault) ev.preventDefault();
		var err = this.validateState();
		if (err) {
			ui.addNotification('无法保存', E('p', {}, err), 'danger');
			return;
		}
		var btn = ev && ev.currentTarget ? ev.currentTarget : null;
		var oldText = btn ? btn.textContent : '';
		if (btn) {
			btn.disabled = true;
			btn.textContent = '正在写入…';
		}
		fs.exec('/usr/sbin/appmanager', [ 'apply', this.buildSpec() ]).then(function(res) {
			if (failed(res))
				throw new Error(execError(res));
			self.status = self.status || {};
			var autoRestart = !/未能自动重启/.test(res.stdout || '');
			self.status.restarting = autoRestart ? '1' : '0';
			self.status.warnings = [];
			self.renderStatus();
			if (autoRestart) self.startPoll();
			var note = autoRestart
				? '正在重启 OpenClash，约 30–60 秒。期间页面可以保持打开，状态会自动刷新。'
				: '规则已写入，但未能自动重启 OpenClash。请手动执行 /etc/init.d/openclash restart。';
			ui.addNotification('规则已写入', E('p', {}, note), 'success');
		}).catch(function(e) {
			ui.addNotification('保存失败', E('p', {}, String(e && e.message ? e.message : e)), 'danger');
		}).then(function() {
			if (btn) {
				btn.disabled = false;
				btn.textContent = oldText;
			}
		});
	},

	handlePreview: function() {
		var err = this.validateState();
		if (err) {
			ui.addNotification('无法预览', E('p', {}, err), 'danger');
			return;
		}
		fs.exec('/usr/sbin/appmanager', [ 'preview', this.buildSpec() ]).then(function(res) {
			if (failed(res)) {
				ui.showModal('规则预览失败', [
					E('pre', { class: 'am-pre' }, execError(res)),
					E('div', { class: 'right' }, [
						E('button', { class: 'btn', 'click': function(ev) { ev.preventDefault(); ui.hideModal(); } }, '关闭')
					])
				]);
				return;
			}
			ui.showModal('规则预览', [
				E('p', { class: 'am-muted' }, '以下内容会同时写入自定义规则文件和运行配置的 rules: 顶部。'),
				E('pre', { class: 'am-pre' }, res.stdout || ''),
				E('div', { class: 'right' }, [
					E('button', { class: 'btn', 'click': function(ev) { ev.preventDefault(); ui.hideModal(); } }, '关闭')
				])
			]);
		}).catch(function(e) {
			ui.addNotification('预览失败', E('p', {}, String(e && e.message ? e.message : e)), 'danger');
		});
	},

	handleDoctor: function() {
		fs.exec('/usr/sbin/appmanager', [ 'doctor' ]).then(function(res) {
			ui.showModal('环境检查', [
				E('pre', { class: 'am-pre' }, (res.stdout || '') + (res.stderr ? '\n' + res.stderr : '')),
				E('div', { class: 'right' }, [
					E('button', { class: 'btn', 'click': function(ev) { ev.preventDefault(); ui.hideModal(); } }, '关闭')
				])
			]);
		}).catch(function(e) {
			ui.addNotification('检查失败', E('p', {}, String(e && e.message ? e.message : e)), 'danger');
		});
	},

	startPoll: function() {
		var self = this;
		var tries = 0;
		this.stopPoll();
		this.pollTimer = setInterval(function() {
			tries++;
			fs.exec('/usr/sbin/appmanager', [ 'status' ]).then(function(res) {
				if (failed(res)) return;
				self.status = parseStatus(res.stdout);
				self.renderStatus();
				if (tries >= 45 || (self.status.restarting !== '1' && self.status.openclash === '1'))
					self.stopPoll();
			}).catch(function() {
				if (tries >= 10) self.stopPoll();
			});
		}, 2000);
	},

	stopPoll: function() {
		if (this.pollTimer) {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
		}
	},

	handleSave: function() { return this.handleApply(); },
	handleSaveApply: function() { return this.handleApply(); }
});
