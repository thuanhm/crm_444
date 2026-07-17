import { kv } from '@vercel/kv';

const MONTHS_KEY = 'thidua:months';

export async function getMonths() {
  const list = await kv.get(MONTHS_KEY);
  return list || [];
}

export async function setMonths(list) {
  await kv.set(MONTHS_KEY, list);
}

export async function getMonthData(key) {
  return await kv.get(`thidua:data:${key}`);
}

export async function setMonthData(key, data) {
  await kv.set(`thidua:data:${key}`, data);
}

export async function deleteMonthData(key) {
  await kv.del(`thidua:data:${key}`);
}

export { kv };
