import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
});

// 模型优先级：主模型 → 备用模型，依次降级
const MODEL_FALLBACKS = ['deepseek-chat', 'deepseek-v4-pro', 'deepseek-v4-flash'];

const DEFAULT_STYLE_PROMPT = `你是一位专业、礼貌、富有鼓励性的课后反馈撰写助手。你必须严格基于提供的事实信息来撰写反馈，绝不编造任何未被提及的信息。反馈语气温暖积极，同时客观反映学生的学习情况。直接输出反馈正文，不要添加任何前缀、标题或解释。`;

interface StudentInfo {
  name: string;
  grade?: string | null;
  notes?: string | null;
}

interface FeedbackInput {
  student: StudentInfo;
  knowledge_text?: string;
  extra_comment?: string;
  homework?: string;
  previous_feedback_text?: string;
  teacher_name?: string;
}

export function buildFeedbackFacts(input: FeedbackInput): string {
  const { student, knowledge_text, extra_comment, homework, previous_feedback_text, teacher_name } = input;
  const parts: string[] = [];

  // Current date
  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  parts.push(`当前日期：${dateStr}`);

  // Teacher name
  if (teacher_name) {
    parts.push(`授课老师：${teacher_name}`);
  }

  // Student info
  const header = [`学生：${student.name}`];
  if (student.grade) header.push(`年级：${student.grade}`);
  if (student.notes) header.push(`备注（AI注意）：${student.notes}`);
  parts.push(header.join(' | '));

  // Previous feedback
  if (previous_feedback_text) {
    parts.push(`\n【上节课反馈内容】\n${previous_feedback_text}`);
  }

  // Knowledge text (free form)
  if (knowledge_text) {
    parts.push(`\n本节课学习内容：${knowledge_text}`);
  }

  // Homework
  if (homework) {
    parts.push(`\n课后作业：${homework}`);
  }

  // Extra comment
  if (extra_comment) {
    parts.push(`\n老师补充：${extra_comment}`);
  }

  return parts.join('\n');
}

/** 用备用模型依次尝试，全部失败则抛出最后一个错误 */
async function tryWithFallback(
  createParams: (model: string) => OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
): Promise<string> {
  let lastError: Error | null = null;
  for (const model of MODEL_FALLBACKS) {
    try {
      const response = await client.chat.completions.create(createParams(model));
      if (model !== MODEL_FALLBACKS[0]) {
        console.log(`[deepseek] 主模型不可用，降级到 ${model} 成功`);
      }
      return response.choices[0]?.message?.content || '';
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[deepseek] 模型 ${model} 失败: ${(err as any)?.error?.message || lastError.message}`);
    }
  }
  throw lastError || new Error('所有模型均失败');
}

export async function generateFeedback(
  stylePrompt: string | null,
  facts: string
): Promise<string> {
  const systemPrompt = stylePrompt || DEFAULT_STYLE_PROMPT;
  const userPrompt = `请根据以下事实信息生成一份课后反馈。严格基于事实，不编造任何未被点选或提及的信息。如果提供了上节课反馈，请参考其中的评价和进步点，使评价具有连贯性。\n\n重要：只输出反馈正文，不要加任何解释、标题、前缀（如"基于以下数据"、"根据您的选择"、"这是生成的反馈"等）。直接以正文开头。\n\n事实信息：\n${facts}`;

  return tryWithFallback((model) => ({
    model,
    temperature: 0.7,
    max_tokens: 1200,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  }));
}

export async function analyzeStyle(samples: string[]): Promise<string> {
  const prompt = `请分析以下课后反馈样本，提取该老师的写作风格与格式特征，生成一段AI系统指令。该指令应包含：称呼习惯、语气特点、大概字数、表扬与建议的固定句式、段落结构、结尾方式、特殊格式（如是否用emoji、分隔符）等。AI后续将严格按此指令生成反馈。直接输出指令文本，不要任何额外解释。\n\n样本：\n${samples.map((s, i) => `【样本${i + 1}】\n${s}`).join('\n\n')}`;

  return tryWithFallback((model) => ({
    model,
    temperature: 0.7,
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  }));
}

export async function previewStyle(stylePrompt: string, description: string): Promise<string> {
  return tryWithFallback((model) => ({
    model,
    temperature: 0.7,
    max_tokens: 500,
    messages: [
      { role: 'system', content: stylePrompt },
      { role: 'user', content: `请根据以下描述生成一段课后反馈预览：${description}` },
    ],
  }));
}

// Placeholder for future audio analysis integration
export async function analyzeAudio(_audioData: Buffer): Promise<string> {
  throw new Error('Audio analysis not yet implemented');
}
