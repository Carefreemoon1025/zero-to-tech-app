// 全站共用的背景：浅蓝渐变 + 三团缓慢游动的光斑 + 一层极淡的纹理。
//
// 首页的液态玻璃需要它（玻璃必须"有东西可透"，折射也才有东西可折射）；
// 文字实验室页也用同一份，两个页面才像同一个网站，而不是两套皮。
// 它固定在视口上（position: fixed），所以页面滚动时背景不动，只跟着内容走。
export default function PageBackdrop() {
  return (
    <div className="page-backdrop" aria-hidden="true">
      <span className="blob blob-1" />
      <span className="blob blob-2" />
      <span className="blob blob-3" />
    </div>
  );
}
