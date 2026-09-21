"""展示页的技术栈面板数据。

为什么放在后端而不是前端写死：
这些面板是"内容"，不是"布局"。放在后端，改一句话不用重新构建前端；
而且正好把"前端从后端取数"这件事在首页就演示出来——面试官打开的第一屏就是活的。

字段说明：
    key     唯一标识（前端做 React key）
    badge   卡片左上角的缩写标记
    name    技术名
    tag     一句话分类
    blurb   我拿它做了什么（这才是面板的价值，不是图标墙）
    chips   项目里的具体落点，2~3 个
    accent  该卡片玻璃的着色（前端拿它做 CSS 变量）
"""

STACK = [
    {
        "key": "next",
        "badge": "Next",
        "name": "Next.js 15",
        "tag": "前端框架 · App Router",
        "blurb": "文件夹就是路由：/ 和 /text-lab 各是一个目录，不用注册路由表。"
                 "纯展示组件留在服务端渲染，不必给浏览器多发一份 JS。",
        "chips": ["文件即路由", "服务端组件", "生产构建"],
        "accent": "#0071e3",
    },
    {
        "key": "react",
        "badge": "React",
        "name": "React 19",
        "tag": "UI 与状态",
        "blurb": "受控表单、状态、副作用都收在组件里。加载中 / 成功 / 失败 / 空数据"
                 "四种状态在界面上都有明确表现，不用打底数据把问题盖过去。",
        "chips": ["useState / useEffect", "受控组件", "错误边界文案"],
        "accent": "#61dafb",
    },
    {
        "key": "anime",
        "badge": "anime",
        "name": "anime.js 4",
        "tag": "动画引擎",
        "blurb": "卡片入场、分数滚动，以及这一页的滚动驱动浮现。数字动画只让它算数值、"
                 "由 React 渲染 DOM——两边抢同一块 DOM 已经坑过我一次。",
        "chips": ["onScroll", "stagger", "数值动画"],
        "accent": "#ff4fa3",
    },
    {
        "key": "fastapi",
        "badge": "API",
        "name": "FastAPI",
        "tag": "后端框架",
        "blurb": "三个接口用 Pydantic 声明请求体，顺手得到 /docs 交互式文档。"
                 "错误统一成 {\"detail\": \"...\"} 的字符串，前端可以直接当文案显示。",
        "chips": ["REST 接口", "Pydantic 校验", "自动文档"],
        "accent": "#009688",
    },
    {
        "key": "python",
        "badge": "Py",
        "name": "Python 3.14",
        "tag": "语言 · 文本处理",
        "blurb": "拼音用 pypinyin 转写成带声调的音节；情感判断是自己写的可解释规则："
                 "命中词加权、否定词反转、单向上限 0.45，分值能说清是哪几个词贡献的。",
        "chips": ["pypinyin 拼音", "关键词打分", "doctest 自测"],
        "accent": "#ffd43b",
    },
    {
        "key": "sqlite",
        "badge": "SQL",
        "name": "SQLite",
        "tag": "存储",
        "blurb": "一张表、两个查询，所以直接用标准库 sqlite3，不为了「规范」再套一层 ORM。"
                 "时间一律存 UTC，显示的时候才转本地时区。",
        "chips": ["标准库零依赖", "会话索引", "UTC 存储"],
        "accent": "#4c8bf5",
    },
    {
        "key": "cookie",
        "badge": "SID",
        "name": "Cookie 会话",
        "tag": "会话隔离",
        "blurb": "后端下发 HttpOnly cookie 作为访客标识，历史记录按 session_id 过滤："
                 "数据库只有一份，但每个访客打开都只看到自己的那几条。",
        "chips": ["HttpOnly", "SameSite=Lax", "按访客隔离"],
        "accent": "#a259ff",
    },
    {
        "key": "nginx",
        "badge": "nginx",
        "name": "nginx",
        "tag": "反向代理",
        "blurb": "/api 转给 8000、其余转给 3000，让前端和接口同源，跨源问题从根上消失；"
                 "顺手把 /.git、/.env 这类扫描挡成 403。",
        "chips": ["路径分流", "同源免 CORS", "隐藏文件 403"],
        "accent": "#269539",
    },
    {
        "key": "systemd",
        "badge": "systemd",
        "name": "systemd",
        "tag": "进程与部署",
        "blurb": "前后端各一个服务，开机自启、崩了自动拉起，日志进 journald。"
                 "部署是一条命令：同步代码、远端构建、重启、再自己验一遍。",
        "chips": ["开机自启", "Restart=always", "一键部署脚本"],
        "accent": "#e8710a",
    },
]
