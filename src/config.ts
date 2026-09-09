import { photoLibrary as talkImages } from "./data/photos";
import type {
  NavBarLink,
  SocialLink,
  Identity,
  AboutPageContent,
  ProjectPageContent,
  BlogPageContent,
  HomePageContent,
} from "./types/config";

export const identity: Identity = {
  name: "skqfly",
  logo: "/logo.svg",
};

export const navBarLinks: NavBarLink[] = [
  { title: "Blog", url: "/blog" },
  { title: "Projects", url: "/projects" },
  { title: "Talks", url: "/talks" },
  { title: "Friends", url: "/friends" },
];

export const socialLinks: SocialLink[] = [
  {
    title: "GitHub",
    url: "https://github.com/skqfly",
    icon: "mdi:github",
    external: true,
  },
];

export const homePageContent: HomePageContent = {
  seo: {
    title: "skqfly's home",
    description: "skqfly 的个人网站，记录计算数学、科学计算与数学建模。",
    image: identity.logo,
  },
  role: "",
  description: "把复杂问题做成清晰、可复现的方案。",
  socialLinks: [
    ...socialLinks,
    {
      title: "X",
      url: "https://x.com/keqiangsong",
      icon: "mdi:alpha-x",
      external: true,
    },
    {
      title: "Telegram",
      url: "https://t.me/skqfly",
      icon: "mdi:telegram",
      external: true,
    },
    {
      title: "Email",
      url: "mailto:skqfly@gmail.com",
      icon: "mdi:email-outline",
    },
  ],
  links: [
    { title: "Blog", url: "/blog" },
    { title: "Projects", url: "/projects" },
    { title: "Talks", url: "/talks" },
  ],
};

export const aboutPageContent: AboutPageContent = {
  seo: {
    title: "关于 | skqfly",
    description: "了解 skqfly 的研究方向、兴趣与技术栈。",
    image: identity.logo,
  },
  subtitle: "保持好奇，持续计算，也持续记录。",
  about: {
    description: `
我是 **skqfly**，关注计算数学，喜欢科学计算与数学建模。

日常使用 Python、MATLAB、LaTeX 与 FreeFEM，希望把复杂问题整理成清晰、可靠且可复现的方案。`,
  },
  work: {
    description: "目前持续投入的方向与工具。",
    items: [
      {
        title: "计算数学",
        company: {
          name: "研究方向",
          image: identity.logo,
          url: "https://github.com/skqfly",
        },
        date: "Now",
      },
      {
        title: "科学计算与数学建模",
        company: {
          name: "Python · MATLAB · LaTeX · FreeFEM",
          image: identity.logo,
          url: "https://github.com/skqfly?tab=repositories",
        },
        date: "Ongoing",
      },
    ],
  },
  connect: {
    description: "欢迎通过 GitHub 交流学习、研究与合作。",
    links: socialLinks,
  },
};

export const projectsPageContent: ProjectPageContent = {
  seo: {
    title: "Projects | skqfly",
    description: "skqfly 的公开项目与实验。",
    image: identity.logo,
  },
  subtitle: "一些公开项目、实验与个人工具。",
  projects: [
    {
      title: "ImgBed",
      description: "基于 Cloudflare 的开源文件存储、图床与网盘方案。",
      image: "/projects/imgbed.png",
      categories: ["Web", "Open Source"],
      tags: ["Web", "Cloudflare"],
      url: "https://github.com/skqfly/ImgBed",
    },
    {
      title: "nodewarden",
      description: "运行在 Cloudflare Workers 上的第三方 Bitwarden 服务端实现。",
      image: "/projects/nodewarden.png",
      categories: ["Tools", "Open Source"],
      tags: ["Tools", "Workers"],
      url: "https://github.com/skqfly/nodewarden",
    },
  ],
};

export const blogPageContent: BlogPageContent = {
  seo: {
    title: "Blogs | skqfly",
    description: "关于计算、建模与实践的笔记。",
    image: identity.logo,
  },
};

export const talksPageContent = {
  seo: {
    title: "Talks | skqfly",
    description: "skqfly 的演讲、分享与交流记录。",
    image: identity.logo,
  },
  subtitle: "",
  entries: [
    {
      id: "records-beyond-equations",
      title: "记录，是计算之外的另一条线索",
      date: "2026-07-15",
      description:
        "在公式、代码和日常照片之间，记录帮助我把模糊的想法整理成一段可以回看、可以继续推进的过程。",
      images: [],
    },
    {
      id: "observing-scale-between-rocks",
      title: "在岩石缝隙里观察尺度",
      date: "2026-06-06",
      description:
        "从一枚落在石缝里的绿色物体出发，观察形状、纹理与尺度。很多建模问题，也从选择合适的观察尺度开始。",
      images: [talkImages.greenObject],
    },
    {
      id: "geometry-in-everyday-photos",
      title: "圆、线与留白：生活照片里的几何",
      date: "2026-06-03",
      description:
        "圆环、纸面和边缘构成一组简单几何。把生活照片抽象成点、线和区域，是理解图像结构的第一步。",
      images: [talkImages.paperGeometry, talkImages.carWindow],
    },
    {
      id: "blue-hour-by-the-coast",
      title: "海岸线的蓝调时刻",
      date: "2026-06-01",
      description:
        "蓝色天空、海面和远处地平线几乎连成一体。这里记录曝光、色阶与渐变如何共同塑造安静的画面。",
      images: [talkImages.coast, talkImages.nightLights, talkImages.carWindow],
    },
    {
      id: "framing-through-a-car-window",
      title: "车窗之外：移动中的取景",
      date: "2025-12-18",
      description:
        "隔着车窗拍摄，反射、速度与远景叠在同一帧里。这是一段关于运动、边界和偶然构图的短分享。",
      images: [
        talkImages.carWindow,
        talkImages.nightLights,
        talkImages.coast,
        talkImages.caveLight,
      ],
    },
    {
      id: "how-light-changes-space",
      title: "一束光如何改变空间",
      date: "2025-08-09",
      description:
        "洞穴里的局部照明让轮廓突然清晰。借这组照片聊光照、阴影和空间深度之间的关系。",
      images: [
        talkImages.caveLight,
        talkImages.sunlitWalk,
        talkImages.greenObject,
        talkImages.glassCabinet,
        talkImages.paperGeometry,
      ],
    },
    {
      id: "organizing-an-experiment-from-objects",
      title: "从眼前的物件开始整理实验",
      date: "2025-04-12",
      description:
        "从玻璃柜里的排列，到纸面上的几何，实验常常从一个足够小、能够复查的观察记录开始。",
      images: [talkImages.glassCabinet, talkImages.paperGeometry, talkImages.greenObject],
    },
  ],
};

export const friendsPageContent = {
  seo: {
    title: "Friends | skqfly",
    description: "skqfly 的朋友们与值得关注的网站。",
    image: identity.logo,
  },
  subtitle: "朋友们与值得关注的网站。",
  friends: [
    {
      title: "longBlog",
      description: "数学专业在读 · INFJ",
      url: "https://huowenlong.com/",
      domain: "huowenlong.com",
      image: "https://huowenlong.com/favicon.svg",
    },
  ],
};
