export type ClaimType = "DOCUMENT" | "ITEM";

export type ClaimStatus =
  | "PENDING"
  | "READY_FOR_PICKUP"
  | "CLAIMED"
  | "CANCELLED"
  | "EXPIRED";

export type OfficeType =
  | "REGISTRAR"
  | "GENERAL_OFFICE";

export type ClaimSchedule = {
  scheduleId: string;

  claimDate: string;
  timeSlot: string;

  slotCapacity: number;
  availableSlots: number;

  office: OfficeType;

  status: "AVAILABLE" | "FULL" | "CLOSED";

  createdAt?: unknown;
  updatedAt?: unknown;
};

export type ClaimStub = {
  claimStubId: string;

  claimCode: string;

  studentId: string;
  studentName: string;

  claimType: ClaimType;

  referenceId: string;

  scheduleId: string;

  claimDate: string;
  timeSlot: string;

  office: OfficeType;

  totalAmount: number;

  status: ClaimStatus;

  createdAt?: unknown;
  updatedAt?: unknown;
};

export type ClaimRelease = {
  claimId: string;

  claimStubId: string;

  claimCode: string;

  claimType: ClaimType;

  referenceId: string;

  studentId: string;

  scheduleId: string;

  claimAt?: unknown;

  releasedByStaffId: string;

  office: OfficeType;

  status: "COMPLETED";
};