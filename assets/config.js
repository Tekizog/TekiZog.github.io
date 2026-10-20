/* ==========================================================
   樱花街道主题 · 站点配置
   改完这个文件保存刷新即可生效，不需要重新构建。
   （只有 新增/删除 文章 时才需要跑一次 python build.py）
   ========================================================== */
window.SAKURA_CONFIG = {

  /* ---------- 基础信息 ---------- */
  siteName: "樱花街道",                          // 站点名称（导航栏 / 首页大标题）
  jpName:   "桜の街道",                           // 日文装饰副标题，留空 "" 则隐藏
  tagline:  "把日常写成诗，落在樱花飘落的街角。",   // 首页一句话签名
  sideText: "桜舞う街角、物語は続く。",            // 首页右侧竖排日文（宽屏才显示）

  aboutTitle: "关于这条街",
  about: "你好，欢迎来到「樱花街道」。这里记录我的代码、随笔、动漫和生活的碎片。" +
         "把想说的话慢慢写成手记，剩下的交给风和樱花。",

  github: "https://github.com/Tekizog",   // 你的 GitHub 链接（导航栏显示），可改成具体仓库地址
  siteUrl: "",           // 部署后的完整地址（用于 RSS 订阅），如 "https://yourname.github.io/blog/"
  footer: "© 2026 樱花街道 · Sakura Street",

  /* ---------- 背景视频 ----------
     hd  ：网络较好时的版本（1080p，约 4.7MB）
     sd  ：普通/慢速网络版本（720p，约 1.5MB）
     手机、省流量模式、开启“减少动态效果”的访客只显示 poster 海报图，不加载视频 */
  video: {
    enabled: true,
    hd:     "assets/video/bg-hd.mp4",   // 1080p 压缩版（4.7MB，仓库里有）
    sd:     "assets/video/bg.mp4",      // 720p 版（1.5MB，慢速网络用）
    poster: "assets/img/poster.webp",        // 桌面海报（1280 宽 WebP，144KB）
    posterSmall: "assets/img/poster-sm.webp", // 手机海报（720 宽，55KB）
  },

  /* ---------- 樱花飘落 ---------- */
  petals: { enabled: true, max: 36 }   // max：同时飘落的最大花瓣数，越多越密
};
