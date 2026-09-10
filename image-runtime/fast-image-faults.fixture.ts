import { expect, mock } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import sharp from "sharp"

// Run in a separate Bun process: module-level fault injection must not leak into
// the normal provider regression suite.
const realSharp = sharp
const realFS = { ...fs }
const realTimer = globalThis.setTimeout
let mode = ""
let stop = new AbortController()
let injected = 0
const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: "red" } }).png().toBuffer()
mock.module("sharp", () => ({ default: (...args: any[]) => {
  const image = realSharp(...args as [any])
  const stats = image.stats.bind(image)
  const toBuffer = image.toBuffer.bind(image)
  image.stats = (async () => {
    if (mode === "validation-timeout") { injected++; await new Promise(resolve => realTimer(resolve, 60)) }
    return stats()
  }) as any
  image.toBuffer = (async (...options: any[]) => {
    if (mode === "conversion-cancel") { injected++; stop.abort(new Error("cancelled during conversion")) }
    if (mode === "conversion-timeout") { injected++; await new Promise(resolve => realTimer(resolve, 60)) }
    return toBuffer(...options)
  }) as any
  return image
} }))
mock.module("node:fs/promises", () => ({ ...realFS,
  writeFile: async (file: any, data: any, options: any) => {
    if (mode === "slow-checkpoint" && String(file).endsWith(".tmp") && typeof data === "string" && data.includes('"phase": "downloading"')) {
      injected++; await new Promise(resolve => realTimer(resolve, 160))
    }
    return realFS.writeFile(file, data, options)
  },
  link: async (source: string, target: string) => {
    if (mode === "save-cancel") { injected++; stop.abort(new Error("cancelled during save")) }
    if (mode.startsWith("fallback")) {
      injected++
      if (mode === "fallback-collision") await realFS.writeFile(target, "existing", { flag: "wx" })
      throw Object.assign(new Error("hard links unsupported"), { code: "ENOTSUP" })
    }
    return realFS.link(source, target)
  },
  copyFile: async (source: string, target: string, flags: number) => {
    if (mode === "fallback-full") throw Object.assign(new Error("ENOSPC: disk full"), { code: "ENOSPC" })
    return realFS.copyFile(source, target, flags)
  },
}))
const { default: plugin } = await import("./plugins/fast-image")

async function main() {
  const root = await realFS.mkdtemp(path.join(os.tmpdir(), "stx-fault-tests-"))
  const hooks = await plugin({ client: {} } as any, { outputRoot: root, previewPort: 0 })
  const fetch = globalThis.fetch
  const key = process.env.IMAGE_API_STX_KEY
  process.env.IMAGE_API_STX_KEY = "offline-fault-test"
  try {
    for (mode of ["conversion-cancel", "validation-timeout", "conversion-timeout", "fallback-ok", "fallback-collision", "fallback-full", "slow-checkpoint", "save-cancel", "generation-timeout"]) {
      console.log(`Checking ${mode}`)
      stop = new AbortController(); injected = 0
      let posts = 0
      globalThis.setTimeout = ((fn: any, ms: number, ...args: any[]) => realTimer(fn, ms === 600000 && ["slow-checkpoint", "generation-timeout"].includes(mode) ? 100 : ms === 120000 && mode.endsWith("timeout") ? 20 : ms, ...args)) as typeof setTimeout
      globalThis.fetch = (async (_url, init) => {
        if (init?.method === "GET") return new Response(png)
        posts++
        if (mode === "generation-timeout") {
          injected++
          await new Promise(resolve => realTimer(resolve, 200))
          init?.signal?.throwIfAborted()
        }
        return Response.json({ id: "offline", status: "succeeded", results: [{ url: "https://cdn.example.com/a.png" }] })
      }) as typeof fetch
      const result: any = await hooks.tool!.direct_image_run.execute({ route: "stx", jobs: [{ jobID: "FAULT", prompt: "cup" }], outputFormat: mode.startsWith("conversion") ? "webp" : "png" } as any, { sessionID: mode, messageID: mode, agent: "build", directory: root, worktree: root, abort: stop.signal, metadata() {}, async ask() {} })
      expect(injected).toBeGreaterThan(0)
      expect(posts).toBe(1)
      const item = result.metadata.jobResults[0]
      const saved = ["fallback-ok", "slow-checkpoint", "save-cancel"].includes(mode)
      const expected = mode === "conversion-cancel" ? "cancelled_after_submission" : mode === "generation-timeout" ? "generation_timeout" : mode.endsWith("timeout") ? "download_timeout" : saved ? "saved" : "generated_not_saved"
      expect(item.phase).toBe(expected)
      expect(result.metadata.savedImageCount).toBe(saved ? 1 : 0)
      if (saved) expect(await realFS.readFile(item.savedPath)).toEqual(png)
      if (mode === "save-cancel") expect(item.cancelled).toBe(true)
      if (mode === "fallback-collision") {
        expect(await realFS.readFile(path.join(result.metadata.diagnosticDirectory, "FAULT.png"), "utf8")).toBe("existing")
        expect(item.error).toContain("EEXIST")
      }
      if (mode === "fallback-full") expect(item.error).toContain("ENOSPC")
      expect((await realFS.readdir(result.metadata.diagnosticDirectory)).some(file => file.endsWith(".tmp"))).toBe(false)
    }
  } finally {
    globalThis.fetch = fetch; globalThis.setTimeout = realTimer
    if (key === undefined) delete process.env.IMAGE_API_STX_KEY; else process.env.IMAGE_API_STX_KEY = key
    await hooks.dispose?.(); await realFS.rm(root, { recursive: true, force: true })
  }
}
await main()
console.log("STX local fault scenarios passed")
