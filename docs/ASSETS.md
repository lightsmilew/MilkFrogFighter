# 素材来源与处理记录

## 角色

- 最终形象基准：用户在聊天中提供的经典奶蛙照片，保存在 `docs/references/character-reference.jpg`。
- 早期网络形象参考：[奶-hub](https://nai-hub.com/)，[大笑 GIF](https://nai-hub.com/assets/placeholders/naiwa_laugh.gif)，保存为 `docs/references/online-laugh.gif`。
- 用户纠正后的造型要求：宽圆的头与身体自然连成一体，黄色皮肤、奶白大肚皮、灰褐手脚；浅绿圆眼与头身协调。最终追加要求为平视对手，不能低头盯地面。
- 游戏图集由内置 imagegen 工具依据参考生成，并整体修正头部与视线。没有将普通绿色青蛙或 Pepe 当作奶蛙。
- 本轮补充八个姿态：深蹲、蹲拳、扫腿、升龙、飞踢、抱摔准备、旋风腿与疾跑。原图保存于 `assets/source/milkfrog-advanced.png`，WebP 保存于 `assets/milkfrog-advanced.webp`，沿用基础角色作为生成参考。
- 图集读取改为先扩大取样范围，再提取主要 alpha 连通轮廓；由代码恢复越界拳脚并隔离大笑旁的倒地脚，不重新绘制角色五官。
- 奶蛙 / 奶绿 / 奶红 / 奶紫 / 奶粉 / 奶蓝共享协调的基础身体，变体颜色在离线素材处理阶段按新生成的动作图统一重映射，眼睛与肚皮保留原色。

## 场景与光效

- 老街奶吧场景由内置 imagegen 工具生成；完整提示词在 `art-direction.md`。
- 扩展街区与雨天版本同样由内置 imagegen 制作：`assets/source/milk-rooftops.png`、`assets/source/milk-rain.png`；运行资源为同名 WebP。雨滴与涟漪实时绘制，未烘焙到背景中。
- 所有光效、HUD 和图标在项目中绘制，不加载第三方图标库。
- 原始 PNG 保存于 `assets/source/`，运行使用编码为 WebP 的版本。WebP 编码仅压缩格式，没有程序化重画角色。

## 经典大笑原声

- 本地文件：`assets/audio/classic-laugh.mp3`。
- 直接来源：[whitefirer/dsh-niulai-pet — assets/nailong/nailong_laugh.mp3](https://github.com/whitefirer/dsh-niulai-pet/blob/master/assets/nailong/nailong_laugh.mp3)。
- 来源项目的 [README](https://github.com/whitefirer/dsh-niulai-pet#皮肤) 将其列为“原片大笑声（已降噪）”；其角色注册源码同样将该 MP3 绑定到大笑动画。
- 文件直接保存，未重新生成、变声或改编。播放端只控制音量与片段长度。胜利和 H 大笑动作调用短片段；顶部“笑一个”和设置中的试听可独立播放。
- 已在浏览器 Web Audio 实际解码：15.65 秒、单声道、48 kHz、751200 个采样点。
- SHA-256：`716c2d58d02c6543057a7adf6637b8224886f6f0d7c06ffa34bfdf18dde72c33`。

代码、生成场景、生成动作和引用的网络形象 / 原声来源分别记录；引用素材的权利归相应权利人，来源项目对粉丝二创素材也保留这一说明。

## 六流派新增素材与配色

使用内置 imagegen 生成 `assets/source/milkfrog-styles.png`：六列对应六角色，四行对应独立的架势、轻击、重击和施法，共 24 个新姿态。提示词与输入参考见 [action-prompts.md](action-prompts.md)。最终运行文件为 `assets/fighters/{classic,green,red,purple,pink,blue}.webp`，每位角色 24 帧。旧二十姿态按新图五档肤色明暗重映射，默认黄色角色也参与校准，保留绿眼、奶白肚皮与灰褐手脚；配色对照图可通过本地验证生成。

两张全景保持原始尺寸，重新进行 WebP 压缩；选图使用独立缩略图。PNG 源图完整保留，日常构建直接复制已经准备好的运行素材。
