import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage } from '@langchain/core/messages'
import { convertToOpenAITool } from '@langchain/core/utils/function_calling'
import type { ModelDefinition } from '../types'

export interface ModelCapabilityProfile {
  imageInputs: boolean
  textOutputs: boolean
  supportsStructuredOutput: boolean
  supportsObjectToolChoice: boolean
  testedAt: number
  ok: boolean
  error?: string
}

const TINY_IMAGE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
const PROBE_TIMEOUT_MODELS_MS = 8000
const PROBE_TIMEOUT_TEXT_MS = 8000
const PROBE_TIMEOUT_IMAGE_MS = 12000
const PROBE_TIMEOUT_STRUCTURED_MS = 20000
const PROBE_TIMEOUT_TOOL_CHOICE_MS = 20000
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1'

interface ProbeStepResult {
  ok: boolean
  error?: string
}

export class ModelCapabilityService {
  async probe(model: ModelDefinition): Promise<ModelCapabilityProfile> {
    const testedAt = Date.now()
    if (!model.model || !model.apiKey) {
      return {
        imageInputs: false,
        textOutputs: false,
        supportsStructuredOutput: false,
        supportsObjectToolChoice: false,
        testedAt,
        ok: false,
        error: 'Missing model or apiKey'
      }
    }

    const structuredMode = this.resolveStructuredOutputMode(model)
    const [textCheck, imageCheck, structuredOutputCheck, objectToolChoiceCheck] = await Promise.all([
      this.checkTextOutputs(model),
      this.checkImageInputs(model),
      structuredMode === 'auto'
        ? this.checkStructuredOutput(model)
        : Promise.resolve<ProbeStepResult>({ ok: structuredMode === 'on' }),
      this.checkObjectToolChoice(model)
    ])
    const activeCheck = textCheck.ok
      ? { ok: true as const }
      : await this.checkActiveByModelsEndpoint(model)

    const errors: string[] = []
    if (!imageCheck.ok && imageCheck.error) errors.push(`image: ${imageCheck.error}`)
    if (!structuredOutputCheck.ok && structuredOutputCheck.error) {
      errors.push(`structured_output: ${structuredOutputCheck.error}`)
    }
    if (!objectToolChoiceCheck.ok && objectToolChoiceCheck.error) {
      errors.push(`tool_choice_object: ${objectToolChoiceCheck.error}`)
    }
    if (textCheck.error) errors.push(`text: ${textCheck.error}`)
    if (!activeCheck.ok && activeCheck.error) errors.push(`active: ${activeCheck.error}`)

    return {
      imageInputs: imageCheck.ok,
      textOutputs: textCheck.ok,
      supportsStructuredOutput: structuredOutputCheck.ok,
      supportsObjectToolChoice: objectToolChoiceCheck.ok,
      testedAt,
      ok: textCheck.ok || activeCheck.ok,
      error: errors.length > 0 ? errors.join(' | ') : undefined
    }
  }

  private createProbeClient(model: ModelDefinition, opts?: { maxTokens?: number }): ChatOpenAI {
    return new ChatOpenAI({
      model: model.model,
      apiKey: model.apiKey,
      configuration: {
        baseURL: model.baseUrl
      },
      temperature: 0,
      ...(typeof opts?.maxTokens === 'number' ? { maxTokens: opts.maxTokens } : {})
    })
  }

  private buildModelsEndpoint(baseUrl?: string): string {
    const normalized = String(baseUrl || '').trim().replace(/\/+$/, '')
    if (!normalized) return `${DEFAULT_OPENAI_BASE_URL}/models`
    if (/\/v1$/i.test(normalized)) return `${normalized}/models`
    return `${normalized}/v1/models`
  }

  private async checkActiveByModelsEndpoint(model: ModelDefinition): Promise<ProbeStepResult> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MODELS_MS)
    const endpoint = this.buildModelsEndpoint(model.baseUrl)

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${model.apiKey || ''}`,
          Accept: 'application/json'
        },
        signal: controller.signal
      })

      if (!response.ok) {
        return {
          ok: false,
          error: `HTTP ${response.status} ${response.statusText}`.trim()
        }
      }

      const payload = await response.json().catch(() => undefined)
      const data = payload && typeof payload === 'object' ? (payload as any).data : undefined
      if (Array.isArray(data) && data.length > 0) {
        const listed = data.some((item: any) => item && typeof item.id === 'string' && item.id === model.model)
        if (!listed) {
          return { ok: false, error: `Model "${model.model}" not found in /v1/models` }
        }
      }

      return { ok: true }
    } catch (err) {
      if (this.isAbortError(err)) {
        return { ok: false, error: `Timeout after ${PROBE_TIMEOUT_MODELS_MS}ms` }
      }
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      }
    } finally {
      clearTimeout(timer)
    }
  }

  private async checkTextOutputs(model: ModelDefinition): Promise<ProbeStepResult> {
    const client = this.createProbeClient(model, { maxTokens: 8 })
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_TEXT_MS)

    try {
      await client.invoke(
        [
          new HumanMessage(
            'Do not think. Reply immediately with exactly: OK'
          )
        ],
        { signal: controller.signal }
      )
      return { ok: true }
    } catch (err) {
      if (this.isAbortError(err)) {
        return { ok: false, error: `Timeout after ${PROBE_TIMEOUT_TEXT_MS}ms` }
      }
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    } finally {
      clearTimeout(timer)
    }
  }

  private async checkImageInputs(model: ModelDefinition): Promise<ProbeStepResult> {
    const client = this.createProbeClient(model, { maxTokens: 8 })
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_IMAGE_MS)

    try {
      await client.invoke(
        [
          new HumanMessage({
            content: [
              {
                type: 'text',
                text: 'Do not think. Ignore the image content and reply immediately with exactly: OK'
              },
              {
                type: 'image_url',
                image_url: { url: `data:image/png;base64,${TINY_IMAGE_BASE64}` }
              }
            ]
          })
        ],
        { signal: controller.signal }
      )
      return { ok: true }
    } catch (err) {
      if (this.isAbortError(err)) {
        return { ok: false, error: `Timeout after ${PROBE_TIMEOUT_IMAGE_MS}ms` }
      }
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    } finally {
      clearTimeout(timer)
    }
  }

  private async checkStructuredOutput(model: ModelDefinition): Promise<ProbeStepResult> {
    const client = this.createProbeClient(model, { maxTokens: 64 })
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_STRUCTURED_MS)

    try {
      const structured = client.withStructuredOutput(
        {
          type: 'object',
          properties: {
            ok: {
              type: 'boolean',
              description: 'Whether the probe request succeeded.'
            }
          },
          required: ['ok'],
          additionalProperties: false
        } as any,
        { method: 'jsonSchema' }
      )
      const output = await structured.invoke(
        [
          new HumanMessage(
            'Do not think. Return only the structured output with one boolean field: ok. Set ok to true.'
          )
        ],
        { signal: controller.signal }
      ) as any
      if (!output || typeof output.ok !== 'boolean') {
        return { ok: false, error: 'Structured output was not parsed into the expected boolean schema.' }
      }
      return { ok: true }
    } catch (err) {
      if (this.isAbortError(err)) {
        return { ok: false, error: `Timeout after ${PROBE_TIMEOUT_STRUCTURED_MS}ms` }
      }
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    } finally {
      clearTimeout(timer)
    }
  }

  private async checkObjectToolChoice(model: ModelDefinition): Promise<ProbeStepResult> {
    const client = this.createProbeClient(model, { maxTokens: 64 })
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_TOOL_CHOICE_MS)

    try {
      const toolName = 'capability_probe_tool'
      const tool = convertToOpenAITool({
        name: toolName,
        description: 'A tiny capability probe tool.',
        schema: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' }
          },
          required: ['ok'],
          additionalProperties: false
        }
      } as any)
      const modelWithTool = client.bindTools([tool], {
        tool_choice: {
          type: 'function',
          function: { name: toolName }
        } as any
      })
      await modelWithTool.invoke(
        [
          new HumanMessage(
            'Do not think. Call the provided function immediately with {"ok": true}.'
          )
        ],
        { signal: controller.signal }
      )
      return { ok: true }
    } catch (err) {
      if (this.isAbortError(err)) {
        return { ok: false, error: `Timeout after ${PROBE_TIMEOUT_TOOL_CHOICE_MS}ms` }
      }
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    } finally {
      clearTimeout(timer)
    }
  }

  private isAbortError(err: unknown): boolean {
    if (!err) return false
    if (err instanceof Error) {
      return err.name === 'AbortError' || err.message === 'AbortError'
    }
    return false
  }

  private resolveStructuredOutputMode(model: ModelDefinition): 'auto' | 'on' | 'off' {
    if (model.structuredOutputMode === 'on' || model.structuredOutputMode === 'off') {
      return model.structuredOutputMode
    }
    return 'auto'
  }
}
