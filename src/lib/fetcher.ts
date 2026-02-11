// SWR용 공통 fetcher
export async function fetcher(url: string) {
  const res = await fetch(url);

  if (!res.ok) {
    // 401/403 같은 인증 에러는 throw (SWR이 에러로 처리)
    const error = new Error(`API error: ${res.status}`);
    throw error;
  }

  return res.json();
}
