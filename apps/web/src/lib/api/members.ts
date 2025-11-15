import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export interface RegistrationData {
  // User credentials
  email: string;
  password: string;

  // Personal Information
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  telephone: string;
  emailOptional?: string;

  // Address & Church Group
  physicalAddress: string;
  poBox?: string;
  churchGroup?: string;

  // ID & Referee
  idPassportNumber: string;
  refereeMemberNo?: string;

  // Next of Kin
  nextOfKinName: string;
  nextOfKinPhone: string;
  nextOfKinRelationship: string;

  // Terms
  agreedToTerms: boolean;
  agreedToRefundPolicy: boolean;
}

export interface MemberResponse {
  message: string;
  member: {
    id: string;
    memberNumber: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export async function registerMember(data: RegistrationData): Promise<MemberResponse> {
  const response = await axios.post<MemberResponse>(`${API_URL}/members`, data);
  return response.data;
}

export async function checkMemberExists(memberNumber: string): Promise<boolean> {
  try {
    await axios.get(`${API_URL}/members/number/${memberNumber}`);
    return true;
  } catch (error) {
    return false;
  }
}
