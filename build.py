#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
樱花街道 · 构建脚本（纯 Python 标准库，无需安装任何依赖）

用法：
  python build.py                  生成 posts.json（文章索引）+ feed.xml（RSS）
  python build.py --dist           额外生成 dist/ 目录（部署到 GitHub Pages / 服务器用）
  python build.py --new 文章标题    新建一篇文章（示例：python build.py --new 我的第一篇文章）

写文章的流程：
  1. python build.py --new 文章标题   （或手动在 posts/ 里建一个 .md 文件）
  2. 用任意编辑器写 Markdown（front matter 里写 draft: true 即为草稿）
  3. python build.py  （GitHub Actions 部署的话这步可省略，推送后会自动构建）

文章形式（两种都支持）：
  单文件：posts/2026-09-12-文章名.md
  文件夹：posts/文章名/index.md（图片放文章旁边，正文里用 posts/文章名/图片.jpg 引用）

草稿规则：
  front matter 写 draft: true 的文章只在本地预览（python build.py）时可见；
  部署构建（python build.py --dist，GitHub Actions 用的就是它）会自动剔除——
  列表 posts.json、RSS feed.xml、dist/posts/ 里的正文文件都不会包含草稿。
"""
import datetime
import email.utils
import html
import json
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
POSTS_DIR = os.path.join(ROOT, "posts")
DIST_DIR = os.path.join(ROOT, "dist")


def read_config(key, default=""):
    """从 assets/config.js 里读一个字符串配置（保持单一配置来源）"""
    try:
        with open(os.path.join(ROOT, "assets", "config.js"), encoding="utf-8") as f:
            # 只取引号内的值，留空时不越过闭合引号去匹配后面的注释
            m = re.search(r'%s\s*:\s*(?:"([^"]*)"|\'([^\']*)\')' % key, f.read())
            if m:
                return m.group(1) if m.group(1) is not None else m.group(2)
    except OSError:
        pass
    return default


def site_url():
    """站点的绝对地址：优先 config.siteUrl，其次从 GitHub Actions 环境推断。
    用于把 og:image 这类必须是绝对地址的元信息补全。"""
    url = read_config("siteUrl")
    if url:
        return url if url.endswith("/") else url + "/"
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    if "/" in repo:
        owner, name = repo.split("/", 1)
        if name.lower() == (owner + ".github.io").lower():
            return "https://%s.github.io/" % owner
        return "https://%s.github.io/%s/" % (owner, name)
    return ""


def parse_front_matter(text):
    fm, body = {}, text
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n?", text, re.S)
    if m:
        for line in m.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                fm[k.strip().lower()] = v.strip().strip('"').strip("'")
        body = text[m.end():]
    return fm, body


def plain_text(md):
    """粗略去掉 Markdown 语法，用于摘要与字数统计"""
    md = re.sub(r"```[\s\S]*?```", " ", md)
    md = re.sub(r"`[^`\n]*`", " ", md)
    md = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", md)
    md = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", md)
    md = re.sub(r"[#>*_~|`]+", " ", md)
    return re.sub(r"\s+", " ", md).strip()


def make_post(fname):
    stem = fname[:-3] if fname.lower().endswith(".md") else fname
    with open(os.path.join(POSTS_DIR, fname), encoding="utf-8") as f:
        raw = f.read()
    fm, body = parse_front_matter(raw)

    title = fm.get("title") or next(
        (l[2:].strip() for l in body.splitlines() if l.startswith("# ")), stem)

    date = fm.get("date")
    if not date:
        m = re.match(r"(\d{4}-\d{2}-\d{2})", stem)
        date = m.group(1) if m else datetime.date.today().isoformat()

    tags = [t.strip() for t in re.split(r"[,，]", fm.get("tags", "")) if t.strip()]

    text = plain_text(body)
    excerpt = fm.get("excerpt", "")
    minutes = max(1, round(len(text) / 400)) or 1

    post = {"slug": stem, "title": title, "date": date, "tags": tags,
            "category": fm.get("category", "").strip().strip('"').strip("'"),
            "excerpt": excerpt, "minutes": minutes}
    if fm.get("draft", "").strip().lower() in ("true", "yes", "1", "是"):
        post["draft"] = True
    return post


def find_post_files():
    """posts/ 下的全部文章：顶层 *.md + 子文件夹里的（如 文章名/index.md）。
    返回相对 posts/ 的路径（正斜杠），slug 即去掉 .md 的相对路径。"""
    found = []
    for root, dirs, files in os.walk(POSTS_DIR):
        dirs[:] = sorted(d for d in dirs if not d.startswith((".", "_")))
        for f in sorted(files):
            if f.lower().endswith(".md") and not f.startswith((".", "_")):
                rel = os.path.relpath(os.path.join(root, f), POSTS_DIR)
                found.append(rel.replace(os.sep, "/"))
    return sorted(found)


_CN_DIGIT = {"零": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5,
             "六": 6, "七": 7, "八": 8, "九": 9, "十": 10}


def natural_key(text):
    """把文件名里的阿拉伯数字与中文数字都当数字来比大小。

    同一天发多篇时，原来只按日期排（Python 稳定排序，保留文件名的字母序），
    而中文数字的 Unicode 码位是 一(U+4E00) < 三(U+4E09) < 二(U+4E8C)，
    于是「写作指南 一/二/三」会排成 一/三/二。这里把数字统一成数值再比。
    """
    key, buf = [], ""
    for ch in text:
        if ch.isdigit():
            buf += ch
            continue
        if buf:
            key.append((1, int(buf), ""))
            buf = ""
        if ch in _CN_DIGIT:
            key.append((1, _CN_DIGIT[ch], ""))
        else:
            key.append((0, 0, ch))
    if buf:
        key.append((1, int(buf), ""))
    return key


def build(include_drafts=False):
    """生成 posts.json + feed.xml。

    include_drafts=True（本地预览）时草稿也写入 posts.json（带 draft 标记）；
    False（部署构建）时草稿完全不出现。返回值始终是全部文章（含草稿），
    供 make_dist 排除草稿的正文文件。
    """
    if not os.path.isdir(POSTS_DIR):
        os.makedirs(POSTS_DIR, exist_ok=True)
    files = find_post_files()
    posts = [make_post(f) for f in files]
    # 先按文件名自然序（同一天的多篇按 一/二/三 排），再按日期倒序；
    # Python 的排序是稳定的，第二次排序不会打乱同一天内部的顺序
    posts.sort(key=lambda p: natural_key(p["slug"]))
    posts.sort(key=lambda p: p["date"], reverse=True)

    public = posts if include_drafts else [p for p in posts if not p.get("draft")]

    with open(os.path.join(ROOT, "posts.json"), "w", encoding="utf-8") as f:
        json.dump({
            "updated": datetime.datetime.now().isoformat(timespec="seconds"),
            "posts": public,
        }, f, ensure_ascii=False, indent=2)
        f.write("\n")

    write_feed(public)
    msg = "✅ 已生成 posts.json（%d 篇文章）和 feed.xml" % len(public)
    if len(public) < len(posts):
        msg += "（%d 篇草稿仅在本地可见，未包含）" % (len(posts) - len(public))
    print(msg)
    return posts


def write_feed(posts):
    base = read_config("siteUrl")
    site = read_config("siteName", "樱花街道")
    desc = read_config("tagline", "个人博客")
    items = []
    for p in posts[:20]:
        link = "%spost.html?p=%s" % (base, p["slug"])
        pub = email.utils.format_datetime(
            datetime.datetime.fromisoformat(p["date"] + "T12:00:00"))
        items.append(
            "<item><title>%s</title><link>%s</link><guid>%s</guid>"
            "<pubDate>%s</pubDate><description>%s</description></item>"
            % (html.escape(p["title"]), html.escape(link), html.escape(link),
               pub, html.escape(p["excerpt"])))
    rss = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0"><channel>'
        "<title>%s</title><link>%s</link><description>%s</description>%s"
        "</channel></rss>\n"
    ) % (html.escape(site), html.escape(base), html.escape(desc), "".join(items))
    with open(os.path.join(ROOT, "feed.xml"), "w", encoding="utf-8") as f:
        f.write(rss)


def new_post(title):
    today = datetime.date.today().isoformat()
    safe = re.sub(r'[\\/:*?"<>|#]', "", title).strip().replace(" ", "-") or "untitled"
    fname = "%s-%s.md" % (today, safe)
    path = os.path.join(POSTS_DIR, fname)
    if os.path.exists(path):
        print("⚠️  文章已存在：posts/" + fname)
        return
    template = (
        "---\n"
        "title: %s\n"
        "date: %s\n"
        "excerpt: \n"
        "cover: \n"
        "draft: false\n"
        "---\n\n"
        "# %s\n\n"
        "> 小提示：front matter 里的字段都可以留空或删除；\n"
        "> excerpt 留空就不显示摘要；draft 改成 true 就是草稿，\n"
        "> 只在本地预览可见，部署到线上时会自动隐藏。\n" % (title, today, title)
    )
    with open(path, "w", encoding="utf-8") as f:
        f.write(template)
    print("🌸 已创建 posts/" + fname)
    print("   写完后运行：python build.py")


def make_dist(posts):
    """组装 dist/：只包含部署需要的文件（自动排除源视频、构建脚本、草稿正文等）"""
    draft_files = {p["slug"] + ".md" for p in posts if p.get("draft")}
    posts_dir = os.path.abspath(POSTS_DIR)

    def ignore_junk_and_drafts(folder, names):
        skip = {".DS_Store", "Thumbs.db"} & set(names)
        if draft_files:
            # folder 可能是 posts/ 本身或其子文件夹，拼出相对路径再比对
            base = os.path.relpath(folder, posts_dir).replace(os.sep, "/")
            base = "" if base == "." else base + "/"
            skip |= {n for n in names if base + n in draft_files}
        return skip

    if os.path.isdir(DIST_DIR):
        shutil.rmtree(DIST_DIR)
    os.makedirs(DIST_DIR)

    for name in ["index.html", "post.html", "404.html",
                 "posts.json", "feed.xml", ".nojekyll", "CNAME"]:
        src = os.path.join(ROOT, name)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(DIST_DIR, name))

    for folder in ["assets", "posts"]:
        shutil.copytree(os.path.join(ROOT, folder),
                        os.path.join(DIST_DIR, folder),
                        ignore=ignore_junk_and_drafts)

    # og:image 必须是绝对地址，社交平台才会去抓图；本地构建没有域名就保持相对路径
    base = site_url()
    if base:
        for name in ["index.html", "post.html"]:
            path = os.path.join(DIST_DIR, name)
            if not os.path.exists(path):
                continue
            with open(path, encoding="utf-8") as f:
                text = f.read()
            text = text.replace('content="assets/img/poster.jpg"',
                                'content="%sassets/img/poster.jpg"' % base)
            with open(path, "w", encoding="utf-8") as f:
                f.write(text)
        print("🔗 og:image 已补全为绝对地址（%s）" % base)

    size = sum(os.path.getsize(os.path.join(dp, f))
               for dp, _, fs in os.walk(DIST_DIR) for f in fs)
    print("📦 已生成 dist/（%.1f MB），整个目录可部署到任何静态空间" % (size / 1048576))


def main():
    args = sys.argv[1:]
    if "--new" in args:
        i = args.index("--new")
        title = args[i + 1] if i + 1 < len(args) else ""
        if not title:
            print('用法：python build.py --new "文章标题"')
            return
        new_post(title)
        return
    # 本地预览（python build.py）包含草稿；部署构建（python build.py --dist，
    # GitHub Actions 用的就是它）剔除草稿
    posts = build(include_drafts="--dist" not in args)
    if "--dist" in args:
        make_dist(posts)


if __name__ == "__main__":
    main()
