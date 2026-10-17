/**
 * Build the Nova user message for visit prep turn 1 (instructions + prior records).
 *
 * @param {string[]} charts Non-empty chart bodies in visit order
 * @param {string} instructions Clinician formatting / tone instructions
 * @param {string} [instructionTitle] Saved template / instruction name shown to Nova
 */
export function formatVisitPrepUserMessage(charts, instructions, instructionTitle = '') {
  const trimmedCharts = charts.map((c) => c.trim()).filter(Boolean);
  const trimmedInstructions = instructions.trim();
  const trimmedTitle = instructionTitle.trim();

  const parts = [];
  if (trimmedInstructions || trimmedTitle) {
    const instructionLines = [];
    if (trimmedTitle) {
      instructionLines.push(`--- Instructions: ${trimmedTitle} ---`);
    }
    if (trimmedInstructions) {
      instructionLines.push(trimmedInstructions);
    }
    parts.push(instructionLines.join('\n'));
  }
  if (trimmedCharts.length) {
    const blocks = trimmedCharts.map(
      (text, index) => `------- Prior visit ${index + 1} -------\n${text}`,
    );
    parts.push(blocks.join('\n\n'));
  }
  return parts.join('\n\n');
}
