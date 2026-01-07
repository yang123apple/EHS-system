// src/lib/htmlSanitizer.ts
// HTML 内容清理工具，用于防止 XSS 攻击
// 注意：这是一个简单的清理函数，对于生产环境，建议使用 DOMPurify 等专业库

/**
 * 清理 HTML 内容，移除潜在的 XSS 攻击代码
 * 保留基本的 HTML 标签用于文档显示
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  // 移除 script 标签及其内容
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // 移除 on* 事件处理器（如 onclick, onerror 等）
  html = html.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  html = html.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');
  
  // 移除 javascript: 协议
  html = html.replace(/javascript:/gi, '');
  
  // 移除 data: 协议（可能包含恶意代码）
  html = html.replace(/data:text\/html/gi, '');
  
  // 移除 iframe（除非是受信任的来源）
  html = html.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  
  // 移除 object 和 embed 标签
  html = html.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
  html = html.replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '');
  
  // 移除 style 标签中的 expression 和 javascript
  html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, (match) => {
    return match.replace(/expression\s*\(/gi, '');
  });
  
  return html;
}

/**
 * 清理用于搜索高亮的 HTML 内容
 * 只保留基本的格式化标签
 */
export function sanitizeHighlightHtml(html: string): string {
  if (!html) return '';
  
  // 只允许基本的格式化标签
  const allowedTags = ['span', 'strong', 'em', 'b', 'i', 'u'];
  const tagPattern = new RegExp(
    `</?(?!(${allowedTags.join('|')})\\b)[^>]+>`,
    'gi'
  );
  
  let cleaned = html.replace(tagPattern, '');
  
  // 移除所有事件处理器
  cleaned = cleaned.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  cleaned = cleaned.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');
  
  return cleaned;
}
