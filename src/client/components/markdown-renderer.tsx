import { cn } from "cn";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

type MarkdownRendererProps = {
  content: string;
  className?: string;
  resolveImageSrc?: (src: string) => string;
};

export function MarkdownRenderer({
  content,
  className,
  resolveImageSrc,
}: MarkdownRendererProps) {
  return (
    <div className={cn("markdown-body", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug, [rehypeHighlight, { detect: true }]]}
        components={{
          a: ({ href, children, node, ...props }) => {
            void node;
            if (
              typeof href === "string" &&
              href.startsWith("/") &&
              !href.startsWith("//") &&
              !href.startsWith("/api/")
            ) {
              return (
                <Link to={href} {...props}>
                  {children}
                </Link>
              );
            }
            return (
              <a href={href} {...props}>
                {children}
              </a>
            );
          },
          ...(resolveImageSrc
            ? {
                img: ({ src, alt, node, ...props }) => {
                  void node;
                  return (
                    <img
                      src={
                        typeof src === "string" ? resolveImageSrc(src) : src
                      }
                      alt={alt ?? ""}
                      {...props}
                    />
                  );
                },
              }
            : {}),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

