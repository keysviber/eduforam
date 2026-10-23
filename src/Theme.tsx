import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  forwardRef,
} from "react";
import * as RN from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
export * from "react-native";
const ThemeContext = createContext({
  dark: false,
  setDark: (_v: boolean) => {},
});
export const useTheme = () => useContext(ThemeContext);
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDarkState] = useState(false);
  useEffect(() => {
    void AsyncStorage.getItem("ef-dark-theme").then((v) =>
      setDarkState(v === "true"),
    );
  }, []);
  return (
    <ThemeContext.Provider
      value={{
        dark,
        setDark(v) {
          setDarkState(v);
          void AsyncStorage.setItem("ef-dark-theme", String(v));
        },
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
function luminance(color: unknown) {
  if (typeof color !== "string") return null;
  if (color === "white") return 1;
  if (color === "black") return 0;
  const m = color.match(/^#([a-f\d]{6}|[a-f\d]{3})$/i);
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3)
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  return (
    (parseInt(hex.slice(0, 2), 16) * 0.299 +
      parseInt(hex.slice(2, 4), 16) * 0.587 +
      parseInt(hex.slice(4, 6), 16) * 0.114) /
    255
  );
}
function themed(style: any, dark: boolean, text = false) {
  const s = { ...RN.StyleSheet.flatten(style) };
  if (!dark) return s;
  const bg = luminance(s.backgroundColor),
    fg = luminance(s.color);
  if (s.backgroundColor === "#d8f5e1") s.backgroundColor = "#16432e";
  else if (s.backgroundColor === "#ffe0e6") s.backgroundColor = "#5d1e2a";
  else if (bg !== null && bg > 0.65) s.backgroundColor = "#1c302d";
  if (text && (fg === null || fg < 0.65)) s.color = "#e9f3ec";
  if (s.borderColor && !["#168347", "#bc2338"].includes(s.borderColor) && luminance(s.borderColor) !== null)
    s.borderColor = "#48635b";
  return s;
}
export const View = forwardRef<RN.View, React.ComponentProps<typeof RN.View>>(
  (p, r) => <RN.View {...p} ref={r} style={themed(p.style, useTheme().dark)} />,
);
export const Text = forwardRef<RN.Text, React.ComponentProps<typeof RN.Text>>(
  (p, r) => (
    <RN.Text {...p} ref={r} style={themed(p.style, useTheme().dark, true)} />
  ),
);
export const TextInput = forwardRef<
  RN.TextInput,
  React.ComponentProps<typeof RN.TextInput>
>((p, r) => {
  const { dark } = useTheme();
  return (
    <RN.TextInput
      {...p}
      ref={r}
      placeholderTextColor={dark ? "#a7beb3" : p.placeholderTextColor}
      style={themed(p.style, dark, true)}
    />
  );
});
export const ScrollView = forwardRef<
  RN.ScrollView,
  React.ComponentProps<typeof RN.ScrollView>
>((p, r) => {
  const { dark } = useTheme();
  return (
    <RN.ScrollView
      {...p}
      ref={r}
      style={themed(p.style, dark)}
      contentContainerStyle={themed(p.contentContainerStyle, dark)}
    />
  );
});
export type ScrollView = RN.ScrollView;
export const Pressable = forwardRef<
  RN.View,
  React.ComponentProps<typeof RN.Pressable>
>((p, r) => {
  const { dark } = useTheme();
  return (
    <RN.Pressable
      {...p}
      ref={r}
      style={(state) =>
        themed(typeof p.style === "function" ? p.style(state) : p.style, dark)
      }
    />
  );
});
