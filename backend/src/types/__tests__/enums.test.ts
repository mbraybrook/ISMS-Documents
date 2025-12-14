import { getDepartmentDisplayName, Department } from '../enums';

describe('enums', () => {
  describe('getDepartmentDisplayName', () => {
    it('should return "Not assigned" when department is null', () => {
      // Arrange
      const department: Department | null = null;

      // Act
      const result = getDepartmentDisplayName(department);

      // Assert
      expect(result).toBe('Not assigned');
    });

    it('should return "Not assigned" when department is undefined', () => {
      // Arrange
      const department: Department | undefined = undefined;

      // Act
      const result = getDepartmentDisplayName(department);

      // Assert
      expect(result).toBe('Not assigned');
    });

    it('should return "Business Strategy" for BUSINESS_STRATEGY department', () => {
      // Arrange
      const department: Department = 'BUSINESS_STRATEGY';

      // Act
      const result = getDepartmentDisplayName(department);

      // Assert
      expect(result).toBe('Business Strategy');
    });

    it('should return "Finance" for FINANCE department', () => {
      // Arrange
      const department: Department = 'FINANCE';

      // Act
      const result = getDepartmentDisplayName(department);

      // Assert
      expect(result).toBe('Finance');
    });

    it('should return "HR" for HR department', () => {
      // Arrange
      const department: Department = 'HR';

      // Act
      const result = getDepartmentDisplayName(department);

      // Assert
      expect(result).toBe('HR');
    });

    it('should return "Operations" for OPERATIONS department', () => {
      // Arrange
      const department: Department = 'OPERATIONS';

      // Act
      const result = getDepartmentDisplayName(department);

      // Assert
      expect(result).toBe('Operations');
    });

    it('should return "Product" for PRODUCT department', () => {
      // Arrange
      const department: Department = 'PRODUCT';

      // Act
      const result = getDepartmentDisplayName(department);

      // Assert
      expect(result).toBe('Product');
    });

    it('should return "Marketing" for MARKETING department', () => {
      // Arrange
      const department: Department = 'MARKETING';

      // Act
      const result = getDepartmentDisplayName(department);

      // Assert
      expect(result).toBe('Marketing');
    });

    it('should return the department value as fallback for unknown department values', () => {
      // Arrange
      // TypeScript should prevent this, but the function has a fallback
      // We test it by using type assertion to bypass TypeScript checking
      const department = 'UNKNOWN_DEPARTMENT' as Department;

      // Act
      const result = getDepartmentDisplayName(department);

      // Assert
      expect(result).toBe('UNKNOWN_DEPARTMENT');
    });

    it('should handle all valid Department enum values correctly', () => {
      // Arrange
      const departments: Department[] = [
        'BUSINESS_STRATEGY',
        'FINANCE',
        'HR',
        'OPERATIONS',
        'PRODUCT',
        'MARKETING',
      ];
      const expectedDisplayNames = [
        'Business Strategy',
        'Finance',
        'HR',
        'Operations',
        'Product',
        'Marketing',
      ];

      // Act & Assert
      departments.forEach((dept, index) => {
        const result = getDepartmentDisplayName(dept);
        expect(result).toBe(expectedDisplayNames[index]);
      });
    });
  });
});


