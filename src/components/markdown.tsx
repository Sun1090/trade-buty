import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkCjkFriendly from "remark-cjk-friendly";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import Link from "next/link";
import { isValidElement } from "react";

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
          table({ children, ...props }) {
            // 宽表格在窄屏横向滚动：可滚动区域必须可键盘聚焦（axe
            // scrollable-region-focusable），否则键盘用户滚不到被裁掉的列
            return (
              <table tabIndex={0} {...props}>
                {children}
              </table>
            );
          },
          pre({ children, ...props }) {
            // 提取语言标签显示在代码块右上角
            const codeEl = children as React.ReactElement<{ className?: string }>;
            const lang = codeEl?.props?.className?.replace("language-", "") || "";
            // 窄屏横向滚动的代码块必须可键盘聚焦（axe scrollable-region-focusable），
            // 否则键盘用户看不到被裁掉的部分
            return (
              <div className="relative">
                {lang && (
                  <span className="absolute right-3 top-1.5 text-[10px] font-mono text-muted pointer-events-none select-none uppercase">
                    {lang}
                  </span>
                )}
                <pre tabIndex={0} {...props}>{children}</pre>
              </div>
            );
          },
          li({ children, ...props }) {
            // GFM 任务清单渲染出的复选框是 disabled 的裸 input，label 文本只是
            // 它的兄弟节点——读屏拿到的是 8 个没有名字的复选框（axe label，critical）。
            // 把清单项内容包进 label，包裹即关联。内容库现状全部是平铺清单；万一
            // 上游出现嵌套清单，嵌套 label 是非法 HTML，这里检测到就退回不包裹。
            const cls = typeof props.className === "string" ? props.className : "";
            const arr = Array.isArray(children) ? children : [children];
            const hasNestedList = arr.some(
              (child) => isValidElement(child) && (child.type === "ul" || child.type === "ol"),
            );
            if (!cls.includes("task-list-item") || hasNestedList) {
              return <li {...props}>{children}</li>;
            }
            return <li {...props}><label>{children}</label></li>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
