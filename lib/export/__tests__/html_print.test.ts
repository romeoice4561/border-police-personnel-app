import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiClientError } from "@/lib/ui/api_client";
import { translate } from "@/lib/i18n/dictionary";
import {
  HTML_PRINT_OBJECT_URL_REVOKE_MS,
  HtmlPrintPopupBlockedError,
  htmlPrintFailureMessage,
  openHtmlPrintReport,
} from "@/lib/export/html_print";

const t = (key: Parameters<typeof translate>[0]) => translate(key, "th");

function chromeLikeOpen(url?: string | URL, _target?: string, features?: string): Window | null {
  void url;
  // Chrome returns null when noopener is in the feature string even if a tab opens.
  if (features?.includes("noopener")) return null;
  return { opener: "parent" } as Window;
}

async function runHtmlPrintGenerate(opts: {
  download: () => Promise<{ blob: Blob }>;
  openWindow: typeof window.open;
}): Promise<{ error: string | null }> {
  try {
    const downloaded = await opts.download();
    openHtmlPrintReport(new Blob([downloaded.blob], { type: "text/html;charset=utf-8" }), {
      openWindow: opts.openWindow,
      createObjectURL: () => "blob:mock-report",
      revokeObjectURL: () => undefined,
      schedule: () => undefined,
    });
    return { error: null };
  } catch (err) {
    return { error: htmlPrintFailureMessage(err, t) };
  }
}

test("successful HTML_PRINT bytes plus opened tab is UI success, not downloadFailed", async () => {
  const result = await runHtmlPrintGenerate({
    download: async () => ({ blob: new Blob(["<html>รายงาน</html>"], { type: "text/html" }) }),
    openWindow: chromeLikeOpen,
  });
  assert.equal(result.error, null);
  assert.notEqual(result.error, t("di.export.downloadFailed"));
  assert.notEqual(result.error, "ดาวน์โหลดไม่สำเร็จ กรุณาลองใหม่");
});

test("Chrome noopener-null must not be used as the open-success signal", () => {
  const opened = { opener: "parent" as string | null };
  let features: string | undefined;
  openHtmlPrintReport(new Blob(["<html></html>"], { type: "text/html" }), {
    openWindow: ((_url, _target, feat) => {
      features = feat;
      if (feat?.includes("noopener")) return null;
      return opened as Window;
    }) as typeof window.open,
    createObjectURL: () => "blob:mock",
    revokeObjectURL: () => undefined,
    schedule: () => undefined,
  });
  assert.equal(features, undefined);
  assert.equal(opened.opener, null);
});

test("genuine export API failure still surfaces as failure", async () => {
  const result = await runHtmlPrintGenerate({
    download: async () => {
      throw new ApiClientError("ไม่มีสิทธิ์ส่งออก", 403, "FORBIDDEN");
    },
    openWindow: chromeLikeOpen,
  });
  assert.equal(result.error, "ไม่มีสิทธิ์ส่งออก");
});

test("genuine popup block is explicit and is not downloadFailed", async () => {
  const result = await runHtmlPrintGenerate({
    download: async () => ({ blob: new Blob(["<html></html>"], { type: "text/html" }) }),
    openWindow: () => null,
  });
  assert.equal(result.error, t("di.export.printPopupBlocked"));
  assert.equal(result.error, "เบราว์เซอร์บล็อกหน้าต่างรายงาน กรุณาอนุญาตป๊อปอัปแล้วลองใหม่");
  assert.notEqual(result.error, t("di.export.downloadFailed"));
});

test("htmlPrintFailureMessage maps known error classes", () => {
  assert.equal(htmlPrintFailureMessage(new ApiClientError("api", 500, "X"), t), "api");
  assert.equal(htmlPrintFailureMessage(new HtmlPrintPopupBlockedError(), t), t("di.export.printPopupBlocked"));
  assert.equal(htmlPrintFailureMessage(new Error("other"), t), t("di.export.downloadFailed"));
});

test("object URL is revoked immediately on popup block and deferred after success", () => {
  const revoked: string[] = [];
  const scheduled: Array<{ fn: () => void; ms: number }> = [];
  assert.throws(
    () =>
      openHtmlPrintReport(new Blob(["x"]), {
        openWindow: () => null,
        createObjectURL: () => "blob:blocked",
        revokeObjectURL: (url) => {
          revoked.push(String(url));
        },
        schedule: (fn, ms) => {
          scheduled.push({ fn, ms });
        },
      }),
    HtmlPrintPopupBlockedError
  );
  assert.deepEqual(revoked, ["blob:blocked"]);
  assert.equal(scheduled.length, 0);

  openHtmlPrintReport(new Blob(["x"]), {
    openWindow: () => ({ opener: "parent" }) as Window,
    createObjectURL: () => "blob:ok",
    revokeObjectURL: (url) => {
      revoked.push(String(url));
    },
    schedule: (fn, ms) => {
      scheduled.push({ fn, ms });
    },
  });
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0]?.ms, HTML_PRINT_OBJECT_URL_REVOKE_MS);
  scheduled[0]!.fn();
  assert.deepEqual(revoked, ["blob:blocked", "blob:ok"]);
});
