# 美术方向与生成提示词

使用内置 `image_gen.imagegen` 工具；未使用 CLI 或第三方图像 API。画面方向为暖色手绘老街、奶油纸张、墨绿油墨和朱红，角色遵循用户给出的经典奶蛙形象。

扩展晴天街区和雨天版本的原始提示词另存于 [stage-prompts.md](stage-prompts.md)，两张新地图沿用同一街区与绘画风格。

## 最终文件

| 用途 | 文件 |
| --- | --- |
| 游戏场景 WebP | `assets/milk-street.webp` |
| 游戏动作 WebP | `assets/milkfrog-sprites.webp` |
| 补充动作 WebP | `assets/milkfrog-advanced.webp` |
| 扩展晴天街区 | `assets/milk-rooftops.webp` |
| 扩展雨天街区 | `assets/milk-rain.webp` |
| 场景原始 PNG | `assets/source/milk-street.png` |
| 动作原始 PNG | `assets/source/milkfrog-sprites.png` |
| 补充动作原始 PNG | `assets/source/milkfrog-advanced.png` |
| 扩展晴天原始 PNG | `assets/source/milk-rooftops.png` |
| 扩展雨天原始 PNG | `assets/source/milk-rain.png` |
| 用户造型参考 | `docs/references/character-reference.jpg` |

## 场景提示词

```text
Use case: illustration-story. Asset type: wide 16:9 2D side-on fighting game background, high quality hand painted anime arcade stage, 1920x1080 landscape. Warm late-afternoon Chinese neighborhood street corner in the 1990s with a small vintage milk bar and mint-green tiled convenience store left, orange-red cloth awning, a little drinks kiosk to right, stacked bottle crates, a parked pale green bicycle at far right, low stucco apartment houses with hanging laundry behind, utility wires, distant lush green trees, fluffy cream clouds and pale blue sky. Nostalgic cel-painted animation background with expressive confident fine dark olive linework, rich warm colors, painterly matte gouache surfaces, high detail but quiet contrast, coherent perspective. The entire bottom 28 percent must be a simple broad flat sandy tan concrete street / fighting floor in front of the buildings, clear and EMPTY with no obstacles, no people and no characters, no foreground objects. Horizon about 65% down. Side-scrolling fighting game stage camera at waist height, buildings parallel with screen, no deep vanishing road. Center area relatively quiet to make fighters readable. Overall amber sunshine and mint/sage green, rusty red, ivory color palette, analog 1990s animation art rather than slick AI concept art. No text, no readable signs, no logos, no watermark, no decorative frame, no menu or UI.
```

## 基础动作图集提示词

参考图为用户最后提供的协调身体与眼睛的照片。它取代了更早的草稿和标志参考。

```text
Use case: identity-preserve. Asset type: complete transparent 2D fighting-game character sprite sheet rendered in the SAME SOFT 3D STYLE as the single provided reference image. The reference is the definitive character model. Create this SAME classic Chinese milk-frog meme character in 12 fighting poses. Top priority: harmonious accurate whole-body proportions and likeness, NOT exaggerated eyeballs. It has a very broad round smooth yellow head, head blends naturally into shoulders WITHOUT a neck, plump pear-shaped torso, huge softly ivory-colored belly, thick rounded yellow arms tapering into muted olive-gray hands, chunky legs with olive-gray feet. Its head is broad and round just like reference, NOT a tiny pointy dinosaur head. Calm small crooked smile. Medium-sized rounded light green eyes inset naturally in face with round dark pupils, like reference, harmonious to the broad head. Eyes do NOT protrude above head, do NOT sit on stalks, no white sclera, no googly eyes. Follow reference for eye proportions and subtle facial placement, eyes need not be exact copies, main goal is a coherent charming character. Skin is soft yellow with gentle claylike three-dimensional shading, no heavy cartoon outlines, no drawn texture. Recognizable reference character, not newly designed. Strict production grid: FOUR columns by THREE rows, 12 exactly equal cells, landscape sheet 2048 by1536. All cells are 512x512. Every character centered in its cell, same standing height about 370px and fixed baseline at 460px within each cell, full body fits in own cell with margins. Camera 3/4 front view turned slightly RIGHT, BOTH green eyes visible, both feet visible. Row1: neutral fighting stance two hands ready at chest and small smile; left-foot-forward walk; right-foot-forward walk; airborne jump knees tucked. Row2: windup punch; rightward straight punch fully extended; rightward high kick; forearm defensive guard covering torso but eyes remain visible. Row3: both hands extended to right casting energy WITHOUT projectile or effects; taking a hit recoiling to left eyes surprised; knocked out flat on back fitting horizontally in cell; iconic standing hands-on-belly laugh with round green eyes still visible. Consistent body, face, material, scale and illumination in ALL twelve frames. Transparent background, absolutely no environment, no floor, no ground shadow, no text, no labels, no UI, no glowing effects, no grid lines, no accessories. Do not make it muscular, monstrous, reptilian, green-skinned, flat vector, heavily outlined, or a generic dinosaur. Match the harmonious soft round 3D body and green eyes of the reference as a whole.
```

## 平视修正提示词

在完整动作图集基础上统一修正头部朝向与瞳孔位置。最终游戏使用本次修正版本。

```text
Use case: precise-object-edit. Edit the provided transparent 4-column by 3-row milkfrog game sprite sheet. The user says the current characters look DOWN AT THE GROUND and this looks wrong in the game. Fix ONLY head orientation and gaze across ALL 12 cells. Heads should be upright, the FACE looking outward toward the viewer and horizontally toward an opponent on the RIGHT at the same head height. In neutral and walking poses, use a clear frontal three-quarter face with BOTH green eyes well visible. Put each BLACK PUPIL at the vertical CENTER of its pale green rounded eyeball, not at its bottom; nudge pupils horizontally toward screen right as a coherent focused gaze. No downward pupil placement, no tilted-down face, no looking at own belly or feet. The big round head, soft yellow body and small smile must look natural and harmonious, keep the eyes moderate sized as they are, NOT oversized, bulging, googly, stalked or caricatured. Preserve the smooth soft 3D style, large pear-shaped yellow body, ivory belly, olive gray hands and feet, exact all 12 action poses and cell positions, same sheet dimensions and transparent background. Do not change the grid, body/limb proportions, cell scales or animation pose layout. No added glow or text. User's highest priority: a coherent upright classic milkfrog body and a level gaze toward its opponent, not the floor.
```

变体共享身体、绿色眼睛与奶白肚皮，选择性映射黄色皮肤为奶绿、奶红、奶紫。基础图集十二姿态，补充图集八姿态，脚底锚点与主要轮廓在渲染时校准。

## 补充动作提示词规格

工具：内置 imagegen；参考图：`assets/source/milkfrog-sprites.png`。本轮生成要求整理如下，最终产物为 `assets/source/milkfrog-advanced.png`。

```text
Use case: identity-preserve. Supplementary transparent fighting-game sprite atlas.
Preserve the exact milkfrog identity, harmonious round yellow body, ivory belly,
moderate green eyes with centered black pupils, olive-gray hands and feet,
soft 3D material and level gaze of the supplied existing sprite sheet.
Strict four columns by two rows, eight isolated full-body poses facing right.
Row 1: deep crouching guard; crouching low punch; extended low sweeping kick;
rising uppercut with raised fist and bent knee.
Row 2: airborne diagonal diving kick; forward-reaching grab startup;
rotating extended spinning kick; fast forward sprint.
Keep common camera, lighting and character proportions. Keep wide transparent
gutters and all hands and feet within their cells. Crouched silhouettes should
sit lower than standing poses. No shadows, background, effects, labels or text.
```

