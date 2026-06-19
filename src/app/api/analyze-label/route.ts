import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const LABEL_PROMPT = `Read the appliance label or sticker photo and respond with JSON only.

Return this exact shape:
{
  "brand": "brand name or null",
  "modelName": "model number/name or null",
  "manufacturingDate": "date or null"
}

Use only text visible in the photo. Do not invent text.`;

function fallbackLabelResponse() {
  return {
    brand: "unknown",
    modelName: "unknown",
    manufacturingDate: null,
  };
}

function parseJsonContent(content: string) {
  const clean = content.replace(/```json/g, "").replace(/```/g, "").trim();
  return JSON.parse(clean);
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
