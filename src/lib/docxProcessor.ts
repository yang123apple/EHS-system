/**
 * src/lib/docxProcessor.ts
 *
 * Word 文档 HTML 后处理工具：
 *   1. 向所有 <h2> / <h3> 注入唯一锚点 id 属性
 *   2. 提取带层级嵌套的目录（TOC）JSON 数组
 *   3. 检测标题文字是否已含数字编号（用于前端决策是否启用 CSS Counter）
 *
 * 约定：
 *   - id 格式：doc-heading-{0,1,2,...}（按文档顺序递增）
 *   - H1 不纳入目录（通常是文件大标题）
 *   - H3 挂在其前最近的 H2 之下；若前无 H2 则作顶层节点
 */

export interface TocItem {
  id: string;
  title: string;
  level: 2 | 3;
  children: TocItem[];
}

export interface ProcessDocxResult {
  html: string;
  toc: TocItem[];
  /** true = 标题文字中已含数字编号，前端应关闭 CSS Counter 避免双重编号 */
  hasExistingNumbers: boolean;
}

/** 解码常见 HTML 实体，防止 TOC 里出现 &amp; 等字面量 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

/**
 * 判断标题纯文本是否以数字编号开头（如 "1 总则"、"1.1 范围"、"2.3.1 xxx"）。
 * 用于自动检测是否需要关闭 CSS Counter 以避免双重编号。
 */
const NUMERIC_PREFIX_RE = /^\d+(\.\d+)*[\s\u3000\uff0e\u3001]/;

/**
 * 处理 Mammoth 输出的原始 HTML，注入 id 并生成目录树。
 *
 * @param rawHtml  Mammoth convertToHtml 返回的原始 HTML 字符串
 */
export function processDocxHtml(rawHtml: string): ProcessDocxResult {
  let counter = 0;
  const toc: TocItem[] = [];
  let currentH2: TocItem | null = null;
  let numberedCount = 0;
  let totalHeadings = 0;

  /**
   * 正则说明：
   *   (h[23])          捕获组1：标签名（h2 或 h3）
   *   ([^>]*)          捕获组2：标签属性（不含 >）
   *   ([\s\S]*?)       捕获组3：内容（懒惰匹配，不跨越下一个关闭标签）
   *   <\/\1>           反向引用：必须与开标签名一致，防止 <h2>...</h3> 误匹配
   *   gi               全局 + 忽略大小写
   */
  const html = rawHtml.replace(
    /<(h[23])([^>]*)>([\s\S]*?)<\/\1>/gi,
    (_match, tag: string, attrs: string, content: string) => {
      const level = parseInt(tag.charAt(1), 10) as 2 | 3;
      const id = `doc-heading-${counter++}`;
      totalHeadings++;

      // 1. 剥掉内部 HTML 标签
      // 2. 解码 HTML 实体（&amp; → & 等），防止 TOC 显示乱码
      const rawTitle = content.replace(/<[^>]+>/g, '').trim();
      const title = decodeHtmlEntities(rawTitle);

      if (NUMERIC_PREFIX_RE.test(title)) numberedCount++;

      const item: TocItem = { id, title, level, children: [] };

      if (level === 2) {
        toc.push(item);
        currentH2 = item;
      } else {
        (currentH2 ? currentH2.children : toc).push(item);
      }

      // 保留原有属性，覆盖已有 id（兼容双引号与单引号写法）
      const cleanedAttrs = attrs
        .replace(/\s+id\s*=\s*"[^"]*"/gi, '')
        .replace(/\s+id\s*=\s*'[^']*'/gi, '');

      return `<${tag}${cleanedAttrs} id="${id}">${content}</${tag}>`;
    }
  );

  // 若超过一半的标题已有数字前缀，认定为"原文已编号"
  const hasExistingNumbers = totalHeadings > 0 && numberedCount / totalHeadings > 0.5;

  return { html, toc, hasExistingNumbers };
}
