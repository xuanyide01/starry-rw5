# 第三方与资源说明

## 参考移植作品

参考作者 [liuyuze61](https://github.com/liuyuze61) 的《ATRI 1.5.1》和《星空列车与白的旅行 v1.0.0》。原分享地址见 README；相关开源项目为 [ATRI-miband](https://github.com/liuyuze61/ATRI-miband)，原 MIT 许可证保留于 [licenses/ATRI-miband-LICENSE](licenses/ATRI-miband-LICENSE)。

## 开发依赖与游戏资源

Node.js、aiot-toolkit、sharp，以及 Python 图片/资源处理依赖通过包管理器安装，没有将依赖目录打包入仓库。它们各自的许可证保留在相应软件包中。

`src/common/` 中由原版转换的剧情、CG、背景、角色立绘，以及 README 截图和应用图标涉及原作资源，不属于本仓库 MIT 代码许可的授权范围。完整 BIN/RPK 安装包包含这些资源，代码开源不代表原游戏资源开源。

0.3.0 新增的中文标题按钮、云层/条纹界面与姓名/存档边框从用户提供的原作 sharedassets0.assets 提取；同属原作素材，不适用 MIT。原始纹理到手表画布的转换规则见 tools/build-original-ui.py，资源来源与摘要见 reports/original-ui-v030.json。

0.3.1 的 PNG 与 ZIP 编码优化使用 Python zopfli（Apache-2.0）及 Pillow；背景/CG 转换与原作立绘坐标处理仍涉及原作资源，未改变其权利归属。透明裁剪保留还原后的像素，JPEG 的有损性质与逐张误差筛选见 README 及 reports/opaque-compression-v031.json。参考了本工作区 STEINS;GATE 0、STEINS;GATE、CLANNAD 移植的无损 PNG、透明 PNG/不透明 JPEG 处理方法。

0.3.3 离线调色板候选生成使用 imagequant 1.1.5（BSD-3-Clause，许可证保留于 licenses/imagequant-LICENSE），该依赖不运行于手表。立绘重编码及两张不透明 UI 背景 JPEG 转换仍涉及原作素材，未改变其权利归属。
