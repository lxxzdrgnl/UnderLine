import OpenAI from 'openai'
import type { LyricLineData } from '@/types'

let openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return openai
}

export function parseNdjsonLine(line: string): LyricLineData | null {
  if (!line.trim()) return null
  try {
    const obj = JSON.parse(line)
    if (typeof obj.line !== 'number' || typeof obj.original !== 'string') return null
    return {
      line_number: obj.line,
      original: obj.original,
      translation: obj.translation ?? null,
      slang: obj.slang ?? null,
      explanation: obj.explanation ?? null,
    }
  } catch {
    return null
  }
}

const SYSTEM_PROMPT = `
당신은 음악 가사 전문 해설가입니다. 가사를 한 줄씩 분석하고 아래 JSON 형식으로 출력합니다.
각 줄을 처리할 때마다 즉시 JSON 한 줄을 출력하세요 (NDJSON 형식).

출력 형식 (한 줄에 하나의 JSON):
{"line":<번호>,"original":"<원문>","translation":"<번역 또는 null>","slang":"<슬랭 1문장 또는 null>","explanation":"<설명 또는 null>"}

규칙:
- 원문이 한국어이면 translation은 반드시 null
- 슬랭/은어가 없으면 slang은 null (정확히 1문장)
- explanation: Genius 주석이 있으면 자연스러운 한국어로 번역 (출처 표기 금지, 내용만)
              추가할 내용 있을 때만 뒤에 덧붙임
              Genius 주석 없고 설명할 내용 없으면 null (억지로 채우지 말 것)
              최대 2-3문장
- [Verse], [Chorus] 등 섹션 태그는 original에 그대로, 나머지 필드는 null
`.trim()

export async function* streamLyricInterpretations(
  rawLyrics: string,
  referentsContext: string
): AsyncGenerator<LyricLineData> {
  const userMessage = [
    '가사:',
    rawLyrics,
    referentsContext ? `\nGenius 커뮤니티 주석 (참고용):\n${referentsContext}` : '',
  ].join('\n').trim()

  const stream = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    stream: true,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
  })

  let buffer = ''

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? ''
    buffer += delta

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const parsed = parseNdjsonLine(line)
      if (parsed) yield parsed
    }
  }

  if (buffer.trim()) {
    const parsed = parseNdjsonLine(buffer)
    if (parsed) yield parsed
  }
}
