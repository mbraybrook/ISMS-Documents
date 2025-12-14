// Helper function to extract error message from unknown error
export function getErrorMessage(error: unknown, defaultMessage: string): string {
  if (error && typeof error === 'object') {
    // Check for axios error structure
    if ('response' in error && error.response && typeof error.response === 'object' && 'data' in error.response) {
      const responseData = error.response.data;
      if (responseData && typeof responseData === 'object' && 'error' in responseData) {
        if (typeof responseData.error === 'string') {
          return responseData.error;
        }
      }
    }
    // Check for standard Error message
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }
  }
  return defaultMessage;
}

// Helper function to extract error details for logging
export function getErrorDetails(error: unknown): unknown {
  if (error && typeof error === 'object') {
    if ('response' in error && error.response && typeof error.response === 'object' && 'data' in error.response) {
      return error.response.data;
    }
    if ('message' in error) {
      return error.message;
    }
  }
  return error;
}


