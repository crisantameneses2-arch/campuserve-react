export type RequestStatus =
  | "PENDING"
  | "APPROVED"
  | "PROCESSING"
  | "READY_FOR_PICKUP"
  | "COMPLETED"
  | "DECLINED"
  | "CANCELLED"
  | "RESCHEDULED";

export type RequestMethod = "OWN" | "WITH_OTHERS";

export type InvitationStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED";

export interface DocumentRequest {
  request_id: string;
  student_id: string;
  request_method: RequestMethod;
  purpose: string;
  number_of_copies: number;
  total_amount: number;
  requested_date: string;
  requested_time: string;
  created_at: unknown;
  status: RequestStatus;
  claim_code: string | null;
}

export interface DocumentRequestDetail {
  detail_id: string;
  request_id: string;
  document_type: string;
  custom_document_name: string | null;
  quantity: number;
  unit_price: number | null;
  subtotal: number | null;
}

export interface GroupRequestMember {
  member_id: string;
  request_id: string;
  student_id: string;
  invitation_status: InvitationStatus;
}