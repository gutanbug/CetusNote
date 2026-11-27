import { afterEach, expect, it } from "vitest";
import { setLocale } from "@/lib/i18n";
import { greeting } from "./home-model";

afterEach(() => setLocale("ko"));

it("greets in English when the locale is en", () => {
  setLocale("en");
  expect(greeting(8)).toBe("Good morning");
  expect(greeting(20)).toBe("Good evening");
});
