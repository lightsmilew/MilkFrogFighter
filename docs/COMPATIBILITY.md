# 全屏兼容说明

调查与实现日期：2026-10-20。

## 原因

iPhone Safari 对任意 HTML 元素的 Fullscreen API 支持存在限制，不能将视频专用的 `webkitEnterFullscreen()` 用在 Canvas 游戏上。WebKit 的 [iOS Fullscreen API 跟踪记录](https://bugs.webkit.org/show_bug.cgi?id=206854) 仍记录该支持问题；[视频专用前缀接口的旧问题](https://bugs.webkit.org/show_bug.cgi?id=212934) 已合并到前者。MDN 将 [`requestFullscreen()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen) 标为有限可用，并说明请求可能失败。

这不是“所有苹果设备都不能全屏”：macOS、iPadOS、iPhone，以及不同浏览器外壳，实际暴露的能力不同。夸克等浏览器是否提供对应接口以运行时检测为准。旧页面只调用标准接口，失败后显示提示，没有可用的回退布局。

## 修复

`src/fullscreen.js` 优先调用标准 `requestFullscreen`，兼容 `webkitRequestFullscreen`；接口缺失、请求拒绝或没有进入原生全屏时，使用固定定位的沉浸模式。

- 通过 `visualViewport` 的尺寸和偏移适配浏览器工具栏变化与横竖屏。
- 留出刘海、圆角和底部手势安全区域。
- 锁定背景滚动，退出时恢复原位置；保留暂停和退出全屏按钮。
- HUD、摇杆和触屏攻击均保留；全屏时隐藏选图与模式切换，顶部保留紧凑的暂停、退出全屏和对手脾气工具栏。暂停对话框按游戏容器尺寸收紧，暂停时隐藏触屏操作以便阅读。
- 原生全屏与沉浸模式共用布局，避免仅兼容 `:fullscreen` 选择器。
- 添加 Apple 独立网页模式元信息，方便用户从主屏幕进入。

沉浸模式占满浏览器提供的可见窗口，网页不能强制隐藏系统地址栏或导航工具栏。不要依赖伪造视频全屏、强制旋转或要求用户开启实验性功能。

## 验证范围

本机 Edge 真实验证原生全屏；分别模拟接口不存在和 Promise 拒绝，验证沉浸回退、窗口尺寸及退出。触屏横屏也验证了无 Fullscreen API 的回退路径。未使用 iPhone 真机、Safari 或夸克真机运行，不能将这部分模拟验证表述为真机认证。
