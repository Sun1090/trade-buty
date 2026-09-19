const DEFAULT_BATCH_SIZE = 20;

async function responseError(response) {
  const body = await response.text();
  return `${response.status}${body ? `: ${body}` : ""}`;
}

export async function embedText({ fetchImpl = fetch, aiUrl, aiKey, model, text }) {
  const response = await fetchImpl(`${aiUrl}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${aiKey}`,
    },
    body: JSON.stringify({ model, input: text }),
  });
  if (!response.ok) throw new Error(`embed ${await responseError(response)}`);

  const json = await response.json();
  const embedding = json?.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("embed response missing data[0].embedding");
  }
  return embedding;
}

export async function replaceLocaleEmbeddings({
  fetchImpl = fetch,
  supabaseUrl,
  serviceKey,
  aiUrl,
  aiKey,
  model,
  locale,
  chunks,
  batchSize = DEFAULT_BATCH_SIZE,
  onProgress = () => {},
}) {
  if (chunks.length === 0) {
    throw new Error(`refusing to replace ${locale} embeddings with an empty index`);
  }

  // Generate everything first. A transient model failure must not erase the live index.
  const rows = [];
  for (const chunk of chunks) {
    rows.push({
      ...chunk,
      embedding: await embedText({ fetchImpl, aiUrl, aiKey, model, text: chunk.chunk }),
    });
  }

  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const deleteResponse = await fetchImpl(
    `${supabaseUrl}/rest/v1/kb_embeddings?locale=eq.${encodeURIComponent(locale)}`,
    { method: "DELETE", headers },
  );
  if (!deleteResponse.ok) {
    throw new Error(`delete ${locale} embeddings ${await responseError(deleteResponse)}`);
  }

  let written = 0;
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const response = await fetchImpl(`${supabaseUrl}/rest/v1/kb_embeddings`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(batch),
    });
    if (!response.ok) {
      throw new Error(`insert ${locale} batch ${index} ${await responseError(response)}`);
    }
    written += batch.length;
    onProgress(written, rows.length);
  }

  return written;
}
