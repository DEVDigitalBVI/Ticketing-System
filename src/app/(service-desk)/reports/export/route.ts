import { getCurrentAccess } from "@/server/auth/access";
import { accessCan } from "@/server/auth/authorization";
import { reportToCsv } from "@/server/reporting/csv";
import { getManagerReport, ReportingError } from "@/server/reporting/service";

export async function GET(request: Request) {
  const access = await getCurrentAccess();
  if (!access) return new Response("Authentication required.", { status: 401 });
  if (!accessCan(access, "report.read")) return new Response("Access denied.", { status: 403 });

  const search = new URL(request.url).searchParams;
  try {
    const report = await getManagerReport(access, {
      from: search.get("from"),
      to: search.get("to"),
      timezone: search.get("timezone"),
      ...(search.get("propertyId") ? { propertyId: search.get("propertyId") } : {}),
      ...(search.get("departmentId") ? { departmentId: search.get("departmentId") } : {}),
      ...(search.get("categoryId") ? { categoryId: search.get("categoryId") } : {}),
      ...(search.get("source") ? { source: search.get("source") } : {}),
    });
    return new Response(reportToCsv(report), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="service-quality-${search.get("from")}-${search.get("to")}.csv"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ReportingError)
      return new Response(error.message, { status: error.code === "denied" ? 403 : 400 });
    throw error;
  }
}
