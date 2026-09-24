import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkCjkFriendly from "remark-cjk-friendly";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import Link from "next/link";

// rewriteLinks 把课文里的相对链接改写成 /{locale}/knowledge/…，正文里的 #锚点 也在本页
const INTERNAL_HREF = /^(?:#|\/(?:[a-z]{2}\/)?knowledge\/)/;

function isInternal(href?: string) {
  return !!href && INTERNAL_HREF.test(href);
}

export function Markdown({
  content,
  interactiveImages = false,
  interactiveImageLabel,
}: {
  content: string;
  interactiveImages?: boolean;
  interactiveImageLabel?: string;
}) {
  return (
    <div className="kb-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkCjkFriendly]}
        rehypePlugins={[rehypeRaw, rehypeSlug]}
        components={{
          a({ href, children, ...props }) {
            if (isInternal(href)) {
              return (
                <Link href={href!} {...props}>
                  {children}
                </Link>
              );
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                {children}
                <span className="ml-0.5 text-faint text-[0.85em]" aria-hidden>↗</span>
              </a>
            );
          },
          img({ src, alt }) {
            // 知识库图片来自 submodule 静态资产，用原生 img 避免 next/image 路径处理开销
            const interactiveProps = interactiveImages
              ? {
                  role: "button" as const,
                  tabIndex: 0,
                  "aria-haspopup": "dialog" as const,
                  ...(!alt && interactiveImageLabel
                    ? { "aria-label": interactiveImageLabel }
                    : {}),
                  className: "cursor-zoom-in",
                }
              : {};
            // eslint-disable-next-line @next/next/no-img-element
            return <img src={src} alt={alt ?? ""} loading="lazy" {...interactiveProps} />;
          },
          pre({ children, ...props }) {
            // 提取语言标签显示在代码块右上角
            const codeEl = children as React.ReactElement<{ className?: string }>;
            const lang = codeEl?.props?.className?.replace("language-", "") || "";
            return (
              <div className="relative">
                {lang && (
                  <span className="absolute right-3 top-1.5 text-[10px] font-mono text-muted pointer-events-none select-none uppercase">
                    {lang}
                  </span>
                )}
                <pre {...props}>{children}</pre>
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
