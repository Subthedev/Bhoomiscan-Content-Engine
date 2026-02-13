# BhoomiScan Engine - Troubleshooting Guide

## Issue: Claude Generates Different Version Than Dev Server

### Why This Happens
When you upload `bhoomiscan-engine.jsx` to Claude without clear instructions, Claude sees:
1. A generic component name (`App`)
2. A large, complex file
3. No indication this is production code

So Claude tries to "help" by creating what it thinks you want - which ends up being different from your working version.

### The Fix (3 Solutions)

#### ✅ Solution 1: Use the Copy-Paste Prompt (RECOMMENDED)
1. Open `CLAUDE_UPLOAD_PROMPT.txt`
2. Copy the entire prompt
3. Upload `bhoomiscan-engine.jsx` to Claude
4. Paste the prompt
5. Claude will create the correct artifact

#### ✅ Solution 2: Use These Magic Words
When uploading, say:
> "Create an artifact with this EXACT code - do not modify anything"

#### ✅ Solution 3: Verify the Output
After Claude generates the artifact:
1. Check line 841: Should be `export default function App()`
2. Check line count: Should be exactly 1671 lines
3. Check the first hook: Should be `{ id:1, name:"Confession", ex:"Sach batau?" }`
4. If any of these are different, Claude modified your code

---

## Common Problems

### Problem: "Artifact looks different"
**Cause**: Claude modified your code
**Fix**: Re-upload using Solution 1 above

### Problem: "Features are missing"
**Cause**: Claude simplified or refactored your code
**Fix**: Use the exact prompt from `CLAUDE_UPLOAD_PROMPT.txt`

### Problem: "Different hook patterns"
**Cause**: Claude regenerated the data structures
**Fix**: Emphasize "use EXACT code without modifications"

---

## What's Changed in This Version

✅ Added clear "DO NOT MODIFY" instructions at top of file
✅ Created `CLAUDE_UPLOAD_PROMPT.txt` for easy copy-paste
✅ Created `HOW_TO_USE_IN_CLAUDE.md` with detailed instructions
✅ Original code remains 100% unchanged (only added comments)

---

## Still Having Issues?

If Claude still generates a different version:
1. Make sure you're uploading `bhoomiscan-engine.jsx` (not a different file)
2. Use the EXACT prompt from `CLAUDE_UPLOAD_PROMPT.txt`
3. Explicitly say "do not modify" in your message
4. If needed, say "render line by line exactly as written"

**Remember**: The code works perfectly on your dev server. The issue is communication with Claude, not the code itself.
