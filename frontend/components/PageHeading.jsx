// 页面顶部的大标题 + 副标题。
// 纯展示、不带任何交互，所以是个服务端组件——顶上不用写 "use client"，
// 也就不会白送一份 JS 给浏览器。
export default function PageHeading({ title, subtitle }) {
  return (
    <div className="hero-copy">
      <h1 className="hero-display">{title}</h1>
      <p className="hero-subtitle">{subtitle}</p>
    </div>
  );
}
