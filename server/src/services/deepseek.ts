import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
});

const DEFAULT_STYLE_PROMPT = `你是一位专业、礼貌、富有鼓励性的课后反馈撰写助手。你必须严格基于提供的事实信息来撰写反馈，绝不编造任何未被提及的信息。反馈语气温暖积极，同时客观反映学生的学习情况。`;

export async function generateFeedback(
  stylePrompt: string | null,
  facts: string
): Promise<string> {
  const systemPrompt = stylePrompt || DEFAULT_STYLE_PROMPT;
  const userPrompt = `请根据以下事实信息生成一份课后反馈。严格基于事实，不编造任何未被点选或提及的信息。\n\n事实信息：\n${facts}`;

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    temperature: 0.7,
    max_tokens: 800,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  return response.choices[0]?.message?.content || '';
}

export async function analyzeStyle(samples: string[]): Promise<string> {
  const prompt = `请分析以下课后反馈样本，提取该老师的写作风格与格式特征，生成一段AI系统指令。该指令应包含：称呼习惯、语气特点、大概字数、表扬与建议的固定句式、段落结构、结尾方式、特殊格式（如是否用emoji、分隔符）等。AI后续将严格按此指令生成反馈。直接输出指令文本，不要任何额外解释。\n\n样本：\n${samples.map((s, i) => `【样本${i + 1}】\n${s}`).join('\n\n')}`;

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    temperature: 0.7,
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.choices[0]?.message?.content || '';
}

export async function previewStyle(stylePrompt: string, description: string): Promise<string> {
  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    temperature: 0.7,
    max_tokens: 500,
    messages: [
      { role: 'system', content: stylePrompt },
      { role: 'user', content: `请根据以下描述生成一段课后反馈预览：${description}` },
    ],
  });

  return response.choices[0]?.message?.content || '';
}

// Placeholder for future audio analysis integration
export async function analyzeAudio(_audioData: Buffer): Promise<string> {
  // TODO: Future integration point for audio analysis
  throw new Error('Audio analysis not yet implemented');
}
