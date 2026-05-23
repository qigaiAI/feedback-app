import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
});

const DEFAULT_STYLE_PROMPT = `你是一位专业、礼貌、富有鼓励性的课后反馈撰写助手。你必须严格基于提供的事实信息来撰写反馈，绝不编造任何未被提及的信息。反馈语气温暖积极，同时客观反映学生的学习情况。直接输出反馈正文，不要添加任何前缀、标题或解释。`;

interface StudentInfo {
  name: string;
  grade?: string | null;
  notes?: string | null;
}

interface EvaluationData {
  focus?: number;
  accuracy?: number;
  mastery?: string;
  participation?: { progress?: string; current?: string };
  thinking?: { progress?: string; current?: string };
  habits?: { progress?: string; current?: string };
  knowledge_depth?: { progress?: string; current?: string };
}

interface FeedbackInput {
  student: StudentInfo;
  evaluations?: EvaluationData;
  behavior_tags?: string[];
  knowledge_text?: string;
  extra_comment?: string;
  homework?: string;
  previous_feedback_text?: string;
}

export function buildFeedbackFacts(input: FeedbackInput): string {
  const { student, evaluations, behavior_tags, knowledge_text, extra_comment, homework, previous_feedback_text } = input;
  const parts: string[] = [];

  // Student info
  const header = [`学生：${student.name}`];
  if (student.grade) header.push(`年级：${student.grade}`);
  if (student.notes) header.push(`备注（AI注意）：${student.notes}`);
  parts.push(header.join(' | '));

  // Previous feedback
  if (previous_feedback_text) {
    parts.push(`\n【上节课反馈内容】\n${previous_feedback_text}`);
  }

  // Evaluations
  if (evaluations) {
    const evalLines: string[] = [];

    if (evaluations.focus) {
      evalLines.push(`- 专注度：${'★'.repeat(evaluations.focus)}${'☆'.repeat(5 - evaluations.focus)} (${evaluations.focus}/5)`);
    }
    if (evaluations.accuracy) {
      evalLines.push(`- 正确率：${'★'.repeat(evaluations.accuracy)}${'☆'.repeat(5 - evaluations.accuracy)} (${evaluations.accuracy}/5)`);
    }
    if (evaluations.mastery) {
      evalLines.push(`- 掌握情况：${evaluations.mastery}`);
    }

    // Four new dimensions
    const dimLabels: Record<string, string> = {
      participation: '参与互动度',
      thinking: '思维与反应质量',
      habits: '学习习惯',
      knowledge_depth: '知识掌握程度',
    };

    for (const [key, label] of Object.entries(dimLabels)) {
      const dim = (evaluations as any)[key];
      if (dim && (dim.progress || dim.current)) {
        const items: string[] = [];
        if (dim.progress) items.push(`进步评价：${dim.progress}`);
        if (dim.current) items.push(`当前表现：${dim.current}`);
        evalLines.push(`- ${label}：${items.join('，')}`);
      }
    }

    if (evalLines.length > 0) {
      parts.push(`\n【本节课评价】\n${evalLines.join('\n')}`);
    }
  }

  // Behavior tags
  if (behavior_tags && behavior_tags.length > 0) {
    parts.push(`\n课堂表现标签：${behavior_tags.join('、')}`);
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

export async function generateFeedback(
  stylePrompt: string | null,
  facts: string
): Promise<string> {
  const systemPrompt = stylePrompt || DEFAULT_STYLE_PROMPT;
  const userPrompt = `请根据以下事实信息生成一份课后反馈。严格基于事实，不编造任何未被点选或提及的信息。如果提供了上节课反馈，请参考其中的评价和进步点，使评价具有连贯性。\n\n重要：只输出反馈正文，不要加任何解释、标题、前缀（如"基于以下数据"、"根据您的选择"、"这是生成的反馈"等）。直接以正文开头。\n\n事实信息：\n${facts}`;

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    temperature: 0.7,
    max_tokens: 1200,
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
  throw new Error('Audio analysis not yet implemented');
}
