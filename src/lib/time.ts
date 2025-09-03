export const toDurationMins = (startISO: string, endISO: string) => {
  const start = new Date(startISO).getTime();
  const end   = new Date(endISO).getTime();
  return Math.max(1, Math.round((end - start) / 60000));
};
