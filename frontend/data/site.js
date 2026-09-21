// 网站里"不需要请求后端就能确定"的文案放这里。
//
// 注意：主页的文案（heroTitle / featuredWork / identity…）**已经不在这里了**，
// 它归后端 `/api/profile` 管（见 backend/profile.py）。
// 这样改一句主页文案不用重新构建前端，也让"数据从后端来"在代码里看得见。
//
// 这里只留页面标题这类"跟着页面走、不值得为它单独发一次请求"的固定文案。
// 组件只管"怎么显示"，这里只管"显示什么"。

export const textLab = {
  heroTitle: "文字实验室",
  heroSubtitle: "拼音和情绪，挖掘中文里的细节",
};
