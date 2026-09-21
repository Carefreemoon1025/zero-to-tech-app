#!/usr/bin/env python3
"""把中文字体裁剪成"只包含本站用到的那几百个字"的 WOFF2（保留可变字重轴）。

为什么必须子集化：一套完整的中文字体（Noto Sans SC 可变字体）有 17MB，
直接把 17MB 塞给访客是不可接受的；而本站真正用到的汉字只有几百个，
裁剪出来只有几十 KB。这也是中文字体在 Web 上唯一现实的用法。

为什么要自托管而不是用系统字体：
  · 字体栈里写 "PingFang SC" 只有 Mac 用户看得到，Windows 会退到微软雅黑，
    同一份作品在不同面试官电脑上长得不一样；
  · 自托管一份字体，谁的屏幕上都一样，而且不依赖任何 CDN（国内访问也快）。

为什么保留可变轴、只出一个文件：
  实例化成 400 / 600 两个静态文件一共 536KB，而保留 wght 轴的可变字体
  一个文件 244KB 就能覆盖 100~900 全部字重，标题要 semibold、正文要 regular
  都不用再加文件。苹果官网中文标题的观感主要来自 600（semibold）——
  比 Bold 通透，比 Regular 有分量。

用法：
    # 先把 Noto Sans SC 可变字体放到 .tooling/fontsrc/NotoSansSC-var.ttf
    .venv/bin/python scripts/subset-fonts.py
产物：
    frontend/app/fonts/noto-sans-sc-{400,600}.woff2

⚠️ 站点文案改了（尤其是后端 stack.py / profile.py 里的中文）要重新跑一次，
   否则新字会落到系统字体上——不会出豆腐块，但风格会不统一。
"""

import re
import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter, Options

ROOT = Path(__file__).resolve().parent.parent
SOURCE_FONT = ROOT / ".tooling/fontsrc/NotoSansSC-var.ttf"
OUT_DIR = ROOT / "frontend/app/fonts"

# 要扫描的文案来源：前端组件、样式里的 content、后端返回给前端的文案、文档
SCAN_GLOBS = [
    # 只扫"会渲染到页面上"的文案。
    # 特意**不扫** backend/analysis.py：那里面几百个情感词只参与打分、不会显示，
    # 把它们打进字体子集纯属浪费（实测能差出 100KB 以上）。
    "frontend/app/**/*.jsx",
    "frontend/components/**/*.jsx",
    "frontend/lib/**/*.js",
    "frontend/data/**/*.js",
    "backend/stack.py",     # 技术栈面板文案（后端返回、前端渲染）
    "backend/profile.py",   # 作品与座右铭
    "backend/main.py",      # 接口错误文案（会直接显示给用户）
]

# 兜底字符集：ASCII 可打印 + 中文标点 + 常用符号。
# 这些字就算当前文案里没有，也很可能被将来的一句新文案用到，代价几乎为零。
BASE_CHARS = (
    "".join(chr(c) for c in range(0x20, 0x7F))
    + "　、。〃〈〉《》「」『』【】〔〕〖〗！＂＃％＆＇（）＊＋，－．／：；＜＝＞？＠［］＾＿｀｛｜｝～"
    + "·…—–‘’“”″′　"
    + "→←↑↓←→↗↘✓✔✗✘×÷±≈≠≤≥∞°℃"
    + "①②③④⑤⑥⑦⑧⑨⑩"
)

OUT_NAME = "noto-sans-sc-var.woff2"


def collect_chars() -> set[str]:
    chars = set(BASE_CHARS)
    files = 0
    for pattern in SCAN_GLOBS:
        for path in ROOT.glob(pattern):
            if path.is_file():
                try:
                    lines = path.read_text(encoding="utf-8").splitlines()
                except (UnicodeDecodeError, OSError):
                    continue
                for line in lines:
                    # 跳过注释行：注释里的汉字不会出现在页面上，进子集是纯浪费
                    if line.lstrip().startswith(("//", "#", "*", "/*")):
                        continue
                    chars.update(line)
                files += 1
    # 去掉控制字符
    chars = {c for c in chars if c.isprintable() or c == " "}
    print(f"扫描 {files} 个文件，收集到 {len(chars)} 个字符")
    return chars


def subset_font(chars: set[str]) -> Path:
    font = TTFont(SOURCE_FONT, fontNumber=0)

    # 只保留用到的字形（保留 fvar/gvar，字重轴原样留着）
    options = Options()
    options.flavor = "woff2"          # 压缩率最高，现代浏览器全支持
    options.layout_features = ["kern", "liga", "clig", "calt", "palt", "halt", "vert"]
    options.drop_tables += ["DSIG"]
    options.notdef_outline = True     # 保留豆腐块轮廓：万一漏字，看得见而不是空白
    options.recalc_bounds = True
    subsetter = Subsetter(options=options)
    subsetter.populate(text="".join(sorted(chars)))
    subsetter.subset(font)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / OUT_NAME
    font.save(out)
    font.close()
    return out


def main() -> int:
    if not SOURCE_FONT.exists():
        print(f"缺少源字体：{SOURCE_FONT}", file=sys.stderr)
        print("下载：curl -sL -o .tooling/fontsrc/NotoSansSC-var.ttf \\", file=sys.stderr)
        print("  https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf", file=sys.stderr)
        return 1

    chars = collect_chars()
    source_mb = SOURCE_FONT.stat().st_size / 1024 / 1024
    out = subset_font(chars)
    print(f"源字体 {source_mb:.1f}MB → {out.relative_to(ROOT)}  {out.stat().st_size / 1024:.0f}KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
