/**
 * Link Compare two-box operator workspace (LC-2B).
 * Route: /drug-intelligence/network/compare
 */
"use client";

import { Suspense } from "react";
import { LoadingState } from "@/components/common/states";
import { DrugLinkCompareWorkspace } from "@/components/drug_intelligence/drug_link_compare_workspace";

export default function DrugLinkComparePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DrugLinkCompareWorkspace />
    </Suspense>
  );
}
