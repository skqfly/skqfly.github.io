import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

const escapeXml = (value: string) =>
  value.replace(/[<>&'\"]/g, (character) => {
    const entities: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      "'": "&apos;",
      '"': "&quot;",
    };

    return entities[character];
  });

export const GET: APIRoute = async ({ url }) => {
  const posts = await getCollection("posts");
  posts.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());

  const origin = url.origin;
  const items = posts
    .map((post) => {
      const link = new URL(`/blog/${post.id}`, origin).href;

      return `<item>
  <title>${escapeXml(post.data.title)}</title>
  <link>${escapeXml(link)}</link>
  <guid>${escapeXml(link)}</guid>
  <pubDate>${post.data.pubDate.toUTCString()}</pubDate>
  <description>${escapeXml(post.data.description)}</description>
</item>`;
    })
    .join("\n");

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>skqfly</title>
  <link>${escapeXml(new URL("/blog", origin).href)}</link>
  <description>关于计算、建模与实践的笔记。</description>
  <language>zh-CN</language>
  ${items}
</channel>
</rss>`;

  return new Response(feed, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
};
