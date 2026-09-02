"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function checkIsAdmin(db: Awaited<ReturnType<typeof createClient>>) {
    const { data: { user } } = await db.auth.getUser();
    if (!user) return false;
    const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
    return profile?.role === "admin";
}

const DATE_RANGE = /^\d{4}-\d{2}-\d{2}$/;

export async function getLeavesForRangedAction(startDate: string, endDate: string, employeeId?: number) {
    try {
        const db = await createClient();
        let query = db.from("employee_leaves")
            .select("id, employee_id, start_date, end_date, leave_type, note")
            .eq("status", "approved")
            .lte("start_date", endDate)
            .gte("end_date", startDate);

        if (employeeId) query = query.eq("employee_id", employeeId);

        const { data, error } = await query;

        if (error) return { success: false, error: error.message };
        return { success: true, data: data || []};
    } catch (err: any) {
        return { success: false, error: err.message || "Failed to fetch leaves"};
    }
}

export async function setLeaveAction(payload: { employee_id: number; start_date: string; end_date: string; leave_type?: string; note?: string }) {
    try {
        const db = await createClient();
        if (!(await checkIsAdmin(db))) {
            return { success: false, error: "Unauthorized access. Admin privileges required."};
        }

        const { employee_id, start_date, end_date } = payload;

        if (!DATE_RANGE.test(start_date) || !DATE_RANGE.test(end_date)) {
            return { success: false, error: "Invalid date range. Expected format: YYYY-MM-DD"};
        }
        
        if (end_date < start_date) { // potential syntax error here
            return { success: false, error: "End date cannot be before start date"};
        }

        const { data: { user } } = await db.auth.getUser();

        const adminClient = await createAdminClient();

        // Overlap test: start_date <= newEnd AND end_date >= newStart.
        const { data: existing } = await adminClient
            .from("employee_leaves")
            .select("id")
            .eq("employee_id", employee_id)
            .eq("status", "approved")
            .lte("start_date", end_date)
            .gte("end_date", start_date);

        if (existing && existing.length > 0) {
            return { success: false, error: "This employee already has leave covering part of that range."};
        }

        const { error } = await adminClient.from("employee_leaves").insert({
            employee_id, start_date, end_date,
            leave_type: payload.leave_type || "vacation",
            note: payload.note || null,
            status: "approved",
            created_by: user?.id || null,
        })

        if (error) return { success: false, error: error.message };

        revalidatePath("/dashboard");
        revalidatePath("/dashboard/analytics");
        revalidatePath("/dashboard/calendar");
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message || "Failed to set leave"};
    }
}

export async function removeLeaveAction(id: number) {
    try {
        const db = await createClient();
        if (!(await checkIsAdmin(db))) {
            return { success: false, error: "Unauthorized access. Admin privileges required."};
        }

        const adminClient = await createAdminClient();
        const { error } = await adminClient.from("employee_leaves").delete().eq("id", id);

        if (error) return { success: false, error: error.message };

        revalidatePath("/dashboard");
        revalidatePath("/dashboard/analytics");
        revalidatePath("/dashboard/calendar");
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message || "Failed to remove leave"};
    }
}