# 高地图重绘记录

2026-10-21，使用内置 imagegen，替换战斗场景的矮全景。原始输出保存在 `art/source/milk-rooftops-tall.png`、`art/source/milk-rain-tall.png`，两张实际输出均为 1254×1254。运行 WebP 保持原生尺寸，质量 80，分别为 286778 / 284200 字节；菜单预览为 12412 / 11596 字节。

晴景以原晴日街道为编辑参考：保留商铺、棚架、自行车和手绘质感，重新画出大面积高空云层以及完整石板路前景。雨景以新晴景为编辑目标、原雨景为配色参考，保持新构图，换成蓝灰厚云、亮窗、灯光与湿地反射。雨丝不烘焙到图片，由游戏动态绘制。

核心生成约束：

```text
Production SQUARE side-view fighting game background. Preserve the recognizable
shops, tiled roofs, awnings, bottles, plants, lamp posts and bicycle of the
reference panorama. Expand vertically with fully painted high sky and natural
stone paving foreground. Continuous hand-painted atmosphere, no blank region,
no flat rectangular bands, no stretched pixels, no hard seams. No characters,
no UI, no text, no borders, no added gameplay platforms.

Rain variant: preserve the new sunny composition and street/roof heights.
Replace the summer sky with immense layered blue-gray rain clouds, subtle haze,
wet paving and warm window/lantern reflections. No baked-in rain streaks.
```

美术映射覆盖世界 y=-2140 至 1700，共 3840 单位，与世界宽度 3840 相同，保持图像比例。极端屏幕比例使用云层 / 铺路的反射余量，空地双方距离导致镜头越过地图右侧时同样补足绘画；常规高跳画面直接使用新绘天空。删除旧的顶部纯色衔接和底部铺路条拉伸。物理高度上限改为 -1500，使最高露台上的二段跳不会撞上旧的 -700 天花板。

`scripts/prepare-stages.py` 只负责格式压缩和菜单缩略图准备。旧的 `prepare-assets.py` 在新源图存在时也会调用它，避免重做角色图集时覆盖菜单预览。构建只复制新 WebP 与缩略图，PNG 和旧全景不进入部署包。地图仍在开打就绪后按需加载，失败时保留原有回退画面。
