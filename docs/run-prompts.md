# 六帧跑步与合并图集

使用内置 `image_gen`，透明背景模式，未使用 CLI / API fallback。输入一为修改前的 `assets/fighters/classic.webp`，仅用于经典角色造型、材质与配色参考。第一次生成结果作为第二次编辑目标；第二次的另一输入仍为角色身份参考。

最终原图：[../art/source/milkfrog-run.png](../art/source/milkfrog-run.png)，来自 `exec-84fda0bd-d04d-4728-ab50-a3f17d2eee8c.png`。首版 `exec-754d34b7-ff4c-4fc8-a7ad-3805ae201cc4.png` 没有进入项目。原图只用于离线处理，不发布到网站。

首次生成提示词：

```text
Use case: identity-preserve. Asset type: production six-frame SPRINT animation sheet for the existing milkfrog side-view fighting game. Input image 1 is the definitive character identity and clay material reference, NOT a pose template to repeat. Generate SIX full-body frames in exactly THREE columns and TWO rows, equal square cells, reading order. Truly transparent alpha background, no ground or cast shadows, no text or grid. Same golden yellow plump milkfrog, huge round head merging into body, ivory belly, gray olive-brown hands and feet, proportional pale green circular eyes and black pupils, tiny smile. Three-quarter side view facing RIGHT, both eyes visible, gaze level to the right. Keep stable character size, lighting, camera, head size and a shared foot baseline, all limbs fully inside each cell with clear gutters. This must be unmistakably RUNNING, not the current upright marching/walking: torso tilted forward about 20 degrees, head forward while looking horizontally, elbows bent and pumping, alternating knees high with opposite leg trailing far behind, two visible airborne flight phases, long athletic strides. Do not give the character a tail, clothes, spikes or accessories. Frame 1: near/right leg extended forward touching down, far/left leg trailing straight back, left arm forward and right arm back. Frame 2: right foot pushing back under body, LEFT knee driving forward high, opposite arms. Frame 3: flight with LEFT thigh and knee leading forward and RIGHT heel tucked far behind; left arm back and right fist forward. Frame 4: LEFT leg extended forward touching down, RIGHT leg stretched back, opposite of frame 1. Frame 5: left foot pushing back under body, RIGHT knee driving forward high, opposite arms. Frame 6: flight with RIGHT thigh and knee leading and LEFT heel tucked behind, opposite of frame 3, cycling back to frame 1. The leading legs MUST alternate between first and second half; preserve a coherent single running cycle, no duplicated walk poses. Keep round original body anatomy and the reference's soft polished 3D-clay shading. Only the six character bodies on genuine transparency.
```

定向修订提示词：

```text
Edit the six-frame sprint sprite sheet (image 1); image 2 is only the original model/material reference. Make ONE targeted correction: frames 4, 5 and 6 (the entire bottom row) must be the opposite-leg half of the run cycle. In ALL THREE bottom-row frames the NEAR arm (viewer-facing arm, currently stretched behind the left shoulder) must instead be visibly bent FORWARD across the ivory belly with its gray fist in front at chest height. The far arm must swing BACK, visibly behind the body on the left. The NEAR leg must reach BACK and the FAR leg must lead forward. Preserve the exact first/top row poses and all identity features, pale green eyes, rounded head-body, existing colors, camera, clay lighting, six separate full bodies, 3 columns x 2 rows, consistent scale and feet baseline. Each bottom-row pose is an alternating sprint phase corresponding to the top row, with a pronounced forward body lean and long running stride. Remove any ambient golden halo surrounding the silhouettes. Truly transparent background, only bodies, no shadow, floor, text or grid. Keep full hands and feet safely inside their respective cell. Do not mirror heads or face left.
```

最终运行文件为 `assets/fighters/{classic,green,red,purple,pink,blue}.webp`，每位一张，包含 35 个不同的物理帧。八帧行走复用逻辑槽 1 / 2，六帧跑步复用逻辑槽 19，三张旧移动图被替换，不再保留六个独立 `*-walk.webp` 或新增 `*-run.webp`。静止、跳跃、受击、攻击和首页选角姿态保留。

`scripts/prepare-assets.py` 统一调色、锚点和脚底，将轮廓缩放至 192 虚拟帧，再按实际非空矩形装入图集；四像素透明间距防止相邻动作串色。元数据保存源矩形与还原位置，渲染器按记录取图，不依赖固定行列。移动渲染分别使用八帧行走和六帧跑步，按实际位移推进，后退反向、顶墙停止。原图中前倾、摆臂和跨步承担跑步造型，未用加速播放走路代替。

