import { prepareAnswerContext } from "../rag.js";
import { missing, wrap } from "./common.js";
import { readAiConfig } from "../ai/config.js";

export function createAiPreviewOperations(db) {
  return {
    async previewAiContext({ params, body }) {
      const prepared = await prepareAnswerContext(db, {
        shopId: params.shopId,
        query: body.question,
      }) || missing();
      const { shop, context, prompt } = prepared;

      return wrap({
        aiConfigured: readAiConfig().mode !== 'offline',
        shop: {
          name: shop.name,
          description: shop.description,
          opening_hours: shop.opening_hours,
          persona: shop.persona,
        },
        sources: context.map(({ score, ...source }) => source),
        prompt,
      });
    },
  };
}
