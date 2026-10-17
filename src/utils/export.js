import jsPDF from "jspdf";
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import { saveAs } from "file-saver";

/**
 * Export patient encounter data as PDF or Word.
 * Only includes sections present in the data object.
 * @param {Object} data - Encounter data.
 * @param {string} data.patientEncounterName - Required.
 * @param {Array<string>} [data.notes] - Plain-text note bodies.
 * @param {"pdf"|"word"} type - Export type.
 */

export async function exportDataAsFile(data, type = "pdf") {
  if (!data?.patientEncounterName) {
    console.error("[exportDataAsFile]: data: ", data);
    alert("Patient encounter name is required for export.");
    return;
  }
  console.log("[exportDataAsFile] Exporting data: ", data);

  if (type === "pdf") {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    let y = 20;

    function addHeader(text, fontSize = 16, spacing = 8, color = "#2563eb") {
      doc.setFontSize(fontSize);
      doc.setTextColor(color);
      y += spacing;
      y = checkAddPage(doc, y);
      doc.text(text, 20, y);
      doc.setTextColor("#000000");
    }

    function addBody(text, fontSize = 12, spacing = 8, color = "#000000") {
      doc.setFontSize(fontSize);
      doc.setTextColor(color);
      // Split on newlines first: splitTextToSize on the whole string drops / merges
      // blank lines between segments (newline-split preserves them).
      const paragraphs = String(text).split(/\r?\n/);
      paragraphs.forEach((segment) => {
        if (segment === "") {
          y += spacing;
          y = checkAddPage(doc, y);
        } else {
          const lines = doc.splitTextToSize(segment, 180);
          lines.forEach((line) => {
            y += spacing;
            y = checkAddPage(doc, y);
            doc.text(line, 20, y);
          });
        }
      });
      doc.setTextColor("#000000");
    }

    addHeader(data.patientEncounterName, 20, 8, "#000000");

    if (Array.isArray(data.notes) && data.notes.length > 0) {
      const noteBodies = data.notes.filter(
        (t) => typeof t === "string" && t.trim()
      );
      noteBodies.forEach((body, idx) => {
        const title = noteBodies.length > 1 ? `Note #${idx + 1}` : "Note";
        addHeader(title, 16, 8);
        addBody(body, 12, 8);
        y += 10;
      });
    }

    doc.save(`${data.patientEncounterName}.pdf`);
  } else if (type === "word") {
    const children = [
      new Paragraph({
        text: data.patientEncounterName,
        heading: HeadingLevel.TITLE,
      }),
    ];

    function coloredParagraph(text, heading, color = "000000", spacing) {
      return new Paragraph({
        text,
        heading,
        color,
        spacing: spacing !== undefined ? spacing : { after: 400 },
      });
    }
    function markdownTextColoredParagraph(
      markdownText,
      heading,
      color = "000000",
      spacing
    ) {
      if (typeof markdownText !== "string") return [];

      const lines = markdownText.split("\n");
      const paragraphs = lines.map((line) => {
        if (line.length === 0) {
          // Word collapses truly empty paragraphs; nbsp keeps blank line height.
          return new Paragraph({
            children: [new TextRun({ text: "\u00a0", color })],
            spacing: spacing?.after !== undefined ? { after: spacing.after } : { after: 120 },
          });
        }
        return coloredParagraph(line, heading, color, spacing);
      });
      return paragraphs;
    }

    if (Array.isArray(data.notes) && data.notes.length > 0) {
      const noteBodies = data.notes.filter(
        (t) => typeof t === "string" && t.trim()
      );
      noteBodies.forEach((text, idx) => {
        const label = noteBodies.length > 1 ? `Note #${idx + 1}` : "Note";
        children.push(
          coloredParagraph(label, HeadingLevel.HEADING_1, "2563eb", {
            before: 400,
            after: 200,
          }),
          ...markdownTextColoredParagraph(text, undefined, "2563eb", {
            after: 160,
          }),
          new Paragraph({ text: "" })
        );
      });
    }

    const doc = new Document({
      sections: [{ children }],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${data.patientEncounterName}.docx`);
  } else {
    throw new Error("Unsupported export type");
  }
}

const PAGE_HEIGHT = 297;
const MARGIN_BOTTOM = 20;

function checkAddPage(doc, y) {
  if (y > PAGE_HEIGHT - MARGIN_BOTTOM) {
    doc.addPage();
    return 20;
  }
  return y;
}
