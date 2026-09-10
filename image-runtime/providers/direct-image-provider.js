import { createHash } from "node:crypto"

const TOKENLESS_REQUEST_MARKER = "FAST_IMAGE_DIRECT_V2:"
const TOOL_NAME = "direct_image_run"
const SYNTHETIC_ATTACHMENT_PROMPT = "Attached media from tool result:"
const emptyUsage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 0, text: 0, reasoning: 0 },
}

function textParts(message) {
  if (message.role === "system") return typeof message.content === "string" ? [message.content] : []
  if (!Array.isArray(message.content)) return []
  return message.content.filter((part) => part.type === "text" && typeof part.text === "string").map((part) => part.text)
}

function requestFromPrompt(prompt) {
  for (let messageIndex = prompt.length - 1; messageIndex >= 0; messageIndex--) {
    const message = prompt[messageIndex]
    if (message.role !== "user") continue
    const texts = textParts(message)
    if (texts.length === 1 && texts[0].trim() === SYNTHETIC_ATTACHMENT_PROMPT) continue
    for (const text of [...texts].reverse()) {
      const directIndex = text.lastIndexOf(TOKENLESS_REQUEST_MARKER)
      if (directIndex !== -1) {
        const sourceMessageID = text.slice(directIndex + TOKENLESS_REQUEST_MARKER.length).split(/\s/, 1)[0].trim()
        return sourceMessageID ? { sourceMessageID, messageIndex } : undefined
      }
      continue
    }
    return undefined
  }
  return undefined
}

function toolResultText(output) {
  if (!output || typeof output !== "object") return ""
  if (output.type === "text" || output.type === "error-text") return String(output.value ?? "")
  if (output.type === "json" || output.type === "error-json") return JSON.stringify(output.value ?? {})
  if (output.type !== "content" || !Array.isArray(output.value)) return ""
  return output.value.filter((part) => part.type === "text").map((part) => part.text).join("\n")
}

function resultAfterRequest(prompt, messageIndex, toolCallId) {
  for (let index = messageIndex + 1; index < prompt.length; index++) {
    const content = prompt[index]?.content
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (part.type === "tool-result" && part.toolName === TOOL_NAME && part.toolCallId === toolCallId) {
        return toolResultText(part.output)
      }
    }
  }
  return undefined
}

function latestUserText(prompt) {
  const user = [...prompt].reverse().find((message) => message.role === "user")
  return user ? textParts(user).join(" ").replace(/\s+/g, " ").trim() : ""
}

function responseFor(options) {
  const prompt = Array.isArray(options?.prompt) ? options.prompt : []
  const latest = latestUserText(prompt)
  if (/generate a title for this conversation/i.test(latest)) return { kind: "text", text: "Image generation" }
  const request = requestFromPrompt(prompt)
  if (!request) return { kind: "text", text: "No current fast image command was found. No image API request was sent." }
  const toolCallId = `fast_image_${createHash("sha256").update(request.sourceMessageID).digest("hex").slice(0, 24)}`
  const result = resultAfterRequest(prompt, request.messageIndex, toolCallId)
  if (result !== undefined) return { kind: "text", text: result.trim() || "Image tool returned no readable result." }
  const available = options?.tools?.some((item) => item.type === "function" && item.name === TOOL_NAME)
  if (!available) return { kind: "text", text: "Fast image execution is unavailable. No image API request was sent." }
  return {
    kind: "tool",
    id: toolCallId,
    toolName: TOOL_NAME,
    input: JSON.stringify({ sourceMessageID: request.sourceMessageID }),
  }
}

function safeResponseFor(options) {
  try {
    return responseFor(options)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { kind: "text", text: `Fast image adapter failed without retry.\n\n${message}` }
  }
}

function generated(response) {
  if (response.kind === "tool") {
    return {
      content: [{ type: "tool-call", toolCallId: response.id, toolName: response.toolName, input: response.input }],
      finishReason: { unified: "tool-calls", raw: "tool-calls" },
      usage: emptyUsage,
      warnings: [],
    }
  }
  return {
    content: [{ type: "text", text: response.text }],
    finishReason: { unified: "stop", raw: "stop" },
    usage: emptyUsage,
    warnings: [],
  }
}

function streamed(response) {
  const events = [{ type: "stream-start", warnings: [] }]
  if (response.kind === "tool") {
    events.push(
      { type: "tool-call", toolCallId: response.id, toolName: response.toolName, input: response.input },
      { type: "finish", finishReason: { unified: "tool-calls", raw: "tool-calls" }, usage: emptyUsage },
    )
  } else {
    const id = `text_${createHash("sha256").update(response.text).digest("hex").slice(0, 16)}`
    events.push(
      { type: "text-start", id },
      { type: "text-delta", id, delta: response.text },
      { type: "text-end", id },
      { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage: emptyUsage },
    )
  }
  return new ReadableStream({
    start(controller) {
      for (const event of events) controller.enqueue(event)
      controller.close()
    },
  })
}

function languageModel(modelId) {
  return {
    specificationVersion: "v3",
    provider: "direct-image",
    modelId,
    supportedUrls: {},
    async doGenerate(options) {
      return generated(safeResponseFor(options))
    },
    async doStream(options) {
      return { stream: streamed(safeResponseFor(options)) }
    },
  }
}

export function createDirectImageProvider() {
  return { languageModel, chat: languageModel }
}
