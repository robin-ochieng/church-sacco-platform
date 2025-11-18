"use client";

import { apiClient } from '@/lib/api-client';
import { buildDownloadFilename, saveBlob } from '@/lib/download';
import { StatementResponse } from './types';

export interface GetStatementParams {
  memberId: string;
  startDate?: string;
  endDate?: string;
  type?: string;
}

const PDF_HEADERS = { Accept: 'application/pdf' } as const;

type StatementQuery = Record<string, string>;

const toStatementQuery = ({ startDate, endDate, type }: Omit<GetStatementParams, 'memberId'>): StatementQuery => {
  const params: StatementQuery = {};
  if (startDate) params.s = startDate;
  if (endDate) params.e = endDate;
  if (type) params.type = type;
  return params;
};

export async function getMemberStatement(params: GetStatementParams): Promise<StatementResponse> {
  const response = await apiClient.get<StatementResponse>(`/members/${params.memberId}/statement`, {
    params: toStatementQuery(params),
  });
  return response.data;
}

export async function downloadStatementPDF(params: GetStatementParams) {
  if (!params.memberId) {
    throw new Error('memberId is required to download a statement');
  }

  const response = await apiClient.get<Blob>(`/receipts/statement/${params.memberId}.pdf`, {
    params: toStatementQuery(params),
    responseType: 'blob',
    headers: PDF_HEADERS,
  });

  const filename = buildDownloadFilename('statement', params.memberId);
  saveBlob(response.data, filename);
}

export async function downloadReceiptPDF({
  memberId,
  receiptNumber,
}: {
  memberId: string;
  receiptNumber?: string | null;
}) {
  if (!receiptNumber) {
    throw new Error('Receipt number is required to download the PDF');
  }

  const response = await apiClient.get<Blob>(`/receipts/transaction/${receiptNumber}.pdf`, {
    responseType: 'blob',
    headers: PDF_HEADERS,
  });

  const filename = buildDownloadFilename('receipt', receiptNumber ?? memberId);
  saveBlob(response.data, filename);
}
