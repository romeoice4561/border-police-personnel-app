const JSON_SHAPE = `{
  "rank": "",
  "first_name": "",
  "last_name": "",
  "position": "",
  "unit": "",
  "phone": "",
  "timeline": [
    { "year": "", "position": "", "unit": "" }
  ],
  "notes": "",
  "confidence": 0
}`;

export function buildVisionPrompt(): string {
  return [
    "You are an information extraction system analyzing a border patrol personnel profile image.",
    "Extract the following fields from the image:",
    "- Rank",
    "- First name",
    "- Last name",
    "- Position",
    "- Unit",
    "- Phone",
    "- Career timeline (a list of entries, each with year, position, and unit)",
    "",
    "Also include any freeform notes visible on the profile, and an overall confidence score (0-100) for the extraction.",
    "",
    "Return ONLY valid JSON matching exactly this shape, with no markdown formatting, no code fences, and no explanatory text:",
    JSON_SHAPE,
  ].join("\n");
}
