// 液态玻璃的 SVG 滤镜容器。
//
// 滤镜不是写死的，而是**按每个面板的实际尺寸算出来的**：
// 位移图（feImage 用）+ feDisplacementMap 由 lib/glassRefraction.js 动态生成后塞进这个 <defs>。
// 所以这里只是一个空的、宽高为 0 但仍在渲染树里的容器
// —— 不能写 display:none，否则 filter 的引用会失效。
export default function GlassDefs({ ref }) {
  return <svg className="glass-defs" aria-hidden="true" focusable="false" ref={ref} />;
}
