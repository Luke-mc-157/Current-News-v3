const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';

export async function callXAIWithTools({
  model = 'grok-4-latest',
  messages,
  tools = [],
  maxTokens = 90000,
  temperature,
  reasoningEffort,
  responseFormat
}) {
  const body = {
    model,
    messages,
    max_tokens: maxTokens
  };

  if (tools.length > 0) {
    body.tools = tools.map(tool => {
      const { type, ...params } = tool;
      const formatted = { type };
      if (Object.keys(params).length > 0) {
        formatted[type] = params;
      }
      return formatted;
    });
  }

  if (temperature !== undefined) {
    body.temperature = temperature;
  }

  if (reasoningEffort) {
    body.reasoning_effort = reasoningEffort;
  }

  if (responseFormat) {
    body.response_format = responseFormat;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 960000);

  try {
    const response = await fetch(XAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`xAI API error (${response.status}): ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();

    const content = data.choices?.[0]?.message?.content || '';
    const citations = data.citations
      || data.choices?.[0]?.message?.citations
      || [];

    return {
      content,
      citations,
      model: data.model,
      usage: data.usage,
      raw: data
    };
  } finally {
    clearTimeout(timeout);
  }
}
