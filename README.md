# skqfly.com

skqfly 的个人网站，记录计算数学、科学计算、数学建模与相关实践。

## 技术栈

- **框架**：[Astro](https://astro.build) v6 — 静态站点生成
- **样式**：Tailwind CSS v4 + CSS 自定义属性（亮/暗主题）
- **UI 组件**：React（Talks 画廊）、Astro 组件
- **图标**：[astro-icon](https://github.com/natemoo-re/astro-icon)（Material Design Icons）
- **数学渲染**：KaTeX（`remark-math` + `rehype-katex`）
- **字体**：Inter Variable

## 站点结构

```
src/
├── assets/          # 静态资源（头像等）
├── components/      # UI 组件
│   └── talks/       # Talks 页面 React 组件
├── content/
│   └── posts/       # 博客文章（Markdown）
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

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 生产构建
npm run build

# 本地预览构建结果
npm run preview
```

## 内容管理

### 博客文章

文章位于 `src/content/posts/`，使用 Markdown 格式，支持数学公式（KaTeX）。

每篇文章需包含 frontmatter：

```yaml
---
title: 文章标题
pubDate: 2026-01-01
category: 分类名
description: 文章简介
---
```

### 站点配置

`src/config.ts` 集中管理导航栏、社交链接、首页内容等，修改后自动生效。

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
- 预加载导航（`prefetch: true`）
- 摄影作品画廊（支持固定/原始比例切换）

## 部署

站点已配置 GitHub Pages 部署，推送到 `main` 分支后自动构建发布。

