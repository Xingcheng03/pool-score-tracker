export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function httpError(status, message) {
  return new HttpError(status, message);
}
