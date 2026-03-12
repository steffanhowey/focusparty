import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import type { ExternalWorkItem } from "@/lib/integrations/types";

/**
 * POST /api/integrations/import
 * Imports an external work item as a local fp_task.
 * Creates/updates a fp_linked_resources cache row, then creates a task linked to it.
 * If a task already exists for this external item, returns the existing task ID.
 *
 * Body: { item: ExternalWorkItem }
 */
export async function POST(request: Request) {
  try {
    const { item } = (await request.json()) as { item: ExternalWorkItem };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Check if we already have a task linked to this external item
    const { data: existingResource } = await admin
      .from("fp_linked_resources")
      .select("id")
      .eq("user_id", user.id)
      .eq("external_id", item.externalId)
      .single();

    if (existingResource) {
      // Check if a task already references this resource
      const { data: existingTask } = await admin
        .from("fp_tasks")
        .select("id")
        .eq("user_id", user.id)
        .eq("linked_resource_id", existingResource.id)
        .single();

      if (existingTask) {
        return NextResponse.json({ taskId: existingTask.id });
      }
    }

    // Upsert the linked resource (cache of external metadata)
    const { data: resource, error: resourceError } = await admin
      .from("fp_linked_resources")
      .upsert(
        {
          user_id: user.id,
          provider: item.provider,
          resource_type: item.resourceType,
          external_id: item.externalId,
          title: item.title,
          url: item.url,
          status: (item.metadata.state as string) ?? null,
          metadata: item.metadata,
          cached_at: new Date().toISOString(),
        },
        { onConflict: "user_id,external_id" }
      )
      .select("id")
      .single();

    if (resourceError || !resource) {
      console.error("[import] Resource upsert error:", resourceError?.message);
      return NextResponse.json(
        { error: "Failed to cache external resource" },
        { status: 500 }
      );
    }

    // Create the local task linked to this resource
    const { data: task, error: taskError } = await admin
      .from("fp_tasks")
      .insert({
        user_id: user.id,
        title: item.title,
        description: item.url ?? null,
        status: "todo",
        priority: mapPriority(item),
        position: 0,
        linked_resource_id: resource.id,
      })
      .select("id")
      .single();

    if (taskError || !task) {
      console.error("[import] Task creation error:", taskError?.message);
      return NextResponse.json(
        { error: "Failed to create task" },
        { status: 500 }
      );
    }

    return NextResponse.json({ taskId: task.id });
  } catch (err) {
    console.error("[import] Error:", err);
    return NextResponse.json(
      { error: "Failed to import item" },
      { status: 500 }
    );
  }
}

/** Map external item metadata to a task priority. */
function mapPriority(
  item: ExternalWorkItem
): "none" | "p4" | "p3" | "p2" | "p1" {
  const labels = (item.metadata.labels as string[]) ?? [];
  const lowerLabels = labels.map((l) => l.toLowerCase());

  if (
    lowerLabels.some((l) => l.includes("critical") || l.includes("urgent"))
  ) {
    return "p1";
  }
  if (
    lowerLabels.some(
      (l) => l.includes("high") || l.includes("important")
    )
  ) {
    return "p2";
  }
  if (lowerLabels.some((l) => l.includes("medium"))) {
    return "p3";
  }
  return "none";
}
