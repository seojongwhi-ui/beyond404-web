export type SwapRequest = {
  id: number;
  customerId?: number;
  status: string;
  appliance: {
    applianceType: string;
    brand: string;
    modelName?: string;
    estimatedAge?: string;
    exteriorCondition?: string;
    conditionGrade: string;
    aiAnalysisStatus?: string;
    aiConfidence?: number;
    uploadedFileName: string | null;
  };
  preValuation: {
    minEstimatedValue: number;
    maxEstimatedValue: number;
    currency: string;
    basis: string[];
  };
  booking: {
    bookingDate: string;
    bookingTime: string;
    address: string;
    detailAddress?: string | null;
    pickupLat?: number | null;
    pickupLng?: number | null;
  } | null;
  pickupRequest?: {
    pickupRequestId: number;
    pickupType: string;
    status: string;
    crewId: number | null;
    crewName: string | null;
    address: string | null;
    scheduledAt: string;
  } | null;
  tracking: {
    message: string;
    estimatedArrivalAt: string;
    driverLocation?: {
      lat: number;
      lng: number;
      heading: number;
      speed: number;
      updatedAt: string;
    } | null;
    events?: {
      eventType: string;
      message: string;
      createdAt: string;
    }[];
  };
  finalValuation?: {
    amount: number | null;
    currency: string;
    status: string;
    reasons: string[];
  } | null;
  credit: {
    amount: number;
    currency: string;
    status: string;
  } | null;
  pickupResultReport?: {
    resultType: string;
    summary: string;
    details: string[];
  } | null;
  recyclingReport: {
    summary: string;
    steps: string[];
  };
  notifications?: {
    notificationId: number;
    title: string;
    message: string;
    read: boolean;
    createdAt: string;
  }[];
};
