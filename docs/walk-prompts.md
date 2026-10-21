# 八帧步态生成记录

工具：内置 `image_gen`，透明背景模式；未使用 CLI / API fallback。现有 `assets/fighters/classic.webp` 为角色身份和材质参考，首版结果为动作修订目标。

最终项目原图：[../art/source/milkfrog-walk.png](../art/source/milkfrog-walk.png)。选中的内置输出文件为 `exec-991563ee-9a58-4347-967a-ecbf87799987.png`；首版 `exec-93c78bbb-22b9-4128-abac-35bb14278cf4.png` 未进入项目。当前八帧已合并到每位角色唯一的 `assets/fighters/{角色}.webp`，替换旧两张走路姿态，独立 walk 包已删除；生成原图不进入发布包。跑步使用另一套新绘动作，见 [run-prompts.md](run-prompts.md)。

以下将生成与定向修订要求合并归档为可复用的最终提示词规格：

```text
Use case: identity-preserve. Production transparent walk-cycle sprite sheet for a side-view fighting game. Use the existing classic milkfrog sprite sheet as the definitive identity, proportions, eyes, colors, lighting and clay-render material reference. Exactly EIGHT distinct full-body animation frames in FOUR columns and TWO rows. No labels, text, grid, scenery, ground plane, magic, particles or shadows outside the body. Truly transparent alpha background.

The character has a plump golden yellow body and large rounded head merged naturally into the torso, an ivory belly, short thick limbs, olive gray-brown hands and feet, harmonious pale green round eyes with black pupils and a tiny smile. Face horizontally RIGHT toward the opponent, three-quarter view with both eyes visible; never look down. Preserve the recognizable existing milkfrog model. All cells have equal size, safe transparent margins and a consistent camera, body scale and foot baseline. Keep the whole character including all feet and fingers inside its own cell, with no detached limbs or neighboring body parts.

Create an actual continuous eight-frame gait in reading order: right leg forward contact, down/passing, left leg forward contact, down/passing, then the complementary phases returning smoothly to the initial pose. Alternate the leading leg and arm visibly; do not repeat nearly identical still poses. Keep fists in a relaxed fighting guard while the shoulders and arms counter-swing naturally, with a small weight shift and soft knee bend. The head and face remain stable and level; no oversized bobbing or changes in anatomy. Make the final-to-first transition usable as a loop. The image contains only the yellow character; matching color variants will be prepared offline using the existing six material palettes.

Targeted revision of the first sheet: improve the alternating leg contact and arm counter-swing so the sequence reads as walking instead of eight versions of the same step. Preserve the established body, facial proportions, pale green eyes, lighting, transparency, 4-by-2 cell layout and fighting guard. Avoid exaggerated running or attacking poses.
```

离线流程在 `scripts/prepare-assets.py`：分离八个角色轮廓，按头部中线和脚底定位到 192 虚拟帧，统一角色高度；沿用既有肤色明暗映射并保护绿眼、肚皮和手脚。八帧与战斗、跑步动作按非空矩形合并打包，浏览器从元数据取图，按实际位移推进相位，后退反向播放。
