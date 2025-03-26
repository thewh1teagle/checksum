import { $, Glob, type SupportedCryptoAlgorithms } from "bun";
import { unlink } from "fs/promises";
import { stat } from "fs/promises";
import { appendFile } from "fs/promises";
import { readFile } from "fs/promises";

interface Asset {
  apiUrl: string;
  contentType: string;
  createdAt: string;
  downloadCount: number;
  id: string;
  label: string;
  name: string;
  size: number;
  state: string;
  updatedAt: string;
  url: string;
  browser_download_url: string;
}

async function getReleaseNoAuth(repo: string, tag: string) {
  const url = `https://api.github.com/repos/${repo}/releases/tags/${tag}`;
  const response = await fetch(url, {
    headers: { Accept: "application/vnd.github.v3+json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch release details: ${response.statusText}`);
  }

  const data = await response.text();
  return data;
}

function parsePatternsInput(patternsInput: string): string[] {
  return patternsInput
    .split("\n")
    .map((pattern) => pattern.replace(/^"|"$/g, "").trim())
    .filter((pattern) => pattern !== "");
}

async function downloadAsset(asset: Asset): Promise<void> {
  console.log(`Downloading ${asset.name}...`);
  const url = isDryRun ? asset.browser_download_url : asset.url;
  await $`wget --progress=bar:force:noscroll ${url} -O ${asset.name}`;
}

async function generateChecksum(assetName: string): Promise<string> {
  const fileBuffer = await readFile(assetName);
  const hasher = new Bun.CryptoHasher(
    hashAlgorithm as SupportedCryptoAlgorithms
  );
  const fileBlob = new Blob([fileBuffer]);
  hasher.update(fileBlob);
  return hasher.digest("hex");
}

function shouldIncludeAsset(assetName: string, patterns: string[]) {
  let matched = false;
  let excluded = false;

  // Check for each pattern
  for (const pattern of patterns) {
    const glob = new Glob(pattern);

    if (pattern.startsWith("!") && !glob.match(assetName)) {
      // This is an exclusion pattern
      excluded = true; // Mark as excluded
      break; // No need to check further patterns if excluded
    } else if (glob.match(assetName)) {
      matched = true;
    }
  }

  // Excluded
  if (excluded) {
    return false;
  }
  // Matched and not excluded
  if (matched) {
    return true;
  }
  // Not matched
  return false;
}

async function uploadChecksumFile(
  checkSumPath: string,
  repo: string,
  tag: string
): Promise<void> {
  if (isDryRun) {
    console.info(
      `Dry run. Skipping upload of ${checkSumPath} to ${repo}@${tag}`
    );
    return;
  }
  const fileInfo = await stat(checkSumPath);
  if (fileInfo.size === 0) {
    console.warn("Checksum is empty. Skipping upload.");
  } else {
    console.log("Uploading checksum file.");
    await $`gh release upload -R ${repo} ${tag} ${checkSumPath} --clobber`;
  }
}

// Info before we start

console.log("Starting checksum action...");
console.log(`Checksum file name: ${process.env.INPUT_FILE_NAME}`);
console.log(`Hash Algorithm: ${process.env.INPUT_ALGORITHM || "sha256"}`);
console.log(`Repo: ${process.env.INPUT_REPO}`);
console.log(`Tag Input: ${process.env.INPUT_TAG}`);
console.log(`Patterns Input: ${process.env.INPUT_PATTERNS}`);
console.log(`Dry Run: ${process.env.INPUT_DRY_RUN}`);

// Constants
const checkSumPath = process.env.INPUT_FILE_NAME!; // checksum.txt by default
const minSizeImmediateUpload = 1000 * 1000 * 500; // 500MB
const isDryRun = process.env.INPUT_DRY_RUN === 'true'
const isPreRelease = process.env.INPUT_PRE_RELEASE === "true";

// Algorithm
const hashAlgorithm = process.env.INPUT_ALGORITHM || "sha256";

// Repo
const githubContext = JSON.parse(process.env.GITHUB_CONTEXT ?? "{}");
const repo = process.env.INPUT_REPO || githubContext.repository;

// Tag
const tagInput = process.env.INPUT_TAG;
let tag = "";
if (tagInput) {
  // Specified tag
  tag = tagInput.trim();
} else {
  // Get latest tag
  

  // Pre release
  if (isPreRelease) {
    // https://github.com/cli/cli/issues/9909#issuecomment-2473608076
    tag =
      await $`gh release list -R ${repo} --json isPrerelease,tagName --jq 'map(select(.isPrerelease)) | first | .tagName'`
        .text()
        .then((t) => t.trim());
  } else {
    tag = await $`gh release view -R ${repo} --json tagName --jq .tagName`
      .text()
      .then((t) => t.trim());
  }
}

// Patterns
const patterns = parsePatternsInput(process.env.INPUT_PATTERNS ?? "");

let releaseContent: string;
if (isDryRun) {
  releaseContent = await getReleaseNoAuth(repo, tag);
} else {
  releaseContent = await $`gh release view ${tag} -R ${repo} --json assets`.text();
}
const releases: { assets: Asset[] } = JSON.parse(releaseContent);

for (const asset of releases.assets) {
  if (asset.name == checkSumPath) {
    console.info("Found existing checksum in assets");
    continue;
  }
  if (patterns.length && !shouldIncludeAsset(asset.name, patterns)) {
    console.log(`Skip ${asset.name}`);
    continue;
  }

  await downloadAsset(asset);

  const checksum = await generateChecksum(asset.name);
  await unlink(asset.name); // Remove file immediately after get checksum
  await appendFile(checkSumPath, `${asset.name}\t${checksum}\n`);

  if (asset.size > minSizeImmediateUpload) {
    console.log(`Uploading immdiately due to large file: ${asset.name}`);
    await uploadChecksumFile(checkSumPath, repo, tag);
  }
}

// Final upload of the checksum file
await uploadChecksumFile(checkSumPath, repo, tag);

// Info
console.log(
  `Release Tag: ${tag}, Repo: ${repo}, Algorithm: ${hashAlgorithm}, Patterns: ${JSON.stringify(
    patterns
  )}, Assets processed: ${releases.assets.length}`
);
console.log(`Checksum file content:\n${await readFile(checkSumPath, "utf-8")}`);
