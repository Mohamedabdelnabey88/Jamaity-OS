/** Keep the same operation reference when a response is lost. No automatic retry. */
export function createRetryKey(makeKey: () => string = () => `ui-${crypto.randomUUID()}`) {
  let previous: { payload: string; key: string } | undefined;
  return {
    forPayload(payload: unknown) {
      const serialized = JSON.stringify(payload);
      if (!previous || previous.payload !== serialized) {
        previous = { payload: serialized, key: makeKey() };
      }
      return previous.key;
    },
    reset() { previous = undefined; },
  };
}
