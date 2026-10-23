import React, { useState } from "react";
import { View, Text, TextInput, Modal, ScrollView, Pressable } from "./Theme";
export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState("");
  return (
    <View style={{ gap: 6 }}>
      <Text>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          setSearch("");
          setOpen(true);
        }}
        style={{
          padding: 14,
          borderWidth: 1,
          borderColor: "#b5c9bd",
          borderRadius: 10,
        }}
      >
        <Text>
          {options.find((x) => x.value === value)?.label ||
            `Select ${label.toLowerCase()}`}{" "}
          ▾
        </Text>
      </Pressable>
      <Modal visible={open} transparent onRequestClose={() => setOpen(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: "#0009",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: "white",
              padding: 18,
              borderRadius: 16,
              maxHeight: "85%",
              gap: 12,
            }}
          >
            <Text style={{ fontSize: 22 }}>{label}</Text>
            <TextInput
              accessibilityLabel={`Search ${label}`}
              value={search}
              onChangeText={setSearch}
              placeholder="Search options"
              style={{ padding: 12, borderWidth: 1, borderColor: "#aabdb1" }}
            />
            <ScrollView keyboardShouldPersistTaps="handled">
              {options
                .filter((x) =>
                  x.label.toLowerCase().includes(search.toLowerCase()),
                )
                .map((x) => (
                  <Pressable
                    key={x.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: x.value === value }}
                    onPress={() => {
                      onChange(x.value);
                      setOpen(false);
                    }}
                    style={{ padding: 14 }}
                  >
                    <Text>
                      {x.value === value ? "✓ " : ""}
                      {x.label}
                    </Text>
                  </Pressable>
                ))}
            </ScrollView>
            <Pressable
              accessibilityRole="button"
              onPress={() => setOpen(false)}
              style={{ padding: 12 }}
            >
              <Text>Cancel selection</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
export function DateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [year, setYear] = useState(value ? Number(value.slice(0, 4)) : 2005),
    [month, setMonth] = useState(value ? Number(value.slice(5, 7)) : 1);
  const count = new Date(year, month, 0).getDate(),
    offset = new Date(year, month - 1, 1).getDay();
  return (
    <View>
      <Text>Date of birth</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Date of birth"
        onPress={() => setOpen(true)}
        style={{
          padding: 14,
          borderWidth: 1,
          borderColor: "#b5c9bd",
          borderRadius: 10,
        }}
      >
        <Text>{value || "Choose your date of birth"}</Text>
      </Pressable>
      <Modal visible={open} transparent onRequestClose={() => setOpen(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: "#0009",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: "white",
              borderRadius: 16,
              padding: 18,
              gap: 12,
            }}
          >
            <SelectField
              label="Birth year"
              value={String(year)}
              options={Array.from(
                { length: new Date().getFullYear() - 1899 },
                (_, i) => ({
                  label: String(new Date().getFullYear() - i),
                  value: String(new Date().getFullYear() - i),
                }),
              )}
              onChange={(v) => setYear(Number(v))}
            />
            <SelectField
              label="Birth month"
              value={String(month)}
              options={Array.from({ length: 12 }, (_, i) => ({
                label: new Date(2000, i, 1).toLocaleString("en", {
                  month: "long",
                }),
                value: String(i + 1),
              }))}
              onChange={(v) => setMonth(Number(v))}
            />
            <Text>Sun Mon Tue Wed Thu Fri Sat</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {Array.from({ length: offset }, (_, i) => (
                <View key={`empty${i}`} style={{ width: "14.28%" }} />
              ))}
              {Array.from({ length: count }, (_, i) => {
                const day = i + 1,
                  date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                return (
                  <Pressable
                    key={day}
                    accessibilityRole="button"
                    accessibilityLabel={date}
                    disabled={date > new Date().toISOString().slice(0, 10)}
                    onPress={() => {
                      onChange(date);
                      setOpen(false);
                    }}
                    style={{ width: "14.28%", paddingVertical: 12 }}
                  >
                    <Text style={{ textAlign: "center" }}>{day}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setOpen(false)}
            >
              <Text>Cancel date selection</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
