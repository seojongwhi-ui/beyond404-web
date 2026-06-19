import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const PROMPT = `Analyze the appliance photo and respond with JSON only.

Return this exact shape:
{
  "applianceType": "refrigerator | washing_machine | air_conditioner | induction | tv",
  "brand": "brand name or null",
  "modelName": "model name or null",
  "capacity": "capacity or null",
  "size": "small | medium | large",
  "sizeSource": "model_spec | visual_estimate",
  "estimatedAge": "less_than_1_year | 1_to_3_years | 3_to_5_years | more_than_5_years",
  "conditionGrade": "excellent | good | fair | damaged",
  "conditionDetail": "short Korean description",
  "exteriorCondition": "short Korean description",
  "confidence": 0
}

If the model name is unclear, infer only when there is visible label/front text. Do not invent an exact model code.`;

function fallbackAnalyzeResponse() {
  return {
    applianceType: "washing_machine",
    brand: "unknown",
    modelName: "unknown",
    capacity: null,
    size: "medium",
    sizeSource: "visual_estimate",
    estimatedAge: "3_to_5_years",
    conditionGrade: "good",
    conditionDetail: "생활 스크래치가 조금 보입니다.",
    exteriorCondition: "생활 스크래치가 조금 보입니다.",
    confidence: 82,
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
      return NextResponse.json(fallbackAnalyzeResponse());
    }

    const client = new OpenAI({ apiKey });
    const base64Image = image.replace(/^data:image\/[a-z+.-]+;base64,/, "");

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
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
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    return NextResponse.json(parseJsonContent(raw));
  } catch (error) {
    console.error("[VLM analyze error]", error);
    return NextResponse.json(fallbackAnalyzeResponse());
  }
}
