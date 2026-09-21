// 配合 cdp-check.mjs 用：把页面上**真实渲染出来的每一个字**抓下来。
//
// 为什么需要它：subset-fonts.py 是静态扫源码的，只能"大致"知道页面会显示什么。
// 模板字符串拼出来的文案、后端数据里嵌套的字段、React 条件渲染出来的分支，
// 都可能漏网——而漏掉一个字的后果是那一处悄悄用上系统字体，和周围字形不是一套。
// 所以发布前拿真实页面兜一次底：
//
//   node scripts/cdp-check.mjs --url http://localhost:3000/ --eval-file scripts/page-text.js \
//     | python3 -c "import sys,json;print(json.loads(json.load(sys.stdin)['value'])['chars'],end='')" \
//     > /tmp/page-chars.txt
//   node scripts/cdp-check.mjs --url http://localhost:3000/text-lab --eval-file scripts/page-text.js \
//     | python3 -c "import sys,json;print(json.loads(json.load(sys.stdin)['value'])['chars'],end='')" \
//     >> /tmp/page-chars.txt
//   .venv/bin/python scripts/subset-fonts.py /tmp/page-chars.txt
//
// 注意：数据要到齐之后再抓（首页的卡片是接口回来后才有文案的），
// 所以下面显式等一下再取。
(async () => {
  // 等接口数据渲染完：首页的卡片骨架消失、或文字实验室的结果区出现
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const chars = new Set();
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      for (const ch of node.nodeValue) chars.add(ch);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    // script / style 里的字符不会渲染出来，别把源码打进子集
    if (node.matches("script, style")) return;
    node.childNodes.forEach(walk);
  };
  walk(document.body);

  // 表单控件的值（textarea 里的示例文本）也算页面上的字
  document.querySelectorAll("input, textarea").forEach((el) => {
    for (const ch of el.value ?? "") chars.add(ch);
    for (const ch of el.placeholder ?? "") chars.add(ch);
  });

  const list = [...chars].filter((c) => c.trim() !== "");
  return JSON.stringify({ count: list.length, chars: list.join("") });
})()
