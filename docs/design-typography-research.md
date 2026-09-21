# 液态玻璃卡片 + 中文 Web 排版 调研清单

来源：[Apple HIG Materials](https://developer.apple.com/design/human-interface-guidelines/materials) ｜ [Apple Newsroom Liquid Glass](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/) ｜ [Josh Comeau: backdrop-filter](https://www.joshwcomeau.com/css/backdrop-filter/) ｜ [CSS-Tricks: Liquid Glass](https://css-tricks.com/getting-clarity-on-apples-liquid-glass/) ｜ [Chrome: CSS i18n features](https://developer.chrome.com/blog/css-i18n-features) ｜ [MDN text-spacing-trim](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-spacing-trim) ｜ [MDN text-autospace](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-autospace) ｜ [W3C clreq 中文排版需求](https://www.w3.org/TR/clreq/) ｜ [Squircle.js: corner-shape](https://squircle.js.org/blog/squircles-in-css) ｜ [Chrome: text-wrap balance](https://developer.chrome.com/docs/css-ui/css-text-wrap-balance)

> 前置结论：Apple 把玻璃拆成 **highlight / shadow / illumination** 三层；HIG 明确「**不要在 content layer 用 Liquid Glass，且效果要克制**」。卡片应做成"标准材质"（regular，不是 clear）。

---

## 第一部分：卡片艺术 / 玻璃质感

### 1. 玻璃厚度的七个笔触

**做法**：一次叠完：渐变底色 → backdrop-filter → 1px 亮边 → 内阴影 → 三层投影 → 噪点。

```css
.card{
  position:relative;
  background:linear-gradient(160deg,rgba(255,255,255,.16),rgba(255,255,255,.07));
  backdrop-filter:blur(16px) saturate(160%) brightness(106%);
  border-radius:24px;
  box-shadow:
    0 1px 2px rgba(9,30,66,.06),            /* 贴地 */
    0 10px 24px -10px rgba(9,30,66,.14),    /* 中景 */
    0 32px 56px -28px rgba(9,30,66,.20),    /* 远景 */
    inset 0 1px 0 rgba(255,255,255,.55),    /* 顶边高光 */
    inset 0 -10px 20px -14px rgba(9,30,66,.18); /* 底部内阴影=厚度 */
}
```

| 笔触 | 推荐区间 |
|---|---|
| 底色 alpha | 0.06–0.18（**≤0.22**）；深底改白 .08–.14 |
| blur | 12–24px；卡片短边 <320px 取 8–14px，且 ≤短边/6 |
| saturate | 140%–180% |
| brightness | 104%–112%（深底 96–100%） |
| 1px 亮边 | 上/左 .35–.55，下/右 .08–.15（**用渐变，不要纯色**） |
| 内阴影 | blur 12–24px + 负 spread 抵消外溢 |
| 投影分层 | 三层 alpha 约 .06 / .14 / .20 |
| 噪点 | SVG `feTurbulence`，opacity .02–.04（消 8-bit 色带） |

**支持/回退**：`backdrop-filter` Baseline 2024、>97%，Safari 需 `-webkit-` 前缀。回退用 `@supports not (backdrop-filter:blur(1px))` 把底色提到 alpha .92。
**优先级：高**

### 2. 五个「磨砂白板 / 塑料片」坑

1. **底色过白** alpha ≥0.25 → 背景光斑被吃掉，只剩灰板。压到 ≤0.18。
2. **模糊过大** blur ≥32px → 背景结构消失成灰雾；超短边 1/6 时边缘"漏光"。
3. **缺环境色**：只 blur 不 saturate，或没有环境反射 → 灰。加 `saturate(140–180%)` + 一层品牌色 `radial-gradient(...,rgba(品牌色,.06–.10),transparent)`。
4. **多层 backdrop-filter 嵌套**：每层新建 backdrop root，后代丢失外层背景且性能 ×N。同屏此类元素 ≤5 个；边缘厚度用 Josh Comeau 的 mask 技巧（子层 `blur(8px) brightness(120%)` + 负 inset），不要靠再套一层卡片。
5. **纯色 1px border** 是塑料感元凶 → 换渐变亮边（见第 4 条）。
**优先级：高（1–3）、中（4–5）**

### 3. 卡内排版层级

字号阶梯（基准正文 15–16px，1.25 模数）：kicker 11–12 / 标题 20–24 / 正文 14–15 / 标签 11–12。
字重（可变字体有 wght 100–900）：kicker 600 / 标题 650–700 / 正文 400 / 标签 500。
字距：kicker **+0.06～+0.10em**（中文小字必须加正字距）/ 标题 0～−0.01em / 正文 0 / 标签 +0.02em。
不透明度阶梯（同色系靠 alpha 分层）：标题 1.0 › 正文 .72–.78 › 标签 .70 › 次要说明 .58–.62 › 分隔线 .10–.14。
行高：kicker 1.2 / 标题 1.25–1.35 / 正文 **1.7–1.85** / 标签 1.2。
**优先级：高**

### 4. 圆角与边框

半径 ≈ 短边 × 0.06–0.10，且 ≥12px：小卡（高 <160px）12–16 / 常规卡 20–28 / 大容器 28–36。

**squircle**：`corner-shape:squircle`（=`superellipse(2)`）仅 **Chrome 139+**，Safari/Firefox 未支持，2026-06 约 65% 覆盖，需 `@supports` 分支否则两端不一致。**建议不用**，统一 `round`。

**1px 边框在圆角处的瑕疵**：`border` 是被圆角裁剪的直线段，弧上会变细甚至断线。改用 mask 渐变亮边：

```css
.card::before{
  content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;
  background:linear-gradient(145deg,rgba(255,255,255,.55),rgba(255,255,255,.06) 40%,rgba(255,255,255,.22));
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  -webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;
}
```
**优先级：高（半径比例、mask 亮边）、低（squircle）**

### 5. 装饰元素取舍

**加分**：① 渐变亮边（= Apple 的 highlight 层）② **单个**角落品牌色光晕 `radial-gradient(circle at 88% -10%,rgba(品牌色,.14),transparent 60%)` ③ 序号 01/02（配 tabular 数字）④ 图标徽章（32–40px，自身圆角 10–12px + 半透明底）。
**噪音**：多重渐变边框 + 外发光同时上、四角都加光晕、彩色投影、hover 位移 >4px、装饰性中文大字水印（与正文抢层级）。
**优先级：高（①②）、中（③④）、其余删除**

---

## 第二部分：中文排版细节

### 1. text-spacing-trim / palt / halt / kern

**做法**：标点挤压用 `text-spacing-trim`，**仅 Chrome 123+**（Firefox/Safari 均无）；回退到 OpenType。

```css
.cjk{text-spacing-trim:space-first}      /* normal|space-all|space-first|trim-start */
@supports not (text-spacing-trim:space-first){
  .cjk{font-feature-settings:"palt" 1}   /* 比例宽度，最接近印刷挤压 */
}
```
`palt` = 按字形实际宽度压缩（温和）；`halt` = 一律压到半字宽（激进）；`kern` 默认开启，中文无需手写。`trim-both`/`trim-all`/`auto` 值**无任何浏览器实现**。

**实测本站字体** `frontend/app/fonts/noto-sans-sc-var.woff2`（804 字形）：子集后仍保留 GPOS 的 `halt`(36 字形) / `palt`(40 字形) / `kern`(63)，覆盖 `。，、；：）」』】》` 等；`。` 默认 advance = 1000/1000（整字宽）→ 挤压确有必要，**回退可用**。（MDN 要求字体具备 `halt` 或 `chws`，本站无 `chws`，靠 `halt` 满足。）
**优先级：高（回退分支）、中（text-spacing-trim 本身）**

### 2. 中西文混排间距

`text-autospace` 已主流：Chrome 140+ / Safari 18.4+ / Firefox 145+。clreq 规定汉字与西文间空隙 **≤1/4 字宽**。

```css
.cjk{text-autospace:normal}   /* = ideograph-alpha + ideograph-numeric */
```
**不要用全角空格 U+3000**：它宽 1em，是规定上限的 4 倍，不可断行、复制后污染数据、在非中文环境排版崩坏。手工补空隙若必须，用 U+2009 thin space，别用普通空格（换行处会多出头）。
**优先级：高**

### 3. 中文标点

- **引号**：大陆横排用弯引号 `""''`；港澳台用直角引号 `「」『』`（大陆竖排也用直角）。同一页面不要混用。
- **破折号** `——` 占两字宽，不是两个连字符；**省略号** `……` 六点，用单个 `…`。
- **顿号 vs 逗号**（GB/T 15834—2011 §4.4/4.5）：`、` 只连并列词语；并列短语/分句用 `，`。标有引号或书名号的并列成分之间通常**不加顿号**。
- **数字与单位**：**要加空隙** —— 240 KB、1.7 GB（GB 3101：数值与单位符号间留一空隙）；例外：`60°`、`37°C`、`86%` 紧排。`0.86` 是纯数字，无需处理。
**优先级：高（引号、顿号）、中（数字单位）**

### 4. 行高与字距

- 中文正文 `line-height` **1.7–1.85**（西文惯用 1.5 偏低）；标题 1.25–1.35；小字 1.5。
- `letter-spacing` **不要用负值**：中文是满框字形，负值直接让笔画相碰，高 DPI / iOS Safari 上渲染错位。正文与标题取 **0**；小字需要透气时用 +0.02～0.06em。
- 大标题（clamp 到 50px+）：字距 **0 或 +0.01em**；真正要调的是 `line-height: 1.15–1.25` 和 `font-weight: 600`（超大字号降字重，避免笔画糊成一团）。
- `text-wrap:balance` **只对 ≤6 行生效**（Chrome 114 / Firefox 121 / Safari 17.5，全支持）；也**不会改变元素宽度**，卡片内标题仍会留白。`text-wrap:pretty` 仅 Chrome 117+ / Safari 26，Firefox 无；中文按字符断行，收益有限。

```css
h1,h2{text-wrap:balance;line-height:1.2;letter-spacing:0}
p{text-wrap:pretty;line-height:1.8}
```
**优先级：高（行高、禁负字距、标题 balance）**

### 5. 数字排版

**必须 tabular-nums**：分数滚动/计数器动画、时间戳、版本号、表格、`score`(0.86)。**用比例数字**：正文里偶然出现的数字、超大展示数字（更匀称）。

```css
.tnum{font-variant-numeric:tabular-nums lining-nums}
```

**实测本站字体**：子集后的 Noto Sans SC 数字 0–9 advance **全为 521/1000**，但 GPOS 里**没有 `tnum`/`pnum`**（只有 halt/kern/palt）→ `tabular-nums` 在此字体上是 **no-op**；好在数字本就等宽，计数器不会抖。**真正的风险**是数字落到系统回退字体（-apple-system/Segoe 为比例数字）→ 用 `@font-face` 的 `unicode-range` 覆盖 U+0030–0039、并把 `"Noto Sans SC"` 置于 font-family 首位。
**优先级：高（分数滚动 + 数字不落回退字体）**

### 6. 大标题翻车点

- **孤字**（末行仅 1 字，clreq §7.1.2）：CSS 无直接解法。靠 `text-wrap:balance`（≤6 行，显著降低概率）+ 人工调 `max-width` / `<wbr>`。clreq 的规范做法是「由前一行取一字至末行，前一行均排」，Web 上手工处理即可。
- **标点禁则**：浏览器**默认已做基本避头尾**（`line-break:auto` 内置）。**千万别写 `word-break:break-all`**，它会破坏禁则让 `。、` 跑到行首。中文用 `word-break:normal` + `line-break:strict` 收紧；`overflow-wrap:anywhere` 只给输入框兜底。
- **行尾点号悬挂**：`hanging-punctuation:allow-end` 仅 Safari 10+（`force-end` 16.4+，属性完整支持到 Safari 26.5；Chrome/Firefox 全无）。clreq §6.1.3 也指出简体中文少见 → **不依赖**。
- **中文输入框**（本站文字实验室）：必须显式 `line-break:strict; word-break:normal; overflow-wrap:anywhere`，否则用户粘贴的连续西文/URL 会溢出卡片。

```css
:where(h1,h2,h3,.card-title){text-wrap:balance;line-break:strict;word-break:normal;overflow-wrap:anywhere}
```
**优先级：高（word-break:normal + line-break:strict）、中（balance）、低（hanging-punctuation）**
