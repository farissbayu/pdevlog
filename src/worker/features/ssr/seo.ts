import type { GuideEntry } from "@/shared/guides/content";

const SITE_NAME = "Personal Dev Log";

const DEFAULT_DESCRIPTION =
  "A private dev log for brag-worthy wins and the lessons behind them. Capture in STAR format, organize by workspace, and keep notes in Markdown.";

export type SeoMeta = {
  title: string;
  description: string;
  path: string;
  ogType: "website" | "article";
  jsonLd: object[];
};

export function landingSeo(origin: string): SeoMeta {
  return {
    title: `${SITE_NAME} – Capture Wins, Learnings & Career Growth`,
    description: DEFAULT_DESCRIPTION,
    path: "/",
    ogType: "website",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: SITE_NAME,
        url: `${origin}/`,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "All",
        browserRequirements: "Requires JavaScript. Requires HTML5.",
      },
    ],
  };
}

export function guideSeo(guide: GuideEntry, origin: string): SeoMeta {
  return {
    title: `${guide.title} – ${SITE_NAME}`,
    description: guide.description || DEFAULT_DESCRIPTION,
    path: `/guides/${guide.slug}`,
    ogType: "article",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        headline: guide.title,
        description: guide.description,
        articleSection: guide.category,
        url: `${origin}/guides/${guide.slug}`,
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Guides",
            item: `${origin}/guides`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: guide.title,
            item: `${origin}/guides/${guide.slug}`,
          },
        ],
      },
    ],
  };
}

export function notFoundSeo(origin: string): SeoMeta {
  return {
    title: `Guide not found – ${SITE_NAME}`,
    description: "This guide does not exist. Browse the available guides instead.",
    path: "/guides",
    ogType: "website",
    jsonLd: [{ "@context": "https://schema.org", "@type": "WebPage", url: `${origin}/guides` }],
  };
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildHeadTags(meta: SeoMeta, origin: string): string {
  const url = `${origin}${meta.path}`;
  const title = escapeAttribute(meta.title);
  const description = escapeAttribute(meta.description);
  const image = `${origin}/og-image.png`;

  const tags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="${meta.ogType}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    ...meta.jsonLd.map(
      (schema) =>
        `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>`,
    ),
  ];

  return tags.join("\n");
}

const REPLACED_HEAD_PATTERN =
  /<title>[\s\S]*?<\/title>|<meta[^>]*(?:name|property)="(?:description|keywords|author|robots|og:[^"]*|twitter:[^"]*)"[^>]*>|<link[^>]*rel="canonical"[^>]*>|<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi;

export function injectSsr(
  template: string,
  parts: { headTags: string; bodyHtml: string; bootstrapScript: string },
): string {
  return template
    .replace(REPLACED_HEAD_PATTERN, "")
    .replace("</head>", `${parts.headTags}\n</head>`)
    .replace('<div id="root"></div>', `<div id="root">${parts.bodyHtml}</div>`)
    .replace("</body>", `${parts.bootstrapScript}\n</body>`);
}
