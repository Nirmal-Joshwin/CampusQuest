import os
import glob

srs_path = "SRS_CampusQuest.md"
with open(srs_path, "r", encoding="utf-8") as f:
    content = f.read()

source_files = [
    "backend/app/main.py",
    "backend/app/routers/gameplay.py",
    "frontend/app/index.tsx",
    "frontend/app/catch.tsx"
]

source_md = "\n## Source Code:\n\n"
for filepath in source_files:
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as sf:
            code = sf.read()
        lang = "python" if filepath.endswith(".py") else "tsx"
        source_md += f"### `{filepath}`\n```{lang}\n{code}\n```\n\n"

screenshots = sorted(glob.glob("screenshots/*.jpg"))
demo_md = "\n## DEMONSTRATION:\n\n"
for i, img in enumerate(screenshots):
    img_path = img.replace("\\", "/") # Convert paths to unix style for markdown
    demo_md += f"**Figure {i+1} - App Screenshot**\n\n![Screenshot {i+1}]({img_path})\n\n"

split_token = "# Appendix C: To Be Determined (TBD) List"
parts = content.split(split_token)

if len(parts) == 2:
    new_content = parts[0] + source_md + demo_md + split_token + parts[1]
    with open(srs_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    with open("docs/SRS_CampusQuest.md", "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Updated successfully!")
else:
    print("Could not find split token.")

