import { defineConfig } from "astro/config";
import icon from "astro-icon";
import { unified } from "@astrojs/markdown-remark";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { remarkReadingTime } from "./remark-reading-time.mjs";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://mmddskq.top",

  prefetch: { prefetchAll: true, defaultStrategy: "hover" },

  integrations: [icon()],

  devToolbar: {
    enabled: false,
  },

  markdown: {
    shikiConfig: {
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false,
      wrap: false,
    },
    processor: unified({
      remarkPlugins: [remarkMath, remarkReadingTime],
      rehypePlugins: [rehypeKatex],
    }),
  },

  vite: {
    plugins: [tailwindcss()],
  },
});
