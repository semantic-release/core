import { pathToFileURL } from "node:url";

export function main() {
  console.log("core project initialized");
}

const isEntryPoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  main();
}
