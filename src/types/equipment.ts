// 장비 관련 타입 정의

export interface Equipment {
  id: string;
  teamId: string;
  name: string;
  description: string | null;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EquipmentAssignment {
  id: string;
  trainingEventId: string;
  equipmentId: string;
  userId: string | null;
  memo: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EquipmentWithAssignment extends Equipment {
  assignment?: {
    id: string;
    userId: string | null;
    memo: string | null;
    user: {
      id: string;
      name: string | null;
    } | null;
  };
}

export interface EquipmentAssignmentInput {
  equipmentId: string;
  userId: string | null;
  memo?: string;
}
