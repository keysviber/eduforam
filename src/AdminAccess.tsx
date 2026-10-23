import React, { useEffect, useState } from "react";
import { View, Text, TextInput } from "./Theme";
import { backend } from "./backend";
import { FeatureButton, useTask } from "./FeatureWorkflows";

type Request = {
  user_id: string;
  status: string;
  reason: string;
  profiles?: { username: string; first_name: string; surname: string } | null;
};
export function AdminAccess({
  userId,
  owner = false,
}: {
  userId?: string;
  owner?: boolean;
}) {
  const task = useTask();
  const [items, setItems] = useState<Request[]>([]);
  const [reason, setReason] = useState("");
  async function load() {
    if (!backend || !userId) return;
    let q = backend
      .from("admin_access_requests")
      .select(
        "user_id,status,reason,profiles!admin_access_requests_user_id_fkey(username,first_name,surname)",
      )
      .order("created_at");
    if (!owner) q = q.eq("user_id", userId);
    const r = await q;
    if (r.error) throw r.error;
    setItems((r.data || []) as unknown as Request[]);
  }
  useEffect(() => {
    void task.run(load);
  }, [userId, owner]);
  if (!userId) return null;
  return (
    <View style={{ gap: 12, padding: 18 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>
        {owner ? "Admin access requests" : "Admin access"}
      </Text>
      <Text accessibilityRole="alert">{task.notice}</Text>
      <FeatureButton
        label="Refresh admin access"
        disabled={task.busy}
        onPress={() => void task.run(load)}
      />
      {!items.length && <Text>No admin access requests.</Text>}
      {owner && (
        <TextInput
          accessibilityLabel="Admin decision reason"
          placeholder="Explain the approval or rejection"
          value={reason}
          onChangeText={setReason}
          multiline
          style={{ borderWidth: 1, padding: 12 }}
        />
      )}
      {items.map((item) => (
        <View key={item.user_id} style={{ gap: 8 }}>
          <Text>
            {item.profiles?.username || item.user_id}: {item.status}
          </Text>
          <Text>
            {item.profiles?.first_name} {item.profiles?.surname}
          </Text>
          {!!item.reason && <Text>{item.reason}</Text>}
          {item.status === "pending" && (
            <Text>
              Owner approval is required before admin tools become available.
            </Text>
          )}
          {item.status === "approved" && (
            <Text>Sign out and sign in again to load your admin tools.</Text>
          )}
          {owner &&
            item.status === "pending" &&
            [true, false].map((approve) => (
              <FeatureButton
                key={String(approve)}
                label={`${approve ? "Approve" : "Reject"} admin ${item.profiles?.username || item.user_id}`}
                disabled={task.busy || reason.trim().length < 5}
                onPress={() =>
                  void task.run(async () => {
                    const r = await backend!.rpc("review_admin_access", {
                      target_user: item.user_id,
                      approve,
                      decision_reason: reason.trim(),
                    });
                    if (r.error) throw r.error;
                    await load();
                    setReason("");
                    task.setNotice("Admin access decision saved.");
                  })
                }
              />
            ))}
        </View>
      ))}
    </View>
  );
}
