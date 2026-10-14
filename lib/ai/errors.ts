/** Error whose message is safe and useful to show to the user (in Spanish). */
export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}
