# 素材来源与处理记录

## 角色

- 最终形象基准：用户在聊天中提供的经典奶蛙照片，保存在 `docs/references/character-reference.jpg`。
- 早期网络形象参考：[奶-hub](https://nai-hub.com/)，[大笑 GIF](https://nai-hub.com/assets/placeholders/naiwa_laugh.gif)，保存为 `docs/references/online-laugh.gif`。
- 用户纠正后的造型要求：宽圆的头与身体自然连成一体，黄色皮肤、奶白大肚皮、灰褐手脚；浅绿圆眼与头身协调。最终追加要求为平视对手，不能低头盯地面。
- 游戏图集由内置 imagegen 工具依据参考生成，并整体修正头部与视线。没有将普通绿色青蛙或 Pepe 当作奶蛙。
- 补充八个姿态：深蹲、蹲拳、扫腿、升龙、飞踢、抱摔准备、旋风腿与疾跑。原图保存于 `art/source/milkfrog-advanced.png`，沿用基础角色作为生成参考；最终已合并进每位角色的 `assets/fighters/` 图集，独立的旧 WebP 已删除。
- 图集读取改为先扩大取样范围，再提取主要 alpha 连通轮廓；由代码恢复越界拳脚并隔离大笑旁的倒地脚，不重新绘制角色五官。
- 奶蛙 / 奶绿 / 奶红 / 奶紫 / 奶粉 / 奶蓝共享协调的基础身体，变体颜色在离线素材处理阶段按新生成的动作图统一重映射，眼睛与肚皮保留原色。

## 场景与光效

- 老街奶吧场景由内置 imagegen 工具生成；完整提示词在 `art-direction.md`。
- 扩展街区与雨天版本同样由内置 imagegen 制作；现使用 `art/source/milk-rooftops-tall.png`、`art/source/milk-rain-tall.png` 对应的高场景 WebP，旧矮场景原图及成品已删除。雨滴与涟漪实时绘制，未烘焙到背景中。
- 所有光效、HUD 和图标在项目中绘制，不加载第三方图标库。
- 仍用于离线处理的原始 PNG 保存于 `art/source/`，不进入发布包。运行使用编码为 WebP 的版本；WebP 编码仅压缩格式，没有程序化重画角色。

## 经典大笑原声

- 本地文件：`assets/audio/classic-laugh.mp3`。
- 直接来源：[whitefirer/dsh-niulai-pet — assets/nailong/nailong_laugh.mp3](https://github.com/whitefirer/dsh-niulai-pet/blob/master/assets/nailong/nailong_laugh.mp3)。
- 来源项目的 [README](https://github.com/whitefirer/dsh-niulai-pet#皮肤) 将其列为“原片大笑声（已降噪）”；其角色注册源码同样将该 MP3 绑定到大笑动画。
- 文件直接保存，未重新生成、变声或改编。播放端只控制音量与片段长度。胜利和 H 大笑动作调用短片段；顶部“笑一个”和设置中的试听可独立播放。
- 已在浏览器 Web Audio 实际解码：15.65 秒、单声道、48 kHz、751200 个采样点。
- SHA-256：`716c2d58d02c6543057a7adf6637b8224886f6f0d7c06ffa34bfdf18dde72c33`。

代码、生成场景、生成动作和引用的网络形象 / 原声来源分别记录；引用素材的权利归相应权利人，来源项目对粉丝二创素材也保留这一说明。

## 六流派新增素材与配色

使用内置 imagegen 生成 `art/source/milkfrog-styles.png`：六列对应六角色，四行对应独立的架势、轻击、重击和施法，共 24 个新姿态。提示词与输入参考见 [action-prompts.md](action-prompts.md)。最终运行文件为 `assets/fighters/{classic,green,red,purple,pink,blue}.webp`。基础动作按新图五档肤色明暗重映射，默认黄色角色也参与校准，保留绿眼、奶白肚皮与灰褐手脚；配色对照图可通过本地验证生成。加入步态、受击与起身并替换六个旧 / 闲置槽后，每位角色共 48 帧。

两张高场景保持原始尺寸，使用 WebP 压缩；选图使用独立缩略图。日常构建只从明确的运行清单生成带内容哈希的文件名，不处理 PNG。原图路径与离线流程见 [../art/README.md](../art/README.md)。

## 八帧步态与二维码

内置 imagegen 绘制八帧行走与六帧跑步，最终原图为 `art/source/milkfrog-walk.png`、`art/source/milkfrog-run.png`。离线裁切、对齐并按原有六套材质调色，与战斗动作合入每位角色唯一的一张 WebP。旧两张走路与一张疾跑图被替换；独立的六个 `*-walk.webp` 已删除，也不再输出独立 run 包。只有最终生成版本进入项目，原图不进入部署包；提示词与参考说明见 [walk-prompts.md](walk-prompts.md)、[run-prompts.md](run-prompts.md)。

二维码使用 [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 2.0.4 的官方 ESM 实现，源码在 `src/vendor/qrcode.js`，MIT 声明在 `licenses/qrcode-generator.txt`。二维码与邀请卡由 Canvas 离线生成，包含真实站点链接，不请求第三方二维码服务。编码模块仅打开分享面板时加载。测试使用独立解码器 jsQR 验证最终 PNG。

`assets/fighters/` 现在只有六张角色图集、`frames.js` 元数据和一张选角缩略图。缩略图用于未加载角色的主页展示，避免为显示全部卡片下载六份完整图集。构建会拒绝未登记的闲置文件。

## 专门受击与起身

内置 imagegen 绘制 `art/source/milkfrog-reactions.png`，包含 16 个姿态，完整提示词见 [reaction-prompts.md](reaction-prompts.md)。离线处理使用相同材质映射，保留绿眼、肚皮和灰褐手脚。三个闲置 / 旧受击槽被直接替换，只新增 13 个逻辑帧，六位角色仍各自只有一张图集；倒地姿态被滑倒末段和倒地状态共用，不重复存图。所有帧的非空矩形共用 768×1984 布局，192×192 为还原画布。

运行素材仍为 18 个在用文件，目前共 2489802 字节；六张角色动作图片合计 1628258 字节。相较此前 35 帧阶段的 2017536 字节，增加 472266 字节，用于新增受击姿态和相应元数据，没有独立 reaction 包、源 PNG 或重复旧受击图片进入发布包。九张制作原图只保存在 `art/source/`。
