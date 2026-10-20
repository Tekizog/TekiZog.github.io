---
title: 欢迎来到樱花街道
date: 2026-09-12
tags: 公告, 教程
category: 随笔
excerpt: 这是你的第一篇手记。写文章真的很简单：放一个 Markdown 文件到 posts 文件夹，跑一次构建，剩下的交给风。
---

# 欢迎来到樱花街道 🌸

这是你的第一篇手记。在这里写下你想记录的一切——代码、动漫、生活、情绪，都可以。

## 怎么写新文章

只要三步：

1. **新建文件**：在 `posts/` 文件夹里建一个 `.md` 文件
   （文件名建议用 `2026-09-12-文章名.md` 的格式）
   或者用命令一键创建：`python build.py --new 文章标题`
   想把图片和文章放一起？建一个文件夹 `posts/文章名/index.md` 也是一篇文章，
   图片放旁边，正文里用 `posts/文章名/图片.jpg` 引用
2. **写 Markdown**：用任意编辑器（VS Code、Typora 都行）写正文
3. **构建**：运行 `python build.py`，然后推送，GitHub Actions 会自动发布

## 文章开头的信息（front matter）

```markdown
---
title: 文章标题
date: 2026-09-12
tags: 随笔, 动漫
excerpt: 手动摘要（留空就不显示摘要）
cover: 图片链接（可选，文章页头图）
draft: false（可选，改成 true 就是草稿）
---

正文从分隔线下面开始写……
```

想先偷偷写着、还没想好发布的？front matter 里加一行 `draft: true`：
这篇文章就只在本地预览时显示（列表里带一个「草稿」标记），
推送部署后，线上的列表、RSS、甚至文章文件里都找不到它。

## 一点装饰

> 「我们仰望着同一片樱花，写着各自的故事。」

行内代码像这样 `python build.py`，链接像这样 → [GitHub Pages 文档](https://docs.github.com/pages)。

改站点名、签名、竖排日文这些，都在 `assets/config.js` 里，改完刷新就生效。

樱花会一直飘，故事会一直写。祝你在这条街住得开心 ✿
