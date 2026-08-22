import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-28 text-center">
      <p className="font-mono text-6xl font-bold text-accent">404</p>
      <h1 className="mt-6 text-2xl font-bold">
        这一页不存在
        <span className="block mt-2 text-sm font-normal text-muted">
          Page not found — 市场永远都在，页面不一定。
        </span>
      </h1>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link
          href="/zh"
          className="rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-7 py-3 transition"
        >
          回首页 →
        </Link>
        <Link
          href="/zh/path"
          className="rounded-full border border-border-strong px-7 py-3 font-medium hover:border-accent/60 transition"
        >
          学习路线
        </Link>
      </div>
    </div>
  );
}
