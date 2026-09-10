import { createHash, randomUUID } from "node:crypto"
import { createReadStream } from "node:fs"
import { constants } from "node:fs"
import { copyFile, link, mkdir, readFile, realpath, rename, stat, unlink, writeFile } from "node:fs/promises"
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { tool, type Plugin } from "@opencode-ai/plugin"
import sharp from "sharp"

const PROVIDER_ID = "direct-image"
const MODEL_ID = "executor"
const TOOL_NAME = "direct_image_run"
const TOKENLESS_REQUEST_MARKER = "FAST_IMAGE_DIRECT_V2"
const SYNTHETIC_ATTACHMENT_PROMPT = "Attached media from tool result:"
const PREVIEW_MARKER_START = "<!-- FAST_IMAGE_PREVIEW_V1_START -->"
const PREVIEW_MARKER_END = "<!-- FAST_IMAGE_PREVIEW_V1_END -->"
const CONFIG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const DIRECT_PROVIDER = path.join(CONFIG_ROOT, "providers", "direct-image-provider.js")
const MAX_IMAGES = 100
const MAX_PROVIDER_CONCURRENCY = 10
const MAX_REFERENCE_BYTES = 25 * 1024 * 1024
const MAX_TOTAL_REFERENCE_BYTES = 100 * 1024 * 1024
const MAX_RESPONSE_BYTES = 40 * 1024 * 1024
const REQUEST_TIMEOUT_MS = 10 * 60 * 1000
const STX_DOWNLOAD_TIMEOUT_MS = 2 * 60 * 1000
const MAX_ADAPTIVE_COPIES = 10
const MAX_STORYBOARD_BOARDS = 20
const STORYBOARD_CELL_WIDTH = 640
const STORYBOARD_CELL_HEIGHT = 360
const DEFAULT_OUTPUT_ROOT = path.join(os.homedir(), ".local", "share", "opencode", "fast-image")
const DEFAULT_PREVIEW_PORT = 41737
const PREVIEW_PORT_ATTEMPTS = 16
const MAX_INLINE_PREVIEW_BYTES = 48 * 1024
const ASPECT_RATIOS = ["1:1", "3:2", "2:3", "16:9", "9:16", "4:3", "3:4", "5:4", "4:5", "21:9"] as const

let activeProviderRequests = 0
const providerWaiters: Array<() => void> = []

type Route = "st1" | "st2" | "st3" | "st4" | "stx"
type Resolution = "1K" | "2K" | "4K"
type OutputFormat = "png" | "jpeg" | "webp"
type ReferenceImage = { bytes: Buffer; mime: string; filename: string }
type GeneratedImage = { bytes: Buffer; mime: string; remote: boolean }
type ImageAttachment = { type: "file"; mime: string; filename?: string; url: string }
type DeliveryItem = { attachment: ImageAttachment; index: number }
type PreviewItem = DeliveryItem & { url: string }
type DeliveryFailure = DeliveryItem & { reason: string }
type PreviewServer = { origin: string; close: () => Promise<void> }
type StoryboardPlan = {
  expectedShotIDs: string[]
  concurrencyLimit: number
  assembleBoards: boolean
  boardCount?: number
}
type StoryboardJob = { shotID: string; prompt: string }
type DelegatedImageJob = { jobID: string; prompt: string; referencePaths: string[] }
type StoryboardBoard = { boardID: string; title?: string; shotIDs: string[]; columns?: number }
type GeneratedOutput = { image: GeneratedImage; name: string; sourceIndex?: number }
type ParsedCommand = {
  route: Route
  mid: boolean
  prompt: string
  delegated: boolean
  adaptiveCopies: boolean
  adaptiveMaxCopies?: number
  concurrencyLimit?: number
  storyboard?: StoryboardPlan
}
type DeliveryResult = {
  delivered: number
  previewed: PreviewItem[]
  failed: DeliveryFailure[]
}
type FastImageRequest = {
  sessionID: string
  route: Route
  prompt: string
  prompts?: string[]
  jobIDs?: string[]
  jobReferences?: ReferenceImage[][]
  shotIDs?: string[]
  copies: number
  concurrencyLimit: number
  resolution: Resolution
  aspectRatio: (typeof ASPECT_RATIOS)[number]
  quality: "auto" | "low" | "medium" | "high"
  outputFormat: OutputFormat
  references: ReferenceImage[]
  delegated: boolean
  adaptiveCopies: boolean
  referenceRoot?: string
  storyboard?: StoryboardPlan & { boards?: StoryboardBoard[] }
  validationError?: string
}

const ROUTES = {
  stx: { baseURL: "https://grsai.dakka.com.cn", model: "gpt-image-2", protocol: "grsai", key: "IMAGE_API_STX_KEY" },
  st1: { baseURL: "https://sub.g-aisc.com", model: "gpt-image-2", protocol: "openai", key: "IMAGE_API_ST1_KEY" },
  st2: { baseURL: "https://aihub.top", model: "gpt-image-2", protocol: "openai", key: "IMAGE_API_ST2_KEY" },
  st3: { baseURL: "https://sub.g-aisc.com", model: "gpt-image-2", protocol: "openai-json-edit", key: "IMAGE_API_ST3_KEY" },
  st4: {
    baseURL: "https://sub.g-aisc.com",
    model: "gemini-3-pro-image-preview",
    protocol: "gemini",
    key: "IMAGE_API_ST4_KEY",
  },
} as const

function unwrap(text: string) {
  const trimmed = text.trim()
  const quote = trimmed[0]
  return trimmed.length >= 2 && (quote === '"' || quote === "'" || quote === "`") && trimmed.at(-1) === quote
    ? trimmed.slice(1, -1).trim()
    : trimmed
}

function parseCommand(text: string): ParsedCommand | undefined {
  const normalized = unwrap(text)

  const match = /^\s*(?:\/)?(st1|st2|st3|st4|stx|st)(?:\s+(mid))?(?=\s|$|[,.;:!?，。！？；：]|[\u4e00-\u9fff])/i.exec(
    normalized,
  )
  if (match) {
    let routeToken = match[1].toLowerCase()
    let mid = Boolean(match[2])
    let prompt = normalized.slice(match[0].length).replace(/^[,.;:!?，。！？；：]\s*/, "").trim()
    if (routeToken === "st") {
      const nested = /^(?:\/)?st([1-4x])(?:\s+(mid))?(?=\s|$|[,.;:!?，。！？；：]|[\u4e00-\u9fff])/i.exec(prompt)
      if (nested) {
        routeToken = `st${nested[1].toLowerCase()}`
        mid = Boolean(nested[2])
        prompt = prompt.slice(nested[0].length).replace(/^[,.;:!?，。！？；：]\s*/, "").trim()
      }
    }
    const route = (routeToken === "st" || (mid && routeToken === "st4") ? "st1" : routeToken) as Route
    const storyboard = mid ? undefined : storyboardPlan(prompt)
    return {
      route,
      mid,
      prompt,
      delegated: Boolean(storyboard),
      adaptiveCopies: false,
      ...(storyboard ? { storyboard } : {}),
    }
  }

  const directive = /[,，;；]\s*(?:请\s*)?(?:用|使用|调用|走)\s*(st1|st2|st3|st4|stx|st)(?:\s+(mid))?/gi
  const directives = [...normalized.matchAll(directive)]
  for (const candidate of directives.reverse()) {
    const tail = normalized
      .slice(candidate.index! + candidate[0].length)
      .replace(/[。.!！]\s*$/, "")
      .trim()
    const count = "[0-9]+|一|二|两|三|四|五|六|七|八|九|十"
    const controls = new RegExp(
      `^(?:(?:\\s|[,，;；:：])|(?:并发|并行)\\s*(?:${count})?|(?:${count})\\s*(?:并发|并行)|parallel\\s*(?:${count})|[124]K|[0-9]+:[0-9]+|png|jpe?g|webp|quality(?:\\s+level)?\\s*[:=]?\\s*(?:auto|low|medium|high))*$`,
      "i",
    )
    if (!controls.test(tail)) continue
    const prompt = normalized.slice(0, candidate.index).trim()
    if (!prompt) continue
    const routeToken = candidate[1].toLowerCase()
    const mid = Boolean(candidate[2])
    const route = (routeToken === "st" || (mid && routeToken === "st4") ? "st1" : routeToken) as Route
    const explicitParallel = new RegExp(
      `(?:并发|并行)\\s*(?:${count})|(?:${count})\\s*(?:并发|并行)|parallel\\s*(?:${count})`,
      "i",
    )
    const adaptiveCopies = /(?:并发|并行)|\bparallel\b/i.test(tail) && !explicitParallel.test(tail)
    const delegatedPrompt = `${prompt} ${tail}`.trim()
    const storyboard = mid ? undefined : storyboardPlan(delegatedPrompt)
    return {
      route,
      mid,
      prompt: delegatedPrompt,
      delegated: true,
      adaptiveCopies: adaptiveCopies && !mid && !storyboard,
      ...(adaptiveCopies && !mid && !storyboard
        ? { adaptiveMaxCopies: MAX_ADAPTIVE_COPIES, concurrencyLimit: MAX_ADAPTIVE_COPIES }
        : {}),
      ...(storyboard ? { storyboard } : {}),
    }
  }
  return undefined
}

const CHINESE_COUNTS: Record<string, number> = {
  "一": 1,
  "二": 2,
  "两": 2,
  "三": 3,
  "四": 4,
  "五": 5,
  "六": 6,
  "七": 7,
  "八": 8,
  "九": 9,
  "十": 10,
}
const BATCH_NUMBER = "[0-9]+|一|二|两|三|四|五|六|七|八|九|十"

function numericCount(value: string) {
  const count = CHINESE_COUNTS[value] ?? Number(value)
  return Number.isInteger(count) && count >= 1 && count <= MAX_IMAGES ? count : undefined
}

function storyboardPlan(prompt: string): StoryboardPlan | undefined {
  const range = /(?:镜(?:头|号)?\s*)?([0-9]{3})\s*(?:-|–|—|至|到)\s*([0-9]{3})/i.exec(prompt)
  if (!range || !/分镜/.test(prompt) || !/(?:分别|逐镜|每(?:个|一)?镜|独立)/.test(prompt)) return undefined
  const first = Number(range[1])
  const last = Number(range[2])
  if (!Number.isInteger(first) || !Number.isInteger(last) || first < 0 || last < first || last - first + 1 > MAX_IMAGES) {
    throw new Error(`Storyboard shot range must contain between 1 and ${MAX_IMAGES} shots.`)
  }
  const parallel =
    new RegExp(`(?:并发|并行)\\s*(${BATCH_NUMBER})`, "i").exec(prompt) ??
    new RegExp(`(${BATCH_NUMBER})\\s*(?:并发|并行)`, "i").exec(prompt) ??
    new RegExp(`parallel\\s*(${BATCH_NUMBER})`, "i").exec(prompt)
  const concurrencyLimit = parallel?.[1] ? numericCount(parallel[1]) : 1
  if (!concurrencyLimit) throw new Error(`Storyboard concurrency must be between 1 and ${MAX_IMAGES}.`)
  const board = new RegExp(`(?:拼成|拼为|拼接成|组成)\\s*(${BATCH_NUMBER})\\s*张?\\s*分镜板`, "i").exec(prompt)
  const boardCount = board?.[1] ? numericCount(board[1]) : undefined
  return {
    expectedShotIDs: Array.from({ length: last - first + 1 }, (_, index) => String(first + index).padStart(3, "0")),
    concurrencyLimit,
    assembleBoards: /(?:拼成|拼为|拼接成|组成|拼接).*分镜板/.test(prompt),
    ...(boardCount ? { boardCount } : {}),
  }
}

function extractCopies(prompt: string) {
  const patterns = [
    new RegExp(`^\\s*(?:请\\s*)?(?:生成|生图|出图)\\s*(${BATCH_NUMBER})\\s*(?:次|个|张)\\s*[:：,，]?\\s*`, "i"),
    new RegExp(`^\\s*generate\\s*(${BATCH_NUMBER})\\s*images?\\s*[:;,]?\\s*`, "i"),
    new RegExp(`^\\s*(?:并发|并行)\\s*(${BATCH_NUMBER})\\s*(?:次|个|张)?\\s*[:：,，]?\\s*`, "i"),
    new RegExp(`^\\s*(${BATCH_NUMBER})\\s*(?:并发|并行)\\s*(?:次|个|张)?\\s*[:：,，]?\\s*`, "i"),
    new RegExp(`^\\s*parallel\\s*(${BATCH_NUMBER})\\s*(?:times|images?)?\\s*[:;,]?\\s*`, "i"),
    new RegExp(`(?:[,;，；]\\s*)?(?:并发|并行)\\s*(${BATCH_NUMBER})\\s*(?:次|个|张)?\\s*$`, "i"),
    new RegExp(`(?:[,;，；]\\s*)?(${BATCH_NUMBER})\\s*(?:并发|并行)\\s*(?:次|个|张)?\\s*$`, "i"),
  ]
  for (const pattern of patterns) {
    const match = pattern.exec(prompt)
    const copies = match?.[1] ? numericCount(match[1]) : undefined
    if (match && !copies) throw new Error(`Parallel count must be between 1 and ${MAX_IMAGES}.`)
    if (match && copies) return { copies, prompt: `${prompt.slice(0, match.index)} ${prompt.slice(match.index + match[0].length)}`.trim() }
  }
  const inline =
    new RegExp(`(?:并发|并行)\\s*(${BATCH_NUMBER})\\s*(?:次|个|张)?`, "i").exec(prompt) ??
    new RegExp(`(${BATCH_NUMBER})\\s*(?:并发|并行)\\s*(?:次|个|张)?`, "i").exec(prompt) ??
    new RegExp(`parallel\\s*(${BATCH_NUMBER})\\s*(?:times|images?)?`, "i").exec(prompt)
  const inlineCopies = inline?.[1] ? numericCount(inline[1]) : undefined
  if (inline && !inlineCopies) throw new Error(`Parallel count must be between 1 and ${MAX_IMAGES}.`)
  if (inline && inlineCopies) {
    return {
      copies: inlineCopies,
      prompt: `${prompt.slice(0, inline.index)} ${prompt.slice(inline.index + inline[0].length)}`.trim(),
    }
  }
  const explicit = /(?:^|\s)(?:count|n)\s*[:=]\s*([0-9]+)\b/i.exec(prompt)
  const copies = explicit?.[1] ? numericCount(explicit[1]) : undefined
  if (explicit && !copies) throw new Error(`Image count must be between 1 and ${MAX_IMAGES}.`)
  return {
    copies: copies ?? 1,
    prompt: explicit ? `${prompt.slice(0, explicit.index)} ${prompt.slice(explicit.index + explicit[0].length)}`.trim() : prompt.trim(),
  }
}

function imageMime(bytes: Buffer) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png"
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg"
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp"
  }
  return undefined
}

async function referenceFromPart(part: Record<string, unknown>) {
  if (part.type !== "file" || typeof part.mime !== "string" || !part.mime.startsWith("image/")) return undefined
  if (!new Set(["image/png", "image/jpeg", "image/webp"]).has(part.mime)) {
    throw new Error(`Unsupported reference image type: ${part.mime}`)
  }
  if (typeof part.url !== "string") throw new Error("An attached reference image has no readable data.")
  let bytes: Buffer
  if (part.url.startsWith("data:")) {
    const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(part.url)
    if (!match || match[1].toLowerCase() !== part.mime) throw new Error("An attached reference image has invalid data.")
    bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64")
  } else if (/^file:/i.test(part.url)) {
    const filename = fileURLToPath(part.url)
    const info = await stat(filename)
    if (!info.isFile() || info.size <= 0 || info.size > MAX_REFERENCE_BYTES) {
      throw new Error("An attached reference image has an invalid file size.")
    }
    bytes = await readFile(filename)
  } else {
    throw new Error("Only pasted images and local file attachments are supported as references.")
  }
  if (bytes.length <= 0 || bytes.length > MAX_REFERENCE_BYTES || imageMime(bytes) !== part.mime) {
    throw new Error("An attached reference image is invalid or does not match its declared type.")
  }
  return {
    bytes,
    mime: part.mime,
    filename: typeof part.filename === "string" && part.filename ? path.basename(part.filename) : `reference.${part.mime.split("/")[1]}`,
  } satisfies ReferenceImage
}

async function collectReferences(parts: Array<Record<string, unknown>>) {
  const references: ReferenceImage[] = []
  let total = 0
  for (const part of parts) {
    const reference = await referenceFromPart(part)
    if (!reference) continue
    total += reference.bytes.length
    if (total > MAX_TOTAL_REFERENCE_BYTES) throw new Error("Reference images exceed the 100 MiB total limit.")
    references.push(reference)
  }
  return references
}

function pathInside(root: string, candidate: string) {
  const relative = path.relative(root, candidate)
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
}

function sessionOutputRoot(outputRoot: string, sessionID: string) {
  const session = createHash("sha256").update(sessionID).digest("hex").slice(0, 16)
  return path.join(outputRoot, session)
}

async function resolvedReferenceRoots(request: FastImageRequest, outputRoot: string) {
  const roots: string[] = []
  for (const candidate of [request.referenceRoot, sessionOutputRoot(outputRoot, request.sessionID)]) {
    if (!candidate) continue
    const resolved = await realpath(candidate).catch(() => undefined)
    if (resolved && !roots.includes(resolved)) roots.push(resolved)
  }
  return roots
}

async function loadJobReferences(request: FastImageRequest, jobs: DelegatedImageJob[], outputRoot: string) {
  const roots = await resolvedReferenceRoots(request, outputRoot)
  const cache = new Map<string, ReferenceImage>()
  let totalBytes = 0
  const loaded: ReferenceImage[][] = []

  for (const job of jobs) {
    const references: ReferenceImage[] = []
    for (const suppliedPath of job.referencePaths) {
      const candidate = path.isAbsolute(suppliedPath)
        ? path.resolve(suppliedPath)
        : request.referenceRoot
          ? path.resolve(request.referenceRoot, suppliedPath)
          : ""
      if (!candidate) throw new Error(`Image job ${job.jobID} uses a relative reference without a project root.`)
      const resolved = await realpath(candidate).catch(() => undefined)
      if (!resolved || !roots.some((root) => pathInside(root, resolved))) {
        throw new Error(`Image job ${job.jobID} has a reference outside its project and generated-output roots.`)
      }
      let reference = cache.get(resolved)
      if (!reference) {
        const info = await stat(resolved).catch(() => undefined)
        if (!info?.isFile() || info.size <= 0 || info.size > MAX_REFERENCE_BYTES) {
          throw new Error(`Image job ${job.jobID} has a missing, empty, or oversized reference image.`)
        }
        const bytes = await readFile(resolved)
        const mime = imageMime(bytes)
        if (!mime) throw new Error(`Image job ${job.jobID} has a reference that is not PNG, JPEG, or WebP.`)
        totalBytes += bytes.length
        if (totalBytes > MAX_TOTAL_REFERENCE_BYTES) {
          throw new Error("Distinct per-job reference images exceed the 100 MiB batch limit.")
        }
        reference = { bytes, mime, filename: path.basename(resolved) }
        cache.set(resolved, reference)
      }
      references.push(reference)
    }
    loaded.push(references)
  }
  return loaded
}

function requestSettings(
  route: Route,
  sourcePrompt: string,
  mid: boolean,
  references: ReferenceImage[],
  delegated = false,
  copiesOverride?: number,
) {
  const extracted = extractCopies(sourcePrompt.replace(/(\d)\s*[：:]\s*(\d)/g, "$1:$2"))
  const requestedResolution = /\b([0-9]+)K\b/i.exec(extracted.prompt)?.[1]
  if (requestedResolution && !["1", "2", "4"].includes(requestedResolution)) {
    throw new Error("Resolution must be 1K, 2K, or 4K.")
  }
  const requestedRatio = /\b([0-9]+:[0-9]+)\b/.exec(extracted.prompt)?.[1]
  if (requestedRatio && !ASPECT_RATIOS.includes(requestedRatio as (typeof ASPECT_RATIOS)[number])) {
    throw new Error(`Unsupported aspect ratio: ${requestedRatio}.`)
  }
  const resolution = (/\b(1K|2K|4K)\b/i.exec(extracted.prompt)?.[1]?.toUpperCase() ??
    (route === "st3" ? "4K" : route === "st4" ? "2K" : "1K")) as Resolution
  const aspectRatio = (ASPECT_RATIOS.find((ratio) => extracted.prompt.includes(ratio)) ?? "16:9") as (typeof ASPECT_RATIOS)[number]
  const quality = (/\bquality(?:\s+level)?\s*[:=]?\s*(auto|low|medium|high)\b/i.exec(extracted.prompt)?.[1]?.toLowerCase() ??
    (mid ? "high" : "auto")) as FastImageRequest["quality"]
  const requestedFormat = /\b(png|jpe?g|webp)\b/i.exec(extracted.prompt)?.[1]?.toLowerCase()
  const outputFormat = (requestedFormat === "jpg" ? "jpeg" : requestedFormat ?? "png") as OutputFormat
  if (!extracted.prompt) throw new Error("Usage: st1|st2|st3|st4|stx <image request>")
  if (!delegated && Buffer.byteLength(extracted.prompt, "utf8") > 30_000) {
    throw new Error("Image prompt exceeds 30,000 UTF-8 bytes.")
  }
  const referenceLimit = route === "st4" ? 14 : 4
  if (references.length > referenceLimit) throw new Error(`${route} accepts at most ${referenceLimit} reference images.`)
  if (mid && references.length !== 1) throw new Error("A mid repair request requires exactly one attached source image.")
  if (mid && extracted.copies !== 1) throw new Error("A mid repair request permits exactly one provider request.")
  const prompt = mid
    ? `${extracted.prompt}\n\nEdit only what the request explicitly names. Preserve the source image's visible style and every non-target region.`
    : extracted.prompt
  return { prompt, copies: copiesOverride ?? extracted.copies, resolution, aspectRatio, quality, outputFormat }
}

function openAIImageSize(resolution: Resolution, aspectRatio: string) {
  const edge = resolution === "1K" ? 1024 : resolution === "2K" ? 2048 : 3840
  const [ratioWidth, ratioHeight] = aspectRatio.split(":").map(Number)
  let width = ratioWidth >= ratioHeight ? edge : (edge * ratioWidth) / ratioHeight
  let height = ratioWidth >= ratioHeight ? (edge * ratioHeight) / ratioWidth : edge
  const pixels = width * height
  if (pixels < 655_360) {
    const scale = Math.sqrt(655_360 / pixels)
    width = Math.ceil((width * scale) / 2) * 2
    height = Math.ceil((height * scale) / 2) * 2
  } else if (pixels > 8_294_400) {
    const scale = Math.sqrt(8_294_400 / pixels)
    width = Math.floor((width * scale) / 2) * 2
    height = Math.floor((height * scale) / 2) * 2
  }
  return `${Math.max(256, Math.round(width / 2) * 2)}x${Math.max(256, Math.round(height / 2) * 2)}`
}

function apiKey(name: string) {
  const key = process.env[name]?.trim()
  if (!key) throw new Error(`Missing ${name}. Configure it in the OpenCode process environment.`)
  return key
}

function safeProviderMessage(payload: any, fallback: string) {
  const code = payload?.error?.code
  const message = payload?.error?.message ?? payload?.message
  const value = code && message && !String(message).includes(String(code)) ? `${code}: ${message}` : message ?? code ?? fallback
  return String(value).replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").slice(0, 2_000)
}

async function responseJson(response: Response) {
  const length = Number(response.headers.get("content-length"))
  if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES) throw new Error("Provider response exceeded 40 MiB.")
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length > MAX_RESPONSE_BYTES) throw new Error("Provider response exceeded 40 MiB.")
  let payload: any
  try {
    payload = JSON.parse(bytes.toString("utf8"))
  } catch {
    throw new Error(response.ok ? "Provider returned invalid JSON." : `HTTP ${response.status}: provider returned an unreadable error.`)
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${safeProviderMessage(payload, response.statusText)}`)
  return payload
}

function decodeProviderImage(base64: unknown) {
  if (typeof base64 !== "string" || base64.length === 0 || base64.length > Math.ceil((MAX_REFERENCE_BYTES * 4) / 3) + 8) {
    throw new Error("Provider returned missing or oversized image data.")
  }
  const bytes = Buffer.from(base64, "base64")
  const mime = imageMime(bytes)
  if (!mime || bytes.length > MAX_REFERENCE_BYTES) throw new Error("Provider returned an invalid PNG, JPEG, or WebP image.")
  return { bytes, mime, remote: false } satisfies GeneratedImage
}

function providerImageURL(value: unknown, requestedFormat: OutputFormat) {
  if (typeof value !== "string" || value.length === 0 || value.length > 8_192) {
    throw new Error("Provider returned an invalid image URL.")
  }
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error("Provider returned an invalid image URL.")
  }
  const hostname = parsed.hostname.toLowerCase()
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    (parsed.port && parsed.port !== "443") ||
    !hostname.includes(".") ||
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(hostname) ||
    hostname.includes(":")
  ) {
    throw new Error("Provider returned a non-public image URL.")
  }
  const extension = /\.(png|jpe?g|webp)$/i.exec(parsed.pathname)?.[1]?.toLowerCase()
  const mime =
    extension === "jpg" || extension === "jpeg"
      ? "image/jpeg"
      : extension === "webp"
        ? "image/webp"
        : extension === "png"
          ? "image/png"
          : requestedFormat === "jpeg"
            ? "image/jpeg"
            : requestedFormat === "webp"
              ? "image/webp"
              : "image/png"
  return { url: parsed.href, mime }
}

async function downloadProviderImage(url: string, signal: AbortSignal) {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "image/png,image/jpeg,image/webp", "User-Agent": "OpenCode-Fast-Image/1.0" },
    signal,
    redirect: "error",
  })
  if (!response.ok) throw new Error(`Provider image download failed with HTTP ${response.status}.`)
  const length = Number(response.headers.get("content-length"))
  if (Number.isFinite(length) && length > MAX_REFERENCE_BYTES) {
    throw new Error("Provider image download exceeded 25 MiB.")
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  const mime = imageMime(bytes)
  if (!mime || bytes.length <= 0 || bytes.length > MAX_REFERENCE_BYTES) {
    throw new Error("Provider image URL returned an invalid or oversized PNG, JPEG, or WebP image.")
  }
  return { bytes, mime, remote: true } satisfies GeneratedImage
}

async function openAIImage(request: FastImageRequest, signal: AbortSignal) {
  const route = ROUTES[request.route]
  const key = apiKey(route.key)
  const size = openAIImageSize(request.resolution, request.aspectRatio)
  const common = {
    model: route.model,
    prompt: request.prompt,
    n: 1,
    size,
    response_format: "b64_json",
    output_format: request.outputFormat,
    ...(request.quality === "auto" ? {} : { quality: request.quality }),
  }
  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, "User-Agent": "OpenCode-Fast-Image/1.0" }
  let body: BodyInit
  if (!request.references.length) {
    headers["Content-Type"] = "application/json"
    body = JSON.stringify(common)
  } else if (route.protocol === "openai-json-edit") {
    headers["Content-Type"] = "application/json"
    body = JSON.stringify({
      ...common,
      images: request.references.map((reference) => ({
        image_url: `data:${reference.mime};base64,${reference.bytes.toString("base64")}`,
      })),
    })
  } else {
    const form = new FormData()
    for (const [name, value] of Object.entries(common)) form.append(name, String(value))
    for (const reference of request.references) {
      form.append("image", new Blob([reference.bytes], { type: reference.mime }), reference.filename)
    }
    body = form
  }
  const endpoint = `${route.baseURL}/v1/images/${request.references.length ? "edits" : "generations"}`
  const response = await fetch(endpoint, { method: "POST", headers, body, signal, redirect: "error" })
  const payload = await responseJson(response)
  const item = Array.isArray(payload?.data) ? payload.data[0] : undefined
  if (item?.b64_json) return decodeProviderImage(item.b64_json)
  if (item?.url) {
    const image = providerImageURL(item.url, request.outputFormat)
    return downloadProviderImage(image.url, signal)
  }
  throw new Error("Provider response contained neither inline image data nor an image URL.")
}

async function geminiImage(request: FastImageRequest, signal: AbortSignal) {
  const route = ROUTES.st4
  const key = apiKey(route.key)
  const parts = request.references.map((reference) => ({
    inlineData: { mimeType: reference.mime, data: reference.bytes.toString("base64") },
  })) as Array<Record<string, unknown>>
  parts.push({ text: request.prompt })
  const response = await fetch(`${route.baseURL}/v1beta/models/${route.model}:generateContent`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "x-goog-api-key": key,
      "Content-Type": "application/json",
      "User-Agent": "OpenCode-Fast-Image/1.0",
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: request.aspectRatio, imageSize: request.resolution },
      },
    }),
    signal,
    redirect: "error",
  })
  const payload = await responseJson(response)
  const imagePart = payload?.candidates?.[0]?.content?.parts?.find((part: any) => part?.inlineData || part?.inline_data)
  return decodeProviderImage(imagePart?.inlineData?.data ?? imagePart?.inline_data?.data)
}

type StxProgress = { jobID: string; phase: string; submitted: boolean; queuedAt: number; startedAt?: number; providerTaskID?: string; generationMs?: number; downloadMs?: number; downloadAttempts?: number; savedPath?: string; error?: string; endedAt?: number; timeoutStage?: "generation" | "download"; cancelled?: boolean }

async function grsaiImage(request: FastImageRequest, signal: AbortSignal, progress: StxProgress, checkpoint: () => Promise<void>, beginDownload: () => void) {
  const route = ROUTES.stx
  let key = process.env[route.key]?.trim()
  if (!key) {
    const configPath = process.env.IMAGE_API_STX_CONFIG?.trim() || path.join(os.homedir(), "Desktop", "gaisc.json")
    let config: any
    try {
      config = JSON.parse(await readFile(configPath, "utf8"))
    } catch {
      throw new Error("Cannot read stx credentials. Configure IMAGE_API_STX_KEY or IMAGE_API_STX_CONFIG.")
    }
    if (config.base_url !== route.baseURL || config.model !== route.model) {
      throw new Error("stx config must use https://grsai.dakka.com.cn and gpt-image-2.")
    }
    key = typeof config.api_key === "string" ? config.api_key.trim() : ""
  }
  if (!key) throw new Error("Missing stx API key.")
  try {
    signal.throwIfAborted()
    progress.phase = "submitting"
    progress.submitted = true
    await checkpoint()
    if (signal.aborted) { progress.submitted = false; signal.throwIfAborted() }
    const generationStarted = performance.now()
    const response = await fetch(`${route.baseURL}/v1/api/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "User-Agent": "OpenCode-Fast-Image/1.0",
      },
      body: JSON.stringify({
        model: route.model,
        prompt: request.prompt,
        aspectRatio: request.aspectRatio,
        images: request.references.map((reference) => `data:${reference.mime};base64,${reference.bytes.toString("base64")}`),
        replyType: "json",
      }),
      signal,
      redirect: "error",
    })
    // Grsai reports errors as strings, unlike the OpenAI error object.
    let payload: any
    try { payload = await responseJson(new Response(response.body, { headers: response.headers })) }
    catch (error) { throw new Error(`HTTP ${response.status}: ${error instanceof Error ? error.message : String(error)}`) }
    progress.generationMs = Math.round(performance.now() - generationStarted)
    if (typeof payload.id === "string") progress.providerTaskID = payload.id.replaceAll(key, "[REDACTED]").slice(0, 200)
    progress.phase = payload.status === "succeeded" ? "downloading" : "provider_failed"
    if (response.ok && payload.status === "succeeded") beginDownload()
    await checkpoint()
    if (!response.ok || payload.status !== "succeeded") {
      const reason = payload.error || payload.msg || payload.status || response.statusText
      throw new Error(`HTTP ${response.status}: Grsai ${String(reason).slice(0, 2000)}${payload.id ? ` (task ${payload.id})` : ""}`)
    }
    const imageURL = providerImageURL(payload.results?.[0]?.url, request.outputFormat)
    const downloadStarted = performance.now()
    let image: GeneratedImage | undefined
    for (let attempt = 1; attempt <= 3; attempt++) {
      signal.throwIfAborted()
      progress.downloadAttempts = attempt
      try { image = await downloadProviderImage(imageURL.url, signal); break }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (signal.aborted || attempt === 3 || !/HTTP (408|429|500|502|503|504)\b|fetch failed|network|ECONNRESET|ETIMEDOUT|socket/i.test(message)) throw error
        await new Promise<void>((resolve, reject) => {
          const abort = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); reject(signal.reason) }
          const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve() }, attempt * 500)
          signal.addEventListener("abort", abort, { once: true })
          if (signal.aborted) abort()
        })
      }
    }
    if (!image) throw new Error("No downloaded image.")
    progress.downloadMs = Math.round(performance.now() - downloadStarted)
    progress.phase = "validating_image"
    // Decode all pixels, not just the header, without re-encoding the saved original.
    await sharp(image.bytes, { failOn: "warning", limitInputPixels: 16 * 1024 * 1024 }).stats()
    signal.throwIfAborted()
    const mime = `image/${request.outputFormat}`
    progress.phase = "converting_image"
    const bytes = image.mime === mime ? image.bytes : await sharp(image.bytes).toFormat(request.outputFormat).toBuffer()
    signal.throwIfAborted()
    return { bytes, mime: `image/${request.outputFormat}`, remote: true } satisfies GeneratedImage
  } catch (error) {
    throw new Error((error instanceof Error ? error.message : String(error)).replaceAll(key, "[REDACTED]"))
  }
}

function failureText(error: unknown) {
  const raw = (error instanceof Error ? error.message : String(error)).trim().slice(0, 4_000)
  if (/upstream_safety_rejected/i.test(raw)) {
    return "上游安全策略拒绝了请求。请改为完全虚构、非血腥角色，避免要求复刻或恐怖化真人脸。"
  }
  if (/HTTP (401|403)\b/i.test(raw)) {
    return `${raw} 解决方案：检查对应图片路线的 API key、账户权限和余额，然后用一条新的显式 st1/st2/st3/st4 命令重试。`
  }
  if (/HTTP 400\b/i.test(raw)) {
    return `${raw} 解决方案：检查提示词、参考图、尺寸和格式参数，修正后用一条新的显式 st1/st2/st3/st4 命令提交。`
  }
  if (/HTTP (429|502|503|524)\b/i.test(raw)) {
    return `${raw} 请稍后用一条新的显式 st1/st2/st3/st4 命令重试，或手动切换路线。`
  }
  if (/timed out|aborted|cancelled/i.test(raw)) {
    return `${raw} 解决方案：先检查 Provider 账单或任务记录，确认没有完成后再用一条新的显式命令提交，避免重复计费。`
  }
  return `${raw || "Unknown image provider failure."} 解决方案：按错误修正输入或切换路线，再用一条新的显式 st1/st2/st3/st4 命令提交。`
}

function extensionFor(mime: string) {
  return mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png"
}

function dataURL(image: GeneratedImage) {
  return `data:${image.mime};base64,${image.bytes.toString("base64")}`
}

function fileMime(filename: string) {
  const extension = path.extname(filename).toLowerCase()
  if (extension === ".png") return "image/png"
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg"
  if (extension === ".webp") return "image/webp"
  return undefined
}

function sendPreviewError(response: ServerResponse, status: number, message: string) {
  if (response.headersSent) {
    response.destroy()
    return
  }
  response.statusCode = status
  response.setHeader("Content-Type", "text/plain; charset=utf-8")
  response.setHeader("Cache-Control", "no-store")
  response.end(message)
}

function previewHandler(outputRoot: string) {
  return (request: IncomingMessage, response: ServerResponse) => {
    void (async () => {
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.setHeader("Allow", "GET, HEAD")
        sendPreviewError(response, 405, "Method not allowed")
        return
      }
      const url = new URL(request.url ?? "/", "http://127.0.0.1")
      const match = /^\/image\/([A-Za-z0-9_-]+)(?:\/[^/]*)?$/.exec(url.pathname)
      if (!match) {
        sendPreviewError(response, 404, "Not found")
        return
      }
      const relative = Buffer.from(match[1]!, "base64url").toString("utf8")
      if (!relative || relative.includes("\0") || path.isAbsolute(relative)) {
        sendPreviewError(response, 404, "Not found")
        return
      }
      const candidate = path.resolve(outputRoot, relative)
      const resolved = await realpath(candidate).catch(() => undefined)
      if (!resolved) {
        sendPreviewError(response, 404, "Not found")
        return
      }
      const inside = resolved.startsWith(`${outputRoot}${path.sep}`)
      const mime = inside ? fileMime(resolved) : undefined
      const info = mime ? await stat(resolved).catch(() => undefined) : undefined
      if (!info?.isFile() || info.size <= 0 || info.size > MAX_REFERENCE_BYTES) {
        sendPreviewError(response, 404, "Not found")
        return
      }
      response.statusCode = 200
      response.setHeader("Content-Type", mime!)
      response.setHeader("Content-Length", String(info.size))
      response.setHeader("Cache-Control", "private, max-age=31536000, immutable")
      response.setHeader("Cross-Origin-Resource-Policy", "cross-origin")
      response.setHeader("X-Content-Type-Options", "nosniff")
      const filename = path.basename(resolved).replace(/["\\\r\n]/g, "_")
      response.setHeader("Content-Disposition", `inline; filename="${filename}"`)
      if (request.method === "HEAD") {
        response.end()
        return
      }
      const stream = createReadStream(resolved)
      stream.on("error", () => sendPreviewError(response, 500, "Unable to read image"))
      stream.pipe(response)
    })().catch(() => sendPreviewError(response, 404, "Not found"))
  }
}

async function listenPreviewServer(server: Server, port: number) {
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      server.off("error", onError)
      server.off("listening", onListening)
    }
    const onError = (error: Error) => {
      cleanup()
      reject(error)
    }
    const onListening = () => {
      cleanup()
      resolve()
    }
    server.once("error", onError)
    server.once("listening", onListening)
    server.listen({ host: "127.0.0.1", port, exclusive: true })
  })
}

async function startPreviewServer(outputRoot: string, preferredPort: number) {
  await mkdir(outputRoot, { recursive: true })
  const root = await realpath(outputRoot)
  const ports =
    preferredPort === 0
      ? [0]
      : Array.from({ length: PREVIEW_PORT_ATTEMPTS }, (_, index) => preferredPort + index).filter(
          (port) => port <= 65_535,
        )
  let lastError: unknown
  for (const port of ports) {
    const server = createServer(previewHandler(root))
    server.on("clientError", (_error, socket) => socket.destroy())
    try {
      await listenPreviewServer(server, port)
      const address = server.address()
      if (!address || typeof address === "string") throw new Error("Preview server did not expose a TCP port.")
      server.unref()
      return {
        origin: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise<void>((resolve) => {
            if (!server.listening) {
              resolve()
              return
            }
            server.close(() => resolve())
          }),
      } satisfies PreviewServer
    } catch (error) {
      lastError = error
      if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()))
      if ((error as NodeJS.ErrnoException)?.code !== "EADDRINUSE" || preferredPort === 0) break
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Unable to start the local image preview server.")
}

function localPreviewURL(server: PreviewServer, outputRoot: string, attachment: ImageAttachment) {
  if (!attachment.filename || !path.isAbsolute(attachment.filename)) return undefined
  const relative = path.relative(outputRoot, path.resolve(attachment.filename))
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return undefined
  const token = Buffer.from(relative, "utf8").toString("base64url")
  return `${server.origin}/image/${token}/${encodeURIComponent(path.basename(attachment.filename))}`
}

async function previewItems(
  items: DeliveryItem[],
  outputRoot: string,
  serverPromise: Promise<PreviewServer | undefined>,
) {
  const server = await serverPromise
  const previewed: PreviewItem[] = []
  const failed: DeliveryFailure[] = []
  let inlineBytes = 0
  for (const item of items) {
    const local = server ? localPreviewURL(server, outputRoot, item.attachment) : undefined
    if (local) {
      previewed.push({ attachment: item.attachment, index: item.index, url: local })
      continue
    }
    const size = Buffer.byteLength(item.attachment.url, "utf8")
    if (item.attachment.url.startsWith("data:image/") && inlineBytes + size <= MAX_INLINE_PREVIEW_BYTES) {
      inlineBytes += size
      previewed.push({ attachment: item.attachment, index: item.index, url: item.attachment.url })
      continue
    }
    failed.push({
      ...item,
      reason: `Local preview was unavailable and the inline image exceeded the ${MAX_INLINE_PREVIEW_BYTES / 1024} KiB safety limit.`,
    })
  }
  return { previewed, failed }
}

function previewMarkdown(items: PreviewItem[]) {
  if (!items.length) return ""
  return [
    PREVIEW_MARKER_START,
    ...items.flatMap((item) => {
      const number = item.index + 1
      const image = `![生成图片 ${number}](${item.url})`
      return item.url.startsWith("http")
        ? [image, `[打开原图 ${number}](${item.url})`, ""]
        : [image, ""]
    }),
    PREVIEW_MARKER_END,
  ].join("\n")
}

function stripPreviewMarkdown(text: string) {
  const start = text.indexOf(PREVIEW_MARKER_START)
  if (start === -1) return text
  const end = text.indexOf(PREVIEW_MARKER_END, start)
  if (end === -1) return text.slice(0, start).trimEnd()
  return `${text.slice(0, start)}${text.slice(end + PREVIEW_MARKER_END.length)}`.replace(/\n{3,}/g, "\n\n").trim()
}

function safeOutputName(value: string) {
  return value.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "image"
}

async function persistGeneratedImages(request: FastImageRequest, outputs: GeneratedOutput[], outputRoot: string, existingDirectory?: string) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 17)
  const session = createHash("sha256").update(request.sessionID).digest("hex").slice(0, 16)
  const directory = existingDirectory ?? path.join(outputRoot, session, `${stamp}-${randomUUID().slice(0, 8)}`)
  const attachments: ImageAttachment[] = []
  const saveErrors: string[] = []
  let saved = 0
  let writable = true
  try {
    await mkdir(directory, { recursive: true })
  } catch (error) {
    writable = false
    saveErrors.push(String(error).slice(0, 4000))
  }

  for (const [index, output] of outputs.entries()) {
    const image = output.image
    const filename = `${safeOutputName(output.name)}.${extensionFor(image.mime)}`
    const url = dataURL(image)
    const filepath = path.join(directory, filename)
    const temporary = `${filepath}.${randomUUID()}.tmp`
    if (writable) {
      try {
        await writeFile(temporary, image.bytes, { flag: "wx" })
        // Publish atomically without replacing an existing name (including on Windows).
        try { await link(temporary, filepath) }
        catch (error) {
          if (!["ENOTSUP", "EOPNOTSUPP", "ENOSYS", "EXDEV", "EPERM"].includes((error as NodeJS.ErrnoException)?.code ?? "")) throw error
          // This fallback is exclusive, but not atomic. Never remove the destination
          // on failure: another writer may own it. copyFile handles its own cleanup.
          await copyFile(temporary, filepath, constants.COPYFILE_EXCL)
        }
        await unlink(temporary).catch(() => undefined)
        saved++
        attachments.push({ type: "file", mime: image.mime, filename: filepath, url })
        continue
      } catch (error) {
        saveErrors.push(String(error).slice(0, 4000))
        await unlink(temporary).catch(() => undefined)
      }
    }
    attachments.push({ type: "file", mime: image.mime, filename, url })
  }

  if (writable && request.storyboard) {
    await writeFile(
      path.join(directory, "storyboard-manifest.json"),
      JSON.stringify(
        {
          route: request.route,
          resolution: request.resolution,
          aspectRatio: request.aspectRatio,
          concurrencyLimit: request.concurrencyLimit,
          jobs: request.shotIDs?.map((shotID, index) => ({ shotID, prompt: request.prompts?.[index] })) ?? [],
          boards: request.storyboard.boards ?? [],
        },
        null,
        2,
      ),
      { encoding: "utf8", mode: 0o600 },
    ).catch(() => undefined)
  }

  return { attachments, directory: saved ? directory : undefined, saved, saveErrors }
}

async function settleWithLimit<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>) {
  const results = new Array<PromiseSettledResult<R>>(items.length)
  let next = 0
  const run = async () => {
    while (true) {
      const index = next++
      if (index >= items.length) return
      try {
        results[index] = { status: "fulfilled", value: await worker(items[index]!, index) }
      } catch (reason) {
        results[index] = { status: "rejected", reason }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, MAX_PROVIDER_CONCURRENCY, items.length) }, run))
  return results
}

async function withProviderSlot<T>(signal: AbortSignal, worker: () => Promise<T>) {
  const release = await new Promise<() => void>((resolve, reject) => {
    let released = false
    const start = () => {
      signal.removeEventListener("abort", onAbort)
      activeProviderRequests++
      resolve(() => {
        if (released) return
        released = true
        activeProviderRequests--
        providerWaiters.shift()?.()
      })
    }
    const onAbort = () => {
      const index = providerWaiters.indexOf(start)
      if (index !== -1) providerWaiters.splice(index, 1)
      reject(signal.reason ?? new Error("Image request was aborted."))
    }
    if (signal.aborted) {
      onAbort()
    } else if (activeProviderRequests < MAX_PROVIDER_CONCURRENCY) {
      start()
    } else {
      providerWaiters.push(start)
      signal.addEventListener("abort", onAbort, { once: true })
    }
  })
  try {
    return await worker()
  } finally {
    release()
  }
}

function escapeXML(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!)
}

async function storyboardPanel(image: GeneratedImage, shotID: string, width: number, height: number) {
  const label = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect x="12" y="12" width="88" height="42" rx="3" fill="#050608" fill-opacity="0.88"/><text x="56" y="41" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="24" font-weight="700">${escapeXML(shotID)}</text></svg>`,
  )
  return sharp(image.bytes)
    .resize({ width, height, fit: "contain", background: "#0b0d10" })
    .composite([{ input: label, left: 0, top: 0 }])
    .png()
    .toBuffer()
}

async function normalizeStoryboardMaster(request: FastImageRequest, image: GeneratedImage): Promise<GeneratedImage> {
  const [width, height] = request.resolution === "4K" ? [3840, 2160] : request.resolution === "2K" ? [2048, 1152] : [1024, 576]
  let pipeline = sharp(image.bytes).rotate().resize({ width, height, fit: "contain", background: "#0b0d10" })
  if (request.outputFormat === "jpeg") pipeline = pipeline.jpeg({ quality: 95 })
  else if (request.outputFormat === "webp") pipeline = pipeline.webp({ quality: 95 })
  else pipeline = pipeline.png()
  return {
    bytes: await pipeline.toBuffer(),
    mime: request.outputFormat === "jpeg" ? "image/jpeg" : request.outputFormat === "webp" ? "image/webp" : "image/png",
    remote: image.remote,
  }
}

async function assembleStoryboardBoards(request: FastImageRequest, shotImages: Map<string, GeneratedImage>) {
  const boards = request.storyboard?.boards ?? []
  const outputs: GeneratedOutput[] = []
  const skipped: string[] = []
  for (const board of boards) {
    const missing = board.shotIDs.filter((shotID) => !shotImages.has(shotID))
    if (missing.length) {
      skipped.push(`${board.boardID}（缺少 ${missing.join(", ")}）`)
      continue
    }
    try {
      const columns = board.columns ?? (board.shotIDs.length <= 6 ? 3 : 4)
      const rows = Math.ceil(board.shotIDs.length / columns)
      const headerHeight = 72
      const canvasWidth = STORYBOARD_CELL_WIDTH * columns
      const canvasHeight = headerHeight + STORYBOARD_CELL_HEIGHT * rows
      const title = escapeXML(board.title ?? board.boardID)
      const header = Buffer.from(
        `<svg width="${canvasWidth}" height="${headerHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#080a0d"/><text x="28" y="47" fill="#eef2f6" font-family="Microsoft YaHei, Arial, sans-serif" font-size="30" font-weight="700">${title}</text></svg>`,
      )
      const composites: sharp.OverlayOptions[] = [{ input: header, left: 0, top: 0 }]
      for (const [index, shotID] of board.shotIDs.entries()) {
        composites.push({
          input: await storyboardPanel(shotImages.get(shotID)!, shotID, STORYBOARD_CELL_WIDTH, STORYBOARD_CELL_HEIGHT),
          left: (index % columns) * STORYBOARD_CELL_WIDTH,
          top: headerHeight + Math.floor(index / columns) * STORYBOARD_CELL_HEIGHT,
        })
      }
      const bytes = await sharp({
        create: { width: canvasWidth, height: canvasHeight, channels: 3, background: "#14181d" },
      })
        .composite(composites)
        .png()
        .toBuffer()
      outputs.push({ image: { bytes, mime: "image/png", remote: false }, name: `board-${board.boardID}` })
    } catch (error) {
      skipped.push(`${board.boardID}（本地拼板失败：${failureText(error)}）`)
    }
  }
  return { outputs, skipped }
}

async function executeImageRequest(
  request: FastImageRequest,
  parentSignal: AbortSignal,
  outputRoot: string,
  deliver: (attachments: ImageAttachment[]) => Promise<DeliveryResult>,
) {
  if (request.route === "stx" && !request.validationError) {
    if (request.resolution !== "1K") request.validationError = "stx gpt-image-2 supports 1K only; no VIP model substitution was made."
    else if (request.quality !== "auto") request.validationError = "stx supports automatic quality only on /v1/api/generate."
  }
  if (!request.validationError) {
    const names = Array.from({ length: request.copies }, (_, index) => request.shotIDs?.[index] ? `shot-${request.shotIDs[index]}` : request.jobIDs?.[index] ?? `${request.route}-${String(index + 1).padStart(2, "0")}`)
    names.push(...(request.storyboard?.boards ?? []).map(board => `board-${board.boardID}`))
    const seen = new Set<string>()
    for (const name of names) {
      const normalized = safeOutputName(name).toLowerCase()
      if (seen.has(normalized)) { request.validationError = "Output filename collision after normalization; use distinct task IDs (including case and first 80 characters)."; break }
      seen.add(normalized)
    }
  }
  if (request.validationError) {
    return {
      title: "Fast image request rejected",
      output: `未发送图片 API 请求。\n\n原因：${request.validationError}\n本次没有自动重试。`,
      metadata: { route: request.route, providerRequests: 0, retries: 0, attachmentCount: 0 },
    }
  }
  const controller = new AbortController()
  const abort = () => controller.abort(parentSignal.reason)
  if (parentSignal.aborted) abort()
  else parentSignal.addEventListener("abort", abort, { once: true })
  const timeout = request.route === "stx" ? undefined : setTimeout(() => controller.abort(new Error("Image API request timed out after 10 minutes.")), REQUEST_TIMEOUT_MS)
  timeout?.unref()
  const startedAt = performance.now()
  const progress: StxProgress[] = []
  const savedEarly = new Map<number, Awaited<ReturnType<typeof persistGeneratedImages>>>()
  const batchDirectory = path.join(outputRoot, createHash("sha256").update(request.sessionID).digest("hex").slice(0, 16), `${Date.now()}-${randomUUID().slice(0, 8)}`)
  const checkpoint = async (item: StxProgress) => {
    if (request.route !== "stx") return
    const file = path.join(batchDirectory, `${safeOutputName(item.jobID)}-${createHash("sha256").update(item.jobID).digest("hex").slice(0, 8)}.status.json`)
    const temporary = `${file}.${randomUUID()}.tmp`
    try {
      await mkdir(batchDirectory, { recursive: true })
      await writeFile(temporary, JSON.stringify(item, null, 2), { mode: 0o600 })
      await rename(temporary, file)
    } catch { await unlink(temporary).catch(() => undefined) }
  }
  const diagnostics = () => request.route === "stx" ? { plannedRequests: request.copies, providerRequests: progress.filter(p => p.submitted).length, notSubmittedTaskIDs: progress.filter(p => !p.submitted).map(p => p.jobID), jobResults: progress, diagnosticDirectory: batchDirectory } : {}
  try {
    const prompts = request.prompts ?? Array.from({ length: request.copies }, () => request.prompt)
    progress.push(...prompts.map((_, i) => ({ jobID: request.jobIDs?.[i] ?? request.shotIDs?.[i] ?? `REQUEST-${i + 1}`, phase: "queued", submitted: false, queuedAt: Date.now() })))
    const settled = await settleWithLimit(
      prompts,
      request.concurrencyLimit,
      async (prompt, index) => {
        const childRequest = {
          ...request,
          prompt,
          copies: 1,
          references: request.jobReferences?.[index] ?? request.references,
        }
        const item = progress[index]!
        try {
        const generated = await withProviderSlot(controller.signal, async () => {
          if (childRequest.route === "stx") {
            const jobController = new AbortController()
            const cancel = () => jobController.abort(controller.signal.reason)
            controller.signal.addEventListener("abort", cancel, { once: true })
            if (controller.signal.aborted) cancel()
            const expire = (stage: "generation" | "download") => {
              if (jobController.signal.aborted) return
              item.timeoutStage = stage
              jobController.abort(new Error(stage === "generation" ? "STX generation timed out after 10 minutes." : "STX download timed out after 2 minutes."))
            }
            let timer = setTimeout(() => expire("generation"), REQUEST_TIMEOUT_MS)
            timer.unref()
            const beginDownload = () => {
              jobController.signal.throwIfAborted()
              clearTimeout(timer)
              timer = setTimeout(() => expire("download"), STX_DOWNLOAD_TIMEOUT_MS)
              timer.unref()
            }
            item.startedAt = Date.now()
            try { return await grsaiImage(childRequest, jobController.signal, item, () => checkpoint(item), beginDownload) }
            finally { clearTimeout(timer); controller.signal.removeEventListener("abort", cancel) }
          }
          return (
          childRequest.route === "st4"
            ? geminiImage(childRequest, controller.signal)
            : openAIImage(childRequest, controller.signal))
        })
        const image = request.storyboard ? await normalizeStoryboardMaster(request, generated) : generated
        if (request.route === "stx") {
          controller.signal.throwIfAborted()
          const name = request.shotIDs?.[index] ? `shot-${request.shotIDs[index]}` : request.jobIDs?.[index] ?? `${request.route}-${String(index + 1).padStart(2, "0")}`
          const saved = await persistGeneratedImages(request, [{ image, name, sourceIndex: index }], outputRoot, batchDirectory)
          savedEarly.set(index, saved)
          item.savedPath = saved.saved ? saved.attachments[0]?.filename : undefined
          item.phase = saved.saved ? "saved" : "generated_not_saved"
          if (saved.saveErrors.length) item.error = saved.saveErrors.join("; ").slice(0, 4000)
          item.cancelled = controller.signal.aborted
          item.endedAt = Date.now()
          await checkpoint(item)
        }
        return image
        } catch (error) {
          item.error = (error instanceof Error ? error.message : String(error)).slice(0, 4000)
          item.cancelled = controller.signal.aborted
          item.phase = !item.submitted ? "not_submitted" : item.cancelled ? "cancelled_after_submission" : item.timeoutStage ? `${item.timeoutStage}_timeout` : item.phase === "validating_image" ? "invalid_image" : item.phase === "converting_image" ? "conversion_failed" : item.phase === "downloading" ? "download_failed" : item.phase === "provider_failed" ? "provider_failed" : "submission_outcome_unknown"
          item.endedAt = Date.now()
          await checkpoint(item)
          throw error
        }
      },
    )
    const generated = settled.flatMap((result, index) =>
      result.status === "fulfilled" ? [{ image: result.value, index }] : [],
    )
    const failedTaskIDs = settled.flatMap((result, index) =>
      result.status === "rejected"
        ? [request.jobIDs?.[index] ?? request.shotIDs?.[index] ?? `REQUEST-${index + 1}`]
        : [],
    )
    const failures = settled.flatMap((result, index) =>
      result.status === "rejected"
        ? [`${request.shotIDs?.[index] ? `镜头 ${request.shotIDs[index]}` : request.jobIDs?.[index] ? `任务 ${request.jobIDs[index]}` : `请求 ${index + 1}`}：${failureText(result.reason)}`]
        : [],
    )
    const elapsedMs = Math.round(performance.now() - startedAt)
    if (!generated.length) {
      return {
        title: "Fast image generation failed",
        output: ["未生成图片。", "", ...failures, ...(request.route === "stx" ? [`已发起生成请求：${progress.filter(p => p.submitted).length}；未提交：${progress.filter(p => !p.submitted).length}。计费状态未知；生成成功后下载失败的任务请按服务端ID核查，不要直接重生。`] : []), "", "本次没有自动重试生成。"].join("\n"),
        metadata: {
          route: request.route,
          providerRequests: request.copies,
          retries: 0,
          elapsedMs,
          attachmentCount: 0,
          failureCount: failures.length,
          failedTaskIDs,
          generatedMasterCount: 0,
          savedImageCount: 0,
          ...diagnostics(),
        },
      }
    }
    const masterOutputs: GeneratedOutput[] = generated.map(({ image, index }) => ({
      image,
      name: request.shotIDs?.[index]
        ? `shot-${request.shotIDs[index]}`
        : request.jobIDs?.[index] ?? `${request.route}-${String(index + 1).padStart(2, "0")}`,
      sourceIndex: index,
    }))
    const shotImages = new Map(
      generated.flatMap(({ image, index }) => (request.shotIDs?.[index] ? [[request.shotIDs[index]!, image] as const] : [])),
    )
    const assembled = request.storyboard
      ? await assembleStoryboardBoards(request, shotImages)
      : { outputs: [] as GeneratedOutput[], skipped: [] as string[] }
    const outputs = [...masterOutputs, ...assembled.outputs]
    const extra = request.route === "stx" && assembled.outputs.length ? await persistGeneratedImages(request, assembled.outputs, outputRoot, batchDirectory) : undefined
    const materialized = request.route === "stx" ? {
      attachments: [...generated.flatMap(({ index }) => savedEarly.get(index)?.attachments ?? []), ...(extra?.attachments ?? [])],
      saved: [...savedEarly.values()].reduce((sum, value) => sum + value.saved, 0) + (extra?.saved ?? 0),
      directory: [...savedEarly.values()].some(value => value.saved) || extra?.saved ? batchDirectory : undefined,
    } : await persistGeneratedImages(request, outputs, outputRoot)
    const delivery = await deliver(materialized.attachments)
    const deliveryFailed = delivery.failed.length
    const markdown = previewMarkdown(delivery.previewed)
    const storyboardSummary = request.storyboard
      ? `已生成 ${generated.length} 张独立分镜图，已确定性拼成 ${assembled.outputs.length} 张分镜板；已准备 ${delivery.delivered} 张可见交付。`
      : `已生成 ${generated.length} 张图片；已准备 ${delivery.delivered} 张可见交付。`
    return {
      title: request.storyboard ? "Storyboard image batch" : request.copies > 1 ? "Fast image batch" : "Fast image",
      output: [
        storyboardSummary,
        `路线：${request.route}，总任务：${request.copies}，最大并发：${request.concurrencyLimit}，耗时：${(elapsedMs / 1000).toFixed(1)} 秒。`,
        ...(request.route === "stx" ? [`已发起生成请求：${progress.filter(p => p.submitted).length}；未提交：${progress.filter(p => !p.submitted).length}。已提交不等于确认计费，取消后服务端结果可能未知。`] : []),
        `交付：助手结果本地预览 ${delivery.previewed.length} 张。`,
        ...(delivery.previewed.some((item) => item.url.startsWith("http")) ? ["使用“打开原图”链接可在系统浏览器查看本地原图。"] : []),
        ...(materialized.directory ? [`本地原图目录：${materialized.directory}`] : []),
        ...(materialized.saved < outputs.length
          ? [`${outputs.length - materialized.saved} 张本地保存失败；仅对满足大小限制的图片使用内联预览。`]
          : []),
        ...(markdown ? ["", markdown] : []),
        ...(deliveryFailed
          ? [
              `未能创建可见交付 ${deliveryFailed} 张：`,
              ...delivery.failed.map((item) => `图片 ${item.index + 1}：${item.reason}`),
              materialized.directory
                ? "交付没有自动重试；可从上方本地原图目录打开这些文件。"
                : "交付没有自动重试；失败图片已作为原生工具附件作最后回退，但当前 Desktop 可能不会显示它们。",
            ]
          : []),
        ...(failures.length ? [`失败 ${failures.length} 项：`, ...failures] : []),
        ...(assembled.skipped.length ? [`未拼接 ${assembled.skipped.length} 张分镜板：`, ...assembled.skipped] : []),
        "自动重试：0。",
      ].join("\n"),
      metadata: {
        route: request.route,
        providerRequests: request.copies,
        concurrencyLimit: request.concurrencyLimit,
        retries: 0,
        elapsedMs,
        attachmentCount: delivery.delivered,
        failureCount: failures.length,
        failedTaskIDs,
        generatedMasterCount: generated.length,
        assembledBoardCount: assembled.outputs.length,
        remoteAttachmentCount: generated.filter((item) => item.image.remote).length,
        savedImageCount: materialized.saved,
        deliveredImageCount: delivery.delivered,
        deliveryFailureCount: deliveryFailed,
        previewImageCount: delivery.previewed.length,
        referenceImageCount: request.jobReferences
          ? request.jobReferences.reduce((total, references) => total + references.length, 0)
          : request.references.length,
        ...diagnostics(),
      },
      ...(deliveryFailed ? { attachments: delivery.failed.map((item) => item.attachment) } : {}),
    }
  } finally {
    clearTimeout(timeout)
    parentSignal.removeEventListener("abort", abort)
  }
}

async function delegatedRequest(request: FastImageRequest, prompts: unknown, jobs: unknown, outputRoot: string) {
  if (!request.delegated || request.validationError) return request
  if (jobs !== undefined) {
    if (prompts !== undefined) {
      return { ...request, validationError: "Submit either image jobs or prompts, not both." }
    }
    if (!Array.isArray(jobs) || jobs.length < 1 || jobs.length > request.copies) {
      return { ...request, validationError: `Image jobs must contain between 1 and ${request.copies} items.` }
    }
    const normalizedJobs: DelegatedImageJob[] = []
    const jobIDs = new Set<string>()
    const referenceLimit = request.route === "st4" ? 14 : 4
    for (const [index, item] of jobs.entries()) {
      if (!item || typeof item !== "object") {
        return { ...request, validationError: `Image job ${index + 1} is not an object.` }
      }
      const job = item as Record<string, unknown>
      if (typeof job.jobID !== "string" || !/^[A-Za-z0-9_-]{1,120}$/.test(job.jobID)) {
        return { ...request, validationError: `Image job ${index + 1} has an invalid jobID.` }
      }
      if (jobIDs.has(job.jobID)) {
        return { ...request, validationError: `Image jobID ${job.jobID} is duplicated.` }
      }
      jobIDs.add(job.jobID)
      if (typeof job.prompt !== "string" || !job.prompt.trim()) {
        return { ...request, validationError: `Image job ${job.jobID} has no prompt.` }
      }
      const prompt = job.prompt.trim()
      if (Buffer.byteLength(prompt, "utf8") > 30_000) {
        return { ...request, validationError: `Image job ${job.jobID} prompt exceeds 30,000 UTF-8 bytes.` }
      }
      const referencePaths = job.referencePaths === undefined ? [] : job.referencePaths
      if (
        !Array.isArray(referencePaths) ||
        referencePaths.length > referenceLimit ||
        referencePaths.some((reference) => typeof reference !== "string" || !reference.trim())
      ) {
        return {
          ...request,
          validationError: `Image job ${job.jobID} must contain at most ${referenceLimit} non-empty reference paths.`,
        }
      }
      const normalizedPaths = referencePaths.map((reference) => reference.trim()) as string[]
      if (new Set(normalizedPaths).size !== normalizedPaths.length) {
        return { ...request, validationError: `Image job ${job.jobID} contains duplicate reference paths.` }
      }
      normalizedJobs.push({ jobID: job.jobID, prompt, referencePaths: normalizedPaths })
    }
    const jobReferences = await loadJobReferences(request, normalizedJobs, outputRoot)
    return {
      ...request,
      prompt: normalizedJobs[0]!.prompt,
      prompts: normalizedJobs.map((job) => job.prompt),
      jobIDs: normalizedJobs.map((job) => job.jobID),
      jobReferences,
      copies: normalizedJobs.length,
      concurrencyLimit: Math.min(request.concurrencyLimit, normalizedJobs.length),
    }
  }
  if (!Array.isArray(prompts)) {
    return { ...request, validationError: "This delegated request requires a prompts array." }
  }
  const expected = request.adaptiveCopies ? undefined : request.copies
  const maximum = request.adaptiveCopies ? MAX_ADAPTIVE_COPIES : request.copies
  if (prompts.length < 1 || prompts.length > maximum || (expected !== undefined && prompts.length !== expected)) {
    const requirement = expected === undefined ? `between 1 and ${maximum}` : `exactly ${expected}`
    return { ...request, validationError: `Delegated prompts must contain ${requirement} item(s).` }
  }
  const normalized: string[] = []
  for (const prompt of prompts) {
    if (typeof prompt !== "string" || !prompt.trim()) {
      return { ...request, validationError: "Every delegated image prompt must be a non-empty string." }
    }
    const value = prompt.trim()
    if (Buffer.byteLength(value, "utf8") > 30_000) {
      return { ...request, validationError: "A delegated image prompt exceeds 30,000 UTF-8 bytes." }
    }
    normalized.push(value)
  }
  return {
    ...request,
    prompt: normalized[0]!,
    prompts: normalized,
    copies: normalized.length,
    concurrencyLimit: request.adaptiveCopies
      ? Math.min(MAX_PROVIDER_CONCURRENCY, normalized.length)
      : Math.min(request.concurrencyLimit, normalized.length),
  }
}

function storyboardRequest(request: FastImageRequest, jobs: unknown, boards: unknown) {
  const plan = request.storyboard
  if (!plan || request.validationError) return request
  if (!Array.isArray(jobs)) return { ...request, validationError: "Storyboard mode requires a jobs array." }
  if (jobs.length !== plan.expectedShotIDs.length) {
    return {
      ...request,
      validationError: `Storyboard jobs must contain exactly ${plan.expectedShotIDs.length} items, not ${jobs.length}.`,
    }
  }
  const normalizedJobs: StoryboardJob[] = []
  for (const [index, item] of jobs.entries()) {
    if (!item || typeof item !== "object") {
      return { ...request, validationError: `Storyboard job ${index + 1} is not an object.` }
    }
    const job = item as Record<string, unknown>
    const expected = plan.expectedShotIDs[index]
    if (job.shotID !== expected) {
      return { ...request, validationError: `Storyboard job ${index + 1} must be shot ${expected}.` }
    }
    if (typeof job.prompt !== "string" || !job.prompt.trim()) {
      return { ...request, validationError: `Storyboard shot ${expected} has no prompt.` }
    }
    const prompt = job.prompt.trim()
    if (Buffer.byteLength(prompt, "utf8") > 30_000) {
      return { ...request, validationError: `Storyboard shot ${expected} prompt exceeds 30,000 UTF-8 bytes.` }
    }
    if (!/16\s*:\s*9/.test(prompt)) {
      return { ...request, validationError: `Storyboard shot ${expected} prompt must explicitly request one 16:9 frame.` }
    }
    if (/(?:九宫格|六宫格|四宫格|多格|分镜板|拼板|contact\s*sheet|panel\s*grid)/i.test(prompt)) {
      return { ...request, validationError: `Storyboard shot ${expected} prompt requests a grid instead of one independent frame.` }
    }
    normalizedJobs.push({ shotID: expected, prompt })
  }
  if (new Set(normalizedJobs.map((job) => job.prompt)).size !== normalizedJobs.length) {
    return { ...request, validationError: "Every storyboard shot must have a distinct standalone prompt." }
  }

  let normalizedBoards: StoryboardBoard[] | undefined
  if (plan.assembleBoards) {
    if (!Array.isArray(boards) || !boards.length || boards.length > MAX_STORYBOARD_BOARDS) {
      return { ...request, validationError: "Storyboard assembly requires a non-empty boards array." }
    }
    if (plan.boardCount && boards.length !== plan.boardCount) {
      return { ...request, validationError: `Storyboard assembly requires exactly ${plan.boardCount} boards.` }
    }
    normalizedBoards = []
    const assigned: string[] = []
    const boardIDs = new Set<string>()
    for (const [index, item] of boards.entries()) {
      if (!item || typeof item !== "object") {
        return { ...request, validationError: `Storyboard board ${index + 1} is not an object.` }
      }
      const board = item as Record<string, unknown>
      if (typeof board.boardID !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(board.boardID)) {
        return { ...request, validationError: `Storyboard board ${index + 1} has an invalid boardID.` }
      }
      if (boardIDs.has(board.boardID)) {
        return { ...request, validationError: `Storyboard boardID ${board.boardID} is duplicated.` }
      }
      boardIDs.add(board.boardID)
      if (!Array.isArray(board.shotIDs) || !board.shotIDs.length) {
        return { ...request, validationError: `Storyboard board ${board.boardID} has no shotIDs.` }
      }
      if (board.shotIDs.some((shotID) => typeof shotID !== "string" || !plan.expectedShotIDs.includes(shotID))) {
        return { ...request, validationError: `Storyboard board ${board.boardID} contains an unknown shotID.` }
      }
      const columns = board.columns === undefined ? undefined : Number(board.columns)
      if (columns !== undefined && (!Number.isInteger(columns) || columns < 1 || columns > 6)) {
        return { ...request, validationError: `Storyboard board ${board.boardID} columns must be between 1 and 6.` }
      }
      assigned.push(...(board.shotIDs as string[]))
      normalizedBoards.push({
        boardID: board.boardID,
        ...(typeof board.title === "string" && board.title.trim() ? { title: board.title.trim().slice(0, 100) } : {}),
        shotIDs: board.shotIDs as string[],
        ...(columns ? { columns } : {}),
      })
    }
    if (assigned.join("|") !== plan.expectedShotIDs.join("|")) {
      return { ...request, validationError: "Storyboard boards must cover every requested shot exactly once and in order." }
    }
  } else if (Array.isArray(boards) && boards.length) {
    return { ...request, validationError: "This request did not ask for storyboard-board assembly." }
  }

  return {
    ...request,
    prompt: normalizedJobs[0]!.prompt,
    prompts: normalizedJobs.map((job) => job.prompt),
    shotIDs: normalizedJobs.map((job) => job.shotID),
    copies: normalizedJobs.length,
    concurrencyLimit: Math.min(plan.concurrencyLimit, MAX_PROVIDER_CONCURRENCY, normalizedJobs.length),
    storyboard: {
      ...plan,
      concurrencyLimit: Math.min(plan.concurrencyLimit, MAX_PROVIDER_CONCURRENCY, normalizedJobs.length),
      ...(normalizedBoards ? { boards: normalizedBoards } : {}),
    },
  }
}

function prepareRequest(request: FastImageRequest, prompts: unknown, jobs: unknown, boards: unknown, outputRoot: string) {
  return request.storyboard ? storyboardRequest(request, jobs, boards) : delegatedRequest(request, prompts, jobs, outputRoot)
}

function rejectedDirectRequest(sessionID: string, reason: string, route: Route = "st2"): FastImageRequest {
  return {
    sessionID,
    route,
    prompt: "",
    copies: 1,
    concurrencyLimit: 1,
    resolution: route === "st3" ? "4K" : route === "st4" ? "2K" : "1K",
    aspectRatio: "16:9",
    quality: "auto",
    outputFormat: "png",
    references: [],
    delegated: false,
    adaptiveCopies: false,
    validationError: reason,
  }
}

async function directToolRequest(
  input: {
    route?: unknown
    prompt?: unknown
    prompts?: unknown
    jobs?: unknown
    boards?: unknown
    projectRoot?: unknown
    copies?: unknown
    resolution?: unknown
    aspectRatio?: unknown
    quality?: unknown
    outputFormat?: unknown
    concurrency?: unknown
  },
  context: { sessionID: string; directory?: string },
  outputRoot: string,
) {
  const route = input.route === undefined ? "st2" : String(input.route).toLowerCase()
  if (!Object.hasOwn(ROUTES, route)) {
    return rejectedDirectRequest(context.sessionID, "Route must be st1, st2, st3, st4, or stx.")
  }
  const normalizedRoute = route as Route
  const sources = [input.prompt !== undefined, input.prompts !== undefined, input.jobs !== undefined].filter(Boolean).length
  if (sources !== 1) {
    return rejectedDirectRequest(
      context.sessionID,
      "Provide exactly one of prompt, prompts, or jobs.",
      normalizedRoute,
    )
  }

  const jobs = input.jobs
  const prompts = input.prompts
  const boards = input.boards
  const directPrompt = input.prompt
  const copies = input.copies === undefined ? undefined : Number(input.copies)
  if (copies !== undefined && (!Number.isInteger(copies) || copies < 1 || copies > MAX_IMAGES)) {
    return rejectedDirectRequest(context.sessionID, `Copies must be between 1 and ${MAX_IMAGES}.`, normalizedRoute)
  }
  const count = Array.isArray(jobs) ? jobs.length : Array.isArray(prompts) ? prompts.length : copies ?? 1
  if (!Number.isInteger(count) || count < 1 || count > MAX_IMAGES) {
    return rejectedDirectRequest(
      context.sessionID,
      `Each direct image call must contain between 1 and ${MAX_IMAGES} tasks.`,
      normalizedRoute,
    )
  }
  if ((Array.isArray(jobs) || Array.isArray(prompts)) && copies !== undefined && copies !== count) {
    return rejectedDirectRequest(context.sessionID, "Copies must match the supplied jobs or prompts length.", normalizedRoute)
  }

  const resolution = input.resolution === undefined
    ? normalizedRoute === "st3"
      ? "4K"
      : normalizedRoute === "st4"
        ? "2K"
        : "1K"
    : String(input.resolution).toUpperCase()
  if (!(resolution === "1K" || resolution === "2K" || resolution === "4K")) {
    return rejectedDirectRequest(context.sessionID, "Resolution must be 1K, 2K, or 4K.", normalizedRoute)
  }
  const aspectRatio = input.aspectRatio === undefined ? "16:9" : String(input.aspectRatio)
  if (!(ASPECT_RATIOS as readonly string[]).includes(aspectRatio)) {
    return rejectedDirectRequest(context.sessionID, `Unsupported aspect ratio: ${aspectRatio}.`, normalizedRoute)
  }
  const quality = input.quality === undefined ? "auto" : String(input.quality).toLowerCase()
  if (!(quality === "auto" || quality === "low" || quality === "medium" || quality === "high")) {
    return rejectedDirectRequest(context.sessionID, "Quality must be auto, low, medium, or high.", normalizedRoute)
  }
  const outputFormatValue = input.outputFormat === undefined ? "png" : String(input.outputFormat).toLowerCase()
  const outputFormat = outputFormatValue === "jpg" ? "jpeg" : outputFormatValue
  if (!(outputFormat === "png" || outputFormat === "jpeg" || outputFormat === "webp")) {
    return rejectedDirectRequest(context.sessionID, "Output format must be png, jpeg, or webp.", normalizedRoute)
  }
  const requestedConcurrency = input.concurrency === undefined ? Math.min(count, MAX_PROVIDER_CONCURRENCY) : Number(input.concurrency)
  if (!Number.isInteger(requestedConcurrency) || requestedConcurrency < 1) {
    return rejectedDirectRequest(context.sessionID, "Concurrency must be a positive integer.", normalizedRoute)
  }

  const allShotJobs = Array.isArray(jobs) && jobs.every(
    (item) => item && typeof item === "object" && typeof (item as Record<string, unknown>).shotID === "string",
  )
  const anyShotJobs = Array.isArray(jobs) && jobs.some(
    (item) => item && typeof item === "object" && (item as Record<string, unknown>).shotID !== undefined,
  )
  if (anyShotJobs && !allShotJobs) {
    return rejectedDirectRequest(context.sessionID, "Do not mix storyboard shot jobs with ordinary image jobs.", normalizedRoute)
  }
  if (allShotJobs) {
    const shotIDs = (jobs as Array<Record<string, unknown>>).map((job) => String(job.shotID))
    if (shotIDs.some((shotID) => !/^[0-9]{3}$/.test(shotID)) || new Set(shotIDs).size !== shotIDs.length) {
      return rejectedDirectRequest(context.sessionID, "Storyboard shotID values must be unique three-digit IDs.", normalizedRoute)
    }
  }
  if (!allShotJobs && Array.isArray(boards) && boards.length) {
    return rejectedDirectRequest(context.sessionID, "Boards require jobs with shotID values.", normalizedRoute)
  }

  const projectRoot = input.projectRoot === undefined
    ? path.resolve(context.directory ?? process.cwd())
    : path.resolve(context.directory ?? process.cwd(), String(input.projectRoot))
  const request: FastImageRequest = {
    sessionID: context.sessionID,
    route: normalizedRoute,
    prompt: typeof directPrompt === "string"
      ? directPrompt.trim()
      : Array.isArray(prompts) && typeof prompts[0] === "string"
        ? prompts[0].trim()
        : Array.isArray(jobs) && jobs[0] && typeof jobs[0] === "object" && typeof (jobs[0] as Record<string, unknown>).prompt === "string"
          ? String((jobs[0] as Record<string, unknown>).prompt).trim()
          : "",
    ...(typeof directPrompt === "string" && count > 1
      ? { prompts: Array.from({ length: count }, () => directPrompt.trim()) }
      : {}),
    copies: count,
    concurrencyLimit: Math.min(requestedConcurrency, MAX_PROVIDER_CONCURRENCY, count),
    resolution: resolution as Resolution,
    aspectRatio: aspectRatio as FastImageRequest["aspectRatio"],
    quality: quality as FastImageRequest["quality"],
    outputFormat: outputFormat as OutputFormat,
    references: [],
    delegated: input.prompts !== undefined || input.jobs !== undefined,
    adaptiveCopies: false,
    referenceRoot: projectRoot,
    ...(allShotJobs
      ? {
          storyboard: {
            expectedShotIDs: (jobs as Array<Record<string, unknown>>).map((job) => String(job.shotID)),
            concurrencyLimit: Math.min(requestedConcurrency, MAX_PROVIDER_CONCURRENCY, count),
            assembleBoards: Array.isArray(boards) && boards.length > 0,
            ...(Array.isArray(boards) && boards.length ? { boardCount: boards.length } : {}),
          },
        }
      : {}),
  }
  if (!request.prompt) return { ...request, validationError: "Every image request needs a non-empty prompt." }
  if (!request.delegated && Buffer.byteLength(request.prompt, "utf8") > 30_000) {
    return { ...request, validationError: "Image prompt exceeds 30,000 UTF-8 bytes." }
  }
  try {
    return await prepareRequest(request, prompts, jobs, boards, outputRoot)
  } catch (error) {
    return { ...request, validationError: error instanceof Error ? error.message : String(error) }
  }
}

function delegatedInstruction(request: FastImageRequest) {
  if (request.storyboard) {
    const shots = request.storyboard.expectedShotIDs
    const boardRule = request.storyboard.assembleBoards
      ? `Also submit ${request.storyboard.boardCount ? `exactly ${request.storyboard.boardCount}` : "the requested"} deterministic board definition(s) in boards; every shot must appear exactly once and in order.`
      : "Do not submit boards."
    return [
      TOKENLESS_REQUEST_MARKER,
      `Storyboard route: ${request.route}; ${request.resolution}; ${request.aspectRatio}; ${request.outputFormat}.`,
      `Prepare exactly ${shots.length} distinct jobs ordered ${shots[0]} through ${shots.at(-1)}. Maximum provider concurrency is ${Math.min(request.concurrencyLimit, MAX_PROVIDER_CONCURRENCY)}; it is not the image count.`,
      "Each jobs item must be {shotID, prompt}. Each prompt must describe one complete standalone 16:9 still for only that shot, include the locked continuity canon and exact camera/action state, and forbid grids, labels, captions, logos, and watermarks.",
      boardRule,
      "Resolve the full screenplay and numbered shot list from the conversation or workspace before compiling. Do not guess missing shot content.",
      `Call direct_image_run with route=${request.route}, resolution=${request.resolution}, aspectRatio=${request.aspectRatio}, outputFormat=${request.outputFormat}, concurrency=${Math.min(request.concurrencyLimit, MAX_PROVIDER_CONCURRENCY)}, plus jobs and boards. Do not retry automatically or perform provider calls yourself.`,
    ].join("\n")
  }
  const count = request.adaptiveCopies
    ? `Choose the minimum sufficient batch size from 1 to ${request.copies}; the user explicitly requested concurrency.`
    : `Prepare exactly ${request.copies} complete standalone image prompt(s).`
  return [
    TOKENLESS_REQUEST_MARKER,
    `Route: ${request.route}; resolution: ${request.resolution}; aspect ratio: ${request.aspectRatio}; format: ${request.outputFormat}.`,
    count,
    "Use the user's current request plus relevant conversation and workspace context to prepare the final prompts.",
    `Call direct_image_run with route=${request.route}, resolution=${request.resolution}, aspectRatio=${request.aspectRatio}, outputFormat=${request.outputFormat}, concurrency=${Math.min(request.concurrencyLimit, MAX_PROVIDER_CONCURRENCY)}, and the prompts array. Do not retry automatically.`,
  ].join("\n")
}

const fastImagePlugin = (async (_pluginInput, options) => {
  let fallbackAgent = "build"
  let fallbackModel = { providerID: "aihub", modelID: "gpt-5.6-sol" }
  const configuredOutputRoot = typeof options?.outputRoot === "string" ? options.outputRoot.trim() : ""
  const outputRoot = configuredOutputRoot ? path.resolve(configuredOutputRoot) : DEFAULT_OUTPUT_ROOT
  const configuredPreviewPort = Number(options?.previewPort)
  const previewPort =
    Number.isInteger(configuredPreviewPort) && configuredPreviewPort >= 0 && configuredPreviewPort <= 65_535
      ? configuredPreviewPort
      : DEFAULT_PREVIEW_PORT
  const previewServer = startPreviewServer(outputRoot, previewPort).catch(() => undefined)
  const pendingDirectRequests = new Map<string, FastImageRequest>()

  async function deliverImages(attachments: ImageAttachment[]) {
    if (!attachments.length) {
      return { delivered: 0, previewed: [], failed: [] }
    }
    const preview = await previewItems(
      attachments.map((attachment, index) => ({ attachment, index })),
      outputRoot,
      previewServer,
    )
    return {
      delivered: preview.previewed.length,
      previewed: preview.previewed,
      failed: preview.failed,
    }
  }

  return {
    dispose: async () => {
      const server = await previewServer
      await server?.close()
    },
    config: async (config) => {
      const mutable = config as any
      if (typeof mutable.default_agent === "string" && mutable.default_agent !== "image-fast") fallbackAgent = mutable.default_agent
      if (typeof mutable.model === "string" && mutable.model.includes("/")) {
        const separator = mutable.model.indexOf("/")
        fallbackModel = { providerID: mutable.model.slice(0, separator), modelID: mutable.model.slice(separator + 1) }
      }
      mutable.provider ??= {}
      mutable.provider[PROVIDER_ID] = {
        name: "Fast Image Executor",
        npm: pathToFileURL(DIRECT_PROVIDER).href,
        options: {},
        models: {
          [MODEL_ID]: {
            name: "Fast Image Executor",
            attachment: true,
            reasoning: false,
            temperature: false,
            tool_call: true,
            limit: { context: 1_000_000, input: 1_000_000, output: 10_000 },
            modalities: { input: ["text", "image"], output: ["text"] },
          },
        },
      }
      if (Array.isArray(mutable.enabled_providers) && !mutable.enabled_providers.includes(PROVIDER_ID)) {
        mutable.enabled_providers.push(PROVIDER_ID)
      }
    },
    tool: {
      [TOOL_NAME]: tool({
        description: "Generate images directly through st1, st2, st3, st4, or stx without an authorization token. stx uses Grsai gpt-image-2 at 1K and automatic quality only. Submit one prompt, a prompts array, per-job prompts/referencePaths, or storyboard jobs/boards. Provider concurrency is always capped at 10. Inputs are validated before provider calls, outputs are saved locally, and paid failures are never retried automatically.",
        args: {
          sourceMessageID: tool.schema.string().max(200).optional(),
          route: tool.schema.string().optional(),
          prompt: tool.schema.string().optional(),
          prompts: tool.schema.array(tool.schema.string()).max(MAX_IMAGES).optional(),
          jobs: tool.schema
            .array(
              tool.schema.object({
                jobID: tool.schema.string().optional(),
                shotID: tool.schema.string().optional(),
                prompt: tool.schema.string(),
                referencePaths: tool.schema.array(tool.schema.string()).max(14).optional(),
              }),
            )
            .max(MAX_IMAGES)
            .optional(),
          boards: tool.schema
            .array(
              tool.schema.object({
                boardID: tool.schema.string(),
                title: tool.schema.string().optional(),
                shotIDs: tool.schema.array(tool.schema.string()).max(MAX_IMAGES),
                columns: tool.schema.number().int().min(1).max(6).optional(),
              }),
            )
            .max(MAX_STORYBOARD_BOARDS)
            .optional(),
          projectRoot: tool.schema.string().optional(),
          copies: tool.schema.number().int().min(1).max(MAX_IMAGES).optional(),
          resolution: tool.schema.string().optional(),
          aspectRatio: tool.schema.string().optional(),
          quality: tool.schema.string().optional(),
          outputFormat: tool.schema.string().optional(),
          concurrency: tool.schema.number().int().min(1).optional(),
        },
        async execute({
          sourceMessageID,
          route,
          prompt,
          prompts,
          jobs,
          boards,
          projectRoot,
          copies,
          resolution,
          aspectRatio,
          quality,
          outputFormat,
          concurrency,
        }, context) {
          if (sourceMessageID) {
            const direct = pendingDirectRequests.get(sourceMessageID)
            if (!direct || direct.sessionID !== context.sessionID) {
              return {
                title: "Fast image request unavailable",
                output: "当前 st 请求不存在或已执行。本次没有调用图片 API。",
                metadata: { providerRequests: 0, retries: 0, attachmentCount: 0 },
              }
            }
            pendingDirectRequests.delete(sourceMessageID)
            return executeImageRequest(direct, context.abort, outputRoot, deliverImages)
          }
          const direct = await directToolRequest(
            { route, prompt, prompts, jobs, boards, projectRoot, copies, resolution, aspectRatio, quality, outputFormat, concurrency },
            context,
            outputRoot,
          )
          return executeImageRequest(direct, context.abort, outputRoot, deliverImages)
        },
      }),
    },
    "command.execute.before": async (input, output) => {
      if (input.command !== "st" && input.command !== "stx") return
      const files = output.parts.filter((part) => part.type === "file")
      const argumentText = input.arguments.trim()
      const text = input.command === "stx"
        ? `stx ${argumentText}`.trim()
        : /^(?:\/)?st(?:[1-4x])?(?=\s|$)/i.test(argumentText) ? argumentText : `st ${argumentText}`.trim()
      output.parts.splice(0, output.parts.length, { type: "text", text } as (typeof output.parts)[number], ...files)
    },
    "chat.message": async (input, output) => {
      const marker = output.parts.find(
        (part) =>
          part.type === "text" &&
          part.synthetic === true &&
          part.text.startsWith(TOKENLESS_REQUEST_MARKER),
      )
      if (marker) return
      const text = output.parts
        .filter((part) => part.type === "text" && !part.synthetic)
        .map((part) => part.text)
        .join("\n")
      const command = parseCommand(text)
      if (!command) {
        if (output.message.agent === "image-fast" || output.message.model?.providerID === PROVIDER_ID) {
          output.message.agent = fallbackAgent
          output.message.model = fallbackModel
        }
        return
      }
      let request: FastImageRequest
      try {
        const references = await collectReferences(output.parts as Array<Record<string, unknown>>)
        const settings = requestSettings(
          command.route,
          command.prompt,
          command.mid,
          references,
          command.delegated,
          command.storyboard?.expectedShotIDs.length,
        )
        const copies = command.adaptiveCopies ? (command.adaptiveMaxCopies ?? MAX_ADAPTIVE_COPIES) : settings.copies
        request = {
          sessionID: input.sessionID,
          route: command.route,
          ...settings,
          copies,
          concurrencyLimit:
            Math.min(
              MAX_PROVIDER_CONCURRENCY,
              command.storyboard?.concurrencyLimit ?? command.concurrencyLimit ?? copies,
              copies,
            ),
          references,
          delegated: command.delegated,
          adaptiveCopies: command.adaptiveCopies,
          ...(command.storyboard ? { storyboard: command.storyboard } : {}),
        }
      } catch (error) {
        request = {
          sessionID: input.sessionID,
          route: command.route,
          prompt: command.prompt,
          copies:
            command.storyboard?.expectedShotIDs.length ??
            (command.adaptiveCopies ? (command.adaptiveMaxCopies ?? MAX_ADAPTIVE_COPIES) : 1),
          concurrencyLimit:
            Math.min(
              MAX_PROVIDER_CONCURRENCY,
              command.storyboard?.concurrencyLimit ?? command.concurrencyLimit ?? 1,
            ),
          resolution: "1K",
          aspectRatio: "16:9",
          quality: "auto",
          outputFormat: "png",
          references: [],
          delegated: command.delegated,
          adaptiveCopies: command.adaptiveCopies,
          ...(command.storyboard ? { storyboard: command.storyboard } : {}),
          validationError: error instanceof Error ? error.message : String(error),
        }
      }
      const messageID = output.message.id
      if (command.delegated) {
        if (output.message.agent === "image-fast" || output.message.model?.providerID === PROVIDER_ID) {
          output.message.agent = fallbackAgent
          output.message.model = fallbackModel
        }
        output.parts.push({
          id: `prt_${randomUUID().replaceAll("-", "")}`,
          sessionID: input.sessionID,
          messageID,
          type: "text",
          text: delegatedInstruction(request),
          synthetic: true,
        } as (typeof output.parts)[number])
        return
      }
      pendingDirectRequests.set(messageID, request)
      output.message.agent = "image-fast"
      output.message.model = { providerID: PROVIDER_ID, modelID: MODEL_ID }
      output.parts.splice(0, output.parts.length, {
        id: `prt_${randomUUID().replaceAll("-", "")}`,
        sessionID: input.sessionID,
        messageID,
        type: "text",
        text: `${TOKENLESS_REQUEST_MARKER}:${messageID}`,
        synthetic: true,
      } as (typeof output.parts)[number])
    },
    "experimental.chat.messages.transform": async (_input, output) => {
      const latestUserIndex = output.messages.findLastIndex((message) => message.info.role === "user")
      const latestUser = output.messages[latestUserIndex]
      const latestUserID = latestUser?.info.id
      const currentFastImage = latestUser?.parts.some(
        (part) => part.type === "text" && part.text.includes(TOKENLESS_REQUEST_MARKER),
      )
      for (const [messageIndex, message] of output.messages.entries()) {
        const directImageRequest = message.parts.some(
          (part) => part.type === "text" && part.text.includes(TOKENLESS_REQUEST_MARKER),
        )
        const syntheticMedia = message.parts.some(
          (part) => part.type === "text" && part.text.trim() === SYNTHETIC_ATTACHMENT_PROMPT,
        )
        if (directImageRequest || syntheticMedia) {
          message.parts = message.parts.filter(
            (part) =>
              part.type !== "file" &&
              !(
                message.info.id !== latestUserID &&
                part.type === "text" &&
                (part.text.includes(TOKENLESS_REQUEST_MARKER) || part.text.trim() === SYNTHETIC_ATTACHMENT_PROMPT)
              ),
          )
        }
        if (!currentFastImage || messageIndex <= latestUserIndex) {
          for (const part of message.parts) {
            if (part.type === "text" && part.text.includes(PREVIEW_MARKER_START)) {
              part.text = stripPreviewMarkdown(part.text)
            }
            if (part.type === "tool") {
              const state = (part as any).state
              if (typeof state?.output === "string" && state.output.includes(PREVIEW_MARKER_START)) {
                state.output = stripPreviewMarkdown(state.output)
              }
            }
          }
        }
      }
    },
    "experimental.compaction.autocontinue": async (input, output) => {
      if (input.agent === "image-fast" || input.model.providerID === PROVIDER_ID) output.enabled = false
    },
  }
}) satisfies Plugin

export default fastImagePlugin
