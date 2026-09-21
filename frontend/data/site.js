// 网站里"不需要请求后端就能确定"的文案放这里。
//
// 判断标准是**首屏体验**，不是"技术上能不能从后端拿"：
//   · showcase 的标题、副标题：首页第一屏，必须在 HTML 里就有，
//     否则打开会先闪一下"加载中"——首屏为了省一次请求而闪一下，不划算。
//   · 技术栈面板、作品、座右铭：在首屏之下，晚几百毫秒没人在意，
//     所以它们走接口（/api/stack、/api/profile），改文案不用重新构建前端。
//
// 组件只管"怎么显示"，这里只管"显示什么"。

export const showcase = {
  eyebrow: "作品集",
  title: "你好，欢迎来到我的作品展示页",
  subtitle:
    "下面是我做这个站用到的技术栈。每一个面板都不是图标墙——里面写的是我拿它具体做了什么、以及为什么这么选。",
  scrollHint: "下滑看看",
  stackLead: "按「从页面到服务器」的顺序排：框架、UI、动画、接口、语言、存储、会话、代理、进程。",
  notesLead: "技术栈人人都会写；这里记的是我真实踩过的坑，以及当时怎么做的取舍。",
  workLead: "技术栈不是一个清单，是一个点得开的东西。",
  // 联系方式兜底：它属于导航性质，接口拿不到也必须显示
  contactFallback: {
    label: "想聊聊？",
    github: { label: "GitHub", href: "https://github.com/Carefreemoon1025" },
    email: { label: "noth1ngmoon@outlook.com", href: "mailto:noth1ngmoon@outlook.com" },
  },
  // 作品入口卡的兜底文案。
  // 这张卡是**导航**，不是"内容"：接口没返回或者挂了的时候它也必须在那儿，
  // 否则整个页面就没有通往文字实验室的路了（顶部导航已经去掉了）。
  // 接口正常时用后端返回的文案覆盖它。
  workFallback: {
    kicker: "作品",
    title: "文字实验室",
    copy: "拼音和情绪，挖掘中文里的细节",
    linkLabel: "打开作品",
  },
};

export const textLab = {
  heroTitle: "文字实验室",
  heroSubtitle: "拼音和情绪，挖掘中文里的细节",
};
