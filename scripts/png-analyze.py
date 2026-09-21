#!/usr/bin/env python3
"""PNG 像素分析：用来验证"液态玻璃到底有没有真的折射"。

为什么需要它：折射是个视觉效果，但这个环境里没有能"看图"的眼睛（模型不接受图像输入）。
与其说"应该没问题"，不如把截图解码成像素自己量：
  - 只有模糊时，条纹会被抹匀，横向亮度变化平缓；
  - 真的发生位移折射时，条纹的相位会被扭曲，相邻列的"条纹中心位置"不再线性。
所以脚本做的事就是：把指定区域转成灰度 → 按列找条纹的极值位置 → 看这些位置抖不抖。

只用标准库（zlib 解压 + 手写反滤波），不引 Pillow：这台机器上没有 pip。

用法：
    python3 scripts/png-analyze.py a.png --region 40,80,240,240
    python3 scripts/png-analyze.py a.png b.png --region ...      # 两个图对比同一区域
"""

import argparse
import struct
import sys
import zlib


def read_png(path):
    """返回 (width, height, 像素函数)，像素函数 (x, y) -> (r, g, b)。"""
    with open(path, "rb") as fh:
        data = fh.read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit(f"{path} 不是 PNG")

    pos = 8
    width = height = None
    bit_depth = color_type = None
    idat = bytearray()
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos : pos + 4])
        ctype = data[pos + 4 : pos + 8]
        chunk = data[pos + 8 : pos + 8 + length]
        pos += 12 + length
        if ctype == b"IHDR":
            width, height, bit_depth, color_type, _, _, interlace = struct.unpack(">IIBBBBB", chunk)
            if bit_depth != 8 or interlace != 0 or color_type not in (2, 6):
                raise SystemExit(f"只支持 8bit 非隔行的 RGB/RGBA PNG（当前 depth={bit_depth} type={color_type}）")
        elif ctype == b"IDAT":
            idat += chunk
        elif ctype == b"IEND":
            break

    raw = zlib.decompress(bytes(idat))
    channels = 3 if color_type == 2 else 4
    stride = width * channels
    pixels = bytearray(width * height * channels)

    # 逐行反滤波（PNG 的 5 种 filter）
    prev = bytearray(stride)
    offset = 0
    for y in range(height):
        ftype = raw[offset]
        offset += 1
        line = bytearray(raw[offset : offset + stride])
        offset += stride
        if ftype == 1:
            for i in range(channels, stride):
                line[i] = (line[i] + line[i - channels]) & 0xFF
        elif ftype == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 0xFF
        elif ftype == 3:
            for i in range(stride):
                left = line[i - channels] if i >= channels else 0
                line[i] = (line[i] + ((left + prev[i]) >> 1)) & 0xFF
        elif ftype == 4:
            for i in range(stride):
                a = line[i - channels] if i >= channels else 0
                b = prev[i]
                c = prev[i - channels] if i >= channels else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 0xFF
        pixels[y * stride : y * stride + stride] = line
        prev = line

    def pixel(x, y):
        i = y * stride + x * channels
        return pixels[i], pixels[i + 1], pixels[i + 2]

    return width, height, pixel


def gray_row(pixel, x0, x1, y):
    return [sum(pixel(x, y)) / 3 for x in range(x0, x1)]


def stripe_centers(values, threshold=None):
    """找出一行灰度里"暗条纹的中心"位置（相对列号）。

    背景是"深色 18px / 浅色 18px"的竖条纹，所以每行都能找到一串暗条纹中心。
    折射发生位移时，这些中心的间距会被不均匀地拉伸/压缩——只看间距的波动就够了。
    """
    lo, hi = min(values), max(values)
    if hi - lo < 6:          # 对比度太低（比如被模糊抹平了），这行测不出东西
        return []
    if threshold is None:
        threshold = (lo + hi) / 2
    centers, run = [], []
    for i, v in enumerate(values):
        if v < threshold:
            run.append(i)
        elif run:
            centers.append(sum(run) / len(run))
            run = []
    if run:
        centers.append(sum(run) / len(run))
    return centers


def spread(centers):
    """相邻条纹间距的标准差——折射越强，间距越不均匀。"""
    if len(centers) < 3:
        return 0.0
    gaps = [b - a for a, b in zip(centers, centers[1:])]
    mean = sum(gaps) / len(gaps)
    var = sum((g - mean) ** 2 for g in gaps) / len(gaps)
    return var ** 0.5


def analyze(path, region, rows=6):
    width, height, pixel = read_png(path)
    x0, y0, w, h = region
    x1, y1 = min(x0 + w, width), min(y0 + h, height)
    out = {"file": path, "size": [width, height], "region": [x0, y0, x1 - x0, y1 - y0]}
    spreads, contrasts = [], []
    for k in range(rows):
        y = y0 + int((y1 - y0) * (k + 1) / (rows + 1))
        values = gray_row(pixel, x0, x1, y)
        spreads.append(spread(stripe_centers(values)))
        contrasts.append(max(values) - min(values))
    out["stripe_irregularity"] = round(sum(spreads) / len(spreads), 2)
    out["contrast"] = round(sum(contrasts) / len(contrasts), 1)
    return out


def profiles(path, region, rows=6):
    """取出若干行的灰度剖面（用于两块区域对比）。"""
    width, height, pixel = read_png(path)
    x0, y0, w, h = region
    x1, y1 = min(x0 + w, width), min(y0 + h, height)
    out = []
    for k in range(rows):
        y = y0 + int((y1 - y0) * (k + 1) / (rows + 1))
        out.append(gray_row(pixel, x0, x1, y))
    return out


def best_lag(a, b, max_lag=48):
    """找把 b 平移多少列后最像 a（用平均绝对差衡量）。"""
    best, best_lag_value = None, 0
    for lag in range(-max_lag, max_lag + 1):
        diffs = []
        for a_row, b_row in zip(a, b):
            n = len(a_row)
            lo, hi = max(0, -lag), min(n, n - lag)
            for i in range(lo, hi):
                diffs.append(abs(a_row[i] - b_row[i + lag]))
        if not diffs:
            continue
        score = sum(diffs) / len(diffs)
        if best is None or score < best:
            best, best_lag_value = score, lag
    return best_lag_value, best


def mean_abs_diff(a, b):
    diffs = [abs(x - y) for a_row, b_row in zip(a, b) for x, y in zip(a_row, b_row)]
    return sum(diffs) / len(diffs)


def compare(path, r1, r2, rows=6):
    """对比同一张图里两块区域的光学行为。

    三种可能的结果，判读方式：
      · 原始差异 ≈ 0            -> 折射根本没生效（两块一模一样）
      · 差异大、对齐后 ≈ 0      -> 只是整体平移，没有扭曲
      · 差异大、对齐后仍然大    -> 真的被扭曲了（这才是折射）
    """
    p1, p2 = profiles(path, r1, rows), profiles(path, r2, rows)
    raw = mean_abs_diff(p1, p2)
    lag, aligned = best_lag(p1, p2)
    return {
        "region_a": r1,
        "region_b": r2,
        "raw_diff": round(raw, 2),
        "best_lag_px": lag,
        "diff_after_align": round(aligned, 2),
        "warp_ratio": round(aligned / raw, 3) if raw else None,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("png")
    ap.add_argument("--region", help="x,y,w,h —— 单区域统计")
    ap.add_argument("--compare", help="x1,y1,x2,y2,w,h —— 两块区域对比")
    ap.add_argument("--rows", type=int, default=6)
    args = ap.parse_args()

    if args.compare:
        nums = [int(v) for v in args.compare.split(",")]
        if len(nums) != 6:
            raise SystemExit("--compare 需要 x1,y1,x2,y2,w,h 六个数")
        x1, y1, x2, y2, w, h = nums
        result = compare(args.png, (x1, y1, w, h), (x2, y2, w, h), args.rows)
        print(f"A 区 {result['region_a']}  vs  B 区 {result['region_b']}")
        print(f"  原始像素差异      : {result['raw_diff']}")
        print(f"  最佳对齐位移      : {result['best_lag_px']} px")
        print(f"  对齐后残余差异    : {result['diff_after_align']}")
        print(f"  扭曲占比          : {result['warp_ratio']}  （残余/原始，越接近 1 越说明是扭曲而非平移）")
        verdict = "折射没有生效（两块一样）"
        if result["raw_diff"] > 3:
            verdict = "被扭曲了（真实折射）" if result["diff_after_align"] > 3 else "只是整体平移，没有扭曲"
        print(f"  判读              : {verdict}")
        return 0

    if not args.region:
        raise SystemExit("要么给 --region，要么给 --compare")
    region = tuple(int(v) for v in args.region.split(","))
    if len(region) != 4:
        raise SystemExit("--region 需要 x,y,w,h 四个数")
    r = analyze(args.png, region, args.rows)
    print(
        f"{r['file']}  区域 {r['region']}  "
        f"条纹间距抖动 {r['stripe_irregularity']:>6}  对比度 {r['contrast']:>6}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
