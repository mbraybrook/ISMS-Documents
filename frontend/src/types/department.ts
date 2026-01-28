// Department model from backend
export interface Department {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    users: number;
    risks: number;
  };
}

// Helper to get display name for department (works with both string names and Department objects)
export function getDepartmentDisplayName(dept: Department | string | null | undefined): string {
  if (!dept) return 'Not assigned';
  if (typeof dept === 'string') {
    // Legacy string format - just return as-is (it's already the display name)
    return dept;
  }
  // Department object format
  return dept.name;
}
