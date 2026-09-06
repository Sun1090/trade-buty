import glossaryData from "./glossary-data.json";

/**
 * 术语表词条（R10.13 双语扩展后的结构化数据）。
 * 数据源：src/lib/glossary-data.json（单一事实来源，供页面/脚本/测试共用）。
 */
export interface GlossaryTerm {
  /** 中文主词 */
  term: string;
  /** 英文主词 */
  en: string;
  /** 中文定义 */
  def: string;
  /** 英文定义 */
  defEn: string;
}

export const GLOSSARY_TERMS: GlossaryTerm[] = glossaryData as GlossaryTerm[];

export const GLOSSARY_COUNT = GLOSSARY_TERMS.length;
