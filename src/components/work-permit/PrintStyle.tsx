interface PrintStyleProps {
  orientation?: 'portrait' | 'landscape';
}

export default function PrintStyle({ orientation = 'portrait' }: PrintStyleProps) {
  return (
    <style jsx global>{`
      @media print {
        /* 修改4：彻底清空 @page 边距，通过内部 padding 控制 */
        @page { 
          size: A4 ${orientation === 'landscape' ? 'landscape' : 'portrait'}; 
          margin: 0 !important;
        }
        
        /* 最强力的 HTML/Body 重置 */
        * {
          box-sizing: border-box !important;
        }
        
        html {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          height: 100% !important;
        }
        
        /* 步骤1：移除绝对定位，使用流式布局 */
        html, body { 
          margin: 0 !important; 
          padding: 0 !important; 
          background: white !important; 
          width: 100% !important;
          height: 100% !important;
          overflow: visible !important;
          box-sizing: border-box !important;
          position: relative !important;
        }
        
        /* 修改1：改用 display: none 完全移除非打印元素，不占据空间 */
        body > *:not(:has(#print-area)) { 
          display: none !important; 
        }
        
        /* 强制重置所有可能影响的父容器 */
        body > div,
        body > div > div,
        body > div > div > div {
          margin: 0 !important;
          padding: 0 !important;
          position: static !important;
        }
        
        /* 修改2：使用相对定位，回归文档流 */
        #print-area { 
          position: relative !important;
          display: block !important;
          /* 修改3：使用标准 100% 宽度，移除 zoom */
          width: 100% !important;
          max-width: 100% !important;
          height: auto !important;
          min-height: 0 !important;  /* 移除固定最小高度，避免下方空白 */
          margin: 0 !important;
          /* 通过 padding 控制内部留白 */
          padding: 10mm !important; 
          background: white !important; 
          box-shadow: none !important;
          box-sizing: border-box !important;
        }
        
        /* 移除所有父容器的干扰 */
        #print-area::before,
        #print-area::after {
          display: none !important;
        }
        
        /* 表格样式优化 */
        #print-area table { 
          width: 100% !important; 
          border-collapse: collapse !important; 
          table-layout: fixed !important;  /* 使用固定布局保持列宽一致 */
          border: 1px solid #000 !important;
          border-color: #000 !important;  /* 强制黑色边框 */
          page-break-inside: auto !important;
          margin: 0 !important;
          background: transparent !important;  /* 移除表格背景 */
        }
        
        /* 确保所有行都有边框且无背景 */
        #print-area table tr {
          border: 1px solid #000 !important;
          background: transparent !important;
        }
        
        #print-area table col { 
          /* 保持 col 标签定义的宽度 */
        }
        
        #print-area table td, 
        #print-area table th { 
          word-wrap: break-word !important;
          overflow-wrap: break-word !important;
          white-space: normal !important; 
          padding: 2px 4px !important;
          border: 1px solid #000 !important;
          border-color: #000 !important;  /* 强制黑色边框 */
          page-break-inside: avoid !important;
          box-sizing: border-box !important;
          min-height: 20px !important;  /* 确保单元格有最小高度 */
          background: transparent !important;  /* 移除背景色，防止遮挡边框 */
          background-color: transparent !important;
        }
        
        /* 确保合并单元格也有边框 */
        #print-area table td[rowspan],
        #print-area table td[colspan] {
          border: 1px solid #000 !important;
          background: transparent !important;
        }
        
        /* 作业单编号样式 */
        .permit-code {
          font-size: 8px !important;
          color: #000 !important;
          background: transparent !important;
          border: none !important;
          font-weight: 500 !important;
        }
        
        /* 隐藏水印 */
        .watermark-layer {
          display: none !important;
        }
        
        /* 🟢 打印空白表单时隐藏占位符和按钮 */
        #print-area button {
          display: none !important;
        }
        
        #print-area input[type="text"]:not([value]),
        #print-area input[type="text"][value=""] {
          border: none !important;
          background: transparent !important;
        }
        
        /* 隐藏空值占位符 (/) */
        #print-area .text-slate-200.select-none {
          display: none !important;
        }
        
        /* 隐藏签字占位提示：待...签核、待审批等 */
        #print-area .bg-amber-50.text-amber-700.italic.select-none,
        #print-area .bg-slate-50.text-slate-500.italic.select-none,
        #print-area .bg-blue-50\/30 {
          background: transparent !important;
          color: transparent !important;
        }
        
        #print-area .bg-amber-50.text-amber-700.italic.select-none span,
        #print-area .bg-slate-50.text-slate-500.italic.select-none span {
          display: none !important;
        }
        
        /* 隐藏审批人下拉选择框 */
        #print-area select {
          display: none !important;
        }
        
        /* 隐藏未选中的选项框 */
        #print-area .border-slate-300 {
          /* 保留边框但使用更淡的颜色 */
        }
        
        /* 隐藏滚动条 */
        ::-webkit-scrollbar { 
          display: none !important; 
        }
        
        /* 强制显示背景色和边框 */
        * { 
          -webkit-print-color-adjust: exact !important; 
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        
        /* 避免表格行跨页断裂 */
        tr { 
          break-inside: avoid !important; 
          page-break-inside: avoid !important; 
        }
        
        /* 步骤3：强制重置所有可能影响的元素 */
        body > div,
        body > div > div {
          margin: 0 !important;
          padding: 0 !important;
        }
      }
    `}</style>
  );
}