# How to Use BhoomiScan Engine in Claude Artifacts

## The Problem
When you upload `bhoomiscan-engine.jsx` to Claude and ask it to generate an artifact, Claude creates a DIFFERENT version because:
- The component is named `App` (too generic)
- Claude doesn't know this is production code that should be rendered as-is

## The Solution - Use This EXACT Prompt:

```
I'm uploading bhoomiscan-engine.jsx - a complete, production-ready React component for the BhoomiScan Content Engine.

This is a WORKING artifact that I use on my dev server. Please create an artifact that renders this EXACT code without any modifications or improvements.

Component requirements:
- Import React hooks from "react"
- Export default function App() {...} (keep the exact name)
- Include ALL code exactly as written (1671 lines)
- Do NOT simplify, refactor, or "improve" anything
- This code is tested and working - render it as-is

Just create the artifact with this exact code.
```

## Alternative: Use the Artifact-Ready Version

Use `bhoomiscan-engine-artifact.jsx` instead, which has:
- Clear "DO NOT MODIFY" instructions at the top
- Better component naming
- Explicit artifact markers

## Prompt for Artifact-Ready Version:

```
Create a React artifact from the attached bhoomiscan-engine-artifact.jsx file.
This is production code - use it exactly as written. Do not modify anything.
```

---

**Important**: Always specify "use exact code" and "do not modify" when uploading to Claude, otherwise it will try to "improve" your working code.
