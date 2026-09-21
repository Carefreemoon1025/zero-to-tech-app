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
    # 只核对现有产物是否覆盖当前文案（发布前自检，漏字则非 0 退出）
    .venv/bin/python scripts/subset-fonts.py --check
    # 把"页面上真实渲染出来的字"也并进来兜底（源码扫描只是近似）：
    #   node scripts/cdp-check.mjs --url http://localhost:3000/ --eval-file scripts/page-text.js
    .venv/bin/python scripts/subset-fonts.py /tmp/home-chars.txt
产物：
    frontend/app/fonts/noto-sans-sc-var.woff2

⚠️ 站点文案改了（尤其是后端 stack.py / profile.py / notes.py 里的中文）要重新跑一次，
   否则新字会落到系统字体上——不会出豆腐块，但同一页会出现两种字体，风格不统一。
   本脚本生成后会自查覆盖率，缺字直接报错；`--check` 可以放进发布流程当门禁。
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
    "backend/notes.py",     # 工程笔记正文（首页渲染）—— 漏掉它网站就会有两套字体
    "backend/main.py",      # 接口错误文案（会直接显示给用户）
]

# 允许追加"真实渲染文本"的转储文件（见文件末尾的说明）。
# 源码扫描是静态的：模板字符串拼出来的文案、后端数据里嵌套的字段都可能漏网，
# 所以发布前可以拿页面上真实出现的字再兜一遍底。
EXTRA_TEXT_FILES: list[Path] = []

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
    # 兜底：把"页面上真实出现过的字"也并进来（源码扫描只是近似）
    for extra in EXTRA_TEXT_FILES:
        if extra.exists():
            chars.update(extra.read_text(encoding="utf-8"))
            print(f"并入真实渲染文本：{extra}")

    # 去掉控制字符
    chars = {c for c in chars if c.isprintable() or c == " "}
    print(f"扫描 {files} 个文件，收集到 {len(chars)} 个字符")
    return chars


def coverage(path: Path, chars: set[str]) -> tuple[list[str], list[str]]:
    """核对产物覆盖率，返回 (真正的漏字, 源字体里本来就没有的字)。

    只看"源字体有、产物却没有"的字——那才是子集化切多了，是 bug；
    源字体本身没有的（比如 ✓✔✗✘ 这类符号 Noto Sans SC 就不带），
    浏览器会退到系统字体，属于预期行为，只提示不报错。

    为什么要查：缺字不会变成豆腐块（有系统字体兜底），
    但同一页会出现两种字形，正是自托管字体要消灭的问题——所以当错误对待。
    """
    src = TTFont(SOURCE_FONT, fontNumber=0)
    src_cmap = src.getBestCmap()
    src.close()
    out = TTFont(path)
    out_cmap = out.getBestCmap()
    out.close()

    gaps = sorted(c for c in chars if ord(c) in src_cmap and ord(c) not in out_cmap)
    unavailable = sorted(c for c in chars if ord(c) not in src_cmap)
    return gaps, unavailable


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
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    check_only = "--check" in sys.argv
    EXTRA_TEXT_FILES.extend(Path(a) for a in args)

    if not SOURCE_FONT.exists():
        print(f"缺少源字体：{SOURCE_FONT}", file=sys.stderr)
        print("下载：curl -sL -o .tooling/fontsrc/NotoSansSC-var.ttf \\", file=sys.stderr)
        print("  https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf", file=sys.stderr)
        return 1

    chars = collect_chars()

    # --check：只核对"现有产物覆盖不覆盖这些字"，不动文件。
    # 适合放进发布前的自检：漏字了就以非 0 退出，而不是等肉眼在页面上发现。
    if check_only:
        out = OUT_DIR / OUT_NAME
        if not out.exists():
            print(f"产物不存在：{out}", file=sys.stderr)
            return 1
        gaps, unavailable = coverage(out, chars)
        if unavailable:
            print(f"ℹ️ 源字体不含 {len(unavailable)} 个符号，将走系统字体：{''.join(unavailable)}")
        if gaps:
            print(f"❌ 字体子集缺 {len(gaps)} 个字：{''.join(gaps)}", file=sys.stderr)
            print("   重新生成：.venv/bin/python scripts/subset-fonts.py", file=sys.stderr)
            return 1
        print(f"✅ 字体子集覆盖全部 {len(chars)} 个用字")
        return 0

    source_mb = SOURCE_FONT.stat().st_size / 1024 / 1024
    out = subset_font(chars)
    print(f"源字体 {source_mb:.1f}MB → {out.relative_to(ROOT)}  {out.stat().st_size / 1024:.0f}KB")

    # 生成完立刻自查一遍：与其等别人在页面上看出两种字体，不如这里就报错。
    gaps, unavailable = coverage(out, chars)
    if unavailable:
        print(f"ℹ️ 源字体不含 {len(unavailable)} 个符号，将走系统字体：{''.join(unavailable)}")
    if gaps:
        print(f"❌ 产物仍缺 {len(gaps)} 个字：{''.join(gaps)}", file=sys.stderr)
        return 1
    print(f"✅ 覆盖全部 {len(chars)} 个用字")
    return 0


if __name__ == "__main__":
    sys.exit(main())
