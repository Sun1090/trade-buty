import type { ReactElement } from "react";

/** Serialize JSON-LD without allowing a stored string to close the script element. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, (char) => {
    switch (char) {
      case "<":
        return "\\u003c";
      case ">":
        return "\\u003e";
      case "&":
        return "\\u0026";
      case "\u2028":
        return "\\u2028";
      default:
        return "\\u2029";
    }
  });
}

/**
 * R8.10：结构化数据 JSON-LD 组件。
 * - 渲染 `<script type="application/ld+json">`，内容用安全 JSON 序列化
 * - 数据用 unknown 类型，由调用方保证 shape 合法（schema.org）
 * - 服务端渲染，无客户端开销
 */
export function JsonLd({ data }: { data: unknown }): ReactElement {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: serializeJsonLd(data),
      }}
    />
  );
}
