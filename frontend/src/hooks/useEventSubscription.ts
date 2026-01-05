import { useEffect } from 'react';

export function useEventSubscription(url: string, onUpdate: (data: any) => void) {
    useEffect(() => {
        const eventSource = new EventSource(url);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'update') {
                    console.log("Received update event:", data);
                    onUpdate(data);
                }
            } catch (e) {
                console.error("Error parsing SSE data", e);
            }
        };

        eventSource.onerror = () => {
            // Often fires on connection close or navigate away, which is normal.
            // But good to log.
            // console.log("SSE Error:", e);
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, [url, onUpdate]);
}
