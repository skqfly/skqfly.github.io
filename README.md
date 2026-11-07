# mmddskq.top

skqfly 的个人网站，记录计算数学、科学计算、数学建模与相关实践。

## 技术栈

- **框架**：[Astro](https://astro.build) v6 — 静态站点生成
- **样式**：Tailwind CSS v4 + CSS 自定义属性（亮/暗主题）
- **UI 组件**：Astro 静态组件 + 原生浏览器脚本
- **图标**：[astro-icon](https://github.com/natemoo-re/astro-icon)（Material Design Icons）
- **数学渲染**：KaTeX（`remark-math` + `rehype-katex`）
- **字体**：Inter Variable

## 站点结构

```
src/
├── assets/          # 静态资源（头像等）
├── components/      # UI 组件
│   └── talks/       # Talks 静态时间线组件
├── content/
│   └── posts/       # 博客文章（Markdown）
├── data/            # 共用照片数据
├── layouts/         # 页面布局
├── pages/           # 路由页面
│   ├── blog/        # Blog 列表 & 文章页
│   ├── index.astro  # 首页
│   ├── about.astro
│   ├── friends.astro
│   ├── photos.astro
│   ├── projects.astro
│   └── talks.astro
├── styles/          # 全局样式
└── config.ts        # 站点配置（导航、链接、社交等）
```

## 本地开发

推荐 Node.js 24（最低 22.18），与 CloudBase 构建环境保持一致。

```bash
# 安装依赖
npm ci

# 启动开发服务器
npm run dev

# 生产构建
npm run build

# 本地预览构建结果
npm run preview
```

## 内容管理

### Trilium 仅发布博客文章

Trilium / Trinote 保留原生文章编辑、文章模板、封面及正文图片、提交 / 下架开关、发布按钮和同步日志。动态、相册、友链、项目及站点设置改由 GitHub / App 管理，旧网页全站面板停用。保存文章后打开“提交发布”，再运行 `trilium-sync.yml`，或等待定时检查；未提交的编辑不会夹带发布。

同步仅写 `src/content/posts/*.md`、`public/trilium-media/` 中文章引用的图片、`trilium/published.json` 与 `trilium/signals.json`。它不再写 `src/data/site.json`、`src/data/photo-library.json` 或 `public/photos/`，不会自动清理共享媒体。已有照片、动态、文章和媒体原样保留。`published.json` 的旧 `site` / `photos` / `ids` 是迁移历史，不能用于恢复或覆盖 App 内容。

- `npm run trilium:check`：发布与迁移边界测试。
- `npm run trilium:preview`：只读远端预览；`npm run trilium:sync`：写本地文章，不自动提交或推送。
- CLI / GitHub Secrets 使用 `TRILIUM_SERVER_URL`、`TRILIUM_ETAPI_TOKEN`；不要把令牌写入源码。
- 文章同步通过显式 dispatch 触发 Pages 部署并记录回执；App 的 GitHub OAuth 提交通过既有 push 工作流部署。
- 旧面板与多分类辅助代码保持休眠；`scope=blog-only` 阻止重装旧面板，原生目录安装器仅维护文章和 Media。

完整操作、节点迁移清单和 App 原子发布约定见 [Trilium 使用说明](trilium/使用说明.md)。停用旧目录不意味着删除网站既有内容，文章和共享原图必须保留。

### 博客文章

文章位于 `src/content/posts/`，使用 Markdown 格式，支持数学公式（KaTeX）。

每篇文章需包含 frontmatter：

```yaml
---
title: 文章标题
pubDate: 2026-01-01
category: 分类名
description: 文章简介
author: skqfly
image:
  url: /logo.svg
  alt: skqfly 标志
---
```

### 站点配置

`src/data/site.json` 保存导航栏、社交链接、首页、动态及其他站点内容，`src/config.ts` 从中导出配置。修改并提交后由 Pages 构建生效。

### 页面

| 页面 | 路由 | 说明 |
|------|------|------|
| 首页 | `/` | 个人介绍 + 社交链接 |
| Blog | `/blog` | 文章时间线 |
| Projects | `/projects` | 项目展示 |
| Talks | `/talks` | 分享与交流记录 |
| Photos | `/photos` | 摄影作品 |
| Friends | `/friends` | 友情链接 |
| About | `/about` | 关于页 |

## 特性

- 亮色/暗色主题切换（带 clip-path 过渡动画）
- 响应式设计（桌面 + 移动端）
- KaTeX 数学公式渲染
- RSS Feed（`/feed.xml`）
- 鼠标悬停或键盘聚焦时预加载站内导航
- 摄影作品画廊（支持固定/原始比例切换）
- Photos / Talks 共用图片预览，点击图片切换、点击空白关闭，支持方向键和 Escape
- 本地 WebP 缩略图，打开预览时加载图床原图

## 摄影图片

`src/data/photo-library.json` 保存原图地址、尺寸、无障碍 alt 与预览路径，`src/data/photos.ts` 负责类型及导出。相册和灯箱不显示说明文字。
添加或更换图片后运行 `npm run images:generate`，生成 480 / 960 像素的 WebP
预览图，并将 `public/photos/` 的产物一起提交。该命令需要联网读取图床，
日常 `npm run build` 使用已生成的预览图，不依赖图床可用性。
预览图命名为 `<photoLibrary 中的键名>-480.webp` 和 `-960.webp`，
应与数据中的 `preview`、`previewLarge` 路径一致。

## 部署

站点已配置 GitHub Pages 部署，推送到 `main` 分支后自动构建发布。

CloudBase 静态网站托管：框架选 Astro，Node.js 24，目标目录 `./`，
安装命令 `npm ci`，构建命令 `npm run build`，产物目录 `./dist`，部署路径 `/`。
无需环境变量。正式域名由 `astro.config.mjs` 的 `site` 配置维护，
用于 canonical、分享链接和 RSS；绑定新域名时一起更新。

### 相册图片

相册使用 `src/data/photo-library.json`，Talks 配图保存在 `src/data/site.json` 的 `talksPageContent.entries[].images`，图片保存在 `public/photos/`，随网站部署，不依赖外部图床。当前 11 张照片使用原图生成的最长边 2560 像素 WebP 大图，另外 2 张暂用已有 960 像素宽版本。App 新上传的 JPG 可提交到 `public/photos/` 并使用 `/photos/*.jpg` 路径；既有 WebP 保留。

新增照片时，将图片放入 `public/photos/`，在照片数据中填写以 `/photos/` 开头的站内路径，再运行 `npm run images:generate` 生成 480/960 像素宽预览图。该命令只读取本地文件；若源文件本身就是目标预览图，会保留源文件以避免重复压缩。
