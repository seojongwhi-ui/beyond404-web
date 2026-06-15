"use client";

import { CheckCircle2, Refrigerator, ShoppingBag, WashingMachine, Wind } from "lucide-react";
import type { ReactNode } from "react";

export type ProductId = "washer" | "fridge" | "aircon";
export type ProductGrade = "프리미엄" | "일반/중형" | "보급형";

export type ReplacementProduct = {
  id: ProductId;
  name: string;
  category: string;
  grade: ProductGrade;
  originalPrice: number;
  sameDayEligible: boolean;
  tags: string[];
  icon: ReactNode;
};

type PurchasePanelProps = {
  estimatedCredit: number;
  selectedProductId: ProductId | null;
  onSelectProduct: (productId: ProductId) => void;
  onContinueToBooking: () => void;
};

export const purchaseProducts: ReplacementProduct[] = [
  {
    id: "washer",
    name: "LG 오브제컬렉션 AI 세탁기",
    category: "세탁기",
    grade: "프리미엄",
    originalPrice: 2090000,
    sameDayEligible: true,
    tags: ["25kg", "AI DD", "오브제컬렉션"],
    icon: <WashingMachine size={28} />,
  },
  {
    id: "fridge",
    name: "LG DIOS 오브제컬렉션 냉장고",
    category: "냉장고",
    grade: "프리미엄",
    originalPrice: 2890000,
    sameDayEligible: true,
    tags: ["832L", "노크온", "디오스"],
    icon: <Refrigerator size={28} />,
  },
  {
    id: "aircon",
    name: "LG 휘센 벽걸이 에어컨",
    category: "에어컨",
    grade: "일반/중형",
    originalPrice: 890000,
    sameDayEligible: false,
    tags: ["1.5톤", "듀얼 인버터", "휘센"],
    icon: <Wind size={28} />,
  },
];

export function PurchasePanel({
  estimatedCredit,
  selectedProductId,
  onSelectProduct,
  onContinueToBooking,
}: PurchasePanelProps) {
  const selectedProduct = purchaseProducts.find((product) => product.id === selectedProductId) ?? null;

  return (
    <section className="rounded-[28px] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-black text-lgred">
        <ShoppingBag size={18} />
        STEP 2-1. LG 교체 제품 선택
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        제품은 하나만 선택할 수 있습니다. 예상 보상 크레딧과 제품 등급을 반영한 최종 혜택을 확인한 뒤 수거
        예약으로 이동합니다.
      </p>

      <div className="mt-4 rounded-3xl bg-[#202632] p-4 text-white">
        <p className="text-xs font-black text-white/60">이번 교환 예상 보상 크레딧</p>
        <p className="mt-1 text-3xl font-black">{estimatedCredit.toLocaleString()}원</p>
        <p className="mt-2 text-xs font-semibold text-white/70">
          최종 크레딧 = 스크랩 가치 + min(신제품가 × 크레딧 비율, 신제품가 × 15%)
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {purchaseProducts.map((product) => {
          const active = selectedProduct?.id === product.id;
          const finalPrice = Math.max(product.originalPrice - estimatedCredit, 0);
          const rate = Math.min(100, Math.round((estimatedCredit / product.originalPrice) * 100));

          return (
            <button
              key={product.id}
              className={`block w-full rounded-3xl border p-4 text-left transition ${
                active ? "border-lgred bg-lgred/5 shadow-sm" : "border-slate-200 bg-slate-50"
              }`}
              onClick={() => onSelectProduct(product.id)}
              type="button"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-lgred shadow-sm">
                  {product.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-black text-lgred">{product.category}</p>
                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-500">
                      {product.grade}
                    </span>
                    {product.sameDayEligible ? (
                      <span className="rounded-full bg-[#dff8e7] px-2 py-1 text-[10px] font-black text-[#1b8f45]">
                        당일 배송 가능
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-1 text-base font-black text-ink">{product.name}</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {product.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-500"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <PriceTile label="정가" value={`${product.originalPrice.toLocaleString()}원`} />
                    <PriceTile label="혜택률" value={`${rate}%`} accent />
                    <PriceTile label="예상 결제" value={`${finalPrice.toLocaleString()}원`} strong />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedProduct ? (
        <div className="mt-4 rounded-3xl border border-lgred/15 bg-lgred/5 p-4">
          <div className="flex items-center gap-2 text-sm font-black text-lgred">
            <CheckCircle2 size={16} />
            선택한 제품
          </div>
          <p className="mt-2 text-lg font-black text-ink">{selectedProduct.name}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            수거가 완료되면 전체 보상 페이지와 배송 추적에서 연결 상태를 확인할 수 있습니다.
          </p>
        </div>
      ) : null}

      <button
        className="mt-5 h-12 w-full rounded-2xl bg-lgred text-sm font-black text-white disabled:bg-slate-300"
        disabled={!selectedProduct}
        onClick={onContinueToBooking}
        type="button"
      >
        이 제품으로 구매 진행
      </button>
    </section>
  );
}

function PriceTile({
  label,
  value,
  accent = false,
  strong = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white p-3">
      <p className="text-[11px] font-black text-slate-400">{label}</p>
      <p className={`mt-1 text-sm font-black ${strong ? "text-ink" : accent ? "text-lgred" : "text-slate-600"}`}>
        {value}
      </p>
    </div>
  );
}
