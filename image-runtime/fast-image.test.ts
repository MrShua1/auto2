import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { spawnSync } from "node:child_process"
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import sharp from "sharp"

import fastImagePlugin from "./plugins/fast-image"
import { createDirectImageProvider } from "./providers/direct-image-provider.js"

const PNG = (
  await sharp({ create: { width: 160, height: 90, channels: 3, background: "#24364a" } })
    .png()
    .toBuffer()
).toString("base64")
const DIRECT_MARKER = "FAST_IMAGE_DIRECT_V2"
const PREVIEW_MARKER = "<!-- FAST_IMAGE_PREVIEW_V1_START -->"
const ORIGINAL_FETCH = globalThis.fetch
const ORIGINAL_KEY = process.env.IMAGE_API_ST2_KEY
const ORIGINAL_STX_KEY = process.env.IMAGE_API_STX_KEY

type Harness = Awaited<ReturnType<typeof makeHarness>>

async function makeHarness(options?: { blockedOutputRoot?: boolean }) {
  const testRoot = path.join(os.tmpdir(), "opencode-fast-image-tests", randomUUID())
  const outputRoot = options?.blockedOutputRoot ? path.join(testRoot, "blocked") : testRoot
  if (options?.blockedOutputRoot) {
    await mkdir(testRoot, { recursive: true })
    await writeFile(outputRoot, "not a directory")
  }
  const patchCalls: unknown[] = []
  const client = {
    _client: {
      patch: async (input: unknown) => {
        patchCalls.push(input)
        return { data: input }
      },
    },
  }
  const hooks = await fastImagePlugin({ client } as any, { outputRoot, previewPort: 0 })
  await hooks.config?.({ model: "aihub/gpt-5.6-sol", provider: {}, enabled_providers: ["aihub"] } as any)
  return { hooks, outputRoot, patchCalls, testRoot }
}

async function cleanupHarness(harness: Harness) {
  await harness.hooks.dispose?.()
  await rm(harness.testRoot, { recursive: true, force: true })
}

async function runTool(
  harness: Harness,
  sessionID: string,
  args: Record<string, unknown>,
  signal = new AbortController().signal,
) {
  return harness.hooks.tool!.direct_image_run.execute(args as any, {
    sessionID,
    messageID: `msg_${randomUUID().replaceAll("-", "")}`,
    agent: "build",
    directory: process.cwd(),
    worktree: process.cwd(),
    abort: signal,
    metadata() {},
    async ask() {},
  }) as Promise<any>
}

async function sendMessage(harness: Harness, sessionID: string, text: string, agent = "build") {
  const output: any = {
    message: {
      id: `msg_${randomUUID().replaceAll("-", "")}`,
      agent,
      model: { providerID: "aihub", modelID: "gpt-5.6-sol" },
    },
    parts: [{ type: "text", text }],
  }
  await harness.hooks["chat.message"]?.({ sessionID }, output)
  return output
}

function imageResponse(status = 200, image = PNG) {
  if (status !== 200) {
    return new Response(JSON.stringify({ error: { code: "offline_error", message: "mock failure" } }), {
      status,
      headers: { "content-type": "application/json" },
    })
  }
  return new Response(JSON.stringify({ data: [{ b64_json: image }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}

beforeEach(() => {
  process.env.IMAGE_API_ST2_KEY = "offline-test-key"
  process.env.IMAGE_API_STX_KEY = "offline-stx-key"
})

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
  if (ORIGINAL_KEY === undefined) delete process.env.IMAGE_API_ST2_KEY
  else process.env.IMAGE_API_ST2_KEY = ORIGINAL_KEY
  if (ORIGINAL_STX_KEY === undefined) delete process.env.IMAGE_API_STX_KEY
  else process.env.IMAGE_API_STX_KEY = ORIGINAL_STX_KEY
})

describe("fast image plugin", () => {
  test("isolated local fault regressions", () => {
    const result = spawnSync(process.execPath, [path.join(import.meta.dir, "fast-image-faults.fixture.ts")], { encoding: "utf8", timeout: 30_000 })
    expect(result.error).toBeUndefined()
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain("STX local fault scenarios passed")
  })
  test("image publication never replaces a file created before the final save", async () => {
    const harness = await makeHarness(); let occupied = ""
    globalThis.fetch = (async (_url, init) => {
      if (init?.method === "GET") {
        const files = await readdir(harness.outputRoot, { recursive: true })
        const journal = files.find(file => file.endsWith(".status.json"))!
        occupied = path.join(harness.outputRoot, path.dirname(journal), "OCCUPIED.png")
        await writeFile(occupied, "existing file must survive", { flag: "wx" })
        return new Response(Buffer.from(PNG, "base64"))
      }
      return Response.json({ status: "succeeded", results: [{ url: "https://cdn.example.com/a.png" }] })
    }) as typeof fetch
    try {
      const result = await runTool(harness, "no-overwrite", { route: "stx", jobs: [{ jobID: "OCCUPIED", prompt: "cup" }] })
      expect(result.metadata.savedImageCount).toBe(0)
      expect(result.metadata.jobResults[0].phase).toBe("generated_not_saved")
      expect(await readFile(occupied, "utf8")).toBe("existing file must survive")
    } finally { await cleanupHarness(harness) }
  })

  test("output filename collisions are rejected before any paid request", async () => {
    const harness = await makeHarness(); let calls = 0
    globalThis.fetch = (async () => { calls++; return imageResponse() }) as typeof fetch
    try {
      for (const route of ["stx", "st2"]) for (const ids of [["A".repeat(80) + "1", "A".repeat(80) + "2"], ["CaseID", "caseid"], ["-same", "same-"]]) {
        const result = await runTool(harness, "collision", { route, jobs: ids.map(jobID => ({ jobID, prompt: "cup" })) })
        expect(result.metadata.providerRequests).toBe(0)
        expect(result.output).toContain("filename collision")
      }
      expect(calls).toBe(0)
    } finally { await cleanupHarness(harness) }
  })

  test("stx rejects truncated PNG header and pixel data rather than reporting saved", async () => {
    const harness = await makeHarness()
    const complete = Buffer.from(PNG, "base64")
    const idat = complete.indexOf(Buffer.from("IDAT"))
    try {
      for (const bytes of [complete.subarray(0, 16), complete.subarray(0, idat + 7)]) {
        globalThis.fetch = (async (_url, init) => init?.method === "GET" ? new Response(bytes) : Response.json({ id: "corrupt", status: "succeeded", results: [{ url: "https://cdn.example.com/a.png" }] })) as typeof fetch
        const result = await runTool(harness, "invalid-png", { route: "stx", prompt: "cup" })
        expect(result.metadata).toMatchObject({ providerRequests: 1, generatedMasterCount: 0, savedImageCount: 0 })
        expect(result.metadata.jobResults[0].phase).toBe("invalid_image")
        expect((await readdir(result.metadata.diagnosticDirectory)).some(file => file.endsWith(".png"))).toBe(false)
      }
    } finally { await cleanupHarness(harness) }
  })

  test("stx download has a fresh bounded budget and still honors user cancellation", async () => {
    const harness = await makeHarness(); const original = globalThis.setTimeout
    globalThis.setTimeout = ((fn: any, ms: number, ...args: any[]) => original(fn, ms === 600000 ? 240 : ms === 120000 ? 240 : ms, ...args)) as typeof setTimeout
    try {
      for (const scenario of ["success", "timeout", "cancel"]) {
        const stop = new AbortController(); let gets = 0
        globalThis.fetch = (async (_url, init) => {
          if (init?.method === "GET") {
            gets++
            if (scenario === "cancel") stop.abort(new Error("user cancelled download"))
            await new Promise<void>((resolve, reject) => {
              const abort = () => { clearTimeout(timer); init?.signal?.removeEventListener("abort", abort); reject(init?.signal?.reason) }
              const timer = original(() => { init?.signal?.removeEventListener("abort", abort); resolve() }, scenario === "timeout" ? 500 : 150)
              init?.signal?.addEventListener("abort", abort, { once: true })
              if (init?.signal?.aborted) abort()
            })
            return new Response(Buffer.from(PNG, "base64"))
          }
          await new Promise(resolve => original(resolve, 150))
          return Response.json({ id: "late-success", status: "succeeded", results: [{ url: "https://cdn.example.com/a.png" }] })
        }) as typeof fetch
        const result = await runTool(harness, "download-budget", { route: "stx", prompt: "cup" }, stop.signal)
        expect(gets).toBe(1)
        expect(result.metadata.providerRequests).toBe(1)
        expect(result.metadata.jobResults[0].phase).toBe(scenario === "success" ? "saved" : scenario === "timeout" ? "download_timeout" : "cancelled_after_submission")
        if (scenario === "timeout") expect(result.metadata.jobResults[0].error).toContain("download timed out")
      }
    } finally { globalThis.setTimeout = original; await cleanupHarness(harness) }
  })

  test("stx retries only transient image GET and preserves unchanged PNG bytes", async () => {
    const harness = await makeHarness(); let posts = 0; let gets = 0
    globalThis.fetch = (async (_url, init) => {
      if (init?.method === "GET") { gets++; return gets === 1 ? new Response("busy", { status: 503 }) : new Response(Buffer.from(PNG, "base64")) }
      posts++; return Response.json({ id: "saved-task", status: "succeeded", results: [{ url: "https://cdn.example.com/a.png" }] })
    }) as typeof fetch
    try {
      const result = await runTool(harness, "download-retry", { route: "stx", prompt: "cup" })
      expect(posts).toBe(1); expect(gets).toBe(2)
      expect(result.metadata.jobResults[0]).toMatchObject({ phase: "saved", providerTaskID: "saved-task", downloadAttempts: 2 })
      expect(await readFile(result.metadata.jobResults[0].savedPath)).toEqual(Buffer.from(PNG, "base64"))
    } finally { await cleanupHarness(harness) }
  })

  test("stx saves completed image before next job and cancellation never submits queued jobs", async () => {
    const harness = await makeHarness(); const abort = new AbortController(); let posts = 0; let savedBeforeEnd = false
    globalThis.fetch = (async (_url, init) => {
      if (init?.method === "GET") return new Response(Buffer.from(PNG, "base64"))
      posts++
      if (posts === 2) {
        const files = await readdir(harness.outputRoot, { recursive: true })
        savedBeforeEnd = files.some(file => file.endsWith("FIRST.png"))
        abort.abort(new Error("user cancelled")); throw new Error("user cancelled")
      }
      return Response.json({ id: "first", status: "succeeded", results: [{ url: "https://cdn.example.com/a.png" }] })
    }) as typeof fetch
    try {
      const result = await runTool(harness, "cancel-batch", { route: "stx", concurrency: 1, jobs: ["FIRST", "SECOND", "THIRD"].map(jobID => ({ jobID, prompt: "cup" })) }, abort.signal)
      expect(posts).toBe(2); expect(savedBeforeEnd).toBe(true)
      expect(result.metadata).toMatchObject({ providerRequests: 2, savedImageCount: 1, notSubmittedTaskIDs: ["THIRD"] })
      const journal = (await readdir(result.metadata.diagnosticDirectory)).find(file => file.startsWith("SECOND-") && file.endsWith(".status.json"))!
      const second = JSON.parse(await readFile(path.join(result.metadata.diagnosticDirectory, journal), "utf8"))
      expect(second.phase).toBe("cancelled_after_submission")
    } finally { await cleanupHarness(harness) }
  })

  test("stx gives serial queued jobs independent timeout budgets", async () => {
    const harness = await makeHarness(); const original = globalThis.setTimeout
    globalThis.setTimeout = ((fn: any, delay: number, ...args: any[]) => original(fn, delay === 600000 ? 180 : delay, ...args)) as typeof setTimeout
    globalThis.fetch = (async (_url, init) => {
      if (init?.method === "GET") return new Response(Buffer.from(PNG, "base64"))
      await new Promise<void>((resolve, reject) => {
        const onAbort = () => { clearTimeout(timer); reject(new Error("timed out")) }
        const timer = original(() => { init?.signal?.removeEventListener("abort", onAbort); resolve() }, 100)
        init?.signal?.addEventListener("abort", onAbort, { once: true })
      })
      return Response.json({ status: "succeeded", results: [{ url: "https://cdn.example.com/a.png" }] })
    }) as typeof fetch
    try {
      const result = await runTool(harness, "queue-timeout", { route: "stx", concurrency: 1, prompts: ["cup", "cup", "cup"] })
      expect(result.metadata.generatedMasterCount).toBe(3)
      expect(result.metadata.jobResults.every((p: any) => p.startedAt >= p.queuedAt)).toBe(true)
    } finally { globalThis.setTimeout = original; await cleanupHarness(harness) }
  })

  test("stx does not retry permanent downloads or cancelled requests", async () => {
    const harness = await makeHarness(); let posts = 0; let gets = 0
    globalThis.fetch = (async (_url, init) => {
      if (init?.method === "GET") { gets++; return new Response("denied", { status: 403 }) }
      posts++; return Response.json({ id: "already-generated", status: "succeeded", results: [{ url: "https://cdn.example.com/a.png" }] })
    }) as typeof fetch
    try {
      const result = await runTool(harness, "permanent-download", { route: "stx", prompt: "cup" })
      expect(posts).toBe(1); expect(gets).toBe(1)
      expect(result.metadata.jobResults[0]).toMatchObject({ phase: "download_failed", providerTaskID: "already-generated" })
      const stopped = new AbortController(); stopped.abort()
      const cancelled = await runTool(harness, "pre-cancel", { route: "stx", prompts: ["cup", "cup"] }, stopped.signal)
      expect(cancelled.metadata.providerRequests).toBe(0); expect(posts).toBe(1)
    } finally { await cleanupHarness(harness) }
  })

  test("routes stx and /stx through Grsai and saves the downloaded image", async () => {
    const harness = await makeHarness()
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (url, init) => {
      calls.push({ url: String(url), init })
      if (init?.method === "GET") return new Response(Buffer.from(PNG, "base64"))
      return Response.json({ id: "test-task", status: "succeeded", results: [{ url: "https://cdn.example.com/image.png" }] })
    }) as typeof fetch
    try {
      const parts: any = { parts: [{ type: "text", text: "template" }] }
      await harness.hooks["command.execute.before"]?.({ command: "stx", arguments: "red cup, 1:1" } as any, parts)
      expect(parts.parts[0].text).toBe("stx red cup, 1:1")
      const message = await sendMessage(harness, "ses_stx", parts.parts[0].text)
      expect(message.message.agent).toBe("image-fast")
      const result = await runTool(harness, "ses_stx", { sourceMessageID: message.message.id })
      expect(result.metadata).toMatchObject({ route: "stx", generatedMasterCount: 1, retries: 0 })
      expect(calls).toHaveLength(2)
      expect(calls[0].url).toBe("https://grsai.dakka.com.cn/v1/api/generate")
      expect(JSON.parse(String(calls[0].init?.body))).toEqual({
        model: "gpt-image-2", prompt: "red cup, 1:1", aspectRatio: "1:1", images: [], replyType: "json",
      })
      expect((calls[1].init?.headers as any).Authorization).toBeUndefined()
    } finally {
      await cleanupHarness(harness)
    }
  })

  test("stx diagnostics redact credential echoes and output survives an unwritable directory", async () => {
    const harness = await makeHarness(); const blocked = await makeHarness({ blockedOutputRoot: true })
    try {
      globalThis.fetch = (async () => Response.json({ id: "offline-stx-key", status: "failed", error: "invalid offline-stx-key" }, { status: 401 })) as typeof fetch
      const failure = await runTool(harness, "redacted-status", { route: "stx", prompt: "cup" })
      expect(JSON.stringify(failure)).not.toContain("offline-stx-key")
      const files = await readdir(failure.metadata.diagnosticDirectory)
      for (const file of files) expect(await readFile(path.join(failure.metadata.diagnosticDirectory, file), "utf8")).not.toContain("offline-stx-key")
      globalThis.fetch = (async (_url, init) => init?.method === "GET" ? new Response(Buffer.from(PNG, "base64")) : Response.json({ status: "succeeded", results: [{ url: "https://cdn.example.com/a.png" }] })) as typeof fetch
      const result = await runTool(blocked, "blocked-stx", { route: "stx", prompt: "cup" })
      expect(result.metadata).toMatchObject({ generatedMasterCount: 1, savedImageCount: 0 })
      expect(result.metadata.jobResults[0].phase).toBe("generated_not_saved")
    } finally { await cleanupHarness(harness); await cleanupHarness(blocked) }
  })

  test("stx rejects unsupported tiers and quality before contacting the provider", async () => {
    const harness = await makeHarness()
    let calls = 0
    globalThis.fetch = (async () => { calls++; return imageResponse() }) as typeof fetch
    try {
      for (const settings of [{ resolution: "2K" }, { resolution: "4K" }, { quality: "high" }]) {
        const result = await runTool(harness, "ses_stx_invalid", { route: "stx", prompt: "cup", ...settings })
        expect(result.metadata.providerRequests).toBe(0)
      }
      expect(calls).toBe(0)
    } finally {
      await cleanupHarness(harness)
    }
  })

  test("stx redacts string errors and does not retry HTTP or task failures", async () => {
    const harness = await makeHarness()
    let calls = 0
    try {
      for (const status of [200, 400, 401]) {
        globalThis.fetch = (async () => {
          calls++
          return Response.json({ id: "failed-task", status: "failed", error: "invalid offline-stx-key" }, { status })
        }) as typeof fetch
        const result = await runTool(harness, "ses_stx_failed", { route: "stx", prompt: "cup" })
        expect(result.metadata).toMatchObject({ retries: 0, attachmentCount: 0 })
        expect(result.output).toContain("[REDACTED]")
        expect(result.output).not.toContain("offline-stx-key")
      }
      expect(calls).toBe(3)
    } finally {
      await cleanupHarness(harness)
    }
  })

  test("stx passes references as data URLs and encodes requested output locally", async () => {
    const harness = await makeHarness()
    let payload: any
    globalThis.fetch = (async (_url, init) => {
      if (init?.method === "GET") return new Response(Buffer.from(PNG, "base64"))
      payload = JSON.parse(String(init?.body))
      return Response.json({ status: "succeeded", results: [{ url: "https://cdn.example.com/image.png" }] })
    }) as typeof fetch
    try {
      const output: any = {
        message: { id: "msg_stx_edit", agent: "build" },
        parts: [{ type: "text", text: "stx change the cup to red, webp" },
          { type: "file", mime: "image/png", url: `data:image/png;base64,${PNG}` }],
      }
      await harness.hooks["chat.message"]?.({ sessionID: "ses_stx_edit" }, output)
      const result = await runTool(harness, "ses_stx_edit", { sourceMessageID: "msg_stx_edit" })
      expect(payload.images).toEqual([`data:image/png;base64,${PNG}`])
      expect(result.metadata.generatedMasterCount).toBe(1)
      expect(result.output).toContain(".webp")
    } finally {
      await cleanupHarness(harness)
    }
  })

  test("leaves every Auto mode on the reasoning agent without injecting authorization", async () => {
    const harness = await makeHarness()
    try {
      for (const command of [
        "auto C:\\project\\script.md",
        "auto images C:\\project\\auto-state.json",
        "auto resume C:\\project\\auto-state.json",
        "auto plan C:\\project\\script.md",
        "auto video C:\\project\\auto-state.json",
      ]) {
        const output = await sendMessage(harness, `ses_${randomUUID()}`, command)
        expect(output.message.agent).toBe("build")
        expect(output.message.model).toEqual({ providerID: "aihub", modelID: "gpt-5.6-sol" })
        expect(output.parts).toEqual([{ type: "text", text: command }])
        expect(output.parts.some((part: any) => part.synthetic)).toBe(false)
      }
    } finally {
      await cleanupHarness(harness)
    }
  })

  test("executes repeated direct Auto-style batches without a token or continuation", async () => {
    const harness = await makeHarness()
    const prompts: string[] = []
    globalThis.fetch = (async (_url, init) => {
      prompts.push(
        init?.body instanceof FormData
          ? String(init.body.get("prompt"))
          : String(JSON.parse(String(init?.body)).prompt),
      )
      return imageResponse()
    }) as typeof fetch

    try {
      const first = await runTool(harness, "ses_direct_batches", {
        route: "st2",
        prompts: ["asset one", "asset two", "asset three"],
      })
      const second = await runTool(harness, "ses_direct_batches", {
        route: "st2",
        jobs: [
          { jobID: "STATE_A", prompt: "state edit A" },
          { jobID: "KEYFRAME_B", prompt: "keyframe B" },
        ],
      })

      expect(first.metadata).toMatchObject({ providerRequests: 3, generatedMasterCount: 3, retries: 0 })
      expect(second.metadata).toMatchObject({ providerRequests: 2, generatedMasterCount: 2, retries: 0 })
      expect(prompts).toEqual(["asset one", "asset two", "asset three", "state edit A", "keyframe B"])
      expect(first.output).not.toContain("FAST_IMAGE_DELEGATED_V1")
      expect(second.output).not.toContain("continuation")
    } finally {
      await cleanupHarness(harness)
    }
  })

  test("queues 31 direct jobs with maximum provider concurrency ten", async () => {
    const harness = await makeHarness()
    let active = 0
    let maxActive = 0
    let providerCalls = 0
    const providerPrompts: string[] = []
    globalThis.fetch = (async (_url, init) => {
      providerCalls++
      active++
      maxActive = Math.max(maxActive, active)
      providerPrompts.push(JSON.parse(String(init?.body)).prompt)
      await new Promise((resolve) => setTimeout(resolve, 8))
      active--
      return imageResponse()
    }) as typeof fetch

    try {
      const jobs = Array.from({ length: 31 }, (_, index) => ({
        jobID: `CLIP${String(index + 1).padStart(3, "0")}`,
        prompt: `independent keyframe ${index + 1}`,
      }))
      const result = await runTool(harness, "ses_31", { route: "st2", jobs, concurrency: 31 })

      expect(providerCalls).toBe(31)
      expect(maxActive).toBe(10)
      expect(providerPrompts).toEqual(jobs.map((job) => job.prompt))
      expect(result.metadata).toMatchObject({
        providerRequests: 31,
        concurrencyLimit: 10,
        generatedMasterCount: 31,
        failureCount: 0,
      })
    } finally {
      await cleanupHarness(harness)
    }
  })

  test("shares the global ten-request provider limit across simultaneous tool calls", async () => {
    const firstHarness = await makeHarness()
    const secondHarness = await makeHarness()
    let active = 0
    let maxActive = 0
    let providerCalls = 0
    globalThis.fetch = (async () => {
      providerCalls++
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 12))
      active--
      return imageResponse()
    }) as typeof fetch

    try {
      const batch = (prefix: string) => Array.from({ length: 18 }, (_, index) => `${prefix}-${index + 1}`)
      const [first, second] = await Promise.all([
        runTool(firstHarness, "ses_global_a", { route: "st2", prompts: batch("A"), concurrency: 10 }),
        runTool(secondHarness, "ses_global_b", { route: "st2", prompts: batch("B"), concurrency: 10 }),
      ])

      expect(providerCalls).toBe(36)
      expect(maxActive).toBe(10)
      expect(first.metadata.generatedMasterCount).toBe(18)
      expect(second.metadata.generatedMasterCount).toBe(18)
    } finally {
      await cleanupHarness(firstHarness)
      await cleanupHarness(secondHarness)
    }
  })

  test("binds per-job references inside projectRoot and rejects outside paths", async () => {
    const harness = await makeHarness()
    const projectRoot = path.join(harness.testRoot, "auto-project")
    const referenceA = path.join(projectRoot, "reference-a.png")
    const referenceB = path.join(projectRoot, "reference-b.png")
    const outside = path.join(harness.testRoot, "outside.png")
    await mkdir(projectRoot, { recursive: true })
    await writeFile(referenceA, Buffer.from(PNG, "base64"))
    await writeFile(referenceB, Buffer.from(PNG, "base64"))
    await writeFile(outside, Buffer.from(PNG, "base64"))
    const requests: Array<{ endpoint: string; prompt: string; references: string[] }> = []
    globalThis.fetch = (async (url, init) => {
      if (init?.body instanceof FormData) {
        requests.push({
          endpoint: String(url),
          prompt: String(init.body.get("prompt")),
          references: init.body.getAll("image").map((item) => String((item as File).name)),
        })
      } else {
        requests.push({ endpoint: String(url), prompt: JSON.parse(String(init?.body)).prompt, references: [] })
      }
      return imageResponse()
    }) as typeof fetch

    try {
      const accepted = await runTool(harness, "ses_references", {
        route: "st2",
        projectRoot,
        jobs: [
          { jobID: "TEXT_ONLY", prompt: "text only" },
          { jobID: "STATE_A", prompt: "state A", referencePaths: [referenceA] },
          { jobID: "KEYFRAME_AB", prompt: "keyframe AB", referencePaths: [referenceA, referenceB] },
        ],
      })
      expect(requests.map((request) => request.endpoint.endsWith("/images/edits"))).toEqual([false, true, true])
      expect(requests.map((request) => request.references)).toEqual([
        [],
        ["reference-a.png"],
        ["reference-a.png", "reference-b.png"],
      ])
      expect(accepted.metadata).toMatchObject({ providerRequests: 3, referenceImageCount: 3 })

      const rejected = await runTool(harness, "ses_references", {
        route: "st2",
        projectRoot,
        jobs: [{ jobID: "OUTSIDE", prompt: "must not run", referencePaths: [outside] }],
      })
      expect(rejected.metadata.providerRequests).toBe(0)
      expect(rejected.output).toContain("outside its project and generated-output roots")
      expect(requests).toHaveLength(3)
    } finally {
      await cleanupHarness(harness)
    }
  })

  test("reports failed task IDs without retry and accepts an explicit repair batch", async () => {
    const harness = await makeHarness()
    let providerCalls = 0
    globalThis.fetch = (async (_url, init) => {
      providerCalls++
      const prompt = init?.body instanceof FormData
        ? String(init.body.get("prompt"))
        : String(JSON.parse(String(init?.body)).prompt)
      return prompt === "reject this one" ? imageResponse(400) : imageResponse()
    }) as typeof fetch

    try {
      const first = await runTool(harness, "ses_repair", {
        route: "st2",
        jobs: [
          { jobID: "SHOT010-A", prompt: "valid first image" },
          { jobID: "SHOT010-B", prompt: "reject this one" },
          { jobID: "SHOT010-C", prompt: "valid third image" },
        ],
      })
      expect(first.metadata).toMatchObject({
        providerRequests: 3,
        generatedMasterCount: 2,
        failureCount: 1,
        failedTaskIDs: ["SHOT010-B"],
        retries: 0,
      })
      expect(first.output).not.toContain("FAST_IMAGE_DELEGATED_V1")

      const repair = await runTool(harness, "ses_repair", {
        route: "st2",
        concurrency: 3,
        jobs: [1, 2, 3].map((index) => ({
          jobID: `SHOT010-B-R${index}`,
          prompt: `corrected candidate ${index}`,
        })),
      })
      expect(repair.metadata).toMatchObject({ providerRequests: 3, concurrencyLimit: 3, generatedMasterCount: 3 })
      expect(providerCalls).toBe(6)
    } finally {
      await cleanupHarness(harness)
    }
  })

  test("validates and assembles direct storyboard jobs and boards", async () => {
    const harness = await makeHarness()
    let providerCalls = 0
    globalThis.fetch = (async () => {
      providerCalls++
      return imageResponse()
    }) as typeof fetch

    try {
      const jobs = Array.from({ length: 12 }, (_, index) => {
        const shotID = String(index + 1).padStart(3, "0")
        return { shotID, prompt: `Shot ${shotID}, one independent cinematic 16:9 frame, no text or grid.` }
      })
      const boards = [
        { boardID: "S01", shotIDs: jobs.slice(0, 6).map((job) => job.shotID), columns: 3 },
        { boardID: "S02", shotIDs: jobs.slice(6).map((job) => job.shotID), columns: 3 },
      ]
      const result = await runTool(harness, "ses_storyboard", {
        route: "st2",
        jobs,
        boards,
        concurrency: 10,
      })

      expect(providerCalls).toBe(12)
      expect(result.metadata).toMatchObject({
        providerRequests: 12,
        generatedMasterCount: 12,
        assembledBoardCount: 2,
        attachmentCount: 14,
      })
      const directory = /本地原图目录：(.+)/.exec(result.output)?.[1]?.trim()
      expect(directory).toBeTruthy()
      const files = await readdir(directory!)
      expect(files.filter((filename) => /^shot-[0-9]{3}\.png$/.test(filename))).toHaveLength(12)
      expect(files.filter((filename) => /^board-S0[12]\.png$/.test(filename))).toHaveLength(2)
      expect(await sharp(path.join(directory!, "shot-001.png")).metadata()).toMatchObject({ width: 1024, height: 576 })
      expect(await sharp(path.join(directory!, "board-S01.png")).metadata()).toMatchObject({ width: 1920, height: 792 })
    } finally {
      await cleanupHarness(harness)
    }
  })

  test("rejects invalid direct input before contacting the provider", async () => {
    const harness = await makeHarness()
    let providerCalls = 0
    globalThis.fetch = (async () => {
      providerCalls++
      return imageResponse()
    }) as typeof fetch

    try {
      const tooMany = await runTool(harness, "ses_invalid", {
        route: "st2",
        prompts: Array.from({ length: 101 }, (_, index) => `image ${index + 1}`),
      })
      const conflicting = await runTool(harness, "ses_invalid", {
        route: "st2",
        prompt: "one",
        prompts: ["two"],
      })
      const badRoute = await runTool(harness, "ses_invalid", { route: "unknown", prompt: "one" })

      for (const result of [tooMany, conflicting, badRoute]) {
        expect(result.metadata.providerRequests).toBe(0)
        expect(result.output).toContain("未发送图片 API 请求")
      }
      expect(tooMany.output).toContain("between 1 and 100")
      expect(conflicting.output).toContain("exactly one of prompt, prompts, or jobs")
      expect(badRoute.output).toContain("Route must be st1, st2, st3, st4, or stx")
      expect(providerCalls).toBe(0)
    } finally {
      await cleanupHarness(harness)
    }
  })

  test("routes a prefix st command through one in-memory sourceMessageID handoff", async () => {
    const harness = await makeHarness()
    let providerCalls = 0
    globalThis.fetch = (async () => {
      providerCalls++
      return imageResponse()
    }) as typeof fetch

    try {
      const output = await sendMessage(harness, "ses_prefix", "st2 并发2，雨夜霓虹街道")
      expect(output.message.agent).toBe("image-fast")
      expect(output.message.model).toEqual({ providerID: "direct-image", modelID: "executor" })
      expect(output.parts).toHaveLength(1)
      expect(output.parts[0].text).toBe(`${DIRECT_MARKER}:${output.message.id}`)

      const result = await runTool(harness, "ses_prefix", { sourceMessageID: output.message.id })
      expect(result.metadata).toMatchObject({ providerRequests: 2, generatedMasterCount: 2 })
      expect(providerCalls).toBe(2)

      const replay = await runTool(harness, "ses_prefix", { sourceMessageID: output.message.id })
      expect(replay.metadata.providerRequests).toBe(0)
      expect(replay.output).toContain("不存在或已执行")
      expect(providerCalls).toBe(2)
    } finally {
      await cleanupHarness(harness)
    }
  })

  test("delegates a suffix directive without issuing a token", async () => {
    const harness = await makeHarness()
    let providerCalls = 0
    globalThis.fetch = (async () => {
      providerCalls++
      return imageResponse()
    }) as typeof fetch

    try {
      const text = "根据完整剧本生成四张分镜板，用 st2 并发4"
      const output = await sendMessage(harness, "ses_suffix", text)
      expect(output.message.agent).toBe("build")
      expect(output.parts[0]).toEqual({ type: "text", text })
      const instruction = output.parts.find((part: any) => part.synthetic)
      expect(instruction.text.startsWith(DIRECT_MARKER)).toBe(true)
      expect(instruction.text).toContain("Prepare exactly 4")
      expect(instruction.text).toContain("Call direct_image_run")
      expect(instruction.text).not.toContain("FAST_IMAGE_DELEGATED_V1")

      const result = await runTool(harness, "ses_suffix", {
        route: "st2",
        prompts: ["S01", "S02", "S03", "S04"],
        concurrency: 4,
      })
      expect(result.metadata.providerRequests).toBe(4)
      expect(providerCalls).toBe(4)
    } finally {
      await cleanupHarness(harness)
    }
  })

  test("creates readable local previews and strips them from later context", async () => {
    const harness = await makeHarness()
    globalThis.fetch = (async () => imageResponse()) as typeof fetch

    try {
      const result = await runTool(harness, "ses_preview", { route: "st2", prompts: ["A", "B"] })
      expect(result.metadata).toMatchObject({ deliveredImageCount: 2, previewImageCount: 2 })
      expect(result.output).toContain(PREVIEW_MARKER)
      expect(result.output.match(/!\[生成图片 \d+\]/g)).toHaveLength(2)
      const previewURLs = [...result.output.matchAll(/http:\/\/127\.0\.0\.1:\d+\/image\/[A-Za-z0-9_%-/]+/g)].map(
        (match) => match[0],
      )
      expect(new Set(previewURLs).size).toBe(2)
      const preview = await ORIGINAL_FETCH(previewURLs[0]!)
      expect(preview.status).toBe(200)
      expect(preview.headers.get("content-type")).toBe("image/png")

      const messages: any = {
        messages: [
          { info: { id: "msg_result", role: "assistant" }, parts: [{ type: "text", text: result.output }] },
          { info: { id: "msg_followup", role: "user" }, parts: [{ type: "text", text: "continue" }] },
        ],
      }
      await harness.hooks["experimental.chat.messages.transform"]?.({}, messages)
      expect(messages.messages[0].parts[0].text).not.toContain(PREVIEW_MARKER)
      expect(messages.messages[0].parts[0].text).not.toContain("http://127.0.0.1")
    } finally {
      await cleanupHarness(harness)
    }
  })

  test("bounds inline output when disk and local preview delivery are unavailable", async () => {
    const harness = await makeHarness({ blockedOutputRoot: true })
    const oversizedPNG = Buffer.concat([
      Buffer.from(PNG, "base64"),
      Buffer.alloc(64 * 1024, 0x61),
    ]).toString("base64")
    globalThis.fetch = (async () => imageResponse(200, oversizedPNG)) as typeof fetch

    try {
      const result = await runTool(harness, "ses_bounded", { route: "st2", prompt: "oversized image" })
      expect(result.output).not.toContain("data:image/")
      expect(result.output).toContain("48 KiB safety limit")
      expect(result.attachments).toHaveLength(1)
      expect(result.metadata).toMatchObject({
        providerRequests: 1,
        deliveredImageCount: 0,
        deliveryFailureCount: 1,
        previewImageCount: 0,
      })
    } finally {
      await cleanupHarness(harness)
    }
  })
})

describe("direct image provider", () => {
  test("emits one sourceMessageID tool call and never replays it on a follow-up", async () => {
    const model = createDirectImageProvider().languageModel("executor")
    const sourceMessageID = "msg_direct_source"
    const marker = `${DIRECT_MARKER}:${sourceMessageID}`
    const toolResult = `${PREVIEW_MARKER}\n![生成图片 1](http://127.0.0.1:41737/image/path/example.png)`
    const initial: any = await model.doGenerate({
      prompt: [{ role: "user", content: [{ type: "text", text: marker }] }],
      tools: [{ type: "function", name: "direct_image_run" }],
    })
    expect(initial.content).toHaveLength(1)
    expect(initial.content[0]).toMatchObject({
      type: "tool-call",
      toolName: "direct_image_run",
      input: JSON.stringify({ sourceMessageID }),
    })
    const id = initial.content[0].toolCallId

    const completedPrompt: any[] = [
      { role: "user", content: [{ type: "text", text: marker }] },
      {
        role: "assistant",
        content: [{ type: "tool-call", toolCallId: id, toolName: "direct_image_run", input: JSON.stringify({ sourceMessageID }) }],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: id,
            toolName: "direct_image_run",
            output: { type: "text", value: toolResult },
          },
        ],
      },
    ]
    const completed: any = await model.doGenerate({
      prompt: completedPrompt,
      tools: [{ type: "function", name: "direct_image_run" }],
    })
    expect(completed.content).toEqual([{ type: "text", text: toolResult }])

    const followup: any = await model.doGenerate({
      prompt: [...completedPrompt, { role: "user", content: [{ type: "text", text: "continue" }] }],
      tools: [{ type: "function", name: "direct_image_run" }],
    })
    expect(followup.content[0].type).toBe("text")
    expect(followup.content[0].text).toContain("No current fast image command")
    expect(followup.content.some((part: any) => part.type === "tool-call")).toBe(false)
  })
})
