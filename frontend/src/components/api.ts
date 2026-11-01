export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload: unknown = await response.json();

  if (!response.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}

export function currentMonthYear() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

export function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString();
}

export function formatMoney(amount: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'INR',
  }).format(Number(amount) || 0);
}
