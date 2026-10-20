# 🌸 樱花街道 · Sakura Street

一个二次元风格的静态博客主题：樱花街道视频背景、日夜双主题、飘落花瓣、Markdown 写作，
**纯静态、零依赖，可直接托管在 GitHub Pages，也可以放到任何服务器**。

![主题](assets/img/poster.jpg)

## ✨ 特性

- **🎬 全站固定动态背景** —— 樱花街道视频作为全屏固定背景，任何页面、任何滚动位置都在；原片 94MB 已压缩为 1.5MB / 4.7MB 双版本
- **🌙 昼樱 / 夜樱 双主题** —— 一键切换，跟随系统、记忆偏好
- **🌸 樱花飘落粒子** —— canvas 绘制，后台标签页自动暂停省电
- **✍️ Markdown 写作** —— 放一个 `.md` 文件就是一篇文章
- **📝 草稿** —— front matter 里 `draft: true`，本地预览可见（带「草稿」标记），部署时自动隐藏
- **⚡ 极致丝滑** —— 无框架纯 vanilla JS，懒加载视频、滚动浮现、跨文档视图过渡
- **📱 智能省流** —— 手机 / 省流量模式 / 弱网访客只显示海报图（272KB），不加载视频
- **🔎 标签筛选 + 全文搜索**、**RSS 订阅**、**阅读进度条**、**目录（TOC）**、**上一篇/下一篇**

## 📁 目录结构

```
├── index.html          首页
├── post.html           文章页（?p=文章文件名）
├── 404.html            404 页面
├── posts/              ★ 你的文章（Markdown）
├── posts.json          文章索引（build.py 自动生成，别手改）
├── feed.xml            RSS（build.py 自动生成）
├── build.py            构建脚本
├── assets/
│   ├── config.js       ★ 站点配置（站名、签名、关于我、视频等）
│   ├── css/style.css   主题样式
│   ├── js/             交互脚本 + Markdown 渲染库
│   ├── img/poster.jpg  视频海报图（也是手机端背景）
│   └── video/          压缩后的背景视频
└── .github/workflows/  GitHub Actions 自动部署
```

## ✍️ 写文章

```bash
# 方式一：命令一键创建
python build.py --new 我的第一篇文章

# 方式二：手动在 posts/ 下新建 2026-09-12-文章名.md
```

两种文章形式都支持：

- **单文件**：`posts/2026-09-12-文章名.md`
- **文件夹**：`posts/文章名/index.md`——图片放文章旁边，正文里用 `posts/文章名/图片.jpg` 引用

文件开头写信息头，下面用 Markdown 写正文：

```markdown
---
title: 文章标题
date: 2026-09-12
tags: 随笔, 动漫
excerpt: 摘要（留空就不显示摘要）
cover: 头图链接（可选）
draft: false（可选，改成 true 即为草稿）
---

正文……
```

写完后：

- **本地预览**：`python build.py`，然后在博客目录运行 `python -m http.server 8000`，
  浏览器打开 `http://localhost:8000`
- **发布**：git 推送即可（见下文，推送后全自动）

> 📝 **草稿**：front matter 里 `draft: true` 的文章只在本地预览时显示，列表里带「草稿」标记；
> 部署构建（`python build.py --dist`，GitHub Actions 用的就是这条命令）会自动剔除草稿——
> 线上的文章列表、RSS 和 `dist/posts/` 里的正文文件都不会包含它，访客无法通过 URL 访问到。

> ⚠️ 预览必须通过 HTTP 服务访问（不要直接双击 HTML），否则浏览器安全策略不允许读取文章文件。

## 🚀 部署到 GitHub Pages（推荐，全自动）

1. 在 GitHub 建一个仓库，把本目录推送上去（`git init && git add -A && git commit -m "init" && git push`）。
   仓库设置里确认 `.gitignore` 生效，**94MB 原视频不会被上传**（单文件超 100MB 会被 GitHub 拒收）。
2. 打开仓库 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**。
3. 完成。以后每次 `git push`，Actions 会自动构建并发布，访问地址形如
   `https://你的用户名.github.io/仓库名/`
4. 部署完成后，把 `assets/config.js` 里的 `siteUrl` 改成你的完整地址（用于 RSS 订阅），
   再推送一次即可。

> 子路径部署（如 `blog/` 仓库名）无需任何修改，站内全部使用相对路径。

## 🖥️ 部署到自己的服务器

把 `dist/` 目录里的内容上传到任意静态目录即可（或整个目录直接当静态站用）：

```bash
python build.py --dist
# 然后把 dist/ 里的所有文件上传服务器，nginx 示例：
# server { root /var/www/sakura; index index.html; error_page 404 /404.html; }
```

**服务器带宽好的话，还可以把 4K 原片放上去当背景**：把原视频放到服务器某个路径，
然后修改 `assets/config.js` 中 `video.hd` 指向它（比如 `"https://你的域名/media/sakura-4k.mp4"`），
低配的 `sd` 版本保持不变，系统会按访客网速自动选择。

## 🎬 背景视频是怎么优化的

原片 `日漫的樱花街道.mp4` 为 4K 60fps 高码率（94MB），本主题做了三层优化：

| 层级 | 内容 | 大小 | 谁会加载 |
| ---- | ---- | ---- | -------- |
| 海报图 | 视频截帧 JPEG | 272 KB | 所有人（首屏立刻显示） |
| 标准版 | 720p 30fps 无音轨 H.264 | 1.5 MB | 弱网 / 3G 以下之外都可作为兜底 |
| 高清版 | 1080p 30fps 无音轨 H.264 | 4.7 MB | 网络良好（4G 及以上）的桌面端 |

加载策略：背景层全站固定（`position: fixed`），海报图永远显示（任何设备、任何网络的第一层背景）→
页面空闲后（不阻塞首屏）才请求视频 → 缓冲完成淡入。
**手机、省流量、2G 及以下、系统开启"减少动态效果"的访客只显示海报图**，
3G 弱网自动改用 1.5MB 标准版，4G/WiFi 桌面端加载 1080p 高清版。
视频无音轨（浏览器本来就不允许有声自动播放），`faststart` 保证边下边播。
首页是"封面 + 手记"两段式：在封面上**按住左键向上拖拽**即可进入手记（也可以点"开始阅读"或正常滚轮下滚）；
在手记区向上滚轮最多到边界为止，**只有点击导航「首页」才能回到封面**。
背景上覆盖了一层昼夜主题的渐变纱罩（`--bg-veil`），顶部轻透、底部加重，保证文章可读。

想自己重新压缩（比如换视频）：

```bash
ffmpeg -i 原片.mp4 -an -vf "scale=1920:-2,fps=30" -c:v libx264 -crf 28 -preset medium -pix_fmt yuv420p -movflags +faststart assets/video/bg-hd.mp4
ffmpeg -i 原片.mp4 -an -vf "scale=1280:-2,fps=30" -c:v libx264 -crf 30 -preset slow  -pix_fmt yuv420p -movflags +faststart assets/video/bg.mp4
ffmpeg -ss 5 -i 原片.mp4 -frames:v 1 -vf "scale=1600:-2" -q:v 4 assets/img/poster.jpg
```

## 🎨 个性化

全都在 `assets/config.js`：站名、日文装饰、签名、竖排日文、关于我、GitHub 链接、
樱花密度（`petals.max`）、视频开关。改完刷新即生效。

想换配色 / 字体 / 圆角，去 `assets/css/style.css` 最上面的 `:root` 和 `[data-theme="night"]` 改 CSS 变量。

## ❓ 常见问题

- **文章列表读不出来？** 先跑 `python build.py` 生成 `posts.json`，并确认通过 HTTP 访问。
- **想加评论？** 推荐 [giscus](https://giscus.app)（基于 GitHub Discussions），把生成的代码贴到 `post.html` 的 `.post-foot` 之前。
- **绑定自定义域名？** 在根目录建一个 `CNAME` 文件写入域名，并在 DNS 加 CNAME 记录；
  `build.py --dist` 会自动把它带进 dist/。

---

愿这条街的樱花一直飘 🌸
