# 潜艇大战 V2.33 · HTML 版

双击 `index.html` 即可在 Edge、Chrome 等现代浏览器中游玩；无需安装和联网。

以用户提供的 `ship_V2.33.exe` 为来源，提取原版资源，解码 x86 指令，在 JavaScript 执行器中运行原版的游戏函数。Windows/MFC 的绘图、音频、输入、对话框与文件服务由浏览器兼容层提供。

## 操作

| 操作 | 默认键位 |
|---|---|
| 左右移动 | ← / →；鼠标移动 |
| 左、中、右侧投弹 | Z / Space / X；鼠标单击 |
| 核武器 | Enter，需要已收集 |
| 向上发射 | ↑，第 11 关起 |
| 重新开始 / 暂停 | F2 / F3 |
| 设置 / 音效 / 全屏 / 英雄榜 | F4 / F5 / F8 / F9 |
| 存档 / 读档 / 鼠标开关 | Ctrl S / Ctrl L / Ctrl M |

设置可选择起始关卡、原版速度预设、键位和战场颜色。画面保持原版 600×450 坐标，按窗口和屏幕像素密度等比例放大；默认更新间隔保持 31 毫秒。游戏说明使用分组、颜色与加粗，小屏可滚动。

存档和英雄榜保存在当前浏览器的本地存储中。存档仍由原版函数生成和读取（2109 字节，文件签名 `231`），可导入、导出 `.mine` 文件。更换浏览器、移动页面位置或清理浏览器数据后，应通过导出文件保留存档。

## 复刻依据与验证

原文件 SHA-256：
`75c0ece3e40e85ca6dfd363ceecdf9cd5fd5ef48325c20e7cddb52ec082abbaf`

- 68 张位图：PNG 与从 EXE 解码的位图逐像素一致。
- 7 个音效：WAV 与 EXE 内资源逐字节一致。
- `.text`、`.rdata`、`.data` 三个导出区段与原文件逐字节一致。
- 21 个关卡均完成 700 帧的定向测试，覆盖投弹、向上发射、核武器和存档恢复；第 21 关循环、英雄榜写入和刷新恢复通过。
- 7 个代表关卡与 Unicorn 对照原始机器字节执行；服务调用顺序、整数寄存器与游戏内存一致。
- 检查桌面、390 / 320 像素视口，说明窗口滚动、关闭按钮、暂停恢复均通过。

这里的机器码对照共用同一套浏览器服务替代，验证的是指令执行与玩法状态。没有把原 Windows 程序运行结果做全程逐帧、逐音频采样对比。字体、GDI 线条像素、DirectSound 混音、极高速设置的实际帧率、系统窗口动画和对话框外观仍可能与原程序不同。x87 浮点计算使用 JavaScript 双精度；已通过所列场景对照，但不等同于完整的 80 位 x87 模拟器。

## 文件

- `index.html` / `game.js`：浏览器界面、显示缩放与输入。
- `cpu.js`：所需 x86 / x87 指令的执行器。
- `machine.js`：原版区段与解码后的指令，不包含原创改写的玩法函数。
- `bridge.js`：Windows/MFC 服务兼容层。
- `assets/`：提取的位图、WAV 和原始资源；页面另嵌入数据，以支持本地直接打开。
- `docs/`：资源清单、反汇编、函数地址说明及验证结果。
- `tools/`：资源导出与可重复验证脚本。

## 重建和验证

```powershell
python -m pip install -r tools/requirements.txt
python tools/export.py D:\test\ship_V2.33.exe
python tools/verify_resources.py D:\test\ship_V2.33.exe
python tools/verify_machine.py
python tools/test_gameplay.py
python tools/test_ui.py
```

浏览器测试使用已安装的 Microsoft Edge。原 EXE 未复制进项目，也未被修改。原资源和游戏作者信息属于原作者汪海涛（Bighead Bird Program Studio），项目保留其出处。
