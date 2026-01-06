/**
 * A4 Column Width Calculator
 * 
 * Pure TypeScript utility for calculating column widths that fit within A4 printable area.
 * Uses content-aware weighted distribution with CJK character support.
 * 
 * @module a4-column-width
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** A4 paper width at 96 DPI (portrait orientation) */
const A4_WIDTH_PX = 794;

/** Total horizontal margins (left + right) in pixels */
const A4_MARGINS_PX = 50;

/** Safe printable width (A4_WIDTH - margins) */
const PRINTABLE_WIDTH_PX = A4_WIDTH_PX - A4_MARGINS_PX; // 744px

/** Target usable width (slightly conservative for safety) */
const TARGET_USABLE_WIDTH = 700;

/** Minimum column width to prevent collapse */
const MIN_COLUMN_WIDTH = 40;

/** Maximum column width to prevent one column dominating */
const MAX_COLUMN_WIDTH = 300;

/** Average pixel width per ASCII character (monospace approximation) */
const ASCII_CHAR_WIDTH = 7;

/** Average pixel width per CJK character (typically 1.8-2x ASCII) */
const CJK_CHAR_WIDTH = 14;

/** Padding per cell (left + right) */
const CELL_PADDING = 16;

/**
 * Maximum character count to consider for width calculation.
 * Content longer than this will be assumed to wrap.
 */
const MAX_CHARS_FOR_WIDTH = 50;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Checks if a character is CJK (Chinese, Japanese, Korean).
 * 
 * Uses Unicode ranges:
 * - 0x4E00-0x9FFF: CJK Unified Ideographs
 * - 0x3400-0x4DBF: CJK Extension A
 * - 0xF900-0xFAFF: CJK Compatibility Ideographs
 * - 0x3040-0x309F: Hiragana
 * - 0x30A0-0x30FF: Katakana
 * - 0xAC00-0xD7AF: Hangul Syllables
 * 
 * @param char - Single character to test
 * @returns true if character is CJK
 */
function isCJKCharacter(char: string): boolean {
  const code = char.charCodeAt(0);
  return (
    (code >= 0x4E00 && code <= 0x9FFF) ||   // CJK Unified Ideographs
    (code >= 0x3400 && code <= 0x4DBF) ||   // CJK Extension A
    (code >= 0x20000 && code <= 0x2A6DF) || // CJK Extension B
    (code >= 0xF900 && code <= 0xFAFF) ||   // CJK Compatibility
    (code >= 0x3040 && code <= 0x309F) ||   // Hiragana
    (code >= 0x30A0 && code <= 0x30FF) ||   // Katakana
    (code >= 0xAC00 && code <= 0xD7AF)      // Hangul
  );
}

/**
 * Calculates the display width of a string in pixels.
 * 
 * Algorithm:
 * 1. Iterate through each character
 * 2. CJK characters count as 2 units (wider)
 * 3. ASCII/Numbers count as 1 unit (narrower)
 * 4. Convert units to pixels using character width constants
 * 5. Add cell padding
 * 
 * @param text - String to measure
 * @returns Estimated pixel width
 */
export function calculateStringWidth(text: string): number {
  if (!text || text.length === 0) return CELL_PADDING;

  let cjkCount = 0;
  let asciiCount = 0;

  // Count CJK vs ASCII characters
  for (const char of text) {
    if (isCJKCharacter(char)) {
      cjkCount++;
    } else {
      asciiCount++;
    }
  }

  // Calculate pixel width
  const contentWidth = (cjkCount * CJK_CHAR_WIDTH) + (asciiCount * ASCII_CHAR_WIDTH);
  
  return contentWidth + CELL_PADDING;
}

/**
 * Calculates the "weight" of a column based on its content.
 * 
 * Weight represents the relative width demand of a column.
 * 
 * Algorithm:
 * 1. Find the longest text in the column (across all rows)
 * 2. Truncate to MAX_CHARS_FOR_WIDTH (assume wrapping beyond this)
 * 3. Calculate string width using CJK-aware logic
 * 4. Return the width as the column's weight
 * 
 * @param columnData - Array of cell values in a column
 * @returns Weight value (in pixels)
 */
function calculateColumnWeight(columnData: any[]): number {
  let maxWidth = 0;

  for (const cell of columnData) {
    // Convert to string and handle null/undefined
    const text = cell != null ? String(cell) : '';
    
    // Truncate if too long (assume wrapping)
    const truncatedText = text.length > MAX_CHARS_FOR_WIDTH 
      ? text.substring(0, MAX_CHARS_FOR_WIDTH)
      : text;
    
    const width = calculateStringWidth(truncatedText);
    maxWidth = Math.max(maxWidth, width);
  }

  return maxWidth;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Calculates column widths that fit within A4 printable area.
 * 
 * Uses a **Weighted Distribution Algorithm**:
 * 
 * 1. **Calculate Weights**: For each column, compute a "weight" based on the
 *    longest content in that column. CJK characters are counted as double-width.
 * 
 * 2. **Sum Total Weight**: Add up all column weights to get the total demand.
 * 
 * 3. **Proportional Distribution**: Each column gets a share of the target
 *    usable width (700px) proportional to its weight:
 *    
 *    columnWidth = (columnWeight / totalWeight) × TARGET_USABLE_WIDTH
 * 
 * 4. **Apply Constraints**:
 *    - Enforce minimum width (40px) to prevent collapse
 *    - Enforce maximum width (300px) to prevent one column dominating
 * 
 * 5. **Redistribute Excess**: If columns hit max/min constraints, redistribute
 *    the excess/deficit space proportionally among remaining columns.
 * 
 * Example:
 * ```
 * Column A: weight = 100px (20%)
 * Column B: weight = 200px (40%)  
 * Column C: weight = 200px (40%)
 * Total: 500px
 * 
 * With 700px target:
 * A gets: 100/500 × 700 = 140px
 * B gets: 200/500 × 700 = 280px
 * C gets: 200/500 × 700 = 280px
 * ```
 * 
 * @param data - 2D array where each row is an array of cell values
 * @returns Array of pixel widths for each column
 * 
 * @example
 * ```typescript
 * const data = [
 *   ['姓名', '部门', 'Email', '状态'],
 *   ['张三', '技术部门', 'zhangsan@example.com', '在职'],
 *   ['李四', '行政部', 'lisi@example.com', '离职']
 * ];
 * 
 * const widths = calculateA4ColumnWidths(data);
 * // Returns: [80, 120, 280, 80] (example output)
 * ```
 */
export function calculateA4ColumnWidths(data: any[][]): number[] {
  if (!data || data.length === 0) return [];
  
  const numColumns = Math.max(...data.map(row => row.length));
  if (numColumns === 0) return [];

  // ========================================================================
  // STEP 1: Calculate weights for each column
  // ========================================================================
  
  const columnWeights: number[] = [];
  
  for (let colIndex = 0; colIndex < numColumns; colIndex++) {
    const columnData = data.map(row => row[colIndex]);
    const weight = calculateColumnWeight(columnData);
    columnWeights.push(weight);
  }

  // ========================================================================
  // STEP 2: Calculate total weight
  // ========================================================================
  
  const totalWeight = columnWeights.reduce((sum, weight) => sum + weight, 0);
  
  // Edge case: all columns are empty
  if (totalWeight === 0) {
    return new Array(numColumns).fill(TARGET_USABLE_WIDTH / numColumns);
  }

  // ========================================================================
  // STEP 3: Proportional distribution with constraints
  // ========================================================================
  
  const columnWidths: number[] = [];
  let constrainedColumns: Set<number> = new Set();
  let remainingWidth = TARGET_USABLE_WIDTH;
  let remainingWeight = totalWeight;

  // First pass: calculate initial widths and identify constrained columns
  for (let i = 0; i < numColumns; i++) {
    const proportionalWidth = (columnWeights[i] / totalWeight) * TARGET_USABLE_WIDTH;
    
    if (proportionalWidth < MIN_COLUMN_WIDTH) {
      columnWidths[i] = MIN_COLUMN_WIDTH;
      constrainedColumns.add(i);
      remainingWidth -= MIN_COLUMN_WIDTH;
      remainingWeight -= columnWeights[i];
    } else if (proportionalWidth > MAX_COLUMN_WIDTH) {
      columnWidths[i] = MAX_COLUMN_WIDTH;
      constrainedColumns.add(i);
      remainingWidth -= MAX_COLUMN_WIDTH;
      remainingWeight -= columnWeights[i];
    } else {
      columnWidths[i] = proportionalWidth;
    }
  }

  // ========================================================================
  // STEP 4: Redistribute space among unconstrained columns
  // ========================================================================
  
  if (constrainedColumns.size > 0 && remainingWeight > 0) {
    for (let i = 0; i < numColumns; i++) {
      if (!constrainedColumns.has(i)) {
        // Recalculate width based on remaining space
        const adjustedWidth = (columnWeights[i] / remainingWeight) * remainingWidth;
        
        // Apply constraints again
        columnWidths[i] = Math.max(
          MIN_COLUMN_WIDTH,
          Math.min(MAX_COLUMN_WIDTH, adjustedWidth)
        );
      }
    }
  }

  // ========================================================================
  // STEP 5: Final adjustment to exactly match target width
  // ========================================================================
  
  const currentTotal = columnWidths.reduce((sum, width) => sum + width, 0);
  const difference = TARGET_USABLE_WIDTH - currentTotal;
  
  if (Math.abs(difference) > 1) {
    // Distribute the difference proportionally
    const scaleFactor = TARGET_USABLE_WIDTH / currentTotal;
    
    for (let i = 0; i < numColumns; i++) {
      columnWidths[i] = Math.round(columnWidths[i] * scaleFactor);
    }
  }

  // ========================================================================
  // STEP 6: Round to integers
  // ========================================================================
  
  return columnWidths.map(width => Math.round(width));
}

// ============================================================================
// ADDITIONAL UTILITIES
// ============================================================================

/**
 * Formats column widths for CSS or inline styles.
 * 
 * @param widths - Array of pixel widths
 * @returns Array of CSS width strings (e.g., ["80px", "120px"])
 */
export function formatWidthsForCSS(widths: number[]): string[] {
  return widths.map(width => `${width}px`);
}

/**
 * Calculates total table width (sum of all columns).
 * 
 * @param widths - Array of pixel widths
 * @returns Total width in pixels
 */
export function getTotalTableWidth(widths: number[]): number {
  return widths.reduce((sum, width) => sum + width, 0);
}

/**
 * Validates if table fits within A4 printable area.
 * 
 * @param widths - Array of pixel widths
 * @returns Object with validation result and details
 */
export function validateA4Fit(widths: number[]): {
  fits: boolean;
  totalWidth: number;
  maxWidth: number;
  overflow: number;
} {
  const totalWidth = getTotalTableWidth(widths);
  const overflow = Math.max(0, totalWidth - PRINTABLE_WIDTH_PX);
  
  return {
    fits: totalWidth <= PRINTABLE_WIDTH_PX,
    totalWidth,
    maxWidth: PRINTABLE_WIDTH_PX,
    overflow
  };
}
