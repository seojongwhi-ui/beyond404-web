"use client";

import { Service3DIcon } from "@/components/Service3DIcon";
import { getTracking, submitCrewReview } from "@/lib/api";
import type { SwapRequest } from "@/types/swap";
import { Star } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

type TrackingPanelProps = {
  swapRequest: SwapRequest | null;
  onNext: () => void;
};

type PickupTrackingStatus =
  | "waiting"
  | "crew_assigned"
  | "en_route_pickup"
  | "arrived"
  | "en_route_hub"
  | "delivered_to_hub";

type Coordinates = {
  lat: number;
  lng: number;
};

type TrackingViewModel = {
  status: PickupTrackingStatus;
  title: string;
  subtitle: string;
  pickupLocation: Coordinates;
  pickupAddress: string;
  crewLocation: Coordinates | null;
  processingCenter: { label: string; lat: number; lng: number } | null;
  etaLabel: string;
  routePath: Coordinates[];
  routeDurationLabel: string;
  crewProfile: {
    name: string;
    photoUrl: string;
    rating: number;
    phone: string;
  } | null;
};

const KakaoCanvasMap = dynamic(
  () => import("@/components/maps/KakaoCanvasMap").then((module) => module.KakaoCanvasMap),
  { ssr: false },
);

const kakaoMapAppKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY?.trim() ?? "";
const MUHAMMAD_PROFILE_PHOTO = "/crew-muhammad.png";

function normalizeCrewPhoto(name?: string | null, photoUrl?: string | null) {
  if (name?.trim() === "무함마드") {
    return MUHAMMAD_PROFILE_PHOTO;
  }

  return photoUrl?.trim() || MUHAMMAD_PROFILE_PHOTO;
}

function minutesUntil(value?: string | null) {
  if (!value) return 0;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return 0;
  return Math.max(0, Math.ceil((target.getTime() - Date.now()) / 60000));
}

function deriveStatus(request: SwapRequest): PickupTrackingStatus {
  if (request.tracking.phase === "DELIVERED_TO_EWASTE_HUB" || request.pickupRequest?.status === "COMPLETED") {
    return "delivered_to_hub";
  }
  if (request.tracking.phase === "EN_ROUTE_TO_PROCESSING_CENTER") {
    return "en_route_hub";
  }
  if (request.pickupRequest?.status === "ARRIVED" || request.tracking.phase === "PICKUP_CONFIRMED") {
    return "arrived";
  }
  if (request.pickupRequest?.status === "IN_PROGRESS" || request.tracking.phase === "EN_ROUTE_TO_PICKUP") {
    return "en_route_pickup";
  }
  if (request.pickupRequest?.status === "ASSIGNED" || request.tracking.phase === "CREW_ASSIGNED") {
    return "crew_assigned";
  }
  return "waiting";
}

function titleFor(status: PickupTrackingStatus) {
  switch (status) {
    case "crew_assigned":
      return "수거 크루가 배정되었어요";
    case "en_route_pickup":
      return "크루가 수거지로 이동 중이에요";
    case "arrived":
      return "크루가 문앞에 도착했어요";
    case "en_route_hub":
      return "수거 후 처리 허브로 이동 중이에요";
    case "delivered_to_hub":
      return "e-waste 공장 전달이 완료되었어요";
    default:
      return "가까운 수거 크루를 찾고 있어요";
  }
}

function subtitleFor(status: PickupTrackingStatus) {
  switch (status) {
    case "crew_assigned":
      return "배정된 크루의 현재 위치와 이동 정보를 바로 확인할 수 있어요.";
    case "en_route_pickup":
      return "실시간으로 크루의 이동 경로와 예상 도착 시간을 확인할 수 있어요.";
    case "arrived":
      return "문앞 도착 후 실물 확인과 수거가 진행됩니다.";
    case "en_route_hub":
      return "수거 후 처리 허브까지의 이동 상황을 계속 확인할 수 있어요.";
    case "delivered_to_hub":
      return "수거와 처리 단계가 완료되어 다음 단계로 이동할 수 있어요.";
    default:
      return "매칭 점수가 높은 크루에게 우선 배차 알림을 보내고 있어요.";
  }
}

function mapToViewModel(request: SwapRequest): TrackingViewModel | null {
  const pickupLat = request.booking?.pickupLat;
  const pickupLng = request.booking?.pickupLng;

  if (pickupLat == null || pickupLng == null) {
    return null;
  }

  const status = deriveStatus(request);
  const minutes = minutesUntil(request.tracking.estimatedArrivalAt);
  const driverLocation = request.tracking.driverLocation
    ? {
        lat: request.tracking.driverLocation.lat,
        lng: request.tracking.driverLocation.lng,
      }
    : null;

  return {
    status,
    title: titleFor(status),
    subtitle: subtitleFor(status),
    pickupLocation: { lat: pickupLat, lng: pickupLng },
    pickupAddress: request.pickupRequest?.address ?? request.booking?.address ?? "수거 위치 정보 없음",
    crewLocation: driverLocation,
    processingCenter: request.tracking.processingCenter ?? null,
    etaLabel: status === "delivered_to_hub" ? "처리 완료" : minutes > 0 ? `${minutes}분 예상` : "곧 도착",
    routePath:
      request.tracking.route?.points?.map((point) => ({
        lat: point.lat,
        lng: point.lng,
      })) ?? [],
    routeDurationLabel: request.tracking.route?.durationLabel ?? "-",
    crewProfile: request.crewProfile
      ? {
          name: request.crewProfile.name,
          photoUrl: normalizeCrewPhoto(request.crewProfile.name, request.crewProfile.photoUrl),
          rating: request.crewProfile.rating,
          phone: "+82-10-0000-0000",
        }
      : null,
  };
}

export function TrackingPanel({ swapRequest, onNext }: TrackingPanelProps) {
  const [liveRequest, setLiveRequest] = useState<SwapRequest | null>(swapRequest);
  const [error, setError] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    setLiveRequest(swapRequest);
  }, [swapRequest]);

  useEffect(() => {
    if (!liveRequest?.crewReview) return;
    setReviewRating(liveRequest.crewReview.rating);
    setReviewComment(liveRequest.crewReview.comment ?? "");
  }, [liveRequest?.crewReview]);

  useEffect(() => {
    if (!swapRequest?.id || swapRequest.id < 0) {
      return undefined;
    }

    let disposed = false;

    const fetchTracking = async () => {
      try {
        const latest = await getTracking(swapRequest.id);
        if (!disposed) {
          setLiveRequest((current) => {
            const currentStatus = current ? deriveStatus(current) : "waiting";
            const latestStatus = deriveStatus(latest);
            if (
              (currentStatus === "en_route_pickup" || currentStatus === "crew_assigned") &&
              latestStatus === "waiting"
            ) {
              return current;
            }
            return latest;
          });
          setError(null);
        }
      } catch (requestError) {
        if (!disposed) {
          setError(requestError instanceof Error ? requestError.message : "tracking request failed");
        }
      }
    };

    void fetchTracking();
    const timer = window.setInterval(() => {
      void fetchTracking();
    }, 2000);

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [swapRequest?.id]);

  const viewModel = liveRequest ? mapToViewModel(liveRequest) : null;

  if (!liveRequest || !viewModel) {
    return (
      <section className="rounded-[28px] bg-white p-6 shadow-sm">
        <h2 className="text-[15px] font-bold leading-5 text-ink">수거 추적 정보가 아직 준비되지 않았어요</h2>
        <p className="mt-2 text-[13px] font-medium leading-5 text-slate-500">
          수거 요청이 접수되면 이 화면에서 크루 배정과 이동 상태를 바로 확인할 수 있어요.
        </p>
      </section>
    );
  }

  const isDelivered = viewModel.status === "delivered_to_hub";
  const activeRouteTarget =
    viewModel.status === "en_route_hub" || viewModel.status === "delivered_to_hub"
      ? viewModel.processingCenter
      : viewModel.pickupLocation;
  const hasSubmittedReview = Boolean(liveRequest.crewReview);

  const handleSubmitReview = async () => {
    if (!liveRequest.id) return;

    setReviewSubmitting(true);
    setReviewError(null);

    try {
      const updated = await submitCrewReview(liveRequest.id, {
        rating: reviewRating,
        comment: reviewComment,
      });
      setLiveRequest(updated);
    } catch (submitError) {
      setReviewError(submitError instanceof Error ? submitError.message : "평점을 등록하지 못했어요.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (!isDelivered) {
    return (
      <section className="rounded-[28px] bg-white p-5 shadow-sm">
        <span className="inline-flex rounded-full bg-lgred/10 px-3 py-1 text-xs font-bold text-lgred">
          이동 중인 크루 확인
        </span>
        <h2 className="mt-4 text-[20px] font-black leading-[1.28] text-ink">{viewModel.title}</h2>

        <div className="mt-5 overflow-hidden rounded-[24px] border border-[#f1d7df] bg-white">
          <div className="flex items-center justify-between gap-4 px-4 py-4">
            <div className="flex items-center gap-3">
              {viewModel.crewProfile ? (
                <img
                  alt={viewModel.crewProfile.name}
                  className="h-16 w-16 rounded-[18px] object-cover"
                  src={viewModel.crewProfile.photoUrl}
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-slate-100">
                  <Service3DIcon type="truck" className="h-12 w-12" />
                </div>
              )}

              <div>
                <p className="text-xs font-black text-lgred">배정 크루</p>
                <p className="mt-1 text-[15px] font-black text-ink">{viewModel.crewProfile?.name ?? "무함마드"}</p>
                <div className="mt-1 flex items-center gap-1 text-sm font-semibold text-slate-500">
                  <Star size={13} className="fill-current text-[#ffb800]" />
                  {viewModel.crewProfile ? viewModel.crewProfile.rating.toFixed(1) : "4.9"}
                </div>
              </div>
            </div>

            <div className="shrink-0 rounded-full bg-[#fff1f4] px-4 py-3 text-[15px] font-black text-lgred">
              {viewModel.etaLabel}
            </div>
          </div>

          <SimpleTrackingMap
            crewLocation={viewModel.crewLocation}
            pickupLocation={viewModel.pickupLocation}
            processingCenter={viewModel.processingCenter}
            routePath={viewModel.routePath}
            routeDurationLabel={viewModel.routeDurationLabel}
            routeTarget={activeRouteTarget}
          />

          <div className="flex items-center justify-center gap-5 border-t border-slate-100 px-4 py-4 text-xs font-bold text-slate-600">
            <LegendDot colorClass="bg-[#2563eb]" label="수거 위치" />
            <LegendDot colorClass="bg-[#dc2626]" label="크루 현재 위치" />
            <LegendDot colorClass="bg-[#16a34a]" label="처리 허브" />
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-700">{error}</p>
        ) : null}

        <button
          className="mt-5 h-14 w-full rounded-[18px] bg-lgred text-base font-black text-white shadow-[0_14px_26px_rgba(166,15,59,0.22)]"
          onClick={() => setAcknowledged(true)}
          type="button"
        >
          {acknowledged ? "확인했어요" : "확인"}
        </button>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[28px] bg-white shadow-sm">
      <div className="bg-[linear-gradient(135deg,#fff5f8,#ffffff_55%,#f8fafc)] p-5">
        <span className="inline-flex rounded-full bg-lgred/10 px-3 py-1 text-xs font-bold text-lgred">
          수거 및 처리 완료
        </span>
        <h2 className="mt-4 text-[28px] font-black leading-[1.28] text-ink">e-waste 공장 전달이 완료되었어요</h2>
        <p className="mt-2 text-[15px] font-medium leading-6 text-slate-500">
          크루 평점을 남기고 다음 단계로 이동할 수 있어요.
        </p>
      </div>

      <div className="px-5 pb-5">
        <div className="-mt-2 rounded-[26px] border border-[#f1d7df] bg-[#fff7f9] p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-black text-lgred">크루 평점</p>
              <p className="mt-1 text-[15px] font-bold text-ink">
                {viewModel.crewProfile?.name ?? "담당 크루"}는 어떠셨나요?
              </p>
            </div>
            {hasSubmittedReview ? (
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-slate-600">제출 완료</span>
            ) : null}
          </div>

          <div className="mt-4 flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white ring-1 ring-slate-200 transition"
                disabled={reviewSubmitting}
                onClick={() => setReviewRating(value)}
                type="button"
              >
                <Star size={20} className={value <= reviewRating ? "fill-[#ffb800] text-[#ffb800]" : "text-slate-300"} />
              </button>
            ))}
          </div>

          <textarea
            className="mt-4 h-24 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-medium text-ink outline-none placeholder:text-slate-400"
            disabled={reviewSubmitting}
            maxLength={120}
            onChange={(event) => setReviewComment(event.target.value)}
            placeholder="크루의 시간 준수, 수거 진행 방식 등을 짧게 남겨 주세요."
            value={reviewComment}
          />

          {reviewError ? (
            <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-xs font-bold leading-5 text-red-700">{reviewError}</p>
          ) : null}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              className="h-12 rounded-2xl border border-slate-200 bg-white text-[13px] font-bold text-slate-700"
              onClick={onNext}
              type="button"
            >
              보상 확인으로 이동
            </button>
            <button
              className="h-12 rounded-2xl bg-lgred text-[13px] font-bold text-white disabled:bg-slate-300"
              disabled={reviewSubmitting}
              onClick={() => void handleSubmitReview()}
              type="button"
            >
              {reviewSubmitting ? "등록 중..." : hasSubmittedReview ? "평점 다시 등록" : "평점 남기기"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SimpleTrackingMap({
  crewLocation,
  pickupLocation,
  processingCenter,
  routePath,
  routeDurationLabel,
  routeTarget,
}: {
  crewLocation: Coordinates | null;
  pickupLocation: Coordinates;
  processingCenter: { label: string; lat: number; lng: number } | null;
  routePath: Coordinates[];
  routeDurationLabel: string;
  routeTarget: { lat: number; lng: number } | null;
}) {
  const center = crewLocation ?? routeTarget ?? pickupLocation;

  const markers = [
    { key: "pickup", label: "home", position: pickupLocation, variant: "pickup" as const },
    ...(crewLocation ? [{ key: "crew", label: "C", position: crewLocation, variant: "crew" as const }] : []),
    ...(processingCenter
      ? [
          {
            key: "hub",
            label: "H",
            position: { lat: processingCenter.lat, lng: processingCenter.lng },
            variant: "hub" as const,
          },
        ]
      : []),
  ];

  return (
    <div className="mt-2 overflow-hidden rounded-[20px] border border-slate-100 bg-slate-50">
      {kakaoMapAppKey ? (
        <KakaoCanvasMap
          appKey={kakaoMapAppKey}
          center={center}
          className="h-[320px] w-full"
          fitBounds
          markers={markers}
          path={routePath}
          routeColor="#2563eb"
          routeOpacity={0.78}
          routeWeight={6}
        />
      ) : (
        <TrackingFallbackMap crewLocation={crewLocation} pickupLocation={pickupLocation} />
      )}

      <div className="border-t border-slate-100 bg-white px-4 py-3 text-center">
        <p className="text-xs font-black text-lgred">실시간 이동 경로</p>
        <p className="mt-1 text-sm font-semibold text-slate-600">
          {routeDurationLabel !== "-" ? `${routeDurationLabel} 안에 도착 예정이에요.` : "경로를 계산하고 있어요."}
        </p>
      </div>
    </div>
  );
}

function LegendDot({ colorClass, label }: { colorClass: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${colorClass}`} />
      {label}
    </div>
  );
}

function TrackingFallbackMap({
  crewLocation,
  pickupLocation,
}: {
  crewLocation: Coordinates | null;
  pickupLocation: Coordinates;
}) {
  return (
    <div className="relative h-[320px] w-full overflow-hidden bg-[#eef1f4]">
      <div className="absolute inset-0 opacity-80">
        <div className="absolute left-[-18%] top-[38%] h-10 w-[140%] rotate-[-18deg] bg-white shadow-sm" />
        <div className="absolute left-[-18%] top-[60%] h-9 w-[140%] rotate-[-8deg] bg-white shadow-sm" />
        <div className="absolute left-[38%] top-[-10%] h-[130%] w-9 rotate-[28deg] bg-white shadow-sm" />
        <div className="absolute left-[7%] top-[12%] h-24 w-28 rounded-[18px] border border-slate-200 bg-slate-100" />
        <div className="absolute right-[9%] top-[18%] h-20 w-24 rounded-[18px] border border-slate-200 bg-slate-100" />
        <div className="absolute bottom-[10%] left-[16%] h-24 w-32 rounded-[18px] border border-slate-200 bg-slate-100" />
      </div>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path
          d="M38 64 C48 56 56 55 66 43"
          fill="none"
          stroke="#2563eb"
          strokeWidth="1.6"
          strokeDasharray="3 2"
          opacity="0.7"
        />
      </svg>
      <div className="absolute left-[30%] top-[60%] flex flex-col items-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-white bg-[#2563eb] text-[11px] font-bold text-white shadow-lg">
          집
        </div>
      </div>
      <div className="absolute left-[62%] top-[36%] flex flex-col items-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-white bg-[#dc2626] text-[11px] font-bold text-white shadow-lg">
          C
        </div>
      </div>
      <div className="absolute bottom-3 left-3 right-3 rounded-2xl bg-white/90 px-3 py-2 text-[11px] font-semibold leading-4 text-slate-500 shadow-sm">
        지도가 연결되기 전 위치 미리보기예요. 수거 위치 {pickupLocation.lat.toFixed(4)}, {pickupLocation.lng.toFixed(4)}
        {crewLocation ? ` · 크루 ${crewLocation.lat.toFixed(4)}, ${crewLocation.lng.toFixed(4)}` : ""}
      </div>
    </div>
  );
}
