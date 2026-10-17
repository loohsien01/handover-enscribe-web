/**
 * Parse raw SOAP text format (V1) into structured JSON
 * Extracts sections: subjective, objective, assessment, plan, and billingSuggestion
 * Handles key format: "key: value key: value ..."
 */
function parseRawSoapText(rawText) {
    if (!rawText || typeof rawText !== "string") return null;

    const result = {
        soapNote: {
            subjective: "",
            objective: "",
            assessment: "",
            plan: ""
        },
        billingSuggestion: {
            icd10: "",
            cpt: "",
            additional_inquiries: ""
        }
    };

    // Define sections in order they appear
    const sections = ["subjective", "objective", "assessment", "plan"];
    const billingSections = ["icd10", "cpt", "additional_inquiries"];

    // Split by section headers to extract content
    let text = rawText;
    
    // Extract subjective (from "subjective:" to "objective:")
    const subjMatch = text.match(/subjective:\s*([\s\S]*?)(?=objective:|$)/i);
    if (subjMatch) {
        result.soapNote.subjective = subjMatch[1].trim();
    }

    // Extract objective (from "objective:" to "assessment:")
    const objMatch = text.match(/objective:\s*([\s\S]*?)(?=assessment:|evaluation:|$)/i);
    if (objMatch) {
        result.soapNote.objective = objMatch[1].trim();
    }

    // Extract assessment (from "assessment:" to "plan:")
    const assMatch = text.match(/assessment:\s*([\s\S]*?)(?=plan:|$)/i);
    if (assMatch) {
        result.soapNote.assessment = assMatch[1].trim();
    }

    // Extract plan (from "plan:" to "billingSuggestion:")
    const planMatch = text.match(/plan:\s*([\s\S]*?)(?=billingSuggestion:|$)/i);
    if (planMatch) {
        result.soapNote.plan = planMatch[1].trim();
    }

    // Extract billing suggestion sections
    const icdMatch = text.match(/icd10:\s*([\s\S]*?)(?=cpt:|$)/i);
    if (icdMatch) {
        result.billingSuggestion.icd10 = icdMatch[1].trim();
    }

    const cptMatch = text.match(/cpt:\s*([\s\S]*?)(?=additional_inquiries:|$)/i);
    if (cptMatch) {
        result.billingSuggestion.cpt = cptMatch[1].trim();
    }

    const inquiriesMatch = text.match(/additional_inquiries:\s*([\s\S]*?)$/i);
    if (inquiriesMatch) {
        result.billingSuggestion.additional_inquiries = inquiriesMatch[1].trim();
    }

    return result;
}

function parseSoapNotes(input) {
    // Helper to parse and clean a single note
    function parseSingleNote(note) {
        console.log("Parsing note:", note);
        if (typeof note?.soapNote_text === "string") {
            let cleaned = note.soapNote_text
                .replace(/^"+|"+$/g, "")
                .replace(/""/g, '"')
                .replace(/,(\s*[}\]])/g, "$1")
                .replace(/[\u0000-\u001F\u007F-\u009F\u00A0]/g, " ");
            try {
                note.soapNote_text = JSON.parse(cleaned);
            } catch (e) {
                console.error("Failed to parse soapNote_text as JSON:", e);
                // Try parsing as raw V1 format
                const rawParsed = parseRawSoapText(cleaned);
                if (rawParsed && (rawParsed.soapNote.subjective || rawParsed.soapNote.objective)) {
                    console.log("Successfully parsed as raw SOAP format");
                    note.soapNote_text = rawParsed;
                } else {
                    console.error("Failed to parse as raw format too:", cleaned);
                    note.soapNote_text = {
                        error: "Invalid SOAP note format",
                        raw: cleaned,
                    };
                }
            }
        }
        return note;
    }

    if (Array.isArray(input)) {
        return input.map(parseSingleNote);
    } else if (input && typeof input === "object") {
        return parseSingleNote(input);
    } else {
        return input;
    }
}

export default parseSoapNotes;