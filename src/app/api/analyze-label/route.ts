import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const LABEL_PROMPT = `Read the appliance label or sticker photo and respond with JSON only.

Return this exact shape:
{
  "brand": "brand name or null",
  "modelName": "exact visible model code or null",
  "manufacturingDate": "date or null"
}

Find fields labeled model, model name, model no, model code, model number, 모델명, 형명, 품명, 제품명.
Use only text visible in the photo. Keep English letters and numbers exactly as shown.
Do not invent text. If unreadable, return null for modelName.`;

function fallbackLabelResponse() {
  return {
    brand: "unknown",
    modelName: "unknown",
    manufacturingDate: null,
  };
}

function firstKnown(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value !== "string") continue;

    const text = value.trim();
    if (!text) continue;
    if (["unknown", "null", "undefined", "n/a", "-"].includes(text.toLowerCase())) continue;

    return text;
  }

  return null;
}

function parseJsonContent(content: string) {
  const clean = content.replace(/```json/g, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(clean) as Record<string, unknown>;

  return {
    brand: firstKnown(parsed, ["brand", "manufacturer", "maker", "company"]) ?? "unknown",
    modelName:
      firstKnown(parsed, [
        "modelName",
        "model_name",
        "model",
        "modelNo",
        "model_no",
        "modelNumber",
        "model_number",
        "modelCode",
        "model_code",
        "productModel",
        "product_model",
      ]) ?? "unknown",
    manufacturingDate: firstKnown(parsed, ["manufacturingDate", "manufacturing_date", "date"]) ?? null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { image } = (await request.json()) as { image?: string };

    if (!image) {
      return NextResponse.json({ error: "이미지가 없습니다." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(fallbackLabelResponse());
    }

    const client = new OpenAI({ apiKey });
    const base64Image = image.replace(/^data:image\/[a-z+.-]+;base64,/, "");

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: LABEL_PROMPT },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: 200,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    return NextResponse.json(parseJsonContent(raw));
  } catch (error) {
    console.error("[Label analyze error]", error);
    return NextResponse.json(fallbackLabelResponse());
  }
}
