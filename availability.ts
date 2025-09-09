// Small server-side availability re-check (half-open ranges)
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function verifyAvailabilityServerSide(
  supabase: SupabaseClient,
  site_id: string,
  check_in_date: string,
  check_out_date: string,
) {
  const { data, error } = await supabase
    .from("reservations")
    .select("id, status, hold_expiration, check_in_date, check_out_date")
    .eq("site_id", site_id)
    .neq("status", "cancelled");

  if (error) return true; // fail open if the check fails

  const newStart = new Date(check_in_date).getTime();
  const newEnd = new Date(check_out_date).getTime();

  const overlaps = (data || []).some((r) => {
    if (r.status === "hold" && r.hold_expiration) {
      const exp = new Date(r.hold_expiration as string).getTime();
      if (exp <= Date.now()) return false;
    }
    const s = new Date(r.check_in_date as string).getTime();
    const e = new Date(r.check_out_date as string).getTime();
    return s < newEnd && e > newStart; // half-open overlap
  });

  return !overlaps;
}
