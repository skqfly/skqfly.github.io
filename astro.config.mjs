import { defineConfig } from "astro/config";
import icon from "astro-icon";
import react from "@astrojs/react";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { remarkReadingTime } from "./remark-reading-time.mjs";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://mmddskq.top",

  integrations: [icon(), react()],

  devToolbar: {
    enabled: false,
  },

  markdown: {
    remarkPlugins: [remarkMath, remarkReadingTime],
    rehypePlugins: [rehypeKatex],
  },

  vite: {
    plugins: [tailwindcss()],
  },
});
