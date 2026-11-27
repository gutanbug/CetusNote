import type { Messages } from "../ko";

/** English strings for the storage layer's own errors (SYS-14) */
export const storage: Messages["storage"] = {
  noWorkspace: "No workspace is open.",
  schema: {
    notObject: "This page is not a valid object.",
    newerPage: (version) =>
      `This page was made by a newer version of the app (version ${version}).`,
    noMigration: (version) => `There is no migration for version ${version}.`,
    invalidId: "The page ID is not valid.",
    newerWorkspace: (version) =>
      `This workspace was made by a newer version of the app (version ${version}).`,
  },
};
