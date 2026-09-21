"use client";

// 顶部导航条（品牌 + 两个页面入口）。跳页面全部交给 Next.js：
//   - <Link href="/...">      声明"点这里跳到那一页"（客户端路由，不整页刷新）
//   - usePathname()             读当前路径，用来高亮当前页
// 因为用到了 usePathname、要在浏览器里跑，所以顶上标了 "use client"。
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav() {
  const pathname = usePathname();
  const items = [
    { href: "/",         label: "作品展示" },
    { href: "/text-lab", label: "文字实验室" },
  ];

  return (
    <div className="hero-topline">
      <p className="brand-eyebrow">作品集</p>
      <nav className="inline-links hero-nav">
        {items.map((it) => {
          const active =
            it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={"nav-link" + (active ? " active" : "")}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
