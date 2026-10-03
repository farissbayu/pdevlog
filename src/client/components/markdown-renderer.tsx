import { cn } from "cn";
import ReactMarkdown from "react-markdown";
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
        components={
          resolveImageSrc
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
            : undefined
        }
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
