import { redirect } from "next/navigation";

// The calendar is the home screen; the list of calendars moved to
// /dashboard/calendars (spec 005 RF-15, RF-21, plan D5).
export default function DashboardPage() {
  redirect("/dashboard/calendar");
}
