import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildUserActivityLogCsv, csvCell, activityLogFilename, ACTIVITY_LOG_CSV_HEADER } from "../lib/csv/user-activity-log";

describe("csvCell", () => {
  test("prefixes formula leaders with an apostrophe", () => {
    for (const lead of ["=SUM(A1)", "+1", "-2", "@cmd", "\tx"]) {
      assert.ok(csvCell(lead).startsWith("'"), lead);
    }
  });
  test("leaves ordinary text alone", () => {
    assert.equal(csvCell("Mozilla/5.0"), "Mozilla/5.0");
    assert.equal(csvCell(""), "");
    assert.equal(csvCell(null), "");
  });
  test("quotes commas, quotes and newlines", () => {
    assert.equal(csvCell('a,b'), '"a,b"');
    assert.equal(csvCell('say "hi"'), '"say ""hi"""');
    assert.equal(csvCell("a\nb"), '"a\nb"');
  });
  test("neutralises then quotes a hostile value", () => {
    assert.equal(csvCell('=HYPERLINK("x","y")'), `"'=HYPERLINK(""x"",""y"")"`);
  });
});

describe("buildUserActivityLogCsv", () => {
  test("header only for an empty log", () => {
    const out = buildUserActivityLogCsv([]);
    assert.equal(out, ACTIVITY_LOG_CSV_HEADER.join(",") + "\r\n");
  });

  test("maps ip, user agent, role change and extra data", () => {
    const out = buildUserActivityLogCsv([
      { id: "a1", action: "LOGIN", createdAt: new Date("2026-10-01T10:00:00Z"), metadata: { ip: "1.2.3.4", userAgent: "=evil, agent" } },
      { id: "a2", action: "ROLE_CHANGED", createdAt: new Date("2026-10-02T10:00:00Z"), metadata: { fromRole: "READER", toRole: "AUTHOR", performedBy: "adm1", note: "x" } },
      { id: "a3", action: "CUSTOM", createdAt: new Date("2026-10-03T10:00:00Z"), metadata: null },
    ]);
    const lines = out.trimEnd().split("\r\n");
    assert.equal(lines.length, 4);
    assert.equal(lines[1], `2026-10-01T10:00:00.000Z,LOGIN,Signed in,,1.2.3.4,"'=evil, agent",,,a1`);
    assert.ok(lines[2].includes("READER -> AUTHOR"));
    assert.ok(lines[2].includes("adm1"));
    assert.ok(lines[2].includes('"{""note"":""x""}"'));
    assert.equal(lines[3], "2026-10-03T10:00:00.000Z,CUSTOM,CUSTOM,,,,,,a3");
  });

  test("tolerates non-object metadata and invalid dates", () => {
    const out = buildUserActivityLogCsv([{ id: "z", action: "LOGIN", createdAt: new Date("nope"), metadata: ["x"] }]);
    assert.ok(out.trimEnd().split("\r\n")[1].startsWith(",LOGIN"));
  });
});

describe("activityLogFilename", () => {
  test("includes account number and date, sanitised", () => {
    assert.equal(activityLogFilename("AU-0012", new Date("2026-10-06T00:00:00Z")), "activity-log-AU-0012-2026-10-06.csv");
    assert.equal(activityLogFilename('../"x', new Date("2026-10-06T00:00:00Z")), "activity-log-x-2026-10-06.csv");
  });
});
