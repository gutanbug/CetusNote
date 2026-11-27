import type { Messages } from "../ko";

/** English strings — collection area (SYS-14). Same keys as ../ko/collection.ts */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const collection: Messages["collection"] = {
  model: {
    builtin: { status: "Status", assignee: "Assignee", due: "Due", tags: "Tags" },
    fieldType: {
      text: "Text",
      number: "Number",
      select: "Select",
      multi: "Multi-select",
      date: "Date",
      checkbox: "Checkbox",
      url: "URL",
      email: "Email",
      phone: "Phone",
      created: "Created time",
      updated: "Last edited time",
    },
    sort: {
      title: "Title",
      status: "Status",
      assignee: "Assignee",
      due: "Due",
      tags: "Tags",
      updated: "Last edited",
    },
    noneLabel: { status: "No status", assignee: "No assignee", tags: "No tags" },
    checked: "Checked",
    unchecked: "Not checked",
    unnamedField: "Property",
    newStatus: (n) => (n ? `New status ${n}` : "New status"),
    count: (n) => `${n} ${n === 1 ? "item" : "items"}`,
    dueCount: (n) => `${n} due`,
    lateCount: (n) => `${n} overdue`,
    stamp: (p) => `${MONTHS[p.m - 1]} ${p.d}, ${p.y} ${p.hh}:${p.mm}`,
    due: (p) => (p.y === null ? `${MONTHS[p.m - 1]} ${p.d}` : `${MONTHS[p.m - 1]} ${p.d}, ${p.y}`),
  },
};
