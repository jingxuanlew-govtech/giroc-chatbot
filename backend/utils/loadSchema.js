import fs from "fs";
import path from "path";

export function loadSchema(__dirname) {
  const possiblePaths = [
    path.join(__dirname, "../schemas/form-schema.json"),
    path.join(__dirname, "./schemas/form-schema.json"),
    path.join(__dirname, "form-schema.json"),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf-8");
      return JSON.parse(raw);
    }
  }

  throw new Error("Could not find form-schema.json");
}