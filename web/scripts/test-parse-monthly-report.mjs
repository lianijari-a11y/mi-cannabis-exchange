import mammoth from "mammoth";
import fs from "fs";

const files = [
  "/Users/alex/Downloads/March 2026 Monthly Report.docx",
  "/Users/alex/Downloads/April 2026 Monthly Report.docx",
  "/Users/alex/Downloads/May 2026 Monthly Report.docx",
  "/Users/alex/Downloads/June 2026 Monthly Report.docx",
  "/Users/alex/Downloads/July 2026 Monthly Report.docx",
];

for (const f of files) {
  const buffer = fs.readFileSync(f);
  const { value: rawText } = await mammoth.extractRawText({ buffer });
  fs.writeFileSync(f.replace(".docx", ".raw.txt"), rawText);
  console.log(f, "-> extracted", rawText.length, "chars");
}
