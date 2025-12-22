interface PrintStyleProps {
  orientation?: 'portrait' | 'landscape';
}

export default function PrintStyle({ orientation = 'portrait' }: PrintStyleProps) {
  return (
    <style jsx global>{`
      @media print {
        @page { 
          size: A4 ${orientation === 'landscape' ? 'landscape' : 'portrait'}; 
          margin: 0; /* 🟢 打印时无边距，由内容自己控制 */
        }
        html, body { 
          margin: 0 !important; 
          padding: 0 !important; 
          background: white !important; 
          height: auto !important; 
          overflow: visible !important; 
        }
        body * { visibility: hidden; }
        #print-area, #print-area * { visibility: visible; }
        #print-area { 
          position: absolute !important; 
          left: 0 !important; 
          top: 0 !important; 
          width: 100% !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important; 
          background: white !important; 
          box-shadow: none !important;
          z-index: 99999; 
        }
        #print-area table { 
          width: 100% !important; 
          border-collapse: collapse !important; 
          table-layout: fixed; 
          border: 1px solid #000 !important; /* 🟢 强制黑色边框 */
          page-break-inside: auto !important;
        }
        #print-area table col { 
          /* 确保 col 标签中的宽度被尊重 */
          width: auto !important; 
        }
        #print-area table td, #print-area table th { 
          word-wrap: break-word;
          overflow-wrap: break-word;
          white-space: normal !important; 
          padding: 2px 4px !important;
          border: 1px solid #000 !important; /* 🟢 强制黑色边框 */
          page-break-inside: avoid !important; /* 🟢 避免单元格跨页 */
        }
        /* 🟢 作业单编号打印样式 */
        .permit-code {
          font-size: 8px !important;
          color: #000 !important;
          background: transparent !important;
          border: none !important;
          font-weight: 500 !important;
        }
        /* 🟢 新增：隐藏水印 */
        .watermark-layer {
          display: none !important;
        }
        ::-webkit-scrollbar { display: none; }
        * { 
          -webkit-print-color-adjust: exact !important; 
          print-color-adjust: exact !important; 
        }
        tr { 
          break-inside: avoid; 
          page-break-inside: avoid; 
        }
      }
    `}</style>
  );
}