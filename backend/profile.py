"""主页数据。

前端 `data/site.js` 里也有一份同样内容的 `home`，那是**打底数据**：
后端挂了或者请求失败时，主页仍然有内容可显示，不会白屏。
接口正常时以后端返回的为准。

两份数据放在一起看有点重复，但这是有意的：前端兜底解决"后端不可用"，
后端持有数据解决"内容随时可改、不用重新构建前端"。
"""

PROFILE = {
    "heroTitle": "关于我",
    "heroSubtitle": "项目，创意，灵感，心得，我的作品",
    "featuredWork": {
        "kicker": "作品",
        "title": "文字实验室",
        "copy": "拼音和情绪，挖掘中文里的细节",
        "linkLabel": "打开作品",
    },
    "identity": {
        "motto": "已识乾坤大，尤怜草木青",
        "learning": "零到全栈",
    },
    # 页尾的联系方式。放后端是因为它也是"内容"，
    # 但前端必须留一份兜底——联系方式属于导航，接口挂了也不能消失。
    "contact": {
        "label": "想聊聊？",
        "github": {"label": "GitHub", "href": "https://github.com/Carefreemoon1025"},
        "email": {"label": "noth1ngmoon@outlook.com", "href": "mailto:noth1ngmoon@outlook.com"},
    },
}
