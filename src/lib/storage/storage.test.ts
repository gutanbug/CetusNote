import { describe, expect, it } from "vitest";
import {
  canContain,
  createMemoryStorage,
  createPage,
  isValidId,
  normalizePage,
  normalizeWorkspace,
  PAGE_SCHEMA_VERSION,
  SchemaError,
  StorageError,
  ulid,
} from "./index";

const ID = "01JD0000000000000000000000";
const PARENT = "01JD0000000000000000000001";

describe("ulid", () => {
  it("Rust 검사와 같은 형식의 26자 id를 만든다", () => {
    for (let i = 0; i < 50; i++) expect(isValidId(ulid())).toBe(true);
  });
  it("시간순으로 정렬된다", () => {
    expect(ulid(1_000).slice(0, 10) < ulid(2_000).slice(0, 10)).toBe(true);
  });
  it("경로 조각·소문자·모호한 글자를 거부한다", () => {
    for (const bad of ["../x", ID.toLowerCase(), `${ID.slice(0, 25)}I`, ID + "0", 42, null])
      expect(isValidId(bad)).toBe(false);
  });
});

describe("normalizePage", () => {
  it("빠진 값은 기본값으로 채우고 모르는 키는 버린다", () => {
    const page = normalizePage({
      id: ID,
      title: "회의록",
      extra: 1,
      createdAt: "2026-11-19T09:00:00Z",
    });
    expect(page).toEqual({
      schemaVersion: PAGE_SCHEMA_VERSION,
      id: ID,
      kind: "page",
      title: "회의록",
      icon: null,
      cover: null,
      parentId: null,
      props: { tags: [], status: null, assignee: null, start: null, due: null, values: {} },
      collection: null,
      layout: { font: "default" },
      content: { type: "doc", content: [] },
      createdAt: "2026-11-19T09:00:00Z",
      updatedAt: "2026-11-19T09:00:00Z",
      trashedAt: null,
      template: null,
    });
  });

  it("잘못된 값은 안전한 값으로 바꾼다", () => {
    const page = normalizePage({
      schemaVersion: 1,
      id: ID,
      parentId: ID, // 자기 자신
      props: { tags: ["회의", "", "회의", 3], status: 7 },
      layout: { width: "huge", font: "comic" },
      content: { type: "paragraph" },
    });
    expect(page.parentId).toBeNull();
    expect(page.props).toEqual({
      tags: ["회의"],
      status: null,
      assignee: null,
      start: null,
      due: null,
      values: {},
    });
    expect(page.layout).toEqual({ font: "default" });
    expect(page.content).toEqual({ type: "doc", content: [] });
  });

  it("v7 이하 파일은 시작일이 없어 null이고, 잘못된 시작일은 버리며, 맞는 시작일은 그대로 둔다", () => {
    const base = { id: ID, title: "회의록", createdAt: "2026-11-19T09:00:00Z" };
    const missing = normalizePage({
      ...base,
      schemaVersion: 7,
      props: { tags: [], due: "2026-11-24" },
    });
    expect(missing.props.start).toBeNull();
    expect(missing.props.due).toBe("2026-11-24");
    const invalid = normalizePage({ ...base, props: { tags: [], start: "11/20" } });
    expect(invalid.props.start).toBeNull();
    const valid = normalizePage({ ...base, props: { tags: [], start: "2026-11-20" } });
    expect(valid.props.start).toBe("2026-11-20");
  });

  it("v6 전체 폭(fullWidth)을 본문 폭으로 옮긴다: true → wide, false → 상속", () => {
    const base = { id: ID, title: "x", content: { type: "doc", content: [] } };
    const wide = normalizePage({
      ...base,
      schemaVersion: 6,
      layout: { fullWidth: true, font: "mono" },
    });
    expect(wide.layout).toEqual({ width: "wide", font: "mono" });
    const plain = normalizePage({
      ...base,
      schemaVersion: 6,
      layout: { fullWidth: false, font: "default" },
    });
    expect(plain.layout).toEqual({ font: "default" });
    expect(plain.schemaVersion).toBe(9);
  });

  it("올바른 값은 그대로 둔다", () => {
    const content = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "안녕" }] }],
    };
    const page = normalizePage({
      id: ID,
      parentId: PARENT,
      icon: "📝",
      props: { tags: ["회의"], status: "진행 중" },
      layout: { width: "wide", font: "serif" },
      content,
      trashedAt: "2026-11-19T10:00:00Z",
    });
    expect(page.parentId).toBe(PARENT);
    expect(page.icon).toBe("📝");
    expect(page.props.status).toBe("진행 중");
    expect(page.layout).toEqual({ width: "wide", font: "serif" });
    expect(page.content).toEqual(content);
    expect(page.trashedAt).toBe("2026-11-19T10:00:00Z");
  });

  it("앱보다 새 버전의 파일과 id가 잘못된 파일은 열지 않는다", () => {
    expect(() => normalizePage({ id: ID, schemaVersion: PAGE_SCHEMA_VERSION + 1 })).toThrow(
      SchemaError,
    );
    expect(() => normalizePage({ id: "../x" })).toThrow(SchemaError);
    expect(() => normalizePage("문자열")).toThrow(SchemaError);
  });

  it("스키마 1 파일은 문서(kind page)로 읽는다 · 폴더는 그대로 (SHELL-14)", () => {
    expect(normalizePage({ schemaVersion: 1, id: ID, kind: "folder" }).kind).toBe("page");
    const folder = normalizePage({ schemaVersion: 2, id: ID, kind: "folder", title: "업무" });
    expect(folder).toMatchObject({
      schemaVersion: PAGE_SCHEMA_VERSION,
      kind: "folder",
      title: "업무",
    });
    expect(normalizePage({ schemaVersion: 2, id: ID, kind: "외계" }).kind).toBe("page");
  });

  it("스키마 3: 컬렉션·담당·마감 (COLL-01). 잘못된 값은 버린다", () => {
    const col = normalizePage({
      schemaVersion: 3,
      id: ID,
      kind: "collection",
      collection: {
        view: "board",
        sort: { field: "due", dir: "desc" },
        filters: [
          { field: "status", value: "진행 중" },
          { field: "status", value: "진행 중" },
          { field: "owner", value: "x" },
          { field: "tags", value: "" },
        ],
      },
    });
    expect(col.collection).toMatchObject({
      view: "board",
      sort: { field: "due", dir: "desc" },
      filters: [{ field: "status", value: "진행 중" }],
    });
    expect(
      normalizePage({ schemaVersion: 3, id: ID, kind: "collection", collection: { view: "x" } })
        .collection,
    ).toMatchObject({ view: "grid", sort: null, filters: [] });
    const rec = normalizePage({
      schemaVersion: 3,
      id: ID,
      props: { assignee: "  차민석 ", due: "2026-11-24" },
    });
    expect(rec.props).toMatchObject({ assignee: "차민석", due: "2026-11-24" });
    expect(
      normalizePage({ id: ID, props: { assignee: " ", due: "2026-13-01" } }).props,
    ).toMatchObject({ assignee: null, due: null });
    // 문서가 아니면 collection은 null
    expect(normalizePage({ id: ID, collection: { view: "board" } }).collection).toBeNull();
    expect(canContain({ kind: "collection" }, "page")).toBe(true);
    expect(canContain({ kind: "collection" }, "folder")).toBe(false);
    expect(canContain({ kind: "page" }, "collection")).toBe(true);
  });

  it("스키마 4: 컬렉션 상태 목록·보드 설정, 상태는 자유 이름", () => {
    // 스키마 3 파일은 기본 4단계와 기본 보드 설정으로 채운다
    const old = normalizePage({ schemaVersion: 3, id: ID, kind: "collection", collection: {} });
    expect(old.collection?.statuses.map((o) => o.name)).toEqual([
      "할 일",
      "진행 중",
      "검토",
      "완료",
    ]);
    expect(old.collection?.board).toEqual({
      groupBy: "status",
      hidden: [],
      colors: {},
      calc: "count",
    });
    const col = normalizePage({
      schemaVersion: 4,
      id: ID,
      kind: "collection",
      collection: {
        statuses: [
          { name: " 보류 ", color: "purple" },
          { name: "보류", color: "red" },
          { name: "", color: "red" },
          { name: "출시", color: "neon" },
        ],
        board: {
          groupBy: "tags",
          hidden: ["tags:회의", "tags:회의"],
          colors: { "tags:": "blue", x: "neon" },
          calc: "late",
        },
      },
    });
    expect(col.collection?.statuses).toEqual([
      { name: "보류", color: "purple" },
      { name: "출시", color: "gray" },
    ]);
    expect(col.collection?.board).toEqual({
      groupBy: "tags",
      hidden: ["tags:회의"],
      colors: { "tags:": "blue" },
      calc: "late",
    });
    // 다 지운 상태 목록은 빈 채로 둔다
    expect(
      normalizePage({ schemaVersion: 4, id: ID, kind: "collection", collection: { statuses: [] } })
        .collection?.statuses,
    ).toEqual([]);
    expect(normalizePage({ id: ID, props: { status: " 보류 " } }).props.status).toBe("보류");
  });

  it("스키마 9: 표 열 너비(widths)는 제목·속성 키와 40~2000 사이 정수만 남긴다 (COLL-02)", () => {
    const col = (collection: unknown) =>
      normalizePage({ schemaVersion: 8, id: ID, kind: "collection", collection }).collection;
    expect(col({ view: "grid" })?.widths).toEqual({});
    expect(col({ view: "grid", widths: [1, 2] })?.widths).toEqual({});
    expect(
      col({
        view: "grid",
        widths: {
          title: 320.4,
          status: 200,
          due: 39,
          tags: 2001,
          zzz: 200,
          flink0001: 150,
          assignee: "wide",
        },
      })?.widths,
    ).toEqual({ title: 320, status: 200, flink0001: 150 });
  });

  it("루트·폴더·문서 아래에는 무엇이든, 컬렉션 아래에는 문서만", () => {
    expect(canContain(null, "folder")).toBe(true);
    expect(canContain({ kind: "folder" }, "folder")).toBe(true);
    expect(canContain({ kind: "page" }, "page")).toBe(true);
    expect(canContain({ kind: "page" }, "folder")).toBe(true);
    expect(canContain({ kind: "collection" }, "collection")).toBe(false);
  });

  it("createPage는 새 id와 같은 생성·수정 시각을 갖는다", () => {
    const page = createPage({ title: "새 페이지", parentId: PARENT });
    expect(isValidId(page.id)).toBe(true);
    expect(page.parentId).toBe(PARENT);
    expect(page.updatedAt).toBe(page.createdAt);
  });
});

describe("normalizeWorkspace", () => {
  it("없으면 기본값, 잘못된 id와 키는 거른다", () => {
    expect(normalizeWorkspace(null, "노트")).toEqual({
      schemaVersion: 1,
      name: "노트",
      order: {},
      favorites: [],
      tags: {},
      quickNotes: [],
      templatesSeeded: false,
    });
    const ws = normalizeWorkspace({
      name: "내 노트",
      order: { root: [ID, "bad"], [PARENT]: [ID], "../x": [ID] },
      favorites: [ID, ID, "bad"],
      tags: { 회의: "blue", "": "red", 기획: 3 },
    });
    expect(ws.order).toEqual({ root: [ID], [PARENT]: [ID] });
    expect(ws.favorites).toEqual([ID]);
    expect(ws.tags).toEqual({ 회의: "blue" });
  });
  it("앱보다 새 버전이면 열지 않는다", () => {
    expect(() => normalizeWorkspace({ schemaVersion: 99 })).toThrow(SchemaError);
  });
});

describe("createMemoryStorage", () => {
  it("쓰고 다시 읽으면 같은 페이지 — 저장된 값은 호출한 쪽 객체와 분리된다", async () => {
    const storage = createMemoryStorage();
    const page = createPage({ title: "회의록" });
    await storage.writePage(page);
    page.title = "바뀜";
    const { pages } = await storage.loadPages();
    expect(pages).toHaveLength(1);
    expect(pages[0]!.title).toBe("회의록");
  });

  it("휴지통 밖 페이지는 영구 삭제하지 않는다 (Rust와 같은 규칙)", async () => {
    const page = createPage();
    const storage = createMemoryStorage({ pages: [page] });
    await expect(storage.purgePage(page.id)).rejects.toMatchObject({ code: "not_trashed" });
    await storage.writePage({ ...page, trashedAt: new Date().toISOString() });
    await storage.purgePage(page.id);
    expect(storage.snapshot().pages).toHaveLength(0);
    await expect(storage.purgePage("../x")).rejects.toMatchObject({ code: "invalid_id" });
  });

  it("워크스페이스가 없으면 no_workspace, 폴더를 고르면 열린다", async () => {
    const storage = createMemoryStorage({ info: null, missingPath: "/Users/me/노트" });
    expect(await storage.workspaceStatus()).toMatchObject({
      workspace: null,
      missingPath: "/Users/me/노트",
    });
    await expect(storage.loadPages()).rejects.toBeInstanceOf(StorageError);
    await storage.pickWorkspace();
    expect((await storage.loadPages()).pages).toEqual([]);
    expect((await storage.readWorkspace()).name).toBe("CetusNote");
  });

  it("저장 실패를 흉내 낼 수 있다", async () => {
    const storage = createMemoryStorage({
      failWrite: () => new StorageError("disk_full", "가득 참"),
    });
    await expect(storage.writePage(createPage())).rejects.toMatchObject({ code: "disk_full" });
  });
});

describe("이미지 (EDIT-14, PAGE-03)", () => {
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const id = ulid();

  it("내용으로 종류를 정하고 페이지 폴더에 넣는다 — 읽으면 같은 바이트", async () => {
    const s = createMemoryStorage();
    const path = await s.writeAsset(id, PNG);
    expect(path).toMatch(new RegExp(`^assets/${id}/img-.+\\.png$`));
    expect(await s.readAsset(path)).toEqual(PNG);
  });

  it("모르는 종류·잘못된 경로·잘못된 id는 거절한다", async () => {
    const s = createMemoryStorage();
    const svg = new TextEncoder().encode("<svg/>");
    await expect(s.writeAsset(id, svg)).rejects.toMatchObject({ code: "unsupported_image" });
    await expect(s.writeAsset("../x", PNG)).rejects.toMatchObject({ code: "invalid_id" });
    await expect(s.readAsset(`assets/${id}/../../workspace.json`)).rejects.toMatchObject({
      code: "invalid_asset",
    });
  });

  it("영구 삭제하면 그 페이지 이미지도 지운다", async () => {
    const page = { ...createPage(), trashedAt: "2026-11-19T00:00:00.000Z" };
    const s = createMemoryStorage({ pages: [page] });
    const path = await s.writeAsset(page.id, PNG);
    await s.purgePage(page.id);
    await expect(s.readAsset(path)).rejects.toMatchObject({ code: "not_found" });
  });
});
