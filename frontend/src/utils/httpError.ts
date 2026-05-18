import { isAxiosError } from "axios";

interface ErrorPayload {
  message?: string;
  error?: string;
}

export const getErrorMessage = (error: unknown, fallback: string) => {
  if (isAxiosError<ErrorPayload>(error)) {
    if (!error.response || error.code === "ERR_NETWORK") {
      return "Cannot reach API Gateway at http://localhost:4000. Ensure backend is running and CORS allows this frontend origin.";
    }
    const message = error.response?.data?.message || error.response?.data?.error;
    if (message) return message;
    if (error.response?.status) return `Request failed with status ${error.response.status}`;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};
