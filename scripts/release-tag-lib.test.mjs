import { describe, expect, it } from "vitest";
import {
  UNTAGGED_LEGACY_RELEASES,
  auditReleaseTags,
  compareVersions,
  expectedReleaseTag,
  isPublishedVersion,
  newestReleaseVersion,
  pendingReleaseTag,
} from "./release-tag-lib.mjs";

const releases = (versions) => versions.map((version) => ({ version }));

describe("newestReleaseVersion", () => {
  it("ranks version segments numerically, not lexicographically", () => {
    expect(newestReleaseVersion(releases(["0.9.0", "0.10.0", "0.2.0"]))).toBe("0.10.0");
  });

  it("returns null when nothing is a plain release version", () => {
    expect(newestReleaseVersion([])).toBeNull();
    expect(newestReleaseVersion(undefined)).toBeNull();
    expect(newestReleaseVersion([{ version: "v1" }, {}, { version: null }])).toBeNull();
  });

  it("ignores malformed entries while picking the newest", () => {
    expect(newestReleaseVersion([{ version: "0.7.0" }, { version: "nightly" }])).toBe("0.7.0");
  });
});

describe("compareVersions and helpers", () => {
  it("orders versions by major, minor then patch", () => {
    expect(compareVersions("0.7.0", "0.7.1")).toBeLessThan(0);
    expect(compareVersions("1.0.0", "0.99.99")).toBeGreaterThan(0);
    expect(compareVersions("0.7.1", "0.7.1")).toBe(0);
  });

  it("accepts only x.y.z as a published version", () => {
    expect(isPublishedVersion("0.7.1")).toBe(true);
    for (const bad of ["0.7", "v0.7.1", "0.7.1-beta", "", null, undefined, 7]) {
      expect(isPublishedVersion(bad)).toBe(false);
    }
  });

  it("names release tags with a leading v", () => {
    expect(expectedReleaseTag("0.7.1")).toBe("v0.7.1");
  });
});

describe("auditReleaseTags", () => {
  it("requires a tag for every superseded release", () => {
    expect(
      auditReleaseTags({
        releases: releases(["0.8.0", "0.7.2", "0.7.1"]),
        tags: ["v0.7.1"],
      })
    ).toEqual([
      "发布记录中的 0.7.2 没有 git tag v0.7.2（发布后必须打 tag 并推送）",
    ]);
  });

  it("passes when every non-latest release is tagged", () => {
    expect(
      auditReleaseTags({
        releases: releases(["0.8.0", "0.7.1", "0.7.0"]),
        tags: ["v0.7.1", "v0.7.0"],
      })
    ).toEqual([]);
  });

  it("never fails on the newest release, which is tagged only after the merge", () => {
    expect(
      auditReleaseTags({ releases: releases(["0.8.0"]), tags: [] })
    ).toEqual([]);
  });

  it("exempts the legacy releases that predate this gate", () => {
    expect(
      auditReleaseTags({
        releases: releases(UNTAGGED_LEGACY_RELEASES.concat(["0.7.1"])),
        tags: ["v0.7.1"],
      })
    ).toEqual([]);
  });

  it("skips malformed version entries instead of crashing", () => {
    expect(
      auditReleaseTags({ releases: [{ version: "0.7.0" }, {}, { version: "x" }], tags: [] })
    ).toEqual([]);
  });
});

describe("pendingReleaseTag", () => {
  it("reports the newest release while its tag is still missing", () => {
    expect(pendingReleaseTag({ releases: releases(["0.7.1"]), tags: [] })).toEqual({
      version: "0.7.1",
      tag: "v0.7.1",
    });
  });

  it("reports nothing once the tag exists", () => {
    expect(
      pendingReleaseTag({ releases: releases(["0.7.1"]), tags: ["v0.7.1"] })
    ).toBeNull();
    expect(pendingReleaseTag({ releases: [], tags: [] })).toBeNull();
  });
});
