import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, escapeHtmlMultiline } from "@/lib/export/html";

test("escapeHtml neutralizes script and attribute injection", () => {
  assert.equal(escapeHtml("<script>alert(1)</script>"), "&lt;script&gt;alert(1)&lt;/script&gt;");
  assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), "&lt;img src=x onerror=alert(1)&gt;");
  assert.equal(escapeHtml(`& < > " '`), "&amp; &lt; &gt; &quot; &#39;");
  assert.equal(escapeHtml("ภาษาไทย 👋"), "ภาษาไทย 👋");
  assert.equal(escapeHtmlMultiline("line1\nline2"), "line1<br />line2");
});
