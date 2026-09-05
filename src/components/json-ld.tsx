import type { ReactElement } from "react";

/**
 * R8.10：结构化数据 JSON-LD 组件。
 * - 渲染 `<script type="application/ld+json">`，内容用 JSON.stringify 序列化
 * - 数据用 unknown 类型，由调用方保证 shape 合法（schema.org）
 * - 服务端渲染，无客户端开销
 */
export function JsonLd({ data }: { data: unknown }): ReactElement {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data),
      }}
    />
  );
}
