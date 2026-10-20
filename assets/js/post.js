/* ==========================================================
   樱花街道 · 文章页逻辑
   Markdown 渲染 / 目录 / 上一篇下一篇 / 阅读进度 / 复制链接
   ========================================================== */
(function () {
  "use strict";

  var C = window.SAKURA_CONFIG || {};
  var localPreview = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var contentCache = localPreview ? "no-cache" : "default";
  var params = new URLSearchParams(location.search);
  /* 文件夹式文章的 slug 形如 文章名/index，允许 /；
     另放行点号、括号、空格（导入文章常见的文件名），但任何一段不能是 ..（防路径穿越） */
  var slug = (params.get("p") || "").replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5\/.()\[\] ]/g, "");
  if (/(^|\/)\.\.($|\/)/.test(slug)) slug = "";
  function $(s) { return document.querySelector(s); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* 剥离 YAML 风格头信息 */
  function splitFM(text) {
    var fm = {}, body = text;
    var m = /^---\s*\n([\s\S]*?)\n---\s*\n?/.exec(text);
    if (m) {
      m[1].split("\n").forEach(function (line) {
        var i = line.indexOf(":");
        if (i > 0) fm[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      });
      body = text.slice(m[0].length);
    }
    return { fm: fm, body: body };
  }

  function fmtCN(d) {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(d || "");
    return m ? m[1] + " 年 " + (+m[2]) + " 月 " + (+m[3]) + " 日" : (d || "");
  }

  function showError(big, msg) {
    hideTocGhost(); // 没有正文也就没有目录，骨架静静退场
    var el = $("#postBody");
    el.innerHTML =
      '<div class="error-panel"><div class="big">🌸</div><h2>' + esc(big) + "</h2><p>" + esc(msg) +
      '</p><p style="margin-top:18px"><a class="btn btn-primary" href="index.html">回到首页</a></p></div>';
    $("#postTitle").textContent = big;
  }

  function showToast(msg) {
    var t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t.__h);
    t.__h = setTimeout(function () { t.classList.remove("show"); }, 2000);
  }

  /* 渲染后的增强处理：标题 id、图片懒加载、外链、表格滚动 */
  function enhance(el) {
    var headings = [];
    el.querySelectorAll("h2, h3").forEach(function (h, i) {
      h.id = "sec-" + i;
      headings.push({ tag: h.tagName, text: h.textContent, id: h.id });
    });
    el.querySelectorAll("img").forEach(function (img) {
      if (!img.hasAttribute("loading")) img.loading = "lazy";
      if (!img.hasAttribute("decoding")) img.decoding = "async";
    });
    el.querySelectorAll('a[href^="http"]').forEach(function (a) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    });
    el.querySelectorAll("table").forEach(function (tb) {
      var w = document.createElement("div");
      w.style.overflowX = "auto";
      tb.parentNode.insertBefore(w, tb);
      w.appendChild(tb);
    });
    return headings;
  }

  /* 目录骨架：页面加载第一帧就在右侧占位（微光扫动），
     等内容就绪后与真实目录交叉淡化替换——目录区域始终存在，不会突然弹出 */
  var tocGhost = null;
  function showTocGhost() {
    if (window.innerWidth < 1200 || tocGhost) return;
    var wrap = document.querySelector(".post-wrap");
    if (!wrap) return;
    var aside = document.createElement("aside");
    aside.className = "toc is-ghost";
    aside.setAttribute("aria-hidden", "true");
    var widths = [84, 62, 76, 56, 70];
    var html = '<div class="toc-title">目 录</div>';
    for (var i = 0; i < widths.length; i++) {
      html += '<div class="toc-line" style="width:' + widths[i] + '%' +
        (i === 2 ? ';margin-left:22px' : "") + '"></div>';
    }
    aside.innerHTML = html;
    wrap.appendChild(aside);
    tocGhost = aside;
  }
  function hideTocGhost() {
    if (!tocGhost) return;
    var g = tocGhost;
    tocGhost = null;
    g.classList.add("is-leaving");
    setTimeout(function () { g.remove(); }, 420);
  }

  /* 目录（≥3 个标题且屏幕够宽时显示） */
  var disposeTOC = function () {};
  function buildTOC(headings) {
    disposeTOC();
    disposeTOC = function () {};
    hideTocGhost(); // 骨架与真实目录交叉淡化（不足 3 个标题时骨架静静淡出）
    if (headings.length < 3 || window.innerWidth < 1200) return;
    var wrap = document.querySelector(".post-wrap");
    var aside = document.createElement("aside");
    aside.className = "toc";
    aside.innerHTML =
      '<div class="toc-title">目 录</div>' +
      headings.map(function (h) {
        return '<a class="' + (h.tag === "H3" ? "lv3" : "") + '" href="#' + h.id + '">' + esc(h.text) + "</a>";
      }).join("");
    wrap.appendChild(aside);

    {
      /* 以“判定线（视口顶部下方 ~100px）以上最后一个标题”为当前项：
         点击目录跳转后高亮必然与落点一致，不会串到下一条 */
      var links = aside.querySelectorAll("a");
      var els = headings.map(function (h) { return document.getElementById(h.id); })
        .filter(Boolean);
      var ticking = false, frame = null;
      var update = function () {
        ticking = false;
        frame = null;
        var current = null;
        for (var i = 0; i < els.length; i++) {
          if (els[i].getBoundingClientRect().top <= 100) current = els[i];
          else break;
        }
        var atBottom = window.innerHeight + window.scrollY >=
          document.documentElement.scrollHeight - 2;
        if (atBottom && els.length) current = els[els.length - 1];
        for (var j = 0; j < links.length; j++) {
          links[j].classList.toggle("active",
            current && links[j].getAttribute("href") === "#" + current.id);
        }
      };
      var onScroll = function () {
        if (ticking) return;
        ticking = true;
        frame = requestAnimationFrame(update);
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      disposeTOC = function () {
        window.removeEventListener("scroll", onScroll);
        if (frame !== null) cancelAnimationFrame(frame);
        aside.remove();
      };
      update();
    }
  }

  /* 上一篇 / 下一篇 */
  function buildNav() {
    fetch("posts.json", { cache: contentCache })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        var posts = data.posts || [];
        var i = -1;
        for (var k = 0; k < posts.length; k++) if (posts[k].slug === slug) { i = k; break; }
        if (i < 0) return;
        var newer = posts[i - 1], older = posts[i + 1];
        var box = $("#postNav");
        if (!box) return;
        var html = "";
        if (newer) {
          html += '<a href="post.html?p=' + encodeURIComponent(newer.slug) +
            '"><span class="dir">← 更新一篇</span><span class="t">' + esc(newer.title) + "</span></a>";
        }
        if (older) {
          html += '<a class="next" href="post.html?p=' + encodeURIComponent(older.slug) +
            '"><span class="dir">更早一篇 →</span><span class="t">' + esc(older.title) + "</span></a>";
        }
        box.innerHTML = html;
      })
      .catch(function () {});
  }

  /* 阅读进度条 */
  function initProgress() {
    var bar = $("#progressBar");
    if (!bar) return;
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + "%";
        ticking = false;
      });
    }, { passive: true });
  }

  function init() {
    initProgress();
    showTocGhost(); // 第一帧就挂上目录骨架，目录区域随页面一起出现
    var copyBtn = $("#copyLink");
    if (copyBtn) copyBtn.addEventListener("click", function () {
      var url = location.href;
      var done = function () { showToast("🌸 文章链接已复制"); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, done);
      } else {
        var ta = document.createElement("textarea");
        ta.value = url; document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); } catch (e) {}
        document.body.removeChild(ta);
        done();
      }
    });

    if (!slug) return showError("没有指定文章", "从首页挑一篇文章开始阅读吧。");
    if (!window.marked) return showError("渲染库未加载", "assets/js/marked.min.js 丢失或加载失败。");

    marked.use({ gfm: true, breaks: true });

    var postUrl = "posts/" + slug.split("/").map(encodeURIComponent).join("/") + ".md";
    var lastRaw = "";

    function renderArticle(raw) {
      lastRaw = raw;
      var parts = splitFM(raw);
      var fm = parts.fm, body = parts.body;
      var title = fm.title || slug;

      document.title = title + " · " + (C.siteName || "博客");
      $("#postTitle").textContent = title;

      var minutes = Math.max(1, Math.round(body.replace(/\s/g, "").length / 400));
      var meta = [];
      if (fm.date) meta.push("发布于 " + fmtCN(fm.date));
      meta.push("约 " + minutes + " 分钟");
      var metaHTML = meta.map(esc).join('<span class="dot">·</span>');
      if (/^(true|yes|1|是)$/i.test((fm.draft || "").trim())) {
        metaHTML += '<span class="chip chip-draft">草稿</span>';
      }
      (fm.tags || "").split(/[,，]/).map(function (t) { return t.trim(); }).filter(Boolean).forEach(function (t) {
        metaHTML += '<span class="chip"># ' + esc(t) + "</span>";
      });
      $("#postMeta").innerHTML = metaHTML;

      /* cover 只作为头图区的局部背景（全局背景始终是站点视频） */
      var cover = fm.cover || "";
      var heroEl = document.querySelector(".post-hero");
      if (heroEl && cover) heroEl.style.backgroundImage = 'url("' + cover + '")';

      var el = $("#postBody");
      // 在接入文档前设置加载策略，避免图片先按默认 eager 发起请求。
      var template = document.createElement("template");
      template.innerHTML = marked.parse(body);
      /* 头图区已经显示过一次标题：正文开头若重复同一个 h1，去掉它，
         否则同一句话会在页面里连着出现两遍。
         比较时忽略空格、标点与 emoji，避免"标题 + 🌸"这类只差装饰的重复 */
      var normTitle = function (s) {
        return String(s == null ? "" : s).replace(/[^0-9a-zA-Z\u4e00-\u9fa5]/g, "").toLowerCase();
      };
      var firstH1 = template.content.querySelector("h1");
      if (firstH1 && normTitle(firstH1.textContent) === normTitle(title)) firstH1.remove();
      var headings = enhance(template.content);
      /* 目录先于正文插入 DOM：骨架淡出、真实目录与正文同帧淡入，三者同步 */
      buildTOC(headings);
      var holder = document.createElement("div");
      holder.className = "article-body";
      holder.appendChild(template.content);
      el.replaceChildren(holder);

      if (fm.description || fm.excerpt) {
        var d = document.querySelector('meta[name="description"]');
        if (d) d.setAttribute("content", fm.description || fm.excerpt);
      }
    }

    buildNav();
    var loading = true;
    fetch(postUrl, { cache: contentCache })
      .then(function (r) {
        if (r.status === 404) throw { notFound: true };
        if (!r.ok) throw new Error(r.status);
        return r.text();
      })
      .then(renderArticle)
      .catch(function (err) {
        if (err && err.notFound) return showError("文章不存在", "它可能被风吹走了……回首页看看别的吧。");
        showError("加载失败", "请通过本地服务器或网站访问（直接双击打开 HTML 会因浏览器安全策略无法读取文章）。");
      })
      .finally(function () { loading = false; });

    /* 本地预览时轮询正文：编辑器里改动并保存后自动重渲染，不用手动刷新 */
    if (localPreview) {
      setInterval(function () {
        if (document.hidden || loading) return;
        loading = true;
        fetch(postUrl, { cache: contentCache })
          .then(function (r) { return r.ok ? r.text() : null; })
          .then(function (text) {
            if (text && text !== lastRaw) {
              renderArticle(text);
              buildNav();
            }
          })
          .catch(function () {})
          .finally(function () { loading = false; });
      }, 4000);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
