/* ==========================================================
   樱花街道 · 全站交互
   樱花飘落粒子 / 背景视频自适应加载 / 昼夜樱切换 / 列表渲染
   ========================================================== */
(function () {
  "use strict";

  var C = window.SAKURA_CONFIG || {};
  var localPreview = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var contentCache = localPreview ? "no-cache" : "default";
  var root = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }

  /* ---------- 配置填充 ---------- */
  $$("[data-cfg]").forEach(function (el) {
    var v = C[el.getAttribute("data-cfg")];
    if (v === undefined || v === null || v === "") { el.hidden = true; return; }
    el.textContent = v;
  });
  var gh = $("#ghLink");
  if (gh) {
    if (C.github) { gh.href = C.github; } else { gh.hidden = true; }
  }
  if (C.siteName) document.title = (document.title.indexOf("·") > -1 ? document.title : C.siteName + " · " + (C.jpName || ""));

  /* ---------- 昼夜樱主题 ---------- */
  var THEME_COLORS = { day: "#fff7f9", night: "#16132a" };
  function applyThemeColor() {
    var m = $('meta[name="theme-color"]');
    if (m) m.setAttribute("content", THEME_COLORS[root.getAttribute("data-theme")] || THEME_COLORS.day);
  }
  (function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem("sakura-theme"); } catch (e) {}
    if (saved) root.setAttribute("data-theme", saved);
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches) root.setAttribute("data-theme", "night");
    applyThemeColor();
  })();
  var themeBtn = $("#themeToggle");
  if (themeBtn) {
    var syncBtn = function () {
      var night = root.getAttribute("data-theme") === "night";
      /* 图标由 CSS 按 data-theme 切换，这里不能再写 textContent，否则会把 SVG 冲掉 */
      themeBtn.title = night ? "回到昼樱" : "切换夜樱";
      themeBtn.setAttribute("aria-label", night ? "切换到昼樱" : "切换到夜樱");
    };
    syncBtn();
    themeBtn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "night" ? "day" : "night";
      var apply = function () {
        root.setAttribute("data-theme", next);
        try { localStorage.setItem("sakura-theme", next); } catch (e) {}
        applyThemeColor();
        syncBtn();
        document.dispatchEvent(new CustomEvent("sakura:theme"));
      };

      /* 圆形扩散：以按钮为圆心把新主题展开（Chromium 系；不支持或已开启减少动效则直接切换） */
      if (!document.startViewTransition || reduced) { apply(); return; }
      var r = themeBtn.getBoundingClientRect();
      var x = r.left + r.width / 2, y = r.top + r.height / 2;
      var radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      root.classList.add("theme-switching");
      /* 兜底：万一 finished 因为中断没回调，别让"关过渡"的状态一直挂着 */
      var clearSwitch = function () { root.classList.remove("theme-switching"); };
      var switchGuard = setTimeout(clearSwitch, 1500);
      var vt = document.startViewTransition(apply);
      vt.ready.then(function () {
        document.documentElement.animate(
          { clipPath: ["circle(0px at " + x + "px " + y + "px)", "circle(" + radius + "px at " + x + "px " + y + "px)"] },
          { duration: 700, easing: "ease-in-out", pseudoElement: "::view-transition-new(root)" }
        );
      }).catch(function () {});
      vt.finished.catch(function () {}).then(function () {
        clearTimeout(switchGuard);
        clearSwitch();
      });
    });
  }

  /* ---------- 导航栏：顶部透明，滚动后铺毛玻璃 ----------
     首页 body 本身不滚动，滚动发生在 .view-notes / .view-about 内部，
     所以除了 window 还要读「当前可见视图」的 scrollTop，
     否则手记页滚动时导航一直是透明的；也不能读隐藏视图的，否则回到封面还挂着毛玻璃 */
  var updateNavScroll = function () {};
  function initNavScroll() {
    var nav = document.querySelector(".nav");
    if (!nav) return;
    var notes = document.getElementById("viewNotes");
    var about = document.getElementById("viewAbout");
    var ticking = false;
    var update = function () {
      ticking = false;
      var cls = document.body.classList;
      var scroller = cls.contains("at-notes") ? notes : cls.contains("at-about") ? about : null;
      var y = Math.max(window.scrollY || 0, scroller ? scroller.scrollTop : 0);
      nav.classList.toggle("is-scrolled", y > 24);
    };
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    [notes, about].forEach(function (s) { if (s) s.addEventListener("scroll", onScroll, { passive: true }); });
    updateNavScroll = update;
    update();
  }

  /* ---------- 背景视频：智能加载 ----------
     海报图无条件显示（它是手机 / 弱网 / 加载前的兜底背景）；
     视频：手机、省流量、2G 及以下、减少动态效果 → 不加载；
     3G → 标准版(1.5MB)，4G/WiFi → 高清版；页面空闲后才加载，不阻塞首屏 */
  function initVideo() {
    var poster = $(".bg-poster");
    if (poster && C.video && C.video.poster) {
      poster.style.backgroundImage = 'url("' + C.video.poster + '")';
    }

    var v = $("#bgVideo");
    if (!v || !C.video || C.video.enabled === false) return;

    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {};
    var noVideo = reduced || conn.saveData || /^(slow-2g|2g)$/.test(conn.effectiveType || "");
    if (noVideo || window.innerWidth < 768) return;

    var hd = C.video.hd, sd = C.video.sd || hd;
    var src = hd && (!conn.effectiveType || conn.effectiveType === "4g") ? hd : sd;

    var tryPlay = function () {
      if (document.hidden) return;
      var p = v.play(); if (p && p.catch) p.catch(function () {});
    };

    var reveal = function () {
      if (v.classList.contains("is-on")) return;
      v.classList.add("is-on"); // CSS 1.2s 缓慢淡入；此刻视频画面与海报同帧，切换无缝
      tryPlay();
      setTimeout(function () { if (poster) poster.style.display = "none"; }, 1600);
    };
    var start = function () {
      if (document.hidden || v.getAttribute("data-armed")) return;
      v.setAttribute("data-armed", "1");
      v.src = src;
      v.load();
      /* 海报图取自原片第 5 秒（见 README 的 ffmpeg 命令）：把视频也定位到同一帧再淡入，
         否则切过去的瞬间画面会从第 5 秒跳回第 0 秒，看起来像闪一下 */
      var seekToPoster = true;
      v.addEventListener("loadedmetadata", function () {
        if (!(v.duration > 6)) { seekToPoster = false; return; }
        try { v.currentTime = 5; } catch (e) { seekToPoster = false; }
      });
      /* 轮询等「已定位到海报帧且画面可用」再淡入，最多约 8 秒后兜底直接显示 */
      var tries = 0;
      var tick = function () {
        if (v.classList.contains("is-on")) return;
        var ready = v.readyState >= 2 && (!seekToPoster || v.currentTime > 4.5);
        if (ready || tries > 40) return reveal();
        tries++;
        setTimeout(tick, 200);
      };
      tick();
      v.addEventListener("error", function () { v.classList.remove("is-on"); }, { once: true });
    };
    var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 1200); };
    var scheduleStart = function () {
      if (!document.hidden) idle(start);
    };
    if (document.readyState === "complete") scheduleStart();
    else window.addEventListener("load", scheduleStart, { once: true });

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && !v.getAttribute("data-armed")) scheduleStart();
      if (!v.classList.contains("is-on")) return;
      if (document.hidden) v.pause();
      else tryPlay();
    });
    /* 浏览器后退等场景从缓存恢复页面时自动续播 */
    window.addEventListener("pageshow", function (e) {
      if (e.persisted && v.classList.contains("is-on") && v.paused) tryPlay();
    });
    /* 自动播放被浏览器拦截时，用户第一次点击页面后续播 */
    document.addEventListener("click", function () {
      if (v.classList.contains("is-on") && v.paused) tryPlay();
    }, { once: true });
  }

  /* ---------- 首页多视图：封面 ⇄ 手记 ⇄ 关于（独立页面，切换动画） ---------- */
  function initHomeCover() {
    var cover = $("#viewCover"), notes = $("#viewNotes"), about = $("#viewAbout");
    var archive = $("#viewArchive");
    if (!cover || !notes || !about) return;

    var at = "cover";
    var HASH = { cover: "", notes: "#notes", archive: "#archive", about: "#about" };
    var apply = function (view) {
      var wasContent = at !== "cover";
      at = view;
      /* 注：封面在手记视图里已经是 opacity: 0（只后退 42% 并淡出），
         所以切到关于时即使 transform 被归零也看不见，不会再闪主页 */
      document.body.classList.toggle("at-notes", view === "notes");
      document.body.classList.toggle("at-archive", view === "archive");
      document.body.classList.toggle("at-about", view === "about");
      /* 从内容页（手记/归档/关于）切走时：位置变化瞬移完成（不播滑动动画），只做淡入淡出；
         目标视图延后 0.18s 再淡入，等旧视图先退场，避免两个版式叠在一起 */
      if (wasContent) {
        [cover, notes, about, archive].forEach(function (v) {
          if (v) v.style.transition = "opacity .35s ease .18s";
        });
        setTimeout(function () {
          [cover, notes, about, archive].forEach(function (v) { if (v) v.style.transition = ""; });
        }, 600);
      }
      $$(".nav-links a[data-nav]").forEach(function (a) {
        a.classList.toggle("is-active", a.getAttribute("data-nav") === view);
      });
      /* 用 hash 记住当前视图：刷新后原位恢复，链接可分享定位。
         同时保留 ?cat= 这类查询参数，否则点完分类再切视图就把筛选丢了 */
      try {
        history.replaceState(null, "", location.pathname + location.search + (HASH[view] || ""));
      } catch (err) {}
      /* 视图切换后重新判定导航栏样式（从滚到底的手记回到封面时应恢复透明） */
      requestAnimationFrame(updateNavScroll);
      /* 视图在滑动的这 0.7s 里元素位置一直在变，补帧让卡片跟着一起浮现 */
      pumpReveal(700);
    };
    var toNotes = function (scrollSel) {
      apply("notes");
      if (scrollSel) {
        var t = notes.querySelector(scrollSel);
        if (t) setTimeout(function () {
          notes.scrollTo({ top: t.offsetTop - 64, behavior: "smooth" });
        }, 140);
      } else {
        notes.scrollTop = 0;
      }
    };
    var toAbout = function () { apply("about"); };
    var toArchive = function () { apply("archive"); };
    var toCover = function () { apply("cover"); };

    /* 导航与按钮接管（页面间独立切换，不依赖滚动） */
    $$("[data-nav]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var v = a.getAttribute("data-nav");
        if (v === "notes") toNotes(a.getAttribute("data-scroll"));
        else if (v === "archive") toArchive();
        else if (v === "about") toAbout();
        else toCover();
      });
    });

    /* 带 hash 进入（含刷新恢复）：直接落在对应视图。
       #posts 是文章页「手记」链接用的锚点（index.html 里文章列表的 section id），等同 #notes */
    if (location.hash === "#about") toAbout();
    else if (location.hash === "#archive") toArchive();
    else if (location.hash === "#notes" || location.hash === "#posts") toNotes();

    /* 手动改地址栏 hash / 从别的页面跳到本页某个视图时也能切过去。
       apply() 用的是 replaceState，不会反过来再触发 hashchange，不会打架 */
    window.addEventListener("hashchange", function () {
      var h = location.hash;
      if (h === "#about") toAbout();
      else if (h === "#archive") toArchive();
      else if (h === "#notes" || h === "#posts") toNotes();
      else if (!h) toCover();
    });

    /* 封面拖拽：手记 1:1 跟手，封面在后景只走 42% 并逐渐淡出（纵深）；
       拉过 1/3 屏松手 → 吸附切换到手记，否则滑回封面 */
    var H = cover.offsetHeight;
    var COVER_RISE = 0.42; // 封面相对手势的位移比例
    window.addEventListener("resize", function () { H = cover.offsetHeight; });
    var setDrag = function (d, p) {
      cover.style.transition = "none";
      notes.style.transition = "none";
      cover.style.transform = "translateY(" + (-d * COVER_RISE) + "px)";
      /* 淡出按「手记盖住了多少屏」算，而不是按吸附进度 p：
         按 p 算的话拖到 1/3 屏封面就几乎透明了，上方还是空的，会露出大片空白 */
      cover.style.opacity = Math.max(0, 1 - (d / H) * 1.2);
      notes.style.transform = "translateY(" + (H - d) + "px)";
      notes.style.opacity = Math.min(1, p * 2);
      queueReveal(); // 拖拽时卡片位置在变，跟手刷新
    };
    var settleDrag = function (commit) {
      [cover, notes].forEach(function (v) {
        v.style.transition = "transform .55s cubic-bezier(.16,1,.3,1), opacity .3s ease";
      });
      pumpReveal(600);
      if (commit) {
        cover.style.transform = "translateY(-42%)";
        cover.style.opacity = 0;
        notes.style.transform = "none";
        notes.style.opacity = 1;
      } else {
        cover.style.transform = "translateY(0)";
        cover.style.opacity = 1;
        notes.style.transform = "translateY(100%)";
        notes.style.opacity = 0;
      }
      setTimeout(function () {
        apply(commit ? "notes" : "cover"); // 同步视图状态与导航高亮
        [cover, notes].forEach(function (v) {
          v.style.transition = ""; v.style.transform = ""; v.style.opacity = "";
        });
      }, 620);
    };

    var dragging = false, dragY = 0, dy = 0;
    cover.addEventListener("mousedown", function (e) {
      if (e.button !== 0 || at !== "cover") return;
      if (e.target.closest("a, button, input")) return;
      dragging = true; dragY = e.clientY; dy = 0;
      H = cover.offsetHeight;
      e.preventDefault();
    });
    window.addEventListener("mousemove", function (e) {
      if (!dragging) return;
      dy = Math.max(0, Math.min(H, dragY - e.clientY));
      setDrag(dy, dy / (H / 3));
    });
    window.addEventListener("mouseup", function () {
      if (!dragging) return;
      dragging = false;
      settleDrag(dy >= H / 3);
      dy = 0;
    });

    /* 触屏同样可拖：只认纵向手势，横向/缩放交还给浏览器（不 preventDefault 就不抢手势） */
    var touchId = null, touchX = 0, touchY = 0, touchLive = false;
    var findTouch = function (list) {
      for (var i = 0; i < list.length; i++) if (list[i].identifier === touchId) return list[i];
      return null;
    };
    cover.addEventListener("touchstart", function (e) {
      if (at !== "cover" || e.touches.length !== 1) return;
      if (e.target.closest("a, button, input")) return;
      var t = e.touches[0];
      touchId = t.identifier; touchX = t.clientX; touchY = t.clientY;
      touchLive = false; dy = 0;
      H = cover.offsetHeight;
    }, { passive: true });

    cover.addEventListener("touchmove", function (e) {
      if (touchId === null) return;
      var t = findTouch(e.touches);
      if (!t) return;
      var ax = Math.abs(t.clientX - touchX), ay = Math.abs(t.clientY - touchY);
      if (!touchLive) {
        if (ay < 10) return;                       // 位移太小，还判断不出意图
        if (ax > ay) { touchId = null; return; }   // 横向滑动：让浏览器处理
        touchLive = true;
      }
      e.preventDefault();                          // 纵向拖拽：压住下拉刷新与橡皮筋
      dy = Math.max(0, Math.min(H, touchY - t.clientY));
      setDrag(dy, dy / (H / 3));
    }, { passive: false });

    var endTouch = function () {
      if (touchId === null) return;
      var wasLive = touchLive;
      touchId = null; touchLive = false;
      if (wasLive) settleDrag(dy >= H / 3);
      dy = 0;
    };
    cover.addEventListener("touchend", endTouch);
    cover.addEventListener("touchcancel", endTouch);
  }

  /* ---------- 封面动效增强：标题逐字绽放 + 内容随鼠标视差 ---------- */
  function initHeroFx() {
    var hero = $(".hero");
    if (!hero || reduced) return;

    /* 大标题逐字拆分成 span，依次旋转绽放（像花瓣落下）。
       拆分需在 data-cfg 配置填充之后进行（boot 顺序保证） */
    var title = $(".hero-title", hero);
    if (title && !title.getAttribute("data-split")) {
      var text = title.textContent;
      if (text && text.length <= 20) {
        title.setAttribute("data-split", "1");
        title.setAttribute("aria-label", text);
        title.textContent = "";
        for (var i = 0; i < text.length; i++) {
          var sp = document.createElement("span");
          sp.className = "ch";
          sp.setAttribute("aria-hidden", "true");
          sp.textContent = text[i];
          sp.style.animationDelay = (0.18 + i * 0.07) + "s";
          title.appendChild(sp);
        }
        title.classList.add("is-split");
        /* 逐字入场播完后再把流光渐变接回来（最后一字的延迟 + 动画时长） */
        var lastDelay = 0.18 + (text.length - 1) * 0.07;
        setTimeout(function () { title.classList.add("is-settled"); }, (lastDelay + 0.8) * 1000 + 80);
      }
    }

    /* 内容整体随鼠标轻微漂浮（仅精确指针设备）。
       目标值每帧向指针位置插值逼近，而不是「改一次变量 + 靠 CSS 过渡」——
       后者每帧都会重置过渡，实际手感是隔着一层棉花 */
    var content = $(".hero-content", hero);
    if (!content || !window.matchMedia("(pointer: fine)").matches) return;
    var tx = 0, ty = 0, cx = 0, cy = 0, moving = false;
    var step = function () {
      cx += (tx - cx) * 0.14;
      cy += (ty - cy) * 0.14;
      content.style.setProperty("--px", cx.toFixed(2) + "px");
      content.style.setProperty("--py", cy.toFixed(2) + "px");
      if (Math.abs(tx - cx) < 0.04 && Math.abs(ty - cy) < 0.04) { moving = false; return; }
      requestAnimationFrame(step);
    };
    var kick = function () { if (!moving) { moving = true; requestAnimationFrame(step); } };
    hero.addEventListener("mousemove", function (e) {
      var r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 20;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 16;
      kick();
    }, { passive: true });
    hero.addEventListener("mouseleave", function () { tx = ty = 0; kick(); });
  }

  /* ---------- 文章卡片：鼠标 3D 倾斜（事件委托，列表重渲染后依然生效） ----------
     每帧向目标角度插值，指针离开时临时挂 .is-settling 让 CSS 平滑归零 */
  function initCardTilt() {
    if (reduced || !window.matchMedia("(pointer: fine)").matches) return;
    var card = null, mx = 0, my = 0, curX = 0, curY = 0, moving = false;
    var settle = function (c) {
      c.classList.add("is-settling");
      c.style.setProperty("--rx", "0deg");
      c.style.setProperty("--ry", "0deg");
      setTimeout(function () { c.classList.remove("is-settling"); }, 400);
    };
    var step = function () {
      if (!card) { moving = false; return; }
      var r = card.getBoundingClientRect();
      var px = (mx - r.left) / r.width - 0.5;
      var py = (my - r.top) / r.height - 0.5;
      var targetY = px * 6, targetX = -py * 6;
      curY += (targetY - curY) * 0.16;
      curX += (targetX - curX) * 0.16;
      card.style.setProperty("--ry", curY.toFixed(2) + "deg");
      card.style.setProperty("--rx", curX.toFixed(2) + "deg");
      if (Math.abs(targetY - curY) > 0.02 || Math.abs(targetX - curX) > 0.02) {
        requestAnimationFrame(step);
      } else {
        moving = false;
      }
    };
    var kick = function () { if (!moving && card) { moving = true; requestAnimationFrame(step); } };
    document.addEventListener("mousemove", function (e) {
      mx = e.clientX; my = e.clientY;
      var c = e.target && e.target.closest ? e.target.closest(".card") : null;
      if (c !== card) {
        if (card) settle(card);
        card = c;
        curX = curY = 0;
      }
      kick();
    }, { passive: true });
  }

  /* ---------- 樱花飘落（canvas 粒子） ----------
     1) 花瓣预渲染成精灵，每帧只 drawImage，不再逐帧重建贝塞尔路径；
     2) 分远近两层：远层更小更淡更慢、用柔化精灵，撑出景深；
     3) 位移与旋转按 dt 归一化，144Hz 屏上不会比 60Hz 快两倍多 */
  function initPetals() {
    if (reduced || !C.petals || C.petals.enabled === false) return;
    var cv = $("#petals");
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext("2d");
    var W = 0, H = 0, petals = [], t = 0, raf = null, last = 0;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var palette = ["#ffb7cb"];
    var sprites = [];

    /* 精灵：64×64 画布，花瓣半高 30px；绘制时按 p.s / PS 缩放 */
    var SPR = 64, CEN = 32, PS = 30;
    function makeSprite(color, blur) {
      var c = document.createElement("canvas");
      c.width = c.height = SPR;
      var g = c.getContext("2d");
      if (blur) { try { g.filter = "blur(" + blur + "px)"; } catch (e) {} }
      g.translate(CEN, CEN);
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, -PS);
      g.bezierCurveTo(PS * 0.95, -PS * 0.65, PS * 0.75, PS * 0.5, 0, PS * 0.95);
      g.bezierCurveTo(-PS * 0.75, PS * 0.5, -PS * 0.95, -PS * 0.65, 0, -PS);
      g.fill();
      return c;
    }
    function buildSprites() {
      sprites = palette.map(function (c) {
        return { sharp: makeSprite(c, 0), soft: makeSprite(c, 1.6) };
      });
    }

    /* 鼠标挥动带起阵风：横向速度累积为 gust，随时间衰减，吹动花瓣 */
    var gust = 0, lastX = null;
    window.addEventListener("mousemove", function (e) {
      if (lastX !== null) gust += (e.clientX - lastX) * 0.0022;
      lastX = e.clientX;
      if (gust > 2) gust = 2; else if (gust < -2) gust = -2;
    }, { passive: true });

    function readPalette() {
      var raw = getComputedStyle(root).getPropertyValue("--petal") || "#ffb7cb";
      var list = raw.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
      if (list.length) palette = list;
      buildSprites();
    }
    document.addEventListener("sakura:theme", readPalette);

    function spawn(anywhere, layer) {
      var far = layer === 0;
      var s = far ? 3 + Math.random() * 3.5 : 6 + Math.random() * 7;
      return {
        x: Math.random() * W,
        y: anywhere ? Math.random() * H : -24 - Math.random() * 80,
        s: s,
        far: far,
        vy: (far ? 0.18 : 0.34) + Math.random() * (far ? 0.24 : 0.5) + s * 0.02,
        wind: (far ? 0.04 : 0.07) + Math.random() * 0.22,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * (far ? 0.02 : 0.035),
        swA: 0.3 + Math.random() * 0.8,
        swF: 0.01 + Math.random() * 0.015,
        ph: Math.random() * Math.PI * 2,
        a: far ? 0.22 + Math.random() * 0.26 : 0.45 + Math.random() * 0.4,
        c: (Math.random() * palette.length) | 0
      };
    }

    function drawPetal(p) {
      var spr = sprites[p.c % sprites.length];
      if (!spr) return;
      var k = p.s / PS;
      ctx.save();
      ctx.globalAlpha = p.a;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.drawImage(p.far ? spr.soft : spr.sharp, -CEN * k, -CEN * k, SPR * k, SPR * k);
      ctx.restore();
    }

    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      cv.style.width = W + "px"; cv.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var max = (C.petals && C.petals.max) || 36;
      var n = Math.max(12, Math.min(max, Math.round((W * H) / 42000)));
      if (petals.length === n) return; // 只是尺寸变化（移动端地址栏收起）时不清空重来
      petals = [];
      var farN = Math.round(n * 0.55);
      for (var i = 0; i < n; i++) petals.push(spawn(true, i < farN ? 0 : 1));
    }

    function tick(now) {
      if (document.hidden) { raf = null; return; } // 后台标签页自动暂停，省电
      /* 切主题的这 700ms 里整页被 ::view-transition 的快照盖住，画面根本看不见。
         清屏 + 重画整张画布（手机上 1170×2532）纯属白烧，直接跳过，但保持循环不断 */
      if (root.classList.contains("theme-switching")) {
        last = now;
        raf = requestAnimationFrame(tick);
        return;
      }
      /* 以 60fps 为 1 的时间步长；切回前台时钳到 3 帧，避免花瓣瞬移 */
      var dt = last ? Math.min((now - last) / 16.667, 3) : 1;
      last = now;
      t += dt;
      gust *= Math.pow(0.94, dt); // 阵风衰减（按时间而非帧数）
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < petals.length; i++) {
        var p = petals[i];
        p.y += p.vy * dt;
        p.x += (p.wind + Math.sin(t * p.swF + p.ph) * p.swA * 0.35 +
          gust * (p.far ? 0.25 : 0.5 + p.s * 0.06)) * dt;
        p.rot += (p.vr + gust * (p.far ? 0.006 : 0.012)) * dt; // 风大时花瓣翻卷更快
        if (p.y > H + 30 || p.x > W + 40 || p.x < -40) {
          petals[i] = p = spawn(false, p.far ? 0 : 1);
        }
        drawPetal(p);
      }
      raf = requestAnimationFrame(tick);
    }

    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt); rt = setTimeout(resize, 150);
    });
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && raf === null) raf = requestAnimationFrame(tick);
    });

    readPalette();
    resize();
    raf = requestAnimationFrame(tick);
  }

  /* ---------- 滚动浮现（滚动位置驱动） ----------
     原来用 IntersectionObserver + CSS 过渡，有两个绕不开的毛病：
     1) IO 的回调要等浏览器统一派发，实测卡片已经滑出边界 ~50ms 才开始淡出；
     2) IO 只能判断"在/不在"，淡出是一段固定时长的动画，与滚动位置无关，
        卡片往往在屏幕外就淡完了——看起来就是"没触发"。
     现在改成每帧按卡片与视口上下边缘的距离直接算透明度：
     露出一半就半透明，完全离开才为 0，滚到哪就渲染到哪，天然跟手。 */
  var revealEls = [];
  var revealRaf = 0, revealRunning = false, revealLast = 0, revealPumpUntil = 0;

  /* 判定基准就是元素自身高度：一张卡被切掉一半就算"走了一半"，
     与视口大小无关，卡片多高就按多高算 */
  function revealZone(h) {
    return h || 1;
  }

  /* 每帧把当前透明度向目标值插值。
     滚轮一格是整段跳（实测 scrollTop 0 → 120 → 240，中间没有帧），
     直接把目标值写上去就是「啪」一下消失；插值能让跳变也看得出是一段淡出。
     时间常数 ~90ms：既看得见淡出，又不会拖到不跟手。 */
  function stepReveal(now) {
    if (!revealLast) revealLast = now;
    var dt = Math.min(64, now - revealLast) / 1000;
    revealLast = now;
    var H = window.innerHeight;
    var ease = 1 - Math.pow(0.5, dt / 0.05); // 半衰期 50ms：进得快、退得干脆
    var settled = true;
    var writes = [];

    for (var i = revealEls.length - 1; i >= 0; i--) {
      var el = revealEls[i];
      if (!el.isConnected) { revealEls.splice(i, 1); continue; }   // 重渲染后被替换掉的旧节点
      var r = el.getBoundingClientRect();
      if (!r.height) continue;
      /* 扣除自己施加的 translate：淡出时元素会下落，若直接用 rect 测量，
         位移会反过来影响"露出多少"，判定值在临界点上来回跳（实测会抖成锯齿）。
         这里用逻辑位置算，和视觉位移解耦 */
      var dy = el.__dy || 0;
      var top = r.top - dy, bottom = r.bottom - dy;
      var vis = Math.min(r.height, bottom, H - top);
      if (vis < 0) vis = 0;
      var zone = revealZone(r.height);
      /* 二值判定 + 迟滞：可见不足 55% 就消失（被遮住 45% 以上）。
         - 已在显示 → 露出不足 55% 判定"离开"；
         - 已隐藏 → 回到 59% 以上才判定"进入"。
         注意离开阈值必须小于进入阈值，否则同一位置会在两个状态间反复横跳。
         判定离开后透明度一路走到 0（整张消失 + 下落 24px） */
      var on = el.__on !== false;
      var need = zone * (on ? 0.55 : 0.59);
      on = vis >= need;
      el.__on = on;
      var target = on ? 1 : 0;
      var cur = el.__op == null ? target : el.__op;
      var next = cur + (target - cur) * ease;
      if (Math.abs(target - next) < 0.008) next = target;
      else settled = false;
      if (el.__op !== next) {
        el.__op = next;
        el.__dy = (1 - next) * 24;
        writes.push(el, next);
      }
    }
    for (var j = 0; j < writes.length; j += 2) {
      var e = writes[j], v = writes[j + 1];
      e.style.opacity = v.toFixed(3);
      e.style.translate = "0 " + ((1 - v) * 24).toFixed(1) + "px";
    }
    return settled;
  }

  function runReveal(now) {
    var settled = stepReveal(now);
    if (settled && now >= revealPumpUntil) { revealRunning = false; revealRaf = 0; return; }
    revealRaf = requestAnimationFrame(runReveal);
  }

  function queueReveal() {
    if (revealRunning) return;
    revealRunning = true;
    revealLast = 0;
    revealRaf = requestAnimationFrame(runReveal);
  }

  /* 视图切换、拖拽期间元素位置在变但不触发 scroll，强行多跑一段帧 */
  function pumpReveal(ms) {
    revealPumpUntil = performance.now() + ms;
    queueReveal();
  }

  function registerReveal(nodes) {
    nodes.forEach(function (el) {
      if (el.__rev) return;
      el.__rev = 1;
      if (reduced) { el.style.opacity = 1; el.style.translate = "none"; return; }
      revealEls.push(el);
    });
    queueReveal();
  }
  var observeReveal = registerReveal;
  var unobserveReveal = function () {};

  function initReveal() {
    registerReveal($$(".reveal"));
    window.addEventListener("scroll", queueReveal, { passive: true });
    $$(".view-notes, .view-about").forEach(function (s) {
      s.addEventListener("scroll", queueReveal, { passive: true });
    });
    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(queueReveal, 120);
    });
  }

  /* ==========================================================
     首页：文章列表 + 标签筛选 + 搜索
     ========================================================== */
  function fmtDate(d) {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(d || "");
    return m ? m[1] + "." + m[2] + "." + m[3] : (d || "");
  }

  function initIndex() {
    var grid = $("#postGrid");
    if (!grid) return;

    var state = { cat: "", q: "", sort: "desc", period: "", from: "", to: "" };
    var isDate = function (s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || ""); };
    try {
      var sp = new URLSearchParams(location.search);
      var c0 = sp.get("cat");
      if (c0) state.cat = c0;
      /* 日期范围也能从地址栏带进来：index.html?from=2026-09-01&to=2026-09-30#notes */
      if (isDate(sp.get("from"))) state.from = sp.get("from");
      if (isDate(sp.get("to"))) state.to = sp.get("to");
    } catch (e) {}

    function esc(s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    }

    function cardHTML(p, i) {
      var tags = (p.tags || []).map(function (t) {
        return '<span class="chip"># ' + esc(t) + "</span>";
      }).join("");
      var draft = p.draft ? '<span class="chip chip-draft">草稿</span>' : "";
      return (
        '<div class="card-wrap">' +
        '<article class="card">' +
        '<a class="card-link" href="post.html?p=' + encodeURIComponent(p.slug) + '">' +
        '<div class="card-meta"><time>' + fmtDate(p.date) + '</time><span class="dot">·</span><span>约 ' + (p.minutes || 1) + ' 分钟</span>' + draft + '</div>' +
        '<h3 class="card-title">' + esc(p.title) + "</h3>" +
        (p.excerpt ? '<p class="card-excerpt">' + esc(p.excerpt) + "</p>" : "") +
        '<div class="card-foot"><span class="chip-row">' + tags + '</span><span class="card-go">阅读全文 →</span></div>' +
        "</a></article></div>"
      );
    }

    function byDate(list) {
      /* 稳定排序：同一天的多篇保持 posts.json 里的自然顺序 */
      var dir = state.sort === "asc" ? 1 : -1;
      list.sort(function (a, b) {
        return a.date < b.date ? -dir : a.date > b.date ? dir : 0;
      });
      return list;
    }

    /* ---------- 左侧分类栏 ---------- */
    /* 分类名 + 篇数：一次遍历算完，renderCats 和空状态都用得上 */
    function catStats() {
      var counts = {}, total = 0;
      (window.__POSTS__ || []).forEach(function (p) {
        var c = p.category || "未分类";
        counts[c] = (counts[c] || 0) + 1;
        total++;
      });
      return { counts: counts, total: total };
    }

    function catBtn(value, name, n) {
      var on = state.cat === value;
      return '<button type="button" class="cat-item' + (on ? " is-active" : "") +
        '" data-cat="' + esc(value) + '" aria-pressed="' + (on ? "true" : "false") +
        '" title="' + esc(name) + '">' +
        '<span class="cat-name">' + esc(name) + "</span><em>" + n + "</em></button>";
    }

    function renderCats() {
      var rail = $("#catRail");
      if (!rail) return;
      var stat = catStats();
      var counts = stat.counts;
      /* 篇数多的在前；篇数相同按名字排，避免每次刷新顺序都在跳 */
      var cats = Object.keys(counts).sort(function (a, b) {
        return counts[b] - counts[a] || a.localeCompare(b, "zh-Hans-CN");
      });
      /* URL 里带的分类可能已经被删掉/改名：回落到「全部」，
         否则会停在一个永远空着的列表上 */
      if (state.cat && !counts[state.cat]) state.cat = "";

      var html = '<p class="cat-title"><span>分类</span><em>' + stat.total + " 篇</em></p>";
      html += '<div class="cat-list">';
      html += catBtn("", "全部", stat.total);
      cats.forEach(function (c) { html += catBtn(c, c, counts[c]); });
      html += "</div>";
      rail.innerHTML = html;
      /* 重绘后重新挂滚动监听（节点被替换了） */
      var list = $(".cat-list", rail);
      if (list) list.addEventListener("scroll", updateRailFade, { passive: true });
      updateRailFade();
    }

    /* 窄屏分类条是横向滚动：还有内容的一侧加渐隐，暗示可以滑 */
    function updateRailFade() {
      var list = $(".cat-list");
      if (!list) return;
      list.classList.toggle("is-more", list.scrollWidth - list.clientWidth - list.scrollLeft > 4);
      list.classList.toggle("is-prev", list.scrollLeft > 4);
    }

    /* 从 ?cat=xxx 进来时，把选中的胶囊滚进视野（窄屏下它可能在屏幕外） */
    function scrollActiveChip() {
      var list = $(".cat-list");
      if (!list) return;
      var on = $(".cat-item.is-active", list);
      if (!on || list.scrollWidth <= list.clientWidth + 4) return;
      var left = on.offsetLeft - 12;
      if (left > list.scrollLeft + list.clientWidth - on.offsetWidth || left < list.scrollLeft) {
        list.scrollLeft = Math.max(0, left);
        updateRailFade();
      }
    }

    /* 切换分类：高亮、列表、地址栏、滚动位置一起同步 */
    function selectCat(cat) {
      state.cat = cat;
      var rail = $("#catRail");
      if (rail) {
        $$(".cat-item", rail).forEach(function (b) {
          var on = (b.getAttribute("data-cat") || "") === cat;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
      }
      apply();
      syncURL();
      scrollToToolbar();
    }

    /* 地址栏保留 hash（否则刷新会掉回封面）、分类与时间范围 */
    function syncURL() {
      try {
        var qs = [];
        if (state.cat) qs.push("cat=" + encodeURIComponent(state.cat));
        if (state.from) qs.push("from=" + state.from);
        if (state.to) qs.push("to=" + state.to);
        history.replaceState(null, "",
          location.pathname + (qs.length ? "?" + qs.join("&") : "") + location.hash);
      } catch (err) {}
    }

    /* 在列表下方换分类时，把工具栏拉回视野：否则看到的是新列表的中段/空白 */
    function scrollToToolbar() {
      var view = $("#viewNotes");
      var bar = $(".notes-wrap .toolbar");
      if (!view || !bar) return;
      var top = bar.getBoundingClientRect().top;
      if (top < 72) view.scrollTo({ top: view.scrollTop + top - 88, behavior: "smooth" });
    }

    /* ---------- 时间范围：自绘日历 + 应用按钮 ---------- */
    /* state.from/to 是「已生效」的值；draft 是「界面上正在选」的值。
       只有点「应用」才把 draft 提交进 state 并重新筛选，日历里选完不会立刻改变列表 */
    var draft = { from: state.from, to: state.to };
    var dpField = null;   // 当前在选哪一头：from / to
    var dpMonth = null;   // 日历当前显示的年月 { y, m }
    var dpEl = null;

    function pad2(n) { return (n < 10 ? "0" : "") + n; }
    function isoOf(y, m, d) { return y + "-" + pad2(m) + "-" + pad2(d); }
    function partsOf(iso) {
      var p = String(iso || "").split("-");
      return p.length === 3 ? { y: +p[0], m: +p[1], d: +p[2] } : null;
    }
    function todayISO() {
      var t = new Date();
      return isoOf(t.getFullYear(), t.getMonth() + 1, t.getDate());
    }
    function dayCount(y, m) { return new Date(y, m, 0).getDate(); } // m 从 1 开始

    /* 有文章覆盖的日期区间：日历里把没内容的日期灰掉，也用于「可查看 …」提示 */
    function dateBounds() {
      var ds = (window.__POSTS__ || []).map(function (p) { return p.date; })
        .filter(function (d) { return isDate(d); }).sort();
      return ds.length ? [ds[0], ds[ds.length - 1]] : ["", ""];
    }

    function setField(btn, iso) {
      if (!btn) return;
      var val = $(".db-val", btn);
      if (iso) {
        val.textContent = fmtDate(iso).replace(/\./g, "/");
        val.classList.remove("is-empty");
      } else {
        val.textContent = "yyyy/mm/dd";
        val.classList.add("is-empty");
      }
    }

    /* 把 draft 画到界面，并更新「应用」是否可点 */
    function syncDateUI() {
      setField($("#dateFrom"), draft.from);
      setField($("#dateTo"), draft.to);

      var dirty = draft.from !== state.from || draft.to !== state.to;
      var applyBtn = $("#dateApply");
      if (applyBtn) applyBtn.disabled = !dirty;

      var any = !!(draft.from || draft.to || state.from || state.to);
      var reset = $("#dateReset");
      if (reset) reset.hidden = !any;

      var hint = $("#dateHint");
      if (hint) {
        var b = dateBounds();
        hint.hidden = any || !b[0];
        if (!hint.hidden) hint.textContent = "可查看 " + fmtDate(b[0]) + " – " + fmtDate(b[1]);
      }
    }

    function renderPicker() {
      var el = dpEl;
      var sel = draft[dpField];
      var b = dateBounds();
      var today = todayISO();
      var y = dpMonth.y, m = dpMonth.m;

      $("#dpMonth").textContent = y + " 年 " + m + " 月";

      /* 翻到数据区间之外就没有意义了，到边界就把箭头禁掉 */
      var prevLast = new Date(y, m - 1, 0);
      var nextFirst = new Date(y, m, 1);
      $('[data-step="-1"]', el).disabled = !!(b[0] && isoOf(prevLast.getFullYear(), prevLast.getMonth() + 1, prevLast.getDate()) < b[0]);
      $('[data-step="1"]', el).disabled = !!(b[1] && isoOf(nextFirst.getFullYear(), nextFirst.getMonth() + 1, nextFirst.getDate()) > b[1]);

      /* 周一开头：getDay() 里周日是 0，转成 0=周一 */
      var startDow = (new Date(y, m - 1, 1).getDay() + 6) % 7;
      var dim = dayCount(y, m);
      var prevDim = dayCount(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1);
      var cells = [];
      for (var i = startDow - 1; i >= 0; i--) cells.push({ d: prevDim - i, out: true });
      for (var d = 1; d <= dim; d++) cells.push({ d: d, out: false });
      var tail = (7 - (cells.length % 7)) % 7;
      for (var t = 1; t <= tail; t++) cells.push({ d: t, out: true });

      $("#dpGrid").innerHTML = cells.map(function (c) {
        if (c.out) return '<button class="dp-day is-out" type="button" tabindex="-1" disabled>' + c.d + "</button>";
        var iso = isoOf(y, m, c.d);
        var cls = "dp-day";
        var off = !!(b[0] && b[1] && (iso < b[0] || iso > b[1]));
        if (off) cls += " is-off";
        if (iso === today) cls += " is-today";
        /* 区间的另一头用淡粉标出来，否则只看到"中间那段"很莫名 */
        if (iso === draft[dpField === "from" ? "to" : "from"]) cls += " is-edge";
        if (draft.from && draft.to && iso > draft.from && iso < draft.to) cls += " is-inrange";
        if (iso === sel) cls += " is-sel";
        return '<button class="' + cls + '" type="button" data-iso="' + iso + '"' +
          (off ? " disabled" : "") + ' tabindex="' + (iso === sel ? "0" : "-1") + '">' + c.d + "</button>";
      }).join("");

      /* 今天不在有文章的日期区间里时，和网格里的灰日子保持一致 */
      var todayBtn = $('[data-dp="today"]', el);
      todayBtn.disabled = !!(b[0] && b[1] && (today < b[0] || today > b[1]));

      /* 这个月没有选中项时，把 tabindex 给第一个可选的日子，键盘能直接进来 */
      if (!sel || !$(".dp-day.is-sel", el)) {
        var firstOn = $(".dp-day:not(.is-out):not(.is-off)", el);
        if (firstOn) firstOn.setAttribute("tabindex", "0");
      }
    }

    function placePicker() {
      var trigger = $(dpField === "from" ? "#dateFrom" : "#dateTo").getBoundingClientRect();
      var w = dpEl.offsetWidth || 272;
      var h = dpEl.offsetHeight || 300;
      var gap = 8, edge = 10;
      /* 贴着窗口左右边缘时往里收，别被裁掉 */
      var left = Math.max(edge, Math.min(trigger.left, window.innerWidth - w - edge));
      var top = trigger.bottom + gap;
      /* 下面放不下就翻到上方 */
      var up = top + h > window.innerHeight - edge && trigger.top - h - gap > edge;
      if (up) top = trigger.top - h - gap;
      dpEl.style.left = Math.round(left) + "px";
      dpEl.style.top = Math.round(top) + "px";
      dpEl.classList.toggle("is-up", up);
    }

    function openPicker(which) {
      dpEl = dpEl || $("#datePicker");
      if (!dpEl) return;
      dpField = which;
      var b = dateBounds();
      var base = partsOf(draft[which]) || partsOf(draft[which === "from" ? "to" : "from"]) ||
                 partsOf(b[1]) || partsOf(todayISO());
      dpMonth = { y: base.y, m: base.m };

      dpEl.hidden = false;
      $(which === "from" ? "#dateFrom" : "#dateTo").setAttribute("aria-expanded", "true");
      renderPicker();
      placePicker();
      var focusEl = $(".dp-day.is-sel", dpEl) || $('.dp-day[tabindex="0"]', dpEl);
      if (focusEl) focusEl.focus({ preventScroll: true });
    }

    function closePicker(back) {
      if (!dpEl || dpEl.hidden) return;
      dpEl.hidden = true;
      ["#dateFrom", "#dateTo"].forEach(function (s) {
        var e = $(s);
        if (e) e.setAttribute("aria-expanded", "false");
      });
      if (back) {
        var t = $(dpField === "from" ? "#dateFrom" : "#dateTo");
        if (t) t.focus({ preventScroll: true });
      }
    }

    function pickDate(iso) {
      draft[dpField] = iso;
      /* 起止颠倒：以正在选的那一头为准，把另一头拉过来对齐 */
      if (draft.from && draft.to && draft.from > draft.to) {
        if (dpField === "from") draft.to = draft.from;
        else draft.from = draft.to;
      }
      syncDateUI();
      closePicker(true);
    }

    function bindDatePicker() {
      var bar = $("#dateBar");
      if (!bar) return;
      dpEl = $("#datePicker");

      $("#dateFrom").addEventListener("click", function () {
        if (!dpEl.hidden && dpField === "from") { closePicker(); return; }
        openPicker("from");
      });
      $("#dateTo").addEventListener("click", function () {
        if (!dpEl.hidden && dpField === "to") { closePicker(); return; }
        openPicker("to");
      });

      dpEl.addEventListener("click", function (e) {
        var nav = e.target.closest("[data-step]");
        if (nav && !nav.disabled) {
          var y = dpMonth.y, m = dpMonth.m + (+nav.getAttribute("data-step"));
          if (m < 1) { m = 12; y--; }
          if (m > 12) { m = 1; y++; }
          dpMonth = { y: y, m: m };
          renderPicker();
          placePicker();
          return;
        }
        var act = e.target.closest("[data-dp]");
        if (act) {
          if (act.getAttribute("data-dp") === "clear") {
            draft[dpField] = "";
            syncDateUI();
            closePicker(true);
          } else {
            pickDate(todayISO());
          }
          return;
        }
        var day = e.target.closest(".dp-day");
        if (day && !day.disabled) pickDate(day.getAttribute("data-iso"));
      });

      /* 键盘：方向键在日历里走，Esc 收起 */
      dpEl.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { e.stopPropagation(); closePicker(true); return; }
        var cur = e.target.closest(".dp-day");
        if (!cur) return;
        var delta = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1
                  : e.key === "ArrowUp" ? -7 : e.key === "ArrowDown" ? 7 : 0;
        if (!delta) return;
        e.preventDefault();
        var p = partsOf(cur.getAttribute("data-iso"));
        if (!p) return;
        var dt = new Date(p.y, p.m - 1, p.d + delta);
        dpMonth = { y: dt.getFullYear(), m: dt.getMonth() + 1 };
        renderPicker();
        placePicker();
        var iso = isoOf(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
        var next = $('.dp-day[data-iso="' + iso + '"]', dpEl);
        if (next && !next.disabled) {
          $$(".dp-day", dpEl).forEach(function (b) { b.setAttribute("tabindex", "-1"); });
          next.setAttribute("tabindex", "0");
          next.focus({ preventScroll: true });
        }
      });

      /* 点外面只收起，不丢草稿——回来还能接着点「应用」 */
      document.addEventListener("click", function (e) {
        if (!dpEl || dpEl.hidden) return;
        if (e.target.closest("#datePicker, #dateFrom, #dateTo")) return;
        closePicker();
      });

      $("#dateApply").addEventListener("click", function () {
        state.from = draft.from;
        state.to = draft.to;
        closePicker();
        syncDateUI();
        apply();
        syncURL();
      });

      $("#dateReset").addEventListener("click", function () {
        draft.from = "";
        draft.to = "";
        state.from = "";
        state.to = "";
        closePicker();
        syncDateUI();
        apply();
        syncURL();
      });

      window.addEventListener("resize", function () {
        if (dpEl && !dpEl.hidden) placePicker();
      });
      /* 弹层是 fixed 的，列表滚动时要跟着日期框走 */
      var notesView = $("#viewNotes");
      if (notesView) notesView.addEventListener("scroll", function () {
        if (dpEl && !dpEl.hidden) placePicker();
      }, { passive: true });

      syncDateUI();
    }

    function clearFilters() {
      state.q = "";
      state.from = "";
      state.to = "";
      draft.from = "";
      draft.to = "";
      var s = $("#search");
      if (s) s.value = "";
      closePicker();
      syncDateUI();
      selectCat("");
    }

    /* 分类 + 搜索 + 时间范围 */
    function filtered() {
      var q = state.q.toLowerCase();
      return (window.__POSTS__ || []).filter(function (p) {
        if (state.cat && (p.category || "未分类") !== state.cat) return false;
        /* date 是 YYYY-MM-DD，字符串比较等价于按日期比较 */
        if (state.from && (p.date || "") < state.from) return false;
        if (state.to && (p.date || "") > state.to) return false;
        if (q) {
          var hay = (p.title + " " + (p.excerpt || "") + " " + (p.tags || []).join(" ") + " " + (p.category || "")).toLowerCase();
          if (hay.indexOf(q) === -1) return false;
        }
        return true;
      });
    }

    /* ---------- 归档视图 ---------- */
    function renderArchive(list) {
      var box = $("#archive");
      if (!box) return;
      if (!list.length) {
        box.innerHTML = '<div class="empty">🌸 这个时间段还没有文章。</div>';
        return;
      }
      var groups = {};
      list.forEach(function (p) {
        var y = String(p.date || "").slice(0, 4) || "未标注";
        (groups[y] = groups[y] || []).push(p);
      });
      var years = Object.keys(groups).sort();
      if (state.sort !== "asc") years.reverse();
      box.innerHTML = years.map(function (y) {
        var rows = groups[y].map(function (p) {
          var meta = p.category || "";
          return '<li><a class="arc-row" href="post.html?p=' + encodeURIComponent(p.slug) + '">' +
            '<span class="arc-date">' + fmtDate(p.date).slice(5) + "</span>" +
            '<span class="arc-title">' + esc(p.title) + "</span>" +
            (meta ? '<span class="arc-tags">' + esc(meta) + "</span>" : "") +
            "</a></li>";
        }).join("");
        return '<section class="arc-year"><h3 class="arc-head"><span>' + y + "</span><em>" +
          groups[y].length + ' 篇</em></h3><ul class="arc-list">' + rows + "</ul></section>";
      }).join("");
    }

    /* 时间段筛选：按月，月份太多时退化成按年 */
    function renderYears() {
      var bar = $("#yearBar");
      if (!bar) return;
      var counts = {};
      (window.__POSTS__ || []).forEach(function (p) {
        var m = String(p.date || "").slice(0, 7);
        if (m.length === 7) counts[m] = (counts[m] || 0) + 1;
      });
      var keys = Object.keys(counts).sort();
      if (keys.length > 24) {   // 月份太多就按年，免得一长条 chip
        var yc = {};
        keys.forEach(function (m) { var y = m.slice(0, 4); yc[y] = (yc[y] || 0) + counts[m]; });
        counts = yc;
        keys = Object.keys(yc).sort();
      }
      if (state.sort !== "asc") keys.reverse();
      var html = '<button class="chip' + (state.period ? "" : " is-active") + '" data-period="">全部时间</button>';
      keys.forEach(function (k) {
        html += '<button class="chip' + (state.period === k ? " is-active" : "") + '" data-period="' + k + '">' +
          k.replace("-", ".") + " <em>" + counts[k] + "</em></button>";
      });
      bar.innerHTML = html;
    }

    function applyArchive() {
      var list = (window.__POSTS__ || []).slice();
      if (state.period) {
        list = list.filter(function (p) { return String(p.date || "").indexOf(state.period) === 0; });
      }
      renderYears();
      renderArchive(byDate(list));
    }

    /* 时间范围的短标签：09.01 – 09.30 / 09.01 之后 / 09.30 之前 */
    function rangeLabel() {
      var f = state.from ? fmtDate(state.from).slice(5) : "";
      var t = state.to ? fmtDate(state.to).slice(5) : "";
      if (f && t) return f + " – " + t;
      return f ? f + " 之后" : t + " 之前";
    }

    /* 空列表按「分类 / 时间范围 / 关键词」组合出具体提示。
       原来一律提示「换换关键词」，没打关键词的时候很莫名其妙 */
    function emptyHTML() {
      var total = (window.__POSTS__ || []).length;
      if (!total) return '<div class="empty">🌸 这里还很安静，快去写第一篇文章吧！</div>';
      var scope = [];
      if (state.cat) scope.push("「" + esc(state.cat) + "」");
      if (state.from || state.to) scope.push(rangeLabel());
      var where = scope.join(" · ");
      var msg;
      if (state.q) {
        msg = where ? where + " 里没有找到「" + esc(state.q) + "」"
                    : "没有找到「" + esc(state.q) + "」相关的文章";
      } else if (state.from || state.to) {
        msg = where + " 这段时间里还没有文章";
      } else if (where) {
        msg = where + " 这个分类下还没有文章";
      } else {
        msg = "没有找到相关的文章";
      }
      return '<div class="empty">' + msg +
        '<div class="empty-actions"><button type="button" class="chip" data-clear>查看全部手记</button></div></div>';
    }

    function apply() {
      var list = byDate(filtered());
      unobserveReveal($$(".card-wrap", grid)); // 旧卡片即将被替换，先撤销观察
      grid.innerHTML = list.length ? list.map(cardHTML).join("") : emptyHTML();
      observeReveal($$(".card-wrap", grid));
      queueReveal();
      var cur = $("#catCurrent");
      if (cur) {
        var label = state.cat || "全部";
        if (state.from || state.to) label += " · " + rangeLabel();
        cur.textContent = label + " · " + list.length + " 篇";
      }
      var clear = $("#filterClear");
      if (clear) clear.hidden = !(state.cat || state.q || state.from || state.to);
      applyArchive();
    }

    /* 两个排序按钮共用一份状态 */
    function syncSort() {
      var label = state.sort === "asc" ? "最早 ↑" : "最新 ↓";
      ["#sortToggle", "#arcSortToggle"].forEach(function (sel) {
        var b = $(sel);
        if (b) b.textContent = label;
      });
    }

    grid.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';

    fetch("posts.json", { cache: contentCache })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        window.__POSTS__ = data.posts || [];
        window.__POSTS_RAW__ = JSON.stringify(window.__POSTS__);
        renderCats();
        scrollActiveChip();

        /* 分类点击：绑在容器上，renderCats 重绘按钮时不用重新绑定 */
        var rail = $("#catRail");
        if (rail) rail.addEventListener("click", function (e) {
          var btn = e.target.closest("[data-cat]");
          if (!btn) return;
          selectCat(btn.getAttribute("data-cat") || "");
        });
        /* 空状态里的「查看全部手记」 */
        grid.addEventListener("click", function (e) {
          if (e.target.closest("[data-clear]")) clearFilters();
        });
        var filterClear = $("#filterClear");
        if (filterClear) filterClear.addEventListener("click", clearFilters);
        window.addEventListener("resize", updateRailFade);

        /* ---------- 时间范围 ---------- */
        bindDatePicker();

        var search = $("#search");
        if (search) search.addEventListener("input", function () {
          state.q = search.value.trim();
          apply();
        });
        ["#sortToggle", "#arcSortToggle"].forEach(function (sel) {
          var btn = $(sel);
          if (!btn) return;
          btn.addEventListener("click", function () {
            state.sort = state.sort === "asc" ? "desc" : "asc";
            syncSort();
            apply();
          });
        });
        var yearBar = $("#yearBar");
        if (yearBar) yearBar.addEventListener("click", function (e) {
          var btn = e.target.closest("[data-period]");
          if (!btn) return;
          state.period = btn.getAttribute("data-period");
          applyArchive();
        });
        syncSort();
        apply();
        syncURL(); // renderCats 里可能把失效的分类回落成「全部」，地址栏跟着更正
        /* 本地预览时轮询索引：编辑器里增删改文章（自动重建 posts.json）后列表自动刷新 */
        if (localPreview) {
          var polling = false;
          setInterval(function () {
            if (document.hidden || polling) return;
            polling = true;
            fetch("posts.json", { cache: contentCache })
              .then(function (r) { return r.ok ? r.json() : null; })
              .then(function (data) {
                if (!data) return;
                var raw = JSON.stringify(data.posts || []);
                if (raw === window.__POSTS_RAW__) return;
                window.__POSTS_RAW__ = raw;
                window.__POSTS__ = data.posts || [];
                renderCats();
                apply();
              })
              .catch(function () {})
              .finally(function () { polling = false; });
          }, 4000);
        }
      })
      .catch(function () {
        grid.innerHTML = '<div class="empty">😅 读取 posts.json 失败。<br>请先运行 <code>python build.py</code>，并用本地服务器访问（如 <code>python -m http.server 8000</code>）。</div>';
      });
  }

  /* ---------- 启动 ---------- */
  function boot() {
    initHomeCover();
    initNavScroll();
    initVideo();
    initPetals();
    initReveal();
    initIndex();
    initHeroFx();
    initCardTilt();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
