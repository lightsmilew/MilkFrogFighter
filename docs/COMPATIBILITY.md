# 全屏与声音兼容说明

调查与实现日期：2026-10-20、2026-10-21（iPhone 与移动布局反馈修复）。

## 全屏：原因

iPhone Safari 不提供任意 HTML 元素的原生全屏：MDN 的浏览器兼容数据把 `Element.requestFullscreen()` 的 `safari_ios` 标为“仅 iPad 可用”，`webkitRequestFullscreen` 同样只在 iPad 上实现。视频专用的 `webkitEnterFullscreen()` 也不能用在 Canvas 游戏上。相关跟踪记录见 WebKit 的 [Fullscreen API 问题](https://bugs.webkit.org/show_bug.cgi?id=206854)，以及 MDN 的 [`requestFullscreen()` 兼容表](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen)。

第一轮已经加了固定定位的沉浸模式，但真机上仍有三个问题：

1. 个别 WebKit 外壳会暴露 `requestFullscreen` 却返回一个永不 settle 的 Promise，`await` 之后什么都没发生，按钮看起来完全失灵。
2. iPhone 旋转或地址栏伸缩时 `visualViewport` 会晚一拍更新，按事件当下的尺寸布局会把容器留在旧尺寸。
3. 旧布局将固定 16:9 画布以 contain 放入屏幕，宽屏两侧、竖屏上下会留空；全屏样式还被后面的规则覆盖，保留了一整行工具栏。

## 全屏：修复

`src/fullscreen.js`：

- 原生请求与 900 ms 超时竞速；接口缺失、被拒绝、抛错或悬挂都立刻进入沉浸模式，不再有“点了没反应”的状态。
- 沉浸模式在进入时以及每次 `resize` / `orientationchange` / `visualViewport` 变化后，按 0 / 80 / 240 / 520 ms 多次补测尺寸，覆盖 iPhone 旋转和地址栏伸缩的滞后。
- 同时锁定 `html` / `body` 滚动与回弹，退出时恢复原滚动位置和样式；竖屏时给容器加 `is-immersive-portrait`，供界面提示使用。
- 可用的设备上顺带尝试 `screen.orientation.lock('landscape')`；iOS 拒绝时静默忽略。

`src/app.js` / `index.html` / `style.css`：

- 沉浸模式下竖屏会显示“横屏开打，视野更宽”的提示，转到横屏自动消失。
- iPhone Safari 竖屏首次点全屏时显示一次性说明：Safari 无法隐藏地址栏，点“分享 → 添加到主屏幕”，从桌面图标打开才是真全屏；说明出现即写入本地存储（12 秒后自动收起，也可点“知道了”），横屏或再次进入不再打扰。
- 新增 `manifest.webmanifest`（`display: standalone`、主题色）与 180 / 192 / 512 图标；`apple-mobile-web-app-capable` 一并保留。从主屏幕启动时没有地址栏，`navigator.standalone` 为真，不再显示上述提示。
- 网页在标签页内仍然无法强制隐藏浏览器地址栏；这是浏览器限制，不是待修的 bug。
- 2026-10-21：改为随容器比例扩大镜头视野，场景铺满屏幕，角色不被横向拉伸；全屏收起模式、难度、底栏，只保留两个悬浮按钮。地图延伸到安全区，HUD 和触摸目标单独避让刘海。主屏幕 Web App 开打后自动进入铺满布局，返回选角恢复。
- 暂停、结算框均限制在可见游戏区域内；矮屏减小标题、统计和按钮间距，极矮屏隐藏辅助文案，按钮全部保留；暂停和结算隐藏触屏键，重新开局重置暂停状态。
- PC 与手机均采用双资源条：体力暖金 / 低血红，奶气青绿，当前值 / 100 在条中居中。摇杆底盘 alpha 为约 10%–25%，奶气条位于血条下方，不再放在操作区。
- 布局参考了 [Ubisoft 的《Brawlhalla》移动版发布说明](https://www.gamespress.com/en-US/FREE-TO-PLAY-BRAWLHALLA-NOW-AVAILABLE-ON-MOBILE)关于触屏战斗输入的做法，以及 [《怒之铁拳 4》移动版](https://apps.apple.com/us/app/streets-of-rage-4/id1601446687)的移动界面方向。本作具体弧形位置由六键和双拇指输入需要决定，并非照搬其它游戏参数。
- Safari 添加主屏幕的操作见 [Apple 使用指南](https://support.apple.com/guide/iphone/bookmark-a-website-iph42ab2f3a7/ios)：分享 → 添加到主屏幕；系统提供“作为 Web App 打开”选项时开启它。

## 声音：原因

iPhone 只在用户手势的调用栈内启动 Web Audio。旧代码在 `start()` 里先 `await` 角色图集，再调用 `audio.unlock()`，此时手势已经结束：`AudioContext` 以 `suspended` 出生，`resume()` 也不会被再次触发，于是整个街机没有任何声音（画面和操作都正常）。

此外还有两个会加重“没声音”的细节：

- 暂停 / 切后台后 WebKit 会挂起或中断 AudioContext，旧代码没有重试路径。
- iPhone 侧边静音开关可能让网页合成音无声（Web Audio 在部分 iOS 版本会跟随系统静音），网页无法绕过；只能提示玩家关掉静音开关。

## 声音：修复

`src/audio.js`：

- `unlock()` 改为同步创建 `AudioContext` 并立即 `resume()`，不再 `await` 任何资源；`onstatechange` 再驱动解码与音乐调度。
- `armGestureUnlock()` 在页面加载后监听 `pointerdown` / `touchend` / `mousedown` / `keydown` / `click`（捕获阶段、passive），第一个手势就创建并恢复上下文；成功后自动解绑，上下文被挂起时重新武装。
- `start()` 在任何 `await` 之前调用 `audio.unlock()`；开场音效通过 `whenRunning()` 等混音器真正可发音后再播。
- `setActive()` / `syncState()` 让背景乐只在上下文 `running` 时调度，切后台回来、恢复播放时自动接上；挂起期间不再堆积音效节点，避免恢复瞬间“炸”出一串声音。
- `playLaugh()` 等待上下文进入 `running`（最多 500 ms）并复用已解码的经典笑声缓冲。

界面：设置面板在 iOS 上显示静音开关提示；`docs/VERIFICATION.md` 记录了本轮实际测到的行为。

## 验证范围

- iPhone 尺寸（390×844 竖屏、844×390 横屏）与 iPhone Safari 无 Fullscreen API 的环境，在 Chromium 与 Playwright WebKit 中都实际进入沉浸模式、填满可见视口、旋转后重新铺满；竖屏提示与添加到主屏幕说明正常出现、关闭后持久化。
- 桌面 Edge 原生全屏仍可用，退出按钮与 Esc 行为不变；模拟 `requestFullscreen` 返回永不 resolve 的 Promise，900 ms 后仍会进入沉浸模式。
- 用包装过的 `AudioContext` 记录创建时刻：`navigator.userActivation.isActive` 为 `true`，即上下文确实在点按手势内创建；随后 `state === 'running'`、背景乐调度器启动，混音器输出端可测到非零波形。
- 未使用 iPhone 真机、Safari 真机或夸克真机运行，不能把上述模拟验证表述为真机认证。iPhone 侧边静音开关对 Web Audio 的影响属于系统行为，只能提示、无法在网页内规避。

## 分享

顶部分享由点击直接触发，优先使用 [Navigator.share](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share)，用户取消时结束操作。接口缺失或失败则尝试 [Clipboard.writeText](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText)，剪贴板不可用时显示可选中的链接。浏览器验证覆盖三条路径，未将模拟的系统分享认定为 iPhone 真机测试。
