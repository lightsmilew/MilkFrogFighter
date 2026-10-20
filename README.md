# 奶蛙街头 · MILKFROG FIGHT CLUB

经典奶蛙表情包的横版街机格斗小游戏。奶油色小报页面、午后老街擂台、平视对手的圆眼奶蛙。纯 HTML / CSS / JavaScript / Canvas，运行时没有框架、CDN 或后端依赖，可以部署在 GitHub Pages 的仓库子路径。

## 立即运行

安装 Node.js 20 或更新版本后，在项目目录运行：

```sh
npm run dev
```

打开 `http://localhost:4173`。无需 `npm install`。页面使用 ES modules，请通过本地 HTTP 服务打开。

## 已实现

- 人机对战：三档难度，三局两胜，每局 60 秒。
- 同屏双人：两套键盘按键，也支持两只标准手柄。
- 自由练习：无限奶气、无限时间、连招后自动回血，可切换格挡木桩。
- 四位选手：奶蛙（均衡 / 奶气波）、奶绿（速度 / 疾风突进）、奶红（重击 / 红温震地）、奶紫（控场 / 紫气减速）。
- 直拳、踢腿、下蹲、跳跃、空中攻击、正面防御、后退防御、确认命中后的招式取消、技能与必杀、气功相消、命中停顿、击退与回合结算。
- 动态光效：挥拳拖光、踢腿弧光、命中星芒、冲击环、技能尾焰、地面震波、蓄力光晕及必杀闪光。
- 声音：打击、格挡、起跳、落地、技能、必杀及原创街机背景乐；大笑使用随项目保存的**网络经典录音**，没有用合成笑声替代。
- 手机虚拟摇杆：拖动移动、上推跳跃、下拉蹲下、斜向跳跃；死区、限位、松手归中，支持摇杆与攻击按钮的双指操作。横屏会进入紧凑擂台布局。
- 暂停、窗口失焦自动暂停、全屏、音量 / 背景乐 / 震屏 / 扫描线 / 触屏设置，以及本地人机战绩。

## 操作

| 动作 | P1 | P2 |
| --- | --- | --- |
| 左 / 右 | A / D | ← / → |
| 跳跃 / 下蹲 | W / S | ↑ / ↓ |
| 直拳 / 踢腿 | J / K | 1 / 2 |
| 专属技能 / 满格必杀 | L / I | 3 / 4 |
| 防御 | 空格，或后退 | 右 Shift，或后退 |
| 捧腹大笑 | H | 5，或 B |
| 暂停 / 继续 | Esc / P | Esc / P |

P2 兼容数字小键盘，也支持 `N / M / , / .` 对应四种攻击。标准手柄用摇杆 / 方向键移动，上推跳跃，A/B/X/Y 出招，肩键防御。

技能消耗 25 奶气，必杀消耗 100。命中、防御、受击与时间推进都会积攒奶气。拳命中后可接脚，脚命中后接技能，技能命中后接必杀。高位直拳可以下蹲躲避；跳跃可避开地面气功。防御会承受少量削血。

## GitHub Pages 部署

### 使用自带 GitHub Actions（推荐）

1. 将此项目的源文件提交到 GitHub 仓库的 `main` 或 `master` 分支，包括 `.github/workflows/pages.yml` 与 `assets/`。
2. 打开仓库 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**。
3. 推送代码或手动运行 **Test and deploy the arcade**。流程会执行战斗测试、生成 `dist/`，然后发布。
4. 在部署任务的 `github-pages` 环境中打开站点链接。

配置依据：[GitHub 官方 Pages 发布说明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。所有游戏资源使用相对路径，兼容 `https://用户名.github.io/仓库名/`。

### 手动上传静态成品

```sh
npm run build
```

把 `dist/` **里面的内容**上传到发布分支根目录，并在 Pages 中选择 **Deploy from a branch → 对应分支 → /(root)**。也可解压交付的 `releases/milkfrog-pages.zip` 后上传。无需安装构建依赖，也无需 API Key。

当前工作区没有配置 GitHub 远端，因此没有替你创建或发布远程仓库；源文件、工作流和可部署静态包已经准备好。

## 验证

```sh
npm test
npm run build
```

`tests/combat.test.mjs` 覆盖命中距离、单次伤害、格挡、蹲防、重力、能量、气功相消、减速、连招、命中停顿的输入缓存、场地边界、练习、回合胜负、完整比赛和持续 AI 对战。

可选浏览器检查 `npm run test:browser` 需要 Playwright。可以设置 `PLAYWRIGHT_MODULE` 为已有的 Playwright ESM 模块 URL，并设置 `BROWSER_EXECUTABLE` 使用已有浏览器；`TEST_URL` 可指向仓库子路径。该检查实际验证键盘双人、暂停 / 恢复、设置保存、经典录音解码、手机摇杆、双指攻击、横屏与全屏，并输出 `artifacts/browser-report.json` 和截图。

## 文件结构

```text
index.html                 页面、选蛙、弹窗与触屏面板
style.css                  小报 / 老街街机风格、横屏与移动布局
src/config.js              角色、招式、物理参数、按键
src/engine.js              独立的固定步长战斗模拟
src/input.js               键盘、双手柄、多指触屏、虚拟摇杆
src/renderer.js            场景、动画、皮肤、HUD 与光效
src/audio.js               Web Audio 音乐、音效、经典录音播放
src/app.js                 页面与战斗生命周期、设置与战绩
assets/                    随站点部署的图像、原声与源图
scripts/                   开发服务器、静态打包
tests/                     战斗规则与浏览器检查
docs/                      架构、美术提示词、素材来源与参考
.github/workflows/         测试和 GitHub Pages 发布
```

美术原始 PNG、最终 WebP 和完整生成提示词见 [美术说明](docs/art-direction.md)；经典形象与原声出处见 [素材来源](docs/ASSETS.md)。
