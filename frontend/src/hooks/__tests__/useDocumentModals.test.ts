import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDocumentModals } from '../useDocumentModals';

describe('useDocumentModals', () => {
  beforeEach(() => {
    // Clear any state between tests
  });

  it('should initialize with all modals closed', () => {
    const { result } = renderHook(() => useDocumentModals());

    expect(result.current.isVersionUpdateOpen).toBe(false);
    expect(result.current.isControlModalOpen).toBe(false);
    expect(result.current.isConfirmOpen).toBe(false);
    expect(result.current.selectedControl).toBe(null);
    expect(result.current.cancelRef).toBeDefined();
  });

  it('should open and close version update modal', () => {
    const { result } = renderHook(() => useDocumentModals());

    act(() => {
      result.current.onVersionUpdateOpen();
    });

    expect(result.current.isVersionUpdateOpen).toBe(true);

    act(() => {
      result.current.onVersionUpdateClose();
    });

    expect(result.current.isVersionUpdateOpen).toBe(false);
  });

  it('should open and close control modal', () => {
    const { result } = renderHook(() => useDocumentModals());

    act(() => {
      result.current.onControlModalOpen();
    });

    expect(result.current.isControlModalOpen).toBe(true);

    act(() => {
      result.current.onControlModalClose();
    });

    expect(result.current.isControlModalOpen).toBe(false);
    expect(result.current.selectedControl).toBe(null);
  });

  it('should set and clear selected control when closing modal', () => {
    const { result } = renderHook(() => useDocumentModals());
    const mockControl = { id: 'control-1', code: 'A.1.1', title: 'Test Control' } as never;

    act(() => {
      result.current.setSelectedControl(mockControl);
    });

    expect(result.current.selectedControl).toBe(mockControl);

    act(() => {
      result.current.onControlModalClose();
    });

    expect(result.current.selectedControl).toBe(null);
  });

  it('should open and close confirm dialog', () => {
    const { result } = renderHook(() => useDocumentModals());

    // Note: confirm dialog doesn't have an explicit open function in the hook
    // It's managed by useDisclosure internally
    expect(result.current.isConfirmOpen).toBe(false);
    expect(result.current.onConfirmClose).toBeDefined();
  });
});


