"use client";

// 液态玻璃的折射：生成位移图 + 把滤镜挂到页面上。
//
// 这一版是**照着开源实现重写**的，不是自己拍脑袋调出来的。参考：
//   · shuding/liquid-glass —— 位移图的算法（圆角矩形 SDF + smoothstep）
//   · rdev/liquid-glass-react (MIT) —— 页面结构：把滤镜挂在单独的 warp 层上
//
// 之前踩的两个坑，这里都绕开了：
//   ① 用 feTurbulence 噪声当位移图 → 它模糊之后的幅值只剩百分之几，
//      scale 调到 40 实际只位移了一两个像素，等于没做。位移图必须是
//     "按形状算出来的、归一化到满量程"的图。
//   ② 把 SVG 滤镜挂在 backdrop-filter 上（`backdrop-filter: url(#f)`）——
//      Chrome 之外基本不认。正确做法是：单独一层 warp，
//      用 backdrop-filter 把背景糊进来，再用**通用的 filter 属性**扭曲这一层。
//      内容层压在 warp 之上，保持清晰。
//
// 位移图的约定（feDisplacementMap）：R 通道 = X 方向位移，G 通道 = Y 方向位移，
// 128 表示"不动"，0/255 表示满量程的负/正位移。滤镜的 scale 再把归一化值换算成像素。

// 位移图最长边。图本身是平滑的渐变场，160px 和 256px 肉眼无差，
// 但生成耗时与显存占用差一倍以上（12 个面板就是 12 张图）。
const MAP_MAX_SIZE = 160;

// 多宽的屏幕才开折射。实测（无头 Chromium，软件渲染）滚动时：
//   无玻璃 p50 29ms ｜ 只有模糊 33.7ms ｜ 模糊+折射 42.4ms
// 折射比纯模糊贵约 50%，而它只在这几处看得出来：面板边缘、背景有颜色过渡的位置。
// 小屏 GPU 更弱、折射也更难看清，所以窄屏直接退回纯模糊，不值得为此掉帧。
export const REFRACTION_MIN_WIDTH = 768;

/** 圆角矩形的有符号距离场：内部为负、边界为 0、外部为正 */
function roundedRectDistance(px, py, halfWidth, halfHeight, radius) {
  const qx = Math.abs(px) - (halfWidth - radius);
  const qy = Math.abs(py) - (halfHeight - radius);
  return (
    Math.min(Math.max(qx, qy), 0) +
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) -
    radius
  );
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * 生成一张位移图（data URL）。
 *
 * 位移图决定"哪里被折射、往哪个方向折射"。这里用的是**镜片轮廓**的做法
 * （kube.io《Liquid Glass in the Browser》里那套物理推导的简化版）：
 *
 *   1. 算每个像素到圆角矩形边框的有符号距离 d（内部为负）；
 *   2. 沿边框法线方向给位移：位移大小只取决于"离边框多远"，
 *      而不是"离中心多远"——所以四条边整圈都在折射，
 *      而不是只有四个角（早期版本就栽在这：只有角上有位移，
 *      边中点只移动 9px，背景再花也看不出来）；
 *   3. 位移大小沿带宽走一条"钟形"曲线：贴边和带宽内侧都是 0，
 *      中间最大。中间最大是为了不在边框上留下硬切边；
 *      采样方向朝内，所以永远采到元素内部的像素，不会有边缘拉伸。
 *
 * @param {number} width  元素宽度（CSS 像素）
 * @param {number} height 元素高度（CSS 像素）
 * @param {object} [options]
 * @param {number} [options.bezelRatio=0.16] 折射带宽度，占较短边的比例
 * @param {number} [options.radiusRatio=0.22] 圆角半径，占较短边的比例
 * @returns {string|null} 可直接给 <feImage href> 用的 data URL
 */
export function createDisplacementMap(width, height, options = {}) {
  const { bezelRatio = 0.16, radiusRatio = 0.22 } = options;

  const gridWidth = Math.max(8, Math.round(Math.min(MAP_MAX_SIZE, width)));
  const gridHeight = Math.max(8, Math.round(Math.min(MAP_MAX_SIZE, height)));

  const canvas = document.createElement("canvas");
  canvas.width = gridWidth;
  canvas.height = gridHeight;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const minSide = Math.min(width, height);
  const bezel = Math.max(10, minSide * bezelRatio);
  const cornerRadius = Math.min(minSide * radiusRatio, minSide / 2 - 1);
  const halfW = width / 2;
  const halfH = height / 2;

  // 元素坐标 → 该点到边框的有符号距离（内部为负）
  const distanceAt = (px, py) =>
    roundedRectDistance(px, py, halfW, halfH, cornerRadius);

  const image = context.createImageData(gridWidth, gridHeight);
  const data = image.data;
  const raw = new Float32Array(gridWidth * gridHeight * 2);
  const eps = Math.max(1, minSide / 200); // 求梯度用的差分步长
  let maxScale = 1;

  for (let y = 0; y < gridHeight; y += 1) {
    for (let x = 0; x < gridWidth; x += 1) {
      const px = ((x + 0.5) / gridWidth - 0.5) * width;
      const py = ((y + 0.5) / gridHeight - 0.5) * height;

      const distance = distanceAt(px, py);
      const depth = -distance;                       // 距边框多深（内部为正）
      const t = Math.min(1, Math.max(0, depth / bezel));

      // 钟形轮廓：贴边 0 → 带中最大 → 带宽内侧 0
      const amount = Math.sin(Math.PI * t) * (depth > 0 && depth < bezel ? 1 : 0);

      // 边框法线（指向外侧）：SDF 的梯度
      const gx = (distanceAt(px + eps, py) - distanceAt(px - eps, py)) / (2 * eps);
      const gy = (distanceAt(px, py + eps) - distanceAt(px, py - eps)) / (2 * eps);
      const length = Math.hypot(gx, gy) || 1;

      // 朝内采样：位移向量与法线反向
      const dx = (-gx / length) * amount;
      const dy = (-gy / length) * amount;

      const index = (y * gridWidth + x) * 2;
      raw[index] = dx;
      raw[index + 1] = dy;
      maxScale = Math.max(maxScale, Math.abs(dx), Math.abs(dy));
    }
  }

  for (let i = 0; i < gridWidth * gridHeight; i += 1) {
    const offset = i * 4;
    data[offset] = Math.round((raw[i * 2] / maxScale) * 127 + 128);
    data[offset + 1] = Math.round((raw[i * 2 + 1] / maxScale) * 127 + 128);
    data[offset + 2] = 128; // 蓝通道不用
    data[offset + 3] = 255;
  }

  context.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * 给 root 里所有 [data-glass] 元素挂上折射。
 *
 * 结构约定（和 CSS 配套）：
 *   <div class="glass" data-glass>
 *     <span class="glass-warp"></span>   ← 滤镜加在这一层
 *     …内容…
 *   </div>
 *
 * @returns {() => void} 清理函数
 */
export function setupGlassRefraction(root, svg, { strengthRatio = 0.12 } = {}) {
  if (!root || !svg) return () => {};

  const targets = [...root.querySelectorAll("[data-glass]")];
  if (targets.length === 0) return () => {};

  let defs = svg.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    svg.appendChild(defs);
  }

  const created = [];
  let counter = 0;

  function build(element) {
    const warp = element.querySelector(".glass-warp");
    if (!warp) return;

    try {
      const { width, height } = element.getBoundingClientRect();
      if (width < 24 || height < 24) return;

      const href = createDisplacementMap(width, height);
      if (!href) return;

      // 位移幅度跟着面板大小走：小面板用小位移，长条/大面板才用大位移，
      // 上下限把它框住，免得小卡片被拉变形、大面板又看不出效果。
      const minSide = Math.min(width, height);
      const strength = Math.round(Math.min(40, Math.max(14, minSide * strengthRatio)));

      const id = `lg-refract-${(counter += 1)}`;
      const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
      // 滤镜区域要留出余量：位移会把像素推到元素框外，区域卡太死会出现硬边
      filter.setAttribute("id", id);
      filter.setAttribute("x", "-20%");
      filter.setAttribute("y", "-20%");
      filter.setAttribute("width", "140%");
      filter.setAttribute("height", "140%");
      filter.setAttribute("color-interpolation-filters", "sRGB");

      const image = document.createElementNS("http://www.w3.org/2000/svg", "feImage");
      image.setAttribute("href", href);
      image.setAttribute("x", "0");
      image.setAttribute("y", "0");
      image.setAttribute("width", "100%");
      image.setAttribute("height", "100%");
      image.setAttribute("preserveAspectRatio", "none"); // 拉伸到元素尺寸：位移图按归一化坐标算的
      image.setAttribute("result", "MAP");

      const displace = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "feDisplacementMap",
      );
      displace.setAttribute("in", "SourceGraphic");
      displace.setAttribute("in2", "MAP");
      displace.setAttribute("scale", String(strength));
      displace.setAttribute("xChannelSelector", "R");
      displace.setAttribute("yChannelSelector", "G");

      filter.appendChild(image);
      filter.appendChild(displace);
      defs.appendChild(filter);

      // 位移要挂在 backdrop-filter 上，和模糊写在同一条声明里：
      //   backdrop-filter: blur(2px) url(#位移图) saturate(180%)
      //
      // 这里做过对照实验（scripts/fixtures/glass-repro.html）：
      //   · backdrop-filter + url(位移图)  → 背景被真实扭曲 ✓
      //   · filter: url(位移图) 单独放在一层上 → 对背景毫无影响（差异 0.00）
      //     因为 filter 作用的是"元素自己画的东西"，不含 backdrop-filter 的结果。
      //   所以社区里"warp 层 + filter"的写法在这里不成立，别改回去。
      //
      // 不支持的浏览器会整条声明失效，回落到 CSS 里那层 blur(16px)：普通磨砂玻璃，不塌。
      const backdrop = `blur(2px) url(#${id}) saturate(180%)`;
      warp.style.backdropFilter = backdrop;
      warp.style.webkitBackdropFilter = backdrop;
      warp.style.filter = "";

      created.push({ element, warp, filter, id });
    } catch (error) {
      // 单个面板失败不影响其它面板，也不影响内容显示
      console.error("[glass] 折射层建立失败，该面板退回普通磨砂", error);
    }
  }

  targets.forEach(build);

  // 尺寸变了要重算位移图（图的坐标是相对元素尺寸的）
  let timer = null;
  const observer = new ResizeObserver(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      created.forEach(({ warp }) => {
        warp.style.filter = "";
        warp.style.backdropFilter = "";
        warp.style.webkitBackdropFilter = "";
      });
      created.splice(0).forEach(({ filter }) => filter.remove());
      counter = 0;
      targets.forEach(build);
    }, 180);
  });
  targets.forEach((element) => observer.observe(element));

  return () => {
    if (timer) clearTimeout(timer);
    observer.disconnect();
    created.forEach(({ warp, filter }) => {
      warp.style.filter = "";
      warp.style.backdropFilter = "";
      warp.style.webkitBackdropFilter = "";
      filter.remove();
    });
    created.length = 0;
  };
}
