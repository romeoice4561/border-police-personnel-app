/**
 * ReviewReportGenerator
 *
 * Produces a human-readable markdown summary of a review session: AI
 * extraction snapshot, confidence concerns, diff against human edits,
 * status, and history. Intended to be saved alongside the JSON review
 * package as a quick-read artifact for a human reviewer or auditor.
 */

import type { DiffResult, ReviewSession } from "@/lib/review/review_types";

/** Contract for report generation. Allows swapping in a different report format/template later. */
export interface ReportGenerator {
  generate(session: ReviewSession, diff: DiffResult): string;
}

/**
 * Default markdown report generator.
 *
 * Future extension point: HTML or PDF export, or a templating engine for
 * customizable report layouts.
 */
export class MarkdownReportGenerator implements ReportGenerator {
  generate(session: ReviewSession, diff: DiffResult): string {
    const sections = [
      this.header(session),
      this.extractionSummary(session),
      this.confidenceSection(session),
      this.diffSection(diff),
      this.historySection(session),
    ];

    return sections.join("\n\n");
  }

  private header(session: ReviewSession): string {
    return [
      `# Review Report — ${session.id}`,
      "",
      `**Status:** ${session.status}`,
      `**Created:** ${session.createdAt}`,
      `**Updated:** ${session.updatedAt}`,
      `**Source Image:** ${session.aiResult.processing_metadata.image}`,
      `**Template:** ${session.aiResult.processing_metadata.template}`,
    ].join("\n");
  }

  private extractionSummary(session: ReviewSession): string {
    const e = session.editedExtraction;
    return [
      "## Extraction",
      "",
      `- **Name:** ${e.first_name} ${e.last_name}`,
      `- **Rank:** ${e.rank}`,
      `- **Position:** ${e.position}`,
      `- **Unit:** ${e.unit}`,
      `- **Phone:** ${e.phone || "_missing_"}`,
      `- **Timeline Entries:** ${e.timeline.length}`,
      `- **Overall Confidence:** ${session.aiResult.confidence}%`,
    ].join("\n");
  }

  private confidenceSection(session: ReviewSession): string {
    if (session.concerns.length === 0) {
      return "## Confidence Concerns\n\nNone.";
    }

    const rows = session.concerns.map(
      (c) => `- **[${c.severity.toUpperCase()}]** ${c.field ? `\`${c.field}\`: ` : ""}${c.message}`
    );

    return ["## Confidence Concerns", "", ...rows].join("\n");
  }

  private diffSection(diff: DiffResult): string {
    if (!diff.hasChanges) {
      return "## Changes from AI Extraction\n\nNo human edits recorded.";
    }

    const lines: string[] = ["## Changes from AI Extraction", ""];

    for (const item of diff.added) {
      lines.push(`- **Added** \`${item.field}\`: ${JSON.stringify(item.after)}`);
    }
    for (const item of diff.removed) {
      lines.push(`- **Removed** \`${item.field}\`: ${JSON.stringify(item.before)}`);
    }
    for (const item of diff.changed) {
      lines.push(`- **Changed** \`${item.field}\`: ${JSON.stringify(item.before)} → ${JSON.stringify(item.after)}`);
    }

    return lines.join("\n");
  }

  private historySection(session: ReviewSession): string {
    if (session.history.length === 0) {
      return "## History\n\nNo history recorded.";
    }

    const rows = session.history.map(
      (entry) => `- ${entry.timestamp} — **${entry.reviewer.name}** — ${entry.action}${entry.note ? `: ${entry.note}` : ""}`
    );

    return ["## History", "", ...rows].join("\n");
  }
}
