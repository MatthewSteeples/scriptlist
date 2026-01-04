import type { Route } from "./+types/excel";
import { Workbook } from "@cj-tech-master/excelts";

/**
 * GET /excel
 * Resource route: returns an .xlsx file (no UI export).
 */
export async function loader({}: Route.LoaderArgs) {
  const workbook = new Workbook();

  const sheet = workbook.addWorksheet("Report");
  sheet.addRow(["Name", "Value"]);
  sheet.addRow(["Example", 123]);

  // excelts/exceljs-style APIs often return Buffer (Uint8Array) here.
  const bytes = await workbook.xlsx.writeBuffer();

  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="report.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

// IMPORTANT: no default export (this must NOT be a UI route)