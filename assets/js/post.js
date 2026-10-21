/* ==========================================================
   樱花街道 · 文章页逻辑
   Markdown 渲染 / 目录 / 上一篇下一篇 / 阅读进度 / 复制链接
   ========================================================== */
(function () {
  "use strict";

  var C = window.SAKURA_CONFIG || {};
  var localPreview = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var contentCache = localPreview ? "no-cache" : "default";

  /* 配图 WebP 清单：build.py 会把 posts 下已生成的 .webp 写进 posts.json。
     渲染完按清单换源——清单里没有的保持原图，加载失败也回退原图，不会白屏 */
  var WEBP = null;
  var webpReady = fetch("posts.json", { cache: contentCache })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) { WEBP = new Set((d && d.webp) || []); })
    .catch(function () { WEBP = new Set(); });
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

  /* 把配图换成 WebP 副本：清单里没有的保持原图，加载失败也回退原图 */
  function swapWebp(el) {
    if (!WEBP || !WEBP.size) return;
    el.querySelectorAll("img").forEach(function (img) {
      var src = img.getAttribute("src") || "";
      var next = src.replace(/\.(png|jpe?g)$/i, ".webp");
      if (next === src || !WEBP.has(next)) return;
      img.addEventListener("error", function () { img.src = src; }, { once: true });
      img.src = next;
    });
  }

  /* ---------- 图片灯箱：点正文里的图，铺满全屏看 ----------
     事件委托挂在正文容器上，重新渲染（本地预览轮询）后不用重新绑定 */
  function initLightbox(host) {
    var box = document.createElement("div");
    box.className = "lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "图片预览");
    box.innerHTML =
      '<img alt="">' +
      '<button class="lightbox-close" type="button" aria-label="关闭预览">✕</button>' +
      '<span class="lightbox-hint">再点一下图片还原</span>';
    document.body.appendChild(box);

    var pic = box.querySelector("img");
    var lastFocus = null;
    var dragging = false, startX = 0, startY = 0, startL = 0, startT = 0, moved = false;

    function zoomed() { return box.classList.contains("is-zoomed"); }

    function setZoom(on) {
      box.classList.toggle("is-zoomed", on);
      if (on) {
        /* 放大后先滚到中间，别一上来就贴着左上角 */
        box.scrollLeft = Math.max(0, (pic.offsetWidth - box.clientWidth) / 2);
        box.scrollTop = Math.max(0, (pic.offsetHeight - box.clientHeight) / 2);
      } else {
        box.scrollLeft = 0;
        box.scrollTop = 0;
      }
    }

    function open(img) {
      lastFocus = document.activeElement;
      box.classList.remove("is-zoomed");
      box.classList.add("is-open");
      document.documentElement.classList.add("lightbox-open");
      /* 优先用实际加载的地址（可能是 .webp 副本） */
      pic.src = img.currentSrc || img.src;
      pic.alt = img.alt || "";
      box.querySelector(".lightbox-close").focus({ preventScroll: true });
    }

    function close() {
      if (!box.classList.contains("is-open")) return;
      box.classList.remove("is-open");
      box.classList.remove("is-zoomed");
      document.documentElement.classList.remove("lightbox-open");
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }

    host.addEventListener("click", function (e) {
      var img = e.target.closest("img");
      if (!img || !host.contains(img)) return;
      /* 图片可能包在链接里：先拦住跳转 */
      e.preventDefault();
      e.stopPropagation();
      open(img);
    });

    /* 点图片：能放大的就切换缩放，本来就比屏幕小的直接关掉 */
    pic.addEventListener("click", function (e) {
      e.stopPropagation();
      if (moved) { moved = false; return; }   // 拖完松手不算点击
      if (zoomed()) { setZoom(false); return; }
      /* 现算：此刻图片一定已经按适配尺寸排好版，naturalWidth 也解码完了 */
      var canZoom = pic.naturalWidth > pic.clientWidth * 1.2 || pic.naturalHeight > pic.clientHeight * 1.2;
      if (canZoom) setZoom(true);
      else close();
    });
    /* 点遮罩或关闭按钮 */
    box.addEventListener("click", function (e) {
      if (e.target === pic) return;
      close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });

    /* 放大状态下用鼠标拖动平移（触摸靠容器原生滚动，不用额外处理） */
    pic.addEventListener("pointerdown", function (e) {
      if (!zoomed() || e.pointerType === "touch") return;
      dragging = true; moved = false;
      startX = e.clientX; startY = e.clientY;
      startL = box.scrollLeft; startT = box.scrollTop;
      try { pic.setPointerCapture(e.pointerId); } catch (err) {}
    });
    pic.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX, dy = e.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      box.scrollLeft = startL - dx;
      box.scrollTop = startT - dy;
    });
    pic.addEventListener("pointerup", function () { dragging = false; });
    pic.addEventListener("pointercancel", function () { dragging = false; });
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
    /* 清单已就位就同步换（此时图片还没进 DOM，不会白发请求）；没就位则等它 */
    if (WEBP) swapWebp(el);
    else webpReady.then(function () { swapWebp(el); });
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
    var postBodyEl = $("#postBody");
    if (postBodyEl) initLightbox(postBodyEl);
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

    /* :::tip / :::note … ::: 提示块：marked 本身不认，补一个块级扩展。
       编辑器的预览是支持的，博客这边原来会原样显示 :::tip */
    var ADM_LABEL = { note: "Note", tip: "Tip", important: "Important", warning: "Warning", caution: "Caution" };
    marked.use({
      extensions: [{
        name: "admonition",
        level: "block",
        start: function (src) { var i = src.indexOf(":::"); return i < 0 ? undefined : i; },
        tokenizer: function (src) {
          var m = /^:::[ \t]*(note|tip|important|warning|caution)[ \t]*(?:\[(.*?)\])?[ \t]*\n([\s\S]*?)\n:::[ \t]*(?:\n|$)/.exec(src);
          if (!m) return;
          return {
            type: "admonition",
            raw: m[0],
            kind: m[1],
            title: m[2] || "",
            tokens: this.lexer.blockTokens(m[3], [])
          };
        },
        renderer: function (token) {
          return '<div class="admonition adm-' + token.kind + '">' +
            '<p class="adm-title">' + esc(token.title || ADM_LABEL[token.kind]) + "</p>" +
            this.parser.parse(token.tokens) +
            "</div>";
        }
      }]
    });

    var postUrl = "posts/" + slug.split("/").map(encodeURIComponent).join("/") + ".md";
    var lastRaw = "";

    function renderArticle(raw) {
      /* 等 WebP 清单到位再解析：此时图片还没进 DOM，换源不会白发一次原图请求 */
      webpReady.then(function () { renderArticleBody(raw); });
    }

    function renderArticleBody(raw) {
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
