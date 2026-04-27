/**
 * Writes qa-checklists/NCI-Dates-and-Audit-Test-Cases.pdf
 * Run: node scripts/generate-qa-checklist-pdf.cjs
 */
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const rows = [
  {
    section: "New Case Inward – Entrustment date",
    n: 1,
    plain: "You should not be able to save a case if the entrustment date is in the future.",
    do: "Open New Case Inward. Set Entrustment Date to tomorrow’s date. Try to save.",
    expect: "The system should stop you and show a message that the date cannot be in the future."
  },
  {
    section: "New Case Inward – Entrustment date",
    n: 2,
    plain: "Today’s date for entrustment should be allowed (if everything else is OK).",
    do: "Set Entrustment Date to today. Fill other required fields. Save.",
    expect: "Save should work unless another rule fails (for example transaction control)."
  },
  {
    section: "New Case Inward – Entrustment date",
    n: 3,
    plain:
      "If your office rules say you cannot backdate more than X days on entrustment, check that rule.",
    do: "Ask your admin what “transaction control” says for Entrustment Date (how many days back are allowed). Set the date exactly on the oldest allowed day. Save.",
    expect: "Save should work if all other fields are valid."
  },
  {
    section: "New Case Inward – Entrustment date",
    n: 4,
    plain: "Same rule but one day too old.",
    do: "Set Entrustment Date one day earlier than the oldest allowed day. Save.",
    expect: "The system should reject and mention the limit (for example cannot be older than X days)."
  },
  {
    section: "New Case Inward – NPA date",
    n: 5,
    plain: "You should not save if NPA date is in the future.",
    do: "Set NPA Date to tomorrow. Save.",
    expect: "Should fail with a message that NPA date cannot be in the future."
  },
  {
    section: "New Case Inward – NPA date",
    n: 6,
    plain: "NPA date can be left blank if your form allows it.",
    do: "Leave NPA Date empty if optional. Save with other required fields filled.",
    expect: "Should save if everything else is valid."
  },
  {
    section: "New Case Inward – List and form show the same date",
    n: 7,
    plain: "The date on the list screen and the date when you open edit should match.",
    do: "Save a case with a known entrustment date (for example 15th of this month). Find it in the list. Open edit.",
    expect: "The date in the calendar box should be the same day as in the list (no one-day shift)."
  },
  {
    section: "Amount recovered (child table)",
    n: 8,
    plain: "Some case statuses need money recovered; check that rule.",
    do: "Pick a case status that requires recovery but enter zero recovered amount. Save.",
    expect: "Should ask for recovery or block save with a clear message."
  },
  {
    section: "Amount recovered (child table)",
    n: 9,
    plain: "Same as above but with a real recovered amount.",
    do: "Pick that status. Add a line with recovered amount greater than zero. Save.",
    expect: "Should save if other rules pass."
  },
  {
    section: "Who changed what – on each record",
    n: 10,
    plain: "When you create a new record the system should remember who and when.",
    do: "Create any record that has Created / Modified columns. After save open the record again or check the list if those columns show.",
    expect:
      "You should see who created it and the date-time of create; modified should match create on first save."
  },
  {
    section: "Who changed what – on each record",
    n: 11,
    plain: "When you change a record only “last changed” should move.",
    do: "Edit an existing record. Change one field. Save. Open again.",
    expect: "Created date and creator should stay the same. Modified date-time should be newer."
  },
  {
    section: "Audit log (who did what in the system)",
    n: 12,
    plain: "After you save a business record a line should appear in the audit log.",
    do: "Create or update a record. Open the Audit Logs screen (if you have access). Find the latest entry for that action.",
    expect:
      "You should see who did it, what action (create/update), and a time that looks like Indian office time—not a confusing foreign time zone."
  },
  {
    section: "Audit log",
    n: 13,
    plain: "After delete (if you are allowed).",
    do: "Delete a record if your role allows. Check audit log.",
    expect: "There should be a delete entry with old data captured."
  },
  {
    section: "Permissions grid (if you use it)",
    n: 14,
    plain: "Saving user permissions should stamp dates.",
    do: "Save changes on the user permissions matrix (if you use that screen). Open that user’s permission rows or any screen that shows created/modified on those rows.",
    expect: "Created and modified times should look sensible in Indian time for when you clicked save."
  },
  {
    section: "Printed PDF (New Case Inward)",
    n: 15,
    plain: "The “Printed on” line on the case details PDF should show today’s date in India.",
    do: "Open a case. Print or download Case Details PDF. Read the “Printed on” line.",
    expect: "The date should be today’s calendar date in India (dd-mm-yyyy style)."
  },
  {
    section: "Stress check – dates stay correct",
    n: 16,
    plain: "Sometimes a saved date looked one day wrong in the past; quick check.",
    do: "Pick any saved case. Note the date in the grid. Click edit.",
    expect: "The date in the form must be exactly the same day—not one day before or after."
  },
  {
    section: "Final stage case and editing",
    n: 17,
    plain: "Some users cannot edit a case that is already closed or in a final stage (depends on role).",
    do: "Log in as the restricted role. Open a case that is already in a final status. Try to edit.",
    expect: "Edit may be blocked with a short message (exact text depends on your setup)."
  }
];

const outPath = path.join(__dirname, "..", "qa-checklists", "NCI-Dates-and-Audit-Test-Cases.pdf");

function paragraph(doc, label, body) {
  doc.font("Helvetica-Bold").fontSize(9).text(label, { continued: true });
  doc.font("Helvetica").fontSize(9).text(` ${body}`);
  doc.moveDown(0.25);
}

function writePdf() {
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  doc.font("Helvetica-Bold").fontSize(16).text("NCI Dates and Audit — Test cases (layman)", {
    align: "center"
  });
  doc.moveDown(0.5);
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#444444")
    .text(
      "Indian Standard Time (IST) is used for business dates and audit times. Fill Pass/Fail and notes when you test.",
      { align: "center" }
    );
  doc.fillColor("#000000");
  doc.moveDown(1.2);

  for (const r of rows) {
    const needSpace = 90;
    if (doc.y > doc.page.height - doc.page.margins.bottom - needSpace) {
      doc.addPage();
    }

    doc.font("Helvetica-Bold").fontSize(11).text(`Test ${r.n} — ${r.section}`);
    doc.moveDown(0.35);
    paragraph(doc, "In plain English:", r.plain);
    paragraph(doc, "What you do:", r.do);
    paragraph(doc, "What you should see:", r.expect);
    doc.font("Helvetica").fontSize(9).text("Pass or Fail: _______________    Notes: _________________________________");
    doc.moveDown(0.6);
    doc
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .strokeColor("#cccccc")
      .lineWidth(0.5)
      .stroke();
    doc.strokeColor("#000000");
    doc.moveDown(0.5);
  }

  doc.end();
  return new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

writePdf()
  .then(() => {
    console.log("Wrote:", outPath);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
