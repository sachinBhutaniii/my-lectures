import { useEffect, useState } from "react";

export const useFetch = <T>(apiFn: () => Promise<T>) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await apiFn();
        setData(result);

        //  setTimeout(() => {
        // setData(result);
        // },3000)
      } catch (err) {
        setError("Failed to fetch data");
      } finally {

        // setTimeout(() => {
        //     setLoading(false)
        // },3000)
        setLoading(false);
      }
    };

    fetchData();
  }, [apiFn]);

  return { data, loading, error };
};
